import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { AlertCircle, RefreshCw, X, WifiOff } from 'lucide-react';
import {
  UserRole,
  School,
  ClassSection,
  TeacherInfo,
  Student,
  DailyClassAttendance,
  UserProfile,
  TeacherJoinRequest,
  SchoolRegistrationRequest,
  SchoolStatus,
  PrimaryAdminType,
  ClassFeeStructure,
  FeePayment,
  FeeConcessionRule,
  Exam,
  StudentExamMarks,
  TimetableEntry,
  HomeworkItem,
  StudentCertificate,
  GlobalNotice,
  SchoolAnalyticsSummary,
  StudentPortalLink,
} from '../types';
import {
  INITIAL_MOCK_SCHOOL,
  INITIAL_MOCK_SCHOOLS,
  INITIAL_MOCK_CLASSES,
  INITIAL_MOCK_TEACHERS,
  INITIAL_MOCK_STUDENTS,
  INITIAL_MOCK_ATTENDANCE,
  INITIAL_MOCK_JOIN_REQUESTS,
  INITIAL_MOCK_SCHOOL_REG_REQUESTS,
  INITIAL_MOCK_FEE_STRUCTURES,
  INITIAL_MOCK_FEE_PAYMENTS,
  INITIAL_MOCK_FEE_CONCESSIONS,
  INITIAL_MOCK_EXAMS,
  INITIAL_MOCK_EXAM_MARKS,
  INITIAL_MOCK_TIMETABLE,
  INITIAL_MOCK_HOMEWORK,
  INITIAL_MOCK_CERTIFICATES,
  INITIAL_MOCK_GLOBAL_NOTICES,
} from '../data/mockSmsData';
import {
  FirestoreSyncError,
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
  saveSchoolRegistrationRequestToFirestore,
  fetchSchoolRegistrationRequestsFromFirestore,
  saveTeacherToFirestore,
  fetchTeachersFromFirestore,
  saveFeeStructureToFirestore,
  fetchFeeStructuresFromFirestore,
  fetchSingleFeeStructureFromFirestore,
  deleteFeeStructureFromFirestore,
  saveFeePaymentToFirestore,
  fetchFeePaymentsFromFirestore,
  saveFeeConcessionToFirestore,
  fetchFeeConcessionsFromFirestore,
  deleteFeeConcessionFromFirestore,
  saveExamToFirestore,
  fetchExamsFromFirestore,
  deleteExamFromFirestore,
  saveStudentMarksToFirestore,
  fetchMarksFromFirestore,
  deleteStudentMarksFromFirestore,
  buildParentLinkId,
  generateParentInviteCode,
  saveParentStudentLinkToFirestore,
  verifyAndClaimParentLink,
  generateStudentInviteCode,
  saveStudentPortalLinkToFirestore,
  fetchStudentPortalLinksForSchoolFromFirestore,
  verifyAndClaimStudentLink,
  fetchSingleClassFromFirestore,
  fetchSingleStudentFromFirestore,
  fetchChildFeePaymentsFromFirestore,
  fetchChildMarksFromFirestore,
  fetchPublishedExamsFromFirestore,
  saveTimetableEntryToFirestore,
  fetchTimetableFromFirestore,
  deleteTimetableEntryFromFirestore,
  saveHomeworkToFirestore,
  fetchHomeworkFromFirestore,
  deleteHomeworkFromFirestore,
  saveCertificateToFirestore,
  fetchCertificatesFromFirestore,
  deleteCertificateFromFirestore,
  saveSchoolAnalyticsToFirestore,
  saveGlobalNoticeToFirestore,
  fetchAllGlobalNoticesFromFirestore,
  fetchNoticesForSchoolFromFirestore,
  markGlobalNoticeAsReadInFirestore,
  deleteGlobalNoticeFromFirestore,
} from '../services/smsFirestoreService';
import { useAuth } from '../../../context/AuthContext';
import { hasAdminCapabilities } from '../../../utils/smartRouting';

export interface SyncErrorInfo {
  id: string;
  message: string;
  reason: string;
  operation: string;
  retry: () => Promise<void>;
}

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
  // Cloud Sync & Resilience Status
  syncError: SyncErrorInfo | null;
  clearSyncError: () => void;
  isPendingSync: boolean;
  isOnline: boolean;

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

  // School Registration Requests (Super Admin Approval)
  schoolRegistrationRequests: SchoolRegistrationRequest[];
  pendingSchoolRegistrationRequests: SchoolRegistrationRequest[];
  submitSchoolRegistration: (
    schoolData: Omit<School, 'id' | 'adminUids' | 'status'> & {
      id?: string;
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
    },
    options?: {
      requestId?: string;
      skipFirestoreSync?: boolean;
    }
  ) => SchoolRegistrationRequest;
  approveSchoolRegistration: (requestId: string) => void;
  rejectSchoolRegistration: (requestId: string, reason?: string) => void;
  
  // Join Requests (Faculty Onboarding)
  joinRequests: TeacherJoinRequest[];
  pendingJoinRequests: TeacherJoinRequest[];
  submitJoinRequest: (
    requestData: Omit<TeacherJoinRequest, 'id' | 'requestedAt' | 'status'>,
    options?: {
      requestId?: string;
      skipFirestoreSync?: boolean;
    }
  ) => void;
  approveJoinRequest: (requestId: string, assignedClassIds: string[], assignAsClassTeacherFor?: string) => void;
  rejectJoinRequest: (requestId: string) => void;

  // Classes & Students
  classes: ClassSection[];
  loadingClasses: boolean;
  refreshActiveSchoolClasses: (schoolId?: string) => Promise<ClassSection[]>;
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

  // Teacher Profile Management & Admission Rights
  updateTeacherProfile: (teacherId: string, updates: Partial<TeacherInfo>) => void;
  toggleAdmissionIncharge: (teacherId: string) => void;
  canAdmitStudents: boolean;

  // Attendance
  attendanceRegisters: Record<string, DailyClassAttendance>;
  saveAttendance: (attendance: DailyClassAttendance) => void;
  getAttendance: (date: string, classId: string) => DailyClassAttendance | undefined;
  todayAttendanceStats: TodayAttendanceStats;

  // Fee Management (Financials)
  feeStructures: ClassFeeStructure[];
  feePayments: FeePayment[];
  feeConcessions: FeeConcessionRule[];
  saveClassFeeStructure: (structure: Omit<ClassFeeStructure, 'schoolId'>) => Promise<boolean>;
  deleteClassFeeStructure: (classId: string) => Promise<boolean>;
  recordFeePayment: (payment: Omit<FeePayment, 'schoolId'>) => Promise<boolean>;
  recordBulkFeePayments: (payments: Array<Omit<FeePayment, 'schoolId'>>) => Promise<boolean>;
  saveFeeConcessionRule: (rule: Omit<FeeConcessionRule, 'schoolId'>) => Promise<boolean>;
  deleteFeeConcessionRule: (concessionId: string) => Promise<boolean>;
  applyStudentConcession: (studentId: string, rule: FeeConcessionRule | null) => Promise<boolean>;
  getFeeStructureForClass: (classId: string) => ClassFeeStructure | undefined;
  getStudentFeeStatus: (studentId: string, month: string) => FeePayment | undefined;
  canManageFeeStructure: boolean;
  canCollectFee: boolean;

  // Phase B: Exams & Results
  exams: Exam[];
  examMarks: StudentExamMarks[];
  saveExam: (exam: Omit<Exam, 'schoolId'>) => Promise<boolean>;
  deleteExam: (examId: string) => Promise<boolean>;
  saveStudentMarks: (marks: Omit<StudentExamMarks, 'schoolId'>) => Promise<boolean>;
  saveBulkStudentMarks: (marksList: Array<Omit<StudentExamMarks, 'schoolId'>>) => Promise<boolean>;
  canManageExams: boolean;
  canEnterMarksForClass: (classId: string) => boolean;
  updateSchoolLogo: (logoUrl: string) => Promise<boolean>;

  // Phase C & S: Parent & Student Portals (Strict Read-Only Access & Invite Management)
  generateParentInviteForStudent: (
    studentId: string,
    parentEmail?: string
  ) => Promise<{ inviteCode: string; inviteUrl: string } | null>;
  linkParentToStudent: (params: {
    schoolId: string;
    grNumber: string;
    inviteCode?: string;
    phone?: string;
  }) => Promise<UserProfile | null>;
  studentPortalLinks: Record<string, StudentPortalLink>;
  generateStudentInviteForStudent: (
    studentId: string,
    studentEmail?: string
  ) => Promise<{ inviteCode: string; inviteUrl: string } | null>;
  linkStudentAccount: (params: {
    schoolId: string;
    grNumber: string;
    inviteCode?: string;
  }) => Promise<UserProfile | null>;

  // Phase D: Timetable, Homework & Certificates
  timetableEntries: TimetableEntry[];
  homeworkItems: HomeworkItem[];
  certificates: StudentCertificate[];
  saveTimetableEntry: (entry: Omit<TimetableEntry, 'schoolId'>) => Promise<boolean>;
  deleteTimetableEntry: (entryId: string) => Promise<boolean>;
  saveHomework: (item: Omit<HomeworkItem, 'schoolId'>) => Promise<boolean>;
  deleteHomework: (homeworkId: string) => Promise<boolean>;
  saveCertificate: (cert: Omit<StudentCertificate, 'schoolId'>) => Promise<boolean>;
  deleteCertificate: (certificateId: string) => Promise<boolean>;
  canManageTimetable: boolean;
  canPostHomework: boolean;
  canManageCertificates: boolean;

  // Super Admin Strict Read-Only Impersonation & Global Notice Board
  isReadOnlyImpersonation: boolean;
  globalNotices: GlobalNotice[];
  unreadNoticesCount: number;
  publishGlobalNotice: (notice: {
    title: string;
    message: string;
    priority: 'high' | 'medium' | 'low';
    date: string;
    targetType: 'all' | 'specific';
    targetSchoolIds: string[];
  }) => Promise<boolean>;
  deleteGlobalNotice: (noticeId: string) => Promise<boolean>;
  markNoticeAsRead: (noticeId: string) => Promise<boolean>;

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
const SMS_SCHOOL_REG_REQUESTS_STORAGE_KEY = 'pakedu_sms_school_reg_requests_v1';
const SMS_TEACHERS_STORAGE_KEY = 'pakedu_sms_teachers_v1';
const SMS_FEE_STRUCTURES_STORAGE_KEY = 'pakedu_sms_fee_structures_v1';
const SMS_FEE_PAYMENTS_STORAGE_KEY = 'pakedu_sms_fee_payments_v1';
const SMS_FEE_CONCESSIONS_STORAGE_KEY = 'pakedu_sms_fee_concessions_v1';
const SMS_EXAMS_STORAGE_KEY = 'pakedu_sms_exams_v1';
const SMS_EXAM_MARKS_STORAGE_KEY = 'pakedu_sms_exam_marks_v1';
const SMS_TIMETABLE_STORAGE_KEY = 'pakedu_sms_timetable_v1';
const SMS_HOMEWORK_STORAGE_KEY = 'pakedu_sms_homework_v1';
const SMS_CERTIFICATES_STORAGE_KEY = 'pakedu_sms_certificates_v1';
const SMS_GLOBAL_NOTICES_STORAGE_KEY = 'pakedu_sms_global_notices_v1';

const SmsContext = createContext<SmsContextType | undefined>(undefined);

export const SmsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Demo Mode: Strictly disabled in production builds (gated behind import.meta.env.DEV)
  const [demoMode, setDemoModeState] = useState<boolean>(() => {
    if (!import.meta.env.DEV) {
      try {
        localStorage.removeItem(SMS_DEMO_MODE_STORAGE_KEY);
      } catch {}
      return false;
    }
    try {
      const saved = localStorage.getItem(SMS_DEMO_MODE_STORAGE_KEY);
      return saved === 'true'; // Strictly false unless explicitly toggled ON in development
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

  // Synchronize with AuthContext when available
  let authUserUid: string | null = null;
  let authRefreshFn: (() => Promise<UserProfile | null>) | null = null;
  try {
    const authCtx = useAuth();
    authUserUid = authCtx.currentUser?.uid || null;
    authRefreshFn = authCtx.refreshUserProfile;
    useEffect(() => {
      if (authCtx.currentUserProfile) {
        setCurrentUserProfile(authCtx.currentUserProfile);
        if (authCtx.currentUserProfile.role) {
          setUserRoleState(authCtx.currentUserProfile.role);
        }
      }
    }, [authCtx.currentUserProfile]);
  } catch {
    // If rendered outside AuthProvider (e.g. standalone test)
  }

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
    if (registeredSchools.length > 0) return registeredSchools[0];
    return INITIAL_MOCK_SCHOOL;
  });

  // Super Admin & Impersonation State
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonationOriginalRole, setImpersonationOriginalRole] = useState<UserRole | null>(null);

  const isSuperAdmin = useMemo(() => {
    const email = (currentUserProfile?.email || '').trim().toLowerCase();
    return (
      Boolean(currentUserProfile?.isSuperAdmin) ||
      currentUserProfile?.role === 'super-admin' ||
      email === 'owner@pakedu.com' ||
      userRole === 'super-admin'
    );
  }, [currentUserProfile, userRole]);

  const isReadOnlyImpersonation = useMemo(() => {
    return Boolean(isImpersonating && (isSuperAdmin || impersonationOriginalRole === 'super-admin'));
  }, [isImpersonating, isSuperAdmin, impersonationOriginalRole]);

  // Synchronize activeSchool whenever registeredSchools or currentUserProfile updates
  useEffect(() => {
    if (registeredSchools && registeredSchools.length > 0) {
      const currentExistsInDirectory = Boolean(
        activeSchool.id && registeredSchools.some((s) => s.id === activeSchool.id)
      );

      // Preserve explicit Super Admin selection or active impersonation if valid
      if (isImpersonating && currentExistsInDirectory) {
        return;
      }
      if (isSuperAdmin && currentExistsInDirectory) {
        return;
      }

      if (currentUserProfile?.schoolId) {
        const matched = registeredSchools.find(
          (s) =>
            s.id === currentUserProfile.schoolId ||
            (currentUserProfile.semisCode && s.semisCode === currentUserProfile.semisCode)
        );
        if (matched && activeSchool.id !== matched.id) {
          setActiveSchool(matched);
          return;
        }
      }

      // If activeSchool is empty, mock placeholder, or no longer in registeredSchools, bind to first live school
      if (!currentExistsInDirectory) {
        setActiveSchool(registeredSchools[0]);
      }
    } else if (!activeSchool.id || activeSchool.id === '') {
      setActiveSchool(INITIAL_MOCK_SCHOOL);
    }
  }, [registeredSchools, currentUserProfile?.schoolId, currentUserProfile?.semisCode, isImpersonating, isSuperAdmin]);

  // Cloud Sync Resilience & Error Diagnostics State
  const [syncError, setSyncError] = useState<SyncErrorInfo | null>(null);
  const [isPendingSync, setIsPendingSync] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setIsPendingSync(false);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const clearSyncError = () => setSyncError(null);

  const PLATFORM_SYNC_OPERATIONS = new Set([
    'toggleSchoolStatus',
    'approveSchoolRegistration',
    'rejectSchoolRegistration',
    'registerNewSchool',
    'submitSchoolRegistration',
    'publishGlobalNotice',
    'deleteGlobalNotice',
    'markNoticeAsRead',
  ]);

  const blockSchoolMutation = (operation: string): boolean => {
    const isReadOnlyPortalAccount =
      !demoMode &&
      (currentUserProfile?.role === 'student' ||
        currentUserProfile?.role === 'parent' ||
        userRole === 'student' ||
        userRole === 'parent');
    if (isImpersonating || (!demoMode && isSuperAdmin) || isReadOnlyPortalAccount) {
      setSyncError({
        id: `rbac_readonly_${Date.now()}`,
        message: isReadOnlyPortalAccount
          ? 'Read-Only Account: Students and Parents cannot modify school records.'
          : 'Read-Only Oversight: Super Admin cannot create, edit, or delete school-level records.',
        reason: isReadOnlyPortalAccount
          ? 'Strict Read-Only Portal Isolation'
          : 'You are viewing as School Admin - Read Only',
        operation,
        retry: async () => {},
      });
      return true;
    }
    return false;
  };

  const performSync = async (operation: string, syncFn: () => Promise<any>): Promise<boolean> => {
    if (demoMode) return true;
    const isReadOnlyPortalAccount =
      currentUserProfile?.role === 'student' ||
      currentUserProfile?.role === 'parent' ||
      userRole === 'student' ||
      userRole === 'parent';
    if ((isImpersonating || isSuperAdmin || isReadOnlyPortalAccount) && !PLATFORM_SYNC_OPERATIONS.has(operation)) {
      console.warn(`[RBAC] Blocked school mutation "${operation}" for Super Admin / Read-Only mode.`);
      setSyncError({
        id: `rbac_superadmin_${Date.now()}`,
        message: 'Read-Only Oversight: Super Admin is restricted from modifying school records.',
        reason: 'Super Admin accounts can only manage platform approvals and announcements',
        operation,
        retry: async () => {},
      });
      return false;
    }
    try {
      await syncFn();
      setSyncError(null);
      setIsPendingSync(false);
      if (
        operation === 'submitSchoolRegistration' ||
        operation === 'submitJoinRequest' ||
        operation === 'registerNewSchool'
      ) {
        try {
          await authRefreshFn?.();
        } catch {
          // Non-fatal refresh notice
        }
      }
      return true;
    } catch (err: any) {
      console.error(`[SmsContext] Sync error during ${operation}:`, err);
      const isOfflineError =
        err?.isOffline ||
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        err?.code === 'unavailable' ||
        err?.code === 'offline';

      if (isOfflineError) {
        setIsPendingSync(true);
      } else {
        const errorReason =
          err?.code === 'permission-denied'
            ? 'Permission denied by institutional security policy'
            : err?.message || 'Institutional cloud write failed';

        setSyncError({
          id: `${operation}_${Date.now()}`,
          message: `Cloud sync failed: ${errorReason}. Your change is NOT saved.`,
          reason: errorReason,
          operation,
          retry: async () => {
            setSyncError(null);
            await performSync(operation, syncFn);
          },
        });
      }
      return false;
    }
  };

  const toggleSchoolStatus = (schoolId: string, reason?: string) => {
    setRegisteredSchools((prev) =>
      prev.map((s) => {
        if (s.id === schoolId) {
          const nextStatus: SchoolStatus = s.status === 'suspended' ? 'active' : 'suspended';
          const updated = {
            ...s,
            status: nextStatus,
            suspendedReason: nextStatus === 'suspended' ? reason || 'Administrative Policy Review' : undefined,
          };
          if (!demoMode) {
            performSync('toggleSchoolStatus', () => saveSchoolToFirestore(updated));
          }
          return updated;
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

  // School Registration Requests (Super Admin Approval)
  const [schoolRegistrationRequests, setSchoolRegistrationRequests] = useState<SchoolRegistrationRequest[]>(() => {
    try {
      const isDemo = localStorage.getItem(SMS_DEMO_MODE_STORAGE_KEY) === 'true';
      const saved = localStorage.getItem(SMS_SCHOOL_REG_REQUESTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (isDemo) return parsed.length > 0 ? parsed : INITIAL_MOCK_SCHOOL_REG_REQUESTS;
          return parsed.filter((r: SchoolRegistrationRequest) => !r.id.startsWith('sch_req_00'));
        }
      }
      return isDemo ? INITIAL_MOCK_SCHOOL_REG_REQUESTS : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SMS_SCHOOL_REG_REQUESTS_STORAGE_KEY, JSON.stringify(schoolRegistrationRequests));
    } catch {
      // Ignore
    }
  }, [schoolRegistrationRequests]);

  const pendingSchoolRegistrationRequests = useMemo(() => {
    return schoolRegistrationRequests.filter((r) => r.status === 'pending');
  }, [schoolRegistrationRequests]);

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
      const saved = localStorage.getItem(SMS_TEACHERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (isDemo) return parsed;
          return parsed.filter((t: TeacherInfo) => !t.id.startsWith('t_00'));
        }
      }
      return isDemo ? INITIAL_MOCK_TEACHERS : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SMS_TEACHERS_STORAGE_KEY, JSON.stringify(teachers));
    } catch {
      // Ignore
    }
  }, [teachers]);

  const [loadingClasses, setLoadingClasses] = useState<boolean>(false);

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

  const [feeStructures, setFeeStructures] = useState<ClassFeeStructure[]>(() => {
    try {
      const isDemo = localStorage.getItem(SMS_DEMO_MODE_STORAGE_KEY) === 'true';
      const saved = localStorage.getItem(SMS_FEE_STRUCTURES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (isDemo) return parsed.length > 0 ? parsed : INITIAL_MOCK_FEE_STRUCTURES;
          return parsed.filter((f: ClassFeeStructure) => !f.id.startsWith('cls_9') && !f.id.startsWith('cls_10'));
        }
      }
      return isDemo ? INITIAL_MOCK_FEE_STRUCTURES : [];
    } catch (e) {
      console.warn('Failed to parse saved fee structures:', e);
      return [];
    }
  });

  const [feePayments, setFeePayments] = useState<FeePayment[]>(() => {
    try {
      const isDemo = localStorage.getItem(SMS_DEMO_MODE_STORAGE_KEY) === 'true';
      const saved = localStorage.getItem(SMS_FEE_PAYMENTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (isDemo) return parsed.length > 0 ? parsed : INITIAL_MOCK_FEE_PAYMENTS;
          return parsed.filter((p: FeePayment) => !p.id.startsWith('pay_00'));
        }
      }
      return isDemo ? INITIAL_MOCK_FEE_PAYMENTS : [];
    } catch (e) {
      console.warn('Failed to parse saved fee payments:', e);
      return [];
    }
  });

  const [feeConcessions, setFeeConcessions] = useState<FeeConcessionRule[]>(() => {
    try {
      const isDemo = localStorage.getItem(SMS_DEMO_MODE_STORAGE_KEY) === 'true';
      const saved = localStorage.getItem(SMS_FEE_CONCESSIONS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (isDemo) return parsed.length > 0 ? parsed : INITIAL_MOCK_FEE_CONCESSIONS;
          return parsed.filter((c: FeeConcessionRule) => !c.id.startsWith('conc_orphan_') && !c.id.startsWith('conc_staff_') && !c.id.startsWith('conc_merit_'));
        }
      }
      return isDemo ? INITIAL_MOCK_FEE_CONCESSIONS : [];
    } catch (e) {
      console.warn('Failed to parse saved fee concessions:', e);
      return [];
    }
  });

  const [exams, setExams] = useState<Exam[]>(() => {
    try {
      const isDemo = localStorage.getItem(SMS_DEMO_MODE_STORAGE_KEY) === 'true';
      const saved = localStorage.getItem(SMS_EXAMS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (isDemo) return parsed.length > 0 ? parsed : INITIAL_MOCK_EXAMS;
          return parsed.filter((e: Exam) => !e.id.startsWith('exam_first_term_2026'));
        }
      }
      return isDemo ? INITIAL_MOCK_EXAMS : [];
    } catch (e) {
      console.warn('Failed to parse saved exams:', e);
      return [];
    }
  });

  const [examMarks, setExamMarks] = useState<StudentExamMarks[]>(() => {
    try {
      const isDemo = localStorage.getItem(SMS_DEMO_MODE_STORAGE_KEY) === 'true';
      const saved = localStorage.getItem(SMS_EXAM_MARKS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (isDemo) return parsed.length > 0 ? parsed : INITIAL_MOCK_EXAM_MARKS;
          return parsed.filter((m: StudentExamMarks) => !m.id.startsWith('exam_first_term_2026_'));
        }
      }
      return isDemo ? INITIAL_MOCK_EXAM_MARKS : [];
    } catch (e) {
      console.warn('Failed to parse saved exam marks:', e);
      return [];
    }
  });

  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>(() => {
    try {
      const isDemo = localStorage.getItem(SMS_DEMO_MODE_STORAGE_KEY) === 'true';
      const saved = localStorage.getItem(SMS_TIMETABLE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (isDemo) return parsed.length > 0 ? parsed : INITIAL_MOCK_TIMETABLE;
          return parsed.filter((t: TimetableEntry) => !t.id.startsWith('tt_mon_') && !t.id.startsWith('tt_tue_'));
        }
      }
      return isDemo ? INITIAL_MOCK_TIMETABLE : [];
    } catch {
      return [];
    }
  });

  const [homeworkItems, setHomeworkItems] = useState<HomeworkItem[]>(() => {
    try {
      const isDemo = localStorage.getItem(SMS_DEMO_MODE_STORAGE_KEY) === 'true';
      const saved = localStorage.getItem(SMS_HOMEWORK_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (isDemo) return parsed.length > 0 ? parsed : INITIAL_MOCK_HOMEWORK;
          return parsed.filter((h: HomeworkItem) => h.id !== 'hw_001');
        }
      }
      return isDemo ? INITIAL_MOCK_HOMEWORK : [];
    } catch {
      return [];
    }
  });

  const [certificates, setCertificates] = useState<StudentCertificate[]>(() => {
    try {
      const isDemo = localStorage.getItem(SMS_DEMO_MODE_STORAGE_KEY) === 'true';
      const saved = localStorage.getItem(SMS_CERTIFICATES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
      return isDemo ? INITIAL_MOCK_CERTIFICATES : [];
    } catch {
      return [];
    }
  });

  const [studentPortalLinks, setStudentPortalLinks] = useState<Record<string, StudentPortalLink>>({});

  const [globalNotices, setGlobalNotices] = useState<GlobalNotice[]>(() => {
    try {
      const isDemo = localStorage.getItem(SMS_DEMO_MODE_STORAGE_KEY) === 'true';
      const saved = localStorage.getItem(SMS_GLOBAL_NOTICES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
      return isDemo ? INITIAL_MOCK_GLOBAL_NOTICES : [];
    } catch {
      return [];
    }
  });

  const setDemoMode = (enabled: boolean) => {
    if (!import.meta.env.DEV) {
      setDemoModeState(false);
      try {
        localStorage.removeItem(SMS_DEMO_MODE_STORAGE_KEY);
      } catch {}
      return;
    }
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
      setSchoolRegistrationRequests(INITIAL_MOCK_SCHOOL_REG_REQUESTS);
      setFeeStructures(INITIAL_MOCK_FEE_STRUCTURES);
      setFeePayments(INITIAL_MOCK_FEE_PAYMENTS);
      setFeeConcessions(INITIAL_MOCK_FEE_CONCESSIONS);
      setExams(INITIAL_MOCK_EXAMS);
      setExamMarks(INITIAL_MOCK_EXAM_MARKS);
      setTimetableEntries(INITIAL_MOCK_TIMETABLE);
      setHomeworkItems(INITIAL_MOCK_HOMEWORK);
      setCertificates(INITIAL_MOCK_CERTIFICATES);
      setGlobalNotices(INITIAL_MOCK_GLOBAL_NOTICES);
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

        const savedSchoolReqs = localStorage.getItem(SMS_SCHOOL_REG_REQUESTS_STORAGE_KEY);
        const parsedSchoolReqs: SchoolRegistrationRequest[] = savedSchoolReqs ? JSON.parse(savedSchoolReqs) : [];
        setSchoolRegistrationRequests(parsedSchoolReqs.filter((r) => !r.id.startsWith('sch_req_00')));

        const savedTeachers = localStorage.getItem(SMS_TEACHERS_STORAGE_KEY);
        const parsedTeachers: TeacherInfo[] = savedTeachers ? JSON.parse(savedTeachers) : [];
        setTeachers(parsedTeachers.filter((t) => !t.id.startsWith('t_00')));

        const savedFees = localStorage.getItem(SMS_FEE_STRUCTURES_STORAGE_KEY);
        const parsedFees = savedFees ? JSON.parse(savedFees) : [];
        setFeeStructures(parsedFees.filter((f: ClassFeeStructure) => !f.id.startsWith('cls_9') && !f.id.startsWith('cls_10')));

        const savedPayments = localStorage.getItem(SMS_FEE_PAYMENTS_STORAGE_KEY);
        const parsedPayments = savedPayments ? JSON.parse(savedPayments) : [];
        setFeePayments(parsedPayments.filter((p: FeePayment) => !p.id.startsWith('pay_00')));

        const savedConcessions = localStorage.getItem(SMS_FEE_CONCESSIONS_STORAGE_KEY);
        const parsedConcessions = savedConcessions ? JSON.parse(savedConcessions) : [];
        setFeeConcessions(parsedConcessions.filter((c: FeeConcessionRule) => !c.id.startsWith('conc_orphan_') && !c.id.startsWith('conc_staff_') && !c.id.startsWith('conc_merit_')));

        const savedExams = localStorage.getItem(SMS_EXAMS_STORAGE_KEY);
        const parsedExams = savedExams ? JSON.parse(savedExams) : [];
        setExams(parsedExams.filter((e: Exam) => !e.id.startsWith('exam_first_term_2026')));

        const savedExamMarks = localStorage.getItem(SMS_EXAM_MARKS_STORAGE_KEY);
        const parsedExamMarks = savedExamMarks ? JSON.parse(savedExamMarks) : [];
        setExamMarks(parsedExamMarks.filter((m: StudentExamMarks) => !m.id.startsWith('exam_first_term_2026_')));

        const savedTimetable = localStorage.getItem(SMS_TIMETABLE_STORAGE_KEY);
        const parsedTimetable = savedTimetable ? JSON.parse(savedTimetable) : [];
        setTimetableEntries(parsedTimetable.filter((t: TimetableEntry) => !t.id.startsWith('tt_mon_') && !t.id.startsWith('tt_tue_')));

        const savedHomework = localStorage.getItem(SMS_HOMEWORK_STORAGE_KEY);
        const parsedHomework = savedHomework ? JSON.parse(savedHomework) : [];
        setHomeworkItems(parsedHomework.filter((h: HomeworkItem) => h.id !== 'hw_001'));

        const savedCertificates = localStorage.getItem(SMS_CERTIFICATES_STORAGE_KEY);
        setCertificates(savedCertificates ? JSON.parse(savedCertificates) : []);

        const savedNotices = localStorage.getItem(SMS_GLOBAL_NOTICES_STORAGE_KEY);
        const parsedNotices = savedNotices ? JSON.parse(savedNotices) : [];
        setGlobalNotices(parsedNotices.filter((n: GlobalNotice) => !n.id.startsWith('notice_mock_')));

        setAttendanceRegisters({});
      } catch {
        setRegisteredSchools([]);
        setActiveSchool(EMPTY_DEFAULT_SCHOOL);
        setClasses([]);
        setStudents([]);
        setTeachers([]);
        setJoinRequests([]);
        setSchoolRegistrationRequests([]);
        setFeeStructures([]);
        setFeePayments([]);
        setFeeConcessions([]);
        setExams([]);
        setExamMarks([]);
        setTimetableEntries([]);
        setHomeworkItems([]);
        setCertificates([]);
        setGlobalNotices([]);
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

  // Save fee structures to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        SMS_FEE_STRUCTURES_STORAGE_KEY,
        JSON.stringify(feeStructures)
      );
    } catch {
      // Ignore storage errors
    }
  }, [feeStructures]);

  // Save fee payments to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        SMS_FEE_PAYMENTS_STORAGE_KEY,
        JSON.stringify(feePayments)
      );
    } catch {
      // Ignore storage errors
    }
  }, [feePayments]);

  // Save fee concessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        SMS_FEE_CONCESSIONS_STORAGE_KEY,
        JSON.stringify(feeConcessions)
      );
    } catch {
      // Ignore storage errors
    }
  }, [feeConcessions]);

  // Save exams & exam marks to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SMS_EXAMS_STORAGE_KEY, JSON.stringify(exams));
    } catch {
      // Ignore storage errors
    }
  }, [exams]);

  useEffect(() => {
    try {
      localStorage.setItem(SMS_EXAM_MARKS_STORAGE_KEY, JSON.stringify(examMarks));
    } catch {
      // Ignore storage errors
    }
  }, [examMarks]);

  useEffect(() => {
    try {
      localStorage.setItem(SMS_TIMETABLE_STORAGE_KEY, JSON.stringify(timetableEntries));
    } catch {
      // Ignore storage errors
    }
  }, [timetableEntries]);

  useEffect(() => {
    try {
      localStorage.setItem(SMS_HOMEWORK_STORAGE_KEY, JSON.stringify(homeworkItems));
    } catch {
      // Ignore storage errors
    }
  }, [homeworkItems]);

  useEffect(() => {
    try {
      localStorage.setItem(SMS_CERTIFICATES_STORAGE_KEY, JSON.stringify(certificates));
    } catch {
      // Ignore storage errors
    }
  }, [certificates]);

  useEffect(() => {
    try {
      localStorage.setItem(SMS_GLOBAL_NOTICES_STORAGE_KEY, JSON.stringify(globalNotices));
    } catch {
      // Ignore storage errors
    }
  }, [globalNotices]);

  const setUserRole = (role: UserRole) => {
    setUserRoleState(role);
    try {
      localStorage.setItem(SMS_ROLE_STORAGE_KEY, role);
    } catch {
      // Ignore storage errors
    }
  };

  const refreshActiveSchoolClasses = async (overrideSchoolId?: string): Promise<ClassSection[]> => {
    const targetId = overrideSchoolId || activeSchool.id;
    if (!targetId || targetId === 'sch_seld_khi_01') return classes;
    if (demoMode) return classes;

    setLoadingClasses(true);
    try {
      const remoteClasses = await fetchClassesFromFirestore(targetId);
      setClasses(remoteClasses);
      return remoteClasses;
    } catch (err) {
      console.warn('[Firestore] Notice: Classes refresh error:', err);
      return classes;
    } finally {
      setLoadingClasses(false);
    }
  };

  // Sync Schools Directory & Registration Requests on mount / auth state / mode change
  useEffect(() => {
    if (demoMode) return;
    let cancelled = false;

    fetchSchoolsFromFirestore()
      .then((remoteSchools) => {
        if (cancelled) return;
        if (remoteSchools && remoteSchools.length > 0) {
          setRegisteredSchools(remoteSchools.filter((s) => s.id && s.id !== 'sch_seld_khi_01'));
        }
      })
      .catch((err) => console.warn('[Firestore] Notice: School fetch error:', err));

    fetchSchoolRegistrationRequestsFromFirestore()
      .then((remoteReqs) => {
        if (cancelled) return;
        if (remoteReqs && remoteReqs.length > 0) {
          setSchoolRegistrationRequests(remoteReqs);
        }
      })
      .catch((err) => console.warn('[Firestore] Notice: School requests fetch error:', err));

    if (isSuperAdmin) {
      fetchAllGlobalNoticesFromFirestore()
        .then((remoteNotices) => {
          if (!cancelled) setGlobalNotices(remoteNotices || []);
        })
        .catch((err) => console.warn('[Firestore] Notice: Global notices fetch error:', err));
    } else if (
      activeSchool.id &&
      activeSchool.id !== 'sch_seld_khi_01' &&
      currentUserProfile?.role !== 'parent' &&
      currentUserProfile?.role !== 'student'
    ) {
      fetchNoticesForSchoolFromFirestore(activeSchool.id)
        .then((remoteNotices) => {
          if (!cancelled) setGlobalNotices(remoteNotices || []);
        })
        .catch((err) => console.warn('[Firestore] Notice: School notices fetch error:', err));
    }

    return () => {
      cancelled = true;
    };
  }, [demoMode, authUserUid, currentUserProfile?.role, currentUserProfile?.status, isSuperAdmin, activeSchool.id]);

  // Cloud Firestore Sync for active school subcollections when not in demo mode
  useEffect(() => {
    if (demoMode) return;
    if (!activeSchool.id || activeSchool.id === 'sch_seld_khi_01') return;

    let cancelled = false;
    const schoolId = activeSchool.id;
    const isParentSession = currentUserProfile?.role === 'parent';
    const isStudentSession = currentUserProfile?.role === 'student';

    // Strict Child/Self-Scoped Read-Only Sync for Parent & Student Accounts
    if (isParentSession || isStudentSession) {
      const scopedStudentId = isStudentSession
        ? currentUserProfile?.studentId || ''
        : currentUserProfile?.childStudentId || '';
      if (!scopedStudentId) {
        setStudents([]);
        setClasses([]);
        setAttendanceRegisters({});
        setFeeStructures([]);
        setFeePayments([]);
        setFeeConcessions([]);
        setExams([]);
        setExamMarks([]);
        setTimetableEntries([]);
        setHomeworkItems([]);
        setCertificates([]);
        setStudentPortalLinks({});
        setLoadingClasses(false);
        return () => {
          cancelled = true;
        };
      }

      setLoadingClasses(true);

      const loadScopedPortalData = async () => {
        try {
          const studentDoc = await fetchSingleStudentFromFirestore(schoolId, scopedStudentId);
          if (cancelled) return;
          setStudents(studentDoc ? [studentDoc] : []);

          if (isStudentSession) {
            if (studentDoc?.classId) {
              fetchSingleClassFromFirestore(schoolId, studentDoc.classId)
                .then((clsDoc) => {
                  if (!cancelled) setClasses(clsDoc ? [clsDoc] : []);
                })
                .catch(() => {})
                .finally(() => {
                  if (!cancelled) setLoadingClasses(false);
                });

              fetchAttendanceFromFirestore(schoolId, studentDoc.classId)
                .then((remoteAttendance) => {
                  if (!cancelled) setAttendanceRegisters(remoteAttendance || {});
                })
                .catch(() => {});

              fetchTimetableFromFirestore(schoolId, studentDoc.classId)
                .then((remoteTimetable) => {
                  if (!cancelled) setTimetableEntries(remoteTimetable || []);
                })
                .catch(() => {});

              fetchHomeworkFromFirestore(schoolId, studentDoc.classId)
                .then((remoteHomework) => {
                  if (!cancelled) setHomeworkItems(remoteHomework || []);
                })
                .catch(() => {});

              fetchSingleFeeStructureFromFirestore(schoolId, studentDoc.classId)
                .then((feeStruct) => {
                  if (!cancelled) setFeeStructures(feeStruct ? [feeStruct] : []);
                })
                .catch(() => {});
            } else {
              setClasses([]);
              setAttendanceRegisters({});
              setTimetableEntries([]);
              setHomeworkItems([]);
              setFeeStructures([]);
              setLoadingClasses(false);
            }
          } else {
            fetchClassesFromFirestore(schoolId)
              .then((remoteClasses) => {
                if (!cancelled) setClasses(remoteClasses || []);
              })
              .catch(() => {})
              .finally(() => {
                if (!cancelled) setLoadingClasses(false);
              });

            fetchAttendanceFromFirestore(schoolId)
              .then((remoteAttendance) => {
                if (!cancelled) setAttendanceRegisters(remoteAttendance || {});
              })
              .catch(() => {});

            fetchTimetableFromFirestore(schoolId)
              .then((remoteTimetable) => {
                if (!cancelled) setTimetableEntries(remoteTimetable || []);
              })
              .catch(() => {});

            fetchHomeworkFromFirestore(schoolId)
              .then((remoteHomework) => {
                if (!cancelled) setHomeworkItems(remoteHomework || []);
              })
              .catch(() => {});

            fetchFeeStructuresFromFirestore(schoolId)
              .then((remoteStructures) => {
                if (!cancelled) setFeeStructures(remoteStructures || []);
              })
              .catch(() => {});
          }
        } catch {
          if (!cancelled) {
            setStudents([]);
            setLoadingClasses(false);
          }
        }
      };

      loadScopedPortalData();

      fetchChildFeePaymentsFromFirestore(schoolId, scopedStudentId)
        .then((remotePayments) => {
          if (!cancelled) setFeePayments(remotePayments || []);
        })
        .catch(() => {});

      fetchFeeConcessionsFromFirestore(schoolId)
        .then((remoteConcessions) => {
          if (!cancelled) setFeeConcessions(remoteConcessions || []);
        })
        .catch(() => {});

      fetchPublishedExamsFromFirestore(schoolId)
        .then((remoteExams) => {
          if (!cancelled) setExams(remoteExams || []);
        })
        .catch(() => {});

      fetchChildMarksFromFirestore(schoolId, scopedStudentId)
        .then((remoteMarks) => {
          if (!cancelled) setExamMarks(remoteMarks || []);
        })
        .catch(() => {});

      setCertificates([]);
      setTeachers([]);
      setJoinRequests([]);
      setStudentPortalLinks({});

      return () => {
        cancelled = true;
      };
    }

    // Strict Super Admin RBAC Isolation: Never query or expose tenant student/class/attendance/fee/exam subcollections
    if (isSuperAdmin) {
      setClasses([]);
      setTeachers([]);
      setStudents([]);
      setAttendanceRegisters({});
      setJoinRequests([]);
      setFeeStructures([]);
      setFeePayments([]);
      setFeeConcessions([]);
      setExams([]);
      setExamMarks([]);
      setTimetableEntries([]);
      setHomeworkItems([]);
      setCertificates([]);
      setLoadingClasses(false);
      return () => {
        cancelled = true;
      };
    }

    // Reset school-scoped collections before loading when switching schools so stale data doesn't linger
    setLoadingClasses(true);

    // 2. Sync classes for active school
    fetchClassesFromFirestore(schoolId)
      .then((remoteClasses) => {
        if (!cancelled) {
          setClasses(remoteClasses || []);
        }
      })
      .catch((err) => console.warn('[Firestore] Notice: Classes fetch error:', err))
      .finally(() => {
        if (!cancelled) setLoadingClasses(false);
      });

    // 2b. Sync teachers for active school
    fetchTeachersFromFirestore(schoolId)
      .then((remoteTeachers) => {
        if (!cancelled) {
          setTeachers(remoteTeachers || []);
        }
      })
      .catch((err) => console.warn('[Firestore] Notice: Teachers fetch error:', err));

    // 3. Sync students for active school
    fetchStudentsFromFirestore(schoolId)
      .then((remoteStudents) => {
        if (!cancelled) {
          setStudents(remoteStudents || []);
        }
      })
      .catch((err) => console.warn('[Firestore] Notice: Students fetch error:', err));

    // 4. Sync attendance for active school
    fetchAttendanceFromFirestore(schoolId)
      .then((remoteAttendance) => {
        if (!cancelled) {
          setAttendanceRegisters(remoteAttendance || {});
        }
      })
      .catch((err) => console.warn('[Firestore] Notice: Attendance fetch error:', err));

    // 5. Sync join requests for active school
    fetchJoinRequestsFromFirestore(schoolId)
      .then((remoteRequests) => {
        if (!cancelled) {
          setJoinRequests(remoteRequests || []);
        }
      })
      .catch((err) => console.warn('[Firestore] Notice: Join requests fetch error:', err));

    // 6. Sync fee structures for active school
    fetchFeeStructuresFromFirestore(schoolId)
      .then((remoteStructures) => {
        if (!cancelled) {
          setFeeStructures(remoteStructures || []);
        }
      })
      .catch((err) => console.warn('[Firestore] Notice: Fee structures fetch error:', err));

    // 7. Sync fee payments for active school
    fetchFeePaymentsFromFirestore(schoolId)
      .then((remotePayments) => {
        if (!cancelled) {
          setFeePayments(remotePayments || []);
        }
      })
      .catch((err) => console.warn('[Firestore] Notice: Fee payments fetch error:', err));

    // 8. Sync fee concessions & discount rules for active school
    fetchFeeConcessionsFromFirestore(schoolId)
      .then((remoteConcessions) => {
        if (!cancelled) {
          setFeeConcessions(remoteConcessions || []);
        }
      })
      .catch((err) => console.warn('[Firestore] Notice: Fee concessions fetch error:', err));

    // 9. Sync exams for active school
    fetchExamsFromFirestore(schoolId)
      .then((remoteExams) => {
        if (!cancelled) {
          setExams(remoteExams || []);
        }
      })
      .catch((err) => console.warn('[Firestore] Notice: Exams fetch error:', err));

    // 10. Sync exam marks for active school
    fetchMarksFromFirestore(schoolId)
      .then((remoteMarks) => {
        if (!cancelled) {
          setExamMarks(remoteMarks || []);
        }
      })
      .catch((err) => console.warn('[Firestore] Notice: Exam marks fetch error:', err));

    // 11. Sync Phase D: Timetable, Homework & Certificates
    fetchTimetableFromFirestore(schoolId)
      .then((remoteTimetable) => {
        if (!cancelled) {
          setTimetableEntries(remoteTimetable || []);
        }
      })
      .catch((err) => console.warn('[Firestore] Notice: Timetable fetch error:', err));

    fetchHomeworkFromFirestore(schoolId)
      .then((remoteHomework) => {
        if (!cancelled) {
          setHomeworkItems(remoteHomework || []);
        }
      })
      .catch((err) => console.warn('[Firestore] Notice: Homework fetch error:', err));

    fetchCertificatesFromFirestore(schoolId)
      .then((remoteCertificates) => {
        if (!cancelled) {
          setCertificates(remoteCertificates || []);
        }
      })
      .catch((err) => console.warn('[Firestore] Notice: Certificates fetch error:', err));

    fetchStudentPortalLinksForSchoolFromFirestore(schoolId)
      .then((linksMap) => {
        if (!cancelled) {
          setStudentPortalLinks(linksMap || {});
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [demoMode, activeSchool.id, authUserUid, currentUserProfile?.status, currentUserProfile?.role, currentUserProfile?.childStudentId, currentUserProfile?.studentId, isSuperAdmin]);

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
      semisCode: newSchool.semisCode,
      primaryAdminType,
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
      performSync('registerNewSchool', () =>
        Promise.all([
          saveSchoolToFirestore(newSchool),
          saveUserProfileToFirestore(newProfile),
        ])
      );
    }

    return newSchool;
  };

  // Submit School Registration Request (Requires Super Admin Approval)
  const submitSchoolRegistration = (
    schoolData: Omit<School, 'id' | 'adminUids' | 'status'> & {
      id?: string;
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
    },
    options?: {
      requestId?: string;
      skipFirestoreSync?: boolean;
    }
  ): SchoolRegistrationRequest => {
    const cleanSemis = (schoolData.semisCode || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const schoolId =
      schoolData.id ||
      (cleanSemis ? `sch_${cleanSemis}` : `sch_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`);
    const adminUid = adminProfile.uid || `uid_admin_${Date.now().toString(36)}`;
    const primaryAdminType = adminProfile.primaryAdminType || schoolData.primaryAdminType || 'principal';
    const primaryAdminName = schoolData.primaryAdminName || adminProfile.fullName;
    const primaryAdminEmail = schoolData.primaryAdminEmail || adminProfile.email;

    const newSchool: School = {
      ...schoolData,
      id: schoolId,
      adminUids: [adminUid],
      status: 'pending_approval',
      primaryAdminType,
      primaryAdminName,
      primaryAdminEmail,
      createdAt: new Date().toISOString(),
    };

    const requestId =
      options?.requestId ||
      `sch_req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const newRequest: SchoolRegistrationRequest = {
      id: requestId,
      schoolId: newSchool.id,
      schoolName: newSchool.name,
      semisCode: newSchool.semisCode,
      board: newSchool.board,
      district: newSchool.district,
      taluka: newSchool.taluka,
      activeAcademicYear: newSchool.activeAcademicYear,
      phone: newSchool.phone,
      email: newSchool.email,
      primaryAdminType,
      adminUid,
      adminName: primaryAdminName,
      adminEmail: primaryAdminEmail,
      adminPhone: adminProfile.phone,
      adminDesignation:
        adminProfile.designation ||
        (primaryAdminType === 'principal' ? 'Principal / Headmaster' : 'School Administrator'),
      requestedAt: new Date().toISOString(),
      status: 'pending',
    };

    setSchoolRegistrationRequests((prev) => [newRequest, ...prev.filter((r) => r.id !== requestId)]);
    setRegisteredSchools((prev) => [newSchool, ...prev.filter((s) => s.id !== newSchool.id)]);
    setActiveSchool(newSchool);

    const baseAdminProfile: UserProfile = {
      uid: adminUid,
      email: adminProfile.email,
      fullName: adminProfile.fullName,
      role: 'admin',
      primaryAdminType,
      status: 'pending',
      designation:
        adminProfile.designation ||
        (primaryAdminType === 'principal' ? 'Principal / Headmaster' : 'School Administrator'),
      phone: adminProfile.phone,
      assignedClassIds: [],
      isSuperAdmin: false,
      isAdmissionIncharge: false,
      createdAt: new Date().toISOString(),
    };

    const pendingProfile: UserProfile = {
      ...baseAdminProfile,
      schoolId: newSchool.id,
      schoolName: newSchool.name,
      semisCode: newSchool.semisCode,
    };

    setCurrentUserProfile(pendingProfile);
    setUserRole('admin');

    if (!demoMode && !options?.skipFirestoreSync) {
      performSync('submitSchoolRegistration', async () => {
        // Step 1: Ensure users/{uid} exists first
        await saveUserProfileToFirestore(baseAdminProfile);
        // Step 2: Create pending_approval school and registration request
        await Promise.all([
          saveSchoolToFirestore(newSchool),
          saveSchoolRegistrationRequestToFirestore(newRequest),
        ]);
        // Step 3: Link users/{uid} with schoolId, schoolName & semisCode
        await saveUserProfileToFirestore(pendingProfile);
      });
    }

    return newRequest;
  };

  // Super Admin Approves School Registration
  const approveSchoolRegistration = (requestId: string) => {
    const target = schoolRegistrationRequests.find((r) => r.id === requestId);
    if (!target) return;

    const existingSchool = registeredSchools.find((s) => s.id === target.schoolId);
    const activatedSchool: School = existingSchool
      ? {
          ...existingSchool,
          status: 'active',
          adminUids:
            target.adminUid && !(existingSchool.adminUids || []).includes(target.adminUid)
              ? [...(existingSchool.adminUids || []), target.adminUid]
              : existingSchool.adminUids || (target.adminUid ? [target.adminUid] : []),
          primaryAdminType: existingSchool.primaryAdminType || target.primaryAdminType || 'principal',
          primaryAdminName: existingSchool.primaryAdminName || target.adminName,
          primaryAdminEmail: existingSchool.primaryAdminEmail || target.adminEmail,
        }
      : {
          id: target.schoolId,
          name: target.schoolName,
          semisCode: target.semisCode,
          board: target.board,
          district: target.district,
          taluka: target.taluka,
          adminUids: target.adminUid ? [target.adminUid] : [],
          activeAcademicYear: target.activeAcademicYear || '2025-2026',
          phone: target.phone,
          email: target.email,
          status: 'active',
          primaryAdminType: target.primaryAdminType || 'principal',
          primaryAdminName: target.adminName,
          primaryAdminEmail: target.adminEmail,
          createdAt: target.requestedAt || new Date().toISOString(),
        };

    const updatedRequest: SchoolRegistrationRequest = {
      ...target,
      status: 'approved',
      reviewedAt: new Date().toISOString(),
      reviewedBy: 'Portal Super Admin',
    };

    setSchoolRegistrationRequests((prev) =>
      prev.map((r) => (r.id === requestId ? updatedRequest : r))
    );

    setRegisteredSchools((prev) => {
      const exists = prev.some((s) => s.id === activatedSchool.id);
      return exists
        ? prev.map((s) => (s.id === activatedSchool.id ? activatedSchool : s))
        : [activatedSchool, ...prev];
    });

    if (activeSchool.id === target.schoolId) {
      setActiveSchool(activatedSchool);
    }

    // If applicant is currently logged in, activate their admin profile
    if (
      currentUserProfile &&
      (currentUserProfile.uid === target.adminUid || currentUserProfile.email === target.adminEmail)
    ) {
      setCurrentUserProfile((prev) =>
        prev
          ? {
              ...prev,
              status: 'active',
              role: 'admin',
              schoolId: target.schoolId,
              schoolName: target.schoolName,
              semisCode: target.semisCode,
            }
          : null
      );
      setUserRole('admin');
    }

    if (!demoMode) {
      performSync('approveSchoolRegistration', () =>
        Promise.all([
          saveSchoolRegistrationRequestToFirestore(updatedRequest),
          saveSchoolToFirestore(activatedSchool),
          target.adminUid
            ? saveUserProfileToFirestore({
                uid: target.adminUid,
                email: target.adminEmail,
                fullName: target.adminName,
                role: 'admin',
                schoolId: target.schoolId,
                schoolName: target.schoolName,
                semisCode: target.semisCode,
                primaryAdminType: target.primaryAdminType || 'principal',
                status: 'active',
                designation: target.adminDesignation || 'Principal / Headmaster',
                phone: target.adminPhone,
                assignedClassIds: [],
                createdAt: target.requestedAt,
              })
            : Promise.resolve(true),
        ])
      );
    }
  };

  // Super Admin Rejects School Registration
  const rejectSchoolRegistration = (requestId: string, reason?: string) => {
    const target = schoolRegistrationRequests.find((r) => r.id === requestId);
    if (!target) return;

    const updatedRequest: SchoolRegistrationRequest = {
      ...target,
      status: 'rejected',
      reviewedAt: new Date().toISOString(),
      reviewedBy: 'Portal Super Admin',
      rejectionReason: reason || 'Administrative Policy Review / Non-Compliant Details',
    };

    setSchoolRegistrationRequests((prev) =>
      prev.map((r) => (r.id === requestId ? updatedRequest : r))
    );

    setRegisteredSchools((prev) =>
      prev.map((s) =>
        s.id === target.schoolId ? { ...s, status: 'suspended', suspendedReason: reason } : s
      )
    );

    if (
      currentUserProfile &&
      (currentUserProfile.uid === target.adminUid || currentUserProfile.email === target.adminEmail)
    ) {
      setCurrentUserProfile((prev) => (prev ? { ...prev, status: 'rejected' } : null));
    }

    if (!demoMode) {
      performSync('rejectSchoolRegistration', () =>
        saveSchoolRegistrationRequestToFirestore(updatedRequest)
      );
    }
  };

  // Submit join request as a Teacher
  const submitJoinRequest = (
    requestData: Omit<TeacherJoinRequest, 'id' | 'requestedAt' | 'status'>,
    options?: {
      requestId?: string;
      skipFirestoreSync?: boolean;
    }
  ) => {
    const id =
      options?.requestId ||
      `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const newReq: TeacherJoinRequest = {
      ...requestData,
      id,
      requestedAt: new Date().toISOString(),
      status: 'pending',
    };

    setJoinRequests((prev) => [newReq, ...prev.filter((r) => r.id !== id)]);

    // Update current user profile to pending
    const updatedProfile: UserProfile = {
      uid: requestData.uid,
      email: requestData.email,
      fullName: requestData.fullName,
      fatherName: requestData.fatherName,
      role: 'teacher',
      schoolId: requestData.schoolId,
      schoolName: requestData.schoolName,
      semisCode: requestData.semisCode,
      status: 'pending',
      designation: requestData.designation,
      cnic: requestData.cnic,
      phone: requestData.phone,
      assignedClassIds: [],
      createdAt: new Date().toISOString(),
    };

    setCurrentUserProfile(updatedProfile);
    setUserRole('teacher');

    if (!demoMode && !options?.skipFirestoreSync) {
      performSync('submitJoinRequest', async () => {
        await saveUserProfileToFirestore(updatedProfile);
        await saveJoinRequestToFirestore(requestData.schoolId, newReq);
      });
    }
  };

  // Admin approves a teacher join request and assigns class(es)
  const approveJoinRequest = (
    requestId: string,
    assignedClassIds: string[],
    assignAsClassTeacherFor?: string
  ) => {
    if (blockSchoolMutation('approveJoinRequest')) return;
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
      fatherName: target.fatherName,
      designation: target.designation,
      email: target.email,
      phone: target.phone,
      cnic: target.cnic,
      joiningDate: new Date().toISOString().split('T')[0],
      isAdmissionIncharge: false,
      status: 'active',
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
              fatherName: target.fatherName || prev.fatherName,
              semisCode: target.semisCode || prev.semisCode,
              cnic: target.cnic || prev.cnic,
              phone: target.phone || prev.phone,
              assignedClassIds,
            }
          : null
      );
      setUserRole('teacher');
    }

    // 5. Cloud Firestore persistence
    if (!demoMode && target.schoolId) {
      performSync('approveJoinRequest', () =>
        Promise.all([
          saveTeacherToFirestore(target.schoolId, newTeacher),
          saveJoinRequestToFirestore(target.schoolId, {
            ...target,
            status: 'approved',
            reviewedAt: new Date().toISOString(),
            assignedClassIds,
          }),
          target.uid
            ? saveUserProfileToFirestore({
                uid: target.uid,
                email: target.email,
                fullName: target.fullName,
                fatherName: target.fatherName,
                role: 'teacher',
                schoolId: target.schoolId,
                schoolName: target.schoolName,
                semisCode: target.semisCode,
                status: 'active',
                designation: target.designation,
                phone: target.phone,
                cnic: target.cnic,
                assignedClassIds,
                createdAt: target.requestedAt,
              })
            : Promise.resolve(true),
        ])
      );
    }
  };

  // Admin rejects a join request
  const rejectJoinRequest = (requestId: string) => {
    if (blockSchoolMutation('rejectJoinRequest')) return;
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

    if (!demoMode && target?.schoolId) {
      performSync('rejectJoinRequest', () =>
        saveJoinRequestToFirestore(target.schoolId, {
          ...target,
          status: 'rejected',
          reviewedAt: new Date().toISOString(),
        })
      );
    }
  };

  // Filter pending join requests for the active school
  const pendingJoinRequests = useMemo(() => {
    return joinRequests.filter(
      (r) => r.status === 'pending' && r.schoolId === activeSchool.id
    );
  }, [joinRequests, activeSchool.id]);

  // Update Teacher Profile (Admin can edit any teacher; teachers see their own)
  const updateTeacherProfile = (teacherId: string, updates: Partial<TeacherInfo>) => {
    if (blockSchoolMutation('updateTeacherProfile')) return;
    setTeachers((prev) =>
      prev.map((t) => (t.id === teacherId ? { ...t, ...updates } : t))
    );

    // If updating current logged in user's profile
    if (
      currentUserProfile &&
      (currentUserProfile.uid === teacherId || currentUserProfile.email === updates.email)
    ) {
      setCurrentUserProfile((prev) =>
        prev
          ? {
              ...prev,
              fullName: updates.name || prev.fullName,
              designation: updates.designation || prev.designation,
              phone: updates.phone || prev.phone,
              cnic: updates.cnic || prev.cnic,
              isAdmissionIncharge:
                updates.isAdmissionIncharge !== undefined
                  ? updates.isAdmissionIncharge
                  : prev.isAdmissionIncharge,
              assignedClassIds: updates.assignedClasses || prev.assignedClassIds,
            }
          : null
      );
    }

    if (!demoMode && activeSchool.id) {
      const existing = teachers.find((t) => t.id === teacherId);
      if (existing) {
        performSync('updateTeacherProfile', () =>
          saveTeacherToFirestore(activeSchool.id, { ...existing, ...updates })
        );
      }
    }
  };

  // Toggle Admission Incharge special role for a teacher
  const toggleAdmissionIncharge = (teacherId: string) => {
    if (blockSchoolMutation('toggleAdmissionIncharge')) return;
    const teacher = teachers.find((t) => t.id === teacherId);
    if (!teacher) return;
    const nextVal = !teacher.isAdmissionIncharge;
    updateTeacherProfile(teacherId, { isAdmissionIncharge: nextVal });
  };

  const addClass = (newClassData: Omit<ClassSection, 'id' | 'createdAt'>) => {
    if (blockSchoolMutation('addClass')) return;
    const id = `cls_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const newClass: ClassSection = {
      ...newClassData,
      id,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setClasses((prev) => [newClass, ...prev]);

    if (!demoMode && activeSchool.id) {
      performSync('addClass', () => saveClassToFirestore(activeSchool.id, newClass));
    }
  };

  const updateClass = (id: string, updated: Partial<ClassSection>) => {
    if (blockSchoolMutation('updateClass')) return;
    setClasses((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const merged = { ...c, ...updated };
          if (!demoMode && activeSchool.id) {
            performSync('updateClass', () => saveClassToFirestore(activeSchool.id, merged));
          }
          return merged;
        }
        return c;
      })
    );
  };

  const deleteClass = (id: string) => {
    if (blockSchoolMutation('deleteClass')) return;
    setClasses((prev) => prev.filter((c) => c.id !== id));
    if (!demoMode && activeSchool.id) {
      performSync('deleteClass', () => deleteClassFromFirestore(activeSchool.id, id));
    }
  };

  const syncParentLinkForStudent = (student: Student) => {
    if (demoMode || !activeSchool.id || !student.grNumber) return;
    const inviteCode = student.parentInviteCode || generateParentInviteCode(student.grNumber);
    const linkId = buildParentLinkId(activeSchool.id, student.grNumber);
    saveParentStudentLinkToFirestore({
      id: linkId,
      schoolId: activeSchool.id,
      schoolName: activeSchool.name,
      semisCode: activeSchool.semisCode,
      studentId: student.id,
      studentName: student.fullName,
      classId: student.classId,
      grade: student.grade,
      section: student.section,
      grNumber: student.grNumber.trim().toUpperCase(),
      parentEmail: student.parentEmail?.trim().toLowerCase() || '',
      guardianPhone: student.guardianPhone || '',
      inviteCode,
      claimedByUid: student.parentUid,
      status: student.parentUid ? 'linked' : 'available',
    }).catch((err) => console.warn('[ParentLink] Sync notice:', err));
  };

  const syncStudentLinkForStudent = (student: Student) => {
    if (demoMode || !activeSchool.id || !student.grNumber) return;
    const inviteCode = student.studentInviteCode || generateStudentInviteCode(student.grNumber);
    const linkId = buildParentLinkId(activeSchool.id, student.grNumber);
    const linkPayload: StudentPortalLink = {
      id: linkId,
      schoolId: activeSchool.id,
      schoolName: activeSchool.name,
      semisCode: activeSchool.semisCode,
      studentId: student.id,
      studentName: student.fullName,
      classId: student.classId,
      grade: student.grade,
      section: student.section,
      grNumber: student.grNumber.trim().toUpperCase(),
      studentEmail: student.studentEmail?.trim().toLowerCase() || '',
      inviteCode,
      claimedByUid: student.studentUid,
      status: student.studentUid ? 'linked' : 'available',
    };
    setStudentPortalLinks((prev) => ({
      ...prev,
      [student.id]: prev[student.id]?.claimedByUid
        ? { ...linkPayload, claimedByUid: prev[student.id].claimedByUid, status: 'linked' }
        : linkPayload,
    }));
    saveStudentPortalLinkToFirestore(linkPayload).catch((err) =>
      console.warn('[StudentLink] Sync notice:', err)
    );
  };

  const addStudent = (newStudentData: Omit<Student, 'id'>) => {
    if (blockSchoolMutation('addStudent')) return;
    const id = `std_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const inviteCode =
      newStudentData.parentInviteCode || generateParentInviteCode(newStudentData.grNumber);
    const studentInviteCode =
      newStudentData.studentInviteCode || generateStudentInviteCode(newStudentData.grNumber);
    const newStudent: Student = {
      ...newStudentData,
      id,
      parentInviteCode: inviteCode,
      parentEmail: newStudentData.parentEmail?.trim().toLowerCase() || undefined,
      studentInviteCode,
      studentEmail: newStudentData.studentEmail?.trim().toLowerCase() || undefined,
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
      performSync('addStudent', async () => {
        await saveStudentToFirestore(activeSchool.id, newStudent);
        syncParentLinkForStudent(newStudent);
        syncStudentLinkForStudent(newStudent);
      });
    }
  };

  const updateStudent = (id: string, updated: Partial<Student>) => {
    if (blockSchoolMutation('updateStudent')) return;
    const existing = students.find((s) => s.id === id);
    if (!existing) return;

    const oldClassId = existing.classId;
    const newClassId = updated.classId;

    const updatedStudent: Student = {
      ...existing,
      ...updated,
      parentInviteCode:
        updated.parentInviteCode ||
        existing.parentInviteCode ||
        generateParentInviteCode(updated.grNumber || existing.grNumber),
      parentEmail:
        updated.parentEmail !== undefined
          ? updated.parentEmail.trim().toLowerCase() || undefined
          : existing.parentEmail,
      studentInviteCode:
        updated.studentInviteCode ||
        existing.studentInviteCode ||
        generateStudentInviteCode(updated.grNumber || existing.grNumber),
      studentEmail:
        updated.studentEmail !== undefined
          ? updated.studentEmail.trim().toLowerCase() || undefined
          : existing.studentEmail,
    };

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
      performSync('updateStudent', async () => {
        await saveStudentToFirestore(activeSchool.id, updatedStudent);
        syncParentLinkForStudent(updatedStudent);
        syncStudentLinkForStudent(updatedStudent);
      });
    }
  };

  const deleteStudent = (id: string) => {
    if (blockSchoolMutation('deleteStudent')) return;
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
      performSync('deleteStudent', () => deleteStudentFromFirestore(activeSchool.id, id));
    }
  };

  // Save or update attendance register (keyed by "YYYY-MM-DD_{classId}")
  const saveAttendance = (attendance: DailyClassAttendance) => {
    if (blockSchoolMutation('saveAttendance')) return;
    setAttendanceRegisters((prev) => ({
      ...prev,
      [attendance.id]: attendance,
    }));

    if (!demoMode && activeSchool.id) {
      performSync('saveAttendance', () => saveAttendanceToFirestore(activeSchool.id, attendance));
    }
  };

  const getAttendance = (date: string, classId: string): DailyClassAttendance | undefined => {
    const id = `${date}_${classId}`;
    return attendanceRegisters[id];
  };

  // For Demo / Teacher View: Pick or construct active teacher safely
  const activeTeacher = useMemo<TeacherInfo>(() => {
    // If user has a real profile
    if (!demoMode && currentUserProfile) {
      const match = (teachers || []).find((t) => t.email === currentUserProfile.email || t.id === currentUserProfile.uid);
      if (match) return match;
      return {
        id: currentUserProfile.uid || 'current_user',
        name: currentUserProfile.fullName || 'Teacher',
        fatherName: currentUserProfile.fatherName,
        designation: currentUserProfile.designation || 'Teacher',
        email: currentUserProfile.email || '',
        phone: currentUserProfile.phone || '',
        cnic: currentUserProfile.cnic || '',
        joiningDate: currentUserProfile.joiningDate || new Date().toISOString().split('T')[0],
        assignedClasses: currentUserProfile.assignedClassIds || [],
      };
    }
    const fallback = (teachers && (teachers[1] || teachers[0])) || null;
    if (fallback) return fallback;
    return {
      id: 'default_teacher',
      name: 'Teacher',
      designation: 'Teacher',
      email: '',
      phone: '',
      cnic: '',
      joiningDate: '2025-01-01',
      assignedClasses: [],
    };
  }, [teachers, demoMode, currentUserProfile]);

  // Determine effective role: In Demo mode, userRoleState controls it; in Live mode, profile controls it
  const effectiveRole = useMemo<UserRole>(() => {
    if (demoMode) return userRole;
    if (currentUserProfile?.role === 'parent') {
      return 'parent';
    }
    if (currentUserProfile?.role === 'student') {
      return 'student';
    }
    const email = (currentUserProfile?.email || '').trim().toLowerCase();
    if (
      currentUserProfile?.isSuperAdmin ||
      currentUserProfile?.role === 'super-admin' ||
      email === 'owner@pakedu.com' ||
      userRole === 'super-admin'
    ) {
      return 'super-admin';
    }
    if (
      currentUserProfile?.role === 'admin' ||
      currentUserProfile?.role === 'principal' ||
      email === 'zulqarnainshah25@gmail.com' ||
      email === 'waleedshah1@gmail.com' ||
      userRole === 'admin' ||
      hasAdminCapabilities(null, currentUserProfile, registeredSchools)
    ) {
      return 'admin';
    }
    if (currentUserProfile?.role) {
      return currentUserProfile.role;
    }
    return userRole || 'teacher';
  }, [demoMode, userRole, currentUserProfile, registeredSchools]);

  // Filtered classes by role: Admins see all classes; Teachers see assigned; Parents & Students see own class only; Super Admin & Read-Only view blocked
  const filteredClassesForUser = useMemo(() => {
    if (effectiveRole === 'super-admin' || isImpersonating) {
      return [];
    }
    if (effectiveRole === 'admin' || effectiveRole === 'principal') {
      return classes || [];
    }
    if (effectiveRole === 'parent' || effectiveRole === 'student') {
      const targetStuId =
        effectiveRole === 'student'
          ? currentUserProfile?.studentId
          : currentUserProfile?.childStudentId;
      const scopedStu = students.find((s) => s.id === targetStuId) || students[0];
      if (!scopedStu) return [];
      return (classes || []).filter((c) => c.id === scopedStu.classId);
    }
    if (!classes || !Array.isArray(classes)) return [];
    // Teacher view: filter by teacher assigned classes safely
    return classes.filter(
      (c) =>
        Boolean(c) && (
          (activeTeacher?.id && c.classTeacherId === activeTeacher.id) ||
          (Array.isArray(activeTeacher?.assignedClasses) && activeTeacher.assignedClasses.includes(c.id)) ||
          (Array.isArray(currentUserProfile?.assignedClassIds) && currentUserProfile.assignedClassIds.includes(c.id))
        )
    );
  }, [classes, students, effectiveRole, isImpersonating, activeTeacher, currentUserProfile]);

  // Filtered students by role: Admins see all; Teachers see assigned classes; Parents & Students see ONLY their own linked student; Super Admin & Read-Only view blocked
  const filteredStudentsForUser = useMemo(() => {
    if (effectiveRole === 'super-admin' || isImpersonating) {
      return [];
    }
    if (effectiveRole === 'admin' || effectiveRole === 'principal') {
      return students || [];
    }
    if (effectiveRole === 'parent') {
      if (!currentUserProfile?.childStudentId) return [];
      return (students || []).filter((s) => s.id === currentUserProfile.childStudentId);
    }
    if (effectiveRole === 'student') {
      if (!currentUserProfile?.studentId) return [];
      return (students || []).filter((s) => s.id === currentUserProfile.studentId);
    }
    if (!students || !Array.isArray(students)) return [];
    const teacherClassIds = new Set((filteredClassesForUser || []).map((c) => c?.id).filter(Boolean));
    return students.filter((s) => s && teacherClassIds.has(s.classId));
  }, [students, effectiveRole, isImpersonating, filteredClassesForUser, currentUserProfile?.childStudentId, currentUserProfile?.studentId]);

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

  // Sync non-PII aggregated school analytics onto /schools/{schoolId}.analytics for Super Admin Platform Overview
  useEffect(() => {
    if (
      demoMode ||
      isSuperAdmin ||
      isImpersonating ||
      loadingClasses ||
      !activeSchool.id ||
      activeSchool.id === 'sch_seld_khi_01' ||
      currentUserProfile?.role === 'parent' ||
      currentUserProfile?.role === 'student' ||
      currentUserProfile?.status !== 'active'
    ) {
      return;
    }

    if (
      stats.totalStudents === 0 &&
      stats.totalClasses === 0 &&
      stats.totalTeachers === 0 &&
      feePayments.length === 0
    ) {
      return;
    }

    const totalRevenue = feePayments.reduce((sum, p) => sum + (Number(p.paidAmount) || 0), 0);
    const cur = activeSchool.analytics;
    const hasChanged =
      !cur ||
      cur.totalStudents !== stats.totalStudents ||
      cur.totalClasses !== stats.totalClasses ||
      cur.totalTeachers !== stats.totalTeachers ||
      cur.totalRevenue !== totalRevenue ||
      cur.todayAttendancePct !== todayAttendanceStats.overallPercentage;

    if (!hasChanged) return;

    const timer = setTimeout(() => {
      const nextAnalytics: SchoolAnalyticsSummary = {
        totalStudents: stats.totalStudents,
        totalClasses: stats.totalClasses,
        totalTeachers: stats.totalTeachers,
        totalRevenue,
        todayAttendancePct: todayAttendanceStats.overallPercentage,
        updatedAt: new Date().toISOString(),
      };
      setActiveSchool((prev) =>
        prev.id === activeSchool.id ? { ...prev, analytics: nextAnalytics } : prev
      );
      setRegisteredSchools((prev) =>
        prev.map((s) => (s.id === activeSchool.id ? { ...s, analytics: nextAnalytics } : s))
      );
      saveSchoolAnalyticsToFirestore(activeSchool.id, nextAnalytics).catch((err) =>
        console.warn('[Firestore] Notice: School analytics sync error:', err)
      );
    }, 1500);

    return () => clearTimeout(timer);
  }, [
    demoMode,
    isSuperAdmin,
    isImpersonating,
    loadingClasses,
    activeSchool.id,
    activeSchool.analytics,
    currentUserProfile?.role,
    currentUserProfile?.status,
    stats.totalStudents,
    stats.totalClasses,
    stats.totalTeachers,
    feePayments,
    todayAttendanceStats.overallPercentage,
  ]);

  // Permission Guard: Only School Admin or designated Admission Incharge can admit/edit students (never Super Admin / Read-Only)
  const canAdmitStudents = useMemo(() => {
    if (isSuperAdmin || isImpersonating || effectiveRole === 'super-admin') return false;
    if (effectiveRole === 'admin' || effectiveRole === 'principal') return true;
    if (effectiveRole === 'teacher') {
      const currentTeacher = teachers.find(
        (t) => t.email === currentUserProfile?.email || t.id === currentUserProfile?.uid
      );
      return Boolean(currentTeacher?.isAdmissionIncharge || currentUserProfile?.isAdmissionIncharge);
    }
    return false;
  }, [isSuperAdmin, isImpersonating, effectiveRole, teachers, currentUserProfile]);

  // Fee Management Methods & Permissions
  const saveClassFeeStructure = async (
    structure: Omit<ClassFeeStructure, 'schoolId'>
  ): Promise<boolean> => {
    if (blockSchoolMutation('saveFeeStructure')) return false;
    const fullStructure: ClassFeeStructure = {
      ...structure,
      schoolId: activeSchool.id || 'default_school',
      updatedAt: new Date().toISOString(),
    };

    setFeeStructures((prev) => {
      const index = prev.findIndex((f) => f.classId === structure.classId);
      if (index >= 0) {
        const copy = [...prev];
        copy[index] = fullStructure;
        return copy;
      }
      return [...prev, fullStructure];
    });

    if (!demoMode && activeSchool.id) {
      return await performSync('saveFeeStructure', () =>
        saveFeeStructureToFirestore(activeSchool.id, fullStructure)
      );
    }
    return true;
  };

  const deleteClassFeeStructure = async (classId: string): Promise<boolean> => {
    if (blockSchoolMutation('deleteFeeStructure')) return false;
    setFeeStructures((prev) => prev.filter((f) => f.classId !== classId && f.id !== classId));
    if (!demoMode && activeSchool.id) {
      return await performSync('deleteFeeStructure', () =>
        deleteFeeStructureFromFirestore(activeSchool.id, classId)
      );
    }
    return true;
  };

  const recordFeePayment = async (
    payment: Omit<FeePayment, 'schoolId'>
  ): Promise<boolean> => {
    if (blockSchoolMutation('saveFeePayment')) return false;
    const fullPayment: FeePayment = {
      ...payment,
      schoolId: activeSchool.id || 'default_school',
      updatedAt: new Date().toISOString(),
    };

    setFeePayments((prev) => {
      const index = prev.findIndex(
        (p) => p.id === payment.id || (p.studentId === payment.studentId && p.month === payment.month)
      );
      if (index >= 0) {
        const copy = [...prev];
        copy[index] = fullPayment;
        return copy;
      }
      return [fullPayment, ...prev];
    });

    if (!demoMode && activeSchool.id) {
      return await performSync('saveFeePayment', () =>
        saveFeePaymentToFirestore(activeSchool.id, fullPayment)
      );
    }
    return true;
  };

  const recordBulkFeePayments = async (
    payments: Array<Omit<FeePayment, 'schoolId'>>
  ): Promise<boolean> => {
    if (blockSchoolMutation('saveBulkFeePayments')) return false;
    if (!payments.length) return true;
    const schoolId = activeSchool.id || 'default_school';
    const fullPayments: FeePayment[] = payments.map((p) => ({
      ...p,
      schoolId,
      updatedAt: new Date().toISOString(),
    }));

    setFeePayments((prev) => {
      const next = [...prev];
      fullPayments.forEach((fp) => {
        const index = next.findIndex(
          (p) => p.id === fp.id || (p.studentId === fp.studentId && p.month === fp.month)
        );
        if (index >= 0) {
          next[index] = fp;
        } else {
          next.unshift(fp);
        }
      });
      return next;
    });

    if (!demoMode && activeSchool.id) {
      return await performSync('saveBulkFeePayments', () =>
        Promise.all(fullPayments.map((fp) => saveFeePaymentToFirestore(activeSchool.id, fp)))
      );
    }
    return true;
  };

  const saveFeeConcessionRule = async (
    rule: Omit<FeeConcessionRule, 'schoolId'>
  ): Promise<boolean> => {
    if (blockSchoolMutation('saveFeeConcession')) return false;
    const fullRule: FeeConcessionRule = {
      ...rule,
      schoolId: activeSchool.id || 'default_school',
      createdAt: rule.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setFeeConcessions((prev) => {
      const idx = prev.findIndex((r) => r.id === fullRule.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = fullRule;
        return copy;
      }
      return [fullRule, ...prev];
    });

    if (!demoMode && activeSchool.id) {
      return await performSync('saveFeeConcession', () =>
        saveFeeConcessionToFirestore(activeSchool.id, fullRule)
      );
    }
    return true;
  };

  const deleteFeeConcessionRule = async (concessionId: string): Promise<boolean> => {
    if (blockSchoolMutation('deleteFeeConcession')) return false;
    setFeeConcessions((prev) => prev.filter((r) => r.id !== concessionId));
    if (!demoMode && activeSchool.id) {
      return await performSync('deleteFeeConcession', () =>
        deleteFeeConcessionFromFirestore(activeSchool.id, concessionId)
      );
    }
    return true;
  };

  const applyStudentConcession = async (
    studentId: string,
    rule: FeeConcessionRule | null
  ): Promise<boolean> => {
    if (blockSchoolMutation('applyStudentConcession')) return false;
    const existing = students.find((s) => s.id === studentId);
    if (!existing) return false;

    const updates: Partial<Student> = rule
      ? {
          concessionId: rule.id,
          concessionTitle: rule.title,
          concessionType: rule.discountType,
          concessionValue: rule.value,
        }
      : {
          concessionId: '',
          concessionTitle: '',
          concessionType: 'percentage',
          concessionValue: 0,
        };

    const updatedStudent: Student = { ...existing, ...updates };

    setStudents((prev) => prev.map((s) => (s.id === studentId ? updatedStudent : s)));

    if (!demoMode && activeSchool.id) {
      return await performSync('applyStudentConcession', () =>
        saveStudentToFirestore(activeSchool.id, updatedStudent)
      );
    }
    return true;
  };

  const getFeeStructureForClass = (classId: string): ClassFeeStructure | undefined => {
    return feeStructures.find((f) => f.classId === classId);
  };

  const getStudentFeeStatus = (studentId: string, month: string): FeePayment | undefined => {
    return feePayments.find((p) => p.studentId === studentId && p.month === month);
  };

  const canManageFeeStructure = useMemo(() => {
    if (isSuperAdmin || isImpersonating || effectiveRole === 'super-admin') return false;
    return effectiveRole === 'admin' || effectiveRole === 'principal';
  }, [effectiveRole, isSuperAdmin, isImpersonating]);

  const canCollectFee = useMemo(() => {
    return canManageFeeStructure || canAdmitStudents;
  }, [canManageFeeStructure, canAdmitStudents]);

  // =========================================================================
  // Phase B: Exams & Results (Admin setup + Teacher assigned-class marks)
  // =========================================================================
  const canManageExams = useMemo(() => {
    if (isSuperAdmin || isImpersonating || effectiveRole === 'super-admin') return false;
    return effectiveRole === 'admin' || effectiveRole === 'principal';
  }, [effectiveRole, isSuperAdmin, isImpersonating]);

  const canEnterMarksForClass = (classId: string): boolean => {
    if (!classId || isSuperAdmin || isImpersonating || effectiveRole === 'super-admin') return false;
    if (canManageExams) return true;
    if (effectiveRole === 'teacher') {
      const assigned =
        activeTeacher?.assignedClasses?.length
          ? activeTeacher.assignedClasses
          : currentUserProfile?.assignedClassIds || [];
      return assigned.includes(classId);
    }
    return false;
  };

  const saveExam = async (examData: Omit<Exam, 'schoolId'>): Promise<boolean> => {
    if (blockSchoolMutation('saveExam')) return false;
    if (!canManageExams) {
      setSyncError({
        id: `rbac_exam_${Date.now()}`,
        message: 'Permission denied: Only School Administrators can create or edit exams.',
        reason: 'Only Admins can manage exam setup',
        operation: 'saveExam',
        retry: async () => {},
      });
      return false;
    }

    const targetSchoolId = activeSchool.id || 'default_school';
    const fullExam: Exam = {
      ...examData,
      schoolId: targetSchoolId,
      createdByUid: examData.createdByUid || currentUserProfile?.uid || 'admin',
      createdByName: examData.createdByName || currentUserProfile?.fullName || 'School Admin',
      createdAt: examData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setExams((prev) => {
      const idx = prev.findIndex((e) => e.id === fullExam.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = fullExam;
        return copy;
      }
      return [fullExam, ...prev];
    });

    if (!demoMode && activeSchool.id) {
      return await performSync('saveExam', () =>
        saveExamToFirestore(activeSchool.id, fullExam)
      );
    }
    return true;
  };

  const deleteExam = async (examId: string): Promise<boolean> => {
    if (blockSchoolMutation('deleteExam')) return false;
    if (!canManageExams) return false;
    const linkedMarks = examMarks.filter((m) => m.examId === examId);
    setExams((prev) => prev.filter((e) => e.id !== examId));
    setExamMarks((prev) => prev.filter((m) => m.examId !== examId));

    if (!demoMode && activeSchool.id) {
      return await performSync('deleteExam', async () => {
        await deleteExamFromFirestore(activeSchool.id, examId);
        await Promise.all(
          linkedMarks.map((m) => deleteStudentMarksFromFirestore(activeSchool.id, m.id))
        );
      });
    }
    return true;
  };

  const saveStudentMarks = async (
    marksData: Omit<StudentExamMarks, 'schoolId'>
  ): Promise<boolean> => {
    if (blockSchoolMutation('saveStudentMarks')) return false;
    if (!canEnterMarksForClass(marksData.classId)) {
      setSyncError({
        id: `rbac_marks_${Date.now()}`,
        message: 'Permission denied: Teachers can only enter marks for their assigned classes.',
        reason: 'Class not assigned to teacher',
        operation: 'saveStudentMarks',
        retry: async () => {},
      });
      return false;
    }

    const fullMarks: StudentExamMarks = {
      ...marksData,
      schoolId: activeSchool.id || 'default_school',
      enteredByUid: marksData.enteredByUid || currentUserProfile?.uid || 'faculty',
      enteredByName: marksData.enteredByName || currentUserProfile?.fullName || 'Teacher',
      enteredAt: marksData.enteredAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setExamMarks((prev) => {
      const idx = prev.findIndex((m) => m.id === fullMarks.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = fullMarks;
        return copy;
      }
      return [fullMarks, ...prev];
    });

    if (!demoMode && activeSchool.id) {
      return await performSync('saveStudentMarks', () =>
        saveStudentMarksToFirestore(activeSchool.id, fullMarks)
      );
    }
    return true;
  };

  const saveBulkStudentMarks = async (
    marksList: Array<Omit<StudentExamMarks, 'schoolId'>>
  ): Promise<boolean> => {
    if (blockSchoolMutation('saveBulkStudentMarks')) return false;
    if (marksList.length === 0) return true;
    const unauthorized = marksList.find((m) => !canEnterMarksForClass(m.classId));
    if (unauthorized) {
      setSyncError({
        id: `rbac_bulk_marks_${Date.now()}`,
        message: 'Permission denied: One or more classes are not assigned to your teaching profile.',
        reason: 'Assigned class scope required for marks entry',
        operation: 'saveBulkStudentMarks',
        retry: async () => {},
      });
      return false;
    }

    const nowIso = new Date().toISOString();
    const targetSchoolId = activeSchool.id || 'default_school';
    const fullRecords: StudentExamMarks[] = marksList.map((m) => ({
      ...m,
      schoolId: targetSchoolId,
      enteredByUid: m.enteredByUid || currentUserProfile?.uid || 'faculty',
      enteredByName: m.enteredByName || currentUserProfile?.fullName || 'Teacher',
      enteredAt: nowIso,
      updatedAt: nowIso,
    }));

    setExamMarks((prev) => {
      const next = [...prev];
      fullRecords.forEach((rec) => {
        const idx = next.findIndex((m) => m.id === rec.id);
        if (idx >= 0) {
          next[idx] = rec;
        } else {
          next.unshift(rec);
        }
      });
      return next;
    });

    if (!demoMode && activeSchool.id) {
      return await performSync('saveBulkStudentMarks', () =>
        Promise.all(fullRecords.map((rec) => saveStudentMarksToFirestore(activeSchool.id, rec)))
      );
    }
    return true;
  };

  const updateSchoolLogo = async (logoUrl: string): Promise<boolean> => {
    if (blockSchoolMutation('updateSchoolLogo')) return false;
    if (!canManageExams || !activeSchool.id) return false;
    const updatedSchool: School = { ...activeSchool, logoUrl };
    setActiveSchool(updatedSchool);
    setRegisteredSchools((prev) =>
      prev.map((s) => (s.id === updatedSchool.id ? updatedSchool : s))
    );
    if (!demoMode && activeSchool.id) {
      return await performSync('updateSchoolLogo', () =>
        saveSchoolToFirestore(updatedSchool)
      );
    }
    return true;
  };

  // Phase C & S: Parent & Student Portal Invite & Verification Linking
  const generatePortalInvite = async (
    portalType: 'parent' | 'student',
    studentId: string,
    contactEmail?: string
  ): Promise<{ inviteCode: string; inviteUrl: string } | null> => {
    if (blockSchoolMutation(portalType === 'parent' ? 'generateParentInvite' : 'generateStudentInvite')) {
      return null;
    }
    if (!canManageExams && !canAdmitStudents) return null;
    const existing = students.find((s) => s.id === studentId);
    if (!existing) return null;

    const isStudentPortal = portalType === 'student';
    const inviteCode = isStudentPortal
      ? existing.studentInviteCode || generateStudentInviteCode(existing.grNumber)
      : existing.parentInviteCode || generateParentInviteCode(existing.grNumber);
    const cleanedEmail =
      contactEmail !== undefined
        ? contactEmail.trim().toLowerCase() || undefined
        : isStudentPortal
        ? existing.studentEmail
        : existing.parentEmail;

    const updatedStudent: Student = isStudentPortal
      ? {
          ...existing,
          studentInviteCode: inviteCode,
          studentEmail: cleanedEmail,
        }
      : {
          ...existing,
          parentInviteCode: inviteCode,
          parentEmail: cleanedEmail,
        };

    setStudents((prev) => prev.map((s) => (s.id === studentId ? updatedStudent : s)));

    if (!demoMode && activeSchool.id) {
      const ok = await performSync(
        isStudentPortal ? 'generateStudentInvite' : 'generateParentInvite',
        async () => {
          await saveStudentToFirestore(activeSchool.id, updatedStudent);
          const baseLink = {
            id: buildParentLinkId(activeSchool.id, updatedStudent.grNumber),
            schoolId: activeSchool.id,
            schoolName: activeSchool.name,
            semisCode: activeSchool.semisCode,
            studentId: updatedStudent.id,
            studentName: updatedStudent.fullName,
            classId: updatedStudent.classId,
            grade: updatedStudent.grade,
            section: updatedStudent.section,
            grNumber: updatedStudent.grNumber.trim().toUpperCase(),
            inviteCode,
          };
          if (isStudentPortal) {
            const stuLink: StudentPortalLink = {
              ...baseLink,
              studentEmail: cleanedEmail || '',
              claimedByUid: updatedStudent.studentUid,
              status: updatedStudent.studentUid ? 'linked' : 'available',
            };
            await saveStudentPortalLinkToFirestore(stuLink);
            setStudentPortalLinks((prev) => ({
              ...prev,
              [updatedStudent.id]: prev[updatedStudent.id]?.claimedByUid
                ? { ...stuLink, claimedByUid: prev[updatedStudent.id].claimedByUid, status: 'linked' }
                : stuLink,
            }));
          } else {
            await saveParentStudentLinkToFirestore({
              ...baseLink,
              parentEmail: cleanedEmail || '',
              guardianPhone: updatedStudent.guardianPhone || '',
              claimedByUid: updatedStudent.parentUid,
              status: updatedStudent.parentUid ? 'linked' : 'available',
            });
          }
        }
      );
      if (!ok) return null;
    }

    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://pakedu.vercel.app';
    const paramName = isStudentPortal ? 'student_invite' : 'parent_invite';
    const inviteUrl = `${origin}/?${paramName}=${encodeURIComponent(inviteCode)}&school=${encodeURIComponent(activeSchool.id)}&gr=${encodeURIComponent(updatedStudent.grNumber)}`;
    return { inviteCode, inviteUrl };
  };

  const generateParentInviteForStudent = (studentId: string, parentEmail?: string) =>
    generatePortalInvite('parent', studentId, parentEmail);

  const generateStudentInviteForStudent = (studentId: string, studentEmail?: string) =>
    generatePortalInvite('student', studentId, studentEmail);

  const linkParentToStudent = async (params: {
    schoolId: string;
    grNumber: string;
    inviteCode?: string;
    phone?: string;
  }): Promise<UserProfile | null> => {
    const uid = currentUserProfile?.uid || authUserUid;
    if (!uid) return null;

    if (demoMode) {
      const targetStu = students.find(
        (s) => s.grNumber.trim().toUpperCase() === params.grNumber.trim().toUpperCase()
      );
      if (!targetStu) return null;
      const demoProfile: UserProfile = {
        ...currentUserProfile!,
        role: 'parent',
        status: 'active',
        schoolId: activeSchool.id,
        schoolName: activeSchool.name,
        semisCode: activeSchool.semisCode,
        childStudentId: targetStu.id,
        childGrNumber: targetStu.grNumber,
        childName: targetStu.fullName,
      };
      setCurrentUserProfile(demoProfile);
      setUserRole('parent');
      return demoProfile;
    }

    const claimedLink = await verifyAndClaimParentLink({
      schoolId: params.schoolId,
      grNumber: params.grNumber,
      uid,
      parentEmail: currentUserProfile?.email || undefined,
      parentPhone: params.phone || currentUserProfile?.phone,
      inviteCode: params.inviteCode,
    });

    const updatedParentProfile: UserProfile = {
      uid,
      email: currentUserProfile?.email || '',
      fullName: currentUserProfile?.fullName || 'Parent / Guardian',
      role: 'parent',
      schoolId: claimedLink.schoolId,
      schoolName: claimedLink.schoolName,
      semisCode: claimedLink.semisCode,
      status: 'active',
      phone: params.phone || currentUserProfile?.phone || '',
      assignedClassIds: [],
      isSuperAdmin: false,
      isAdmissionIncharge: false,
      childStudentId: claimedLink.studentId,
      childGrNumber: claimedLink.grNumber,
      childName: claimedLink.studentName,
      parentLinkId: claimedLink.id,
      linkedInviteCode: params.inviteCode?.trim().toUpperCase() || claimedLink.inviteCode,
      createdAt: currentUserProfile?.createdAt || new Date().toISOString(),
    };

    await saveUserProfileToFirestore(updatedParentProfile);
    setCurrentUserProfile(updatedParentProfile);
    setUserRole('parent');
    try {
      await authRefreshFn?.();
    } catch {
      // Non-fatal
    }
    return updatedParentProfile;
  };

  const linkStudentAccount = async (params: {
    schoolId: string;
    grNumber: string;
    inviteCode?: string;
  }): Promise<UserProfile | null> => {
    const uid = currentUserProfile?.uid || authUserUid;
    if (!uid) return null;

    if (demoMode) {
      const targetStu = students.find(
        (s) => s.grNumber.trim().toUpperCase() === params.grNumber.trim().toUpperCase()
      );
      if (!targetStu) return null;
      const demoProfile: UserProfile = {
        ...currentUserProfile!,
        role: 'student',
        status: 'active',
        schoolId: activeSchool.id,
        schoolName: activeSchool.name,
        semisCode: activeSchool.semisCode,
        studentId: targetStu.id,
        studentGrNumber: targetStu.grNumber,
        fullName: currentUserProfile?.fullName || targetStu.fullName,
      };
      setCurrentUserProfile(demoProfile);
      setUserRole('student');
      return demoProfile;
    }

    const claimedLink = await verifyAndClaimStudentLink({
      schoolId: params.schoolId,
      grNumber: params.grNumber,
      uid,
      studentEmail: currentUserProfile?.email || undefined,
      inviteCode: params.inviteCode,
    });

    const updatedStudentProfile: UserProfile = {
      uid,
      email: currentUserProfile?.email || '',
      fullName: currentUserProfile?.fullName || claimedLink.studentName || 'Student',
      role: 'student',
      schoolId: claimedLink.schoolId,
      schoolName: claimedLink.schoolName,
      semisCode: claimedLink.semisCode,
      status: 'active',
      assignedClassIds: [],
      isSuperAdmin: false,
      isAdmissionIncharge: false,
      studentId: claimedLink.studentId,
      studentGrNumber: claimedLink.grNumber,
      studentLinkId: claimedLink.id,
      linkedInviteCode: params.inviteCode?.trim().toUpperCase() || claimedLink.inviteCode,
      createdAt: currentUserProfile?.createdAt || new Date().toISOString(),
    };

    await saveUserProfileToFirestore(updatedStudentProfile);
    setCurrentUserProfile(updatedStudentProfile);
    setUserRole('student');
    try {
      await authRefreshFn?.();
    } catch {
      // Non-fatal
    }
    return updatedStudentProfile;
  };

  // =========================================================================
  // Phase D: Timetable, Homework & Certificates Management
  // =========================================================================
  const canManageTimetable = useMemo(() => {
    if (isSuperAdmin || isImpersonating || effectiveRole === 'super-admin') return false;
    return effectiveRole === 'admin' || effectiveRole === 'principal';
  }, [effectiveRole, isSuperAdmin, isImpersonating]);

  const canPostHomework = useMemo(() => {
    if (
      isSuperAdmin ||
      isImpersonating ||
      effectiveRole === 'super-admin' ||
      effectiveRole === 'parent' ||
      effectiveRole === 'student'
    ) {
      return false;
    }
    return canManageTimetable || effectiveRole === 'teacher';
  }, [effectiveRole, isSuperAdmin, isImpersonating, canManageTimetable]);

  const canManageCertificates = useMemo(() => {
    if (isSuperAdmin || isImpersonating || effectiveRole === 'super-admin') return false;
    return effectiveRole === 'admin' || effectiveRole === 'principal';
  }, [effectiveRole, isSuperAdmin, isImpersonating]);

  const saveTimetableEntry = async (
    entry: Omit<TimetableEntry, 'schoolId'>
  ): Promise<boolean> => {
    if (blockSchoolMutation('saveTimetableEntry')) return false;
    if (!canManageTimetable) return false;
    const targetSchoolId = activeSchool.id || 'default_school';
    const fullEntry: TimetableEntry = {
      ...entry,
      schoolId: targetSchoolId,
      createdAt: entry.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTimetableEntries((prev) => {
      const idx = prev.findIndex((t) => t.id === fullEntry.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = fullEntry;
        return copy;
      }
      return [fullEntry, ...prev];
    });
    if (!demoMode && activeSchool.id) {
      return await performSync('saveTimetableEntry', () =>
        saveTimetableEntryToFirestore(activeSchool.id, fullEntry)
      );
    }
    return true;
  };

  const deleteTimetableEntry = async (entryId: string): Promise<boolean> => {
    if (blockSchoolMutation('deleteTimetableEntry')) return false;
    if (!canManageTimetable) return false;
    setTimetableEntries((prev) => prev.filter((t) => t.id !== entryId));
    if (!demoMode && activeSchool.id) {
      return await performSync('deleteTimetableEntry', () =>
        deleteTimetableEntryFromFirestore(activeSchool.id, entryId)
      );
    }
    return true;
  };

  const saveHomework = async (item: Omit<HomeworkItem, 'schoolId'>): Promise<boolean> => {
    if (blockSchoolMutation('saveHomework')) return false;
    if (!canPostHomework) return false;
    if (
      !canManageTimetable &&
      filteredClassesForUser.length > 0 &&
      !filteredClassesForUser.some((c) => c.id === item.classId)
    ) {
      return false;
    }
    const targetSchoolId = activeSchool.id || 'default_school';
    const fullItem: HomeworkItem = {
      ...item,
      schoolId: targetSchoolId,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setHomeworkItems((prev) => {
      const idx = prev.findIndex((h) => h.id === fullItem.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = fullItem;
        return copy;
      }
      return [fullItem, ...prev];
    });
    if (!demoMode && activeSchool.id) {
      return await performSync('saveHomework', () =>
        saveHomeworkToFirestore(activeSchool.id, fullItem)
      );
    }
    return true;
  };

  const deleteHomework = async (homeworkId: string): Promise<boolean> => {
    if (blockSchoolMutation('deleteHomework')) return false;
    if (!canPostHomework) return false;
    const existing = homeworkItems.find((h) => h.id === homeworkId);
    if (
      existing &&
      !canManageTimetable &&
      existing.teacherId !== currentUserProfile?.uid &&
      existing.teacherId !== activeTeacher?.id
    ) {
      return false;
    }
    setHomeworkItems((prev) => prev.filter((h) => h.id !== homeworkId));
    if (!demoMode && activeSchool.id) {
      return await performSync('deleteHomework', () =>
        deleteHomeworkFromFirestore(activeSchool.id, homeworkId)
      );
    }
    return true;
  };

  const saveCertificate = async (
    cert: Omit<StudentCertificate, 'schoolId'>
  ): Promise<boolean> => {
    if (blockSchoolMutation('saveCertificate')) return false;
    if (!canManageCertificates) return false;
    const targetSchoolId = activeSchool.id || 'default_school';
    const fullCert: StudentCertificate = {
      ...cert,
      schoolId: targetSchoolId,
      createdAt: cert.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setCertificates((prev) => {
      const idx = prev.findIndex((c) => c.id === fullCert.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = fullCert;
        return copy;
      }
      return [fullCert, ...prev];
    });
    if (!demoMode && activeSchool.id) {
      return await performSync('saveCertificate', () =>
        saveCertificateToFirestore(activeSchool.id, fullCert)
      );
    }
    return true;
  };

  const deleteCertificate = async (certificateId: string): Promise<boolean> => {
    if (blockSchoolMutation('deleteCertificate')) return false;
    if (!canManageCertificates) return false;
    setCertificates((prev) => prev.filter((c) => c.id !== certificateId));
    if (!demoMode && activeSchool.id) {
      return await performSync('deleteCertificate', () =>
        deleteCertificateFromFirestore(activeSchool.id, certificateId)
      );
    }
    return true;
  };

  // =========================================================================
  // Global Platform Notice Board (Super Admin -> School Admins)
  // =========================================================================
  const unreadNoticesCount = useMemo(() => {
    if (!activeSchool.id) return 0;
    return globalNotices.filter((n) => {
      const targeted =
        n.targetType === 'all' || (n.targetSchoolIds || []).includes(activeSchool.id);
      if (!targeted) return false;
      return !Boolean((n.readBySchools || {})[activeSchool.id]);
    }).length;
  }, [globalNotices, activeSchool.id]);

  const publishGlobalNotice = async (noticeInput: {
    title: string;
    message: string;
    priority: 'high' | 'medium' | 'low';
    date: string;
    targetType: 'all' | 'specific';
    targetSchoolIds: string[];
  }): Promise<boolean> => {
    if (!isSuperAdmin && !demoMode) return false;
    const nowIso = new Date().toISOString();
    const newNotice: GlobalNotice = {
      id: `notice_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      title: noticeInput.title.trim(),
      message: noticeInput.message.trim(),
      priority: noticeInput.priority,
      date: noticeInput.date || nowIso.split('T')[0],
      targetType: noticeInput.targetType,
      targetSchoolIds: noticeInput.targetType === 'specific' ? noticeInput.targetSchoolIds : [],
      createdByUid: currentUserProfile?.uid || 'super_admin',
      createdByName: currentUserProfile?.fullName || 'Platform Super Admin',
      createdAt: nowIso,
      readBySchools: {},
    };
    setGlobalNotices((prev) => [newNotice, ...prev]);
    if (!demoMode) {
      return await performSync('publishGlobalNotice', () =>
        saveGlobalNoticeToFirestore(newNotice)
      );
    }
    return true;
  };

  const deleteGlobalNotice = async (noticeId: string): Promise<boolean> => {
    if (!isSuperAdmin && !demoMode) return false;
    setGlobalNotices((prev) => prev.filter((n) => n.id !== noticeId));
    if (!demoMode) {
      return await performSync('deleteGlobalNotice', () =>
        deleteGlobalNoticeFromFirestore(noticeId)
      );
    }
    return true;
  };

  const markNoticeAsRead = async (noticeId: string): Promise<boolean> => {
    if (
      !activeSchool.id ||
      isImpersonating ||
      (!demoMode && isSuperAdmin) ||
      effectiveRole === 'parent' ||
      effectiveRole === 'student'
    ) {
      return false;
    }
    const targetNotice = globalNotices.find((n) => n.id === noticeId);
    const existingReadBySchools = targetNotice?.readBySchools || {};
    setGlobalNotices((prev) =>
      prev.map((n) =>
        n.id === noticeId
          ? {
              ...n,
              readBySchools: {
                ...(n.readBySchools || {}),
                [activeSchool.id]: true,
              },
            }
          : n
      )
    );
    if (!demoMode) {
      return await performSync('markNoticeAsRead', () =>
        markGlobalNoticeAsReadInFirestore(noticeId, activeSchool.id, existingReadBySchools)
      );
    }
    return true;
  };

  return (
    <SmsContext.Provider
      value={{
        syncError,
        clearSyncError,
        isPendingSync,
        isOnline,
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
        schoolRegistrationRequests,
        pendingSchoolRegistrationRequests,
        submitSchoolRegistration,
        approveSchoolRegistration,
        rejectSchoolRegistration,
        joinRequests,
        pendingJoinRequests,
        submitJoinRequest,
        approveJoinRequest,
        rejectJoinRequest,
        classes,
        loadingClasses,
        refreshActiveSchoolClasses,
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
        updateTeacherProfile,
        toggleAdmissionIncharge,
        canAdmitStudents,
        feeStructures,
        feePayments,
        feeConcessions,
        saveClassFeeStructure,
        deleteClassFeeStructure,
        recordFeePayment,
        recordBulkFeePayments,
        saveFeeConcessionRule,
        deleteFeeConcessionRule,
        applyStudentConcession,
        getFeeStructureForClass,
        getStudentFeeStatus,
        canManageFeeStructure,
        canCollectFee,
        exams,
        examMarks,
        saveExam,
        deleteExam,
        saveStudentMarks,
        saveBulkStudentMarks,
        canManageExams,
        canEnterMarksForClass,
        updateSchoolLogo,
        generateParentInviteForStudent,
        linkParentToStudent,
        studentPortalLinks,
        generateStudentInviteForStudent,
        linkStudentAccount,
        timetableEntries,
        homeworkItems,
        certificates,
        saveTimetableEntry,
        deleteTimetableEntry,
        saveHomework,
        deleteHomework,
        saveCertificate,
        deleteCertificate,
        canManageTimetable,
        canPostHomework,
        canManageCertificates,
        isReadOnlyImpersonation,
        globalNotices,
        unreadNoticesCount,
        publishGlobalNotice,
        deleteGlobalNotice,
        markNoticeAsRead,
        attendanceRegisters,
        saveAttendance,
        getAttendance,
        todayAttendanceStats,
        stats,
      }}
    >
      {/* Cloud Sync Failure Toast Banner with Retry */}
      {syncError && (
        <div
          role="alert"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] max-w-2xl w-[94%] bg-red-600 text-white px-5 py-3.5 rounded-xl shadow-2xl border border-red-500/50 flex items-center justify-between gap-4 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="flex items-center gap-3 min-w-0">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-200" />
            <div className="truncate">
              <span className="font-bold">Cloud sync failed: </span>
              <span className="text-red-100">{syncError.reason}. </span>
              <span className="font-bold underline decoration-red-300">Your change is NOT saved.</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => syncError.retry()}
              className="px-3.5 py-1.5 bg-white text-red-700 hover:bg-red-50 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
            <button
              onClick={() => setSyncError(null)}
              className="p-1 hover:bg-red-700 rounded-md transition text-red-200 hover:text-white cursor-pointer"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Pending Sync / Offline Indicator */}
      {isPendingSync && !syncError && (
        <div
          className="fixed bottom-4 right-4 z-[9999] bg-amber-600 text-white px-4 py-2 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-semibold border border-amber-500 animate-in fade-in"
          title="You are offline. Changes are saved locally and will sync to the cloud automatically once reconnected."
        >
          <WifiOff className="w-4 h-4 text-amber-200 animate-pulse" />
          <span>Pending sync (Offline queue active)</span>
        </div>
      )}

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
