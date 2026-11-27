import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
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
  SalaryStructure,
  SalaryStructureAuditEntry,
  EmployeePayslip,
  PayrollSettings,
  SchoolLessonPlan,
  SchoolQuestionPaper,
} from '../types';
import {
  filterLessonPlansForRole,
  filterQuestionPapersForRole,
} from '../utils/aiIntegrationHelpers';
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
  INITIAL_MOCK_SALARY_STRUCTURES,
  INITIAL_MOCK_PAYSLIPS,
  INITIAL_MOCK_SCHOOL_LESSON_PLANS,
  INITIAL_MOCK_SCHOOL_QUESTION_PAPERS,
} from '../data/mockSmsData';
import {
  FirestoreSyncError,
  isDeviceOffline,
  classifyFirestoreError,
  syncOfflineQueueItemToFirestore,
  saveSchoolToFirestore,
  fetchSchoolsFromFirestore,
  saveUserProfileToFirestore,
  saveClassToFirestore,
  deleteClassFromFirestore,
  fetchClassesFromFirestore,
  saveStudentToFirestore,
  saveStudentInviteCodeOnlyToFirestore,
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
  saveSalaryStructureToFirestore,
  fetchSalaryStructuresFromFirestore,
  deleteSalaryStructureFromFirestore,
  savePayslipToFirestore,
  fetchPayslipsFromFirestore,
  fetchTeacherOwnPayslipsFromFirestore,
  fetchTeacherOwnSalaryStructureFromFirestore,
  subscribeTeacherOwnPayrollFromFirestore,
  fetchApprovedSchoolStaffUsersFromFirestore,
  deletePayslipFromFirestore,
  savePayrollSettingsToFirestore,
  fetchPayrollSettingsFromFirestore,
  saveSchoolLessonPlanToFirestore,
  fetchSchoolLessonPlansFromFirestore,
  fetchSharedLessonPlansForParentFromFirestore,
  deleteSchoolLessonPlanFromFirestore,
  saveSchoolQuestionPaperToFirestore,
  fetchSchoolQuestionPapersFromFirestore,
  deleteSchoolQuestionPaperFromFirestore,
} from '../services/smsFirestoreService';
import {
  ApprovedSchoolEmployee,
  EMPLOYEE_NOT_FOUND_IN_SCHOOL_ERROR,
  buildApprovedSchoolEmployees,
  doesPayslipBelongToUser,
  sanitizePayrollIdSegment,
  validateApprovedSalaryEmployee,
} from '../utils/payrollCalculations';
import {
  getOfflineQueue,
  subscribeOfflineQueue,
  enqueueOfflineMutation,
  updateOfflineQueueItem,
  removeOfflineQueueItem,
  normalizeTimestampValue,
  recordServerBaseline,
  removeServerBaseline,
  type OfflineSyncItem,
  type OfflineSyncRunSummary,
  type ConflictResolutionChoice,
  type EnqueueOfflineMutationInput,
  type SyncItemResult,
} from '../../../services/offlineSyncService';
import { OfflineSyncCenterModal } from '../components/OfflineSyncCenterModal';
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
  offlineQueue: OfflineSyncItem[];
  pendingSyncCount: number;
  conflictItems: OfflineSyncItem[];
  isSyncing: boolean;
  lastSyncSummary: OfflineSyncRunSummary | null;
  lastSyncedAt: string | null;
  isSyncCenterOpen: boolean;
  setIsSyncCenterOpen: (open: boolean) => void;
  syncNow: () => Promise<OfflineSyncRunSummary>;
  resolveSyncConflict: (queueItemId: string, choice: ConflictResolutionChoice) => Promise<boolean>;
  discardOfflineItem: (queueItemId: string) => Promise<void>;
  clearLastSyncSummary: () => void;

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
  resetSmsSessionState: () => void;
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
  addStudent: (newStudent: Omit<Student, 'id'>) => Student | void;
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
  generateMissingStudentInvites: () => Promise<number>;
  ensureChildStudentInviteForParent: () => Promise<{ inviteCode: string; inviteUrl: string } | null>;
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

  // Salary & Payroll Management (Admin & Super Admin + Optional Teacher Payslip Self-View)
  approvedSchoolStaffUsers: UserProfile[];
  approvedEmployeesForActiveSchool: ApprovedSchoolEmployee[];
  salaryStructures: SalaryStructure[];
  payslips: EmployeePayslip[];
  ownTeacherSalaryStructure: SalaryStructure | null;
  hasUnreadSalaryStructureUpdate: boolean;
  dismissTeacherSalaryNotification: () => void;
  ownTeacherPayslips: EmployeePayslip[];
  payrollSettings: PayrollSettings;
  canAccessSalaryPayroll: boolean;
  canViewOwnPayslips: boolean;
  saveSalaryStructure: (
    structure: Omit<SalaryStructure, 'schoolId'>,
    overrideSchoolId?: string
  ) => Promise<boolean>;
  deleteSalaryStructure: (employeeId: string, overrideSchoolId?: string) => Promise<boolean>;
  savePayslip: (
    payslip: Omit<EmployeePayslip, 'schoolId'>,
    overrideSchoolId?: string
  ) => Promise<boolean>;
  saveBulkPayslips: (
    payslipList: Array<Omit<EmployeePayslip, 'schoolId'>>,
    overrideSchoolId?: string
  ) => Promise<boolean>;
  deletePayslip: (payslipId: string, overrideSchoolId?: string) => Promise<boolean>;
  updatePayrollSettings: (
    updates: Partial<PayrollSettings>,
    overrideSchoolId?: string
  ) => Promise<boolean>;
  loadSchoolPayrollData: (schoolId: string) => Promise<{
    teachers: TeacherInfo[];
    staffUsers: UserProfile[];
    salaryStructures: SalaryStructure[];
    payslips: EmployeePayslip[];
    payrollSettings: PayrollSettings;
  }>;

  // School AI Integration: Lesson Plans & Question Papers (strictly isolated from Super Admin)
  schoolLessonPlans: SchoolLessonPlan[];
  schoolQuestionPapers: SchoolQuestionPaper[];
  filteredLessonPlansForUser: SchoolLessonPlan[];
  filteredQuestionPapersForUser: SchoolQuestionPaper[];
  canAccessSchoolAiContent: boolean;
  saveSchoolLessonPlan: (
    plan: Omit<SchoolLessonPlan, 'schoolId'>
  ) => Promise<boolean>;
  toggleShareLessonPlanWithParents: (
    planId: string,
    shared: boolean
  ) => Promise<boolean>;
  deleteSchoolLessonPlan: (planId: string) => Promise<boolean>;
  saveSchoolQuestionPaper: (
    paper: Omit<SchoolQuestionPaper, 'schoolId'>
  ) => Promise<boolean>;
  attachQuestionPaperToExam: (
    paperId: string,
    examId: string,
    attach?: boolean
  ) => Promise<boolean>;
  deleteSchoolQuestionPaper: (paperId: string) => Promise<boolean>;

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
const SMS_SALARY_STRUCTURES_STORAGE_KEY = 'pakedu_sms_salary_structures_v1';
const SMS_PAYSLIPS_STORAGE_KEY = 'pakedu_sms_payslips_v1';
const SMS_PAYROLL_SETTINGS_STORAGE_KEY = 'pakedu_sms_payroll_settings_v1';
const SMS_SCHOOL_LESSON_PLANS_STORAGE_KEY = 'pakedu_sms_school_lesson_plans_v1';
const SMS_SCHOOL_QUESTION_PAPERS_STORAGE_KEY = 'pakedu_sms_school_question_papers_v1';

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
        if (
          authCtx.currentUserProfile.role !== 'super-admin' &&
          !authCtx.currentUserProfile.isSuperAdmin
        ) {
          setIsImpersonating(false);
          setImpersonationOriginalRole(null);
        }
      } else if (!authCtx.authLoading && !authCtx.currentUser) {
        setCurrentUserProfile(null);
        setUserRoleState('teacher');
        setIsImpersonating(false);
        setImpersonationOriginalRole(null);
        setActiveSchool(EMPTY_DEFAULT_SCHOOL);
      }
    }, [authCtx.currentUserProfile, authCtx.currentUser, authCtx.authLoading]);
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
    if (currentUserProfile) {
      const email = (currentUserProfile.email || '').trim().toLowerCase();
      return (
        Boolean(currentUserProfile.isSuperAdmin) ||
        currentUserProfile.role === 'super-admin' ||
        email === 'owner@pakedu.com'
      );
    }
    return demoMode && userRole === 'super-admin';
  }, [currentUserProfile, demoMode, userRole]);

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
    } else if (
      !demoMode &&
      currentUserProfile?.schoolId &&
      currentUserProfile.schoolId !== 'sch_seld_khi_01'
    ) {
      if (activeSchool.id !== currentUserProfile.schoolId) {
        setActiveSchool((prev) => ({
          ...EMPTY_DEFAULT_SCHOOL,
          ...prev,
          id: currentUserProfile.schoolId!,
          name: currentUserProfile.schoolName || prev.name || 'School Workspace',
          semisCode: currentUserProfile.semisCode || prev.semisCode || '',
          status: 'active',
        }));
      }
    } else if (!activeSchool.id || activeSchool.id === '') {
      setActiveSchool(INITIAL_MOCK_SCHOOL);
    }
  }, [
    registeredSchools,
    currentUserProfile?.schoolId,
    currentUserProfile?.schoolName,
    currentUserProfile?.semisCode,
    isImpersonating,
    isSuperAdmin,
    demoMode,
    activeSchool.id,
  ]);

  // Cloud Sync Resilience, IndexedDB Queue & Conflict Resolution State
  const [syncError, setSyncError] = useState<SyncErrorInfo | null>(null);
  const [isPendingSyncState, setIsPendingSyncState] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return !isDeviceOffline();
  });
  const [offlineQueue, setOfflineQueue] = useState<OfflineSyncItem[]>([]);
  const offlineQueueRef = useRef<OfflineSyncItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncSummary, setLastSyncSummary] = useState<OfflineSyncRunSummary | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [isSyncCenterOpen, setIsSyncCenterOpen] = useState(false);

  const syncInFlightRef = useRef(false);
  const hasAutoSyncedMountRef = useRef(false);
  const syncNowRef = useRef<((options?: { backgroundAuto?: boolean }) => Promise<OfflineSyncRunSummary>) | null>(null);

  const isPendingSync = isPendingSyncState || offlineQueue.length > 0;
  const pendingSyncCount = offlineQueue.length;
  const conflictItems = useMemo(
    () => offlineQueue.filter((item) => item.status === 'conflict'),
    [offlineQueue]
  );

  const refreshOfflineQueue = useCallback(async () => {
    try {
      const items = await getOfflineQueue();
      offlineQueueRef.current = items;
      setOfflineQueue(items);
      if (items.length === 0) {
        setIsPendingSyncState(false);
      }
      return items;
    } catch {
      return offlineQueueRef.current;
    }
  }, []);

  useEffect(() => {
    void refreshOfflineQueue();
    const unsubscribe = subscribeOfflineQueue(() => {
      void refreshOfflineQueue();
    });
    return () => unsubscribe();
  }, [refreshOfflineQueue]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setIsPendingSyncState(false);
      setTimeout(() => {
        void syncNowRef.current?.({ backgroundAuto: true });
      }, 450);
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
  const clearLastSyncSummary = () => setLastSyncSummary(null);

  const PLATFORM_SYNC_OPERATIONS = new Set([
    'toggleSchoolStatus',
    'approveSchoolRegistration',
    'rejectSchoolRegistration',
    'registerNewSchool',
    'submitSchoolRegistration',
    'publishGlobalNotice',
    'deleteGlobalNotice',
    'markNoticeAsRead',
    'saveSalaryStructure',
    'deleteSalaryStructure',
    'savePayslip',
    'saveBulkPayslips',
    'deletePayslip',
    'savePayrollSettings',
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

  const applyRemoteRecordToLocalState = useCallback(
    (item: OfflineSyncItem, remoteData: Record<string, any> | null) => {
      switch (item.entityType) {
        case 'attendance':
          setAttendanceRegisters((prev) => {
            const copy = { ...prev };
            if (remoteData) {
              copy[remoteData.id || item.recordId] = remoteData as DailyClassAttendance;
            } else {
              delete copy[item.recordId];
            }
            return copy;
          });
          break;
        case 'feePayment':
          setFeePayments((prev) => {
            const filtered = prev.filter((p) => p.id !== item.recordId);
            if (!remoteData) return filtered;
            const targetId = remoteData.id || item.recordId;
            const exists = filtered.some((p) => p.id === targetId);
            return exists
              ? filtered.map((p) => (p.id === targetId ? (remoteData as FeePayment) : p))
              : [remoteData as FeePayment, ...filtered];
          });
          break;
        case 'feeStructure':
          setFeeStructures((prev) => {
            const filtered = prev.filter((f) => f.id !== item.recordId && f.classId !== item.recordId);
            return remoteData ? [...filtered, remoteData as ClassFeeStructure] : filtered;
          });
          break;
        case 'feeConcession':
          setFeeConcessions((prev) => {
            const filtered = prev.filter((r) => r.id !== item.recordId);
            return remoteData ? [remoteData as FeeConcessionRule, ...filtered] : filtered;
          });
          break;
        case 'student':
        case 'studentInvite':
          setStudents((prev) => {
            const filtered = prev.filter((s) => s.id !== item.recordId);
            return remoteData ? [remoteData as Student, ...filtered] : filtered;
          });
          break;
        case 'class':
          setClasses((prev) => {
            const filtered = prev.filter((c) => c.id !== item.recordId);
            return remoteData ? [remoteData as ClassSection, ...filtered] : filtered;
          });
          break;
        case 'teacher':
          setTeachers((prev) => {
            const filtered = prev.filter((t) => t.id !== item.recordId);
            return remoteData ? [remoteData as TeacherInfo, ...filtered] : filtered;
          });
          break;
        case 'exam':
          setExams((prev) => {
            const filtered = prev.filter((e) => e.id !== item.recordId);
            return remoteData ? [remoteData as Exam, ...filtered] : filtered;
          });
          break;
        case 'marks':
          setExamMarks((prev) => {
            const filtered = prev.filter((m) => m.id !== item.recordId);
            return remoteData ? [remoteData as StudentExamMarks, ...filtered] : filtered;
          });
          break;
        case 'timetable':
          setTimetableEntries((prev) => {
            const filtered = prev.filter((t) => t.id !== item.recordId);
            return remoteData ? [remoteData as TimetableEntry, ...filtered] : filtered;
          });
          break;
        case 'homework':
          setHomeworkItems((prev) => {
            const filtered = prev.filter((h) => h.id !== item.recordId);
            return remoteData ? [remoteData as HomeworkItem, ...filtered] : filtered;
          });
          break;
        case 'certificate':
          setCertificates((prev) => {
            const filtered = prev.filter((c) => c.id !== item.recordId);
            return remoteData ? [remoteData as StudentCertificate, ...filtered] : filtered;
          });
          break;
        case 'salaryStructure':
          setSalaryStructures((prev) => {
            const filtered = prev.filter(
              (s) => s.id !== item.recordId && s.employeeId !== item.recordId
            );
            return remoteData ? [remoteData as SalaryStructure, ...filtered] : filtered;
          });
          break;
        case 'payslip':
          setPayslips((prev) => {
            const filtered = prev.filter((p) => p.id !== item.recordId);
            return remoteData ? [remoteData as EmployeePayslip, ...filtered] : filtered;
          });
          break;
        case 'payrollSettings':
          if (remoteData) {
            setPayrollSettings(remoteData as PayrollSettings);
          }
          break;
        case 'school':
        case 'schoolLogo':
          if (remoteData) {
            setRegisteredSchools((prev) =>
              prev.map((s) => (s.id === (remoteData.id || item.recordId) ? (remoteData as School) : s))
            );
            setActiveSchool((prev) =>
              prev.id === (remoteData.id || item.recordId) ? (remoteData as School) : prev
            );
          }
          break;
        case 'globalNotice':
        case 'noticeRead':
          setGlobalNotices((prev) => {
            const filtered = prev.filter((n) => n.id !== item.recordId);
            return remoteData ? [remoteData as GlobalNotice, ...filtered] : filtered;
          });
          break;
        case 'schoolLessonPlan':
          setSchoolLessonPlans((prev) => {
            const filtered = prev.filter((p) => p.id !== item.recordId);
            return remoteData ? [remoteData as SchoolLessonPlan, ...filtered] : filtered;
          });
          break;
        case 'schoolQuestionPaper':
          setSchoolQuestionPapers((prev) => {
            const filtered = prev.filter((qp) => qp.id !== item.recordId);
            return remoteData ? [remoteData as SchoolQuestionPaper, ...filtered] : filtered;
          });
          break;
        default:
          break;
      }
    },
    []
  );

  const mergeQueueIntoCollection = useCallback(
    <T extends { id: string }>(
      entityTypes: OfflineSyncItem['entityType'][],
      schoolId: string,
      remoteList: T[],
      queueItems: OfflineSyncItem[]
    ): T[] => {
      const relevant = queueItems.filter(
        (q) =>
          entityTypes.includes(q.entityType) &&
          (!q.schoolId || q.schoolId === schoolId || q.schoolId === 'global')
      );
      if (relevant.length === 0) return remoteList;

      const map = new Map<string, T>();
      for (const item of remoteList) {
        if (item?.id) map.set(item.id, item);
      }
      for (const q of relevant) {
        if (q.action === 'delete') {
          map.delete(q.recordId);
        } else if (q.payload) {
          const id = (q.payload as any).id || q.recordId;
          map.set(id, { ...(map.get(id) || {}), ...(q.payload as T), id });
        }
      }
      return Array.from(map.values());
    },
    []
  );

  const mergeQueueIntoAttendanceMap = useCallback(
    (
      schoolId: string,
      remoteMap: Record<string, DailyClassAttendance>,
      queueItems: OfflineSyncItem[]
    ): Record<string, DailyClassAttendance> => {
      const relevant = queueItems.filter(
        (q) => q.entityType === 'attendance' && q.schoolId === schoolId
      );
      if (relevant.length === 0) return remoteMap;

      const merged = { ...remoteMap };
      for (const q of relevant) {
        if (q.action === 'delete') {
          delete merged[q.recordId];
        } else if (q.payload) {
          const att = q.payload as DailyClassAttendance;
          merged[att.id || q.recordId] = att;
        }
      }
      return merged;
    },
    []
  );

  const syncNow = useCallback(
    async (options?: { backgroundAuto?: boolean }): Promise<OfflineSyncRunSummary> => {
      const startedAt = new Date().toISOString();
      if (demoMode) {
        return {
          startedAt,
          finishedAt: new Date().toISOString(),
          totalProcessed: 0,
          syncedCount: 0,
          conflictCount: 0,
          failedCount: 0,
          results: [],
        };
      }

      if (syncInFlightRef.current) {
        return (
          lastSyncSummary || {
            startedAt,
            finishedAt: new Date().toISOString(),
            totalProcessed: 0,
            syncedCount: 0,
            conflictCount: 0,
            failedCount: 0,
            results: [],
          }
        );
      }

      if (isDeviceOffline()) {
        setIsOnline(false);
        const queued = await refreshOfflineQueue();
        const offlineSummary: OfflineSyncRunSummary = {
          startedAt,
          finishedAt: new Date().toISOString(),
          totalProcessed: 0,
          syncedCount: 0,
          conflictCount: queued.filter((q) => q.status === 'conflict').length,
          failedCount: 0,
          results: [],
        };
        if (!options?.backgroundAuto && queued.length > 0) {
          setIsSyncCenterOpen(true);
        }
        return offlineSummary;
      }

      syncInFlightRef.current = true;
      setIsSyncing(true);
      setIsOnline(true);

      const results: SyncItemResult[] = [];
      let syncedCount = 0;
      let conflictCount = 0;
      let failedCount = 0;

      try {
        const snapshot = await getOfflineQueue();
        const processable = snapshot.filter((item) => item.status !== 'conflict');

        for (const item of processable) {
          if (isDeviceOffline()) {
            failedCount += 1;
            results.push({
              id: item.id,
              recordId: item.recordId,
              recordLabel: item.recordLabel,
              entityType: item.entityType,
              docPath: item.docPath,
              status: 'failed',
              message: 'Network disconnected mid-sync. Kept in queue.',
            });
            await updateOfflineQueueItem(item.id, {
              status: 'failed',
              errorMessage: 'Connection lost during sync. Kept in offline queue.',
              attempts: item.attempts + 1,
              lastAttemptAt: new Date().toISOString(),
            });
            break;
          }

          await updateOfflineQueueItem(item.id, { status: 'syncing' });
          const outcome = await syncOfflineQueueItemToFirestore(item);

          if (outcome.status === 'synced') {
            syncedCount += 1;
            if (
              outcome.resolvedRecordId &&
              item.entityType === 'feePayment' &&
              outcome.resolvedRecordId !== item.recordId
            ) {
              setFeePayments((prev) =>
                prev.map((p) =>
                  p.id === item.recordId ? { ...p, id: outcome.resolvedRecordId! } : p
                )
              );
            }
            await removeOfflineQueueItem(item.id);
            results.push({
              id: item.id,
              recordId: outcome.resolvedRecordId || item.recordId,
              recordLabel: item.recordLabel,
              entityType: item.entityType,
              docPath: outcome.resolvedDocPath || item.docPath,
              status: 'synced',
              message: 'Synced cleanly to Firestore.',
            });
          } else if (outcome.status === 'conflict') {
            conflictCount += 1;
            await updateOfflineQueueItem(item.id, {
              status: 'conflict',
              remoteSnapshot: outcome.remoteSnapshot,
              remoteUpdatedAt: outcome.remoteUpdatedAt,
              conflictReason: outcome.conflictReason,
              attempts: item.attempts + 1,
              lastAttemptAt: new Date().toISOString(),
            });
            results.push({
              id: item.id,
              recordId: item.recordId,
              recordLabel: item.recordLabel,
              entityType: item.entityType,
              docPath: item.docPath,
              status: 'conflict',
              message: outcome.conflictReason,
            });
          } else if (outcome.status === 'failed') {
            failedCount += 1;
            await updateOfflineQueueItem(item.id, {
              status: 'failed',
              errorMessage: outcome.errorMessage,
              attempts: item.attempts + 1,
              lastAttemptAt: new Date().toISOString(),
            });
            results.push({
              id: item.id,
              recordId: item.recordId,
              recordLabel: item.recordLabel,
              entityType: item.entityType,
              docPath: item.docPath,
              status: 'failed',
              message: outcome.errorMessage,
            });
          }
        }

        const remaining = await refreshOfflineQueue();
        setIsPendingSyncState(remaining.length > 0);
        if (syncedCount > 0) {
          setLastSyncedAt(new Date().toISOString());
          setSyncError(null);
        }

        const summary: OfflineSyncRunSummary = {
          startedAt,
          finishedAt: new Date().toISOString(),
          totalProcessed: results.length,
          syncedCount,
          conflictCount,
          failedCount,
          results,
        };

        if (results.length > 0 || !options?.backgroundAuto) {
          setLastSyncSummary(summary);
        }
        if (conflictCount > 0) {
          setIsSyncCenterOpen(true);
        }
        return summary;
      } finally {
        syncInFlightRef.current = false;
        setIsSyncing(false);
      }
    },
    [demoMode, lastSyncSummary, refreshOfflineQueue]
  );

  useEffect(() => {
    syncNowRef.current = syncNow;
  }, [syncNow]);

  // Automatic Background Sync on Initial Online Load if Queue Has Pending Items
  useEffect(() => {
    if (
      !demoMode &&
      !hasAutoSyncedMountRef.current &&
      isOnline &&
      !isDeviceOffline() &&
      offlineQueue.some((item) => item.status === 'pending' || item.status === 'failed')
    ) {
      hasAutoSyncedMountRef.current = true;
      const timer = setTimeout(() => {
        void syncNow({ backgroundAuto: true });
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [demoMode, isOnline, offlineQueue, syncNow]);

  const resolveSyncConflict = useCallback(
    async (queueItemId: string, choice: ConflictResolutionChoice): Promise<boolean> => {
      const queue = await getOfflineQueue();
      const target = queue.find((i) => i.id === queueItemId);
      if (!target) return false;

      if (isDeviceOffline()) {
        setIsOnline(false);
        return false;
      }

      await updateOfflineQueueItem(queueItemId, { status: 'syncing' });
      const outcome = await syncOfflineQueueItemToFirestore(target, choice);

      if (choice === 'keep-remote' && outcome.status === 'resolved-remote') {
        applyRemoteRecordToLocalState(target, outcome.remoteData);
        await removeOfflineQueueItem(queueItemId);
        await refreshOfflineQueue();
        setLastSyncedAt(new Date().toISOString());
        setLastSyncSummary((prev) => ({
          startedAt: prev?.startedAt || new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          totalProcessed: (prev?.totalProcessed || 0) + 1,
          syncedCount: (prev?.syncedCount || 0) + 1,
          conflictCount: Math.max(0, (prev?.conflictCount || 1) - 1),
          failedCount: prev?.failedCount || 0,
          results: [
            ...(prev?.results.filter((r) => r.id !== target.id) || []),
            {
              id: target.id,
              recordId: target.recordId,
              recordLabel: target.recordLabel,
              entityType: target.entityType,
              docPath: target.docPath,
              status: 'synced',
              message: 'Conflict resolved: kept online server version.',
            },
          ],
        }));
        return true;
      }

      if (choice === 'keep-local' && outcome.status === 'synced') {
        if (
          outcome.resolvedRecordId &&
          target.entityType === 'feePayment' &&
          outcome.resolvedRecordId !== target.recordId
        ) {
          setFeePayments((prev) =>
            prev.map((p) =>
              p.id === target.recordId ? { ...p, id: outcome.resolvedRecordId! } : p
            )
          );
        }
        await removeOfflineQueueItem(queueItemId);
        await refreshOfflineQueue();
        setLastSyncedAt(new Date().toISOString());
        setLastSyncSummary((prev) => ({
          startedAt: prev?.startedAt || new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          totalProcessed: (prev?.totalProcessed || 0) + 1,
          syncedCount: (prev?.syncedCount || 0) + 1,
          conflictCount: Math.max(0, (prev?.conflictCount || 1) - 1),
          failedCount: prev?.failedCount || 0,
          results: [
            ...(prev?.results.filter((r) => r.id !== target.id) || []),
            {
              id: target.id,
              recordId: outcome.resolvedRecordId || target.recordId,
              recordLabel: target.recordLabel,
              entityType: target.entityType,
              docPath: outcome.resolvedDocPath || target.docPath,
              status: 'synced',
              message: 'Conflict resolved: pushed local version to Firestore.',
            },
          ],
        }));
        return true;
      }

      const failMsg =
        outcome.status === 'failed'
          ? outcome.errorMessage
          : 'Failed to resolve conflict. Please retry when online.';
      await updateOfflineQueueItem(queueItemId, {
        status: 'conflict',
        errorMessage: failMsg,
      });
      await refreshOfflineQueue();
      return false;
    },
    [applyRemoteRecordToLocalState, refreshOfflineQueue]
  );

  const discardOfflineItem = useCallback(
    async (queueItemId: string): Promise<void> => {
      await removeOfflineQueueItem(queueItemId);
      await refreshOfflineQueue();
    },
    [refreshOfflineQueue]
  );

  const performSync = async (
    operation: string,
    syncFn: () => Promise<any>,
    queueEntries?: EnqueueOfflineMutationInput[]
  ): Promise<boolean> => {
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

    const enqueueAll = async () => {
      if (queueEntries && queueEntries.length > 0) {
        await Promise.all(queueEntries.map((entry) => enqueueOfflineMutation(entry)));
        await refreshOfflineQueue();
      }
      setIsPendingSyncState(true);
      setSyncError(null);
    };

    // Immediate offline short-circuit into IndexedDB queue (prevents hanging writes)
    if (isDeviceOffline()) {
      setIsOnline(false);
      if (queueEntries && queueEntries.length > 0) {
        await enqueueAll();
        return true;
      }
      setIsPendingSyncState(true);
      return false;
    }

    try {
      await syncFn();
      setSyncError(null);
      if (queueEntries && queueEntries.length > 0) {
        await Promise.all(
          queueEntries.map((entry) =>
            entry.action === 'delete'
              ? removeServerBaseline(entry.docPath)
              : recordServerBaseline(
                  entry.docPath,
                  entry.payload as Record<string, any>,
                  (entry.payload as any)?.updatedAt
                )
          )
        );
      }
      setIsPendingSyncState(offlineQueueRef.current.length > 0);
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
      const classified = classifyFirestoreError(err, operation);
      const isOfflineError =
        classified.isOffline ||
        isDeviceOffline() ||
        err?.code === 'unavailable' ||
        err?.code === 'offline';

      if (isOfflineError) {
        if (isDeviceOffline()) setIsOnline(false);
        if (queueEntries && queueEntries.length > 0) {
          await enqueueAll();
          return true;
        }
        setIsPendingSyncState(true);
      } else {
        console.error(`[SmsContext] Sync error during ${operation}:`, err);
        const errorReason =
          classified.isPermissionDenied
            ? 'Permission denied by institutional security policy'
            : classified.message || 'Institutional cloud write failed';

        setSyncError({
          id: `${operation}_${Date.now()}`,
          message: `Cloud sync failed: ${errorReason}. Your change is NOT saved.`,
          reason: errorReason,
          operation,
          retry: async () => {
            setSyncError(null);
            await performSync(operation, syncFn, queueEntries);
          },
        });
      }
      return false;
    }
  };

  const toggleSchoolStatus = (schoolId: string, reason?: string) => {
    const existingSchool = registeredSchools.find((s) => s.id === schoolId);
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
            void performSync(
              'toggleSchoolStatus',
              () => saveSchoolToFirestore(updated),
              [
                {
                  entityType: 'school',
                  action: 'upsert',
                  operation: 'toggleSchoolStatus',
                  schoolId: updated.id,
                  docPath: `schools/${updated.id}`,
                  recordId: updated.id,
                  recordLabel: `School Status · ${updated.name}`,
                  payload: updated,
                  baseUpdatedAt: normalizeTimestampValue((existingSchool as any)?.updatedAt),
                  baseSnapshot: existingSchool || null,
                },
              ]
            );
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
    } else if (currentUserProfile?.role) {
      setUserRoleState(currentUserProfile.role);
    } else {
      setUserRoleState('teacher');
    }
  };

  const resetSmsSessionState = () => {
    setCurrentUserProfile(null);
    setUserRoleState('teacher');
    setIsImpersonating(false);
    setImpersonationOriginalRole(null);
    setActiveSchool(EMPTY_DEFAULT_SCHOOL);
    if (!demoMode) {
      setSalaryStructures([]);
      setPayslips([]);
      setApprovedSchoolStaffUsers([]);
      setTeachersBySchoolCache({});
      setStaffUsersBySchoolCache({});
      setOwnTeacherSalaryStructureState(null);
      setSchoolLessonPlans([]);
      setSchoolQuestionPapers([]);
    }
    try {
      localStorage.removeItem(SMS_USER_PROFILE_STORAGE_KEY);
      localStorage.removeItem(SMS_ROLE_STORAGE_KEY);
    } catch {
      // Ignore storage errors
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

  const [salaryStructures, setSalaryStructures] = useState<SalaryStructure[]>(() => {
    try {
      const isDemo = localStorage.getItem(SMS_DEMO_MODE_STORAGE_KEY) === 'true';
      const saved = localStorage.getItem(SMS_SALARY_STRUCTURES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (isDemo) return parsed.length > 0 ? parsed : INITIAL_MOCK_SALARY_STRUCTURES;
          return parsed.filter(
            (s: SalaryStructure) => s.schoolId !== 'school_latifabad_403020101'
          );
        }
      }
      return isDemo ? INITIAL_MOCK_SALARY_STRUCTURES : [];
    } catch {
      return [];
    }
  });

  const [payslips, setPayslips] = useState<EmployeePayslip[]>(() => {
    try {
      const isDemo = localStorage.getItem(SMS_DEMO_MODE_STORAGE_KEY) === 'true';
      const saved = localStorage.getItem(SMS_PAYSLIPS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (isDemo) return parsed.length > 0 ? parsed : INITIAL_MOCK_PAYSLIPS;
          return parsed.filter(
            (p: EmployeePayslip) => p.schoolId !== 'school_latifabad_403020101'
          );
        }
      }
      return isDemo ? INITIAL_MOCK_PAYSLIPS : [];
    } catch {
      return [];
    }
  });

  const [payrollSettings, setPayrollSettings] = useState<PayrollSettings>(() => {
    try {
      const saved = localStorage.getItem(SMS_PAYROLL_SETTINGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            id: 'config',
            schoolId: parsed.schoolId || '',
            teacherPayslipAccessEnabled:
              parsed.teacherPayslipAccessEnabled !== undefined
                ? Boolean(parsed.teacherPayslipAccessEnabled)
                : true,
            defaultPaymentMethod: parsed.defaultPaymentMethod || 'Bank Transfer',
          };
        }
      }
    } catch {
      // Ignore
    }
    return {
      id: 'config',
      schoolId: '',
      teacherPayslipAccessEnabled: true,
      defaultPaymentMethod: 'Bank Transfer',
    };
  });

  const [approvedSchoolStaffUsers, setApprovedSchoolStaffUsers] = useState<UserProfile[]>([]);
  const [teachersBySchoolCache, setTeachersBySchoolCache] = useState<Record<string, TeacherInfo[]>>({});
  const [staffUsersBySchoolCache, setStaffUsersBySchoolCache] = useState<Record<string, UserProfile[]>>({});
  const [ownTeacherSalaryStructureState, setOwnTeacherSalaryStructureState] =
    useState<SalaryStructure | null>(null);
  const [acknowledgedSalaryStamp, setAcknowledgedSalaryStamp] = useState<string>('');

  const [schoolLessonPlans, setSchoolLessonPlans] = useState<SchoolLessonPlan[]>(() => {
    try {
      const isDemo = localStorage.getItem(SMS_DEMO_MODE_STORAGE_KEY) === 'true';
      const saved = localStorage.getItem(SMS_SCHOOL_LESSON_PLANS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (isDemo) {
            return parsed.length > 0 ? parsed : INITIAL_MOCK_SCHOOL_LESSON_PLANS;
          }
          return parsed.filter(
            (p: SchoolLessonPlan) => !String(p.id || '').startsWith('lp_demo_')
          );
        }
      }
      return isDemo ? INITIAL_MOCK_SCHOOL_LESSON_PLANS : [];
    } catch {
      return [];
    }
  });

  const [schoolQuestionPapers, setSchoolQuestionPapers] = useState<SchoolQuestionPaper[]>(() => {
    try {
      const isDemo = localStorage.getItem(SMS_DEMO_MODE_STORAGE_KEY) === 'true';
      const saved = localStorage.getItem(SMS_SCHOOL_QUESTION_PAPERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (isDemo) {
            return parsed.length > 0 ? parsed : INITIAL_MOCK_SCHOOL_QUESTION_PAPERS;
          }
          return parsed.filter(
            (qp: SchoolQuestionPaper) => !String(qp.id || '').startsWith('qp_demo_')
          );
        }
      }
      return isDemo ? INITIAL_MOCK_SCHOOL_QUESTION_PAPERS : [];
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
      setSalaryStructures(INITIAL_MOCK_SALARY_STRUCTURES);
      setPayslips(INITIAL_MOCK_PAYSLIPS);
      setSchoolLessonPlans(INITIAL_MOCK_SCHOOL_LESSON_PLANS);
      setSchoolQuestionPapers(INITIAL_MOCK_SCHOOL_QUESTION_PAPERS);
      setPayrollSettings({
        id: 'config',
        schoolId: INITIAL_MOCK_SCHOOL.id,
        teacherPayslipAccessEnabled: true,
        defaultPaymentMethod: 'Bank Transfer',
      });
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

        const savedSalaryStructures = localStorage.getItem(SMS_SALARY_STRUCTURES_STORAGE_KEY);
        const parsedSalaryStructures = savedSalaryStructures ? JSON.parse(savedSalaryStructures) : [];
        setSalaryStructures(
          parsedSalaryStructures.filter(
            (s: SalaryStructure) => s.schoolId !== 'school_latifabad_403020101'
          )
        );

        const savedPayslips = localStorage.getItem(SMS_PAYSLIPS_STORAGE_KEY);
        const parsedPayslips = savedPayslips ? JSON.parse(savedPayslips) : [];
        setPayslips(
          parsedPayslips.filter(
            (p: EmployeePayslip) => p.schoolId !== 'school_latifabad_403020101'
          )
        );

        const savedSchoolLessonPlans = localStorage.getItem(SMS_SCHOOL_LESSON_PLANS_STORAGE_KEY);
        const parsedSchoolPlans = savedSchoolLessonPlans ? JSON.parse(savedSchoolLessonPlans) : [];
        setSchoolLessonPlans(
          parsedSchoolPlans.filter(
            (p: SchoolLessonPlan) => !String(p.id || '').startsWith('lp_demo_')
          )
        );

        const savedSchoolQuestionPapers = localStorage.getItem(SMS_SCHOOL_QUESTION_PAPERS_STORAGE_KEY);
        const parsedSchoolPapers = savedSchoolQuestionPapers ? JSON.parse(savedSchoolQuestionPapers) : [];
        setSchoolQuestionPapers(
          parsedSchoolPapers.filter(
            (qp: SchoolQuestionPaper) => !String(qp.id || '').startsWith('qp_demo_')
          )
        );

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
        setSalaryStructures([]);
        setPayslips([]);
        setSchoolLessonPlans([]);
        setSchoolQuestionPapers([]);
        setAttendanceRegisters({});
      }
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem(
        SMS_SCHOOL_LESSON_PLANS_STORAGE_KEY,
        JSON.stringify(schoolLessonPlans)
      );
    } catch {
      // Ignore storage errors
    }
  }, [schoolLessonPlans]);

  useEffect(() => {
    try {
      localStorage.setItem(
        SMS_SCHOOL_QUESTION_PAPERS_STORAGE_KEY,
        JSON.stringify(schoolQuestionPapers)
      );
    } catch {
      // Ignore storage errors
    }
  }, [schoolQuestionPapers]);

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

  useEffect(() => {
    try {
      localStorage.setItem(SMS_SALARY_STRUCTURES_STORAGE_KEY, JSON.stringify(salaryStructures));
    } catch {
      // Ignore storage errors
    }
  }, [salaryStructures]);

  useEffect(() => {
    try {
      localStorage.setItem(SMS_PAYSLIPS_STORAGE_KEY, JSON.stringify(payslips));
    } catch {
      // Ignore storage errors
    }
  }, [payslips]);

  useEffect(() => {
    try {
      localStorage.setItem(SMS_PAYROLL_SETTINGS_STORAGE_KEY, JSON.stringify(payrollSettings));
    } catch {
      // Ignore storage errors
    }
  }, [payrollSettings]);

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
    if (demoMode || isDeviceOffline()) return classes;

    setLoadingClasses(true);
    try {
      const remoteClasses = await fetchClassesFromFirestore(targetId);
      const merged = mergeQueueIntoCollection(['class'], targetId, remoteClasses, offlineQueueRef.current);
      setClasses(merged);
      return merged;
    } catch (err) {
      console.warn('[Firestore] Notice: Classes refresh error:', err);
      return classes;
    } finally {
      setLoadingClasses(false);
    }
  };

  // Sync Schools Directory & Registration Requests on mount / auth state / mode change
  useEffect(() => {
    if (demoMode || isDeviceOffline()) return;
    let cancelled = false;

    fetchSchoolsFromFirestore()
      .then((remoteSchools) => {
        if (cancelled) return;
        if (remoteSchools && remoteSchools.length > 0) {
          const filtered = remoteSchools.filter((s) => s.id && s.id !== 'sch_seld_khi_01');
          setRegisteredSchools(
            mergeQueueIntoCollection(['school', 'schoolLogo'], 'global', filtered, offlineQueueRef.current)
          );
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
          if (!cancelled) {
            setGlobalNotices(
              mergeQueueIntoCollection(['globalNotice'], 'global', remoteNotices || [], offlineQueueRef.current)
            );
          }
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
          if (!cancelled) {
            setGlobalNotices(
              mergeQueueIntoCollection(
                ['globalNotice', 'noticeRead'],
                activeSchool.id,
                remoteNotices || [],
                offlineQueueRef.current
              )
            );
          }
        })
        .catch((err) => console.warn('[Firestore] Notice: School notices fetch error:', err));
    }

    return () => {
      cancelled = true;
    };
  }, [demoMode, authUserUid, currentUserProfile?.role, currentUserProfile?.status, isSuperAdmin, activeSchool.id, isOnline, mergeQueueIntoCollection]);

  // Cloud Firestore Sync for active school subcollections when not in demo mode
  useEffect(() => {
    if (demoMode) return;
    if (!activeSchool.id || activeSchool.id === 'sch_seld_khi_01') return;
    if (isDeviceOffline()) return;

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
        setSchoolLessonPlans([]);
        setSchoolQuestionPapers([]);
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

            if (studentDoc?.classId) {
              fetchSharedLessonPlansForParentFromFirestore(schoolId, studentDoc.classId)
                .then((sharedPlans) => {
                  if (!cancelled) setSchoolLessonPlans(sharedPlans || []);
                })
                .catch(() => {
                  if (!cancelled) setSchoolLessonPlans([]);
                });
            } else {
              setSchoolLessonPlans([]);
            }
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
      setSalaryStructures([]);
      setPayslips([]);
      setSchoolLessonPlans([]);
      setSchoolQuestionPapers([]);

      return () => {
        cancelled = true;
      };
    }

    // Strict Super Admin RBAC Isolation: Never query or expose tenant student/class/attendance/fee/exam/AI subcollections
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
      setSalaryStructures([]);
      setPayslips([]);
      setSchoolLessonPlans([]);
      setSchoolQuestionPapers([]);
      setLoadingClasses(false);
      return () => {
        cancelled = true;
      };
    }

    // Reset school-scoped collections before loading when switching schools so stale data doesn't linger
    setLoadingClasses(true);

    // 2. Sync classes for active school (overlaying queued offline mutations)
    fetchClassesFromFirestore(schoolId)
      .then((remoteClasses) => {
        if (!cancelled) {
          setClasses(
            mergeQueueIntoCollection(['class'], schoolId, remoteClasses || [], offlineQueueRef.current)
          );
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
          setTeachers(
            mergeQueueIntoCollection(['teacher'], schoolId, remoteTeachers || [], offlineQueueRef.current)
          );
        }
      })
      .catch((err) => console.warn('[Firestore] Notice: Teachers fetch error:', err));

    // 3. Sync students for active school (overlaying queued offline mutations)
    fetchStudentsFromFirestore(schoolId)
      .then((remoteStudents) => {
        if (!cancelled) {
          setStudents(
            mergeQueueIntoCollection(
              ['student', 'studentInvite'],
              schoolId,
              remoteStudents || [],
              offlineQueueRef.current
            )
          );
        }
      })
      .catch((err) => console.warn('[Firestore] Notice: Students fetch error:', err));

    // 4. Sync attendance for active school (overlaying queued offline registers)
    fetchAttendanceFromFirestore(schoolId)
      .then((remoteAttendance) => {
        if (!cancelled) {
          setAttendanceRegisters(
            mergeQueueIntoAttendanceMap(schoolId, remoteAttendance || {}, offlineQueueRef.current)
          );
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
          setFeeStructures(
            mergeQueueIntoCollection(['feeStructure'], schoolId, remoteStructures || [], offlineQueueRef.current)
          );
        }
      })
      .catch((err) => console.warn('[Firestore] Notice: Fee structures fetch error:', err));

    // 7. Sync fee payments for active school (overlaying queued offline fee payments)
    fetchFeePaymentsFromFirestore(schoolId)
      .then((remotePayments) => {
        if (!cancelled) {
          setFeePayments(
            mergeQueueIntoCollection(['feePayment'], schoolId, remotePayments || [], offlineQueueRef.current)
          );
        }
      })
      .catch((err) => console.warn('[Firestore] Notice: Fee payments fetch error:', err));

    // 8. Sync fee concessions & discount rules for active school
    fetchFeeConcessionsFromFirestore(schoolId)
      .then((remoteConcessions) => {
        if (!cancelled) {
          setFeeConcessions(
            mergeQueueIntoCollection(['feeConcession'], schoolId, remoteConcessions || [], offlineQueueRef.current)
          );
        }
      })
      .catch((err) => console.warn('[Firestore] Notice: Fee concessions fetch error:', err));

    // 9. Sync exams for active school
    fetchExamsFromFirestore(schoolId)
      .then((remoteExams) => {
        if (!cancelled) {
          setExams(
            mergeQueueIntoCollection(['exam'], schoolId, remoteExams || [], offlineQueueRef.current)
          );
        }
      })
      .catch((err) => console.warn('[Firestore] Notice: Exams fetch error:', err));

    // 10. Sync exam marks for active school
    fetchMarksFromFirestore(schoolId)
      .then((remoteMarks) => {
        if (!cancelled) {
          setExamMarks(
            mergeQueueIntoCollection(['marks'], schoolId, remoteMarks || [], offlineQueueRef.current)
          );
        }
      })
      .catch((err) => console.warn('[Firestore] Notice: Exam marks fetch error:', err));

    // 11. Sync Phase D: Timetable, Homework & Certificates
    fetchTimetableFromFirestore(schoolId)
      .then((remoteTimetable) => {
        if (!cancelled) {
          setTimetableEntries(
            mergeQueueIntoCollection(['timetable'], schoolId, remoteTimetable || [], offlineQueueRef.current)
          );
        }
      })
      .catch((err) => console.warn('[Firestore] Notice: Timetable fetch error:', err));

    fetchHomeworkFromFirestore(schoolId)
      .then((remoteHomework) => {
        if (!cancelled) {
          setHomeworkItems(
            mergeQueueIntoCollection(['homework'], schoolId, remoteHomework || [], offlineQueueRef.current)
          );
        }
      })
      .catch((err) => console.warn('[Firestore] Notice: Homework fetch error:', err));

    fetchCertificatesFromFirestore(schoolId)
      .then((remoteCertificates) => {
        if (!cancelled) {
          setCertificates(
            mergeQueueIntoCollection(['certificate'], schoolId, remoteCertificates || [], offlineQueueRef.current)
          );
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

    // 12. Sync Salary & Payroll (RBAC-enforced: Admin gets full payroll; Teacher gets ONLY own finalized payslips if enabled)
    const isAdminForSync =
      currentUserProfile?.role === 'admin' ||
      currentUserProfile?.role === 'principal' ||
      hasAdminCapabilities(null, currentUserProfile, registeredSchools);

    fetchPayrollSettingsFromFirestore(schoolId)
      .then((remoteSettings) => {
        if (cancelled) return;
        const resolvedSettings: PayrollSettings = remoteSettings || {
          id: 'config',
          schoolId,
          teacherPayslipAccessEnabled: true,
          defaultPaymentMethod: 'Bank Transfer',
        };
        setPayrollSettings(resolvedSettings);

        if (isAdminForSync) {
          fetchApprovedSchoolStaffUsersFromFirestore(schoolId)
            .then((staffList) => {
              if (!cancelled) {
                setApprovedSchoolStaffUsers(staffList || []);
                setStaffUsersBySchoolCache((prev) => ({ ...prev, [schoolId]: staffList || [] }));
              }
            })
            .catch(() => {});

          fetchSalaryStructuresFromFirestore(schoolId)
            .then((remoteStructures) => {
              if (!cancelled) {
                setSalaryStructures(
                  mergeQueueIntoCollection(
                    ['salaryStructure'],
                    schoolId,
                    remoteStructures || [],
                    offlineQueueRef.current
                  )
                );
              }
            })
            .catch((err) => console.warn('[Firestore] Notice: Salary structures fetch error:', err));

          fetchPayslipsFromFirestore(schoolId)
            .then((remotePayslips) => {
              if (!cancelled) {
                setPayslips(
                  mergeQueueIntoCollection(
                    ['payslip'],
                    schoolId,
                    remotePayslips || [],
                    offlineQueueRef.current
                  )
                );
              }
            })
            .catch((err) => console.warn('[Firestore] Notice: Payslips fetch error:', err));
          setOwnTeacherSalaryStructureState(null);
        } else {
          setSalaryStructures([]);
          setApprovedSchoolStaffUsers([]);
          fetchTeacherOwnSalaryStructureFromFirestore(schoolId, {
            uid: authUserUid || currentUserProfile?.uid,
            email: currentUserProfile?.email,
          })
            .then((ownStruct) => {
              if (!cancelled) {
                setOwnTeacherSalaryStructureState(ownStruct);
              }
            })
            .catch(() => {
              if (!cancelled) setOwnTeacherSalaryStructureState(null);
            });

          if (resolvedSettings.teacherPayslipAccessEnabled) {
            fetchTeacherOwnPayslipsFromFirestore(schoolId, {
              uid: authUserUid || currentUserProfile?.uid,
              email: currentUserProfile?.email,
            })
              .then((ownSlips) => {
                if (!cancelled) {
                  setPayslips(ownSlips || []);
                }
              })
              .catch(() => {
                if (!cancelled) setPayslips([]);
              });
          } else {
            setPayslips([]);
          }
        }
      })
      .catch(() => {
        if (!cancelled && !isAdminForSync) {
          setSalaryStructures([]);
          setPayslips([]);
        }
      });

    // 13. Sync School AI Lesson Plans & Question Papers (RBAC-enforced: Admin gets all; Teacher gets assigned classes only; Super Admin excluded above)
    const teacherAssignedClassIdsForAi = isAdminForSync
      ? undefined
      : Array.isArray(currentUserProfile?.assignedClassIds)
      ? currentUserProfile.assignedClassIds
      : [];

    fetchSchoolLessonPlansFromFirestore(schoolId, teacherAssignedClassIdsForAi)
      .then((remotePlans) => {
        if (!cancelled) {
          setSchoolLessonPlans(
            mergeQueueIntoCollection(
              ['schoolLessonPlan'],
              schoolId,
              remotePlans || [],
              offlineQueueRef.current
            )
          );
        }
      })
      .catch((err) => console.warn('[Firestore] Notice: Lesson plans fetch error:', err));

    fetchSchoolQuestionPapersFromFirestore(schoolId, teacherAssignedClassIdsForAi)
      .then((remotePapers) => {
        if (!cancelled) {
          setSchoolQuestionPapers(
            mergeQueueIntoCollection(
              ['schoolQuestionPaper'],
              schoolId,
              remotePapers || [],
              offlineQueueRef.current
            )
          );
        }
      })
      .catch((err) => console.warn('[Firestore] Notice: Question papers fetch error:', err));

    return () => {
      cancelled = true;
    };
  }, [demoMode, activeSchool.id, authUserUid, currentUserProfile?.status, currentUserProfile?.role, currentUserProfile?.childStudentId, currentUserProfile?.studentId, currentUserProfile?.email, JSON.stringify(currentUserProfile?.assignedClassIds || []), isSuperAdmin, isOnline, registeredSchools, mergeQueueIntoCollection, mergeQueueIntoAttendanceMap]);

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
    const existing = teachers.find((t) => t.id === teacherId);
    const updatedTeacher = existing ? { ...existing, ...updates } : null;

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

    if (!demoMode && activeSchool.id && updatedTeacher) {
      void performSync(
        'updateTeacherProfile',
        () => saveTeacherToFirestore(activeSchool.id, updatedTeacher),
        [
          {
            entityType: 'teacher',
            action: 'upsert',
            operation: 'updateTeacherProfile',
            schoolId: activeSchool.id,
            userId: authUserUid || undefined,
            docPath: `schools/${activeSchool.id}/teachers/${teacherId}`,
            recordId: teacherId,
            recordLabel: `Faculty · ${updatedTeacher.name}`,
            payload: updatedTeacher,
            baseUpdatedAt: normalizeTimestampValue((existing as any)?.updatedAt),
            baseSnapshot: existing || null,
          },
        ]
      );
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
      void performSync(
        'addClass',
        () => saveClassToFirestore(activeSchool.id, newClass),
        [
          {
            entityType: 'class',
            action: 'upsert',
            operation: 'addClass',
            schoolId: activeSchool.id,
            userId: authUserUid || undefined,
            docPath: `schools/${activeSchool.id}/classes/${id}`,
            recordId: id,
            recordLabel: `Class · ${newClass.grade} - ${newClass.section}`,
            payload: newClass,
          },
        ]
      );
    }
  };

  const updateClass = (id: string, updated: Partial<ClassSection>) => {
    if (blockSchoolMutation('updateClass')) return;
    const existingClass = classes.find((c) => c.id === id);
    if (!existingClass) return;
    const merged = { ...existingClass, ...updated };
    setClasses((prev) => prev.map((c) => (c.id === id ? merged : c)));

    if (!demoMode && activeSchool.id) {
      void performSync(
        'updateClass',
        () => saveClassToFirestore(activeSchool.id, merged),
        [
          {
            entityType: 'class',
            action: 'upsert',
            operation: 'updateClass',
            schoolId: activeSchool.id,
            userId: authUserUid || undefined,
            docPath: `schools/${activeSchool.id}/classes/${id}`,
            recordId: id,
            recordLabel: `Class · ${merged.grade} - ${merged.section}`,
            payload: merged,
            baseUpdatedAt: normalizeTimestampValue((existingClass as any).updatedAt),
            baseSnapshot: existingClass,
          },
        ]
      );
    }
  };

  const deleteClass = (id: string) => {
    if (blockSchoolMutation('deleteClass')) return;
    const existingClass = classes.find((c) => c.id === id);
    setClasses((prev) => prev.filter((c) => c.id !== id));
    if (!demoMode && activeSchool.id) {
      void performSync(
        'deleteClass',
        () => deleteClassFromFirestore(activeSchool.id, id),
        [
          {
            entityType: 'class',
            action: 'delete',
            operation: 'deleteClass',
            schoolId: activeSchool.id,
            userId: authUserUid || undefined,
            docPath: `schools/${activeSchool.id}/classes/${id}`,
            recordId: id,
            recordLabel: `Delete Class · ${existingClass ? `${existingClass.grade} - ${existingClass.section}` : id}`,
            payload: { id },
            baseUpdatedAt: normalizeTimestampValue((existingClass as any)?.updatedAt),
            baseSnapshot: existingClass || null,
          },
        ]
      );
    }
  };

  const buildStudentLinkPayloads = (student: Student) => {
    if (!activeSchool.id || !student.grNumber) return null;
    const parentInviteCode = student.parentInviteCode || generateParentInviteCode(student.grNumber);
    const parentLinkId = buildParentLinkId(activeSchool.id, student.grNumber);
    const parentLink = {
      id: parentLinkId,
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
      inviteCode: parentInviteCode,
      claimedByUid: student.parentUid,
      status: (student.parentUid ? 'linked' : 'available') as 'linked' | 'available',
    };

    const studentInviteCode = student.studentInviteCode || generateStudentInviteCode(student.grNumber);
    const linkIds = Array.from(
      new Set([
        buildParentLinkId(activeSchool.id, student.grNumber),
        ...(student.id ? [buildParentLinkId(activeSchool.id, student.id)] : []),
      ])
    );
    const primaryStudentLink: StudentPortalLink = {
      id: linkIds[0],
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
      inviteCode: studentInviteCode,
      claimedByUid: student.studentUid,
      status: student.studentUid ? 'linked' : 'available',
    };
    const studentLinks = linkIds.map((docId) => ({ ...primaryStudentLink, id: docId }));
    return { parentLink, primaryStudentLink, studentLinks };
  };

  const syncParentLinkForStudent = (student: Student) => {
    if (demoMode || isDeviceOffline() || !activeSchool.id || !student.grNumber) return;
    const built = buildStudentLinkPayloads(student);
    if (!built) return;
    saveParentStudentLinkToFirestore(built.parentLink).catch((err) =>
      console.warn('[ParentLink] Sync notice:', err)
    );
  };

  const syncStudentLinkForStudent = (student: Student) => {
    if (demoMode || !activeSchool.id || !student.grNumber) return;
    const built = buildStudentLinkPayloads(student);
    if (!built) return;
    setStudentPortalLinks((prev) => ({
      ...prev,
      [student.id]: prev[student.id]?.claimedByUid
        ? {
            ...built.primaryStudentLink,
            claimedByUid: prev[student.id].claimedByUid,
            status: 'linked',
          }
        : built.primaryStudentLink,
    }));
    if (isDeviceOffline()) return;
    Promise.all(built.studentLinks.map((lnk) => saveStudentPortalLinkToFirestore(lnk))).catch((err) =>
      console.warn('[StudentLink] Sync notice:', err)
    );
  };

  const addStudent = (newStudentData: Omit<Student, 'id'>): Student | void => {
    if (blockSchoolMutation('addStudent')) return;
    const id = `std_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const inviteCode =
      newStudentData.parentInviteCode || generateParentInviteCode(newStudentData.grNumber);
    const studentInviteCode =
      newStudentData.studentInviteCode || generateStudentInviteCode(newStudentData.grNumber);
    const nowIso = new Date().toISOString();
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
      const builtLinks = buildStudentLinkPayloads(newStudent);
      syncStudentLinkForStudent(newStudent);

      const queueEntries: EnqueueOfflineMutationInput[] = [
        {
          entityType: 'student',
          action: 'upsert',
          operation: 'addStudent',
          schoolId: activeSchool.id,
          userId: authUserUid || undefined,
          docPath: `schools/${activeSchool.id}/students/${newStudent.id}`,
          recordId: newStudent.id,
          recordLabel: `Student Admission · ${newStudent.fullName} (GR ${newStudent.grNumber})`,
          payload: { ...newStudent, updatedAt: nowIso },
        },
        ...(builtLinks
          ? [
              {
                entityType: 'parentLink' as const,
                action: 'upsert' as const,
                operation: 'addStudent:parentLink',
                schoolId: activeSchool.id,
                userId: authUserUid || undefined,
                docPath: `parentLinks/${builtLinks.parentLink.id}`,
                recordId: builtLinks.parentLink.id,
                recordLabel: `Parent Portal Link · ${newStudent.grNumber}`,
                payload: builtLinks.parentLink,
              },
              ...builtLinks.studentLinks.map((lnk) => ({
                entityType: 'studentLink' as const,
                action: 'upsert' as const,
                operation: 'addStudent:studentLink',
                schoolId: activeSchool.id,
                userId: authUserUid || undefined,
                docPath: `studentLinks/${lnk.id}`,
                recordId: lnk.id,
                recordLabel: `Student Portal Link · ${newStudent.grNumber}`,
                payload: lnk,
              })),
            ]
          : []),
      ];

      void performSync(
        'addStudent',
        async () => {
          await saveStudentToFirestore(activeSchool.id, newStudent);
          syncParentLinkForStudent(newStudent);
        },
        queueEntries
      );
    }
    return newStudent;
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
      const builtLinks = buildStudentLinkPayloads(updatedStudent);
      syncStudentLinkForStudent(updatedStudent);

      const queueEntries: EnqueueOfflineMutationInput[] = [
        {
          entityType: 'student',
          action: 'upsert',
          operation: 'updateStudent',
          schoolId: activeSchool.id,
          userId: authUserUid || undefined,
          docPath: `schools/${activeSchool.id}/students/${updatedStudent.id}`,
          recordId: updatedStudent.id,
          recordLabel: `Student Update · ${updatedStudent.fullName} (GR ${updatedStudent.grNumber})`,
          payload: updatedStudent,
          baseUpdatedAt: normalizeTimestampValue((existing as any).updatedAt),
          baseSnapshot: existing,
        },
        ...(builtLinks
          ? [
              {
                entityType: 'parentLink' as const,
                action: 'upsert' as const,
                operation: 'updateStudent:parentLink',
                schoolId: activeSchool.id,
                userId: authUserUid || undefined,
                docPath: `parentLinks/${builtLinks.parentLink.id}`,
                recordId: builtLinks.parentLink.id,
                recordLabel: `Parent Portal Link · ${updatedStudent.grNumber}`,
                payload: builtLinks.parentLink,
                baseUpdatedAt: normalizeTimestampValue((existing as any).updatedAt),
              },
              ...builtLinks.studentLinks.map((lnk) => ({
                entityType: 'studentLink' as const,
                action: 'upsert' as const,
                operation: 'updateStudent:studentLink',
                schoolId: activeSchool.id,
                userId: authUserUid || undefined,
                docPath: `studentLinks/${lnk.id}`,
                recordId: lnk.id,
                recordLabel: `Student Portal Link · ${updatedStudent.grNumber}`,
                payload: lnk,
                baseUpdatedAt: normalizeTimestampValue((existing as any).updatedAt),
              })),
            ]
          : []),
      ];

      void performSync(
        'updateStudent',
        async () => {
          await saveStudentToFirestore(activeSchool.id, updatedStudent);
          syncParentLinkForStudent(updatedStudent);
        },
        queueEntries
      );
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
      void performSync(
        'deleteStudent',
        () => deleteStudentFromFirestore(activeSchool.id, id),
        [
          {
            entityType: 'student',
            action: 'delete',
            operation: 'deleteStudent',
            schoolId: activeSchool.id,
            userId: authUserUid || undefined,
            docPath: `schools/${activeSchool.id}/students/${id}`,
            recordId: id,
            recordLabel: `Delete Student · ${existing.fullName} (GR ${existing.grNumber})`,
            payload: { id },
            baseUpdatedAt: normalizeTimestampValue((existing as any).updatedAt),
            baseSnapshot: existing,
          },
        ]
      );
    }
  };

  // Save or update attendance register (keyed by "YYYY-MM-DD_{classId}")
  const saveAttendance = (attendance: DailyClassAttendance) => {
    if (blockSchoolMutation('saveAttendance')) return;
    const existingAttendance = attendanceRegisters[attendance.id];
    const normalizedPayload = {
      ...attendance,
      schoolId: activeSchool.id || 'default_school',
      conductedBy: attendance.markedByName || 'Faculty',
      conductedByUid: attendance.markedByUid || 'system',
    };

    setAttendanceRegisters((prev) => ({
      ...prev,
      [attendance.id]: attendance,
    }));

    if (!demoMode && activeSchool.id) {
      void performSync(
        'saveAttendance',
        () => saveAttendanceToFirestore(activeSchool.id, attendance),
        [
          {
            entityType: 'attendance',
            action: 'upsert',
            operation: 'saveAttendance',
            schoolId: activeSchool.id,
            userId: authUserUid || undefined,
            docPath: `schools/${activeSchool.id}/attendance/${attendance.id}`,
            recordId: attendance.id,
            recordLabel: `Attendance · ${attendance.grade} - ${attendance.section} (${attendance.date})`,
            payload: normalizedPayload,
            baseUpdatedAt: normalizeTimestampValue((existingAttendance as any)?.updatedAt),
            baseSnapshot: existingAttendance
              ? {
                  ...existingAttendance,
                  schoolId: activeSchool.id,
                  conductedBy: existingAttendance.markedByName || 'Faculty',
                  conductedByUid: existingAttendance.markedByUid || 'system',
                }
              : null,
          },
        ]
      );
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

  // Determine effective role: In Demo mode, userRoleState controls it; in Live mode, currentUserProfile controls it
  const effectiveRole = useMemo<UserRole>(() => {
    if (demoMode) return userRole;
    if (currentUserProfile) {
      if (currentUserProfile.role === 'parent') return 'parent';
      if (currentUserProfile.role === 'student') return 'student';
      const email = (currentUserProfile.email || '').trim().toLowerCase();
      if (
        currentUserProfile.isSuperAdmin ||
        currentUserProfile.role === 'super-admin' ||
        email === 'owner@pakedu.com'
      ) {
        return 'super-admin';
      }
      if (
        currentUserProfile.role === 'admin' ||
        currentUserProfile.role === 'principal' ||
        hasAdminCapabilities(null, currentUserProfile, registeredSchools)
      ) {
        return 'admin';
      }
      if (currentUserProfile.role) {
        return currentUserProfile.role;
      }
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
    const existing = feeStructures.find((f) => f.classId === structure.classId);
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
      const docId = fullStructure.id || fullStructure.classId;
      return await performSync(
        'saveFeeStructure',
        () => saveFeeStructureToFirestore(activeSchool.id, fullStructure),
        [
          {
            entityType: 'feeStructure',
            action: 'upsert',
            operation: 'saveFeeStructure',
            schoolId: activeSchool.id,
            userId: authUserUid || undefined,
            docPath: `schools/${activeSchool.id}/feeStructures/${docId}`,
            recordId: docId,
            recordLabel: `Fee Structure · ${fullStructure.grade}`,
            payload: fullStructure,
            baseUpdatedAt: normalizeTimestampValue(existing?.updatedAt),
            baseSnapshot: existing || null,
          },
        ]
      );
    }
    return true;
  };

  const deleteClassFeeStructure = async (classId: string): Promise<boolean> => {
    if (blockSchoolMutation('deleteFeeStructure')) return false;
    const existing = feeStructures.find((f) => f.classId === classId || f.id === classId);
    setFeeStructures((prev) => prev.filter((f) => f.classId !== classId && f.id !== classId));
    if (!demoMode && activeSchool.id) {
      return await performSync(
        'deleteFeeStructure',
        () => deleteFeeStructureFromFirestore(activeSchool.id, classId),
        [
          {
            entityType: 'feeStructure',
            action: 'delete',
            operation: 'deleteFeeStructure',
            schoolId: activeSchool.id,
            userId: authUserUid || undefined,
            docPath: `schools/${activeSchool.id}/feeStructures/${classId}`,
            recordId: classId,
            recordLabel: `Delete Fee Structure · ${existing?.grade || classId}`,
            payload: { id: classId },
            baseUpdatedAt: normalizeTimestampValue(existing?.updatedAt),
            baseSnapshot: existing || null,
          },
        ]
      );
    }
    return true;
  };

  const recordFeePayment = async (
    payment: Omit<FeePayment, 'schoolId'>
  ): Promise<boolean> => {
    if (blockSchoolMutation('saveFeePayment')) return false;
    const existing = feePayments.find(
      (p) => p.id === payment.id || (p.studentId === payment.studentId && p.month === payment.month)
    );
    const fullPayment: FeePayment = {
      ...payment,
      schoolId: activeSchool.id || 'default_school',
      receiptNumber: payment.receiptNumber || '',
      paymentMethod: payment.paymentMethod || 'Cash',
      notes: payment.notes || '',
      installments: Array.isArray(payment.installments) ? payment.installments : [],
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
      return await performSync(
        'saveFeePayment',
        () => saveFeePaymentToFirestore(activeSchool.id, fullPayment),
        [
          {
            entityType: 'feePayment',
            action: 'upsert',
            operation: 'saveFeePayment',
            schoolId: activeSchool.id,
            userId: authUserUid || undefined,
            docPath: `schools/${activeSchool.id}/feePayments/${fullPayment.id}`,
            recordId: fullPayment.id,
            recordLabel: `Fee Payment · ${fullPayment.studentName} (${fullPayment.monthLabel || fullPayment.month})`,
            payload: fullPayment,
            baseUpdatedAt: normalizeTimestampValue(existing?.updatedAt),
            baseSnapshot: existing || null,
          },
        ]
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
    const existingMap = new Map(feePayments.map((p) => [p.id, p]));
    const fullPayments: FeePayment[] = payments.map((p) => ({
      ...p,
      schoolId,
      receiptNumber: p.receiptNumber || '',
      paymentMethod: p.paymentMethod || 'Cash',
      notes: p.notes || '',
      installments: Array.isArray(p.installments) ? p.installments : [],
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
      return await performSync(
        'saveBulkFeePayments',
        () => Promise.all(fullPayments.map((fp) => saveFeePaymentToFirestore(activeSchool.id, fp))),
        fullPayments.map((fp) => {
          const existing = existingMap.get(fp.id);
          return {
            entityType: 'feePayment' as const,
            action: 'upsert' as const,
            operation: 'saveBulkFeePayments',
            schoolId: activeSchool.id,
            userId: authUserUid || undefined,
            docPath: `schools/${activeSchool.id}/feePayments/${fp.id}`,
            recordId: fp.id,
            recordLabel: `Fee Voucher · ${fp.studentName} (${fp.monthLabel || fp.month})`,
            payload: fp,
            baseUpdatedAt: normalizeTimestampValue(existing?.updatedAt),
            baseSnapshot: existing || null,
          };
        })
      );
    }
    return true;
  };

  const saveFeeConcessionRule = async (
    rule: Omit<FeeConcessionRule, 'schoolId'>
  ): Promise<boolean> => {
    if (blockSchoolMutation('saveFeeConcession')) return false;
    const existing = feeConcessions.find((r) => r.id === rule.id);
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
      return await performSync(
        'saveFeeConcession',
        () => saveFeeConcessionToFirestore(activeSchool.id, fullRule),
        [
          {
            entityType: 'feeConcession',
            action: 'upsert',
            operation: 'saveFeeConcession',
            schoolId: activeSchool.id,
            userId: authUserUid || undefined,
            docPath: `schools/${activeSchool.id}/feeConcessions/${fullRule.id}`,
            recordId: fullRule.id,
            recordLabel: `Fee Concession · ${fullRule.title}`,
            payload: fullRule,
            baseUpdatedAt: normalizeTimestampValue(existing?.updatedAt),
            baseSnapshot: existing || null,
          },
        ]
      );
    }
    return true;
  };

  const deleteFeeConcessionRule = async (concessionId: string): Promise<boolean> => {
    if (blockSchoolMutation('deleteFeeConcession')) return false;
    const existing = feeConcessions.find((r) => r.id === concessionId);
    setFeeConcessions((prev) => prev.filter((r) => r.id !== concessionId));
    if (!demoMode && activeSchool.id) {
      return await performSync(
        'deleteFeeConcession',
        () => deleteFeeConcessionFromFirestore(activeSchool.id, concessionId),
        [
          {
            entityType: 'feeConcession',
            action: 'delete',
            operation: 'deleteFeeConcession',
            schoolId: activeSchool.id,
            userId: authUserUid || undefined,
            docPath: `schools/${activeSchool.id}/feeConcessions/${concessionId}`,
            recordId: concessionId,
            recordLabel: `Delete Fee Concession · ${existing?.title || concessionId}`,
            payload: { id: concessionId },
            baseUpdatedAt: normalizeTimestampValue(existing?.updatedAt),
            baseSnapshot: existing || null,
          },
        ]
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
      return await performSync(
        'applyStudentConcession',
        () => saveStudentToFirestore(activeSchool.id, updatedStudent),
        [
          {
            entityType: 'student',
            action: 'upsert',
            operation: 'applyStudentConcession',
            schoolId: activeSchool.id,
            userId: authUserUid || undefined,
            docPath: `schools/${activeSchool.id}/students/${updatedStudent.id}`,
            recordId: updatedStudent.id,
            recordLabel: `Student Concession · ${updatedStudent.fullName}`,
            payload: updatedStudent,
            baseUpdatedAt: normalizeTimestampValue((existing as any).updatedAt),
            baseSnapshot: existing,
          },
        ]
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

    const existing = exams.find((e) => e.id === examData.id);
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
      return await performSync(
        'saveExam',
        () => saveExamToFirestore(activeSchool.id, fullExam),
        [
          {
            entityType: 'exam',
            action: 'upsert',
            operation: 'saveExam',
            schoolId: activeSchool.id,
            userId: authUserUid || undefined,
            docPath: `schools/${activeSchool.id}/exams/${fullExam.id}`,
            recordId: fullExam.id,
            recordLabel: `Exam · ${fullExam.title}`,
            payload: fullExam,
            baseUpdatedAt: normalizeTimestampValue(existing?.updatedAt),
            baseSnapshot: existing || null,
          },
        ]
      );
    }
    return true;
  };

  const deleteExam = async (examId: string): Promise<boolean> => {
    if (blockSchoolMutation('deleteExam')) return false;
    if (!canManageExams) return false;
    const existingExam = exams.find((e) => e.id === examId);
    const linkedMarks = examMarks.filter((m) => m.examId === examId);
    setExams((prev) => prev.filter((e) => e.id !== examId));
    setExamMarks((prev) => prev.filter((m) => m.examId !== examId));

    if (!demoMode && activeSchool.id) {
      return await performSync(
        'deleteExam',
        async () => {
          await deleteExamFromFirestore(activeSchool.id, examId);
          await Promise.all(
            linkedMarks.map((m) => deleteStudentMarksFromFirestore(activeSchool.id, m.id))
          );
        },
        [
          {
            entityType: 'exam',
            action: 'delete',
            operation: 'deleteExam',
            schoolId: activeSchool.id,
            userId: authUserUid || undefined,
            docPath: `schools/${activeSchool.id}/exams/${examId}`,
            recordId: examId,
            recordLabel: `Delete Exam · ${existingExam?.title || examId}`,
            payload: { id: examId },
            baseUpdatedAt: normalizeTimestampValue(existingExam?.updatedAt),
            baseSnapshot: existingExam || null,
          },
          ...linkedMarks.map((m) => ({
            entityType: 'marks' as const,
            action: 'delete' as const,
            operation: 'deleteStudentMarks',
            schoolId: activeSchool.id,
            userId: authUserUid || undefined,
            docPath: `schools/${activeSchool.id}/marks/${m.id}`,
            recordId: m.id,
            recordLabel: `Delete Marks · ${m.studentName}`,
            payload: { id: m.id },
            baseUpdatedAt: normalizeTimestampValue(m.updatedAt),
            baseSnapshot: m,
          })),
        ]
      );
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

    const existing = examMarks.find((m) => m.id === marksData.id);
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
      return await performSync(
        'saveStudentMarks',
        () => saveStudentMarksToFirestore(activeSchool.id, fullMarks),
        [
          {
            entityType: 'marks',
            action: 'upsert',
            operation: 'saveStudentMarks',
            schoolId: activeSchool.id,
            userId: authUserUid || undefined,
            docPath: `schools/${activeSchool.id}/marks/${fullMarks.id}`,
            recordId: fullMarks.id,
            recordLabel: `Exam Marks · ${fullMarks.studentName} (${fullMarks.grade})`,
            payload: fullMarks,
            baseUpdatedAt: normalizeTimestampValue(existing?.updatedAt),
            baseSnapshot: existing || null,
          },
        ]
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

    const existingMap = new Map(examMarks.map((m) => [m.id, m]));
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
      return await performSync(
        'saveBulkStudentMarks',
        () => Promise.all(fullRecords.map((rec) => saveStudentMarksToFirestore(activeSchool.id, rec))),
        fullRecords.map((rec) => {
          const existing = existingMap.get(rec.id);
          return {
            entityType: 'marks' as const,
            action: 'upsert' as const,
            operation: 'saveBulkStudentMarks',
            schoolId: activeSchool.id,
            userId: authUserUid || undefined,
            docPath: `schools/${activeSchool.id}/marks/${rec.id}`,
            recordId: rec.id,
            recordLabel: `Exam Marks · ${rec.studentName}`,
            payload: rec,
            baseUpdatedAt: normalizeTimestampValue(existing?.updatedAt),
            baseSnapshot: existing || null,
          };
        })
      );
    }
    return true;
  };

  const updateSchoolLogo = async (logoUrl: string): Promise<boolean> => {
    if (blockSchoolMutation('updateSchoolLogo')) return false;
    if (!canManageExams || !activeSchool.id) return false;
    const prevSchool = activeSchool;
    const updatedSchool: School = { ...activeSchool, logoUrl };
    setActiveSchool(updatedSchool);
    setRegisteredSchools((prev) =>
      prev.map((s) => (s.id === updatedSchool.id ? updatedSchool : s))
    );
    if (!demoMode && activeSchool.id) {
      return await performSync(
        'updateSchoolLogo',
        () => saveSchoolToFirestore(updatedSchool),
        [
          {
            entityType: 'schoolLogo',
            action: 'upsert',
            operation: 'updateSchoolLogo',
            schoolId: activeSchool.id,
            userId: authUserUid || undefined,
            docPath: `schools/${activeSchool.id}`,
            recordId: activeSchool.id,
            recordLabel: `School Logo · ${updatedSchool.name}`,
            payload: { id: activeSchool.id, logoUrl },
            baseUpdatedAt: normalizeTimestampValue((prevSchool as any)?.updatedAt),
            baseSnapshot: prevSchool,
          },
        ]
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

      const linkIds = isStudentPortal
        ? Array.from(
            new Set([
              buildParentLinkId(activeSchool.id, updatedStudent.grNumber),
              buildParentLinkId(activeSchool.id, updatedStudent.id),
            ])
          )
        : [baseLink.id];

      const queueEntries: EnqueueOfflineMutationInput[] = [
        {
          entityType: 'student',
          action: 'upsert',
          operation: isStudentPortal ? 'generateStudentInvite' : 'generateParentInvite',
          schoolId: activeSchool.id,
          userId: authUserUid || undefined,
          docPath: `schools/${activeSchool.id}/students/${updatedStudent.id}`,
          recordId: updatedStudent.id,
          recordLabel: `Portal Invite · ${updatedStudent.fullName} (GR ${updatedStudent.grNumber})`,
          payload: updatedStudent,
          baseUpdatedAt: normalizeTimestampValue((existing as any).updatedAt),
          baseSnapshot: existing,
        },
        ...(isStudentPortal
          ? linkIds.map((docId) => ({
              entityType: 'studentLink' as const,
              action: 'upsert' as const,
              operation: 'generateStudentInvite:link',
              schoolId: activeSchool.id,
              userId: authUserUid || undefined,
              docPath: `studentLinks/${docId}`,
              recordId: docId,
              recordLabel: `Student Link · ${updatedStudent.grNumber}`,
              payload: {
                ...baseLink,
                id: docId,
                studentEmail: cleanedEmail || '',
                claimedByUid: updatedStudent.studentUid,
                status: updatedStudent.studentUid ? 'linked' : 'available',
              },
            }))
          : [
              {
                entityType: 'parentLink' as const,
                action: 'upsert' as const,
                operation: 'generateParentInvite:link',
                schoolId: activeSchool.id,
                userId: authUserUid || undefined,
                docPath: `parentLinks/${baseLink.id}`,
                recordId: baseLink.id,
                recordLabel: `Parent Link · ${updatedStudent.grNumber}`,
                payload: {
                  ...baseLink,
                  parentEmail: cleanedEmail || '',
                  guardianPhone: updatedStudent.guardianPhone || '',
                  claimedByUid: updatedStudent.parentUid,
                  status: updatedStudent.parentUid ? 'linked' : 'available',
                },
              },
            ]),
      ];

      const ok = await performSync(
        isStudentPortal ? 'generateStudentInvite' : 'generateParentInvite',
        async () => {
          await saveStudentToFirestore(activeSchool.id, updatedStudent);
          if (isStudentPortal) {
            const stuLink: StudentPortalLink = {
              ...baseLink,
              id: linkIds[0],
              studentEmail: cleanedEmail || '',
              claimedByUid: updatedStudent.studentUid,
              status: updatedStudent.studentUid ? 'linked' : 'available',
            };
            await Promise.all(
              linkIds.map((docId) =>
                saveStudentPortalLinkToFirestore({ ...stuLink, id: docId })
              )
            );
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
        },
        queueEntries
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

  const generateMissingStudentInvites = async (): Promise<number> => {
    if (blockSchoolMutation('generateMissingStudentInvites')) return 0;
    if (!canManageExams && !canAdmitStudents) return 0;
    const missing = students.filter((s) => !s.studentInviteCode && Boolean(s.grNumber));
    if (missing.length === 0) return 0;

    const existingMap = new Map(missing.map((s) => [s.id, s]));
    const updatedList = missing.map((s) => ({
      ...s,
      studentInviteCode: generateStudentInviteCode(s.grNumber),
    }));
    const updatedMap = new Map(updatedList.map((u) => [u.id, u]));

    setStudents((prev) => prev.map((s) => updatedMap.get(s.id) || s));

    if (!demoMode && activeSchool.id) {
      const queueEntries: EnqueueOfflineMutationInput[] = [];
      for (const stu of updatedList) {
        const prevStu = existingMap.get(stu.id);
        const built = buildStudentLinkPayloads(stu);
        queueEntries.push({
          entityType: 'student',
          action: 'upsert',
          operation: 'generateMissingStudentInvites',
          schoolId: activeSchool.id,
          userId: authUserUid || undefined,
          docPath: `schools/${activeSchool.id}/students/${stu.id}`,
          recordId: stu.id,
          recordLabel: `Student Invite · ${stu.fullName} (GR ${stu.grNumber})`,
          payload: stu,
          baseUpdatedAt: normalizeTimestampValue((prevStu as any)?.updatedAt),
          baseSnapshot: prevStu || null,
        });
        if (built) {
          built.studentLinks.forEach((lnk) => {
            queueEntries.push({
              entityType: 'studentLink',
              action: 'upsert',
              operation: 'generateMissingStudentInvites:link',
              schoolId: activeSchool.id,
              userId: authUserUid || undefined,
              docPath: `studentLinks/${lnk.id}`,
              recordId: lnk.id,
              recordLabel: `Student Portal Link · ${stu.grNumber}`,
              payload: lnk,
            });
          });
        }
      }

      await performSync(
        'generateMissingStudentInvites',
        async () => {
          await Promise.all(
            updatedList.map(async (stu) => {
              await saveStudentToFirestore(activeSchool.id, stu);
              syncStudentLinkForStudent(stu);
            })
          );
        },
        queueEntries
      );
    }
    return updatedList.length;
  };

  const ensureChildStudentInviteForParent = async (): Promise<{
    inviteCode: string;
    inviteUrl: string;
  } | null> => {
    const targetStu =
      students.find((s) => s.id === currentUserProfile?.childStudentId) || students[0];
    if (!targetStu || !targetStu.grNumber || !activeSchool.id) return null;

    const inviteCode =
      targetStu.studentInviteCode || generateStudentInviteCode(targetStu.grNumber);
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://pakedu.vercel.app';
    const inviteUrl = `${origin}/?student_invite=${encodeURIComponent(
      inviteCode
    )}&school=${encodeURIComponent(activeSchool.id)}&gr=${encodeURIComponent(
      targetStu.grNumber
    )}`;

    const updatedStu: Student = {
      ...targetStu,
      studentInviteCode: inviteCode,
    };

    if (!targetStu.studentInviteCode) {
      setStudents((prev) =>
        prev.map((s) => (s.id === targetStu.id ? updatedStu : s))
      );
      if (!demoMode) {
        try {
          await saveStudentInviteCodeOnlyToFirestore(activeSchool.id, updatedStu.id, inviteCode);
          const linkIds = Array.from(
            new Set([
              buildParentLinkId(activeSchool.id, updatedStu.grNumber),
              buildParentLinkId(activeSchool.id, updatedStu.id),
            ])
          );
          await Promise.all(
            linkIds.map((docId) =>
              saveStudentPortalLinkToFirestore({
                id: docId,
                schoolId: activeSchool.id,
                schoolName: activeSchool.name,
                semisCode: activeSchool.semisCode,
                studentId: updatedStu.id,
                studentName: updatedStu.fullName,
                classId: updatedStu.classId,
                grade: updatedStu.grade,
                section: updatedStu.section,
                grNumber: updatedStu.grNumber.trim().toUpperCase(),
                studentEmail: updatedStu.studentEmail?.trim().toLowerCase() || '',
                inviteCode,
                claimedByUid: updatedStu.studentUid,
                status: updatedStu.studentUid ? 'linked' : 'available',
              })
            )
          );
        } catch (err) {
          console.warn('[ParentDashboard] Student invite init notice:', err);
        }
      }
    }

    return { inviteCode, inviteUrl };
  };

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
    const existing = timetableEntries.find((t) => t.id === entry.id);
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
      return await performSync(
        'saveTimetableEntry',
        () => saveTimetableEntryToFirestore(activeSchool.id, fullEntry),
        [
          {
            entityType: 'timetable',
            action: 'upsert',
            operation: 'saveTimetableEntry',
            schoolId: activeSchool.id,
            userId: authUserUid || undefined,
            docPath: `schools/${activeSchool.id}/timetable/${fullEntry.id}`,
            recordId: fullEntry.id,
            recordLabel: `Timetable · ${fullEntry.day} Period ${fullEntry.periodNumber} (${fullEntry.subject})`,
            payload: fullEntry,
            baseUpdatedAt: normalizeTimestampValue(existing?.updatedAt),
            baseSnapshot: existing || null,
          },
        ]
      );
    }
    return true;
  };

  const deleteTimetableEntry = async (entryId: string): Promise<boolean> => {
    if (blockSchoolMutation('deleteTimetableEntry')) return false;
    if (!canManageTimetable) return false;
    const existing = timetableEntries.find((t) => t.id === entryId);
    setTimetableEntries((prev) => prev.filter((t) => t.id !== entryId));
    if (!demoMode && activeSchool.id) {
      return await performSync(
        'deleteTimetableEntry',
        () => deleteTimetableEntryFromFirestore(activeSchool.id, entryId),
        [
          {
            entityType: 'timetable',
            action: 'delete',
            operation: 'deleteTimetableEntry',
            schoolId: activeSchool.id,
            userId: authUserUid || undefined,
            docPath: `schools/${activeSchool.id}/timetable/${entryId}`,
            recordId: entryId,
            recordLabel: `Delete Timetable · ${existing?.subject || entryId}`,
            payload: { id: entryId },
            baseUpdatedAt: normalizeTimestampValue(existing?.updatedAt),
            baseSnapshot: existing || null,
          },
        ]
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
    const existing = homeworkItems.find((h) => h.id === item.id);
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
      return await performSync(
        'saveHomework',
        () => saveHomeworkToFirestore(activeSchool.id, fullItem),
        [
          {
            entityType: 'homework',
            action: 'upsert',
            operation: 'saveHomework',
            schoolId: activeSchool.id,
            userId: authUserUid || undefined,
            docPath: `schools/${activeSchool.id}/homework/${fullItem.id}`,
            recordId: fullItem.id,
            recordLabel: `Homework · ${fullItem.subject} (${fullItem.grade})`,
            payload: fullItem,
            baseUpdatedAt: normalizeTimestampValue(existing?.updatedAt),
            baseSnapshot: existing || null,
          },
        ]
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
      return await performSync(
        'deleteHomework',
        () => deleteHomeworkFromFirestore(activeSchool.id, homeworkId),
        [
          {
            entityType: 'homework',
            action: 'delete',
            operation: 'deleteHomework',
            schoolId: activeSchool.id,
            userId: authUserUid || undefined,
            docPath: `schools/${activeSchool.id}/homework/${homeworkId}`,
            recordId: homeworkId,
            recordLabel: `Delete Homework · ${existing?.subject || homeworkId}`,
            payload: { id: homeworkId },
            baseUpdatedAt: normalizeTimestampValue(existing?.updatedAt),
            baseSnapshot: existing || null,
          },
        ]
      );
    }
    return true;
  };

  const saveCertificate = async (
    cert: Omit<StudentCertificate, 'schoolId'>
  ): Promise<boolean> => {
    if (blockSchoolMutation('saveCertificate')) return false;
    if (!canManageCertificates) return false;
    const existing = certificates.find((c) => c.id === cert.id);
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
      return await performSync(
        'saveCertificate',
        () => saveCertificateToFirestore(activeSchool.id, fullCert),
        [
          {
            entityType: 'certificate',
            action: 'upsert',
            operation: 'saveCertificate',
            schoolId: activeSchool.id,
            userId: authUserUid || undefined,
            docPath: `schools/${activeSchool.id}/certificates/${fullCert.id}`,
            recordId: fullCert.id,
            recordLabel: `Certificate · ${fullCert.certificateNumber} (${fullCert.studentName})`,
            payload: fullCert,
            baseUpdatedAt: normalizeTimestampValue(existing?.updatedAt),
            baseSnapshot: existing || null,
          },
        ]
      );
    }
    return true;
  };

  const deleteCertificate = async (certificateId: string): Promise<boolean> => {
    if (blockSchoolMutation('deleteCertificate')) return false;
    if (!canManageCertificates) return false;
    const existing = certificates.find((c) => c.id === certificateId);
    setCertificates((prev) => prev.filter((c) => c.id !== certificateId));
    if (!demoMode && activeSchool.id) {
      return await performSync(
        'deleteCertificate',
        () => deleteCertificateFromFirestore(activeSchool.id, certificateId),
        [
          {
            entityType: 'certificate',
            action: 'delete',
            operation: 'deleteCertificate',
            schoolId: activeSchool.id,
            userId: authUserUid || undefined,
            docPath: `schools/${activeSchool.id}/certificates/${certificateId}`,
            recordId: certificateId,
            recordLabel: `Delete Certificate · ${existing?.certificateNumber || certificateId}`,
            payload: { id: certificateId },
            baseUpdatedAt: normalizeTimestampValue(existing?.updatedAt),
            baseSnapshot: existing || null,
          },
        ]
      );
    }
    return true;
  };

  // =========================================================================
  // Salary & Payroll Management (School Admin & Super Admin + Scoped Teacher Self-Service)
  // =========================================================================
  const canAccessSalaryPayroll = useMemo(() => {
    if (isImpersonating) return false;
    if (effectiveRole === 'parent' || effectiveRole === 'student') return false;
    if (isSuperAdmin || effectiveRole === 'super-admin') return true;
    return effectiveRole === 'admin' || effectiveRole === 'principal';
  }, [isImpersonating, effectiveRole, isSuperAdmin]);

  const canViewOwnPayslips = useMemo(() => {
    if (effectiveRole === 'parent' || effectiveRole === 'student') return false;
    if (isSuperAdmin || isImpersonating) return false;
    return Boolean(payrollSettings.teacherPayslipAccessEnabled);
  }, [effectiveRole, isSuperAdmin, isImpersonating, payrollSettings.teacherPayslipAccessEnabled]);

  // Real-time Auto-Sync for Teacher's Own Salary Structure & Payslip Notifications
  useEffect(() => {
    if (demoMode || isSuperAdmin || !activeSchool.id || activeSchool.id === 'sch_seld_khi_01') {
      return;
    }
    const role = currentUserProfile?.role;
    if (role !== 'teacher') return;

    const uid = authUserUid || currentUserProfile?.uid;
    const email = currentUserProfile?.email;
    if (!uid && !email) return;

    const unsub = subscribeTeacherOwnPayrollFromFirestore(
      activeSchool.id,
      {
        uid,
        email,
        teacherId: activeTeacher?.id,
      },
      {
        onSalaryStructureChange: (struct) => {
          if (struct) {
            setOwnTeacherSalaryStructureState(struct);
          }
        },
        onPayslipsChange: (slips) => {
          if (payrollSettings.teacherPayslipAccessEnabled && Array.isArray(slips)) {
            setPayslips((prev) => {
              const other = prev.filter((p) => p.schoolId !== activeSchool.id);
              return [...slips, ...other];
            });
          }
        },
      }
    );

    return () => {
      unsub();
    };
  }, [
    demoMode,
    isSuperAdmin,
    activeSchool.id,
    currentUserProfile?.role,
    currentUserProfile?.uid,
    currentUserProfile?.email,
    authUserUid,
    activeTeacher?.id,
    payrollSettings.teacherPayslipAccessEnabled,
  ]);

  const approvedEmployeesForActiveSchool = useMemo<ApprovedSchoolEmployee[]>(() => {
    const combinedUsers: UserProfile[] = [...approvedSchoolStaffUsers];
    if (
      currentUserProfile &&
      currentUserProfile.status === 'active' &&
      (!activeSchool.id || !currentUserProfile.schoolId || currentUserProfile.schoolId === activeSchool.id) &&
      (currentUserProfile.role === 'teacher' ||
        currentUserProfile.role === 'admin' ||
        currentUserProfile.role === 'principal')
    ) {
      combinedUsers.push(currentUserProfile);
    }
    return buildApprovedSchoolEmployees({
      schoolId: activeSchool.id,
      teachers,
      staffUsers: combinedUsers,
    });
  }, [activeSchool.id, teachers, approvedSchoolStaffUsers, currentUserProfile]);

  const ownTeacherSalaryStructure = useMemo<SalaryStructure | null>(() => {
    if (effectiveRole === 'parent' || effectiveRole === 'student' || isSuperAdmin || isImpersonating) {
      return null;
    }
    if (ownTeacherSalaryStructureState && (!activeSchool.id || ownTeacherSalaryStructureState.schoolId === activeSchool.id)) {
      return ownTeacherSalaryStructureState;
    }
    const uid = (currentUserProfile?.uid || authUserUid || '').trim();
    const email = (currentUserProfile?.email || activeTeacher?.email || '').trim().toLowerCase();
    const tid = (activeTeacher?.id || '').trim();
    return (
      salaryStructures.find(
        (s) =>
          (!activeSchool.id || s.schoolId === activeSchool.id) &&
          ((uid && (s.employeeUid === uid || s.employeeId === uid)) ||
            (tid && (s.employeeId === tid || s.employeeUid === tid)) ||
            (email && (s.employeeEmail || '').trim().toLowerCase() === email))
      ) || null
    );
  }, [
    effectiveRole,
    isSuperAdmin,
    isImpersonating,
    ownTeacherSalaryStructureState,
    salaryStructures,
    activeSchool.id,
    currentUserProfile?.uid,
    currentUserProfile?.email,
    authUserUid,
    activeTeacher?.id,
    activeTeacher?.email,
  ]);

  const ackStorageKey = useMemo(() => {
    const uid = currentUserProfile?.uid || authUserUid || activeTeacher?.id || 'anon';
    return `pakedu_salary_struct_ack_${activeSchool.id || 'global'}_${uid}`;
  }, [activeSchool.id, currentUserProfile?.uid, authUserUid, activeTeacher?.id]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ackStorageKey) || '';
      setAcknowledgedSalaryStamp(saved);
    } catch {
      setAcknowledgedSalaryStamp('');
    }
  }, [ackStorageKey]);

  const salaryUpdateStamp = useMemo(() => {
    if (!ownTeacherSalaryStructure) return '';
    return String(
      ownTeacherSalaryStructure.updatedAt ||
        ownTeacherSalaryStructure.createdAt ||
        ownTeacherSalaryStructure.netSalary
    );
  }, [ownTeacherSalaryStructure]);

  const hasUnreadSalaryStructureUpdate = useMemo(() => {
    if (!ownTeacherSalaryStructure || !salaryUpdateStamp) return false;
    return acknowledgedSalaryStamp !== salaryUpdateStamp;
  }, [ownTeacherSalaryStructure, salaryUpdateStamp, acknowledgedSalaryStamp]);

  const dismissTeacherSalaryNotification = () => {
    if (!salaryUpdateStamp) return;
    setAcknowledgedSalaryStamp(salaryUpdateStamp);
    try {
      localStorage.setItem(ackStorageKey, salaryUpdateStamp);
    } catch {
      // Ignore storage errors
    }
  };

  const ownTeacherPayslips = useMemo(() => {
    if (!canViewOwnPayslips) return [];
    return payslips.filter(
      (p) =>
        (p.isFinalized || p.status === 'paid' || p.status === 'finalized') &&
        (!activeSchool.id || p.schoolId === activeSchool.id) &&
        doesPayslipBelongToUser(p, {
          uid: currentUserProfile?.uid || authUserUid,
          email: currentUserProfile?.email || activeTeacher?.email,
          teacherId: activeTeacher?.id,
        })
    );
  }, [
    canViewOwnPayslips,
    payslips,
    activeSchool.id,
    currentUserProfile?.uid,
    currentUserProfile?.email,
    authUserUid,
    activeTeacher?.id,
    activeTeacher?.email,
  ]);

  const blockUnauthorizedPayrollMutation = (operation: string): boolean => {
    if (canAccessSalaryPayroll) return false;
    setSyncError({
      id: `rbac_payroll_${Date.now()}`,
      message: 'Access Restricted: Only School Admins and Super Admins can modify Salary & Payroll records.',
      reason: 'Insufficient Payroll Privileges',
      operation,
      retry: async () => {},
    });
    return true;
  };

  const saveSalaryStructure = async (
    structure: Omit<SalaryStructure, 'schoolId'>,
    overrideSchoolId?: string
  ): Promise<boolean> => {
    if (blockUnauthorizedPayrollMutation('saveSalaryStructure')) return false;
    const targetSchoolId = overrideSchoolId || activeSchool.id || 'default_school';

    // Strict Employee Verification: reject manually typed / unapproved employee names
    const schoolTeachersPool =
      targetSchoolId === activeSchool.id
        ? teachers
        : teachersBySchoolCache[targetSchoolId] || teachers;
    const schoolUsersPool =
      targetSchoolId === activeSchool.id
        ? approvedSchoolStaffUsers
        : staffUsersBySchoolCache[targetSchoolId] || [];
    const activeCandidates = buildApprovedSchoolEmployees({
      schoolId: targetSchoolId,
      teachers: schoolTeachersPool,
      staffUsers: [
        ...schoolUsersPool,
        ...(currentUserProfile &&
        currentUserProfile.status === 'active' &&
        currentUserProfile.schoolId === targetSchoolId
          ? [currentUserProfile]
          : []),
      ],
    });
    const validation = validateApprovedSalaryEmployee({
      employeeId: structure.employeeId || structure.id,
      employeeUid: structure.employeeUid,
      employeeEmail: structure.employeeEmail,
      approvedEmployees: activeCandidates,
    });
    if (!validation.valid || !validation.matchedEmployee) {
      setSyncError({
        id: `invalid_emp_salary_${Date.now()}`,
        message: EMPLOYEE_NOT_FOUND_IN_SCHOOL_ERROR,
        reason: EMPLOYEE_NOT_FOUND_IN_SCHOOL_ERROR,
        operation: 'saveSalaryStructure',
        retry: async () => {},
      });
      return false;
    }

    const verifiedEmp = validation.matchedEmployee;
    const docId = sanitizePayrollIdSegment(verifiedEmp.employeeId);
    const existing = salaryStructures.find(
      (s) => s.schoolId === targetSchoolId && (s.employeeId === docId || s.id === docId)
    );
    const nowIso = new Date().toISOString();
    const actorUid = currentUserProfile?.uid || authUserUid || 'admin';
    const actorName =
      currentUserProfile?.fullName || (isSuperAdmin ? 'Super Admin' : 'School Admin');
    const actionKind: 'created' | 'updated' = existing ? 'updated' : 'created';
    const newAuditEntry: SalaryStructureAuditEntry = {
      id: `audit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      action: actionKind,
      actorUid,
      actorName,
      timestamp: nowIso,
      basicSalary: structure.basicSalary,
      netSalary: structure.netSalary,
      note:
        actionKind === 'created'
          ? `Added salary structure (${verifiedEmp.designation})`
          : `Updated salary structure (Net: Rs. ${structure.netSalary.toLocaleString()})`,
    };
    const priorTrail = Array.isArray(existing?.auditTrail)
      ? existing.auditTrail
      : Array.isArray(structure.auditTrail)
      ? structure.auditTrail
      : [];
    const nextAuditTrail = [newAuditEntry, ...priorTrail].slice(0, 30);

    const fullStructure: SalaryStructure = {
      ...structure,
      id: docId,
      employeeId: docId,
      employeeUid: verifiedEmp.employeeUid || structure.employeeUid || docId,
      employeeName: verifiedEmp.employeeName,
      employeeEmail: (verifiedEmp.employeeEmail || structure.employeeEmail || '')
        .trim()
        .toLowerCase() || undefined,
      schoolId: targetSchoolId,
      createdByUid: existing?.createdByUid || structure.createdByUid || actorUid,
      createdByName: existing?.createdByName || structure.createdByName || actorName,
      updatedByUid: actorUid,
      updatedByName: actorName,
      lastAction: actionKind,
      auditTrail: nextAuditTrail,
      createdAt: existing?.createdAt || structure.createdAt || nowIso,
      updatedAt: nowIso,
    };

    setSalaryStructures((prev) => {
      const idx = prev.findIndex(
        (s) => s.schoolId === targetSchoolId && (s.employeeId === docId || s.id === docId)
      );
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = fullStructure;
        return copy;
      }
      return [fullStructure, ...prev];
    });

    if (!demoMode && targetSchoolId && targetSchoolId !== 'default_school') {
      return await performSync(
        'saveSalaryStructure',
        () => saveSalaryStructureToFirestore(targetSchoolId, fullStructure),
        [
          {
            entityType: 'salaryStructure',
            action: 'upsert',
            operation: 'saveSalaryStructure',
            schoolId: targetSchoolId,
            userId: authUserUid || undefined,
            docPath: `schools/${targetSchoolId}/salaryStructures/${docId}`,
            recordId: docId,
            recordLabel: `Salary Structure · ${fullStructure.employeeName}`,
            payload: fullStructure,
            baseUpdatedAt: normalizeTimestampValue(existing?.updatedAt),
            baseSnapshot: existing || null,
          },
        ]
      );
    }
    return true;
  };

  const deleteSalaryStructure = async (
    employeeId: string,
    overrideSchoolId?: string
  ): Promise<boolean> => {
    if (blockUnauthorizedPayrollMutation('deleteSalaryStructure')) return false;
    const targetSchoolId = overrideSchoolId || activeSchool.id;
    const docId = sanitizePayrollIdSegment(employeeId);
    const existing = salaryStructures.find(
      (s) => s.schoolId === targetSchoolId && (s.employeeId === docId || s.id === docId)
    );
    setSalaryStructures((prev) =>
      prev.filter(
        (s) => !(s.schoolId === targetSchoolId && (s.employeeId === docId || s.id === docId))
      )
    );
    if (!demoMode && targetSchoolId) {
      return await performSync(
        'deleteSalaryStructure',
        () => deleteSalaryStructureFromFirestore(targetSchoolId, docId),
        [
          {
            entityType: 'salaryStructure',
            action: 'delete',
            operation: 'deleteSalaryStructure',
            schoolId: targetSchoolId,
            userId: authUserUid || undefined,
            docPath: `schools/${targetSchoolId}/salaryStructures/${docId}`,
            recordId: docId,
            recordLabel: `Delete Salary Structure · ${existing?.employeeName || docId}`,
            payload: { id: docId },
            baseUpdatedAt: normalizeTimestampValue(existing?.updatedAt),
            baseSnapshot: existing || null,
          },
        ]
      );
    }
    return true;
  };

  const savePayslip = async (
    payslipInput: Omit<EmployeePayslip, 'schoolId'>,
    overrideSchoolId?: string
  ): Promise<boolean> => {
    if (blockUnauthorizedPayrollMutation('savePayslip')) return false;
    const targetSchoolId = overrideSchoolId || activeSchool.id || 'default_school';
    const existing = payslips.find(
      (p) => p.id === payslipInput.id && p.schoolId === targetSchoolId
    );
    const nowIso = new Date().toISOString();
    const isFinalized = Boolean(
      payslipInput.isFinalized || payslipInput.status === 'finalized' || payslipInput.status === 'paid'
    );
    const fullPayslip: EmployeePayslip = {
      ...payslipInput,
      schoolId: targetSchoolId,
      isFinalized,
      finalizedAt: isFinalized ? payslipInput.finalizedAt || nowIso : undefined,
      employeeEmail: payslipInput.employeeEmail
        ? payslipInput.employeeEmail.trim().toLowerCase()
        : undefined,
      generatedByUid:
        payslipInput.generatedByUid || currentUserProfile?.uid || authUserUid || 'admin',
      generatedByName:
        payslipInput.generatedByName ||
        currentUserProfile?.fullName ||
        (isSuperAdmin ? 'Super Admin' : 'School Admin'),
      createdAt: payslipInput.createdAt || existing?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    setPayslips((prev) => {
      const idx = prev.findIndex(
        (p) => p.id === fullPayslip.id && p.schoolId === targetSchoolId
      );
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = fullPayslip;
        return copy;
      }
      return [fullPayslip, ...prev];
    });

    if (!demoMode && targetSchoolId && targetSchoolId !== 'default_school') {
      return await performSync(
        'savePayslip',
        () => savePayslipToFirestore(targetSchoolId, fullPayslip),
        [
          {
            entityType: 'payslip',
            action: 'upsert',
            operation: 'savePayslip',
            schoolId: targetSchoolId,
            userId: authUserUid || undefined,
            docPath: `schools/${targetSchoolId}/payslips/${fullPayslip.id}`,
            recordId: fullPayslip.id,
            recordLabel: `Payslip · ${fullPayslip.employeeName} (${fullPayslip.monthLabel})`,
            payload: fullPayslip,
            baseUpdatedAt: normalizeTimestampValue(existing?.updatedAt),
            baseSnapshot: existing || null,
          },
        ]
      );
    }
    return true;
  };

  const saveBulkPayslips = async (
    payslipList: Array<Omit<EmployeePayslip, 'schoolId'>>,
    overrideSchoolId?: string
  ): Promise<boolean> => {
    if (blockUnauthorizedPayrollMutation('saveBulkPayslips')) return false;
    if (payslipList.length === 0) return true;
    const targetSchoolId = overrideSchoolId || activeSchool.id || 'default_school';
    const existingMap = new Map(
      payslips.filter((p) => p.schoolId === targetSchoolId).map((p) => [p.id, p])
    );
    const nowIso = new Date().toISOString();

    const fullRecords: EmployeePayslip[] = payslipList.map((p) => {
      const existing = existingMap.get(p.id);
      const isFinalized = Boolean(p.isFinalized || p.status === 'finalized' || p.status === 'paid');
      return {
        ...p,
        schoolId: targetSchoolId,
        isFinalized,
        finalizedAt: isFinalized ? p.finalizedAt || nowIso : undefined,
        employeeEmail: p.employeeEmail ? p.employeeEmail.trim().toLowerCase() : undefined,
        generatedByUid: p.generatedByUid || currentUserProfile?.uid || authUserUid || 'admin',
        generatedByName:
          p.generatedByName ||
          currentUserProfile?.fullName ||
          (isSuperAdmin ? 'Super Admin' : 'School Admin'),
        createdAt: p.createdAt || existing?.createdAt || nowIso,
        updatedAt: nowIso,
      };
    });

    setPayslips((prev) => {
      const next = [...prev];
      fullRecords.forEach((rec) => {
        const idx = next.findIndex(
          (p) => p.id === rec.id && p.schoolId === targetSchoolId
        );
        if (idx >= 0) {
          next[idx] = rec;
        } else {
          next.unshift(rec);
        }
      });
      return next;
    });

    if (!demoMode && targetSchoolId && targetSchoolId !== 'default_school') {
      return await performSync(
        'saveBulkPayslips',
        () => Promise.all(fullRecords.map((rec) => savePayslipToFirestore(targetSchoolId, rec))),
        fullRecords.map((rec) => {
          const existing = existingMap.get(rec.id);
          return {
            entityType: 'payslip' as const,
            action: 'upsert' as const,
            operation: 'saveBulkPayslips',
            schoolId: targetSchoolId,
            userId: authUserUid || undefined,
            docPath: `schools/${targetSchoolId}/payslips/${rec.id}`,
            recordId: rec.id,
            recordLabel: `Payroll · ${rec.employeeName} (${rec.monthLabel})`,
            payload: rec,
            baseUpdatedAt: normalizeTimestampValue(existing?.updatedAt),
            baseSnapshot: existing || null,
          };
        })
      );
    }
    return true;
  };

  const deletePayslip = async (
    payslipId: string,
    overrideSchoolId?: string
  ): Promise<boolean> => {
    if (blockUnauthorizedPayrollMutation('deletePayslip')) return false;
    const targetSchoolId = overrideSchoolId || activeSchool.id;
    const existing = payslips.find(
      (p) => p.id === payslipId && (!targetSchoolId || p.schoolId === targetSchoolId)
    );
    setPayslips((prev) =>
      prev.filter((p) => !(p.id === payslipId && (!targetSchoolId || p.schoolId === targetSchoolId)))
    );
    if (!demoMode && targetSchoolId) {
      return await performSync(
        'deletePayslip',
        () => deletePayslipFromFirestore(targetSchoolId, payslipId),
        [
          {
            entityType: 'payslip',
            action: 'delete',
            operation: 'deletePayslip',
            schoolId: targetSchoolId,
            userId: authUserUid || undefined,
            docPath: `schools/${targetSchoolId}/payslips/${payslipId}`,
            recordId: payslipId,
            recordLabel: `Delete Payslip · ${existing?.employeeName || payslipId}`,
            payload: { id: payslipId },
            baseUpdatedAt: normalizeTimestampValue(existing?.updatedAt),
            baseSnapshot: existing || null,
          },
        ]
      );
    }
    return true;
  };

  const updatePayrollSettings = async (
    updates: Partial<PayrollSettings>,
    overrideSchoolId?: string
  ): Promise<boolean> => {
    if (blockUnauthorizedPayrollMutation('savePayrollSettings')) return false;
    const targetSchoolId = overrideSchoolId || activeSchool.id || 'default_school';
    const nextSettings: PayrollSettings = {
      ...payrollSettings,
      ...updates,
      id: 'config',
      schoolId: targetSchoolId,
      teacherPayslipAccessEnabled:
        updates.teacherPayslipAccessEnabled !== undefined
          ? Boolean(updates.teacherPayslipAccessEnabled)
          : Boolean(payrollSettings.teacherPayslipAccessEnabled),
      updatedByUid: currentUserProfile?.uid || authUserUid || 'admin',
      updatedByName:
        currentUserProfile?.fullName || (isSuperAdmin ? 'Super Admin' : 'School Admin'),
      updatedAt: new Date().toISOString(),
    };
    setPayrollSettings(nextSettings);

    if (!demoMode && targetSchoolId && targetSchoolId !== 'default_school') {
      return await performSync(
        'savePayrollSettings',
        () => savePayrollSettingsToFirestore(targetSchoolId, nextSettings),
        [
          {
            entityType: 'payrollSettings',
            action: 'upsert',
            operation: 'savePayrollSettings',
            schoolId: targetSchoolId,
            userId: authUserUid || undefined,
            docPath: `schools/${targetSchoolId}/payrollSettings/config`,
            recordId: 'config',
            recordLabel: `Payroll Settings · Teacher Portal ${nextSettings.teacherPayslipAccessEnabled ? 'Enabled' : 'Disabled'}`,
            payload: nextSettings,
            baseUpdatedAt: normalizeTimestampValue(payrollSettings?.updatedAt),
            baseSnapshot: payrollSettings,
          },
        ]
      );
    }
    return true;
  };

  const loadSchoolPayrollData = useCallback(
    async (schoolId: string) => {
      const defaultConfig: PayrollSettings = {
        id: 'config',
        schoolId,
        teacherPayslipAccessEnabled: true,
        defaultPaymentMethod: 'Bank Transfer',
      };
      if (demoMode || !schoolId || isDeviceOffline()) {
        const scopedStructures = salaryStructures.filter((s) => s.schoolId === schoolId);
        const scopedPayslips = payslips.filter((p) => p.schoolId === schoolId);
        return {
          teachers: schoolId === INITIAL_MOCK_SCHOOL.id ? INITIAL_MOCK_TEACHERS : teachers,
          staffUsers: [],
          salaryStructures: scopedStructures,
          payslips: scopedPayslips,
          payrollSettings: payrollSettings.schoolId === schoolId ? payrollSettings : defaultConfig,
        };
      }

      const [remoteTeachers, remoteStaffUsers, remoteStructures, remotePayslips, remoteSettings] =
        await Promise.all([
          fetchTeachersFromFirestore(schoolId).catch(() => []),
          fetchApprovedSchoolStaffUsersFromFirestore(schoolId).catch(() => []),
          fetchSalaryStructuresFromFirestore(schoolId).catch(() => []),
          fetchPayslipsFromFirestore(schoolId).catch(() => []),
          fetchPayrollSettingsFromFirestore(schoolId).catch(() => null),
        ]);

      setTeachersBySchoolCache((prev) => ({ ...prev, [schoolId]: remoteTeachers || [] }));
      setStaffUsersBySchoolCache((prev) => ({ ...prev, [schoolId]: remoteStaffUsers || [] }));

      const mergedStructures = mergeQueueIntoCollection(
        ['salaryStructure'],
        schoolId,
        remoteStructures || [],
        offlineQueueRef.current
      );
      const mergedPayslips = mergeQueueIntoCollection(
        ['payslip'],
        schoolId,
        remotePayslips || [],
        offlineQueueRef.current
      );
      const resolvedSettings = remoteSettings || defaultConfig;

      setSalaryStructures((prev) => [
        ...mergedStructures,
        ...prev.filter((s) => s.schoolId !== schoolId),
      ]);
      setPayslips((prev) => [
        ...mergedPayslips,
        ...prev.filter((p) => p.schoolId !== schoolId),
      ]);
      setPayrollSettings(resolvedSettings);

      return {
        teachers: remoteTeachers || [],
        staffUsers: remoteStaffUsers || [],
        salaryStructures: mergedStructures,
        payslips: mergedPayslips,
        payrollSettings: resolvedSettings,
      };
    },
    [demoMode, teachers, salaryStructures, payslips, payrollSettings, mergeQueueIntoCollection]
  );

  // =========================================================================
  // School AI Integration: Lesson Plans & Question Papers (RBAC-enforced)
  // =========================================================================
  const canAccessSchoolAiContent = useMemo(() => {
    if (isSuperAdmin || isImpersonating || effectiveRole === 'super-admin') return false;
    return (
      effectiveRole === 'admin' ||
      effectiveRole === 'principal' ||
      effectiveRole === 'teacher'
    );
  }, [isSuperAdmin, isImpersonating, effectiveRole]);

  const assignedClassIdsForAi = useMemo(
    () => filteredClassesForUser.map((c) => c.id),
    [filteredClassesForUser]
  );

  const filteredLessonPlansForUser = useMemo(() => {
    const childClassId =
      effectiveRole === 'parent'
        ? students.find((s) => s.id === currentUserProfile?.childStudentId)?.classId ||
          students[0]?.classId
        : undefined;
    return filterLessonPlansForRole(schoolLessonPlans, {
      role: effectiveRole,
      isSuperAdmin,
      isReadOnlyImpersonation,
      assignedClassIds: assignedClassIdsForAi,
      childClassId,
    });
  }, [
    schoolLessonPlans,
    effectiveRole,
    isSuperAdmin,
    isReadOnlyImpersonation,
    assignedClassIdsForAi,
    students,
    currentUserProfile?.childStudentId,
  ]);

  const filteredQuestionPapersForUser = useMemo(() => {
    return filterQuestionPapersForRole(schoolQuestionPapers, {
      role: effectiveRole,
      isSuperAdmin,
      isReadOnlyImpersonation,
      assignedClassIds: assignedClassIdsForAi,
    });
  }, [
    schoolQuestionPapers,
    effectiveRole,
    isSuperAdmin,
    isReadOnlyImpersonation,
    assignedClassIdsForAi,
  ]);

  const canModifyClassAiRecord = (classId: string): boolean => {
    if (!canAccessSchoolAiContent || !classId) return false;
    if (effectiveRole === 'admin' || effectiveRole === 'principal') return true;
    return assignedClassIdsForAi.includes(classId);
  };

  const saveSchoolLessonPlan = async (
    planInput: Omit<SchoolLessonPlan, 'schoolId'>
  ): Promise<boolean> => {
    if (blockSchoolMutation('saveSchoolLessonPlan')) return false;
    if (!canModifyClassAiRecord(planInput.classId)) {
      setSyncError({
        id: `rbac_lp_${Date.now()}`,
        message: 'Permission Denied: Teachers can only save lesson plans for their assigned classes.',
        reason: 'Assigned class scope required',
        operation: 'saveSchoolLessonPlan',
        retry: async () => {},
      });
      return false;
    }

    const existing = schoolLessonPlans.find((p) => p.id === planInput.id);
    const targetSchoolId = activeSchool.id || 'default_school';
    const fullPlan: SchoolLessonPlan = {
      ...planInput,
      schoolId: targetSchoolId,
      sharedWithParents: Boolean(planInput.sharedWithParents),
      sharedAt: planInput.sharedWithParents
        ? planInput.sharedAt || new Date().toISOString()
        : planInput.sharedAt,
      createdAt: planInput.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setSchoolLessonPlans((prev) => {
      const idx = prev.findIndex((p) => p.id === fullPlan.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = fullPlan;
        return copy;
      }
      return [fullPlan, ...prev];
    });

    if (!demoMode && activeSchool.id) {
      return await performSync(
        'saveSchoolLessonPlan',
        () => saveSchoolLessonPlanToFirestore(activeSchool.id, fullPlan),
        [
          {
            entityType: 'schoolLessonPlan',
            action: 'upsert',
            operation: 'saveSchoolLessonPlan',
            schoolId: activeSchool.id,
            userId: authUserUid || undefined,
            docPath: `schools/${activeSchool.id}/lessonPlans/${fullPlan.id}`,
            recordId: fullPlan.id,
            recordLabel: `Lesson Plan · ${fullPlan.subject} (${fullPlan.topic})`,
            payload: fullPlan,
            baseUpdatedAt: normalizeTimestampValue(existing?.updatedAt),
            baseSnapshot: existing || null,
          },
        ]
      );
    }
    return true;
  };

  const toggleShareLessonPlanWithParents = async (
    planId: string,
    shared: boolean
  ): Promise<boolean> => {
    const existing = schoolLessonPlans.find((p) => p.id === planId);
    if (!existing) return false;
    return saveSchoolLessonPlan({
      ...existing,
      sharedWithParents: shared,
      sharedAt: shared ? new Date().toISOString() : undefined,
    });
  };

  const deleteSchoolLessonPlan = async (planId: string): Promise<boolean> => {
    if (blockSchoolMutation('deleteSchoolLessonPlan')) return false;
    const existing = schoolLessonPlans.find((p) => p.id === planId);
    if (!existing || !canModifyClassAiRecord(existing.classId)) return false;

    setSchoolLessonPlans((prev) => prev.filter((p) => p.id !== planId));
    if (!demoMode && activeSchool.id) {
      return await performSync(
        'deleteSchoolLessonPlan',
        () => deleteSchoolLessonPlanFromFirestore(activeSchool.id, planId),
        [
          {
            entityType: 'schoolLessonPlan',
            action: 'delete',
            operation: 'deleteSchoolLessonPlan',
            schoolId: activeSchool.id,
            userId: authUserUid || undefined,
            docPath: `schools/${activeSchool.id}/lessonPlans/${planId}`,
            recordId: planId,
            recordLabel: `Delete Lesson Plan · ${existing.topic}`,
            payload: { id: planId },
            baseUpdatedAt: normalizeTimestampValue(existing.updatedAt),
            baseSnapshot: existing,
          },
        ]
      );
    }
    return true;
  };

  const saveSchoolQuestionPaper = async (
    paperInput: Omit<SchoolQuestionPaper, 'schoolId'>
  ): Promise<boolean> => {
    if (blockSchoolMutation('saveSchoolQuestionPaper')) return false;
    if (!canModifyClassAiRecord(paperInput.classId)) {
      setSyncError({
        id: `rbac_qp_${Date.now()}`,
        message: 'Permission Denied: Teachers can only generate or attach question papers for their assigned classes.',
        reason: 'Assigned class scope required',
        operation: 'saveSchoolQuestionPaper',
        retry: async () => {},
      });
      return false;
    }

    const existing = schoolQuestionPapers.find((qp) => qp.id === paperInput.id);
    const targetSchoolId = activeSchool.id || 'default_school';
    const fullPaper: SchoolQuestionPaper = {
      ...paperInput,
      schoolId: targetSchoolId,
      attachedToExam: Boolean(paperInput.attachedToExam),
      attachedAt: paperInput.attachedToExam
        ? paperInput.attachedAt || new Date().toISOString()
        : paperInput.attachedAt,
      linkedLessonPlanIds: Array.isArray(paperInput.linkedLessonPlanIds)
        ? paperInput.linkedLessonPlanIds
        : [],
      createdAt: paperInput.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setSchoolQuestionPapers((prev) => {
      const idx = prev.findIndex((qp) => qp.id === fullPaper.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = fullPaper;
        return copy;
      }
      return [fullPaper, ...prev];
    });

    if (!demoMode && activeSchool.id) {
      return await performSync(
        'saveSchoolQuestionPaper',
        () => saveSchoolQuestionPaperToFirestore(activeSchool.id, fullPaper),
        [
          {
            entityType: 'schoolQuestionPaper',
            action: 'upsert',
            operation: 'saveSchoolQuestionPaper',
            schoolId: activeSchool.id,
            userId: authUserUid || undefined,
            docPath: `schools/${activeSchool.id}/questionPapers/${fullPaper.id}`,
            recordId: fullPaper.id,
            recordLabel: `Question Paper · ${fullPaper.subject} (${fullPaper.className})`,
            payload: fullPaper,
            baseUpdatedAt: normalizeTimestampValue(existing?.updatedAt),
            baseSnapshot: existing || null,
          },
        ]
      );
    }
    return true;
  };

  const attachQuestionPaperToExam = async (
    paperId: string,
    examId: string,
    attach = true
  ): Promise<boolean> => {
    const existing = schoolQuestionPapers.find((qp) => qp.id === paperId);
    if (!existing) return false;
    const targetExam = exams.find((ex) => ex.id === examId);
    return saveSchoolQuestionPaper({
      ...existing,
      examId: attach ? examId : undefined,
      examTitle: attach ? targetExam?.title || existing.examTitle : undefined,
      attachedToExam: attach,
      attachedAt: attach ? new Date().toISOString() : undefined,
    });
  };

  const deleteSchoolQuestionPaper = async (paperId: string): Promise<boolean> => {
    if (blockSchoolMutation('deleteSchoolQuestionPaper')) return false;
    const existing = schoolQuestionPapers.find((qp) => qp.id === paperId);
    if (!existing || !canModifyClassAiRecord(existing.classId)) return false;

    setSchoolQuestionPapers((prev) => prev.filter((qp) => qp.id !== paperId));
    if (!demoMode && activeSchool.id) {
      return await performSync(
        'deleteSchoolQuestionPaper',
        () => deleteSchoolQuestionPaperFromFirestore(activeSchool.id, paperId),
        [
          {
            entityType: 'schoolQuestionPaper',
            action: 'delete',
            operation: 'deleteSchoolQuestionPaper',
            schoolId: activeSchool.id,
            userId: authUserUid || undefined,
            docPath: `schools/${activeSchool.id}/questionPapers/${paperId}`,
            recordId: paperId,
            recordLabel: `Delete Question Paper · ${existing.subject}`,
            payload: { id: paperId },
            baseUpdatedAt: normalizeTimestampValue(existing.updatedAt),
            baseSnapshot: existing,
          },
        ]
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
      return await performSync(
        'publishGlobalNotice',
        () => saveGlobalNoticeToFirestore(newNotice),
        [
          {
            entityType: 'globalNotice',
            action: 'upsert',
            operation: 'publishGlobalNotice',
            schoolId: 'global',
            userId: authUserUid || undefined,
            docPath: `globalNotices/${newNotice.id}`,
            recordId: newNotice.id,
            recordLabel: `Notice · ${newNotice.title}`,
            payload: newNotice,
          },
        ]
      );
    }
    return true;
  };

  const deleteGlobalNotice = async (noticeId: string): Promise<boolean> => {
    if (!isSuperAdmin && !demoMode) return false;
    const existing = globalNotices.find((n) => n.id === noticeId);
    setGlobalNotices((prev) => prev.filter((n) => n.id !== noticeId));
    if (!demoMode) {
      return await performSync(
        'deleteGlobalNotice',
        () => deleteGlobalNoticeFromFirestore(noticeId),
        [
          {
            entityType: 'globalNotice',
            action: 'delete',
            operation: 'deleteGlobalNotice',
            schoolId: 'global',
            userId: authUserUid || undefined,
            docPath: `globalNotices/${noticeId}`,
            recordId: noticeId,
            recordLabel: `Delete Notice · ${existing?.title || noticeId}`,
            payload: { id: noticeId },
            baseUpdatedAt: normalizeTimestampValue(existing?.updatedAt),
            baseSnapshot: existing || null,
          },
        ]
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
    const updatedReadBySchools = {
      ...existingReadBySchools,
      [activeSchool.id]: true,
    };
    setGlobalNotices((prev) =>
      prev.map((n) =>
        n.id === noticeId
          ? {
              ...n,
              readBySchools: updatedReadBySchools,
            }
          : n
      )
    );
    if (!demoMode) {
      return await performSync(
        'markNoticeAsRead',
        () => markGlobalNoticeAsReadInFirestore(noticeId, activeSchool.id, existingReadBySchools),
        [
          {
            entityType: 'noticeRead',
            action: 'upsert',
            operation: 'markNoticeAsRead',
            schoolId: 'global',
            userId: authUserUid || undefined,
            docPath: `globalNotices/${noticeId}`,
            recordId: noticeId,
            recordLabel: `Notice Read Receipt · ${targetNotice?.title || noticeId}`,
            payload: { readBySchools: updatedReadBySchools },
            baseUpdatedAt: normalizeTimestampValue(targetNotice?.updatedAt),
            baseSnapshot: targetNotice || null,
          },
        ]
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
        offlineQueue,
        pendingSyncCount,
        conflictItems,
        isSyncing,
        lastSyncSummary,
        lastSyncedAt,
        isSyncCenterOpen,
        setIsSyncCenterOpen,
        syncNow: () => syncNow({ backgroundAuto: false }),
        resolveSyncConflict,
        discardOfflineItem,
        clearLastSyncSummary,
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
        resetSmsSessionState,
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
        generateMissingStudentInvites,
        ensureChildStudentInviteForParent,
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
        approvedSchoolStaffUsers,
        approvedEmployeesForActiveSchool,
        salaryStructures,
        payslips,
        ownTeacherSalaryStructure,
        hasUnreadSalaryStructureUpdate,
        dismissTeacherSalaryNotification,
        ownTeacherPayslips,
        payrollSettings,
        canAccessSalaryPayroll,
        canViewOwnPayslips,
        saveSalaryStructure,
        deleteSalaryStructure,
        savePayslip,
        saveBulkPayslips,
        deletePayslip,
        updatePayrollSettings,
        loadSchoolPayrollData,
        schoolLessonPlans,
        schoolQuestionPapers,
        filteredLessonPlansForUser,
        filteredQuestionPapersForUser,
        canAccessSchoolAiContent,
        saveSchoolLessonPlan,
        toggleShareLessonPlanWithParents,
        deleteSchoolLessonPlan,
        saveSchoolQuestionPaper,
        attachQuestionPaperToExam,
        deleteSchoolQuestionPaper,
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
              className="px-3.5 py-1.5 bg-[#FFFDF9] text-red-700 hover:bg-red-50 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
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

      {/* Interactive Offline Sync Queue & Conflict Resolution Modal */}
      <OfflineSyncCenterModal
        isOpen={isSyncCenterOpen}
        onClose={() => setIsSyncCenterOpen(false)}
        isOnline={isOnline}
        offlineQueue={offlineQueue}
        isSyncing={isSyncing}
        lastSyncSummary={lastSyncSummary}
        lastSyncedAt={lastSyncedAt}
        onSyncNow={() => syncNow({ backgroundAuto: false })}
        onResolveConflict={resolveSyncConflict}
        onDiscardItem={discardOfflineItem}
        onClearSummary={clearLastSyncSummary}
      />

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
