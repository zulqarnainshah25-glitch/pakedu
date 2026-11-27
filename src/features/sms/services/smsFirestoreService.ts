import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../firebase';
import { sanitizeFirestoreData } from '../../../utils/firestoreSanitizer';
import {
  enqueueOfflineMutation,
  recordServerBaseline,
  recordServerBaselinesBatch,
  removeServerBaseline,
  detectOfflineConflict,
  normalizeTimestampValue,
  prepareCloneableValue,
  type OfflineSyncItem,
  type OfflineEntityType,
  type ConflictResolutionChoice,
  type EnqueueOfflineMutationInput,
} from '../../../services/offlineSyncService';
import {
  School,
  UserProfile,
  ClassSection,
  Student,
  DailyClassAttendance,
  TeacherJoinRequest,
  SchoolRegistrationRequest,
  TeacherInfo,
  ClassFeeStructure,
  FeePayment,
  FeeConcessionRule,
  Exam,
  StudentExamMarks,
  ParentStudentLink,
  StudentPortalLink,
  TimetableEntry,
  HomeworkItem,
  StudentCertificate,
  GlobalNotice,
  SchoolAnalyticsSummary,
  SalaryStructure,
  EmployeePayslip,
  PayrollSettings,
  SchoolLessonPlan,
  SchoolQuestionPaper,
} from '../types';
import type { SyllabusPreset } from '../../../data/syllabusPresets';

/**
 * Multi-Tenant School Management Firestore Persistence Service
 * Safely handles cloud persistence with typed error diagnostics,
 * server timestamps, and offline resilience via IndexedDB persistent cache + queue.
 */

export type FirestoreServiceErrorCode =
  | 'permission-denied'
  | 'offline'
  | 'unavailable'
  | 'unauthenticated'
  | 'not-found'
  | 'invalid-argument'
  | 'unknown';

export function isDeviceOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export class FirestoreSyncError extends Error {
  readonly code: FirestoreServiceErrorCode;
  readonly isOffline: boolean;
  readonly isPermissionDenied: boolean;
  readonly operation: string;
  readonly path?: string;
  readonly originalError?: unknown;

  constructor(
    message: string,
    code: FirestoreServiceErrorCode,
    operation: string,
    options?: { path?: string; originalError?: unknown }
  ) {
    super(message);
    this.name = 'FirestoreSyncError';
    this.code = code;
    this.operation = operation;
    this.path = options?.path;
    this.originalError = options?.originalError;
    this.isOffline =
      code === 'offline' ||
      code === 'unavailable' ||
      isDeviceOffline();
    this.isPermissionDenied = code === 'permission-denied';
  }
}

export function classifyFirestoreError(err: unknown, operation: string, path?: string): FirestoreSyncError {
  if (err instanceof FirestoreSyncError) {
    return err;
  }
  const isBrowserOffline = isDeviceOffline();
  const rawCode = (err as any)?.code || '';
  const rawMessage = (err as any)?.message || String(err);

  let code: FirestoreServiceErrorCode = 'unknown';

  if (
    isBrowserOffline ||
    rawCode === 'unavailable' ||
    rawCode === 'offline' ||
    rawMessage.toLowerCase().includes('offline') ||
    rawMessage.toLowerCase().includes('failed to fetch') ||
    rawMessage.toLowerCase().includes('network')
  ) {
    code = 'offline';
  } else if (
    rawCode === 'permission-denied' ||
    rawMessage.toLowerCase().includes('permission-denied') ||
    rawMessage.toLowerCase().includes('insufficient permissions')
  ) {
    code = 'permission-denied';
  } else if (rawCode === 'unauthenticated' || rawMessage.toLowerCase().includes('unauthenticated')) {
    code = 'unauthenticated';
  } else if (rawCode === 'not-found' || rawMessage.toLowerCase().includes('not-found')) {
    code = 'not-found';
  } else if (rawCode === 'invalid-argument') {
    code = 'invalid-argument';
  }

  const reason =
    code === 'permission-denied'
      ? 'Permission denied by institutional security policy'
      : code === 'offline'
      ? 'Network connection offline (queued locally)'
      : rawMessage;

  return new FirestoreSyncError(reason, code, operation, { path, originalError: err });
}

/**
 * Prevents Firestore `persistentLocalCache` writes from hanging indefinitely when
 * offline or on a dead Wi-Fi link; fails fast as `'offline'` so writes queue to IndexedDB.
 */
async function runOnlineFirestoreWrite<T>(
  operation: string,
  path: string,
  writeFn: () => Promise<T>,
  timeoutMs = 12000
): Promise<T> {
  if (isDeviceOffline()) {
    throw new FirestoreSyncError(
      'Network connection offline (queued locally)',
      'offline',
      operation,
      { path }
    );
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let offlineHandler: (() => void) | undefined;

  try {
    const racePromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(
          new FirestoreSyncError(
            'Cloud write timed out due to lost internet connectivity (queued locally)',
            'offline',
            operation,
            { path }
          )
        );
      }, timeoutMs);

      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        offlineHandler = () => {
          reject(
            new FirestoreSyncError(
              'Connection went offline during write (queued locally)',
              'offline',
              operation,
              { path }
            )
          );
        };
        window.addEventListener('offline', offlineHandler, { once: true });
      }
    });

    return await Promise.race([writeFn(), racePromise]);
  } catch (err) {
    throw classifyFirestoreError(err, operation, path);
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    if (offlineHandler && typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('offline', offlineHandler);
    }
  }
}

function normalizeTimestamps<T extends Record<string, any>>(data: T): T {
  const result: any = { ...data };
  if (result.updatedAt && typeof result.updatedAt.toDate === 'function') {
    result.updatedAt = result.updatedAt.toDate().toISOString();
  }
  if (result.createdAt && typeof result.createdAt.toDate === 'function') {
    result.createdAt = result.createdAt.toDate().toISOString();
  }
  return result;
}

// 1. School Document Management
export async function saveSchoolToFirestore(school: School): Promise<boolean> {
  if (!school.id) {
    throw new FirestoreSyncError('Cannot save school without a valid ID', 'invalid-argument', 'saveSchool');
  }
  const path = `schools/${school.id}`;
  try {
    const schoolRef = doc(db, 'schools', school.id);
    await runOnlineFirestoreWrite('saveSchool', path, () =>
      setDoc(
        schoolRef,
        sanitizeFirestoreData({
          ...school,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      )
    );
    void recordServerBaseline(path, school, school.createdAt);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveSchool', path);
  }
}

export async function fetchSchoolsFromFirestore(): Promise<School[]> {
  try {
    const schoolsCol = collection(db, 'schools');
    const snapshot = await getDocs(schoolsCol);
    const schools: School[] = [];
    snapshot.forEach((d) => {
      if (d.exists()) {
        const data = d.data() as School;
        schools.push(normalizeTimestamps({ ...data, id: data.id || d.id }));
      }
    });
    if (!isDeviceOffline() && schools.length > 0) {
      void recordServerBaselinesBatch(
        schools.map((s) => ({ docPath: `schools/${s.id}`, snapshot: s, updatedAt: (s as any).updatedAt }))
      );
    }
    return schools;
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchSchools', 'schools');
  }
}

// 2. User Profile Management
export async function saveUserProfileToFirestore(profile: UserProfile): Promise<boolean> {
  if (!profile.uid) {
    throw new FirestoreSyncError('Cannot save user profile without a valid UID', 'invalid-argument', 'saveUserProfile');
  }
  const path = `users/${profile.uid}`;
  try {
    const userRef = doc(db, 'users', profile.uid);
    await runOnlineFirestoreWrite('saveUserProfile', path, () =>
      setDoc(
        userRef,
        sanitizeFirestoreData({
          ...profile,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      )
    );
    void recordServerBaseline(path, profile);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveUserProfile', path);
  }
}

export async function fetchUserProfileFromFirestore(uid: string): Promise<UserProfile | null> {
  if (!uid) return null;
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const profile = normalizeTimestamps(snap.data() as UserProfile);
      if (!isDeviceOffline()) {
        void recordServerBaseline(`users/${uid}`, profile, (profile as any).updatedAt);
      }
      return profile;
    }
    return null;
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchUserProfile', `users/${uid}`);
  }
}

// 3. Classes & Sections Management
export async function saveClassToFirestore(schoolId: string, classData: ClassSection): Promise<boolean> {
  if (!schoolId || !classData.id) {
    throw new FirestoreSyncError('School ID and Class ID are required', 'invalid-argument', 'saveClass');
  }
  const path = `schools/${schoolId}/classes/${classData.id}`;
  try {
    const classRef = doc(db, 'schools', schoolId, 'classes', classData.id);
    await runOnlineFirestoreWrite('saveClass', path, () =>
      setDoc(
        classRef,
        sanitizeFirestoreData({
          ...classData,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      )
    );
    void recordServerBaseline(path, classData, (classData as any).updatedAt);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveClass', path);
  }
}

export async function deleteClassFromFirestore(schoolId: string, classId: string): Promise<boolean> {
  if (!schoolId || !classId) {
    throw new FirestoreSyncError('School ID and Class ID are required to delete', 'invalid-argument', 'deleteClass');
  }
  const path = `schools/${schoolId}/classes/${classId}`;
  try {
    const classRef = doc(db, 'schools', schoolId, 'classes', classId);
    await runOnlineFirestoreWrite('deleteClass', path, () => deleteDoc(classRef));
    void removeServerBaseline(path);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'deleteClass', path);
  }
}

export async function fetchClassesFromFirestore(schoolId: string): Promise<ClassSection[]> {
  if (!schoolId) return [];
  try {
    const classesCol = collection(db, 'schools', schoolId, 'classes');
    const snapshot = await getDocs(classesCol);
    const classes: ClassSection[] = [];
    snapshot.forEach((d) => {
      if (d.exists()) {
        const data = d.data() as ClassSection;
        classes.push(normalizeTimestamps({ ...data, id: data.id || d.id }));
      }
    });
    if (!isDeviceOffline() && classes.length > 0) {
      void recordServerBaselinesBatch(
        classes.map((c) => ({
          docPath: `schools/${schoolId}/classes/${c.id}`,
          snapshot: c,
          updatedAt: (c as any).updatedAt,
        }))
      );
    }
    return classes;
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchClasses', `schools/${schoolId}/classes`);
  }
}

// 4. Students (SIS) Management
export async function saveStudentToFirestore(schoolId: string, student: Student): Promise<boolean> {
  if (!schoolId || !student.id) {
    throw new FirestoreSyncError('School ID and Student ID are required', 'invalid-argument', 'saveStudent');
  }
  const path = `schools/${schoolId}/students/${student.id}`;
  try {
    const studentRef = doc(db, 'schools', schoolId, 'students', student.id);
    await runOnlineFirestoreWrite('saveStudent', path, () =>
      setDoc(
        studentRef,
        sanitizeFirestoreData({
          ...student,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      )
    );
    void recordServerBaseline(path, student, (student as any).updatedAt);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveStudent', path);
  }
}

export async function saveStudentInviteCodeOnlyToFirestore(
  schoolId: string,
  studentId: string,
  studentInviteCode: string
): Promise<boolean> {
  if (!schoolId || !studentId || !studentInviteCode.trim()) return false;
  const path = `schools/${schoolId}/students/${studentId}`;
  try {
    const ref = doc(db, 'schools', schoolId, 'students', studentId);
    await runOnlineFirestoreWrite('saveStudentInviteCode', path, () =>
      setDoc(
        ref,
        sanitizeFirestoreData({
          studentInviteCode: studentInviteCode.trim().toUpperCase(),
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      )
    );
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveStudentInviteCode', path);
  }
}

export async function deleteStudentFromFirestore(schoolId: string, studentId: string): Promise<boolean> {
  if (!schoolId || !studentId) {
    throw new FirestoreSyncError('School ID and Student ID are required to delete', 'invalid-argument', 'deleteStudent');
  }
  const path = `schools/${schoolId}/students/${studentId}`;
  try {
    const studentRef = doc(db, 'schools', schoolId, 'students', studentId);
    await runOnlineFirestoreWrite('deleteStudent', path, () => deleteDoc(studentRef));
    void removeServerBaseline(path);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'deleteStudent', path);
  }
}

export async function fetchStudentsFromFirestore(schoolId: string): Promise<Student[]> {
  if (!schoolId) return [];
  try {
    const studentsCol = collection(db, 'schools', schoolId, 'students');
    const snapshot = await getDocs(studentsCol);
    const students: Student[] = [];
    snapshot.forEach((d) => {
      if (d.exists()) {
        const data = d.data() as Student;
        students.push(normalizeTimestamps({ ...data, id: data.id || d.id }));
      }
    });
    if (!isDeviceOffline() && students.length > 0) {
      void recordServerBaselinesBatch(
        students.map((s) => ({
          docPath: `schools/${schoolId}/students/${s.id}`,
          snapshot: s,
          updatedAt: (s as any).updatedAt,
        }))
      );
    }
    return students;
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchStudents', `schools/${schoolId}/students`);
  }
}

// 5. Daily Attendance Management (Composite Document: YYYY-MM-DD_classId)
export async function saveAttendanceToFirestore(
  schoolId: string,
  attendance: DailyClassAttendance
): Promise<boolean> {
  if (!schoolId || !attendance.id) {
    throw new FirestoreSyncError('School ID and Attendance ID are required', 'invalid-argument', 'saveAttendance');
  }
  const path = `schools/${schoolId}/attendance/${attendance.id}`;
  const normalizedAtt = {
    ...attendance,
    schoolId,
    conductedBy: attendance.markedByName || 'Faculty',
    conductedByUid: attendance.markedByUid || 'system',
  };
  try {
    const attRef = doc(db, 'schools', schoolId, 'attendance', attendance.id);
    await runOnlineFirestoreWrite('saveAttendance', path, () =>
      setDoc(
        attRef,
        sanitizeFirestoreData({
          ...normalizedAtt,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      )
    );
    void recordServerBaseline(path, normalizedAtt, (attendance as any).updatedAt);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveAttendance', path);
  }
}

export async function fetchAttendanceFromFirestore(
  schoolId: string,
  classId?: string
): Promise<Record<string, DailyClassAttendance>> {
  if (!schoolId) return {};
  try {
    const attCol = collection(db, 'schools', schoolId, 'attendance');
    const q = classId ? query(attCol, where('classId', '==', classId)) : attCol;
    const snapshot = await getDocs(q);
    const registers: Record<string, DailyClassAttendance> = {};
    snapshot.forEach((d) => {
      if (d.exists()) {
        const item = normalizeTimestamps(d.data() as DailyClassAttendance);
        registers[item.id] = item;
      }
    });
    const list = Object.values(registers);
    if (!isDeviceOffline() && list.length > 0) {
      void recordServerBaselinesBatch(
        list.map((item) => ({
          docPath: `schools/${schoolId}/attendance/${item.id}`,
          snapshot: item,
          updatedAt: (item as any).updatedAt,
        }))
      );
    }
    return registers;
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchAttendance', `schools/${schoolId}/attendance`);
  }
}

// 6. Faculty Join Requests Management
export async function saveJoinRequestToFirestore(
  schoolId: string,
  request: TeacherJoinRequest
): Promise<boolean> {
  if (!schoolId || !request.id) {
    throw new FirestoreSyncError('School ID and Request ID are required', 'invalid-argument', 'saveJoinRequest');
  }
  const path = `schools/${schoolId}/joinRequests/${request.id}`;
  try {
    const reqRef = doc(db, 'schools', schoolId, 'joinRequests', request.id);
    await runOnlineFirestoreWrite('saveJoinRequest', path, () =>
      setDoc(
        reqRef,
        sanitizeFirestoreData({
          ...request,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      )
    );
    void recordServerBaseline(path, request);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveJoinRequest', path);
  }
}

export async function fetchJoinRequestsFromFirestore(
  schoolId: string
): Promise<TeacherJoinRequest[]> {
  if (!schoolId) return [];
  try {
    const reqCol = collection(db, 'schools', schoolId, 'joinRequests');
    const snapshot = await getDocs(reqCol);
    const requests: TeacherJoinRequest[] = [];
    snapshot.forEach((d) => {
      if (d.exists()) {
        requests.push(normalizeTimestamps(d.data() as TeacherJoinRequest));
      }
    });
    return requests;
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchJoinRequests', `schools/${schoolId}/joinRequests`);
  }
}

// 7. Super Admin School Registration Requests
export async function saveSchoolRegistrationRequestToFirestore(
  request: SchoolRegistrationRequest
): Promise<boolean> {
  if (!request.id) {
    throw new FirestoreSyncError('Request ID is required', 'invalid-argument', 'saveSchoolRegistrationRequest');
  }
  const path = `schoolRegistrationRequests/${request.id}`;
  try {
    const reqRef = doc(db, 'schoolRegistrationRequests', request.id);
    await runOnlineFirestoreWrite('saveSchoolRegistrationRequest', path, () =>
      setDoc(
        reqRef,
        sanitizeFirestoreData({
          ...request,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      )
    );
    void recordServerBaseline(path, request);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveSchoolRegistrationRequest', path);
  }
}

export async function fetchSchoolRegistrationRequestsFromFirestore(): Promise<SchoolRegistrationRequest[]> {
  try {
    const reqCol = collection(db, 'schoolRegistrationRequests');
    const snapshot = await getDocs(reqCol);
    const requests: SchoolRegistrationRequest[] = [];
    snapshot.forEach((d) => {
      if (d.exists()) {
        requests.push(normalizeTimestamps(d.data() as SchoolRegistrationRequest));
      }
    });
    return requests;
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchSchoolRegistrationRequests', 'schoolRegistrationRequests');
  }
}

// 8. Teacher Profiles Management
export async function saveTeacherToFirestore(
  schoolId: string,
  teacher: TeacherInfo
): Promise<boolean> {
  if (!schoolId || !teacher.id) {
    throw new FirestoreSyncError('School ID and Teacher ID are required', 'invalid-argument', 'saveTeacher');
  }
  const path = `schools/${schoolId}/teachers/${teacher.id}`;
  try {
    const teacherRef = doc(db, 'schools', schoolId, 'teachers', teacher.id);
    await runOnlineFirestoreWrite('saveTeacher', path, () =>
      setDoc(
        teacherRef,
        sanitizeFirestoreData({
          ...teacher,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      )
    );
    void recordServerBaseline(path, teacher);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveTeacher', path);
  }
}

export async function fetchTeachersFromFirestore(
  schoolId: string
): Promise<TeacherInfo[]> {
  if (!schoolId) return [];
  try {
    const teacherCol = collection(db, 'schools', schoolId, 'teachers');
    const snapshot = await getDocs(teacherCol);
    const teachers: TeacherInfo[] = [];
    snapshot.forEach((d) => {
      if (d.exists()) {
        const data = d.data() as TeacherInfo;
        teachers.push(normalizeTimestamps({ ...data, id: data.id || d.id }));
      }
    });
    if (!isDeviceOffline() && teachers.length > 0) {
      void recordServerBaselinesBatch(
        teachers.map((t) => ({
          docPath: `schools/${schoolId}/teachers/${t.id}`,
          snapshot: t,
          updatedAt: (t as any).updatedAt,
        }))
      );
    }
    return teachers;
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchTeachers', `schools/${schoolId}/teachers`);
  }
}

// 9. Fee Structures Management (schools/{schoolId}/feeStructures/{classId})
export async function saveFeeStructureToFirestore(
  schoolId: string,
  feeStructure: ClassFeeStructure
): Promise<boolean> {
  if (!schoolId || !feeStructure.classId) {
    throw new FirestoreSyncError('School ID and Class ID are required', 'invalid-argument', 'saveFeeStructure');
  }
  const docId = feeStructure.id || feeStructure.classId;
  const path = `schools/${schoolId}/feeStructures/${docId}`;
  const normalizedStruct = {
    ...feeStructure,
    id: docId,
    schoolId,
  };
  try {
    const ref = doc(db, 'schools', schoolId, 'feeStructures', docId);
    await runOnlineFirestoreWrite('saveFeeStructure', path, () =>
      setDoc(
        ref,
        sanitizeFirestoreData({
          ...normalizedStruct,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      )
    );
    void recordServerBaseline(path, normalizedStruct, feeStructure.updatedAt);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveFeeStructure', path);
  }
}

export async function fetchFeeStructuresFromFirestore(
  schoolId: string
): Promise<ClassFeeStructure[]> {
  if (!schoolId) return [];
  try {
    const col = collection(db, 'schools', schoolId, 'feeStructures');
    const snapshot = await getDocs(col);
    const feeStructures: ClassFeeStructure[] = [];
    snapshot.forEach((d) => {
      if (d.exists()) {
        const data = d.data() as ClassFeeStructure;
        feeStructures.push(normalizeTimestamps({ ...data, id: data.id || d.id, classId: data.classId || d.id }));
      }
    });
    if (!isDeviceOffline() && feeStructures.length > 0) {
      void recordServerBaselinesBatch(
        feeStructures.map((f) => ({
          docPath: `schools/${schoolId}/feeStructures/${f.id || f.classId}`,
          snapshot: f,
          updatedAt: f.updatedAt,
        }))
      );
    }
    return feeStructures;
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchFeeStructures', `schools/${schoolId}/feeStructures`);
  }
}

export async function fetchSingleFeeStructureFromFirestore(
  schoolId: string,
  classId: string
): Promise<ClassFeeStructure | null> {
  if (!schoolId || !classId) return null;
  try {
    const ref = doc(db, 'schools', schoolId, 'feeStructures', classId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data() as ClassFeeStructure;
    return normalizeTimestamps({
      ...data,
      id: data.id || snap.id,
      classId: data.classId || snap.id,
    });
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchSingleFeeStructure', `schools/${schoolId}/feeStructures/${classId}`);
  }
}

export async function deleteFeeStructureFromFirestore(
  schoolId: string,
  classId: string
): Promise<boolean> {
  if (!schoolId || !classId) {
    throw new FirestoreSyncError('School ID and Class ID are required', 'invalid-argument', 'deleteFeeStructure');
  }
  const path = `schools/${schoolId}/feeStructures/${classId}`;
  try {
    const ref = doc(db, 'schools', schoolId, 'feeStructures', classId);
    await runOnlineFirestoreWrite('deleteFeeStructure', path, () => deleteDoc(ref));
    void removeServerBaseline(path);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'deleteFeeStructure', path);
  }
}

// 10. Fee Payments Management (schools/{schoolId}/feePayments/{paymentId})
export async function saveFeePaymentToFirestore(
  schoolId: string,
  payment: FeePayment
): Promise<boolean> {
  if (!schoolId || !payment.id) {
    throw new FirestoreSyncError('School ID and Payment ID are required', 'invalid-argument', 'saveFeePayment');
  }
  const path = `schools/${schoolId}/feePayments/${payment.id}`;
  const normalizedPay = {
    ...payment,
    schoolId,
    receiptNumber: payment.receiptNumber || '',
    paymentMethod: payment.paymentMethod || 'Cash',
    notes: payment.notes || '',
    installments: Array.isArray(payment.installments) ? payment.installments : [],
  };
  try {
    const ref = doc(db, 'schools', schoolId, 'feePayments', payment.id);
    await runOnlineFirestoreWrite('saveFeePayment', path, () =>
      setDoc(
        ref,
        sanitizeFirestoreData({
          ...normalizedPay,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      )
    );
    void recordServerBaseline(path, normalizedPay, payment.updatedAt);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveFeePayment', path);
  }
}

export async function fetchFeePaymentsFromFirestore(
  schoolId: string
): Promise<FeePayment[]> {
  if (!schoolId) return [];
  try {
    const col = collection(db, 'schools', schoolId, 'feePayments');
    const snapshot = await getDocs(col);
    const payments: FeePayment[] = [];
    snapshot.forEach((d) => {
      if (d.exists()) {
        const data = d.data() as FeePayment;
        payments.push(normalizeTimestamps({ ...data, id: data.id || d.id }));
      }
    });
    if (!isDeviceOffline() && payments.length > 0) {
      void recordServerBaselinesBatch(
        payments.map((p) => ({
          docPath: `schools/${schoolId}/feePayments/${p.id}`,
          snapshot: p,
          updatedAt: p.updatedAt,
        }))
      );
    }
    return payments;
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchFeePayments', `schools/${schoolId}/feePayments`);
  }
}

// 11. Fee Concessions & Discount Rules Management (schools/{schoolId}/feeConcessions/{concessionId})
export async function saveFeeConcessionToFirestore(
  schoolId: string,
  rule: FeeConcessionRule
): Promise<boolean> {
  if (!schoolId || !rule.id) {
    throw new FirestoreSyncError('School ID and Concession ID are required', 'invalid-argument', 'saveFeeConcession');
  }
  const path = `schools/${schoolId}/feeConcessions/${rule.id}`;
  const normalizedRule = {
    ...rule,
    schoolId,
  };
  try {
    const ref = doc(db, 'schools', schoolId, 'feeConcessions', rule.id);
    await runOnlineFirestoreWrite('saveFeeConcession', path, () =>
      setDoc(
        ref,
        sanitizeFirestoreData({
          ...normalizedRule,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      )
    );
    void recordServerBaseline(path, normalizedRule, rule.updatedAt);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveFeeConcession', path);
  }
}

export async function fetchFeeConcessionsFromFirestore(
  schoolId: string
): Promise<FeeConcessionRule[]> {
  if (!schoolId) return [];
  try {
    const col = collection(db, 'schools', schoolId, 'feeConcessions');
    const snapshot = await getDocs(col);
    const rules: FeeConcessionRule[] = [];
    snapshot.forEach((d) => {
      if (d.exists()) {
        const data = d.data() as FeeConcessionRule;
        rules.push(normalizeTimestamps({ ...data, id: data.id || d.id }));
      }
    });
    if (!isDeviceOffline() && rules.length > 0) {
      void recordServerBaselinesBatch(
        rules.map((r) => ({
          docPath: `schools/${schoolId}/feeConcessions/${r.id}`,
          snapshot: r,
          updatedAt: r.updatedAt,
        }))
      );
    }
    return rules;
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchFeeConcessions', `schools/${schoolId}/feeConcessions`);
  }
}

export async function deleteFeeConcessionFromFirestore(
  schoolId: string,
  concessionId: string
): Promise<boolean> {
  if (!schoolId || !concessionId) {
    throw new FirestoreSyncError('School ID and Concession ID are required', 'invalid-argument', 'deleteFeeConcession');
  }
  const path = `schools/${schoolId}/feeConcessions/${concessionId}`;
  try {
    const ref = doc(db, 'schools', schoolId, 'feeConcessions', concessionId);
    await runOnlineFirestoreWrite('deleteFeeConcession', path, () => deleteDoc(ref));
    void removeServerBaseline(path);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'deleteFeeConcession', path);
  }
}

// 12. Exams Management (schools/{schoolId}/exams/{examId})
export async function saveExamToFirestore(schoolId: string, exam: Exam): Promise<boolean> {
  if (!schoolId || !exam.id) {
    throw new FirestoreSyncError('School ID and Exam ID are required', 'invalid-argument', 'saveExam');
  }
  const path = `schools/${schoolId}/exams/${exam.id}`;
  const normalizedExam = {
    ...exam,
    schoolId,
  };
  try {
    const ref = doc(db, 'schools', schoolId, 'exams', exam.id);
    await runOnlineFirestoreWrite('saveExam', path, () =>
      setDoc(
        ref,
        sanitizeFirestoreData({
          ...normalizedExam,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      )
    );
    void recordServerBaseline(path, normalizedExam, exam.updatedAt);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveExam', path);
  }
}

export async function fetchExamsFromFirestore(schoolId: string): Promise<Exam[]> {
  if (!schoolId) return [];
  try {
    const col = collection(db, 'schools', schoolId, 'exams');
    const snapshot = await getDocs(col);
    const exams: Exam[] = [];
    snapshot.forEach((d) => {
      if (d.exists()) {
        const data = d.data() as Exam;
        exams.push(normalizeTimestamps({ ...data, id: data.id || d.id }));
      }
    });
    if (!isDeviceOffline() && exams.length > 0) {
      void recordServerBaselinesBatch(
        exams.map((e) => ({
          docPath: `schools/${schoolId}/exams/${e.id}`,
          snapshot: e,
          updatedAt: e.updatedAt,
        }))
      );
    }
    return exams;
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchExams', `schools/${schoolId}/exams`);
  }
}

export async function deleteExamFromFirestore(schoolId: string, examId: string): Promise<boolean> {
  if (!schoolId || !examId) {
    throw new FirestoreSyncError('School ID and Exam ID are required', 'invalid-argument', 'deleteExam');
  }
  const path = `schools/${schoolId}/exams/${examId}`;
  try {
    const ref = doc(db, 'schools', schoolId, 'exams', examId);
    await runOnlineFirestoreWrite('deleteExam', path, () => deleteDoc(ref));
    void removeServerBaseline(path);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'deleteExam', path);
  }
}

// 13. Student Exam Marks Management (schools/{schoolId}/marks/{markId})
export async function saveStudentMarksToFirestore(
  schoolId: string,
  marks: StudentExamMarks
): Promise<boolean> {
  if (!schoolId || !marks.id) {
    throw new FirestoreSyncError('School ID and Marks ID are required', 'invalid-argument', 'saveStudentMarks');
  }
  const path = `schools/${schoolId}/marks/${marks.id}`;
  const normalizedMarks = {
    ...marks,
    schoolId,
  };
  try {
    const ref = doc(db, 'schools', schoolId, 'marks', marks.id);
    await runOnlineFirestoreWrite('saveStudentMarks', path, () =>
      setDoc(
        ref,
        sanitizeFirestoreData({
          ...normalizedMarks,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      )
    );
    void recordServerBaseline(path, normalizedMarks, marks.updatedAt);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveStudentMarks', path);
  }
}

export async function fetchMarksFromFirestore(schoolId: string): Promise<StudentExamMarks[]> {
  if (!schoolId) return [];
  try {
    const col = collection(db, 'schools', schoolId, 'marks');
    const snapshot = await getDocs(col);
    const marks: StudentExamMarks[] = [];
    snapshot.forEach((d) => {
      if (d.exists()) {
        const data = d.data() as StudentExamMarks;
        marks.push(normalizeTimestamps({ ...data, id: data.id || d.id }));
      }
    });
    if (!isDeviceOffline() && marks.length > 0) {
      void recordServerBaselinesBatch(
        marks.map((m) => ({
          docPath: `schools/${schoolId}/marks/${m.id}`,
          snapshot: m,
          updatedAt: m.updatedAt,
        }))
      );
    }
    return marks;
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchMarks', `schools/${schoolId}/marks`);
  }
}

export async function deleteStudentMarksFromFirestore(
  schoolId: string,
  markId: string
): Promise<boolean> {
  if (!schoolId || !markId) {
    throw new FirestoreSyncError('School ID and Marks ID are required', 'invalid-argument', 'deleteStudentMarks');
  }
  const path = `schools/${schoolId}/marks/${markId}`;
  try {
    const ref = doc(db, 'schools', schoolId, 'marks', markId);
    await runOnlineFirestoreWrite('deleteStudentMarks', path, () => deleteDoc(ref));
    void removeServerBaseline(path);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'deleteStudentMarks', path);
  }
}

// =========================================================================
// 14. Parent Portal: Strictly Scoped Child Fetchers & Invite Verification
// =========================================================================
export function buildParentLinkId(schoolId: string, grNumber: string): string {
  const cleanSchool = (schoolId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanGr = (grNumber || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
  return `${cleanSchool}__${cleanGr}`;
}

export function buildPortalInviteCode(prefix: 'PAR' | 'STU', grNumber: string): string {
  const cleanGr = (grNumber || 'STD').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-6);
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${cleanGr || 'STD'}-${rand}`;
}

export function generateParentInviteCode(grNumber: string): string {
  return buildPortalInviteCode('PAR', grNumber);
}

export function generateStudentInviteCode(grNumber: string): string {
  return buildPortalInviteCode('STU', grNumber);
}

export async function saveParentStudentLinkToFirestore(
  link: ParentStudentLink
): Promise<boolean> {
  if (!link.id || !link.schoolId || !link.studentId) {
    throw new FirestoreSyncError('Parent link ID, School ID, and Student ID are required', 'invalid-argument', 'saveParentLink');
  }
  const path = `parentLinks/${link.id}`;
  const normalizedLink = {
    ...link,
    parentEmail: link.parentEmail ? link.parentEmail.trim().toLowerCase() : '',
  };
  try {
    const ref = doc(db, 'parentLinks', link.id);
    await runOnlineFirestoreWrite('saveParentLink', path, () =>
      setDoc(
        ref,
        sanitizeFirestoreData({
          ...normalizedLink,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      )
    );
    void recordServerBaseline(path, normalizedLink, link.updatedAt);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveParentLink', path);
  }
}

export async function fetchParentStudentLinkFromFirestore(
  schoolId: string,
  grNumber: string
): Promise<ParentStudentLink | null> {
  if (!schoolId || !grNumber.trim()) return null;
  const linkId = buildParentLinkId(schoolId, grNumber);
  try {
    const ref = doc(db, 'parentLinks', linkId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return normalizeTimestamps(snap.data() as ParentStudentLink);
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchParentLink', `parentLinks/${linkId}`);
  }
}

export async function verifyAndClaimParentLink(params: {
  schoolId: string;
  grNumber: string;
  uid: string;
  parentEmail?: string;
  parentPhone?: string;
  inviteCode?: string;
}): Promise<ParentStudentLink> {
  const { schoolId, grNumber, uid, parentEmail, parentPhone, inviteCode } = params;
  const link = await fetchParentStudentLinkFromFirestore(schoolId, grNumber);
  if (!link) {
    throw new FirestoreSyncError(
      `No student link found for GR "${grNumber.trim()}" at this school. Ask the School Admin to enable Parent Portal Access on your child's profile.`,
      'not-found',
      'verifyParentLink'
    );
  }

  const normalizedEmail = (parentEmail || '').trim().toLowerCase();
  const linkEmail = (link.parentEmail || '').trim().toLowerCase();
  const normalizedCode = (inviteCode || '').trim().toUpperCase();
  const linkCode = (link.inviteCode || '').trim().toUpperCase();
  const normalizedPhoneDigits = (parentPhone || '').replace(/\D/g, '');
  const linkPhoneDigits = (link.guardianPhone || '').replace(/\D/g, '');

  const emailMatches = Boolean(linkEmail && normalizedEmail && linkEmail === normalizedEmail);
  const codeMatches = Boolean(linkCode && normalizedCode && linkCode === normalizedCode);
  const phoneMatches = Boolean(
    linkPhoneDigits.length >= 7 &&
    normalizedPhoneDigits.length >= 7 &&
    linkPhoneDigits === normalizedPhoneDigits
  );

  if (!emailMatches && !codeMatches && !phoneMatches) {
    throw new FirestoreSyncError(
      'Verification failed: Email, Invite Code, or Guardian Phone does not match the school record for this GR Number.',
      'permission-denied',
      'verifyParentLink'
    );
  }

  // Mark link claimed cleanly (non-fatal if already marked or rules defer)
  try {
    const ref = doc(db, 'parentLinks', link.id);
    await setDoc(
      ref,
      sanitizeFirestoreData({
        claimedByUid: uid,
        claimedAt: new Date().toISOString(),
        status: 'linked',
        updatedAt: serverTimestamp(),
      }),
      { merge: true }
    );
  } catch {
    // Non-fatal claim marker update
  }

  return {
    ...link,
    claimedByUid: uid,
    status: 'linked',
  };
}

// =========================================================================
// 14B. Student Portal: Self-Login Invite & Strictly Scoped Verification
// =========================================================================
export async function saveStudentPortalLinkToFirestore(
  link: StudentPortalLink
): Promise<boolean> {
  if (!link.id || !link.schoolId || !link.studentId) {
    throw new FirestoreSyncError('Student link ID, School ID, and Student ID are required', 'invalid-argument', 'saveStudentLink');
  }
  const path = `studentLinks/${link.id}`;
  const normalizedLink = {
    ...link,
    studentEmail: link.studentEmail ? link.studentEmail.trim().toLowerCase() : '',
  };
  try {
    const ref = doc(db, 'studentLinks', link.id);
    await runOnlineFirestoreWrite('saveStudentLink', path, () =>
      setDoc(
        ref,
        sanitizeFirestoreData({
          ...normalizedLink,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      )
    );
    void recordServerBaseline(path, normalizedLink, link.updatedAt);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveStudentLink', path);
  }
}

export async function fetchStudentPortalLinkFromFirestore(
  schoolId: string,
  grOrStudentId: string
): Promise<StudentPortalLink | null> {
  if (!schoolId || !grOrStudentId.trim()) return null;
  const linkId = buildParentLinkId(schoolId, grOrStudentId);
  try {
    const ref = doc(db, 'studentLinks', linkId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return normalizeTimestamps(snap.data() as StudentPortalLink);
    }
    // Also check exact lowercase/raw doc key fallback for Student ID lookups
    const cleanSchool = (schoolId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const altId = `${cleanSchool}__${grOrStudentId.trim().replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    if (altId !== linkId) {
      const altSnap = await getDoc(doc(db, 'studentLinks', altId));
      if (altSnap.exists()) {
        return normalizeTimestamps(altSnap.data() as StudentPortalLink);
      }
    }
    return null;
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchStudentLink', `studentLinks/${linkId}`);
  }
}

export async function fetchStudentPortalLinksForSchoolFromFirestore(
  schoolId: string
): Promise<Record<string, StudentPortalLink>> {
  if (!schoolId) return {};
  try {
    const q = query(collection(db, 'studentLinks'), where('schoolId', '==', schoolId));
    const snapshot = await getDocs(q);
    const linksMap: Record<string, StudentPortalLink> = {};
    snapshot.forEach((d) => {
      if (d.exists()) {
        const data = normalizeTimestamps(d.data() as StudentPortalLink);
        if (data.studentId) {
          linksMap[data.studentId] = data;
        }
      }
    });
    return linksMap;
  } catch {
    return {};
  }
}

export async function verifyAndClaimStudentLink(params: {
  schoolId: string;
  grNumber: string;
  uid: string;
  studentEmail?: string;
  inviteCode?: string;
}): Promise<StudentPortalLink> {
  const { schoolId, grNumber, uid, studentEmail, inviteCode } = params;
  const link = await fetchStudentPortalLinkFromFirestore(schoolId, grNumber);
  if (!link) {
    throw new FirestoreSyncError(
      `No Student Portal link found for GR "${grNumber.trim()}" at this school. Ask your School Admin to enable Student Portal Access on your student profile.`,
      'not-found',
      'verifyStudentLink'
    );
  }

  const normalizedEmail = (studentEmail || '').trim().toLowerCase();
  const linkEmail = (link.studentEmail || '').trim().toLowerCase();
  const normalizedCode = (inviteCode || '').trim().toUpperCase();
  const linkCode = (link.inviteCode || '').trim().toUpperCase();

  const emailMatches = Boolean(linkEmail && normalizedEmail && linkEmail === normalizedEmail);
  const codeMatches = Boolean(linkCode && normalizedCode && linkCode === normalizedCode);

  if (!emailMatches && !codeMatches) {
    throw new FirestoreSyncError(
      'Verification failed: Student Email or Student Invite Code does not match the school record for this GR Number.',
      'permission-denied',
      'verifyStudentLink'
    );
  }

  try {
    const ref = doc(db, 'studentLinks', link.id);
    await setDoc(
      ref,
      sanitizeFirestoreData({
        claimedByUid: uid,
        claimedAt: new Date().toISOString(),
        status: 'linked',
        updatedAt: serverTimestamp(),
      }),
      { merge: true }
    );
  } catch {
    // Non-fatal claim marker update
  }

  return {
    ...link,
    claimedByUid: uid,
    status: 'linked',
  };
}

export async function fetchSingleClassFromFirestore(
  schoolId: string,
  classId: string
): Promise<ClassSection | null> {
  if (!schoolId || !classId) return null;
  try {
    const ref = doc(db, 'schools', schoolId, 'classes', classId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data() as ClassSection;
    return normalizeTimestamps({ ...data, id: data.id || snap.id });
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchSingleClass', `schools/${schoolId}/classes/${classId}`);
  }
}

export async function fetchSingleStudentFromFirestore(
  schoolId: string,
  studentId: string
): Promise<Student | null> {
  if (!schoolId || !studentId) return null;
  try {
    const ref = doc(db, 'schools', schoolId, 'students', studentId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data() as Student;
    return normalizeTimestamps({ ...data, id: data.id || snap.id });
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchSingleStudent', `schools/${schoolId}/students/${studentId}`);
  }
}

export async function fetchChildFeePaymentsFromFirestore(
  schoolId: string,
  studentId: string
): Promise<FeePayment[]> {
  if (!schoolId || !studentId) return [];
  try {
    const q = query(
      collection(db, 'schools', schoolId, 'feePayments'),
      where('studentId', '==', studentId)
    );
    const snapshot = await getDocs(q);
    const payments: FeePayment[] = [];
    snapshot.forEach((d) => {
      if (d.exists()) {
        const data = d.data() as FeePayment;
        payments.push(normalizeTimestamps({ ...data, id: data.id || d.id }));
      }
    });
    return payments;
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchChildFeePayments', `schools/${schoolId}/feePayments`);
  }
}

export async function fetchChildMarksFromFirestore(
  schoolId: string,
  studentId: string
): Promise<StudentExamMarks[]> {
  if (!schoolId || !studentId) return [];
  try {
    const q = query(
      collection(db, 'schools', schoolId, 'marks'),
      where('studentId', '==', studentId)
    );
    const snapshot = await getDocs(q);
    const marks: StudentExamMarks[] = [];
    snapshot.forEach((d) => {
      if (d.exists()) {
        const data = d.data() as StudentExamMarks;
        marks.push(normalizeTimestamps({ ...data, id: data.id || d.id }));
      }
    });
    return marks;
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchChildMarks', `schools/${schoolId}/marks`);
  }
}

export async function fetchPublishedExamsFromFirestore(schoolId: string): Promise<Exam[]> {
  if (!schoolId) return [];
  try {
    const q = query(
      collection(db, 'schools', schoolId, 'exams'),
      where('status', '==', 'published')
    );
    const snapshot = await getDocs(q);
    const exams: Exam[] = [];
    snapshot.forEach((d) => {
      if (d.exists()) {
        const data = d.data() as Exam;
        exams.push(normalizeTimestamps({ ...data, id: data.id || d.id }));
      }
    });
    return exams;
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchPublishedExams', `schools/${schoolId}/exams`);
  }
}

// =========================================================================
// 15. Phase D: Timetable, Homework & Certificates
// =========================================================================
export async function saveTimetableEntryToFirestore(
  schoolId: string,
  entry: TimetableEntry
): Promise<boolean> {
  if (!schoolId || !entry.id) {
    throw new FirestoreSyncError('School ID and Timetable Entry ID are required', 'invalid-argument', 'saveTimetableEntry');
  }
  const path = `schools/${schoolId}/timetable/${entry.id}`;
  const normalizedEntry = { ...entry, schoolId };
  try {
    const ref = doc(db, 'schools', schoolId, 'timetable', entry.id);
    await runOnlineFirestoreWrite('saveTimetableEntry', path, () =>
      setDoc(
        ref,
        sanitizeFirestoreData({
          ...normalizedEntry,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      )
    );
    void recordServerBaseline(path, normalizedEntry, entry.updatedAt);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveTimetableEntry', path);
  }
}

export async function fetchTimetableFromFirestore(
  schoolId: string,
  classId?: string
): Promise<TimetableEntry[]> {
  if (!schoolId) return [];
  try {
    const col = collection(db, 'schools', schoolId, 'timetable');
    const q = classId ? query(col, where('classId', '==', classId)) : col;
    const snapshot = await getDocs(q);
    const items: TimetableEntry[] = [];
    snapshot.forEach((d) => {
      if (d.exists()) {
        const data = d.data() as TimetableEntry;
        items.push(normalizeTimestamps({ ...data, id: data.id || d.id }));
      }
    });
    if (!isDeviceOffline() && items.length > 0) {
      void recordServerBaselinesBatch(
        items.map((t) => ({
          docPath: `schools/${schoolId}/timetable/${t.id}`,
          snapshot: t,
          updatedAt: t.updatedAt,
        }))
      );
    }
    return items;
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchTimetable', `schools/${schoolId}/timetable`);
  }
}

export async function deleteTimetableEntryFromFirestore(
  schoolId: string,
  entryId: string
): Promise<boolean> {
  if (!schoolId || !entryId) {
    throw new FirestoreSyncError('School ID and Timetable Entry ID are required', 'invalid-argument', 'deleteTimetableEntry');
  }
  const path = `schools/${schoolId}/timetable/${entryId}`;
  try {
    const ref = doc(db, 'schools', schoolId, 'timetable', entryId);
    await runOnlineFirestoreWrite('deleteTimetableEntry', path, () => deleteDoc(ref));
    void removeServerBaseline(path);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'deleteTimetableEntry', path);
  }
}

export async function saveHomeworkToFirestore(
  schoolId: string,
  homework: HomeworkItem
): Promise<boolean> {
  if (!schoolId || !homework.id) {
    throw new FirestoreSyncError('School ID and Homework ID are required', 'invalid-argument', 'saveHomework');
  }
  const path = `schools/${schoolId}/homework/${homework.id}`;
  const normalizedHw = { ...homework, schoolId };
  try {
    const ref = doc(db, 'schools', schoolId, 'homework', homework.id);
    await runOnlineFirestoreWrite('saveHomework', path, () =>
      setDoc(
        ref,
        sanitizeFirestoreData({
          ...normalizedHw,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      )
    );
    void recordServerBaseline(path, normalizedHw, homework.updatedAt);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveHomework', path);
  }
}

export async function fetchHomeworkFromFirestore(
  schoolId: string,
  classId?: string
): Promise<HomeworkItem[]> {
  if (!schoolId) return [];
  try {
    const col = collection(db, 'schools', schoolId, 'homework');
    const q = classId ? query(col, where('classId', '==', classId)) : col;
    const snapshot = await getDocs(q);
    const items: HomeworkItem[] = [];
    snapshot.forEach((d) => {
      if (d.exists()) {
        const data = d.data() as HomeworkItem;
        items.push(normalizeTimestamps({ ...data, id: data.id || d.id }));
      }
    });
    if (!isDeviceOffline() && items.length > 0) {
      void recordServerBaselinesBatch(
        items.map((h) => ({
          docPath: `schools/${schoolId}/homework/${h.id}`,
          snapshot: h,
          updatedAt: h.updatedAt,
        }))
      );
    }
    return items;
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchHomework', `schools/${schoolId}/homework`);
  }
}

export async function deleteHomeworkFromFirestore(
  schoolId: string,
  homeworkId: string
): Promise<boolean> {
  if (!schoolId || !homeworkId) {
    throw new FirestoreSyncError('School ID and Homework ID are required', 'invalid-argument', 'deleteHomework');
  }
  const path = `schools/${schoolId}/homework/${homeworkId}`;
  try {
    const ref = doc(db, 'schools', schoolId, 'homework', homeworkId);
    await runOnlineFirestoreWrite('deleteHomework', path, () => deleteDoc(ref));
    void removeServerBaseline(path);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'deleteHomework', path);
  }
}

export async function saveCertificateToFirestore(
  schoolId: string,
  cert: StudentCertificate
): Promise<boolean> {
  if (!schoolId || !cert.id) {
    throw new FirestoreSyncError('School ID and Certificate ID are required', 'invalid-argument', 'saveCertificate');
  }
  const path = `schools/${schoolId}/certificates/${cert.id}`;
  const normalizedCert = { ...cert, schoolId };
  try {
    const ref = doc(db, 'schools', schoolId, 'certificates', cert.id);
    await runOnlineFirestoreWrite('saveCertificate', path, () =>
      setDoc(
        ref,
        sanitizeFirestoreData({
          ...normalizedCert,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      )
    );
    void recordServerBaseline(path, normalizedCert, cert.updatedAt);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveCertificate', path);
  }
}

export async function fetchCertificatesFromFirestore(schoolId: string): Promise<StudentCertificate[]> {
  if (!schoolId) return [];
  try {
    const col = collection(db, 'schools', schoolId, 'certificates');
    const snapshot = await getDocs(col);
    const items: StudentCertificate[] = [];
    snapshot.forEach((d) => {
      if (d.exists()) {
        const data = d.data() as StudentCertificate;
        items.push(normalizeTimestamps({ ...data, id: data.id || d.id }));
      }
    });
    if (!isDeviceOffline() && items.length > 0) {
      void recordServerBaselinesBatch(
        items.map((c) => ({
          docPath: `schools/${schoolId}/certificates/${c.id}`,
          snapshot: c,
          updatedAt: c.updatedAt,
        }))
      );
    }
    return items;
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchCertificates', `schools/${schoolId}/certificates`);
  }
}

export async function deleteCertificateFromFirestore(
  schoolId: string,
  certificateId: string
): Promise<boolean> {
  if (!schoolId || !certificateId) {
    throw new FirestoreSyncError('School ID and Certificate ID are required', 'invalid-argument', 'deleteCertificate');
  }
  const path = `schools/${schoolId}/certificates/${certificateId}`;
  try {
    const ref = doc(db, 'schools', schoolId, 'certificates', certificateId);
    await runOnlineFirestoreWrite('deleteCertificate', path, () => deleteDoc(ref));
    void removeServerBaseline(path);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'deleteCertificate', path);
  }
}

// =========================================================================
// 15B. Salary & Payroll Management
// (salaryStructures/{employeeId}, payrollSettings/config, payslips/{payslipId})
// =========================================================================
export async function saveSalaryStructureToFirestore(
  schoolId: string,
  structure: SalaryStructure
): Promise<boolean> {
  if (!schoolId || !structure.employeeId) {
    throw new FirestoreSyncError('School ID and Employee ID are required', 'invalid-argument', 'saveSalaryStructure');
  }
  const docId = structure.id || structure.employeeId;
  const path = `schools/${schoolId}/salaryStructures/${docId}`;
  const normalizedStructure: SalaryStructure = {
    ...structure,
    id: docId,
    employeeId: structure.employeeId || docId,
    schoolId,
    employeeEmail: structure.employeeEmail ? structure.employeeEmail.trim().toLowerCase() : undefined,
  };
  try {
    const ref = doc(db, 'schools', schoolId, 'salaryStructures', docId);
    await runOnlineFirestoreWrite('saveSalaryStructure', path, () =>
      setDoc(
        ref,
        sanitizeFirestoreData({
          ...normalizedStructure,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      )
    );
    void recordServerBaseline(path, normalizedStructure, structure.updatedAt);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveSalaryStructure', path);
  }
}

export async function fetchSalaryStructuresFromFirestore(
  schoolId: string
): Promise<SalaryStructure[]> {
  if (!schoolId) return [];
  try {
    const col = collection(db, 'schools', schoolId, 'salaryStructures');
    const snapshot = await getDocs(col);
    const items: SalaryStructure[] = [];
    snapshot.forEach((d) => {
      if (d.exists()) {
        const data = d.data() as SalaryStructure;
        items.push(normalizeTimestamps({ ...data, id: data.id || d.id, employeeId: data.employeeId || d.id }));
      }
    });
    if (!isDeviceOffline() && items.length > 0) {
      void recordServerBaselinesBatch(
        items.map((item) => ({
          docPath: `schools/${schoolId}/salaryStructures/${item.id}`,
          snapshot: item,
          updatedAt: item.updatedAt,
        }))
      );
    }
    return items;
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchSalaryStructures', `schools/${schoolId}/salaryStructures`);
  }
}

export async function deleteSalaryStructureFromFirestore(
  schoolId: string,
  employeeId: string
): Promise<boolean> {
  if (!schoolId || !employeeId) {
    throw new FirestoreSyncError('School ID and Employee ID are required', 'invalid-argument', 'deleteSalaryStructure');
  }
  const path = `schools/${schoolId}/salaryStructures/${employeeId}`;
  try {
    const ref = doc(db, 'schools', schoolId, 'salaryStructures', employeeId);
    await runOnlineFirestoreWrite('deleteSalaryStructure', path, () => deleteDoc(ref));
    void removeServerBaseline(path);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'deleteSalaryStructure', path);
  }
}

export async function savePayslipToFirestore(
  schoolId: string,
  payslip: EmployeePayslip
): Promise<boolean> {
  if (!schoolId || !payslip.id) {
    throw new FirestoreSyncError('School ID and Payslip ID are required', 'invalid-argument', 'savePayslip');
  }
  const path = `schools/${schoolId}/payslips/${payslip.id}`;
  const normalizedPayslip: EmployeePayslip = {
    ...payslip,
    schoolId,
    employeeEmail: payslip.employeeEmail ? payslip.employeeEmail.trim().toLowerCase() : undefined,
    isFinalized: Boolean(payslip.isFinalized || payslip.status === 'finalized' || payslip.status === 'paid'),
  };
  try {
    const ref = doc(db, 'schools', schoolId, 'payslips', payslip.id);
    await runOnlineFirestoreWrite('savePayslip', path, () =>
      setDoc(
        ref,
        sanitizeFirestoreData({
          ...normalizedPayslip,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      )
    );
    void recordServerBaseline(path, normalizedPayslip, payslip.updatedAt);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'savePayslip', path);
  }
}

export async function fetchPayslipsFromFirestore(schoolId: string): Promise<EmployeePayslip[]> {
  if (!schoolId) return [];
  try {
    const col = collection(db, 'schools', schoolId, 'payslips');
    const snapshot = await getDocs(col);
    const items: EmployeePayslip[] = [];
    snapshot.forEach((d) => {
      if (d.exists()) {
        const data = d.data() as EmployeePayslip;
        items.push(normalizeTimestamps({ ...data, id: data.id || d.id }));
      }
    });
    if (!isDeviceOffline() && items.length > 0) {
      void recordServerBaselinesBatch(
        items.map((item) => ({
          docPath: `schools/${schoolId}/payslips/${item.id}`,
          snapshot: item,
          updatedAt: item.updatedAt,
        }))
      );
    }
    return items.sort((a, b) => (b.month || '').localeCompare(a.month || ''));
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchPayslips', `schools/${schoolId}/payslips`);
  }
}

/**
 * Strictly scoped read-only payslip query for Teachers:
 * Only queries finalized/paid payslips belonging to the teacher's UID or email.
 */
export async function fetchTeacherOwnPayslipsFromFirestore(
  schoolId: string,
  params: { uid?: string | null; email?: string | null }
): Promise<EmployeePayslip[]> {
  if (!schoolId) return [];
  const uid = (params.uid || '').trim();
  const email = (params.email || '').trim().toLowerCase();
  if (!uid && !email) return [];

  const col = collection(db, 'schools', schoolId, 'payslips');
  const queriesToRun = [];
  if (uid) {
    queriesToRun.push(
      query(col, where('isFinalized', '==', true), where('employeeUid', '==', uid)),
      query(col, where('isFinalized', '==', true), where('employeeId', '==', uid))
    );
  }
  if (email) {
    queriesToRun.push(
      query(col, where('isFinalized', '==', true), where('employeeEmail', '==', email))
    );
  }

  const snapshots = await Promise.allSettled(queriesToRun.map((q) => getDocs(q)));
  const merged = new Map<string, EmployeePayslip>();
  let anySuccess = false;
  let lastError: unknown = null;

  snapshots.forEach((res) => {
    if (res.status === 'fulfilled') {
      anySuccess = true;
      res.value.forEach((d) => {
        if (d.exists()) {
          const data = d.data() as EmployeePayslip;
          merged.set(d.id, normalizeTimestamps({ ...data, id: data.id || d.id }));
        }
      });
    } else {
      lastError = res.reason;
    }
  });

  if (!anySuccess && lastError) {
    throw classifyFirestoreError(lastError, 'fetchTeacherOwnPayslips', `schools/${schoolId}/payslips`);
  }

  return Array.from(merged.values()).sort((a, b) => (b.month || '').localeCompare(a.month || ''));
}

export async function deletePayslipFromFirestore(
  schoolId: string,
  payslipId: string
): Promise<boolean> {
  if (!schoolId || !payslipId) {
    throw new FirestoreSyncError('School ID and Payslip ID are required', 'invalid-argument', 'deletePayslip');
  }
  const path = `schools/${schoolId}/payslips/${payslipId}`;
  try {
    const ref = doc(db, 'schools', schoolId, 'payslips', payslipId);
    await runOnlineFirestoreWrite('deletePayslip', path, () => deleteDoc(ref));
    void removeServerBaseline(path);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'deletePayslip', path);
  }
}

export async function savePayrollSettingsToFirestore(
  schoolId: string,
  settings: PayrollSettings
): Promise<boolean> {
  if (!schoolId) {
    throw new FirestoreSyncError('School ID is required', 'invalid-argument', 'savePayrollSettings');
  }
  const docId = settings.id || 'config';
  const path = `schools/${schoolId}/payrollSettings/${docId}`;
  const normalized: PayrollSettings = {
    ...settings,
    id: docId,
    schoolId,
    teacherPayslipAccessEnabled: Boolean(settings.teacherPayslipAccessEnabled),
  };
  try {
    const ref = doc(db, 'schools', schoolId, 'payrollSettings', docId);
    await runOnlineFirestoreWrite('savePayrollSettings', path, () =>
      setDoc(
        ref,
        sanitizeFirestoreData({
          ...normalized,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      )
    );
    void recordServerBaseline(path, normalized, settings.updatedAt);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'savePayrollSettings', path);
  }
}

export async function fetchPayrollSettingsFromFirestore(
  schoolId: string
): Promise<PayrollSettings | null> {
  if (!schoolId) return null;
  try {
    const ref = doc(db, 'schools', schoolId, 'payrollSettings', 'config');
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data() as PayrollSettings;
    return normalizeTimestamps({
      ...data,
      id: data.id || snap.id,
      schoolId: data.schoolId || schoolId,
    });
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchPayrollSettings', `schools/${schoolId}/payrollSettings/config`);
  }
}

// =========================================================================
// 15B. School AI Integration: Class Lesson Plans & Question Papers
// =========================================================================
export async function saveSchoolLessonPlanToFirestore(
  schoolId: string,
  plan: SchoolLessonPlan
): Promise<boolean> {
  if (!schoolId || !plan.id) {
    throw new FirestoreSyncError(
      'School ID and Lesson Plan ID are required',
      'invalid-argument',
      'saveSchoolLessonPlan'
    );
  }
  const path = `schools/${schoolId}/lessonPlans/${plan.id}`;
  const normalizedPlan: SchoolLessonPlan = {
    ...plan,
    schoolId,
    sharedWithParents: Boolean(plan.sharedWithParents),
  };
  try {
    const ref = doc(db, 'schools', schoolId, 'lessonPlans', plan.id);
    await runOnlineFirestoreWrite('saveSchoolLessonPlan', path, () =>
      setDoc(
        ref,
        sanitizeFirestoreData({
          ...normalizedPlan,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      )
    );
    void recordServerBaseline(path, normalizedPlan, plan.updatedAt);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveSchoolLessonPlan', path);
  }
}

export async function fetchSchoolLessonPlansFromFirestore(
  schoolId: string,
  assignedClassIds?: string[]
): Promise<SchoolLessonPlan[]> {
  if (!schoolId) return [];
  const col = collection(db, 'schools', schoolId, 'lessonPlans');
  try {
    const merged = new Map<string, SchoolLessonPlan>();
    if (Array.isArray(assignedClassIds)) {
      const uniqueIds = Array.from(new Set(assignedClassIds.filter(Boolean)));
      if (uniqueIds.length === 0) return [];
      const results = await Promise.allSettled(
        uniqueIds.map((cid) => getDocs(query(col, where('classId', '==', cid))))
      );
      let anySuccess = false;
      let lastError: unknown = null;
      results.forEach((res) => {
        if (res.status === 'fulfilled') {
          anySuccess = true;
          res.value.forEach((d) => {
            if (d.exists()) {
              const data = d.data() as SchoolLessonPlan;
              merged.set(d.id, normalizeTimestamps({ ...data, id: data.id || d.id }));
            }
          });
        } else {
          lastError = res.reason;
        }
      });
      if (!anySuccess && lastError) {
        throw lastError;
      }
    } else {
      const snapshot = await getDocs(col);
      snapshot.forEach((d) => {
        if (d.exists()) {
          const data = d.data() as SchoolLessonPlan;
          merged.set(d.id, normalizeTimestamps({ ...data, id: data.id || d.id }));
        }
      });
    }

    const items = Array.from(merged.values()).sort((a, b) =>
      String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''))
    );
    if (!isDeviceOffline() && items.length > 0) {
      void recordServerBaselinesBatch(
        items.map((p) => ({
          docPath: `schools/${schoolId}/lessonPlans/${p.id}`,
          snapshot: p,
          updatedAt: p.updatedAt,
        }))
      );
    }
    return items;
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchSchoolLessonPlans', `schools/${schoolId}/lessonPlans`);
  }
}

export async function fetchSharedLessonPlansForParentFromFirestore(
  schoolId: string,
  childClassId: string
): Promise<SchoolLessonPlan[]> {
  if (!schoolId || !childClassId) return [];
  try {
    const col = collection(db, 'schools', schoolId, 'lessonPlans');
    const q = query(
      col,
      where('classId', '==', childClassId),
      where('sharedWithParents', '==', true)
    );
    const snapshot = await getDocs(q);
    const items: SchoolLessonPlan[] = [];
    snapshot.forEach((d) => {
      if (d.exists()) {
        const data = d.data() as SchoolLessonPlan;
        items.push(normalizeTimestamps({ ...data, id: data.id || d.id }));
      }
    });
    return items.sort((a, b) =>
      String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''))
    );
  } catch (err) {
    throw classifyFirestoreError(
      err,
      'fetchSharedLessonPlansForParent',
      `schools/${schoolId}/lessonPlans`
    );
  }
}

export async function deleteSchoolLessonPlanFromFirestore(
  schoolId: string,
  planId: string
): Promise<boolean> {
  if (!schoolId || !planId) {
    throw new FirestoreSyncError(
      'School ID and Lesson Plan ID are required',
      'invalid-argument',
      'deleteSchoolLessonPlan'
    );
  }
  const path = `schools/${schoolId}/lessonPlans/${planId}`;
  try {
    const ref = doc(db, 'schools', schoolId, 'lessonPlans', planId);
    await runOnlineFirestoreWrite('deleteSchoolLessonPlan', path, () => deleteDoc(ref));
    void removeServerBaseline(path);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'deleteSchoolLessonPlan', path);
  }
}

export async function saveSchoolQuestionPaperToFirestore(
  schoolId: string,
  paperRecord: SchoolQuestionPaper
): Promise<boolean> {
  if (!schoolId || !paperRecord.id) {
    throw new FirestoreSyncError(
      'School ID and Question Paper ID are required',
      'invalid-argument',
      'saveSchoolQuestionPaper'
    );
  }
  const path = `schools/${schoolId}/questionPapers/${paperRecord.id}`;
  const normalizedRecord: SchoolQuestionPaper = {
    ...paperRecord,
    schoolId,
    attachedToExam: Boolean(paperRecord.attachedToExam),
    linkedLessonPlanIds: Array.isArray(paperRecord.linkedLessonPlanIds)
      ? paperRecord.linkedLessonPlanIds
      : [],
  };
  try {
    const ref = doc(db, 'schools', schoolId, 'questionPapers', paperRecord.id);
    await runOnlineFirestoreWrite('saveSchoolQuestionPaper', path, () =>
      setDoc(
        ref,
        sanitizeFirestoreData({
          ...normalizedRecord,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      )
    );
    void recordServerBaseline(path, normalizedRecord, paperRecord.updatedAt);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveSchoolQuestionPaper', path);
  }
}

export async function fetchSchoolQuestionPapersFromFirestore(
  schoolId: string,
  assignedClassIds?: string[]
): Promise<SchoolQuestionPaper[]> {
  if (!schoolId) return [];
  const col = collection(db, 'schools', schoolId, 'questionPapers');
  try {
    const merged = new Map<string, SchoolQuestionPaper>();
    if (Array.isArray(assignedClassIds)) {
      const uniqueIds = Array.from(new Set(assignedClassIds.filter(Boolean)));
      if (uniqueIds.length === 0) return [];
      const results = await Promise.allSettled(
        uniqueIds.map((cid) => getDocs(query(col, where('classId', '==', cid))))
      );
      let anySuccess = false;
      let lastError: unknown = null;
      results.forEach((res) => {
        if (res.status === 'fulfilled') {
          anySuccess = true;
          res.value.forEach((d) => {
            if (d.exists()) {
              const data = d.data() as SchoolQuestionPaper;
              merged.set(d.id, normalizeTimestamps({ ...data, id: data.id || d.id }));
            }
          });
        } else {
          lastError = res.reason;
        }
      });
      if (!anySuccess && lastError) {
        throw lastError;
      }
    } else {
      const snapshot = await getDocs(col);
      snapshot.forEach((d) => {
        if (d.exists()) {
          const data = d.data() as SchoolQuestionPaper;
          merged.set(d.id, normalizeTimestamps({ ...data, id: data.id || d.id }));
        }
      });
    }

    const items = Array.from(merged.values()).sort((a, b) =>
      String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''))
    );
    if (!isDeviceOffline() && items.length > 0) {
      void recordServerBaselinesBatch(
        items.map((qp) => ({
          docPath: `schools/${schoolId}/questionPapers/${qp.id}`,
          snapshot: qp,
          updatedAt: qp.updatedAt,
        }))
      );
    }
    return items;
  } catch (err) {
    throw classifyFirestoreError(
      err,
      'fetchSchoolQuestionPapers',
      `schools/${schoolId}/questionPapers`
    );
  }
}

export async function deleteSchoolQuestionPaperFromFirestore(
  schoolId: string,
  paperId: string
): Promise<boolean> {
  if (!schoolId || !paperId) {
    throw new FirestoreSyncError(
      'School ID and Question Paper ID are required',
      'invalid-argument',
      'deleteSchoolQuestionPaper'
    );
  }
  const path = `schools/${schoolId}/questionPapers/${paperId}`;
  try {
    const ref = doc(db, 'schools', schoolId, 'questionPapers', paperId);
    await runOnlineFirestoreWrite('deleteSchoolQuestionPaper', path, () => deleteDoc(ref));
    void removeServerBaseline(path);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'deleteSchoolQuestionPaper', path);
  }
}

export async function fetchPublicSyllabusForClassFromFirestore(
  canonicalClassName: string
): Promise<SyllabusPreset[]> {
  if (isDeviceOffline()) return [];
  try {
    const col = collection(db, 'syllabus_data');
    let snapshot;
    try {
      snapshot = await getDocs(
        query(col, where('visibility', '==', 'public'), where('className', '==', canonicalClassName))
      );
    } catch {
      snapshot = await getDocs(query(col, where('visibility', '==', 'public')));
    }
    const items: SyllabusPreset[] = [];
    snapshot.forEach((d) => {
      if (!d.exists()) return;
      const data = d.data() as Record<string, unknown>;
      const rowClass = String(data.className || '');
      if (canonicalClassName && rowClass.toLowerCase() !== canonicalClassName.toLowerCase()) {
        return;
      }
      items.push({
        id: d.id,
        board: data.board === 'Punjab PTB' ? 'Punjab PTB' : 'Sindh STBB',
        section:
          data.section === 'Middle' ||
          data.section === 'Secondary' ||
          data.section === 'Higher Secondary'
            ? data.section
            : 'Primary',
        className: rowClass || canonicalClassName,
        subject: String(data.subject || ''),
        chapter: String(data.chapter || ''),
        topic: String(data.topic || ''),
        duration: String(data.duration || '40 Minutes'),
        planType: data.planType === 'Weekly' ? 'Weekly' : 'Daily',
        slos: String(data.slos || ''),
        previousKnowledge: String(data.previousKnowledge || ''),
        teachingAids: String(data.teachingAids || ''),
        introduction: String(data.introduction || ''),
        procedure: String(data.procedure || ''),
        teacherActivities: String(data.teacherActivities || ''),
        studentActivities: String(data.studentActivities || ''),
        assessment: String(data.assessment || ''),
        homework: String(data.homework || ''),
        vocabulary: String(data.vocabulary || ''),
        lifeSkills: String(data.lifeSkills || ''),
        teacherReflection: String(data.teacherReflection || ''),
        questions: String(data.questions || ''),
        exercise: String(data.exercise || ''),
        worksheetPrompt: String(data.worksheetPrompt || ''),
        bloomAssessment: String(data.bloomAssessment || ''),
      });
    });
    return items;
  } catch {
    return [];
  }
}

// =========================================================================
// 16. Super Admin Platform Analytics Summary & Global Notice Board
// =========================================================================
export async function saveSchoolAnalyticsToFirestore(
  schoolId: string,
  analytics: SchoolAnalyticsSummary
): Promise<boolean> {
  if (!schoolId || isDeviceOffline()) return false;
  try {
    const ref = doc(db, 'schools', schoolId);
    await runOnlineFirestoreWrite('saveSchoolAnalytics', `schools/${schoolId}`, () =>
      setDoc(
        ref,
        sanitizeFirestoreData({
          analytics: {
            ...analytics,
            updatedAt: new Date().toISOString(),
          },
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      )
    );
    return true;
  } catch {
    return false;
  }
}

export async function saveGlobalNoticeToFirestore(notice: GlobalNotice): Promise<boolean> {
  if (!notice.id) {
    throw new FirestoreSyncError('Notice ID is required', 'invalid-argument', 'saveGlobalNotice');
  }
  const path = `globalNotices/${notice.id}`;
  const normalizedNotice = {
    ...notice,
    targetSchoolIds: notice.targetType === 'all' ? [] : notice.targetSchoolIds || [],
    readBySchools: notice.readBySchools || {},
  };
  try {
    const ref = doc(db, 'globalNotices', notice.id);
    await runOnlineFirestoreWrite('saveGlobalNotice', path, () =>
      setDoc(
        ref,
        sanitizeFirestoreData({
          ...normalizedNotice,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      )
    );
    void recordServerBaseline(path, normalizedNotice, notice.updatedAt);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveGlobalNotice', path);
  }
}

export async function fetchAllGlobalNoticesFromFirestore(): Promise<GlobalNotice[]> {
  try {
    const col = collection(db, 'globalNotices');
    const snapshot = await getDocs(col);
    const notices: GlobalNotice[] = [];
    snapshot.forEach((d) => {
      if (d.exists()) {
        const data = d.data() as GlobalNotice;
        notices.push(normalizeTimestamps({ ...data, id: data.id || d.id }));
      }
    });
    if (!isDeviceOffline() && notices.length > 0) {
      void recordServerBaselinesBatch(
        notices.map((n) => ({
          docPath: `globalNotices/${n.id}`,
          snapshot: n,
          updatedAt: n.updatedAt,
        }))
      );
    }
    return notices.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchAllGlobalNotices', 'globalNotices');
  }
}

export async function fetchNoticesForSchoolFromFirestore(
  schoolId: string
): Promise<GlobalNotice[]> {
  try {
    const col = collection(db, 'globalNotices');
    const allQuery = query(col, where('targetType', '==', 'all'));
    const specificQuery = schoolId
      ? query(col, where('targetSchoolIds', 'array-contains', schoolId))
      : null;

    const [allSnap, specificSnap] = await Promise.all([
      getDocs(allQuery),
      specificQuery ? getDocs(specificQuery) : Promise.resolve(null),
    ]);

    const merged = new Map<string, GlobalNotice>();
    allSnap.forEach((d) => {
      if (d.exists()) {
        const data = d.data() as GlobalNotice;
        merged.set(d.id, normalizeTimestamps({ ...data, id: data.id || d.id }));
      }
    });
    specificSnap?.forEach((d) => {
      if (d.exists()) {
        const data = d.data() as GlobalNotice;
        merged.set(d.id, normalizeTimestamps({ ...data, id: data.id || d.id }));
      }
    });
    const list = Array.from(merged.values()).sort((a, b) =>
      (b.date || '').localeCompare(a.date || '')
    );
    if (!isDeviceOffline() && list.length > 0) {
      void recordServerBaselinesBatch(
        list.map((n) => ({
          docPath: `globalNotices/${n.id}`,
          snapshot: n,
          updatedAt: n.updatedAt,
        }))
      );
    }
    return list;
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchNoticesForSchool', 'globalNotices');
  }
}

export async function markGlobalNoticeAsReadInFirestore(
  noticeId: string,
  schoolId: string,
  existingReadBySchools: Record<string, boolean>
): Promise<boolean> {
  if (!noticeId || !schoolId) return false;
  const path = `globalNotices/${noticeId}`;
  try {
    const ref = doc(db, 'globalNotices', noticeId);
    await runOnlineFirestoreWrite('markNoticeAsRead', path, () =>
      setDoc(
        ref,
        sanitizeFirestoreData({
          readBySchools: {
            ...existingReadBySchools,
            [schoolId]: true,
          },
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      )
    );
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'markNoticeAsRead', path);
  }
}

export async function deleteGlobalNoticeFromFirestore(noticeId: string): Promise<boolean> {
  if (!noticeId) return false;
  const path = `globalNotices/${noticeId}`;
  try {
    const ref = doc(db, 'globalNotices', noticeId);
    await runOnlineFirestoreWrite('deleteGlobalNotice', path, () => deleteDoc(ref));
    void removeServerBaseline(path);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'deleteGlobalNotice', path);
  }
}

// =========================================================================
// 17. IndexedDB Offline Queue Execution & Conflict Detection Engine
// =========================================================================

export interface ExecuteOrQueueResult {
  synced: boolean;
  queued: boolean;
  queueItem?: OfflineSyncItem;
}

export async function executeWithOfflineQueue<T extends Record<string, any>>(
  queueInput: EnqueueOfflineMutationInput<T>,
  onlineWriteFn: () => Promise<any>
): Promise<ExecuteOrQueueResult> {
  if (isDeviceOffline()) {
    const queueItem = await enqueueOfflineMutation(queueInput);
    return { synced: false, queued: true, queueItem };
  }

  try {
    await onlineWriteFn();
    if (queueInput.action === 'delete') {
      await removeServerBaseline(queueInput.docPath);
    } else {
      await recordServerBaseline(
        queueInput.docPath,
        queueInput.payload as Record<string, any>,
        (queueInput.payload as any)?.updatedAt
      );
    }
    return { synced: true, queued: false };
  } catch (err) {
    const classified = classifyFirestoreError(err, queueInput.operation, queueInput.docPath);
    if (classified.isOffline) {
      const queueItem = await enqueueOfflineMutation(queueInput);
      return { synced: false, queued: true, queueItem };
    }
    throw classified;
  }
}

function buildDocRefFromPath(docPath: string) {
  const segments = docPath.split('/').filter(Boolean);
  if (segments.length < 2 || segments.length % 2 !== 0) {
    throw new FirestoreSyncError(
      `Invalid Firestore document path "${docPath}"`,
      'invalid-argument',
      'buildDocRef'
    );
  }
  return doc(db, segments[0], ...segments.slice(1));
}

function normalizeQueuePayloadForFirestore(
  entityType: OfflineEntityType,
  schoolId: string,
  rawPayload: Record<string, any>,
  options?: { isExistingLessonPlan?: boolean; remoteCreatedAt?: unknown }
): Record<string, any> {
  const cleaned = prepareCloneableValue(rawPayload) || {};
  delete cleaned.updatedAt;

  switch (entityType) {
    case 'attendance':
      return {
        ...cleaned,
        schoolId: cleaned.schoolId || schoolId,
        conductedBy: cleaned.conductedBy || cleaned.markedByName || 'Faculty',
        conductedByUid: cleaned.conductedByUid || cleaned.markedByUid || 'system',
        updatedAt: serverTimestamp(),
      };
    case 'feePayment':
      return {
        ...cleaned,
        schoolId: cleaned.schoolId || schoolId,
        receiptNumber: cleaned.receiptNumber || '',
        paymentMethod: cleaned.paymentMethod || 'Cash',
        notes: cleaned.notes || '',
        installments: Array.isArray(cleaned.installments) ? cleaned.installments : [],
        updatedAt: serverTimestamp(),
      };
    case 'schoolLogo':
      return {
        logoUrl: cleaned.logoUrl || '',
        updatedAt: serverTimestamp(),
      };
    case 'lessonPlan':
      return {
        ...cleaned,
        createdAt: options?.isExistingLessonPlan && options?.remoteCreatedAt
          ? options.remoteCreatedAt
          : serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
    default:
      return {
        ...cleaned,
        ...(schoolId && schoolId !== 'global' && cleaned.schoolId !== undefined
          ? { schoolId: cleaned.schoolId || schoolId }
          : {}),
        updatedAt: serverTimestamp(),
      };
  }
}

export type SyncExecutionOutcome =
  | {
      status: 'synced';
      resolvedDocPath?: string;
      resolvedRecordId?: string;
    }
  | {
      status: 'resolved-remote';
      remoteData: Record<string, any> | null;
      remoteUpdatedAt?: string;
    }
  | {
      status: 'conflict';
      conflictReason: string;
      remoteSnapshot: Record<string, any> | null;
      remoteUpdatedAt?: string;
    }
  | {
      status: 'failed';
      errorMessage: string;
      retryable: boolean;
    };

/**
 * Inspects remote state from Firestore server (`getDocFromServer`), checks for online
 * conflicts while offline, and pushes/deletes/resolves a single queued IndexedDB record.
 */
export async function syncOfflineQueueItemToFirestore(
  item: OfflineSyncItem,
  resolutionChoice?: ConflictResolutionChoice
): Promise<SyncExecutionOutcome> {
  if (isDeviceOffline()) {
    return {
      status: 'failed',
      errorMessage: 'You are still offline. Waiting for internet connection.',
      retryable: true,
    };
  }

  try {
    let targetPath = item.docPath;
    let targetRef = buildDocRefFromPath(targetPath);

    // Always inspect live server state before pushing or accepting remote
    const remoteSnap = await runOnlineFirestoreWrite(
      `inspectServer:${item.operation}`,
      targetPath,
      () => getDocFromServer(targetRef),
      10000
    );

    const rawRemoteData = remoteSnap.exists() ? (remoteSnap.data() as Record<string, any>) : null;
    const remoteData = rawRemoteData
      ? normalizeTimestamps<Record<string, any>>({
          ...rawRemoteData,
          id: rawRemoteData.id || remoteSnap.id,
        })
      : null;
    const remoteUpdatedAt = normalizeTimestampValue(remoteData?.updatedAt);

    if (resolutionChoice === 'keep-remote') {
      if (remoteData) {
        await recordServerBaseline(targetPath, remoteData, remoteUpdatedAt);
      } else {
        await removeServerBaseline(targetPath);
      }
      return {
        status: 'resolved-remote',
        remoteData,
        remoteUpdatedAt,
      };
    }

    if (!resolutionChoice) {
      let effectiveRemoteData = remoteData;
      let effectiveRemoteUpdatedAt = remoteUpdatedAt;
      let logicalConflictReason: string | undefined;

      // Secondary logical-key conflict check for new FeePayment created offline (same student + month)
      if (
        !effectiveRemoteData &&
        !item.baseUpdatedAt &&
        item.entityType === 'feePayment' &&
        item.action === 'upsert' &&
        item.schoolId &&
        item.payload?.studentId &&
        item.payload?.month
      ) {
        const feeQ = query(
          collection(db, 'schools', item.schoolId, 'feePayments'),
          where('studentId', '==', item.payload.studentId),
          where('month', '==', item.payload.month)
        );
        const dupSnap = await runOnlineFirestoreWrite(
          'checkDuplicateMonthPayment',
          `schools/${item.schoolId}/feePayments`,
          () => getDocs(feeQ),
          10000
        );
        const existingOnline = dupSnap.docs.find((d) => d.id !== item.recordId);
        if (existingOnline) {
          const dupData = normalizeTimestamps<Record<string, any>>({
            ...(existingOnline.data() as Record<string, any>),
            id: existingOnline.id,
          });
          effectiveRemoteData = dupData;
          effectiveRemoteUpdatedAt = normalizeTimestampValue(dupData.updatedAt);
          logicalConflictReason =
            'Another fee payment for this student and month was recorded online while you were offline.';
        }
      }

      const conflictCheck = detectOfflineConflict({
        action: item.action,
        baseUpdatedAt: item.baseUpdatedAt,
        baseSnapshot: item.baseSnapshot,
        localPayload: (item.payload || {}) as Record<string, any>,
        remoteExists: Boolean(effectiveRemoteData),
        remoteData: effectiveRemoteData,
        remoteUpdatedAt: effectiveRemoteUpdatedAt,
      });

      if (conflictCheck.hasConflict || logicalConflictReason) {
        return {
          status: 'conflict',
          conflictReason:
            logicalConflictReason ||
            conflictCheck.reason ||
            'The same record was modified online while you were offline.',
          remoteSnapshot: effectiveRemoteData,
          remoteUpdatedAt: effectiveRemoteUpdatedAt,
        };
      }
    } else if (
      resolutionChoice === 'keep-local' &&
      item.entityType === 'feePayment' &&
      item.remoteSnapshot?.id &&
      item.remoteSnapshot.id !== item.recordId &&
      item.schoolId
    ) {
      // Update existing online fee payment record cleanly instead of leaving duplicate monthly records
      targetPath = `schools/${item.schoolId}/feePayments/${item.remoteSnapshot.id}`;
      targetRef = buildDocRefFromPath(targetPath);
    }

    if (item.action === 'delete') {
      await runOnlineFirestoreWrite(item.operation, targetPath, () => deleteDoc(targetRef), 12000);
      await removeServerBaseline(targetPath);
      return { status: 'synced', resolvedDocPath: targetPath };
    }

    const writePayload = normalizeQueuePayloadForFirestore(
      item.entityType,
      item.schoolId,
      {
        ...(item.payload || {}),
        ...(targetPath !== item.docPath && item.remoteSnapshot?.id
          ? { id: item.remoteSnapshot.id }
          : {}),
      },
      {
        isExistingLessonPlan: item.entityType === 'lessonPlan' && remoteSnap.exists(),
        remoteCreatedAt: rawRemoteData?.createdAt,
      }
    );

    await runOnlineFirestoreWrite(
      item.operation,
      targetPath,
      () =>
        setDoc(
          targetRef,
          sanitizeFirestoreData(writePayload),
          { merge: item.entityType !== 'lessonPlan' || remoteSnap.exists() }
        ),
      12000
    );

    const resolvedRecordId =
      targetPath !== item.docPath && item.remoteSnapshot?.id
        ? String(item.remoteSnapshot.id)
        : item.recordId;

    await recordServerBaseline(
      targetPath,
      {
        ...(item.payload || {}),
        id: resolvedRecordId,
      },
      new Date().toISOString()
    );

    return {
      status: 'synced',
      resolvedDocPath: targetPath,
      resolvedRecordId,
    };
  } catch (err) {
    const classified = classifyFirestoreError(err, item.operation, item.docPath);
    return {
      status: 'failed',
      errorMessage: classified.message,
      retryable: classified.isOffline,
    };
  }
}
