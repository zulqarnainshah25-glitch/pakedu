/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  useNavigate,
  useLocation,
  useParams,
} from 'react-router-dom';
import { motion } from 'motion/react';
import {
  BookOpen,
  Calculator,
  FileSignature,
  Menu,
  X,
  Printer,
  LogOut,
  GraduationCap,
  Eye,
  Sparkles,
  Sun,
  Moon,
  Bell,
  UserCheck,
  Briefcase,
  ShieldCheck,
  BookCheck,
  FileSpreadsheet,
  Home,
  ArrowRight,
  School as SchoolIcon,
  Users,
  CalendarCheck2,
  CalendarDays,
  Building,
  ShieldAlert,
  Receipt,
  Award,
  FileBadge2,
  TrendingUp,
  Megaphone,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Banknote,
} from 'lucide-react';
import {
  ProtectedRoute,
  PortalAccessRole,
  RouteAccessContext,
  sanitizePostLoginRedirectPath,
  clearPostLoginRedirectPath,
} from './components/ProtectedRoute';
import { LessonPlanTool } from './components/LessonPlanTool';
import { SalaryCalculatorTool } from './components/SalaryCalculatorTool';
import { LeaveApplicationTool } from './components/LeaveApplicationTool';
import { AtlierCvTool } from './components/AtlierCvTool';
import { ServiceBookCalculatorTool } from './components/ServiceBookCalculatorTool';
import { QuestionPaperTool } from './components/QuestionPaperTool';
import { AuthModal } from './components/AuthModal';
import { triggerPrintDocument } from './utils/printDocument';
import {
  PORTAL_VERSION,
  fetchPortalVersion,
} from './utils/appVersion';
import {
  UNIFIED_FIREBASE_PROJECT_ID,
  DemoUserSession,
  isPortalAccessAllowed,
  shouldTriggerSsoLogoutFromSearch,
} from './utils/authAndSso';
import { SmsProvider, useSms } from './features/sms/context/SmsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import {
  hasAdminCapabilities,
  getRoutePathForTool,
  navigateBySmartRoute,
} from './utils/smartRouting';
import { ClassesManagement } from './features/sms/components/ClassesManagement';
import { SmsDashboard } from './features/sms/components/SmsDashboard';
import { StudentDirectory } from './features/sms/components/StudentDirectory';
import { DailyAttendanceRegister } from './features/sms/components/DailyAttendanceRegister';
import { SmsOnboarding } from './features/sms/components/SmsOnboarding';
import { TeacherManagement } from './features/sms/components/TeacherManagement';
import { TeacherProfile } from './features/sms/components/TeacherProfile';
import { SuperAdminDashboard, SuperAdminTab } from './features/sms/components/SuperAdminDashboard';
import { FeeManagement } from './features/sms/components/FeeManagement';
import { ExamsResults } from './features/sms/components/ExamsResults';
import { ParentDashboard } from './features/sms/components/ParentDashboard';
import { StudentDashboard } from './features/sms/components/StudentDashboard';
import { TimetableManager } from './features/sms/components/TimetableManager';
import { HomeworkManager } from './features/sms/components/HomeworkManager';
import { CertificatesManager } from './features/sms/components/CertificatesManager';
import { SalaryPayroll } from './features/sms/components/SalaryPayroll';

export type ActiveToolId =
  | 'dashboard'
  | 'sms-dashboard'
  | 'sms-classes'
  | 'sms-students'
  | 'sms-attendance'
  | 'sms-onboarding'
  | 'sms-staff'
  | 'sms-profile'
  | 'sms-fees'
  | 'sms-exams'
  | 'sms-timetable'
  | 'sms-homework'
  | 'sms-certificates'
  | 'sms-payroll'
  | 'sms-parent'
  | 'sms-student-portal'
  | 'super-admin'
  | 'lesson-plan'
  | 'salary-calculator'
  | 'leave-generator'
  | 'atlier-cv'
  | 'service-book'
  | 'question-paper';

interface ToolMeta {
  title: string;
  subtitle: string;
  badge: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}

const TOOL_METADATA: Record<ActiveToolId, ToolMeta> = {
  dashboard: {
    title: 'Platform Overview',
    subtitle: 'Unified AI School Management & SELD Education ERP',
    badge: 'Overview',
    icon: <Home className="w-5 h-5" />,
    iconBg: 'bg-[#FEF2F2] dark:bg-[#3F1014]/60',
    iconColor: 'text-[#7F1D1D] dark:text-[#FCA5A5]',
  },
  'sms-dashboard': {
    title: 'SMS Command Center',
    subtitle: 'Institutional metrics, class enrollment, and school administrative overview',
    badge: 'SMS Center',
    icon: <SchoolIcon className="w-5 h-5" />,
    iconBg: 'bg-[#FEF2F2] dark:bg-[#3F1014]/60',
    iconColor: 'text-[#7F1D1D] dark:text-[#FCA5A5]',
  },
  'sms-classes': {
    title: 'Classes & Sections',
    subtitle: 'Grade levels (KG–12), instruction mediums, and class teacher allocations',
    badge: 'Phase 1 Ready',
    icon: <GraduationCap className="w-5 h-5" />,
    iconBg: 'bg-[#FEF2F2] dark:bg-[#3F1014]/60',
    iconColor: 'text-[#7F1D1D] dark:text-[#FCA5A5]',
  },
  'sms-students': {
    title: 'Student Register (SIS)',
    subtitle: 'General Register (GR) admissions, B-Form records, and student demographics',
    badge: 'Active · Phase 2',
    icon: <Users className="w-5 h-5" />,
    iconBg: 'bg-[#FFF7ED] dark:bg-[#7C2D12]/60',
    iconColor: 'text-[#C2410C] dark:text-[#FDBA74]',
  },
  'sms-attendance': {
    title: 'Daily Attendance Register',
    subtitle: 'Class roll call, batch attendance, and monthly A4 attendance ledgers',
    badge: 'Active · Phase 3',
    icon: <CalendarCheck2 className="w-5 h-5" />,
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  'sms-onboarding': {
    title: 'School Institutional Onboarding',
    subtitle: 'Register your school or apply to join an existing faculty roster',
    badge: 'Verification Gateway',
    icon: <Building className="w-5 h-5" />,
    iconBg: 'bg-[#FEF2F2] dark:bg-[#3F1014]/60',
    iconColor: 'text-[#7F1D1D] dark:text-[#FCA5A5]',
  },
  'sms-staff': {
    title: 'Faculty & Teacher Management',
    subtitle: 'Manage faculty assignments and review pending teacher join requests',
    badge: 'Admin Authority',
    icon: <UserCheck className="w-5 h-5" />,
    iconBg: 'bg-[#FEF2F2] dark:bg-[#3F1014]/60',
    iconColor: 'text-[#7F1D1D] dark:text-[#FCA5A5]',
  },
  'sms-profile': {
    title: 'Teacher Profile & Portfolio',
    subtitle: 'My verified teaching credentials, assigned classes, and school info',
    badge: 'Faculty Portfolio',
    icon: <UserCheck className="w-5 h-5" />,
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  'sms-fees': {
    title: 'Fee Management & Accounts',
    subtitle: 'Dynamic class fee structures, monthly fee collection, printable vouchers, and defaulters',
    badge: 'Accounts · Phase 5',
    icon: <Receipt className="w-5 h-5" />,
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  'sms-exams': {
    title: 'Exams & Student Results',
    subtitle: 'Exam setup, subject-wise marks entry, class positions, and printable A4 report cards',
    badge: 'Academics · Phase B',
    icon: <Award className="w-5 h-5" />,
    iconBg: 'bg-[#FEF2F2] dark:bg-[#3F1014]/60',
    iconColor: 'text-[#7F1D1D] dark:text-[#FCA5A5]',
  },
  'sms-timetable': {
    title: 'Class Timetable & Schedules',
    subtitle: 'Weekly period-by-period class routine, subject teachers & mobile daily schedule',
    badge: 'Schedule · Phase D',
    icon: <CalendarDays className="w-5 h-5" />,
    iconBg: 'bg-[#FFF7ED] dark:bg-[#7C2D12]/60',
    iconColor: 'text-[#C2410C] dark:text-[#FDBA74]',
  },
  'sms-homework': {
    title: 'Homework & Class Diary',
    subtitle: 'Daily teacher homework assignments, submission due dates & class filters',
    badge: 'Academics · Phase D',
    icon: <BookOpen className="w-5 h-5" />,
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  'sms-certificates': {
    title: 'Transfer & Character Certificates',
    subtitle: 'Issue official School Leaving Certificates (TC) and Character Certificates in A4 PDF',
    badge: 'Admin · Phase D',
    icon: <FileBadge2 className="w-5 h-5" />,
    iconBg: 'bg-amber-50 dark:bg-amber-950/60',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  'sms-payroll': {
    title: 'Salary & Payroll Management',
    subtitle: 'Staff salary structures, monthly payroll calculation, printable PDF payslips & salary history',
    badge: 'Payroll · Finance',
    icon: <Banknote className="w-5 h-5" />,
    iconBg: 'bg-[#FEF2F2] dark:bg-[#3F1014]/60',
    iconColor: 'text-[#7F1D1D] dark:text-[#FCA5A5]',
  },
  'sms-parent': {
    title: 'Parent Portal & Child Progress',
    subtitle: 'Read-only student attendance, fee ledger, and published A4 exam report cards',
    badge: 'Parent Portal',
    icon: <Users className="w-5 h-5" />,
    iconBg: 'bg-[#FEF2F2] dark:bg-[#3F1014]/60',
    iconColor: 'text-[#7F1D1D] dark:text-[#FCA5A5]',
  },
  'sms-student-portal': {
    title: 'Student Portal & Academic Progress',
    subtitle: 'Read-only attendance, homework diary, class timetable, and exam report cards',
    badge: 'Student Portal',
    icon: <GraduationCap className="w-5 h-5" />,
    iconBg: 'bg-[#FFF7ED] dark:bg-[#7C2D12]/60',
    iconColor: 'text-[#C2410C] dark:text-[#FDBA74]',
  },
  'super-admin': {
    title: 'Portal Super Admin Console',
    subtitle: 'Centralized Platform Fleet Oversight · Multi-Tenant School Directory & Governance',
    badge: 'Root Super Admin',
    icon: <ShieldAlert className="w-5 h-5" />,
    iconBg: 'bg-rose-50 dark:bg-rose-950/60',
    iconColor: 'text-rose-600 dark:text-rose-400',
  },
  'lesson-plan': {
    title: 'AI Lesson Plan Generator',
    subtitle: 'Official Sindh STBB & Punjab PTB curriculum lesson plans with SLOs and assessment',
    badge: 'STBB / PTB Aligned',
    icon: <BookOpen className="w-5 h-5" />,
    iconBg: 'bg-[#FEF2F2] dark:bg-[#3F1014]/60',
    iconColor: 'text-[#7F1D1D] dark:text-[#FCA5A5]',
  },
  'salary-calculator': {
    title: 'Sindh Salary Calculator 2026',
    subtitle: 'Automated BPS-01 to BPS-22 salary, allowances, and net pay breakdown',
    badge: 'Budget 2026',
    icon: <Calculator className="w-5 h-5" />,
    iconBg: 'bg-[#FFF7ED] dark:bg-[#7C2D12]/60',
    iconColor: 'text-[#C2410C] dark:text-[#FDBA74]',
  },
  'leave-generator': {
    title: 'SELD FRAMES Leave Application',
    subtitle: 'Official Sindh Civil Service leave proformas with 38 leave categories & A4 print',
    badge: '38 Leave Types',
    icon: <FileSignature className="w-5 h-5" />,
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  'atlier-cv': {
    title: 'AtlierCV Professional Studio',
    subtitle: 'AI-Powered executive ATS resume studio with live inline editing & PDF/Word export',
    badge: 'ATS Studio',
    icon: <Briefcase className="w-5 h-5" />,
    iconBg: 'bg-[#FEF2F2] dark:bg-[#3F1014]/60',
    iconColor: 'text-[#7F1D1D] dark:text-[#FCA5A5]',
  },
  'service-book': {
    title: 'Service Book & Pension Calculator',
    subtitle: 'Qualifying service, pension estimation, JEST/HST time scale, and 365-day encashment',
    badge: 'SELD Service Book',
    icon: <BookCheck className="w-5 h-5" />,
    iconBg: 'bg-teal-50 dark:bg-teal-950/60',
    iconColor: 'text-teal-600 dark:text-teal-400',
  },
  'question-paper': {
    title: 'AI Question Paper Maker',
    subtitle: 'Class 1–12 exam paper builder with English, Urdu & Sindhi support and school logo',
    badge: 'Exam Builder',
    icon: <FileSpreadsheet className="w-5 h-5" />,
    iconBg: 'bg-[#FFF7ED] dark:bg-[#7C2D12]/60',
    iconColor: 'text-[#C2410C] dark:text-[#FDBA74]',
  },
};

const DEMO_SESSION_STORAGE_KEY = 'pakedu_seld_demo_session_v1';

export function getRouteMetaForPathname(pathname: string): { toolId: ActiveToolId; meta: ToolMeta } {
  if (pathname === '/sms') {
    return { toolId: 'sms-dashboard', meta: TOOL_METADATA['sms-dashboard'] };
  }
  if (pathname === '/sms/classes') {
    return { toolId: 'sms-classes', meta: TOOL_METADATA['sms-classes'] };
  }
  if (pathname === '/sms/students' || pathname.startsWith('/sms/students/')) {
    return { toolId: 'sms-students', meta: TOOL_METADATA['sms-students'] };
  }
  if (pathname === '/sms/attendance') {
    return { toolId: 'sms-attendance', meta: TOOL_METADATA['sms-attendance'] };
  }
  if (pathname === '/sms/onboarding') {
    return { toolId: 'sms-onboarding', meta: TOOL_METADATA['sms-onboarding'] };
  }
  if (pathname === '/sms/staff') {
    return { toolId: 'sms-staff', meta: TOOL_METADATA['sms-staff'] };
  }
  if (pathname === '/sms/profile') {
    return { toolId: 'sms-profile', meta: TOOL_METADATA['sms-profile'] };
  }
  if (pathname === '/sms/fees') {
    return { toolId: 'sms-fees', meta: TOOL_METADATA['sms-fees'] };
  }
  if (pathname === '/sms/exams' || pathname.startsWith('/sms/exams/')) {
    return { toolId: 'sms-exams', meta: TOOL_METADATA['sms-exams'] };
  }
  if (pathname === '/sms/timetable') {
    return { toolId: 'sms-timetable', meta: TOOL_METADATA['sms-timetable'] };
  }
  if (pathname === '/sms/homework') {
    return { toolId: 'sms-homework', meta: TOOL_METADATA['sms-homework'] };
  }
  if (pathname === '/sms/certificates') {
    return { toolId: 'sms-certificates', meta: TOOL_METADATA['sms-certificates'] };
  }
  if (pathname === '/sms/salary' || pathname === '/sms/payroll') {
    return { toolId: 'sms-payroll', meta: TOOL_METADATA['sms-payroll'] };
  }
  if (pathname === '/parent/dashboard') {
    return { toolId: 'sms-parent', meta: TOOL_METADATA['sms-parent'] };
  }
  if (pathname === '/student/dashboard') {
    return { toolId: 'sms-student-portal', meta: TOOL_METADATA['sms-student-portal'] };
  }
  if (pathname === '/super-admin') {
    return { toolId: 'super-admin', meta: TOOL_METADATA['super-admin'] };
  }
  if (pathname === '/teacher/lesson-planner') {
    return { toolId: 'lesson-plan', meta: TOOL_METADATA['lesson-plan'] };
  }
  if (pathname === '/teacher/question-paper') {
    return { toolId: 'question-paper', meta: TOOL_METADATA['question-paper'] };
  }
  if (pathname === '/tools/salary-calculator') {
    return { toolId: 'salary-calculator', meta: TOOL_METADATA['salary-calculator'] };
  }
  if (pathname === '/tools/leave-generator') {
    return { toolId: 'leave-generator', meta: TOOL_METADATA['leave-generator'] };
  }
  if (pathname === '/tools/atlier-cv') {
    return { toolId: 'atlier-cv', meta: TOOL_METADATA['atlier-cv'] };
  }
  if (pathname === '/tools/service-book') {
    return { toolId: 'service-book', meta: TOOL_METADATA['service-book'] };
  }
  return { toolId: 'dashboard', meta: TOOL_METADATA.dashboard };
}

export function isRoutePathMatch(pathname: string, targetPath: string): boolean {
  if (targetPath === '/sms/students') {
    return pathname === '/sms/students' || pathname.startsWith('/sms/students/');
  }
  if (targetPath === '/sms/exams') {
    return pathname === '/sms/exams' || pathname.startsWith('/sms/exams/');
  }
  if (targetPath === '/sms/salary' || targetPath === '/sms/payroll') {
    return pathname === '/sms/salary' || pathname === '/sms/payroll';
  }
  return pathname === targetPath;
}

const StudentDirectoryRoute: React.FC<{
  initialClassId?: string;
  onNavigateToAttendance: (classId?: string) => void;
}> = ({ initialClassId, onNavigateToAttendance }) => {
  const { studentId } = useParams<{ studentId?: string }>();
  const navigate = useNavigate();
  return (
    <StudentDirectory
      onBack={() => navigate('/sms')}
      onNavigateToAttendance={onNavigateToAttendance}
      initialClassId={initialClassId}
      initialStudentId={studentId}
      onOpenStudentProfile={(id) => {
        if (id) {
          navigate(`/sms/students/${id}`);
        } else {
          navigate('/sms/students');
        }
      }}
    />
  );
};

const ExamsResultsRoute: React.FC = () => {
  const { examId, studentId } = useParams<{ examId?: string; studentId?: string }>();
  const navigate = useNavigate();
  return (
    <ExamsResults
      onBack={() => navigate('/sms')}
      initialExamId={examId}
      initialReportStudentId={studentId}
      onOpenReportCardRoute={(nextExamId, nextStudentId) => {
        if (nextExamId && nextStudentId) {
          navigate(`/sms/exams/${nextExamId}/report/${nextStudentId}`);
        } else {
          navigate('/sms/exams');
        }
      }}
    />
  );
};

interface RouteErrorBoundaryProps {
  resetKey: string;
  onResetToHome: () => void;
  children: React.ReactNode;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class RouteErrorBoundary extends React.Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  constructor(props: RouteErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected error while rendering this portal route.',
    };
  }

  componentDidUpdate(prevProps: RouteErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, errorMessage: '' });
    }
  }

  componentDidCatch(error: Error) {
    console.error('[RouteErrorBoundary] Caught route render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-rose-200 dark:border-rose-800/60 rounded-2xl p-6 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[#1C1917] dark:text-[#FAF8F5]">
              Unable to Display This Module Right Now
            </h2>
            <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] max-w-md mx-auto">
              {this.state.errorMessage}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                this.props.onResetToHome();
              }}
              className="px-4 py-2 rounded-xl bg-[#7F1D1D] hover:bg-[#651414] text-white text-xs font-bold cursor-pointer"
            >
              Return to Dashboard
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') window.location.reload();
              }}
              className="px-4 py-2 rounded-xl bg-[#F3EFEA] hover:bg-[#E7E0D4] text-[#44403C] text-xs font-semibold cursor-pointer"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function AppContent() {
  const {
    userRole,
    setUserRole,
    demoMode,
    setDemoMode,
    pendingJoinRequests,
    activeSchool,
    registeredSchools,
    isSuperAdmin,
    isImpersonating,
    exitImpersonation,
    resetSmsSessionState,
    canCollectFee,
    canAccessSalaryPayroll,
    isOnline,
    pendingSyncCount,
    conflictItems,
    isSyncing,
    lastSyncSummary,
    setIsSyncCenterOpen,
    syncNow,
    clearLastSyncSummary,
    globalNotices,
    unreadNoticesCount,
    markNoticeAsRead,
  } = useSms();
  const {
    currentUser,
    currentUserProfile,
    authLoading,
    smartRoute,
    consumePostLoginRedirect,
    signOutUser,
  } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();
  const routeLocationState =
    (location.state as { routeError?: string; attemptedPath?: string; from?: string } | null) || null;
  const routeError = routeLocationState?.routeError || null;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [smsDashboardTab, setSmsDashboardTab] = useState<'overview' | 'notifications'>('overview');
  const [noticesModalOpen, setNoticesModalOpen] = useState(false);

  // Close mobile drawer and scroll to top on route navigation
  useEffect(() => {
    setMobileMenuOpen(false);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [location.pathname]);

  // Prevent background page scroll when mobile drawer is open on Android / mobile viewports
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (mobileMenuOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [mobileMenuOpen]);

  const [demoSession, setDemoSession] = useState<DemoUserSession | null>(() => {
    // Demo session is strictly disabled in production builds (gated behind DEV)
    if (!import.meta.env.DEV) {
      try {
        localStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
        sessionStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
      } catch {}
      return null;
    }
    try {
      const savedLocal = localStorage.getItem(DEMO_SESSION_STORAGE_KEY);
      if (savedLocal) return JSON.parse(savedLocal) as DemoUserSession;
      const savedSession = sessionStorage.getItem(DEMO_SESSION_STORAGE_KEY);
      return savedSession ? (JSON.parse(savedSession) as DemoUserSession) : null;
    } catch {
      return null;
    }
  });
  const [logoutNotice, setLogoutNotice] = useState<string | null>(null);
  const [isPrintPreview, setIsPrintPreview] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [portalVersion, setPortalVersion] = useState(PORTAL_VERSION);
  const [smsFilterClassId, setSmsFilterClassId] = useState<string | undefined>(undefined);
  const [smsAttendanceClassId, setSmsAttendanceClassId] = useState<string | undefined>(undefined);
  const [showPublicTools, setShowPublicTools] = useState(false);
  const [smsOnboardingTab, setSmsOnboardingTab] = useState<'register' | 'join'>('register');
  const [superAdminTab, setSuperAdminTab] = useState<SuperAdminTab>('analytics');

  const isParentUser = !demoMode && currentUserProfile?.role === 'parent';
  const isStudentUser = !demoMode && currentUserProfile?.role === 'student';

  const isSuperAdminSession =
    !demoMode &&
    Boolean(currentUser) &&
    Boolean(currentUserProfile) &&
    currentUserProfile!.uid === currentUser!.uid &&
    (Boolean(currentUserProfile?.isSuperAdmin) ||
      currentUserProfile?.role === 'super-admin' ||
      currentUser?.email?.toLowerCase() === 'owner@pakedu.com');

  const isSuperAdminActive =
    isSuperAdminSession || (demoMode && userRole === 'super-admin');

  const isAdminUser = useMemo(() => {
    if (
      currentUserProfile?.role === 'parent' ||
      currentUserProfile?.role === 'student' ||
      isSuperAdminSession
    ) {
      return false;
    }
    if (
      currentUserProfile?.status === 'pending' ||
      currentUserProfile?.status === 'rejected'
    ) {
      return false;
    }
    if (smartRoute?.role === 'admin') {
      return true;
    }
    if (currentUserProfile?.status === 'none') {
      return false;
    }
    return hasAdminCapabilities(currentUser, currentUserProfile, registeredSchools);
  }, [currentUser, currentUserProfile, registeredSchools, isSuperAdminSession, smartRoute?.role]);

  const isAffiliatedUser =
    !demoMode &&
    !isParentUser &&
    !isStudentUser &&
    !isSuperAdminSession &&
    !isImpersonating &&
    (isAdminUser ||
      (currentUserProfile?.status === 'active' && Boolean(currentUserProfile?.schoolId)));

  const effectiveRole: PortalAccessRole = useMemo(() => {
    if (isParentUser) return 'parent';
    if (isStudentUser) return 'student';
    if (isSuperAdminActive) return 'super-admin';
    if (demoMode) {
      if (userRole === 'super-admin') return 'super-admin';
      if (userRole === 'admin') return 'admin';
      return 'teacher';
    }
    if (isAdminUser || (currentUserProfile?.role === 'admin' && isAffiliatedUser)) {
      return 'admin';
    }
    if (currentUserProfile?.role === 'principal' && isAffiliatedUser) {
      return 'principal';
    }
    if (isAffiliatedUser) {
      return 'teacher';
    }
    return 'general';
  }, [
    isParentUser,
    isStudentUser,
    isSuperAdminActive,
    demoMode,
    userRole,
    isAdminUser,
    currentUserProfile?.role,
    isAffiliatedUser,
  ]);

  const defaultHomePath = useMemo(() => {
    if (isParentUser) return '/parent/dashboard';
    if (isStudentUser) return '/student/dashboard';
    if (isSuperAdminActive) return isImpersonating ? '/sms' : '/super-admin';
    if (isAffiliatedUser && !showPublicTools) return '/sms';
    return '/dashboard';
  }, [isParentUser, isStudentUser, isSuperAdminActive, isImpersonating, isAffiliatedUser, showPublicTools]);

  const isRouteActive = useCallback(
    (targetPath: string) => isRoutePathMatch(location.pathname, targetPath),
    [location.pathname]
  );

  const { meta: currentToolMeta } = useMemo(
    () => getRouteMetaForPathname(location.pathname),
    [location.pathname]
  );

  const routeAccessContext: RouteAccessContext = useMemo(
    () => ({
      isAuthenticated: Boolean(currentUser || (import.meta.env.DEV && demoSession)),
      isInitializing: authLoading,
      effectiveRole,
      isAffiliated: isAffiliatedUser,
      isImpersonating,
      canCollectFee,
      canAccessSalaryPayroll,
      demoMode,
    }),
    [
      currentUser,
      demoSession,
      authLoading,
      effectiveRole,
      isAffiliatedUser,
      isImpersonating,
      canCollectFee,
      canAccessSalaryPayroll,
      demoMode,
    ]
  );

  // If Super Admin navigates back to /super-admin via browser history while impersonating, end read-only impersonation cleanly
  useEffect(() => {
    if (isSuperAdminActive && isImpersonating && location.pathname === '/super-admin') {
      exitImpersonation();
    }
  }, [isSuperAdminActive, isImpersonating, location.pathname, exitImpersonation]);

  useEffect(() => {
    let active = true;
    fetchPortalVersion().then((info) => {
      if (active && info.version) {
        setPortalVersion(info.version);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const hasInitialRoutedRef = useRef<string | null>(null);

  const performUnifiedLogout = useCallback(async (customNotice?: string) => {
    hasInitialRoutedRef.current = null;
    setDemoSession(null);
    setDemoMode(false);
    setSuperAdminTab('analytics');
    setShowPublicTools(false);
    setSmsFilterClassId(undefined);
    setSmsAttendanceClassId(undefined);
    setMobileMenuOpen(false);
    setUserRole('teacher');
    exitImpersonation();
    resetSmsSessionState();
    clearPostLoginRedirectPath();
    try {
      localStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
      localStorage.removeItem('sms_current_user_profile');
      localStorage.removeItem('sms_user_role');
      localStorage.removeItem('demo_user_session');
      sessionStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
      sessionStorage.removeItem('pakedu_active_tool');
      sessionStorage.removeItem('pakedu_signup_sms_role');
      if (
        typeof window !== 'undefined' &&
        window.location.protocol !== 'file:' &&
        (window.location.pathname !== '/' || window.location.search)
      ) {
        window.history.replaceState({}, document.title, '/');
      }
    } catch {
      // Ignore storage errors
    }
    try {
      await signOutUser();
    } catch (err) {
      console.error('Sign-out error:', err);
    }
    navigate('/', { replace: true });
    setAuthModalMode('signin');
    setLogoutNotice(
      customNotice ||
        'Aap successfully Logout ho chuke hain. Portal kholne ke liye dobara Sign In karein.'
    );
  }, [signOutUser, setDemoMode, setUserRole, exitImpersonation, resetSmsSessionState, navigate]);

  // Listen to SSO query parameters (logout trigger only)
  useEffect(() => {
    const searchStr = typeof window !== 'undefined' ? window.location.search : '';
    const triggeredByAtlierLogout = shouldTriggerSsoLogoutFromSearch(searchStr);

    if (triggeredByAtlierLogout && typeof window !== 'undefined') {
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
      performUnifiedLogout(
        'Aap successfully Logout ho chuke hain. Dobara access ke liye Sign In karein.'
      );
    }
  }, [performUnifiedLogout]);

  // Automatic Smart Login Routing System & Role Transition Reset (React Router navigate)
  useEffect(() => {
    if (!authLoading && currentUser && currentUserProfile && currentUserProfile.uid === currentUser.uid && smartRoute) {
      setLogoutNotice(null);

      const resolvedSuperAdmin =
        smartRoute.targetTool === 'super-admin' ||
        smartRoute.role === 'super-admin' ||
        Boolean(currentUserProfile.isSuperAdmin) ||
        currentUserProfile.role === 'super-admin' ||
        Boolean(currentUser.email && currentUser.email.toLowerCase() === 'owner@pakedu.com');

      // Super Admin Impersonation: only preserve while an actual Super Admin is impersonating
      if (isImpersonating && resolvedSuperAdmin) {
        return;
      }

      // Force-exit stale impersonation if a non-super-admin account logged in
      if (isImpersonating && !resolvedSuperAdmin) {
        exitImpersonation();
      }

      const routeSignature = `${currentUser.uid}:${currentUserProfile.role || ''}:${currentUserProfile.status || ''}:${smartRoute.targetTool}`;
      const previousSignature = hasInitialRoutedRef.current;
      if (previousSignature === routeSignature) {
        return;
      }
      hasInitialRoutedRef.current = routeSignature;
      setShowPublicTools(false);
      setSuperAdminTab('analytics');

      const resolvedRoute = resolvedSuperAdmin
        ? { ...smartRoute, targetTool: 'super-admin' as const, targetPath: '/super-admin', role: 'super-admin' as const }
        : smartRoute.targetTool === 'sms-onboarding'
        ? { ...smartRoute, targetPath: '/sms/onboarding' }
        : smartRoute.role === 'admin' || isAdminUser
        ? { ...smartRoute, targetTool: 'sms-dashboard' as const, targetPath: '/sms', role: 'admin' as const }
        : { ...smartRoute, targetPath: smartRoute.targetPath || getRoutePathForTool(smartRoute.targetTool) };

      if (resolvedSuperAdmin) {
        setUserRole('super-admin');
      } else if (smartRoute.role === 'admin' || isAdminUser) {
        setUserRole('admin');
      } else {
        setUserRole(smartRoute.role);
      }

      const isAtLandingEntry =
        location.pathname === '/' ||
        location.pathname === '' ||
        location.pathname.endsWith('/index.html');

      const savedRedirect =
        consumePostLoginRedirect() ||
        sanitizePostLoginRedirectPath(
          routeLocationState?.from || routeLocationState?.attemptedPath
        );

      if (savedRedirect) {
        navigate(savedRedirect, { replace: true });
      } else if (isAtLandingEntry || previousSignature !== null) {
        navigateBySmartRoute(navigate, resolvedRoute, { replace: true });
      }
    } else if (!currentUser) {
      hasInitialRoutedRef.current = null;
    }
  }, [
    authLoading,
    currentUser,
    currentUserProfile,
    smartRoute,
    consumePostLoginRedirect,
    routeLocationState?.from,
    routeLocationState?.attemptedPath,
    isImpersonating,
    isAdminUser,
    setUserRole,
    exitImpersonation,
    location.pathname,
    navigate,
  ]);

  const handleDemoSessionSuccess = (session: DemoUserSession) => {
    // Demo sessions are strictly restricted to local development environments
    if (!import.meta.env.DEV) return;
    setDemoSession(session);
    setLogoutNotice(null);
    try {
      localStorage.setItem(DEMO_SESSION_STORAGE_KEY, JSON.stringify(session));
      sessionStorage.setItem(DEMO_SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Ignore storage errors
    }
    const savedRedirect =
      consumePostLoginRedirect() ||
      sanitizePostLoginRedirectPath(
        routeLocationState?.from || routeLocationState?.attemptedPath
      );
    setUserRole('teacher');
    navigate(savedRedirect || '/dashboard', { replace: true });
  };

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) {
      document.body.classList.add('dark-mode');
      document.documentElement.classList.add('dark');
    } else {
      document.body.classList.remove('dark-mode');
      document.documentElement.classList.remove('dark');
    }
  };

  const togglePrintPreview = () => {
    const nextState = !isPrintPreview;
    setIsPrintPreview(nextState);
    if (nextState) {
      document.body.classList.add('printing-mode');
    } else {
      document.body.classList.remove('printing-mode');
    }
  };

  const openAuthModal = (mode: 'signin' | 'signup' = 'signin') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const handleSignupSuccess = (
    intent: 'general' | 'sms' | 'parent' | 'student',
    smsRole?: 'admin' | 'teacher'
  ) => {
    clearPostLoginRedirectPath();
    if (intent === 'parent') {
      setUserRole('parent');
      navigate('/parent/dashboard', { replace: true });
      return;
    }
    if (intent === 'student') {
      setUserRole('student');
      navigate('/student/dashboard', { replace: true });
      return;
    }
    if (intent === 'sms') {
      const targetTab = smsRole === 'teacher' ? 'join' : 'register';
      setSmsOnboardingTab(targetTab);
      try {
        sessionStorage.setItem('pakedu_signup_sms_role', targetTab);
      } catch {}
      navigate('/sms/onboarding', { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  };

  // Mandatory Login Gate Check
  const portalAccess = isPortalAccessAllowed({
    currentUser,
    demoSession,
    authInitializing: authLoading,
  });

  if (portalAccess.isInitializing) {
    return (
      <div
        className="min-h-[100dvh] w-[100vw] max-w-full flex flex-col items-center justify-center px-[6vw] py-[5vh] text-[#FAF8F5] relative overflow-hidden select-none"
        style={{
          background: 'linear-gradient(145deg, #2C1215 0%, #58181D 55%, #3F1014 100%)',
        }}
      >
        <div className="allforu-progress-bar" />

        {/* Ambient responsive glow orbs (viewport-bounded so zero clipping on mobile) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-[12vh] -right-[12vw] w-[55vw] h-[55vw] max-w-[320px] max-h-[320px] rounded-full bg-[#C2410C]/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-[12vh] -left-[12vw] w-[55vw] h-[55vw] max-w-[320px] max-h-[320px] rounded-full bg-[#B45309]/15 blur-3xl"
        />

        <div className="relative z-10 w-full max-w-[90vw] sm:max-w-md flex flex-col items-center justify-center text-center space-y-4">
          {/* Responsive animated emblem */}
          <div className="relative flex items-center justify-center">
            <div className="pakedu-splash-ring w-20 h-20 sm:w-24 sm:h-24 rounded-3xl border border-[#FED7AA]/30 bg-[#FFFDF9]/10 backdrop-blur-md flex items-center justify-center shadow-2xl">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-[#7F1D1D] to-[#C2410C] flex items-center justify-center shadow-lg">
                <ShieldCheck className="w-7 h-7 sm:w-8 sm:h-8 text-[#FFFDF9]" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFFDF9]/10 border border-[rgba(255,253,249,0.18)] text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#FED7AA]">
              PakEdu · SELD Enterprise ERP
            </span>
            <h1 className="text-[clamp(1.125rem,4.5vw,1.5rem)] font-extrabold tracking-tight text-[#FAF8F5] leading-snug">
              Launching Your School Workspace
            </h1>
            <p className="text-xs sm:text-sm text-[#E7E0D4] leading-relaxed max-w-[32ch] mx-auto">
              Verifying secure institutional session and syncing modules...
            </p>
          </div>

          {/* Mobile-safe indeterminate progress shimmer */}
          <div className="w-[68vw] max-w-[240px] h-1.5 rounded-full bg-[#FFFDF9]/15 overflow-hidden">
            <div className="pakedu-splash-bar h-full w-1/2 rounded-full bg-gradient-to-r from-[#7F1D1D] via-[#C2410C] to-[#B45309]" />
          </div>

          <p className="text-[10px] font-mono text-[#D6CCC2]">
            Unified ID · {UNIFIED_FIREBASE_PROJECT_ID}
          </p>
        </div>
      </div>
    );
  }

  if (portalAccess.mustShowLoginGate) {
    const loginRedirectHint =
      logoutNotice ||
      (routeLocationState?.from
        ? `Please sign in to continue to ${routeLocationState.from}.`
        : routeError);
    return (
      <Routes>
        <Route
          path="/"
          element={
            <AuthModal
              isOpen={true}
              isMandatoryGate={true}
              logoutNotice={loginRedirectHint}
              onClose={() => {}}
              onDemoSessionSuccess={handleDemoSessionSuccess}
              onSignupSuccess={handleSignupSuccess}
              initialMode={authModalMode}
            />
          }
        />
        <Route
          path="*"
          element={
            <ProtectedRoute
              access={{
                isAuthenticated: false,
                isInitializing: false,
                effectiveRole: 'general',
              }}
            >
              <></>
            </ProtectedRoute>
          }
        />
      </Routes>
    );
  }

  const activeUserDisplay = currentUser
    ? currentUser.displayName || currentUser.email
    : demoSession
    ? `${demoSession.displayName}`
    : 'Authenticated Educator';

  const shellIdentityKey = `${currentUser?.uid || demoSession?.uid || 'anon'}-${currentUserProfile?.role || userRole}`;

  return (
    <div
      key={shellIdentityKey}
      className={`min-h-screen flex flex-col lg:flex-row transition-colors w-full max-w-full overflow-x-hidden ${
        darkMode ? 'bg-[#160D0E] text-[#FAF8F5]' : 'bg-[#FAF8F5] text-[#1C1917]'
      }`}
    >
      {/* Top 3px Progress / Accent Bar */}
      <div className="allforu-progress-bar no-print" />

      {/* Optional Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onDemoSessionSuccess={handleDemoSessionSuccess}
        onSignupSuccess={handleSignupSuccess}
        initialMode={authModalMode}
      />

      {/* Floating Exit Button when in A4 Print Preview Mode */}
      {isPrintPreview && (
        <div className="fixed bottom-20 lg:bottom-5 right-3 sm:right-5 z-50 flex items-center gap-2 bg-[#2C1215] text-white px-4 py-2.5 rounded-xl shadow-lg border border-[rgba(255,253,249,0.14)]">
          <span className="text-xs font-medium">A4 Print Mode Active</span>
          <button
            type="button"
            onClick={triggerPrintDocument}
            className="px-3 py-1 text-xs font-semibold bg-[#7F1D1D] hover:bg-[#651414] rounded-lg cursor-pointer"
          >
            Send to Printer
          </button>
          <button
            type="button"
            onClick={togglePrintPreview}
            className="px-3 py-1 text-xs font-semibold bg-white/15 hover:bg-[#FFFDF9]/25 rounded-lg cursor-pointer"
          >
            Exit Preview
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* DESKTOP & MOBILE SIDEBAR NAVIGATION (Deep Espresso-Burgundy)        */}
      {/* =================================================================== */}
      <aside
        className={`app-sidebar no-print fixed inset-y-0 left-0 z-50 w-[272px] lg:w-72 h-[100dvh] max-h-[100dvh] overflow-y-auto overscroll-contain bg-[#2C1215] border-r border-[rgba(255,253,249,0.10)] text-[#FAF8F5] flex flex-col justify-between transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:z-30 lg:translate-x-0 shrink-0 shadow-xl ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
          {/* Sidebar Brand Header */}
          <div className="px-3 py-4 border-b border-[rgba(255,253,249,0.10)] flex items-center justify-between gap-2">
            <Link
              to={defaultHomePath}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 flex-1 min-w-0 pr-2 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-[#C2410C] text-[#FFFDF9] flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                <GraduationCap className="w-5 h-5 text-[#FFFDF9]" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-lg font-bold tracking-tight text-[#FAF8F5] leading-none block truncate">
                  PakEdu
                </span>
                <span className="text-[11px] text-[#D6CCC2] block mt-1 truncate">
                  Sindh SELD Portal
                </span>
              </div>
              <span className="shrink-0 ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wider uppercase bg-[#C2410C]/25 text-[#FED7AA] border border-[#C2410C]/40">
                ENTERPRISE
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden shrink-0 p-1.5 text-[#D6CCC2] hover:text-[#FAF8F5] rounded-lg cursor-pointer"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tool Navigation Links */}
          <div className="px-3 py-3 space-y-1 overflow-x-hidden">
            {/* Dashboard / Home Link - HIDDEN for Affiliated Staff Users, Parents, Students & Super Admin */}
            {!isParentUser && !isStudentUser && !isSuperAdminActive && (!isAffiliatedUser || showPublicTools) && (
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className={`w-full flex items-center justify-between gap-2 py-2.5 pr-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                  isRouteActive('/dashboard')
                    ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-2.5'
                    : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3'
                }`}
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                  <Home className={`w-4 h-4 shrink-0 ${isRouteActive('/dashboard') ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate">Platform Overview</span>
                    <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                      ERP Suite Dashboard
                    </span>
                  </div>
                </div>
              </Link>
            )}

            {/* Strict Read-Only Parent Portal Section */}
            {isParentUser && (
              <>
                <div className="pt-2 pb-1 px-2.5 text-[10px] font-bold uppercase tracking-wider text-[#FED7AA] flex items-center justify-between gap-2">
                  <span className="truncate flex-1 min-w-0 pr-2">Parent Portal</span>
                  <span className="shrink-0 ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wider uppercase font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Read-Only
                  </span>
                </div>
                <Link
                  to="/parent/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full flex items-center justify-between gap-2 py-2.5 pr-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    isRouteActive('/parent/dashboard')
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-2.5'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                    <Users className="w-4 h-4 shrink-0 text-[#FED7AA]" />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate">Child Progress Portal</span>
                      <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                        Attendance, Fees &amp; Results
                      </span>
                    </div>
                  </div>
                </Link>
              </>
            )}

            {/* Strict Read-Only Student Portal Section */}
            {isStudentUser && (
              <>
                <div className="pt-2 pb-1 px-2.5 text-[10px] font-bold uppercase tracking-wider text-[#FED7AA] flex items-center justify-between gap-2">
                  <span className="truncate flex-1 min-w-0 pr-2">Student Portal</span>
                  <span className="shrink-0 ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wider uppercase font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Read-Only
                  </span>
                </div>
                <Link
                  to="/student/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full flex items-center justify-between gap-2 py-2.5 pr-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    isRouteActive('/student/dashboard')
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-2.5'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                    <GraduationCap className="w-4 h-4 shrink-0 text-[#FED7AA]" />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate">My Student Portal</span>
                      <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                        Attendance, Homework &amp; Results
                      </span>
                    </div>
                  </div>
                </Link>
              </>
            )}

            {/* Affiliated School Context Card (Shown for Verified School Users; excluded for Super Admin) */}
            {isAffiliatedUser && !isSuperAdminActive && (
              <div className="mb-2 p-3 rounded-xl bg-[#3F1014]/90 border border-[#7F1D1D]/30 text-xs overflow-hidden">
                <div className="flex items-center justify-between gap-2 text-[10px] text-[#FED7AA] font-bold uppercase tracking-wider mb-1.5">
                  <span className="flex items-center gap-1.5 flex-1 min-w-0 pr-2 truncate">
                    <Building className="w-3.5 h-3.5 text-[#FED7AA] shrink-0" />
                    <span className="truncate">School Workspace</span>
                  </span>
                  <span className="shrink-0 ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wider font-mono bg-[#7F1D1D]/20 text-[#FED7AA] border border-[#7F1D1D]/30">
                    {activeSchool?.semisCode || 'SEMIS'}
                  </span>
                </div>
                <div className="font-semibold text-white truncate text-xs" title={activeSchool?.name || currentUserProfile?.schoolName}>
                  {activeSchool?.name || currentUserProfile?.schoolName || 'Govt. High School'}
                </div>
                <div className="mt-2 pt-2 border-t border-[rgba(255,253,249,0.10)] flex items-center justify-between gap-2 text-[11px]">
                  <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wider uppercase ${
                    userRole === 'admin'
                      ? 'bg-[#7F1D1D]/20 text-[#FED7AA]'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    {userRole === 'admin' ? '👑 School Admin' : '🧑‍🏫 Faculty'}
                  </span>
                  <Link
                    to="/sms/onboarding"
                    onClick={() => setMobileMenuOpen(false)}
                    className="shrink-0 ml-auto text-[#FED7AA] hover:text-[#FAF8F5] font-semibold hover:underline cursor-pointer"
                  >
                    Switch School
                  </Link>
                </div>
              </div>
            )}

            {/* Strict Super Admin Sidebar: ONLY Platform Overview, Super Admin Fleet, Notice Board & Salary/Payroll */}
            {isSuperAdminActive && !isImpersonating && (
              <>
                <div className="pt-1 pb-1 px-2.5 text-[10px] font-bold uppercase tracking-wider text-rose-400 flex items-center justify-between gap-2">
                  <span className="truncate flex-1 min-w-0 pr-2">Platform Governance</span>
                  <span className="shrink-0 ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wider uppercase font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    Super Admin
                  </span>
                </div>

                <Link
                  to="/super-admin"
                  onClick={() => {
                    setSuperAdminTab('analytics');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 py-2.5 pr-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    isRouteActive('/super-admin') && superAdminTab === 'analytics'
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-2.5'
                      : 'text-[#E7E0D4] hover:text-white hover:bg-[#58181D]/60 pl-3'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                    <TrendingUp className={`w-4 h-4 shrink-0 ${isRouteActive('/super-admin') && superAdminTab === 'analytics' ? 'text-[#FED7AA]' : 'text-[#D6CCC2]'}`} />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">Platform Overview</span>
                      <span className="text-[11px] block truncate text-[#D6CCC2]">
                        Analytics &amp; System KPIs
                      </span>
                    </div>
                  </div>
                </Link>

                <Link
                  to="/super-admin"
                  onClick={() => {
                    setSuperAdminTab('directory');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 py-2.5 pr-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    isRouteActive('/super-admin') && (superAdminTab === 'directory' || superAdminTab === 'pending_requests')
                      ? 'bg-[#7F1D1D] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-2.5'
                      : 'text-rose-200/80 hover:text-white hover:bg-rose-950/40 pl-3'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                    <ShieldAlert className={`w-4 h-4 shrink-0 ${isRouteActive('/super-admin') && (superAdminTab === 'directory' || superAdminTab === 'pending_requests') ? 'text-rose-400' : 'text-rose-400/80'}`} />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-rose-200">Super Admin Fleet</span>
                      <span className="text-[11px] block truncate text-[#D6CCC2]">
                        Schools Directory &amp; Approvals
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wider uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    Root
                  </span>
                </Link>

                <Link
                  to="/super-admin"
                  onClick={() => {
                    setSuperAdminTab('notices');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 py-2.5 pr-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    isRouteActive('/super-admin') && superAdminTab === 'notices'
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-2.5'
                      : 'text-[#E7E0D4] hover:text-white hover:bg-[#58181D]/60 pl-3'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                    <Megaphone className={`w-4 h-4 shrink-0 ${isRouteActive('/super-admin') && superAdminTab === 'notices' ? 'text-amber-400' : 'text-[#D6CCC2]'}`} />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">Notice Board</span>
                      <span className="text-[11px] block truncate text-[#D6CCC2]">
                        Global Announcements
                      </span>
                    </div>
                  </div>
                </Link>

                <Link
                  to="/sms/salary"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full flex items-center justify-between gap-2 py-2.5 pr-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    isRouteActive('/sms/salary')
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-2.5'
                      : 'text-[#E7E0D4] hover:text-white hover:bg-[#58181D]/60 pl-3'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                    <Banknote className={`w-4 h-4 shrink-0 ${isRouteActive('/sms/salary') ? 'text-[#FED7AA]' : 'text-[#D6CCC2]'}`} />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">Salary &amp; Payroll</span>
                      <span className="text-[11px] block truncate text-[#D6CCC2]">
                        Structures, Payslips &amp; History
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wider uppercase bg-[#7F1D1D]/20 text-[#FED7AA] border border-[#7F1D1D]/30">
                    Payroll
                  </span>
                </Link>
              </>
            )}

            {isSuperAdminActive && isImpersonating && (
              <>
                <div className="mb-2 p-3 rounded-xl bg-amber-950/60 border border-amber-500/40 text-xs overflow-hidden">
                  <div className="text-[10px] text-amber-300 font-bold uppercase tracking-wider mb-1">
                    Read-Only School View
                  </div>
                  <div className="font-semibold text-white truncate">{activeSchool?.name}</div>
                  <div className="text-[11px] text-amber-200/80 mt-0.5 truncate">SEMIS {activeSchool?.semisCode}</div>
                </div>
                <Link
                  to="/sms"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center justify-between gap-2 py-2.5 pr-2.5 rounded-xl text-left text-sm bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-2.5 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                    <Eye className="w-4 h-4 shrink-0 text-amber-400" />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate">School Admin View</span>
                      <span className="text-[11px] block truncate text-[#D6CCC2]">Strict Read-Only Oversight</span>
                    </div>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    exitImpersonation();
                    setSuperAdminTab('directory');
                    navigate('/super-admin', { replace: true });
                  }}
                  className="w-full flex items-center justify-between gap-2 py-2.5 pr-2.5 rounded-xl text-left text-sm text-rose-300 hover:text-white hover:bg-rose-950/40 pl-3 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                    <ArrowRight className="w-4 h-4 shrink-0 rotate-180" />
                    <span className="truncate font-semibold">Exit Read-Only View</span>
                  </div>
                </button>
              </>
            )}

            {/* ======================================================= */}
            {/* SECTION: SCHOOL MANAGEMENT SYSTEM (SMS)                */}
            {/* Strictly hidden for Super Admin & Parents              */}
            {/* ======================================================= */}
            {(isAffiliatedUser || (demoMode && userRole !== 'super-admin')) && !isSuperAdminActive && (
              <>
                <div className="pt-2 pb-1 px-2.5 text-[10px] font-bold uppercase tracking-wider text-[#FED7AA] flex items-center justify-between gap-2">
                  <span className="truncate flex-1 min-w-0 pr-2">{isAffiliatedUser ? 'School Operations' : 'School Management (SMS)'}</span>
                  {demoMode ? (
                    <span className={`shrink-0 ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wider uppercase font-mono ${
                      userRole === 'admin'
                        ? 'bg-[#7F1D1D]/20 text-[#FED7AA] border border-[#7F1D1D]/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}>
                      {userRole === 'admin' ? '👑 Admin (Demo)' : '🧑‍🏫 Teacher (Demo)'}
                    </span>
                  ) : isAffiliatedUser ? (
                    <span className="shrink-0 ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wider uppercase font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      Verified
                    </span>
                  ) : (
                    <span className="shrink-0 ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wider uppercase font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      Super Admin
                    </span>
                  )}
                </div>
                {/* SMS Command Center / My Dashboard */}
                <Link
                  to="/sms"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full flex items-center justify-between gap-2 py-2.5 pr-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    isRouteActive('/sms')
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-2.5'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                    <SchoolIcon className={`w-4 h-4 shrink-0 ${isRouteActive('/sms') ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate">
                        {userRole === 'teacher' ? 'My Dashboard' : 'SMS Command Center'}
                      </span>
                      <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                        {userRole === 'teacher' ? 'Teaching Overview & Schedule' : 'School Admin & Overview'}
                      </span>
                    </div>
                  </div>
                </Link>

                {/* Classes & Sections / My Classes */}
                <Link
                  to="/sms/classes"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full flex items-center justify-between gap-2 py-2.5 pr-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    isRouteActive('/sms/classes')
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-2.5'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                    <GraduationCap className={`w-4 h-4 shrink-0 ${isRouteActive('/sms/classes') ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate">
                        {userRole === 'teacher' ? 'My Classes' : 'Classes & Sections'}
                      </span>
                      <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                        {userRole === 'admin' ? 'Manage KG–12 & Incharges' : 'Assigned Sections & Subjects'}
                      </span>
                    </div>
                  </div>
                  <span className={`shrink-0 ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wider uppercase ${
                    userRole === 'admin'
                      ? 'bg-[#7F1D1D]/20 text-[#FED7AA] border border-[#7F1D1D]/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {userRole === 'admin' ? 'Admin' : 'Assigned'}
                  </span>
                </Link>

                {/* Student Register (SIS) / My Students */}
                <Link
                  to="/sms/students"
                  onClick={() => {
                    setSmsFilterClassId(undefined);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 py-2.5 pr-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    isRouteActive('/sms/students')
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-2.5'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                    <Users className={`w-4 h-4 shrink-0 ${isRouteActive('/sms/students') ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate">
                        {userRole === 'teacher' ? 'My Students' : 'Student Register (SIS)'}
                      </span>
                      <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                        {userRole === 'teacher' ? 'Assigned Class Students' : 'GR Admissions & B-Form'}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {userRole === 'teacher' ? 'Roster' : 'Active'}
                  </span>
                </Link>

                {/* Daily Attendance Register / Take Attendance */}
                <Link
                  to="/sms/attendance"
                  onClick={() => {
                    setSmsAttendanceClassId(undefined);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 py-2.5 pr-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    isRouteActive('/sms/attendance')
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-2.5'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                    <CalendarCheck2 className={`w-4 h-4 shrink-0 ${isRouteActive('/sms/attendance') ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate">
                        {userRole === 'teacher' ? 'Take Attendance' : 'Daily Attendance'}
                      </span>
                      <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                        {userRole === 'teacher' ? 'Daily Section Register' : 'Roll Call & A4 Register'}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {userRole === 'teacher' ? 'Roll Call' : 'Active'}
                  </span>
                </Link>

                {/* Exams & Results (Admin Setup + Teacher Assigned-Class Marks) */}
                <Link
                  to="/sms/exams"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full flex items-center justify-between gap-2 py-2.5 pr-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    isRouteActive('/sms/exams')
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-2.5'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                    <Award className={`w-4 h-4 shrink-0 ${isRouteActive('/sms/exams') ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate">Exams &amp; Results</span>
                      <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                        {userRole === 'teacher' ? 'Marks Entry & Report Cards' : 'Exam Setup, Marks & PDF Cards'}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wider uppercase bg-[#7F1D1D]/20 text-[#FED7AA] border border-[#7F1D1D]/30">
                    {userRole === 'teacher' ? 'Marks' : 'Phase B'}
                  </span>
                </Link>

                {/* Phase D: Class Timetable */}
                <Link
                  to="/sms/timetable"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full flex items-center justify-between gap-2 py-2.5 pr-2.5 min-h-[44px] rounded-xl text-left text-sm transition-all cursor-pointer ${
                    isRouteActive('/sms/timetable')
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-2.5'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                    <CalendarDays className={`w-4 h-4 shrink-0 ${isRouteActive('/sms/timetable') ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate">Timetable &amp; Routine</span>
                      <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                        {userRole === 'admin' ? 'Build Period Schedule' : 'Class Period Routine'}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wider uppercase bg-[#C2410C]/20 text-[#FED7AA] border border-[#C2410C]/30">
                    Phase D
                  </span>
                </Link>

                {/* Phase D: Daily Homework Diary */}
                <Link
                  to="/sms/homework"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full flex items-center justify-between gap-2 py-2.5 pr-2.5 min-h-[44px] rounded-xl text-left text-sm transition-all cursor-pointer ${
                    isRouteActive('/sms/homework')
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-2.5'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                    <BookOpen className={`w-4 h-4 shrink-0 ${isRouteActive('/sms/homework') ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate">Homework &amp; Diary</span>
                      <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                        Daily Subject Assignments
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Diary
                  </span>
                </Link>

                {/* Phase D (Admin Only): Transfer & Character Certificates */}
                {userRole === 'admin' && (
                  <Link
                    to="/sms/certificates"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`w-full flex items-center justify-between gap-2 py-2.5 pr-2.5 min-h-[44px] rounded-xl text-left text-sm transition-all cursor-pointer ${
                      isRouteActive('/sms/certificates')
                        ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-2.5'
                        : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                      <FileBadge2 className={`w-4 h-4 shrink-0 ${isRouteActive('/sms/certificates') ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate">Certificates (TC / CC)</span>
                        <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                          Transfer &amp; Character A4
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Admin
                    </span>
                  </Link>
                )}

                {/* Admin Only: Faculty Management & Join Requests */}
                {userRole === 'admin' && (
                  <Link
                    to="/sms/staff"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`w-full flex items-center justify-between gap-2 py-2.5 pr-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                      isRouteActive('/sms/staff')
                        ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-2.5'
                        : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                      <UserCheck className={`w-4 h-4 shrink-0 ${isRouteActive('/sms/staff') ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate">Faculty &amp; Requests</span>
                        <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                          Incharges &amp; Approvals
                        </span>
                      </div>
                    </div>
                    {pendingJoinRequests.length > 0 ? (
                      <span className="shrink-0 ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                        {pendingJoinRequests.length} Pending
                      </span>
                    ) : (
                      <span className="shrink-0 ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wider uppercase bg-[#7F1D1D]/20 text-[#FED7AA] border border-[#7F1D1D]/30">
                        Admin
                      </span>
                    )}
                  </Link>
                )}

                {/* Fee Management (Admin & Admission Incharge) */}
                {canCollectFee && (
                  <Link
                    to="/sms/fees"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`w-full flex items-center justify-between gap-2 py-2.5 pr-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                      isRouteActive('/sms/fees')
                        ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-2.5'
                        : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                      <Receipt className={`w-4 h-4 shrink-0 ${isRouteActive('/sms/fees') ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate">Fee Management</span>
                        <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                          Structure, Vouchers &amp; Reports
                        </span>
                      </div>
                    </div>
                    <span className={`shrink-0 ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wider uppercase ${
                      userRole === 'admin'
                        ? 'bg-[#7F1D1D]/20 text-[#FED7AA] border border-[#7F1D1D]/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {userRole === 'admin' ? 'Accounts' : 'Incharge'}
                    </span>
                  </Link>
                )}

                {/* Salary & Payroll (School Admin Only) */}
                {canAccessSalaryPayroll && (
                  <Link
                    to="/sms/salary"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`w-full flex items-center justify-between gap-2 py-2.5 pr-2.5 min-h-[44px] rounded-xl text-left text-sm transition-all cursor-pointer ${
                      isRouteActive('/sms/salary')
                        ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-2.5'
                        : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                      <Banknote className={`w-4 h-4 shrink-0 ${isRouteActive('/sms/salary') ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate">Salary &amp; Payroll</span>
                        <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                          Structures, Payslips &amp; History
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wider uppercase bg-[#7F1D1D]/20 text-[#FED7AA] border border-[#7F1D1D]/30">
                      Admin
                    </span>
                  </Link>
                )}

                {/* Teacher Profile & Portfolio / My Profile */}
                <Link
                  to="/sms/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full flex items-center justify-between gap-2 py-2.5 pr-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    isRouteActive('/sms/profile')
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-2.5'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                    <ShieldCheck className={`w-4 h-4 shrink-0 ${isRouteActive('/sms/profile') ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate">
                        {userRole === 'teacher' ? 'My Profile' : 'My School Profile'}
                      </span>
                      <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                        {userRole === 'teacher' ? 'Institutional Credentials & Roles' : 'Admin Credentials & School Info'}
                      </span>
                    </div>
                  </div>
                </Link>

                {/* School Onboarding / Switch School (Admin / Demo Only) */}
                {(userRole === 'admin' || demoMode) && (
                  <Link
                    to="/sms/onboarding"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`w-full flex items-center justify-between gap-2 py-2.5 pr-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                      isRouteActive('/sms/onboarding')
                        ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-2.5'
                        : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                      <Building className={`w-4 h-4 shrink-0 ${isRouteActive('/sms/onboarding') ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate">{isAffiliatedUser ? 'Switch / Add School' : 'Join / Register School'}</span>
                        <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                          Affiliation &amp; Verification
                        </span>
                      </div>
                    </div>
                  </Link>
                )}
              </>
            )}

            {/* If Affiliated and in Focused SMS Mode, show a clean toggle to explore general tools */}
            {isAffiliatedUser && !showPublicTools && (
              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => setShowPublicTools(true)}
                  className="w-full py-2 px-2.5 rounded-xl border border-dashed border-[rgba(255,253,249,0.10)] hover:border-[rgba(255,253,249,0.28)] bg-[#2C1215]/40 hover:bg-[#58181D]/50 text-[#D6CCC2] hover:text-[#FAF8F5] text-xs font-medium flex items-center justify-between gap-2 transition cursor-pointer"
                >
                  <span className="truncate flex-1 min-w-0 pr-2 text-left">Explore Public Tools</span>
                  <span className="shrink-0 ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wider text-[#FED7AA]">AI Studio →</span>
                </button>
              </div>
            )}

            {/* If Affiliated and currently viewing public tools, provide button to return to focused mode */}
            {isAffiliatedUser && showPublicTools && (
              <div className="pt-2">
                <Link
                  to="/sms"
                  onClick={() => {
                    setShowPublicTools(false);
                    setMobileMenuOpen(false);
                  }}
                  className="w-full py-2 px-2.5 rounded-xl bg-[#7F1D1D]/20 hover:bg-[#651414]/30 border border-[#7F1D1D]/40 text-[#FED7AA] text-xs font-medium flex items-center justify-between gap-2 transition cursor-pointer"
                >
                  <span className="truncate flex-1 min-w-0 pr-2 text-left">← Return to School SMS</span>
                  <span className="shrink-0 ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wider uppercase bg-[#7F1D1D]/30">Focused</span>
                </Link>
              </div>
            )}

            {/* ======================================================= */}
            {/* SECTION: TEACHER'S AI STUDIO (EXISTING TOOLS)           */}
            {/* HIDDEN for Parents, Students, Super Admin & Staff       */}
            {/* ======================================================= */}
            {!isParentUser && !isStudentUser && !isSuperAdminActive && (!isAffiliatedUser || showPublicTools) && (
              <>
                <div className="pt-4 pb-1 px-2.5 text-[10px] font-bold uppercase tracking-wider text-[#D6CCC2]/75 flex items-center justify-between gap-2">
                  <span className="truncate flex-1 min-w-0 pr-2">Teacher's AI Studio</span>
                  {isAffiliatedUser && (
                    <span className="shrink-0 ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wider uppercase text-[#FED7AA] bg-[#7F1D1D]/20 border border-[#7F1D1D]/30">Public</span>
                  )}
                </div>

                {/* MODULE 1: AI Lesson Plan */}
                <Link
                  to="/teacher/lesson-planner"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full flex items-center justify-between gap-2 py-2.5 pr-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    isRouteActive('/teacher/lesson-planner')
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-2.5'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                    <BookOpen className={`w-4 h-4 shrink-0 ${isRouteActive('/teacher/lesson-planner') ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate">1. AI Lesson Planner</span>
                      <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                        STBB / PTB Plans
                      </span>
                    </div>
                  </div>
                </Link>

                {/* MODULE 2: Salary Calculator */}
                <Link
                  to="/tools/salary-calculator"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full flex items-center justify-between gap-2 py-2.5 pr-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    isRouteActive('/tools/salary-calculator')
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-2.5'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                    <Calculator className={`w-4 h-4 shrink-0 ${isRouteActive('/tools/salary-calculator') ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate">2. Sindh Salary Calculator</span>
                      <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                        Budget 2026 · BPS-01 to 22
                      </span>
                    </div>
                  </div>
                </Link>

                {/* MODULE 3: Leave Application */}
                <Link
                  to="/tools/leave-generator"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full flex items-center justify-between gap-2 py-2.5 pr-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    isRouteActive('/tools/leave-generator')
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-2.5'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                    <FileSignature className={`w-4 h-4 shrink-0 ${isRouteActive('/tools/leave-generator') ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate">3. SELD FRAMES Leave</span>
                      <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                        38 Leave Types · A4 Proforma
                      </span>
                    </div>
                  </div>
                </Link>

                {/* MODULE 4: AtlierCV Studio */}
                <Link
                  to="/tools/atlier-cv"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full flex items-center justify-between gap-2 py-2.5 pr-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    isRouteActive('/tools/atlier-cv')
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-2.5'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                    <Briefcase className={`w-4 h-4 shrink-0 ${isRouteActive('/tools/atlier-cv') ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate">4. AtlierCV Studio</span>
                      <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                        AI Resume Studio
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wider uppercase bg-[#7F1D1D]/20 text-[#FED7AA] border border-[#7F1D1D]/30">
                    ATS
                  </span>
                </Link>

                {/* MODULE 5: Service Book Calculator */}
                <Link
                  to="/tools/service-book"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full flex items-center justify-between gap-2 py-2.5 pr-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    isRouteActive('/tools/service-book')
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-2.5'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                    <BookCheck className={`w-4 h-4 shrink-0 ${isRouteActive('/tools/service-book') ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate">5. Service Book &amp; Pension</span>
                      <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                        Time Scale &amp; 365d Leave
                      </span>
                    </div>
                  </div>
                </Link>

                {/* MODULE 6: AI Question Paper Maker */}
                <Link
                  to="/teacher/question-paper"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full flex items-center justify-between gap-2 py-2.5 pr-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    isRouteActive('/teacher/question-paper')
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-2.5'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                    <FileSpreadsheet className={`w-4 h-4 shrink-0 ${isRouteActive('/teacher/question-paper') ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate">6. AI Question Paper</span>
                      <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                        Class 1–12 Exam Maker
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wider uppercase bg-[#7F1D1D]/20 text-[#FED7AA] border border-[#7F1D1D]/30">
                    AI
                  </span>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Sidebar Footer: Unified Auth Card */}
        <div className="shrink-0 p-4 border-t border-[rgba(255,253,249,0.10)] bg-black/20 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xs min-w-0">
              <span className="text-emerald-400 text-[10px] font-semibold uppercase tracking-wider block">
                Verified Session
              </span>
              <span className="font-semibold text-white truncate block">
                {activeUserDisplay}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => performUnifiedLogout()}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-[#E7E0D4] hover:text-white bg-[#3F1014] hover:bg-rose-600/80 rounded-xl transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="no-print fixed inset-0 z-40 bg-[#2C1215]/60 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* =================================================================== */}
      {/* MAIN WORKSPACE VIEWPORT                                             */}
      {/* =================================================================== */}
      <div className="app-main-wrapper flex-1 flex flex-col min-w-0 w-full max-w-full overflow-x-hidden">
        {/* Impersonation Mode Banner */}
        {isImpersonating && (
          <div className="no-print bg-amber-400 text-[#1C1917] px-4 sm:px-6 py-2.5 text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2 truncate">
              <ShieldAlert className="w-4 h-4 text-[#1C1917] shrink-0" />
              <span className="truncate">
                <strong>You are viewing as School Admin - Read Only</strong> · <strong>{activeSchool.name}</strong> (SEMIS {activeSchool.semisCode})
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                exitImpersonation();
                navigate('/super-admin', { replace: true });
              }}
              className="px-3 py-1 bg-[#2C1215] hover:bg-[#58181D] text-white rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ml-2"
            >
              Exit Read-Only View →
            </button>
          </div>
        )}

        {/* Persistent Demo Mode Sandbox Banner */}
        {demoMode && (
          <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-[#1C1917] px-4 py-2 text-xs font-semibold flex items-center justify-between sticky top-0 z-30 shadow-md">
            <div className="flex items-center gap-2">
              <span className="bg-[#2C1215] text-amber-300 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider">
                🧪 Demo Sandbox Mode
              </span>
              <span className="hidden sm:inline">
                You are currently exploring in Demo Sandbox Mode. Sample school data is loaded and changes are not saved to the cloud.
              </span>
              <span className="sm:hidden">
                Demo Mode — Data is not saved.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setDemoMode(false)}
              className="bg-[#2C1215] hover:bg-[#58181D] text-white font-bold text-xs px-3 py-1 rounded-lg transition-colors cursor-pointer shrink-0 ml-3"
            >
              Exit Demo Mode ✕
            </button>
          </div>
        )}

        {/* Offline Status Banner (Red / Orange Visual Indicator) */}
        {!isOnline && (
          <div
            role="status"
            className="no-print bg-gradient-to-r from-red-600 via-orange-600 to-red-600 text-white px-4 sm:px-6 py-2.5 text-xs font-semibold flex flex-wrap items-center justify-between gap-2 shadow-sm"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <WifiOff className="w-4 h-4 text-orange-100 shrink-0 animate-pulse" />
              <span>
                You are offline. Data is saved locally and will sync when online.
              </span>
              {pendingSyncCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black/25 text-orange-100 border border-white/20 shrink-0">
                  {pendingSyncCount} Queued
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsSyncCenterOpen(true)}
                className="px-3 py-1 rounded-lg bg-[#FFFDF9]/15 hover:bg-[#FFFDF9]/25 text-white text-xs font-bold border border-white/25 transition cursor-pointer"
              >
                View Queue
              </button>
              <button
                type="button"
                onClick={() => void syncNow()}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#FFFDF9] text-red-700 hover:bg-orange-50 text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Sync Now</span>
              </button>
            </div>
          </div>
        )}

        {/* Online Pending Queue / Conflict Warning Banner */}
        {isOnline && !demoMode && (pendingSyncCount > 0 || conflictItems.length > 0) && (
          <div
            role="status"
            className={`no-print px-4 sm:px-6 py-2.5 text-xs font-semibold flex flex-wrap items-center justify-between gap-2 shadow-sm ${
              conflictItems.length > 0
                ? 'bg-rose-600 text-white'
                : 'bg-orange-500 text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {conflictItems.length > 0 ? (
                <AlertTriangle className="w-4 h-4 text-amber-200 shrink-0" />
              ) : (
                <Cloud className="w-4 h-4 text-orange-100 shrink-0" />
              )}
              <span>
                {conflictItems.length > 0
                  ? `Sync conflict detected on ${conflictItems.length} record(s) modified online while you were offline.`
                  : `Back online! ${pendingSyncCount} locally saved change(s) ready to push to Firestore.`}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsSyncCenterOpen(true)}
                className="px-3 py-1 rounded-lg bg-black/20 hover:bg-black/30 text-white text-xs font-bold border border-white/25 transition cursor-pointer"
              >
                {conflictItems.length > 0 ? 'Resolve Conflicts' : 'Inspect Queue'}
              </button>
              <button
                type="button"
                onClick={() => void syncNow()}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-lg bg-[#FFFDF9] text-[#7F1D1D] hover:bg-orange-50 text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Recent Sync Results Summary Banner */}
        {isOnline &&
          pendingSyncCount === 0 &&
          lastSyncSummary &&
          lastSyncSummary.totalProcessed > 0 && (
            <div className="no-print bg-emerald-600 text-white px-4 sm:px-6 py-2 text-xs font-semibold flex flex-wrap items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-100 shrink-0" />
                <span>
                  Offline queue synced: {lastSyncSummary.syncedCount} item(s) pushed to Firestore successfully
                  {lastSyncSummary.failedCount > 0 ? ` (${lastSyncSummary.failedCount} failed)` : ''}.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSyncCenterOpen(true)}
                  className="px-2.5 py-0.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold cursor-pointer"
                >
                  View Sync Report
                </button>
                <button
                  type="button"
                  onClick={clearLastSyncSummary}
                  className="p-1 hover:bg-emerald-700 rounded-md text-emerald-100 hover:text-white cursor-pointer"
                  aria-label="Dismiss sync report"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

        {/* Top Navbar */}
        <header className="app-topbar no-print bg-[#FFFDF9] dark:bg-[#211415] border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.12)] shadow-2xs px-3 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2 sm:gap-3 sticky top-0 z-20 w-full max-w-full">
          <div className="flex items-center gap-2 sm:gap-3 shrink min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 -ml-1 text-[#57534E] dark:text-[#E7E0D4] hover:text-[#1C1917] rounded-lg cursor-pointer shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm min-w-0 truncate">
              <Link
                to={defaultHomePath}
                className="font-medium text-[#57534E] dark:text-[#D6CCC2] hover:text-[#651414] dark:hover:text-[#FED7AA] cursor-pointer shrink-0"
              >
                PakEdu
              </Link>
              <span className="text-[#78716C] shrink-0">/</span>
              <span className="font-semibold text-[#1C1917] dark:text-[#FAF8F5] truncate max-w-[120px] sm:max-w-[200px]">
                {currentToolMeta.title}
              </span>
            </div>

            {/* If Parent, Student, Affiliated, or Read-Only Oversight: Show Connected School Badge in Header */}
            {(isAffiliatedUser || isParentUser || isStudentUser || isImpersonating) && (
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FEF2F2]/80 dark:bg-[#3F1014]/40 border border-[#FECACA]/80 dark:border-[#7F1D1D]/60 text-xs shrink-0">
                <Building className="w-3.5 h-3.5 text-[#7F1D1D] dark:text-[#FCA5A5] shrink-0" />
                <span className="font-semibold text-[#1C1917] dark:text-[#FAF8F5] truncate max-w-[160px]" title={activeSchool?.name || currentUserProfile?.schoolName}>
                  {activeSchool?.name || currentUserProfile?.schoolName || 'School Portal'}
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#FEE2E2]/70 dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5]">
                  {isParentUser || isStudentUser || isImpersonating ? 'READ-ONLY' : `SEMIS ${activeSchool?.semisCode || '401020304'}`}
                </span>
              </div>
            )}
          </div>

          {/* Center Horizontal Quick Links (Large Screens) */}
          <nav className="hidden xl:flex items-center gap-1 text-xs font-medium text-[#57534E] dark:text-[#D6CCC2]">
            {isParentUser ? (
              <Link
                to="/parent/dashboard"
                className="px-3 py-1.5 rounded-t-lg border-b-2 border-[#C2410C] bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold cursor-pointer"
              >
                Parent Portal (Read-Only)
              </Link>
            ) : isStudentUser ? (
              <Link
                to="/student/dashboard"
                className="px-3 py-1.5 rounded-t-lg border-b-2 border-[#C2410C] bg-[#FFF7ED] dark:bg-[#2C1215] text-[#C2410C] dark:text-[#FDBA74] font-bold cursor-pointer"
              >
                Student Portal (Read-Only)
              </Link>
            ) : isSuperAdminActive ? (
              isImpersonating ? (
                <>
                  <Link
                    to="/sms"
                    className="px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold cursor-pointer"
                  >
                    School Admin View (Read-Only)
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      exitImpersonation();
                      setSuperAdminTab('directory');
                      navigate('/super-admin', { replace: true });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#2C1215] text-white font-semibold hover:bg-[#58181D] cursor-pointer"
                  >
                    Exit Read-Only View
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/super-admin"
                    onClick={() => setSuperAdminTab('analytics')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      isRouteActive('/super-admin') && superAdminTab === 'analytics'
                        ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                        : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                    }`}
                  >
                    Platform Overview
                  </Link>
                  <Link
                    to="/super-admin"
                    onClick={() => setSuperAdminTab('directory')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      isRouteActive('/super-admin') && (superAdminTab === 'directory' || superAdminTab === 'pending_requests')
                        ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                        : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                    }`}
                  >
                    Super Admin Fleet
                  </Link>
                  <Link
                    to="/super-admin"
                    onClick={() => setSuperAdminTab('notices')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      isRouteActive('/super-admin') && superAdminTab === 'notices'
                        ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                        : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                    }`}
                  >
                    Notice Board
                  </Link>
                  <Link
                    to="/sms/salary"
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      isRouteActive('/sms/salary')
                        ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                        : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                    }`}
                  >
                    Salary &amp; Payroll
                  </Link>
                </>
              )
            ) : isAffiliatedUser && !showPublicTools ? (
              <>
                <Link
                  to="/sms"
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    isRouteActive('/sms')
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  {userRole === 'teacher' ? 'My Dashboard' : 'Command Center'}
                </Link>
                <Link
                  to="/sms/classes"
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    isRouteActive('/sms/classes')
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  {userRole === 'teacher' ? 'My Classes' : 'Classes'}
                </Link>
                <Link
                  to="/sms/students"
                  onClick={() => setSmsFilterClassId(undefined)}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    isRouteActive('/sms/students')
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  {userRole === 'teacher' ? 'My Students' : 'Students'}
                </Link>
                <Link
                  to="/sms/attendance"
                  onClick={() => setSmsAttendanceClassId(undefined)}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    isRouteActive('/sms/attendance')
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  {userRole === 'teacher' ? 'Take Attendance' : 'Attendance'}
                </Link>
                <Link
                  to="/sms/exams"
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    isRouteActive('/sms/exams')
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  Exams &amp; Results
                </Link>
                <Link
                  to="/sms/timetable"
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    isRouteActive('/sms/timetable')
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  Timetable
                </Link>
                <Link
                  to="/sms/homework"
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    isRouteActive('/sms/homework')
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  Homework
                </Link>
                {userRole === 'admin' && (
                  <Link
                    to="/sms/certificates"
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      isRouteActive('/sms/certificates')
                        ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                        : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                    }`}
                  >
                    Certificates
                  </Link>
                )}
                {userRole === 'admin' && (
                  <Link
                    to="/sms/staff"
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      isRouteActive('/sms/staff')
                        ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                        : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                    }`}
                  >
                    Faculty
                  </Link>
                )}
                {canCollectFee && (
                  <Link
                    to="/sms/fees"
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      isRouteActive('/sms/fees')
                        ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                        : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                    }`}
                  >
                    Fees &amp; Accounts
                  </Link>
                )}
                {canAccessSalaryPayroll && (
                  <Link
                    to="/sms/salary"
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      isRouteActive('/sms/salary')
                        ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                        : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                    }`}
                  >
                    Payroll
                  </Link>
                )}
                <Link
                  to="/sms/profile"
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    isRouteActive('/sms/profile')
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  My Profile
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/dashboard"
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    isRouteActive('/dashboard')
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  Overview
                </Link>
                <Link
                  to={demoMode || isAffiliatedUser ? '/sms' : '/sms/onboarding'}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    location.pathname.startsWith('/sms')
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  {isAffiliatedUser ? 'School Operations' : demoMode ? 'School SMS' : 'Join School'}
                </Link>
                <Link
                  to="/teacher/lesson-planner"
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    isRouteActive('/teacher/lesson-planner')
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  Lesson Plans
                </Link>
                <Link
                  to="/tools/salary-calculator"
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    isRouteActive('/tools/salary-calculator')
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  Salary
                </Link>
                <Link
                  to="/tools/leave-generator"
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    isRouteActive('/tools/leave-generator')
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  Leave
                </Link>
                <Link
                  to="/tools/atlier-cv"
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    isRouteActive('/tools/atlier-cv')
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  CV Studio
                </Link>
                <Link
                  to="/tools/service-book"
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    isRouteActive('/tools/service-book')
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  Service Book
                </Link>
                <Link
                  to="/teacher/question-paper"
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    isRouteActive('/teacher/question-paper')
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  Exam Maker
                </Link>
              </>
            )}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap justify-end">
            {/* Prominent Cloud / Offline Sync Status & Sync Now Trigger */}
            {!demoMode && (currentUser || pendingSyncCount > 0 || !isOnline) && (
              <div className="flex items-center gap-1">
                {conflictItems.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setIsSyncCenterOpen(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-full shadow-xs transition cursor-pointer animate-pulse"
                    title="Resolve offline sync conflicts"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Conflicts ({conflictItems.length})</span>
                  </button>
                ) : !isOnline || pendingSyncCount > 0 || isSyncing ? (
                  <button
                    type="button"
                    onClick={() => void syncNow()}
                    disabled={isSyncing}
                    className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 text-xs font-bold rounded-full shadow-xs transition cursor-pointer disabled:opacity-60 ${
                      !isOnline
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-[#C2410C] hover:bg-[#9A3412] text-[#FFFDF9]'
                    }`}
                    title={
                      !isOnline
                        ? 'Offline: Data saved locally. Click Sync Now when reconnected.'
                        : `Sync ${pendingSyncCount} locally queued change(s) to Firestore`
                    }
                  >
                    <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>
                      {isSyncing ? 'Syncing...' : 'Sync Now'}
                      {pendingSyncCount > 0 ? ` (${pendingSyncCount})` : ''}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsSyncCenterOpen(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/60 rounded-full transition cursor-pointer"
                    title="All data synced. Open Offline Sync Center"
                  >
                    <Cloud className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden md:inline">Sync Now</span>
                  </button>
                )}
              </div>
            )}

            {/* Quick RBAC Role Switcher: DEMO ONLY */}
            {demoMode && (
              <div className="flex items-center gap-0.5 sm:gap-1 bg-amber-50 dark:bg-amber-950/40 p-1 rounded-xl text-xs font-semibold border border-amber-200 dark:border-amber-800 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setDemoMode(false)}
                  className="px-1.5 sm:px-2 py-0.5 rounded-lg text-[9px] sm:text-[10px] font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition cursor-pointer"
                  title="Click to exit Demo Mode and return to Real Mode"
                >
                  🧪 Demo ON
                </button>
                <div className="w-[1px] h-3 bg-amber-200 dark:bg-amber-800" />
                <button
                  type="button"
                  onClick={() => {
                    setUserRole('admin');
                    if (isRouteActive('/super-admin')) {
                      navigate('/sms');
                    }
                  }}
                  className={`px-1.5 sm:px-2 py-0.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[9px] sm:text-[10px] ${
                    userRole === 'admin'
                      ? 'bg-[#7F1D1D] text-white shadow-xs font-bold'
                      : 'text-[#57534E] dark:text-[#D6CCC2] hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                  title="Switch to School Administrator View"
                >
                  <span>👑 Admin</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUserRole('teacher');
                    if (isRouteActive('/super-admin') || isRouteActive('/sms/salary')) {
                      navigate('/sms');
                    }
                  }}
                  className={`px-1.5 sm:px-2 py-0.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[9px] sm:text-[10px] ${
                    userRole === 'teacher'
                      ? 'bg-emerald-600 text-white shadow-xs font-bold'
                      : 'text-[#57534E] dark:text-[#D6CCC2] hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                  title="Switch to Class Teacher View"
                >
                  <span>🧑‍🏫 Teacher</span>
                </button>
                <div className="hidden sm:block w-[1px] h-3 bg-amber-200 dark:bg-amber-800" />
                <button
                  type="button"
                  onClick={() => {
                    setUserRole('super-admin');
                    navigate('/super-admin');
                  }}
                  className={`hidden sm:flex px-2 py-0.5 rounded-lg transition-all cursor-pointer items-center gap-1 text-[10px] ${
                    userRole === 'super-admin'
                      ? 'bg-rose-600 text-white shadow-xs font-bold'
                      : 'text-[#57534E] dark:text-[#D6CCC2] hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                  title="Switch to Portal Super Admin View"
                >
                  <span>🛡️ Super Admin</span>
                </button>
              </div>
            )}

            {/* In Real Production Mode: Clean User Header with Logout */}
            {currentUser ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-[#44403C] dark:text-[#FAF8F5] bg-[#F3EFEA] dark:bg-[#2C1215]/90 border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-full"
                  title="Verified Educator Session"
                >
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="max-w-28 sm:max-w-36 truncate">{activeUserDisplay}</span>
                  {currentUserProfile?.status === 'active' && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-[#FEE2E2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5]">
                      {currentUserProfile.role === 'super-admin'
                        ? 'Super Admin'
                        : currentUserProfile.role === 'admin' || currentUserProfile.role === 'principal'
                        ? 'Admin'
                        : currentUserProfile.role === 'parent'
                        ? 'Parent'
                        : currentUserProfile.role === 'student'
                        ? 'Student'
                        : 'Teacher'}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => performUnifiedLogout()}
                  className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200/80 dark:border-rose-800/60 rounded-full transition-colors cursor-pointer"
                  title="Logout from Account"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : !demoMode ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openAuthModal('signin')}
                  className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-[#7F1D1D] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#3F1014]/50 hover:bg-[#FEE2E2] dark:hover:bg-[#58181D]/60 border border-[#FECACA] dark:border-[#7F1D1D]/60 rounded-full transition-colors cursor-pointer"
                >
                  <span>Sign In</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDemoMode(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 rounded-full transition-colors cursor-pointer"
                  title="Try Demo Sandbox Mode"
                >
                  <span>🧪 Try Demo</span>
                </button>
              </div>
            ) : null}

            <button
              type="button"
              onClick={toggleDarkMode}
              className="p-1.5 sm:p-2 rounded-full text-[#57534E] dark:text-[#E7E0D4] hover:bg-[#F3EFEA] dark:hover:bg-[#3F1014] transition-colors cursor-pointer"
              aria-label="Toggle Dark Mode"
              title="Toggle Light / Dark Theme"
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-[#44403C]" />
              )}
            </button>

            <button
              type="button"
              onClick={togglePrintPreview}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#44403C] dark:text-[#FAF8F5] bg-[#F3EFEA] dark:bg-[#2C1215] hover:bg-[#E7E0D4] rounded-full transition-colors whitespace-nowrap cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              A4 Preview
            </button>

            <button
              type="button"
              onClick={triggerPrintDocument}
              className="hidden xs:inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 text-xs font-semibold text-white bg-[#2C1215] hover:bg-[#58181D] dark:bg-[#C2410C] dark:hover:bg-[#9A3412] rounded-full transition-colors whitespace-nowrap cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print / PDF</span>
            </button>
          </div>
        </header>

        {/* Main Content Container */}
        <main className="app-content-container flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 pt-4 pb-24 lg:py-6 space-y-5 sm:space-y-6 min-w-0 overflow-x-hidden">
          {/* Route Authorization / Access Error Banner */}
          {routeError && (
            <div
              role="alert"
              className="no-print bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-rose-900 dark:text-rose-200 rounded-xl px-4 py-3 text-xs font-semibold flex items-center justify-between gap-3 shadow-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{routeError}</span>
              </div>
              <button
                type="button"
                onClick={() => navigate(location.pathname, { replace: true, state: null })}
                className="p-1 rounded-lg hover:bg-rose-200/60 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 cursor-pointer shrink-0"
                aria-label="Dismiss route access notice"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Animated Updates Ticker */}
          <div className="no-print flex items-center bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-xl shadow-xs overflow-hidden">
            <div className="bg-[#2C1215] dark:bg-[#2C1215] text-white px-3.5 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 shrink-0 z-10">
              <Bell className="w-3.5 h-3.5 text-[#FED7AA]" />
              <span>Updates</span>
            </div>
            <div className="flex-1 overflow-hidden relative py-2">
              <div className="allforu-ticker-track items-center gap-8 text-xs font-medium text-[#57534E] dark:text-[#E7E0D4]">
                <Link
                  to="/tools/atlier-cv"
                  className="inline-flex items-center gap-2 px-4 cursor-pointer hover:text-[#651414]"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#7F1D1D]" />
                  <span>AtlierCV Studio now locally integrated! Build ATS-ready resumes with AI.</span>
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-[#FEF2F2] text-[#7F1D1D] dark:bg-[#3F1014]/60 dark:text-[#FCA5A5] border border-[#FECACA]/60 dark:border-[#7F1D1D]/60">
                    NEW
                  </span>
                </Link>
                <Link
                  to="/tools/salary-calculator"
                  className="inline-flex items-center gap-2 px-4 cursor-pointer hover:text-[#651414]"
                >
                  <span>Sindh Budget 2026 Pay &amp; Pension scales active for BPS-01 to BPS-22.</span>
                </Link>
                <Link
                  to="/teacher/question-paper"
                  className="inline-flex items-center gap-2 px-4 cursor-pointer hover:text-[#651414]"
                >
                  <span>Question Paper Maker: Class 1–12 bilingual exam builder with school logo.</span>
                </Link>
              </div>
            </div>
          </div>

          {/* =================================================================== */}
          {/* CONDITIONAL HEADER: COMPACT TOOL HEADER ON NON-DASHBOARD ROUTES     */}
          {/* =================================================================== */}
          {!isRouteActive('/dashboard') && (
            <div className="no-print bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${currentToolMeta.iconBg} ${currentToolMeta.iconColor}`}
                >
                  {currentToolMeta.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold text-[#78716C] dark:text-[#D6CCC2] uppercase tracking-wider">
                      Dashboard /
                    </span>
                    <h1 className="text-base sm:text-lg font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                      {currentToolMeta.title}
                    </h1>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#FEF2F2] dark:bg-[#3F1014]/70 text-[#7F1D1D] dark:text-[#FCA5A5] border border-[#FECACA]/60 dark:border-[#7F1D1D]/60">
                      {currentToolMeta.badge}
                    </span>
                  </div>
                  <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-0.5">
                    {currentToolMeta.subtitle}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    isParentUser || isStudentUser || isSuperAdminActive
                      ? defaultHomePath
                      : '/dashboard'
                  )
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#44403C] dark:text-[#E7E0D4] bg-[#F3EFEA] hover:bg-[#E7E0D4] dark:bg-[#2C1215] dark:hover:bg-[#4A1C20] rounded-xl transition-colors shrink-0 cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>
                  {isParentUser || isStudentUser || isSuperAdminActive ? 'Portal Home' : 'All Modules'}
                </span>
              </button>
            </div>
          )}

          {/* =================================================================== */}
          {/* ROUTE WORKSPACE WITH SMOOTH MOTION FADE-IN                          */}
          {/* =================================================================== */}
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <RouteErrorBoundary
              resetKey={location.pathname}
              onResetToHome={() => navigate('/dashboard', { replace: true })}
            >
            <Routes>
              <Route path="/" element={<Navigate to={defaultHomePath} replace />} />

              <Route
                path="/dashboard"
                element={
                  isParentUser || isStudentUser || isSuperAdminActive ? (
                    <div className="no-print bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-sm">
                      <div className="w-12 h-12 rounded-2xl bg-[#FEF2F2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5] flex items-center justify-center mx-auto">
                        <ShieldCheck className="w-6 h-6" />
                      </div>
                      <h2 className="text-lg font-extrabold text-[#1C1917] dark:text-[#FAF8F5]">
                        Focused Portal Session Active
                      </h2>
                      <p className="text-xs sm:text-sm text-[#57534E] dark:text-[#D6CCC2] max-w-md mx-auto">
                        Your account operates inside a dedicated workspace portal. Return to your primary dashboard below.
                      </p>
                      <div>
                        <Link
                          to={defaultHomePath}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#7F1D1D] hover:bg-[#651414] text-white text-xs font-bold shadow-xs transition"
                        >
                          <span>
                            {isParentUser
                              ? 'Open Parent Portal'
                              : isStudentUser
                              ? 'Open Student Portal'
                              : 'Open Super Admin Console'}
                          </span>
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  ) : (
                    /* DASHBOARD OVERVIEW: Hero & 6 ERP Module Cards */
                    <div className="no-print space-y-6">
                      {/* SaaS Hero Section */}
                      <section
                        className="rounded-3xl px-6 py-9 sm:py-12 text-center text-[#FAF8F5] shadow-lg relative overflow-hidden"
                        style={{
                          background: 'linear-gradient(135deg, #58181D 0%, #3F1014 100%)',
                        }}
                      >
                        <div className="relative z-10 max-w-3xl mx-auto">
                          <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                            <span className="inline-block bg-[#FFFDF9]/10 backdrop-blur-md text-[#FED7AA] border border-[rgba(255,253,249,0.2)] px-3.5 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase">
                              SELD SINDH OFFICIAL EDUCATION ERP
                            </span>
                            <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 px-3 py-1 rounded-full text-xs font-semibold">
                              <UserCheck className="w-3.5 h-3.5" />
                              {activeUserDisplay}
                            </span>
                          </div>
                          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#FAF8F5] leading-tight mb-3">
                            The Intelligent Portal That Plans Your Year With AI
                          </h1>
                          <p className="text-xs sm:text-base text-[#E7E0D4] max-w-2xl mx-auto mb-6 leading-relaxed">
                            Generate official Sindh STBB &amp; PTB curriculum lesson plans,
                            calculate 2026 BPS payroll, prepare SELD leave applications,
                            and build ATS-ready resumes with{' '}
                            <strong className="text-[#FED7AA]">AtlierCV Studio</strong>.
                          </p>
                          <div className="flex flex-wrap items-center justify-center gap-3">
                            <button
                              type="button"
                              onClick={() => navigate('/teacher/lesson-planner')}
                              className="allforu-btn-demo px-6 py-2.5 text-xs sm:text-sm cursor-pointer"
                            >
                              Open Lesson Planner →
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate('/tools/atlier-cv')}
                              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold bg-[#FFFDF9]/10 hover:bg-[#FFFDF9]/20 text-[#FFFDF9] border border-[#FFFDF9]/30 transition-colors cursor-pointer"
                            >
                              <Sparkles className="w-4 h-4 text-[#FED7AA]" />
                              <span>Launch AtlierCV Studio</span>
                            </button>
                            {!demoMode && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDemoMode(true);
                                  navigate('/sms');
                                }}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold bg-[#B45309] hover:bg-[#92400E] text-[#FFFDF9] shadow-md transition-all cursor-pointer"
                              >
                                <span>🧪 Try Demo Mode (Sandbox)</span>
                              </button>
                            )}
                          </div>
                        </div>
                        <div
                          className="pointer-events-none absolute -top-1/2 -left-1/2 w-[200%] h-[200%]"
                          style={{
                            background:
                              'radial-gradient(circle, rgba(194,65,12,0.16) 0%, transparent 60%)',
                          }}
                        />
                      </section>

                      {/* Highlight Banner: School Management System (SMS) */}
                      <div
                        onClick={() => navigate(isAffiliatedUser || demoMode ? '/sms' : '/sms/onboarding')}
                        className="bg-gradient-to-r from-[#58181D] via-[#4A1318] to-[#2C1215] border border-[rgba(255,253,249,0.16)] text-[#FAF8F5] rounded-2xl p-5 shadow-sm hover:border-[#FED7AA]/40 transition cursor-pointer flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-[#C2410C]/25 border border-[#FED7AA]/30 text-[#FED7AA] flex items-center justify-center shrink-0">
                            <SchoolIcon className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-[#FAF8F5]">School Management System (SMS)</span>
                              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-[#FFFDF9]/10 text-[#FED7AA] border border-[#FFFDF9]/20">
                                Phase 1 Ready
                              </span>
                            </div>
                            <p className="text-xs text-[#E7E0D4] mt-0.5">
                              Role-Based Access Control, Grade sections (KG–Class 12), instruction mediums, and faculty allocations.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(isAffiliatedUser || demoMode ? '/sms/classes' : '/sms/onboarding');
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-[#C2410C] hover:bg-[#9A3412] text-[#FFFDF9] text-xs font-semibold rounded-xl shrink-0 transition cursor-pointer"
                        >
                          <span>{isAffiliatedUser || demoMode ? 'Manage Classes & Sections' : 'Register / Join School'}</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>

                      {/* 6 ERP Module Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Card 1 */}
                        <div
                          onClick={() => navigate('/teacher/lesson-planner')}
                          className="allforu-tool-card p-5 cursor-pointer flex flex-col justify-between group hover:border-[#7F1D1D]/50"
                        >
                          <div>
                            <div className="w-12 h-12 rounded-xl bg-[#FEF2F2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                              <BookOpen className="w-6 h-6" />
                            </div>
                            <h3 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                              Lesson Planning System
                            </h3>
                            <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-1 leading-relaxed">
                              AI &amp; Firestore academic plans aligned with Sindh STBB &amp; Punjab PTB.
                            </p>
                          </div>
                          <div className="mt-4 pt-3 border-t border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] flex items-center justify-between text-xs font-semibold text-[#7F1D1D] dark:text-[#FCA5A5]">
                            <span>Open Module</span>
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>

                        {/* Card 2 */}
                        <div
                          onClick={() => navigate('/tools/salary-calculator')}
                          className="allforu-tool-card p-5 cursor-pointer flex flex-col justify-between group hover:border-[#C2410C]/50"
                        >
                          <div>
                            <div className="w-12 h-12 rounded-xl bg-[#FFF7ED] dark:bg-[#7C2D12]/60 text-[#C2410C] dark:text-[#FDBA74] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                              <Calculator className="w-6 h-6" />
                            </div>
                            <h3 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                              Payroll &amp; Finance 2026
                            </h3>
                            <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-1 leading-relaxed">
                              Automated BPS-01 to BPS-22 salary &amp; 2026 allowance breakdown.
                            </p>
                          </div>
                          <div className="mt-4 pt-3 border-t border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] flex items-center justify-between text-xs font-semibold text-[#C2410C] dark:text-[#FDBA74]">
                            <span>Calculate Pay</span>
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>

                        {/* Card 3 */}
                        <div
                          onClick={() => navigate('/tools/leave-generator')}
                          className="allforu-tool-card p-5 cursor-pointer flex flex-col justify-between group hover:border-emerald-500/50"
                        >
                          <div>
                            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                              <FileSignature className="w-6 h-6" />
                            </div>
                            <h3 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                              SELD FRAMES Leave
                            </h3>
                            <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-1 leading-relaxed">
                              Official A4 leave proforma with 38 Sindh Civil Service leave types.
                            </p>
                          </div>
                          <div className="mt-4 pt-3 border-t border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <span>Generate Leave</span>
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>

                        {/* Card 4 */}
                        <div
                          onClick={() => navigate('/tools/atlier-cv')}
                          className="allforu-tool-card p-5 cursor-pointer flex flex-col justify-between group hover:border-[#7F1D1D]/50 relative"
                        >
                          <span className="absolute top-4 right-4 px-2 py-0.5 text-[9px] font-bold uppercase rounded bg-[#FEF2F2] text-[#7F1D1D] dark:bg-[#3F1014]/60 dark:text-[#FCA5A5] border border-[#FECACA]/60 dark:border-[#7F1D1D]/60">
                            ATS Studio
                          </span>
                          <div>
                            <div className="w-12 h-12 rounded-xl bg-[#FEF2F2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                              <Briefcase className="w-6 h-6" />
                            </div>
                            <h3 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                              AtlierCV Studio
                            </h3>
                            <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-1 leading-relaxed">
                              AI-Powered Professional CV Studio with live A4 editor &amp; PDF/Word export.
                            </p>
                          </div>
                          <div className="mt-4 pt-3 border-t border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] flex items-center justify-between text-xs font-semibold text-[#7F1D1D] dark:text-[#FCA5A5]">
                            <span>Build Resume</span>
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>

                        {/* Card 5 */}
                        <div
                          onClick={() => navigate('/tools/service-book')}
                          className="allforu-tool-card p-5 cursor-pointer flex flex-col justify-between group hover:border-teal-500/50"
                        >
                          <div>
                            <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                              <BookCheck className="w-6 h-6" />
                            </div>
                            <h3 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                              Service Book &amp; Pension
                            </h3>
                            <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-1 leading-relaxed">
                              Qualifying Service, Pension, JEST/HST Time Scale &amp; 365-Day Encashment.
                            </p>
                          </div>
                          <div className="mt-4 pt-3 border-t border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] flex items-center justify-between text-xs font-semibold text-teal-600 dark:text-teal-400">
                            <span>Open Record</span>
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>

                        {/* Card 6 */}
                        <div
                          onClick={() => navigate('/teacher/question-paper')}
                          className="allforu-tool-card p-5 cursor-pointer flex flex-col justify-between group hover:border-[#C2410C]/50"
                        >
                          <div>
                            <div className="w-12 h-12 rounded-xl bg-[#FFF7ED] dark:bg-[#7C2D12]/60 text-[#C2410C] dark:text-[#FDBA74] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                              <FileSpreadsheet className="w-6 h-6" />
                            </div>
                            <h3 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                              AI Question Paper Maker
                            </h3>
                            <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-1 leading-relaxed">
                              Class 1–12 Exam Builder in English, Urdu &amp; Sindhi with School Logo.
                            </p>
                          </div>
                          <div className="mt-4 pt-3 border-t border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] flex items-center justify-between text-xs font-semibold text-[#C2410C] dark:text-[#FDBA74]">
                            <span>Create Exam</span>
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                }
              />

              {/* SCHOOL MANAGEMENT SYSTEM (SMS) ROUTES */}
              <Route
                path="/sms"
                element={
                  <ProtectedRoute
                    access={routeAccessContext}
                    allowedRoles={['admin', 'principal', 'teacher']}
                    requireAffiliated
                    allowDuringImpersonation
                    unauthorizedMessage="Access Denied: Complete school affiliation or sign in as school staff to open SMS Command Center."
                  >
                    <SmsDashboard
                      onNavigateToClasses={() => navigate('/sms/classes')}
                      onNavigateToStudents={() => {
                        setSmsFilterClassId(undefined);
                        navigate('/sms/students');
                      }}
                      onNavigateToAttendance={(classId) => {
                        setSmsAttendanceClassId(classId);
                        navigate('/sms/attendance');
                      }}
                      onNavigateToStaff={() => navigate('/sms/staff')}
                      onNavigateToProfile={() => navigate('/sms/profile')}
                      onNavigateToExams={() => navigate('/sms/exams')}
                      onNavigateToTimetable={() => navigate('/sms/timetable')}
                      onNavigateToHomework={() => navigate('/sms/homework')}
                      onNavigateToCertificates={() => navigate('/sms/certificates')}
                      onNavigateToPayroll={() => navigate('/sms/salary')}
                      requestedTab={smsDashboardTab}
                      onTabChange={setSmsDashboardTab}
                    />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/sms/classes"
                element={
                  <ProtectedRoute
                    access={routeAccessContext}
                    allowedRoles={['admin', 'principal', 'teacher']}
                    requireAffiliated
                  >
                    <ClassesManagement
                      onNavigateToAttendance={(classId) => {
                        setSmsAttendanceClassId(classId);
                        navigate('/sms/attendance');
                      }}
                      onNavigateToStudents={(classId) => {
                        setSmsFilterClassId(classId);
                        navigate('/sms/students');
                      }}
                    />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/sms/students"
                element={
                  <ProtectedRoute
                    access={routeAccessContext}
                    allowedRoles={['admin', 'principal', 'teacher']}
                    requireAffiliated
                  >
                    <StudentDirectoryRoute
                      initialClassId={smsFilterClassId}
                      onNavigateToAttendance={(classId) => {
                        setSmsAttendanceClassId(classId);
                        navigate('/sms/attendance');
                      }}
                    />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/sms/students/:studentId"
                element={
                  <ProtectedRoute
                    access={routeAccessContext}
                    allowedRoles={['admin', 'principal', 'teacher']}
                    requireAffiliated
                  >
                    <StudentDirectoryRoute
                      initialClassId={smsFilterClassId}
                      onNavigateToAttendance={(classId) => {
                        setSmsAttendanceClassId(classId);
                        navigate('/sms/attendance');
                      }}
                    />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/sms/attendance"
                element={
                  <ProtectedRoute
                    access={routeAccessContext}
                    allowedRoles={['admin', 'principal', 'teacher']}
                    requireAffiliated
                  >
                    <DailyAttendanceRegister
                      onBack={() => navigate('/sms')}
                      initialClassId={smsAttendanceClassId}
                    />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/sms/onboarding"
                element={
                  <ProtectedRoute
                    access={routeAccessContext}
                    allowedRoles={['admin', 'principal', 'teacher', 'general', 'super-admin']}
                  >
                    <SmsOnboarding
                      currentUser={currentUser}
                      onOpenAuthModal={() => openAuthModal('signin')}
                      onOnboardingComplete={() => navigate('/sms', { replace: true })}
                      initialTab={smsOnboardingTab}
                    />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/sms/staff"
                element={
                  <ProtectedRoute
                    access={routeAccessContext}
                    allowedRoles={['admin', 'principal']}
                    requireAffiliated
                    unauthorizedMessage="Access Denied: Faculty & Staff management is restricted to School Administrators."
                  >
                    <TeacherManagement onBack={() => navigate('/sms')} />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/sms/profile"
                element={
                  <ProtectedRoute
                    access={routeAccessContext}
                    allowedRoles={['admin', 'principal', 'teacher']}
                    requireAffiliated
                  >
                    <TeacherProfile
                      onBack={() => navigate('/sms')}
                      onNavigateToAttendance={(classId) => {
                        setSmsAttendanceClassId(classId);
                        navigate('/sms/attendance');
                      }}
                      onNavigateToStudents={(classId) => {
                        setSmsFilterClassId(classId);
                        navigate('/sms/students');
                      }}
                    />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/sms/fees"
                element={
                  <ProtectedRoute
                    access={routeAccessContext}
                    allowedRoles={['admin', 'principal', 'teacher']}
                    requireAffiliated
                    requireCanCollectFee
                  >
                    <FeeManagement onBack={() => navigate('/sms')} />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/sms/exams"
                element={
                  <ProtectedRoute
                    access={routeAccessContext}
                    allowedRoles={['admin', 'principal', 'teacher']}
                    requireAffiliated
                  >
                    <ExamsResultsRoute />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/sms/exams/:examId/report/:studentId"
                element={
                  <ProtectedRoute
                    access={routeAccessContext}
                    allowedRoles={['admin', 'principal', 'teacher']}
                    requireAffiliated
                  >
                    <ExamsResultsRoute />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/sms/timetable"
                element={
                  <ProtectedRoute
                    access={routeAccessContext}
                    allowedRoles={['admin', 'principal', 'teacher']}
                    requireAffiliated
                  >
                    <TimetableManager onBack={() => navigate('/sms')} />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/sms/homework"
                element={
                  <ProtectedRoute
                    access={routeAccessContext}
                    allowedRoles={['admin', 'principal', 'teacher']}
                    requireAffiliated
                  >
                    <HomeworkManager onBack={() => navigate('/sms')} />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/sms/certificates"
                element={
                  <ProtectedRoute
                    access={routeAccessContext}
                    allowedRoles={['admin', 'principal']}
                    requireAffiliated
                    unauthorizedMessage="Access Denied: Official Certificates are restricted to School Administrators."
                  >
                    <CertificatesManager onBack={() => navigate('/sms')} />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/sms/salary"
                element={
                  <ProtectedRoute
                    access={routeAccessContext}
                    allowedRoles={['admin', 'principal', 'super-admin']}
                    requirePayrollAccess
                    requireAffiliated={!isSuperAdminActive}
                  >
                    <SalaryPayroll
                      onBack={() => navigate(isSuperAdminActive ? '/super-admin' : '/sms')}
                    />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/sms/payroll"
                element={
                  <ProtectedRoute
                    access={routeAccessContext}
                    allowedRoles={['admin', 'principal', 'super-admin']}
                    requirePayrollAccess
                    requireAffiliated={!isSuperAdminActive}
                  >
                    <SalaryPayroll
                      onBack={() => navigate(isSuperAdminActive ? '/super-admin' : '/sms')}
                    />
                  </ProtectedRoute>
                }
              />

              {/* PARENT PORTAL ROUTE */}
              <Route
                path="/parent/dashboard"
                element={
                  <ProtectedRoute
                    access={routeAccessContext}
                    allowedRoles={['parent']}
                    unauthorizedMessage="Access Denied: Parent Portal is restricted to verified Parent accounts."
                  >
                    <ParentDashboard />
                  </ProtectedRoute>
                }
              />

              {/* STUDENT PORTAL ROUTE */}
              <Route
                path="/student/dashboard"
                element={
                  <ProtectedRoute
                    access={routeAccessContext}
                    allowedRoles={['student']}
                    unauthorizedMessage="Access Denied: Student Portal is restricted to verified Student accounts."
                  >
                    <StudentDashboard />
                  </ProtectedRoute>
                }
              />

              {/* SUPER ADMIN CONSOLE ROUTE */}
              <Route
                path="/super-admin"
                element={
                  <ProtectedRoute
                    access={routeAccessContext}
                    allowedRoles={['super-admin']}
                    allowDuringImpersonation
                    unauthorizedMessage="Access Denied: Super Admin Fleet Console requires Super Administrator privileges."
                  >
                    <SuperAdminDashboard
                      activeTab={superAdminTab}
                      onTabChange={setSuperAdminTab}
                      onNavigateToSchool={() => navigate('/sms')}
                      onOpenRegisterSchool={() => navigate('/sms/onboarding')}
                      onOpenPayroll={() => navigate('/sms/salary')}
                    />
                  </ProtectedRoute>
                }
              />

              {/* TEACHER AI STUDIO ROUTES */}
              <Route
                path="/teacher/lesson-planner"
                element={
                  <ProtectedRoute
                    access={routeAccessContext}
                    allowedRoles={['admin', 'principal', 'teacher', 'general']}
                  >
                    <LessonPlanTool
                      currentUser={currentUser}
                      onRequestSignIn={() => openAuthModal('signin')}
                    />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/teacher/question-paper"
                element={
                  <ProtectedRoute
                    access={routeAccessContext}
                    allowedRoles={['admin', 'principal', 'teacher', 'general']}
                  >
                    <QuestionPaperTool />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/tools/salary-calculator"
                element={
                  <ProtectedRoute
                    access={routeAccessContext}
                    allowedRoles={['admin', 'principal', 'teacher', 'general']}
                  >
                    <SalaryCalculatorTool />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/tools/leave-generator"
                element={
                  <ProtectedRoute
                    access={routeAccessContext}
                    allowedRoles={['admin', 'principal', 'teacher', 'general']}
                  >
                    <LeaveApplicationTool />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/tools/atlier-cv"
                element={
                  <ProtectedRoute
                    access={routeAccessContext}
                    allowedRoles={['admin', 'principal', 'teacher', 'general']}
                  >
                    <AtlierCvTool
                      currentUser={currentUser}
                      demoSession={demoSession}
                      onOpenAuthModal={openAuthModal}
                      onSignOutToPortalLogin={() =>
                        performUnifiedLogout(
                          'Aap successfully Logout ho kar wapas Main Portal Login Page par aa gaye hain.'
                        )
                      }
                    />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/tools/service-book"
                element={
                  <ProtectedRoute
                    access={routeAccessContext}
                    allowedRoles={['admin', 'principal', 'teacher', 'general']}
                  >
                    <ServiceBookCalculatorTool />
                  </ProtectedRoute>
                }
              />

              {/* FALLBACK ROUTE (Also catches Electron file:///.../dist/index.html paths) */}
              <Route path="*" element={<Navigate to={defaultHomePath} replace />} />
            </Routes>
            </RouteErrorBoundary>
          </motion.div>
        </main>

        {/* Enterprise SaaS Footer */}
        <footer className="app-footer no-print border-t border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] bg-[#FFFDF9] dark:bg-[#211415] px-4 sm:px-6 pt-4 pb-6 lg:py-4 text-xs text-[#57534E] dark:text-[#D6CCC2] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start text-center sm:text-left">
            <span className="font-semibold text-[#1C1917] dark:text-[#FAF8F5]">
              PakEdu &amp; Sindh SELD Official Portal
            </span>
            <span className="font-mono text-[11px] bg-[#F3EFEA] dark:bg-[#2C1215] text-[#57534E] dark:text-[#E7E0D4] px-2 py-0.5 rounded">
              v{portalVersion}
            </span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">
              School Education &amp; Literacy Department (SELD) · STBB &amp; PTB Aligned
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => performUnifiedLogout()}
              className="text-[#57534E] hover:text-rose-600 font-medium inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              <LogOut className="w-3 h-3" /> Sign Out
            </button>
          </div>
        </footer>
      </div>

      {/* =================================================================== */}
      {/* MOBILE-ONLY FIXED BOTTOM NAVIGATION BAR (Web Mobile & Android APK)  */}
      {/* =================================================================== */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="app-bottom-nav no-print lg:hidden fixed bottom-0 inset-x-0 z-30 bg-[#2C1215] border-t border-[rgba(255,253,249,0.14)] text-[#D6CCC2] shadow-[0_-4px_20px_rgba(0,0,0,0.3)]"
      >
        <div className="grid grid-cols-5 h-16 max-w-full">
          {/* 1. Home (Dashboard) */}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              if (isParentUser) {
                navigate('/parent/dashboard');
              } else if (isStudentUser) {
                navigate('/student/dashboard');
              } else if (isSuperAdminActive) {
                if (isImpersonating) {
                  setSmsDashboardTab('overview');
                  navigate('/sms');
                } else {
                  setSuperAdminTab('analytics');
                  navigate('/super-admin');
                }
              } else if (isAffiliatedUser) {
                setShowPublicTools(false);
                setSmsDashboardTab('overview');
                navigate('/sms');
              } else {
                navigate('/dashboard');
              }
            }}
            className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold transition cursor-pointer ${
              !mobileMenuOpen &&
              !noticesModalOpen &&
              (isRouteActive('/dashboard') ||
                isRouteActive('/parent/dashboard') ||
                isRouteActive('/student/dashboard') ||
                (isRouteActive('/sms') && smsDashboardTab === 'overview') ||
                (isRouteActive('/super-admin') && superAdminTab === 'analytics'))
                ? 'text-[#FED7AA] bg-[#C2410C]/20'
                : 'text-[#D6CCC2] hover:text-white'
            }`}
          >
            <Home className="w-5 h-5 shrink-0" />
            <span className="truncate max-w-full">Home</span>
          </button>

          {/* 2. Profile (User Profile) */}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              if (isParentUser) {
                navigate('/parent/dashboard');
              } else if (isStudentUser) {
                navigate('/student/dashboard');
              } else if (isSuperAdminActive && !isImpersonating) {
                setSuperAdminTab('directory');
                navigate('/super-admin');
              } else if (isAffiliatedUser || demoMode) {
                navigate('/sms/profile');
              } else if (currentUser) {
                navigate('/sms/onboarding');
              } else {
                openAuthModal('signin');
              }
            }}
            className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold transition cursor-pointer ${
              !mobileMenuOpen &&
              (isRouteActive('/sms/profile') || isRouteActive('/sms/onboarding'))
                ? 'text-[#FED7AA] bg-[#C2410C]/20'
                : 'text-[#D6CCC2] hover:text-white'
            }`}
          >
            <UserCheck className="w-5 h-5 shrink-0" />
            <span className="truncate max-w-full">Profile</span>
          </button>

          {/* 3. Sync (Offline Sync Status & Sync Center) */}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              setIsSyncCenterOpen(true);
            }}
            className={`relative min-h-[48px] flex flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold transition cursor-pointer ${
              conflictItems.length > 0
                ? 'text-rose-300'
                : !isOnline
                ? 'text-orange-300'
                : pendingSyncCount > 0
                ? 'text-amber-300'
                : 'text-[#D6CCC2] hover:text-white'
            }`}
          >
            <div className="relative inline-flex items-center justify-center">
              {!isOnline ? (
                <WifiOff className="w-5 h-5 shrink-0 text-red-400" />
              ) : conflictItems.length > 0 ? (
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
              ) : isSyncing ? (
                <RefreshCw className="w-5 h-5 shrink-0 animate-spin text-[#FED7AA]" />
              ) : (
                <Cloud className="w-5 h-5 shrink-0" />
              )}
              {(pendingSyncCount > 0 || !isOnline || conflictItems.length > 0) && (
                <span
                  className={`absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center text-white ${
                    conflictItems.length > 0
                      ? 'bg-rose-600'
                      : !isOnline
                      ? 'bg-red-600'
                      : 'bg-[#C2410C]'
                  }`}
                >
                  {conflictItems.length > 0
                    ? conflictItems.length
                    : pendingSyncCount > 0
                    ? pendingSyncCount
                    : '!'}
                </span>
              )}
            </div>
            <span className="truncate max-w-full">Sync</span>
          </button>

          {/* 4. Notifications (Notice Board) */}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              if (isSuperAdminActive && !isImpersonating) {
                setSuperAdminTab('notices');
                navigate('/super-admin');
              } else if (isAffiliatedUser || (demoMode && userRole !== 'super-admin')) {
                setShowPublicTools(false);
                setSmsDashboardTab('notifications');
                navigate('/sms');
              } else {
                setNoticesModalOpen(true);
              }
            }}
            className={`relative min-h-[48px] flex flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold transition cursor-pointer ${
              !mobileMenuOpen &&
              (noticesModalOpen ||
                (isRouteActive('/super-admin') && superAdminTab === 'notices') ||
                (isRouteActive('/sms') && smsDashboardTab === 'notifications'))
                ? 'text-[#FED7AA] bg-[#C2410C]/20'
                : 'text-[#D6CCC2] hover:text-white'
            }`}
          >
            <div className="relative inline-flex items-center justify-center">
              <Bell className="w-5 h-5 shrink-0" />
              {unreadNoticesCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadNoticesCount > 9 ? '9+' : unreadNoticesCount}
                </span>
              )}
            </div>
            <span className="truncate max-w-full">Notices</span>
          </button>

          {/* 5. More (Opens Full Sidebar Drawer) */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold transition cursor-pointer ${
              mobileMenuOpen ? 'text-[#FED7AA] bg-[#C2410C]/25' : 'text-[#D6CCC2] hover:text-white'
            }`}
          >
            <Menu className="w-5 h-5 shrink-0" />
            <span className="truncate max-w-full">More</span>
          </button>
        </div>
      </nav>

      {/* Mobile Quick Notice Board Modal (for roles outside SMS Command Center) */}
      {noticesModalOpen && (
        <div
          className="no-print fixed inset-0 z-50 bg-[#2C1215]/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Notice Board"
        >
          <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.16)] rounded-2xl w-full max-w-lg max-h-[85dvh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-4 py-3.5 bg-[#2C1215] text-[#FAF8F5] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Megaphone className="w-4 h-4 text-[#FED7AA] shrink-0" />
                <h3 className="text-sm font-bold truncate">Notice Board &amp; Announcements</h3>
              </div>
              <button
                type="button"
                onClick={() => setNoticesModalOpen(false)}
                className="p-1.5 text-[#D6CCC2] hover:text-white rounded-lg cursor-pointer"
                aria-label="Close notice board"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3 text-xs">
              {globalNotices.length === 0 ? (
                <div className="py-8 text-center text-[#78716C] dark:text-[#D6CCC2]">
                  No institutional announcements published right now.
                </div>
              ) : (
                globalNotices.map((notice) => {
                  const isRead = Boolean(
                    activeSchool.id && (notice.readBySchools || {})[activeSchool.id]
                  );
                  return (
                    <div
                      key={notice.id}
                      className="p-3.5 rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.12)] bg-[#FAF8F5] dark:bg-[#2C1215]/70 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                          {notice.title}
                        </span>
                        <span className="text-[10px] font-mono text-[#78716C] shrink-0">
                          {notice.date}
                        </span>
                      </div>
                      <p className="text-[#44403C] dark:text-[#E7E0D4] leading-relaxed">
                        {notice.message}
                      </p>
                      {activeSchool.id && !isParentUser && !isStudentUser && !isRead && (
                        <button
                          type="button"
                          onClick={() => void markNoticeAsRead(notice.id)}
                          className="mt-1 px-2.5 py-1 rounded-lg bg-[#C2410C] text-white text-[10px] font-bold cursor-pointer"
                        >
                          Mark as Read
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SmsProvider>
          <AppContent />
        </SmsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
