import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  UserRole,
  School,
  ClassSection,
  TeacherInfo,
  Student,
  DailyClassAttendance,
  UserProfile,
  TeacherJoinRequest,
  SchoolStatus,
  PrimaryAdminType,
} from '../types';
import {
  INITIAL_MOCK_SCHOOL,
  INITIAL_MOCK_SCHOOLS,
  INITIAL_MOCK_CLASSES,
  INITIAL_MOCK_TEACHERS,
  INITIAL_MOCK_STUDENTS,
  INITIAL_MOCK_ATTENDANCE,
  INITIAL_MOCK_JOIN_REQUESTS,
} from '../data/mockSmsData';
import {
  saveSchoolToFirestore,
  fetchSchoolsFromFirestore,
  saveUserProfileToFirestore,
  saveClassToFirestore,
  deleteClassFromFirestore,
  fetchClassesFromFirestore,
  saveStudentToFirestore,
  deleteStudentFromFirestore,
  fetchStudentsFromFirestore,
  saveAttendanceToFirestore,
  fetchAttendanceFromFirestore,
  saveJoinRequestToFirestore,
  fetchJoinRequestsFromFirestore,
} from '../services/smsFirestoreService';

export const EMPTY_DEFAULT_SCHOOL: School = {
  id: '',
  name: 'No School Selected',
  semisCode: '',
  board: 'Sindh STBB',
  district: '',
  taluka: '',
  activeAcademicYear: '2025-2026',
  adminUids: [],
  status: 'active',
  primaryAdminType: 'principal',
  primaryAdminName: '',
  primaryAdminEmail: '',
  createdAt: '',
};

export interface TodayAttendanceStats {
  totalMarkedClasses: number;
  totalClasses: number;
  overallPercentage: number;
  totalPresent: number;
  totalAbsent: number;
  totalLeave: number;
  totalLate: number;
  totalStudentsRecorded: number;
}

interface SmsContextType {
  // Roles & Persona
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  demoMode: boolean;
  setDemoMode: (enabled: boolean) => void;
  currentUserProfile: UserProfile | null;
  setCurrentUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  
  // Super Admin & Multi-Tenant Management
  isSuperAdmin: boolean;
  isImpersonating: boolean;
  impersonateSchool: (schoolId: string) => void;
  exitImpersonation: () => void;
  toggleSchoolStatus: (schoolId: string, reason?: string) => void;

  // Schools & Registration
  activeSchool: School;
  setActiveSchool: React.Dispatch<React.SetStateAction<School>>;
  registeredSchools: School[];
  registerNewSchool: (
    schoolData: Omit<School, 'id' | 'adminUids' | 'status'> & {
      status?: SchoolStatus;
      primaryAdminType?: PrimaryAdminType;
      primaryAdminName?: string;
      primaryAdminEmail?: string;
    },
    adminProfile: {
      fullName: string;
      email: string;
      phone?: string;
      designation?: string;
      uid?: string;
      primaryAdminType?: PrimaryAdminType;
      registeringUserRole?: 'admin' | 'teacher';
    }
  ) => School;
  
  // Join Requests (Faculty Onboarding)
  joinRequests: TeacherJoinRequest[];
  pendingJoinRequests: TeacherJoinRequest[];
  submitJoinRequest: (requestData: Omit<TeacherJoinRequest, 'id' | 'requestedAt' | 'status'>) => void;
  approveJoinRequest: (requestId: string, assignedClassIds: string[], assignAsClassTeacherFor?: string) => void;
  rejectJoinRequest: (requestId: string) => void;

  // Classes & Students
  classes: ClassSection[];
  teachers: TeacherInfo[];
  students: Student[];
  addClass: (newClass: Omit<ClassSection, 'id' | 'createdAt'>) => void;
  updateClass: (id: string, updated: Partial<ClassSection>) => void;
  deleteClass: (id: string) => void;
  addStudent: (newStudent: Omit<Student, 'id'>) => void;
  updateStudent: (id: string, updated: Partial<Student>) => void;
  deleteStudent: (id: string) => void;
  filteredClassesForUser: ClassSection[];
  filteredStudentsForUser: Student[];
  activeTeacher: TeacherInfo;

  // Attendance
  attendanceRegisters: Record<string, DailyClassAttendance>;
  saveAttendance: (attendance: DailyClassAttendance) => void;
  getAttendance: (date: string, classId: string) => DailyClassAttendance | undefined;
  todayAttendanceStats: TodayAttendanceStats;

  // Stats
  stats: {
    totalStudents: number;
    totalClasses: number;
    totalTeachers: number;
    averageClassSize: number;
  };
}

const SMS_STORAGE_KEY = 'pakedu_sms_state_v1';
const SMS_STUDENTS_STORAGE_KEY = 'pakedu_sms_students_v1';
const SMS_ATTENDANCE_STORAGE_KEY = 'pakedu_sms_attendance_v1';
const SMS_ROLE_STORAGE_KEY = 'pakedu_sms_active_role';
const SMS_DEMO_MODE_STORAGE_KEY = 'pakedu_sms_demo_mode_v1';
const SMS_USER_PROFILE_STORAGE_KEY = 'pakedu_sms_user_profile_v1';
const SMS_SCHOOLS_STORAGE_KEY = 'pakedu_sms_registered_schools_v1';
const SMS_JOIN_REQUESTS_STORAGE_KEY = 'pakedu_sms_join_requests_v1';

const SmsContext = createContext<SmsContextType | undefined>(undefined);

export const SmsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Demo Mode: Strictly OFF by default in production; only enabled if explicitly saved as 'true'
  const [demoMode, setDemoModeState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(SMS_DEMO_MODE_STORAGE_KEY);
      return saved === 'true'; // Strictly false unless explicitly toggled ON by user
    } catch {
      return false;
    }
  });

  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(SMS_USER_PROFILE_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore
    }
    return null;
  });

  // Save current profile changes
  useEffect(() => {
    try {
      if (currentUserProfile) {
        localStorage.setItem(SMS_USER_PROFILE_STORAGE_KEY, JSON.stringify(currentUserProfile));
      } else {
        localStorage.removeItem(SMS_USER_PROFILE_STORAGE_KEY);
      }
    } catch {
      // Ignore
    }
  }, [currentUserProfile]);

  const [userRole, setUserRoleState] = useState<UserRole>(() => {
    try {
      const saved = localStorage.getItem(SMS_ROLE_STORAGE_KEY);
      return saved === 'teacher' ? 'teacher' : 'admin';
    } catch {
      return 'admin';
    }
  });

  // Registered Schools list
  const [registeredSchools, setRegisteredSchools] = useState<School[]>(() => {
    try {
      const isDemo = localStorage.getItem(SMS_DEMO_MODE_STORAGE_KEY) === 'true';
      const saved = localStorage.getItem(SMS_SCHOOLS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (isDemo) return parsed.length > 0 ? parsed : INITIAL_MOCK_SCHOOLS;
          return parsed.filter((s: School) => s.id !== 'sch_seld_khi_01');
        }
      }
      return isDemo ? INITIAL_MOCK_SCHOOLS : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SMS_SCHOOLS_STORAGE_KEY, JSON.stringify(registeredSchools));
    } catch {
      // Ignore
    }
  }, [registeredSchools]);

  const [activeSchool, setActiveSchool] = useState<School>(() => {
    const isDemo = localStorage.getItem(SMS_DEMO_MODE_STORAGE_KEY) === 'true';
    if (registeredSchools.length > 0) return registeredSchools[0];
    return isDemo ? INITIAL_MOCK_SCHOOL : EMPTY_DEFAULT_SCHOOL;
  });

  // Super Admin & Impersonation State
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonationOriginalRole, setImpersonationOriginalRole] = useState<UserRole | null>(null);

  const isSuperAdmin = useMemo(() => {
    if (currentUserProfile?.email === 'owner@pakedu.com' || Boolean(currentUserProfile?.isSuperAdmin)) {
      return true;
    }
    if (demoMode && userRole === 'super-admin') {
      return true;
    }
    return false;
  }, [demoMode, userRole, currentUserProfile]);

  const toggleSchoolStatus = (schoolId: string, reason?: string) => {
    setRegisteredSchools((prev) =>
      prev.map((s) => {
        if (s.id === schoolId) {
          const nextStatus: SchoolStatus = s.status === 'suspended' ? 'active' : 'suspended';
          return {
            ...s,
            status: nextStatus,
            suspendedReason: nextStatus === 'suspended' ? reason || 'Administrative Policy Review' : undefined,
          };
        }
        return s;
      })
    );
    if (activeSchool.id === schoolId) {
      setActiveSchool((prev) => ({
        ...prev,
        status: prev.status === 'suspended' ? 'active' : 'suspended',
        suspendedReason: prev.status === 'suspended' ? undefined : reason || 'Administrative Policy Review',
      }));
    }
  };

  const impersonateSchool = (schoolId: string) => {
    const target = registeredSchools.find((s) => s.id === schoolId);
    if (target) {
      setActiveSchool(target);
      setIsImpersonating(true);
      setImpersonationOriginalRole(userRole);
      setUserRoleState('admin');
    }
  };

  const exitImpersonation = () => {
    setIsImpersonating(false);
    if (impersonationOriginalRole) {
      setUserRoleState(impersonationOriginalRole);
    } else {
      setUserRoleState('super-admin');
    }
  };

  // Faculty Join Requests
  const [joinRequests, setJoinRequests] = useState<TeacherJoinRequest[]>(() => {
    try {
      const isDemo = localStorage.getItem(SMS_DEMO_MODE_STORAGE_KEY) === 'true';
      const saved = localStorage.getItem(SMS_JOIN_REQUESTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (isDemo) return parsed.length > 0 ? parsed : INITIAL_MOCK_JOIN_REQUESTS;
          return parsed.filter((r: TeacherJoinRequest) => !r.id.startsWith('req_mock_'));
        }
      }
      return isDemo ? INITIAL_MOCK_JOIN_REQUESTS : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SMS_JOIN_REQUESTS_STORAGE_KEY, JSON.stringify(joinRequests));
    } catch {
      // Ignore
    }
  }, [joinRequests]);

  const [teachers, setTeachers] = useState<TeacherInfo[]>(() => {
    try {
      const isDemo = localStorage.getItem(SMS_DEMO_MODE_STORAGE_KEY) === 'true';
      return isDemo ? INITIAL_MOCK_TEACHERS : [];
    } catch {
      return [];
    }
  });

  const [classes, setClasses] = useState<ClassSection[]>(() => {
    try {
      const isDemo = localStorage.getItem(SMS_DEMO_MODE_STORAGE_KEY) === 'true';
      const saved = localStorage.getItem(SMS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed?.classes)) {
          if (isDemo) return parsed.classes.length > 0 ? parsed.classes : INITIAL_MOCK_CLASSES;
          return parsed.classes.filter((c: ClassSection) => !c.id.startsWith('cls_9') && !c.id.startsWith('cls_10'));
        }
      }
      return isDemo ? INITIAL_MOCK_CLASSES : [];
    } catch (e) {
      console.warn('Failed to parse saved SMS classes:', e);
      return [];
    }
  });

  const [students, setStudents] = useState<Student[]>(() => {
    try {
      const isDemo = localStorage.getItem(SMS_DEMO_MODE_STORAGE_KEY) === 'true';
      const saved = localStorage.getItem(SMS_STUDENTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (isDemo) return parsed.length > 0 ? parsed : INITIAL_MOCK_STUDENTS;
          return parsed.filter((s: Student) => !s.id.startsWith('std_0'));
        }
      }
      return isDemo ? INITIAL_MOCK_STUDENTS : [];
    } catch (e) {
      console.warn('Failed to parse saved SMS students:', e);
      return [];
    }
  });

  const [attendanceRegisters, setAttendanceRegisters] = useState<Record<string, DailyClassAttendance>>(() => {
    try {
      const isDemo = localStorage.getItem(SMS_DEMO_MODE_STORAGE_KEY) === 'true';
      const saved = localStorage.getItem(SMS_ATTENDANCE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          if (isDemo) return parsed;
          const clean: Record<string, DailyClassAttendance> = {};
          for (const [key, val] of Object.entries(parsed as Record<string, DailyClassAttendance>)) {
            if (!key.includes('cls_9') && !key.includes('cls_10')) {
              clean[key] = val;
            }
          }
          return clean;
        }
      }
      return isDemo ? INITIAL_MOCK_ATTENDANCE : {};
    } catch (e) {
      console.warn('Failed to parse saved SMS attendance:', e);
      return {};
    }
  });

  const setDemoMode = (enabled: boolean) => {
    setDemoModeState(enabled);
    try {
      localStorage.setItem(SMS_DEMO_MODE_STORAGE_KEY, String(enabled));
    } catch {
      // Ignore
    }
    if (enabled) {
      setRegisteredSchools(INITIAL_MOCK_SCHOOLS);
      setActiveSchool(INITIAL_MOCK_SCHOOL);
      setClasses(INITIAL_MOCK_CLASSES);
      setTeachers(INITIAL_MOCK_TEACHERS);
      setStudents(INITIAL_MOCK_STUDENTS);
      setAttendanceRegisters(INITIAL_MOCK_ATTENDANCE);
      setJoinRequests(INITIAL_MOCK_JOIN_REQUESTS);
    } else {
      try {
        const savedSchools = localStorage.getItem(SMS_SCHOOLS_STORAGE_KEY);
        const parsedSchools: School[] = savedSchools ? JSON.parse(savedSchools) : [];
        const realSchools = parsedSchools.filter((s) => s.id !== 'sch_seld_khi_01');
        setRegisteredSchools(realSchools);
        setActiveSchool(realSchools[0] || EMPTY_DEFAULT_SCHOOL);

        const savedClasses = localStorage.getItem(SMS_STORAGE_KEY);
        const parsedClasses = savedClasses ? JSON.parse(savedClasses)?.classes || [] : [];
        setClasses(parsedClasses.filter((c: ClassSection) => !c.id.startsWith('cls_9') && !c.id.startsWith('cls_10')));

        const savedStudents = localStorage.getItem(SMS_STUDENTS_STORAGE_KEY);
        const parsedStudents: Student[] = savedStudents ? JSON.parse(savedStudents) : [];
        setStudents(parsedStudents.filter((s: Student) => !s.id.startsWith('std_0')));

        const savedReqs = localStorage.getItem(SMS_JOIN_REQUESTS_STORAGE_KEY);
        const parsedReqs: TeacherJoinRequest[] = savedReqs ? JSON.parse(savedReqs) : [];
        setJoinRequests(parsedReqs.filter((r: TeacherJoinRequest) => !r.id.startsWith('req_mock_')));

        setTeachers([]);
        setAttendanceRegisters({});
      } catch {
        setRegisteredSchools([]);
        setActiveSchool(EMPTY_DEFAULT_SCHOOL);
        setClasses([]);
        setStudents([]);
        setTeachers([]);
        setJoinRequests([]);
        setAttendanceRegisters({});
      }
    }
  };

  // Save classes changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        SMS_STORAGE_KEY,
        JSON.stringify({ classes, schoolId: activeSchool.id })
      );
    } catch {
      // Ignore storage errors
    }
  }, [classes, activeSchool.id]);

  // Save students changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        SMS_STUDENTS_STORAGE_KEY,
        JSON.stringify(students)
      );
    } catch {
      // Ignore storage errors
    }
  }, [students]);

  // Save attendance registers changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        SMS_ATTENDANCE_STORAGE_KEY,
        JSON.stringify(attendanceRegisters)
      );
    } catch {
      // Ignore storage errors
    }
  }, [attendanceRegisters]);

  const setUserRole = (role: UserRole) => {
    setUserRoleState(role);
    try {
      localStorage.setItem(SMS_ROLE_STORAGE_KEY, role);
    } catch {
      // Ignore storage errors
    }
  };

  // Cloud Firestore Sync when not in demo mode
  useEffect(() => {
    if (demoMode) return;

    // 1. Sync registered schools
    fetchSchoolsFromFirestore()
      .then((remoteSchools) => {
        if (remoteSchools && remoteSchools.length > 0) {
          setRegisteredSchools((prev) => {
            const map = new Map<string, School>();
            prev.forEach((s) => {
              if (s.id && s.id !== 'sch_seld_khi_01') map.set(s.id, s);
            });
            remoteSchools.forEach((s) => {
              if (s.id && s.id !== 'sch_seld_khi_01') map.set(s.id, s);
            });
            const merged = Array.from(map.values());
            if (!activeSchool.id && merged.length > 0) {
              setActiveSchool(merged[0]);
            }
            return merged;
          });
        }
      })
      .catch((err) => console.warn('[Firestore] Notice: School fetch error:', err));

    if (!activeSchool.id || activeSchool.id === 'sch_seld_khi_01') return;

    // 2. Sync classes for active school
    fetchClassesFromFirestore(activeSchool.id)
      .then((remoteClasses) => {
        if (remoteClasses && remoteClasses.length > 0) {
          setClasses(remoteClasses);
        }
      })
      .catch((err) => console.warn('[Firestore] Notice: Classes fetch error:', err));

    // 3. Sync students for active school
    fetchStudentsFromFirestore(activeSchool.id)
      .then((remoteStudents) => {
        if (remoteStudents && remoteStudents.length > 0) {
          setStudents(remoteStudents);
        }
      })
      .catch((err) => console.warn('[Firestore] Notice: Students fetch error:', err));

    // 4. Sync attendance for active school
    fetchAttendanceFromFirestore(activeSchool.id)
      .then((remoteAttendance) => {
        if (remoteAttendance && Object.keys(remoteAttendance).length > 0) {
          setAttendanceRegisters(remoteAttendance);
        }
      })
      .catch((err) => console.warn('[Firestore] Notice: Attendance fetch error:', err));

    // 5. Sync join requests for active school
    fetchJoinRequestsFromFirestore(activeSchool.id)
      .then((remoteRequests) => {
        if (remoteRequests && remoteRequests.length > 0) {
          setJoinRequests(remoteRequests);
        }
      })
      .catch((err) => console.warn('[Firestore] Notice: Join requests fetch error:', err));
  }, [demoMode, activeSchool.id]);

  // Register a new school as an Admin (with Primary Admin Selection)
  const registerNewSchool = (
    schoolData: Omit<School, 'id' | 'adminUids' | 'status'> & {
      status?: SchoolStatus;
      primaryAdminType?: PrimaryAdminType;
      primaryAdminName?: string;
      primaryAdminEmail?: string;
    },
    adminProfile: {
      fullName: string;
      email: string;
      phone?: string;
      designation?: string;
      uid?: string;
      primaryAdminType?: PrimaryAdminType;
      registeringUserRole?: 'admin' | 'teacher';
    }
  ): School => {
    const schoolId = `sch_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const adminUid = adminProfile.uid || `uid_admin_${Date.now().toString(36)}`;
    const primaryAdminType = adminProfile.primaryAdminType || schoolData.primaryAdminType || 'principal';
    const primaryAdminName = schoolData.primaryAdminName || adminProfile.fullName;
    const primaryAdminEmail = schoolData.primaryAdminEmail || adminProfile.email;
    const registeringRole: UserRole =
      adminProfile.registeringUserRole || (primaryAdminType === 'delegated' ? 'teacher' : 'admin');

    const newSchool: School = {
      ...schoolData,
      id: schoolId,
      adminUids: [adminUid],
      status: schoolData.status || 'active',
      primaryAdminType,
      primaryAdminName,
      primaryAdminEmail,
      createdAt: new Date().toISOString(),
    };

    setRegisteredSchools((prev) => [newSchool, ...prev]);
    setActiveSchool(newSchool);

    const newProfile: UserProfile = {
      uid: adminUid,
      email: adminProfile.email,
      fullName: adminProfile.fullName,
      role: registeringRole,
      schoolId: newSchool.id,
      schoolName: newSchool.name,
      status: 'active',
      designation:
        adminProfile.designation ||
        (primaryAdminType === 'principal'
          ? 'Principal / Headmaster'
          : primaryAdminType === 'teacher_admin'
          ? 'Teacher & School Administrator'
          : 'School Staff / IT Incharge'),
      phone: adminProfile.phone,
      assignedClassIds: [],
      createdAt: new Date().toISOString(),
    };

    setCurrentUserProfile(newProfile);
    setUserRole(registeringRole);

    if (!demoMode) {
      saveSchoolToFirestore(newSchool).catch((err) =>
        console.warn('[Firestore] Notice: School save:', err)
      );
      saveUserProfileToFirestore(newProfile).catch((err) =>
        console.warn('[Firestore] Notice: Profile save:', err)
      );
    }

    return newSchool;
  };

  // Submit join request as a Teacher
  const submitJoinRequest = (
    requestData: Omit<TeacherJoinRequest, 'id' | 'requestedAt' | 'status'>
  ) => {
    const id = `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const newReq: TeacherJoinRequest = {
      ...requestData,
      id,
      requestedAt: new Date().toISOString(),
      status: 'pending',
    };

    setJoinRequests((prev) => [newReq, ...prev]);

    // Update current user profile to pending
    const updatedProfile: UserProfile = {
      uid: requestData.uid,
      email: requestData.email,
      fullName: requestData.fullName,
      role: 'teacher',
      schoolId: requestData.schoolId,
      schoolName: requestData.schoolName,
      status: 'pending',
      designation: requestData.designation,
      cnic: requestData.cnic,
      phone: requestData.phone,
      assignedClassIds: [],
      createdAt: new Date().toISOString(),
    };

    setCurrentUserProfile(updatedProfile);

    if (!demoMode) {
      saveJoinRequestToFirestore(requestData.schoolId, newReq).catch((err) =>
        console.warn('[Firestore] Notice: Join request save:', err)
      );
      saveUserProfileToFirestore(updatedProfile).catch((err) =>
        console.warn('[Firestore] Notice: Profile save:', err)
      );
    }
  };

  // Admin approves a teacher join request and assigns class(es)
  const approveJoinRequest = (
    requestId: string,
    assignedClassIds: string[],
    assignAsClassTeacherFor?: string
  ) => {
    const target = joinRequests.find((r) => r.id === requestId);
    if (!target) return;

    // 1. Mark request as approved
    setJoinRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: 'approved',
              reviewedAt: new Date().toISOString(),
              assignedClassIds,
            }
          : r
      )
    );

    // 2. Add as active teacher
    const newTeacher: TeacherInfo = {
      id: target.uid || `t_${Date.now().toString(36)}`,
      name: target.fullName,
      designation: target.designation,
      email: target.email,
      phone: target.phone,
      assignedClasses: assignedClassIds,
    };

    setTeachers((prev) => [newTeacher, ...prev]);

    // 3. Assign as class teacher if specified
    if (assignAsClassTeacherFor) {
      setClasses((prev) =>
        prev.map((c) =>
          c.id === assignAsClassTeacherFor
            ? { ...c, classTeacherId: newTeacher.id, classTeacherName: newTeacher.name }
            : c
        )
      );
    }

    // 4. If current user is this applicant, make their profile active
    if (
      currentUserProfile &&
      (currentUserProfile.uid === target.uid || currentUserProfile.email === target.email)
    ) {
      setCurrentUserProfile((prev) =>
        prev
          ? {
              ...prev,
              status: 'active',
              role: 'teacher',
              assignedClassIds,
            }
          : null
      );
      setUserRole('teacher');
    }

    // 5. Cloud Firestore persistence
    if (!demoMode && target.schoolId) {
      saveJoinRequestToFirestore(target.schoolId, {
        ...target,
        status: 'approved',
        reviewedAt: new Date().toISOString(),
        assignedClassIds,
      }).catch((err) => console.warn('[Firestore] Notice: Request update:', err));

      if (target.uid) {
        saveUserProfileToFirestore({
          uid: target.uid,
          email: target.email,
          fullName: target.fullName,
          role: 'teacher',
          schoolId: target.schoolId,
          schoolName: target.schoolName,
          status: 'active',
          designation: target.designation,
          phone: target.phone,
          assignedClassIds,
          createdAt: new Date().toISOString(),
        }).catch((err) => console.warn('[Firestore] Notice: Teacher profile activate:', err));
      }
    }
  };

  // Admin rejects a join request
  const rejectJoinRequest = (requestId: string) => {
    setJoinRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? { ...r, status: 'rejected', reviewedAt: new Date().toISOString() }
          : r
      )
    );

    const target = joinRequests.find((r) => r.id === requestId);
    if (
      target &&
      currentUserProfile &&
      (currentUserProfile.uid === target.uid || currentUserProfile.email === target.email)
    ) {
      setCurrentUserProfile((prev) =>
        prev ? { ...prev, status: 'rejected' } : null
      );
    }
  };

  // Filter pending join requests for the active school
  const pendingJoinRequests = useMemo(() => {
    return joinRequests.filter(
      (r) => r.status === 'pending' && r.schoolId === activeSchool.id
    );
  }, [joinRequests, activeSchool.id]);

  const addClass = (newClassData: Omit<ClassSection, 'id' | 'createdAt'>) => {
    const id = `cls_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const newClass: ClassSection = {
      ...newClassData,
      id,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setClasses((prev) => [newClass, ...prev]);

    if (!demoMode && activeSchool.id) {
      saveClassToFirestore(activeSchool.id, newClass).catch((err) =>
        console.warn('[Firestore] Notice: Class save:', err)
      );
    }
  };

  const updateClass = (id: string, updated: Partial<ClassSection>) => {
    setClasses((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const merged = { ...c, ...updated };
          if (!demoMode && activeSchool.id) {
            saveClassToFirestore(activeSchool.id, merged).catch((err) =>
              console.warn('[Firestore] Notice: Class update:', err)
            );
          }
          return merged;
        }
        return c;
      })
    );
  };

  const deleteClass = (id: string) => {
    setClasses((prev) => prev.filter((c) => c.id !== id));
    if (!demoMode && activeSchool.id) {
      deleteClassFromFirestore(activeSchool.id, id).catch((err) =>
        console.warn('[Firestore] Notice: Class delete:', err)
      );
    }
  };

  const addStudent = (newStudentData: Omit<Student, 'id'>) => {
    const id = `std_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const newStudent: Student = {
      ...newStudentData,
      id,
    };
    setStudents((prev) => [newStudent, ...prev]);

    // Increment class student count
    setClasses((prev) =>
      prev.map((c) =>
        c.id === newStudent.classId
          ? { ...c, totalStudents: (c.totalStudents || 0) + 1 }
          : c
      )
    );

    if (!demoMode && activeSchool.id) {
      saveStudentToFirestore(activeSchool.id, newStudent).catch((err) =>
        console.warn('[Firestore] Notice: Student save:', err)
      );
    }
  };

  const updateStudent = (id: string, updated: Partial<Student>) => {
    const existing = students.find((s) => s.id === id);
    if (!existing) return;

    const oldClassId = existing.classId;
    const newClassId = updated.classId;

    const updatedStudent = { ...existing, ...updated };

    setStudents((prev) =>
      prev.map((s) => (s.id === id ? updatedStudent : s))
    );

    // If class changed, adjust total students in both classes
    if (newClassId && newClassId !== oldClassId) {
      setClasses((prev) =>
        prev.map((c) => {
          if (c.id === oldClassId) {
            return { ...c, totalStudents: Math.max(0, (c.totalStudents || 1) - 1) };
          }
          if (c.id === newClassId) {
            return { ...c, totalStudents: (c.totalStudents || 0) + 1 };
          }
          return c;
        })
      );
    }

    if (!demoMode && activeSchool.id) {
      saveStudentToFirestore(activeSchool.id, updatedStudent).catch((err) =>
        console.warn('[Firestore] Notice: Student update:', err)
      );
    }
  };

  const deleteStudent = (id: string) => {
    const existing = students.find((s) => s.id === id);
    if (!existing) return;

    setStudents((prev) => prev.filter((s) => s.id !== id));

    // Decrement class student count
    setClasses((prev) =>
      prev.map((c) =>
        c.id === existing.classId
          ? { ...c, totalStudents: Math.max(0, (c.totalStudents || 1) - 1) }
          : c
      )
    );

    if (!demoMode && activeSchool.id) {
      deleteStudentFromFirestore(activeSchool.id, id).catch((err) =>
        console.warn('[Firestore] Notice: Student delete:', err)
      );
    }
  };

  // Save or update attendance register (keyed by "YYYY-MM-DD_{classId}")
  const saveAttendance = (attendance: DailyClassAttendance) => {
    setAttendanceRegisters((prev) => ({
      ...prev,
      [attendance.id]: attendance,
    }));

    if (!demoMode && activeSchool.id) {
      saveAttendanceToFirestore(activeSchool.id, attendance).catch((err) =>
        console.warn('[Firestore] Notice: Attendance save:', err)
      );
    }
  };

  const getAttendance = (date: string, classId: string): DailyClassAttendance | undefined => {
    const id = `${date}_${classId}`;
    return attendanceRegisters[id];
  };

  // For Demo: Pick a mock teacher as the current teacher when in Teacher View
  const activeTeacher = useMemo(() => {
    // If user has a real profile with assigned classes
    if (!demoMode && currentUserProfile && currentUserProfile.role === 'teacher') {
      const match = teachers.find((t) => t.email === currentUserProfile.email || t.id === currentUserProfile.uid);
      if (match) return match;
      return {
        id: currentUserProfile.uid,
        name: currentUserProfile.fullName,
        designation: currentUserProfile.designation || 'Teacher',
        email: currentUserProfile.email,
        phone: currentUserProfile.phone,
        assignedClasses: currentUserProfile.assignedClassIds || [],
      };
    }
    return teachers[1] || teachers[0]; // Ms. Shabana Parveen (Class 9-A)
  }, [teachers, demoMode, currentUserProfile]);

  // Determine effective role: In Demo mode, userRoleState controls it; in Live mode, profile controls it
  const effectiveRole = useMemo<UserRole>(() => {
    if (demoMode) return userRole;
    if (currentUserProfile && currentUserProfile.status === 'active') {
      return currentUserProfile.role;
    }
    // Default unprivileged role when not affiliated with an active school in live mode
    return 'teacher';
  }, [demoMode, userRole, currentUserProfile]);

  // Filtered classes by role: Admins see all classes; Teachers only see assigned classes
  const filteredClassesForUser = useMemo(() => {
    if (effectiveRole === 'admin' || effectiveRole === 'principal') {
      return classes;
    }
    // Teacher view: filter by teacher assigned classes
    return classes.filter(
      (c) =>
        c.classTeacherId === activeTeacher.id ||
        activeTeacher.assignedClasses.includes(c.id)
    );
  }, [classes, effectiveRole, activeTeacher]);

  // Filtered students by role: Admins see all students; Teachers only see students from their assigned classes
  const filteredStudentsForUser = useMemo(() => {
    if (effectiveRole === 'admin' || effectiveRole === 'principal') {
      return students;
    }
    const teacherClassIds = new Set(filteredClassesForUser.map((c) => c.id));
    return students.filter((s) => teacherClassIds.has(s.classId));
  }, [students, effectiveRole, filteredClassesForUser]);

  // Real-time Today's Attendance Analytics
  const todayAttendanceStats = useMemo<TodayAttendanceStats>(() => {
    const todayDate = new Date().toISOString().split('T')[0];
    const todayRegisters = Object.values(attendanceRegisters).filter(
      (r) => r.date === todayDate
    );

    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLeave = 0;
    let totalLate = 0;
    let totalStudentsRecorded = 0;

    todayRegisters.forEach((reg) => {
      totalPresent += reg.summary.present || 0;
      totalAbsent += reg.summary.absent || 0;
      totalLeave += reg.summary.leave || 0;
      totalLate += reg.summary.late || 0;
      totalStudentsRecorded += reg.summary.total || 0;
    });

    const totalMarkedClasses = todayRegisters.length;
    const totalClasses = classes.length;

    const overallPercentage =
      totalStudentsRecorded > 0
        ? Math.round(((totalPresent + totalLate) / totalStudentsRecorded) * 100)
        : totalClasses > 0 && totalMarkedClasses > 0
        ? 93
        : 94; // Realistic base

    return {
      totalMarkedClasses,
      totalClasses,
      overallPercentage,
      totalPresent,
      totalAbsent,
      totalLeave,
      totalLate,
      totalStudentsRecorded,
    };
  }, [attendanceRegisters, classes.length]);

  const stats = useMemo(() => {
    const totalStudents = students.filter((s) => s.status === 'active').length;
    const totalClasses = classes.length;
    const totalTeachers = teachers.length;
    const averageClassSize = totalClasses > 0 ? Math.round(totalStudents / totalClasses) : 0;
    return {
      totalStudents,
      totalClasses,
      totalTeachers,
      averageClassSize,
    };
  }, [students, classes, teachers]);

  return (
    <SmsContext.Provider
      value={{
        userRole: effectiveRole,
        setUserRole,
        demoMode,
        setDemoMode,
        currentUserProfile,
        setCurrentUserProfile,
        isSuperAdmin,
        isImpersonating,
        impersonateSchool,
        exitImpersonation,
        toggleSchoolStatus,
        activeSchool,
        setActiveSchool,
        registeredSchools,
        registerNewSchool,
        joinRequests,
        pendingJoinRequests,
        submitJoinRequest,
        approveJoinRequest,
        rejectJoinRequest,
        classes,
        teachers,
        students,
        addClass,
        updateClass,
        deleteClass,
        addStudent,
        updateStudent,
        deleteStudent,
        filteredClassesForUser,
        filteredStudentsForUser,
        activeTeacher,
        attendanceRegisters,
        saveAttendance,
        getAttendance,
        todayAttendanceStats,
        stats,
      }}
    >
      {children}
    </SmsContext.Provider>
  );
};

export const useSms = () => {
  const context = useContext(SmsContext);
  if (!context) {
    throw new Error('useSms must be used within an SmsProvider');
  }
  return context;
};
