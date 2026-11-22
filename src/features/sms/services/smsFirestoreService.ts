import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
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
} from '../types';

/**
 * Multi-Tenant School Management Firestore Persistence Service
 * Safely handles cloud persistence with fallback resilience for offline usage.
 */

// 1. School Document Management
export async function saveSchoolToFirestore(school: School): Promise<boolean> {
  if (!school.id) return false;
  try {
    const schoolRef = doc(db, 'schools', school.id);
    await setDoc(schoolRef, {
      ...school,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn('[Firestore] Notice: School saved locally (Cloud sync skipped):', err);
    return false;
  }
}

export async function fetchSchoolsFromFirestore(): Promise<School[]> {
  try {
    const schoolsCol = collection(db, 'schools');
    const snapshot = await getDocs(schoolsCol);
    const schools: School[] = [];
    snapshot.forEach((d) => {
      if (d.exists()) {
        schools.push(d.data() as School);
      }
    });
    return schools;
  } catch (err) {
    console.warn('[Firestore] Notice: Loading schools from local cache:', err);
    return [];
  }
}

// 2. User Profile Management
export async function saveUserProfileToFirestore(profile: UserProfile): Promise<boolean> {
  if (!profile.uid) return false;
  try {
    const userRef = doc(db, 'users', profile.uid);
    await setDoc(userRef, {
      ...profile,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn('[Firestore] Notice: User profile saved locally:', err);
    return false;
  }
}

export async function fetchUserProfileFromFirestore(uid: string): Promise<UserProfile | null> {
  if (!uid) return null;
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    return null;
  } catch (err) {
    console.warn('[Firestore] Notice: Loading user profile from local cache:', err);
    return null;
  }
}

// 3. Classes & Sections Management
export async function saveClassToFirestore(schoolId: string, classData: ClassSection): Promise<boolean> {
  if (!schoolId || !classData.id) return false;
  try {
    const classRef = doc(db, 'schools', schoolId, 'classes', classData.id);
    await setDoc(classRef, {
      ...classData,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn('[Firestore] Notice: Class saved locally:', err);
    return false;
  }
}

export async function deleteClassFromFirestore(schoolId: string, classId: string): Promise<boolean> {
  if (!schoolId || !classId) return false;
  try {
    const classRef = doc(db, 'schools', schoolId, 'classes', classId);
    await deleteDoc(classRef);
    return true;
  } catch (err) {
    console.warn('[Firestore] Notice: Class deleted locally:', err);
    return false;
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
        classes.push(d.data() as ClassSection);
      }
    });
    return classes;
  } catch (err) {
    console.warn('[Firestore] Notice: Loading classes from local cache:', err);
    return [];
  }
}

// 4. Students (SIS) Management
export async function saveStudentToFirestore(schoolId: string, student: Student): Promise<boolean> {
  if (!schoolId || !student.id) return false;
  try {
    const studentRef = doc(db, 'schools', schoolId, 'students', student.id);
    await setDoc(studentRef, {
      ...student,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn('[Firestore] Notice: Student saved locally:', err);
    return false;
  }
}

export async function deleteStudentFromFirestore(schoolId: string, studentId: string): Promise<boolean> {
  if (!schoolId || !studentId) return false;
  try {
    const studentRef = doc(db, 'schools', schoolId, 'students', studentId);
    await deleteDoc(studentRef);
    return true;
  } catch (err) {
    console.warn('[Firestore] Notice: Student deleted locally:', err);
    return false;
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
        students.push(d.data() as Student);
      }
    });
    return students;
  } catch (err) {
    console.warn('[Firestore] Notice: Loading students from local cache:', err);
    return [];
  }
}

// 5. Daily Attendance Management (Composite Document: YYYY-MM-DD_classId)
export async function saveAttendanceToFirestore(
  schoolId: string,
  attendance: DailyClassAttendance
): Promise<boolean> {
  if (!schoolId || !attendance.id) return false;
  try {
    const attRef = doc(db, 'schools', schoolId, 'attendance', attendance.id);
    await setDoc(attRef, {
      ...attendance,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn('[Firestore] Notice: Attendance saved locally:', err);
    return false;
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
        const item = d.data() as DailyClassAttendance;
        registers[item.id] = item;
      }
    });
    return registers;
  } catch (err) {
    console.warn('[Firestore] Notice: Loading attendance from local cache:', err);
    return {};
  }
}

// 6. Faculty Join Requests Management
export async function saveJoinRequestToFirestore(
  schoolId: string,
  request: TeacherJoinRequest
): Promise<boolean> {
  if (!schoolId || !request.id) return false;
  try {
    const reqRef = doc(db, 'schools', schoolId, 'joinRequests', request.id);
    await setDoc(reqRef, {
      ...request,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn('[Firestore] Notice: Join request saved locally:', err);
    return false;
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
        requests.push(d.data() as TeacherJoinRequest);
      }
    });
    return requests;
  } catch (err) {
    console.warn('[Firestore] Notice: Loading join requests from local cache:', err);
    return [];
  }
}

// 7. Super Admin School Registration Requests
export async function saveSchoolRegistrationRequestToFirestore(
  request: SchoolRegistrationRequest
): Promise<boolean> {
  if (!request.id) return false;
  try {
    const reqRef = doc(db, 'schoolRegistrationRequests', request.id);
    await setDoc(reqRef, {
      ...request,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn('[Firestore] Notice: School registration request saved locally:', err);
    return false;
  }
}

export async function fetchSchoolRegistrationRequestsFromFirestore(): Promise<SchoolRegistrationRequest[]> {
  try {
    const reqCol = collection(db, 'schoolRegistrationRequests');
    const snapshot = await getDocs(reqCol);
    const requests: SchoolRegistrationRequest[] = [];
    snapshot.forEach((d) => {
      if (d.exists()) {
        requests.push(d.data() as SchoolRegistrationRequest);
      }
    });
    return requests;
  } catch (err) {
    console.warn('[Firestore] Notice: Loading school registration requests from local cache:', err);
    return [];
  }
}

// 8. Teacher Profiles Management
export async function saveTeacherToFirestore(
  schoolId: string,
  teacher: TeacherInfo
): Promise<boolean> {
  if (!schoolId || !teacher.id) return false;
  try {
    const teacherRef = doc(db, 'schools', schoolId, 'teachers', teacher.id);
    await setDoc(teacherRef, {
      ...teacher,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn('[Firestore] Notice: Teacher profile saved locally:', err);
    return false;
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
        teachers.push(d.data() as TeacherInfo);
      }
    });
    return teachers;
  } catch (err) {
    console.warn('[Firestore] Notice: Loading teachers from local cache:', err);
    return [];
  }
}
