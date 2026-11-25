import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../firebase';
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
} from '../types';

/**
 * Multi-Tenant School Management Firestore Persistence Service
 * Safely handles cloud persistence with typed error diagnostics,
 * server timestamps, and offline resilience via IndexedDB persistent cache.
 */

export type FirestoreServiceErrorCode =
  | 'permission-denied'
  | 'offline'
  | 'unavailable'
  | 'unauthenticated'
  | 'not-found'
  | 'invalid-argument'
  | 'unknown';

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
      (typeof navigator !== 'undefined' && !navigator.onLine);
    this.isPermissionDenied = code === 'permission-denied';
  }
}

export function classifyFirestoreError(err: unknown, operation: string, path?: string): FirestoreSyncError {
  const isBrowserOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  const rawCode = (err as any)?.code || '';
  const rawMessage = (err as any)?.message || String(err);

  let code: FirestoreServiceErrorCode = 'unknown';

  if (isBrowserOffline || rawCode === 'unavailable' || rawMessage.toLowerCase().includes('offline')) {
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
  try {
    const schoolRef = doc(db, 'schools', school.id);
    await setDoc(
      schoolRef,
      {
        ...school,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveSchool', `schools/${school.id}`);
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
  try {
    const userRef = doc(db, 'users', profile.uid);
    await setDoc(
      userRef,
      {
        ...profile,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveUserProfile', `users/${profile.uid}`);
  }
}

export async function fetchUserProfileFromFirestore(uid: string): Promise<UserProfile | null> {
  if (!uid) return null;
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return normalizeTimestamps(snap.data() as UserProfile);
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
  try {
    const classRef = doc(db, 'schools', schoolId, 'classes', classData.id);
    await setDoc(
      classRef,
      {
        ...classData,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveClass', `schools/${schoolId}/classes/${classData.id}`);
  }
}

export async function deleteClassFromFirestore(schoolId: string, classId: string): Promise<boolean> {
  if (!schoolId || !classId) {
    throw new FirestoreSyncError('School ID and Class ID are required to delete', 'invalid-argument', 'deleteClass');
  }
  try {
    const classRef = doc(db, 'schools', schoolId, 'classes', classId);
    await deleteDoc(classRef);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'deleteClass', `schools/${schoolId}/classes/${classId}`);
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
  try {
    const studentRef = doc(db, 'schools', schoolId, 'students', student.id);
    await setDoc(
      studentRef,
      {
        ...student,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveStudent', `schools/${schoolId}/students/${student.id}`);
  }
}

export async function deleteStudentFromFirestore(schoolId: string, studentId: string): Promise<boolean> {
  if (!schoolId || !studentId) {
    throw new FirestoreSyncError('School ID and Student ID are required to delete', 'invalid-argument', 'deleteStudent');
  }
  try {
    const studentRef = doc(db, 'schools', schoolId, 'students', studentId);
    await deleteDoc(studentRef);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'deleteStudent', `schools/${schoolId}/students/${studentId}`);
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
  try {
    const attRef = doc(db, 'schools', schoolId, 'attendance', attendance.id);
    await setDoc(
      attRef,
      {
        ...attendance,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveAttendance', `schools/${schoolId}/attendance/${attendance.id}`);
  }
}

export async function fetchAttendanceFromFirestore(
  schoolId: string
): Promise<Record<string, DailyClassAttendance>> {
  if (!schoolId) return {};
  try {
    const attCol = collection(db, 'schools', schoolId, 'attendance');
    const snapshot = await getDocs(attCol);
    const registers: Record<string, DailyClassAttendance> = {};
    snapshot.forEach((d) => {
      if (d.exists()) {
        const item = normalizeTimestamps(d.data() as DailyClassAttendance);
        registers[item.id] = item;
      }
    });
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
  try {
    const reqRef = doc(db, 'schools', schoolId, 'joinRequests', request.id);
    await setDoc(
      reqRef,
      {
        ...request,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveJoinRequest', `schools/${schoolId}/joinRequests/${request.id}`);
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
  try {
    const reqRef = doc(db, 'schoolRegistrationRequests', request.id);
    await setDoc(
      reqRef,
      {
        ...request,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveSchoolRegistrationRequest', `schoolRegistrationRequests/${request.id}`);
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
  try {
    const teacherRef = doc(db, 'schools', schoolId, 'teachers', teacher.id);
    await setDoc(
      teacherRef,
      {
        ...teacher,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveTeacher', `schools/${schoolId}/teachers/${teacher.id}`);
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
  try {
    const docId = feeStructure.id || feeStructure.classId;
    const ref = doc(db, 'schools', schoolId, 'feeStructures', docId);
    await setDoc(
      ref,
      {
        ...feeStructure,
        id: docId,
        schoolId,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveFeeStructure', `schools/${schoolId}/feeStructures/${feeStructure.classId}`);
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
    return feeStructures;
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchFeeStructures', `schools/${schoolId}/feeStructures`);
  }
}

export async function deleteFeeStructureFromFirestore(
  schoolId: string,
  classId: string
): Promise<boolean> {
  if (!schoolId || !classId) {
    throw new FirestoreSyncError('School ID and Class ID are required', 'invalid-argument', 'deleteFeeStructure');
  }
  try {
    const ref = doc(db, 'schools', schoolId, 'feeStructures', classId);
    await deleteDoc(ref);
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'deleteFeeStructure', `schools/${schoolId}/feeStructures/${classId}`);
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
  try {
    const ref = doc(db, 'schools', schoolId, 'feePayments', payment.id);
    await setDoc(
      ref,
      {
        ...payment,
        schoolId,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    throw classifyFirestoreError(err, 'saveFeePayment', `schools/${schoolId}/feePayments/${payment.id}`);
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
    return payments;
  } catch (err) {
    throw classifyFirestoreError(err, 'fetchFeePayments', `schools/${schoolId}/feePayments`);
  }
}
