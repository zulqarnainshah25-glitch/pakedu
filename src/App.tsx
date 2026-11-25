/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
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
} from 'lucide-react';
import { auth } from './firebase';
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
  parseIncomingSsoSessionFromSearch,
} from './utils/authAndSso';
import { SmsProvider, useSms } from './features/sms/context/SmsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { hasAdminCapabilities } from './utils/smartRouting';
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
    canCollectFee,
  } = useSms();
  const {
    currentUser,
    currentUserProfile,
    authLoading,
    smartRoute,
    signOutUser,
  } = useAuth();

  const [activeTool, setActiveTool] = useState<ActiveToolId>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingSmsRedirect, setPendingSmsRedirect] = useState(false);
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

  // Focused Workspace Modes:
  // 1. Parent User: Strictly read-only access isolated inside Child Progress Portal
  // 1B. Student User: Strictly read-only access isolated inside Student Portal
  // 2. Super Admin: Platform oversight ONLY (Overview Analytics, Schools Fleet, Notice Board) + Read-Only Impersonation
  // 3. Affiliated User: Real Auth mode, verified with active status & schoolId -> Focus strictly on SMS operations
  // 4. Unaffiliated User: Real Auth mode, but not affiliated with a school -> Show AI Studio & onboarding prompt
  // 5. Demo Mode: All tools visible for evaluation & sandbox testing
  const isParentUser = !demoMode && currentUserProfile?.role === 'parent';
  const isStudentUser = !demoMode && currentUserProfile?.role === 'student';

  const isSuperAdminSession =
    !demoMode &&
    (isSuperAdmin ||
      userRole === 'super-admin' ||
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
      currentUserProfile?.status === 'rejected' ||
      currentUserProfile?.status === 'none'
    ) {
      return false;
    }
    return hasAdminCapabilities(currentUser, currentUserProfile, registeredSchools);
  }, [currentUser, currentUserProfile, registeredSchools, isSuperAdminSession]);

  // Focused Workspace Modes:
  // Affiliated Staff User: Real Auth mode, verified with active status & schoolId, or school-level admin privileges (excludes Super Admin, Parents & Students)
  const isAffiliatedUser =
    !demoMode &&
    !isParentUser &&
    !isStudentUser &&
    !isSuperAdminSession &&
    !isImpersonating &&
    (isAdminUser ||
      (currentUserProfile?.status === 'active' && Boolean(currentUserProfile?.schoolId)));

  const isUnaffiliatedUser =
    !demoMode &&
    !isParentUser &&
    !isStudentUser &&
    !isSuperAdminSession &&
    !isImpersonating &&
    !isAdminUser &&
    (!currentUser ||
      currentUserProfile?.status !== 'active' ||
      !currentUserProfile?.schoolId);

  // Strict Parent Portal isolation: parent accounts stay locked on 'sms-parent'
  useEffect(() => {
    if (isParentUser && activeTool !== 'sms-parent') {
      setActiveTool('sms-parent');
    }
  }, [isParentUser, activeTool]);

  // Strict Student Portal isolation: student accounts stay locked on 'sms-student-portal'
  useEffect(() => {
    if (isStudentUser && activeTool !== 'sms-student-portal') {
      setActiveTool('sms-student-portal');
    }
  }, [isStudentUser, activeTool]);

  // Strict Super Admin RBAC isolation: platform oversight ONLY, or 'sms-dashboard' during read-only view
  useEffect(() => {
    if (!isSuperAdminActive) return;
    if (isImpersonating) {
      if (activeTool !== 'sms-dashboard') {
        setActiveTool('sms-dashboard');
      }
      return;
    }
    if (activeTool !== 'super-admin') {
      setActiveTool('super-admin');
    }
  }, [isSuperAdminActive, isImpersonating, activeTool]);

  // When an affiliated staff user enters the portal, ensure they land on the focused SMS dashboard unless they toggle public tools
  useEffect(() => {
    if (
      isAffiliatedUser &&
      !showPublicTools &&
      !activeTool.startsWith('sms-') &&
      !isImpersonating &&
      activeTool !== 'super-admin'
    ) {
      setActiveTool('sms-dashboard');
    }
  }, [isAffiliatedUser, showPublicTools, activeTool, isImpersonating]);

  // When an unaffiliated user attempts to access an SMS internal sub-tool, guide them to the onboarding screen
  useEffect(() => {
    if (isUnaffiliatedUser && activeTool.startsWith('sms-') && activeTool !== 'sms-onboarding') {
      setActiveTool('sms-onboarding');
    }
  }, [isUnaffiliatedUser, activeTool]);

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

  const performUnifiedLogout = useCallback(async (customNotice?: string) => {
    setDemoSession(null);
    try {
      localStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
      sessionStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
      sessionStorage.removeItem('pakedu_active_tool');
    } catch {
      // Ignore storage errors
    }
    try {
      await signOutUser();
    } catch (err) {
      console.error('Sign-out error:', err);
    }
    setAuthModalMode('signin');
    setLogoutNotice(
      customNotice ||
        'Aap successfully Logout ho chuke hain. Portal kholne ke liye dobara Sign In karein.'
    );
  }, [signOutUser]);

  // Listen to SSO query parameters (logout trigger only; unverified ?sso_email is disabled)
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

  // Automatic Smart Login Routing System & Session Persistence
  const hasInitialRoutedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!authLoading && currentUser && smartRoute) {
      setLogoutNotice(null);

      // Super Admin Impersonation: do not override active tool
      if (isImpersonating) {
        return;
      }

      // Check if routing for this user + role/status state has already occurred
      const routeSignature = `${currentUser.uid}:${currentUserProfile?.role || ''}:${currentUserProfile?.status || ''}:${smartRoute.targetTool}`;
      if (hasInitialRoutedRef.current === routeSignature) {
        return;
      }
      hasInitialRoutedRef.current = routeSignature;

      // Condition A: Super Admin
      if (
        smartRoute.targetTool === 'super-admin' ||
        isSuperAdmin ||
        (currentUser.email && currentUser.email.toLowerCase() === 'owner@pakedu.com')
      ) {
        setUserRole('super-admin');
        setActiveTool('super-admin');
        return;
      }

      // Condition B: Pending Approval (Force to onboarding "Application Under Review")
      if (smartRoute.targetTool === 'sms-onboarding') {
        setUserRole(smartRoute.role);
        setActiveTool('sms-onboarding');
        return;
      }

      // Condition C: Verified School Admin
      if (smartRoute.role === 'admin' || isAdminUser) {
        setUserRole('admin');
        const savedSessionTool = typeof window !== 'undefined' ? sessionStorage.getItem('pakedu_active_tool') : null;
        if (savedSessionTool && savedSessionTool.startsWith('sms-')) {
          setActiveTool(savedSessionTool as ActiveToolId);
        } else {
          setActiveTool('sms-dashboard');
        }
        return;
      }

      // Restore session if teacher was already on an authorized SMS sub-tool
      const savedSessionTool = typeof window !== 'undefined' ? sessionStorage.getItem('pakedu_active_tool') : null;
      if (savedSessionTool) {
        if (smartRoute.role === 'teacher' && savedSessionTool.startsWith('sms-') && savedSessionTool !== 'sms-staff' && savedSessionTool !== 'sms-fees') {
          setUserRole('teacher');
          setActiveTool(savedSessionTool as ActiveToolId);
          return;
        }
        if (smartRoute.targetTool === 'dashboard' && !savedSessionTool.startsWith('sms-')) {
          setActiveTool(savedSessionTool as ActiveToolId);
          return;
        }
      }

      // Condition D or E: Route directly to smartRoute.targetTool
      setUserRole(smartRoute.role);
      setActiveTool(smartRoute.targetTool);
    } else if (!currentUser) {
      hasInitialRoutedRef.current = null;
    }
  }, [authLoading, currentUser, smartRoute, isImpersonating, isSuperAdmin, isAdminUser, setUserRole]);

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
    // Demo sessions strictly access public AI Studio tools; never Super Admin or SMS
    setPendingSmsRedirect(false);
    setUserRole('teacher');
    setActiveTool('dashboard');
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
    if (intent === 'parent') {
      setPendingSmsRedirect(false);
      setUserRole('parent');
      setActiveTool('sms-parent');
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }
    if (intent === 'student') {
      setPendingSmsRedirect(false);
      setUserRole('student');
      setActiveTool('sms-student-portal');
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }
    if (intent === 'sms') {
      const targetTab = smsRole === 'teacher' ? 'join' : 'register';
      setSmsOnboardingTab(targetTab);
      try {
        sessionStorage.setItem('pakedu_signup_sms_role', targetTab);
      } catch {}
      setPendingSmsRedirect(true);
      setActiveTool('sms-onboarding');
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else {
      setPendingSmsRedirect(false);
      setActiveTool('dashboard');
    }
  };

  const selectTool = (tool: ActiveToolId) => {
    // Strict Parent Isolation: parents may only view the read-only Child Progress Portal
    if (isParentUser && tool !== 'sms-parent') {
      setActiveTool('sms-parent');
      setMobileMenuOpen(false);
      return;
    }

    // Strict Student Isolation: students may only view their own read-only Student Portal
    if (isStudentUser && tool !== 'sms-student-portal') {
      setActiveTool('sms-student-portal');
      setMobileMenuOpen(false);
      return;
    }

    // Strict Super Admin RBAC Isolation: block all tenant Student/Class/Attendance/Fee/Exam/Staff modules
    if (isSuperAdminActive) {
      if (isImpersonating) {
        if (tool === 'super-admin') {
          exitImpersonation();
          setActiveTool('super-admin');
        } else {
          setActiveTool('sms-dashboard');
        }
      } else {
        setActiveTool('super-admin');
      }
      setMobileMenuOpen(false);
      return;
    }

    // SMS & Super Admin Access Protection:
    if (!demoMode && (tool.startsWith('sms-') || tool === 'super-admin')) {
      if (!currentUser) {
        setPendingSmsRedirect(true);
        openAuthModal('signin');
        return;
      }
      if (tool === 'super-admin') {
        const canSuperAdmin =
          isSuperAdmin ||
          userRole === 'super-admin' ||
          Boolean(currentUserProfile?.isSuperAdmin);
        if (!canSuperAdmin) {
          setActiveTool('sms-onboarding');
          return;
        }
      } else if (tool !== 'sms-onboarding') {
        const canAccessSms =
          isSuperAdmin ||
          isImpersonating ||
          isAdminUser ||
          currentUserProfile?.status === 'active';

        if (!canAccessSms) {
          setActiveTool('sms-onboarding');
          setMobileMenuOpen(false);
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
          return;
        }
      }
    }
    setActiveTool(tool);
    try {
      sessionStorage.setItem('pakedu_active_tool', tool);
    } catch {}
    setMobileMenuOpen(false);
    // Smooth scroll to top when switching views
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
    return (
      <AuthModal
        isOpen={true}
        isMandatoryGate={true}
        logoutNotice={logoutNotice}
        onClose={() => {}}
        onDemoSessionSuccess={handleDemoSessionSuccess}
        onSignupSuccess={handleSignupSuccess}
        initialMode={authModalMode}
      />
    );
  }

  const activeUserDisplay = currentUser
    ? currentUser.displayName || currentUser.email
    : demoSession
    ? `${demoSession.displayName}`
    : 'Authenticated Educator';

  const currentToolMeta = TOOL_METADATA[activeTool];

  return (
    <div
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
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-[#2C1215] text-white px-4 py-2.5 rounded-xl shadow-lg border border-[rgba(255,253,249,0.14)]">
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
        className={`app-sidebar no-print fixed inset-y-0 left-0 z-40 w-72 bg-[#2C1215] border-r border-[rgba(255,253,249,0.10)] text-[#FAF8F5] flex flex-col justify-between transition-transform duration-200 ease-out lg:static lg:translate-x-0 shrink-0 shadow-xl ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Sidebar Brand Header */}
          <div className="px-5 py-5 border-b border-[rgba(255,253,249,0.10)] flex items-center justify-between">
            <div
              onClick={() =>
                selectTool(
                  isParentUser
                    ? 'sms-parent'
                    : isStudentUser
                    ? 'sms-student-portal'
                    : isSuperAdminActive
                    ? isImpersonating
                      ? 'sms-dashboard'
                      : 'super-admin'
                    : isAffiliatedUser && !showPublicTools
                    ? 'sms-dashboard'
                    : 'dashboard'
                )
              }
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-[#C2410C] text-[#FFFDF9] flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                <GraduationCap className="w-5 h-5 text-[#FFFDF9]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-bold tracking-tight text-[#FAF8F5] leading-none">
                    PakEdu
                  </span>
                  <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-[#C2410C]/25 text-[#FED7AA] border border-[#C2410C]/40">
                    ENTERPRISE
                  </span>
                </div>
                <span className="text-[11px] text-[#D6CCC2] block mt-1">
                  Sindh SELD Portal
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 text-[#D6CCC2] hover:text-[#FAF8F5] rounded-lg cursor-pointer"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tool Navigation Links */}
          <div className="p-3.5 space-y-1">
            {/* Dashboard / Home Link - HIDDEN for Affiliated Staff Users, Parents, Students & Super Admin */}
            {!isParentUser && !isStudentUser && !isSuperAdminActive && (!isAffiliatedUser || showPublicTools) && (
              <button
                type="button"
                onClick={() => selectTool('dashboard')}
                className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                  activeTool === 'dashboard'
                    ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-3'
                    : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3.5'
                }`}
              >
                <Home className={`w-4 h-4 shrink-0 ${activeTool === 'dashboard' ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                <div className="truncate">
                  <span className="block truncate">Platform Overview</span>
                  <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                    ERP Suite Dashboard
                  </span>
                </div>
              </button>
            )}

            {/* Strict Read-Only Parent Portal Section */}
            {isParentUser && (
              <>
                <div className="pt-2 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-[#FED7AA] flex items-center justify-between">
                  <span>Parent Portal</span>
                  <span className="px-1.5 py-0.2 rounded text-[8px] font-mono font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Read-Only
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => selectTool('sms-parent')}
                  className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    activeTool === 'sms-parent'
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-3'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3.5'
                  }`}
                >
                  <Users className="w-4 h-4 shrink-0 text-[#FED7AA]" />
                  <div className="truncate flex-1">
                    <span className="block truncate">Child Progress Portal</span>
                    <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                      Attendance, Fees &amp; Results
                    </span>
                  </div>
                </button>
              </>
            )}

            {/* Strict Read-Only Student Portal Section */}
            {isStudentUser && (
              <>
                <div className="pt-2 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-[#FED7AA] flex items-center justify-between">
                  <span>Student Portal</span>
                  <span className="px-1.5 py-0.2 rounded text-[8px] font-mono font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Read-Only
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => selectTool('sms-student-portal')}
                  className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    activeTool === 'sms-student-portal'
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-3'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3.5'
                  }`}
                >
                  <GraduationCap className="w-4 h-4 shrink-0 text-[#FED7AA]" />
                  <div className="truncate flex-1">
                    <span className="block truncate">My Student Portal</span>
                    <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                      Attendance, Homework &amp; Results
                    </span>
                  </div>
                </button>
              </>
            )}

            {/* Affiliated School Context Card (Shown for Verified School Users; excluded for Super Admin) */}
            {isAffiliatedUser && !isSuperAdminActive && (
              <div className="mb-2 p-3 rounded-xl bg-[#3F1014]/90 border border-[#7F1D1D]/30 text-xs">
                <div className="flex items-center justify-between text-[10px] text-[#FED7AA] font-bold uppercase tracking-wider mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-[#FED7AA] shrink-0" />
                    School Workspace
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-[#7F1D1D]/20 text-[#FED7AA] font-mono text-[9px] font-bold border border-[#7F1D1D]/30">
                    {activeSchool?.semisCode || 'SEMIS'}
                  </span>
                </div>
                <div className="font-semibold text-white truncate text-xs" title={activeSchool?.name || currentUserProfile?.schoolName}>
                  {activeSchool?.name || currentUserProfile?.schoolName || 'Govt. High School'}
                </div>
                <div className="mt-2 pt-2 border-t border-[rgba(255,253,249,0.10)] flex items-center justify-between text-[11px]">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                    userRole === 'admin'
                      ? 'bg-[#7F1D1D]/20 text-[#FED7AA]'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    {userRole === 'admin' ? '👑 School Admin' : '🧑‍🏫 Faculty'}
                  </span>
                  <button
                    type="button"
                    onClick={() => selectTool('sms-onboarding')}
                    className="text-[#FED7AA] hover:text-[#FAF8F5] font-semibold hover:underline cursor-pointer"
                  >
                    Switch School
                  </button>
                </div>
              </div>
            )}

            {/* Strict Super Admin Sidebar: ONLY Platform Overview, Super Admin Fleet, and Notice Board (or Read-Only School View) */}
            {isSuperAdminActive && !isImpersonating && (
              <>
                <div className="pt-1 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-rose-400 flex items-center justify-between">
                  <span>Platform Governance</span>
                  <span className="px-1.5 py-0.2 rounded text-[8px] font-mono font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    Super Admin
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSuperAdminTab('analytics');
                    selectTool('super-admin');
                  }}
                  className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    activeTool === 'super-admin' && superAdminTab === 'analytics'
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-3'
                      : 'text-[#E7E0D4] hover:text-white hover:bg-[#58181D]/60 pl-3.5'
                  }`}
                >
                  <TrendingUp className={`w-4 h-4 shrink-0 ${activeTool === 'super-admin' && superAdminTab === 'analytics' ? 'text-[#FED7AA]' : 'text-[#D6CCC2]'}`} />
                  <div className="truncate flex-1">
                    <span className="block truncate font-semibold">Platform Overview</span>
                    <span className="text-[11px] block truncate text-[#D6CCC2]">
                      Analytics &amp; System KPIs
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSuperAdminTab('directory');
                    selectTool('super-admin');
                  }}
                  className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    activeTool === 'super-admin' && (superAdminTab === 'directory' || superAdminTab === 'pending_requests')
                      ? 'bg-[#7F1D1D] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-3'
                      : 'text-rose-200/80 hover:text-white hover:bg-rose-950/40 pl-3.5'
                  }`}
                >
                  <ShieldAlert className={`w-4 h-4 shrink-0 ${activeTool === 'super-admin' && (superAdminTab === 'directory' || superAdminTab === 'pending_requests') ? 'text-rose-400' : 'text-rose-400/80'}`} />
                  <div className="truncate flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="block truncate font-bold text-rose-200">Super Admin Fleet</span>
                      <span className="px-1.5 py-0.2 text-[8px] font-bold uppercase rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 shrink-0">
                        Root
                      </span>
                    </div>
                    <span className="text-[11px] block truncate text-[#D6CCC2]">
                      Schools Directory &amp; Approvals
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSuperAdminTab('notices');
                    selectTool('super-admin');
                  }}
                  className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    activeTool === 'super-admin' && superAdminTab === 'notices'
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-3'
                      : 'text-[#E7E0D4] hover:text-white hover:bg-[#58181D]/60 pl-3.5'
                  }`}
                >
                  <Megaphone className={`w-4 h-4 shrink-0 ${activeTool === 'super-admin' && superAdminTab === 'notices' ? 'text-amber-400' : 'text-[#D6CCC2]'}`} />
                  <div className="truncate flex-1">
                    <span className="block truncate font-semibold">Notice Board</span>
                    <span className="text-[11px] block truncate text-[#D6CCC2]">
                      Global Announcements
                    </span>
                  </div>
                </button>
              </>
            )}

            {isSuperAdminActive && isImpersonating && (
              <>
                <div className="mb-2 p-3 rounded-xl bg-amber-950/60 border border-amber-500/40 text-xs">
                  <div className="text-[10px] text-amber-300 font-bold uppercase tracking-wider mb-1">
                    Read-Only School View
                  </div>
                  <div className="font-semibold text-white truncate">{activeSchool?.name}</div>
                  <div className="text-[11px] text-amber-200/80 mt-0.5">SEMIS {activeSchool?.semisCode}</div>
                </div>
                <button
                  type="button"
                  onClick={() => selectTool('sms-dashboard')}
                  className="w-full flex items-center gap-3 py-2.5 rounded-xl text-left text-sm bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-3 cursor-pointer"
                >
                  <Eye className="w-4 h-4 shrink-0 text-amber-400" />
                  <div className="truncate">
                    <span className="block truncate">School Admin View</span>
                    <span className="text-[11px] block truncate text-[#D6CCC2]">Strict Read-Only Oversight</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exitImpersonation();
                    setSuperAdminTab('directory');
                    setActiveTool('super-admin');
                  }}
                  className="w-full flex items-center gap-3 py-2.5 rounded-xl text-left text-sm text-rose-300 hover:text-white hover:bg-rose-950/40 pl-3.5 transition cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4 shrink-0 rotate-180" />
                  <span className="truncate font-semibold">Exit Read-Only View</span>
                </button>
              </>
            )}

            {/* ======================================================= */}
            {/* SECTION: SCHOOL MANAGEMENT SYSTEM (SMS)                */}
            {/* Strictly hidden for Super Admin & Parents              */}
            {/* ======================================================= */}
            {(isAffiliatedUser || (demoMode && userRole !== 'super-admin')) && !isSuperAdminActive && (
              <>
                <div className="pt-2 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-[#FED7AA] flex items-center justify-between">
                  <span>{isAffiliatedUser ? 'School Operations' : 'School Management (SMS)'}</span>
                  {demoMode ? (
                    <span className={`px-1.5 py-0.2 rounded text-[8px] font-mono font-bold uppercase tracking-wider ${
                      userRole === 'admin'
                        ? 'bg-[#7F1D1D]/20 text-[#FED7AA] border border-[#7F1D1D]/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}>
                      {userRole === 'admin' ? '👑 Admin (Demo)' : '🧑‍🏫 Teacher (Demo)'}
                    </span>
                  ) : isAffiliatedUser ? (
                    <span className="px-1.5 py-0.2 rounded text-[8px] font-mono font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      Verified
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded text-[8px] font-mono font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      Super Admin
                    </span>
                  )}
                </div>
                {/* SMS Command Center */}
                {/* SMS Command Center / My Dashboard */}
                <button
                  type="button"
                  onClick={() => selectTool('sms-dashboard')}
                  className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    activeTool === 'sms-dashboard'
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-3'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3.5'
                  }`}
                >
                  <SchoolIcon className={`w-4 h-4 shrink-0 ${activeTool === 'sms-dashboard' ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                  <div className="truncate flex-1">
                    <span className="block truncate">
                      {userRole === 'teacher' ? 'My Dashboard' : 'SMS Command Center'}
                    </span>
                    <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                      {userRole === 'teacher' ? 'Teaching Overview & Schedule' : 'School Admin & Overview'}
                    </span>
                  </div>
                </button>

                {/* Classes & Sections / My Classes */}
                <button
                  type="button"
                  onClick={() => selectTool('sms-classes')}
                  className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    activeTool === 'sms-classes'
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-3'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3.5'
                  }`}
                >
                  <GraduationCap className={`w-4 h-4 shrink-0 ${activeTool === 'sms-classes' ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                  <div className="truncate flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="block truncate">
                        {userRole === 'teacher' ? 'My Classes' : 'Classes & Sections'}
                      </span>
                      <span className={`px-1.5 py-0.2 text-[8px] font-bold uppercase rounded shrink-0 ${
                        userRole === 'admin'
                          ? 'bg-[#7F1D1D]/20 text-[#FED7AA] border border-[#7F1D1D]/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {userRole === 'admin' ? 'Admin' : 'Assigned'}
                      </span>
                    </div>
                    <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                      {userRole === 'admin' ? 'Manage KG–12 & Incharges' : 'Assigned Sections & Subjects'}
                    </span>
                  </div>
                </button>

                {/* Student Register (SIS) / My Students */}
                <button
                  type="button"
                  onClick={() => {
                    setSmsFilterClassId(undefined);
                    selectTool('sms-students');
                  }}
                  className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    activeTool === 'sms-students'
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-3'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3.5'
                  }`}
                >
                  <Users className={`w-4 h-4 shrink-0 ${activeTool === 'sms-students' ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                  <div className="truncate flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="block truncate">
                        {userRole === 'teacher' ? 'My Students' : 'Student Register (SIS)'}
                      </span>
                      <span className="px-1.5 py-0.2 text-[8px] font-bold uppercase rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                        {userRole === 'teacher' ? 'Roster' : 'Active'}
                      </span>
                    </div>
                    <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                      {userRole === 'teacher' ? 'Assigned Class Students' : 'GR Admissions & B-Form'}
                    </span>
                  </div>
                </button>

                {/* Daily Attendance Register / Take Attendance */}
                <button
                  type="button"
                  onClick={() => {
                    setSmsAttendanceClassId(undefined);
                    selectTool('sms-attendance');
                  }}
                  className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    activeTool === 'sms-attendance'
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-3'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3.5'
                  }`}
                >
                  <CalendarCheck2 className={`w-4 h-4 shrink-0 ${activeTool === 'sms-attendance' ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                  <div className="truncate flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="block truncate">
                        {userRole === 'teacher' ? 'Take Attendance' : 'Daily Attendance'}
                      </span>
                      <span className="px-1.5 py-0.2 text-[8px] font-bold uppercase rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                        {userRole === 'teacher' ? 'Roll Call' : 'Active'}
                      </span>
                    </div>
                    <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                      {userRole === 'teacher' ? 'Daily Section Register' : 'Roll Call & A4 Register'}
                    </span>
                  </div>
                </button>

                {/* Exams & Results (Admin Setup + Teacher Assigned-Class Marks) */}
                <button
                  type="button"
                  onClick={() => selectTool('sms-exams')}
                  className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    activeTool === 'sms-exams'
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-3'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3.5'
                  }`}
                >
                  <Award className={`w-4 h-4 shrink-0 ${activeTool === 'sms-exams' ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                  <div className="truncate flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="block truncate">Exams &amp; Results</span>
                      <span className="px-1.5 py-0.2 text-[8px] font-bold uppercase rounded bg-[#7F1D1D]/20 text-[#FED7AA] border border-[#7F1D1D]/30 shrink-0">
                        {userRole === 'teacher' ? 'Marks' : 'Phase B'}
                      </span>
                    </div>
                    <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                      {userRole === 'teacher' ? 'Marks Entry & Report Cards' : 'Exam Setup, Marks & PDF Cards'}
                    </span>
                  </div>
                </button>

                {/* Phase D: Class Timetable */}
                <button
                  type="button"
                  onClick={() => selectTool('sms-timetable')}
                  className={`w-full flex items-center gap-3 py-2.5 min-h-[44px] rounded-xl text-left text-sm transition-all cursor-pointer ${
                    activeTool === 'sms-timetable'
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-3'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3.5'
                  }`}
                >
                  <CalendarDays className={`w-4 h-4 shrink-0 ${activeTool === 'sms-timetable' ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                  <div className="truncate flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="block truncate">Timetable &amp; Routine</span>
                      <span className="px-1.5 py-0.2 text-[8px] font-bold uppercase rounded bg-[#C2410C]/20 text-[#FED7AA] border border-[#C2410C]/30 shrink-0">
                        Phase D
                      </span>
                    </div>
                    <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                      {userRole === 'admin' ? 'Build Period Schedule' : 'Class Period Routine'}
                    </span>
                  </div>
                </button>

                {/* Phase D: Daily Homework Diary */}
                <button
                  type="button"
                  onClick={() => selectTool('sms-homework')}
                  className={`w-full flex items-center gap-3 py-2.5 min-h-[44px] rounded-xl text-left text-sm transition-all cursor-pointer ${
                    activeTool === 'sms-homework'
                      ? 'bg-[#3F1014] text-white font-semibold shadow-xs border-l-[3px] border-emerald-500 pl-3'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3.5'
                  }`}
                >
                  <BookOpen className={`w-4 h-4 shrink-0 ${activeTool === 'sms-homework' ? 'text-emerald-400' : 'text-[#D6CCC2]/75'}`} />
                  <div className="truncate flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="block truncate">Homework &amp; Diary</span>
                      <span className="px-1.5 py-0.2 text-[8px] font-bold uppercase rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                        Diary
                      </span>
                    </div>
                    <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                      Daily Subject Assignments
                    </span>
                  </div>
                </button>

                {/* Phase D (Admin Only): Transfer & Character Certificates */}
                {userRole === 'admin' && (
                  <button
                    type="button"
                    onClick={() => selectTool('sms-certificates')}
                    className={`w-full flex items-center gap-3 py-2.5 min-h-[44px] rounded-xl text-left text-sm transition-all cursor-pointer ${
                      activeTool === 'sms-certificates'
                        ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-3'
                        : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3.5'
                    }`}
                  >
                    <FileBadge2 className={`w-4 h-4 shrink-0 ${activeTool === 'sms-certificates' ? 'text-amber-400' : 'text-[#D6CCC2]/75'}`} />
                    <div className="truncate flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="block truncate">Certificates (TC / CC)</span>
                        <span className="px-1.5 py-0.2 text-[8px] font-bold uppercase rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                          Admin
                        </span>
                      </div>
                      <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                        Transfer &amp; Character A4
                      </span>
                    </div>
                  </button>
                )}

                {/* Admin Only: Faculty Management & Join Requests */}
                {userRole === 'admin' && (
                  <button
                    type="button"
                    onClick={() => selectTool('sms-staff')}
                    className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                      activeTool === 'sms-staff'
                        ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-3'
                        : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3.5'
                    }`}
                  >
                    <UserCheck className={`w-4 h-4 shrink-0 ${activeTool === 'sms-staff' ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                    <div className="truncate flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="block truncate">Faculty &amp; Requests</span>
                        {pendingJoinRequests.length > 0 ? (
                          <span className="px-1.5 py-0.2 text-[8px] font-bold uppercase rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 animate-pulse">
                            {pendingJoinRequests.length} Pending
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 text-[8px] font-bold uppercase rounded bg-[#7F1D1D]/20 text-[#FED7AA] border border-[#7F1D1D]/30 shrink-0">
                            Admin
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                        Incharges &amp; Approvals
                      </span>
                    </div>
                  </button>
                )}

                {/* Fee Management (Admin & Admission Incharge) */}
                {canCollectFee && (
                  <button
                    type="button"
                    onClick={() => selectTool('sms-fees')}
                    className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                      activeTool === 'sms-fees'
                        ? 'bg-[#3F1014] text-white font-semibold shadow-xs border-l-[3px] border-emerald-500 pl-3'
                        : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3.5'
                    }`}
                  >
                    <Receipt className={`w-4 h-4 shrink-0 ${activeTool === 'sms-fees' ? 'text-emerald-400' : 'text-[#D6CCC2]/75'}`} />
                    <div className="truncate flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="block truncate">Fee Management</span>
                        <span className={`px-1.5 py-0.2 text-[8px] font-bold uppercase rounded shrink-0 ${
                          userRole === 'admin'
                            ? 'bg-[#7F1D1D]/20 text-[#FED7AA] border border-[#7F1D1D]/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {userRole === 'admin' ? 'Accounts' : 'Incharge'}
                        </span>
                      </div>
                      <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                        Structure, Vouchers &amp; Reports
                      </span>
                    </div>
                  </button>
                )}

                {/* Teacher Profile & Portfolio / My Profile */}
                <button
                  type="button"
                  onClick={() => selectTool('sms-profile')}
                  className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    activeTool === 'sms-profile'
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-3'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3.5'
                  }`}
                >
                  <ShieldCheck className={`w-4 h-4 shrink-0 ${activeTool === 'sms-profile' ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                  <div className="truncate flex-1">
                    <span className="block truncate">
                      {userRole === 'teacher' ? 'My Profile' : 'My School Profile'}
                    </span>
                    <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                      {userRole === 'teacher' ? 'Institutional Credentials & Roles' : 'Admin Credentials & School Info'}
                    </span>
                  </div>
                </button>

                {/* School Onboarding / Switch School (Admin / Demo Only) */}
                {(userRole === 'admin' || demoMode) && (
                  <button
                    type="button"
                    onClick={() => selectTool('sms-onboarding')}
                    className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                      activeTool === 'sms-onboarding'
                        ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-3'
                        : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3.5'
                    }`}
                  >
                    <Building className={`w-4 h-4 shrink-0 ${activeTool === 'sms-onboarding' ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                    <div className="truncate flex-1">
                      <span className="block truncate">{isAffiliatedUser ? 'Switch / Add School' : 'Join / Register School'}</span>
                      <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                        Affiliation &amp; Verification
                      </span>
                    </div>
                  </button>
                )}
              </>
            )}

            {/* If Affiliated and in Focused SMS Mode, show a clean toggle to explore general tools */}
            {isAffiliatedUser && !showPublicTools && (
              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => setShowPublicTools(true)}
                  className="w-full py-2 px-3 rounded-xl border border-dashed border-[rgba(255,253,249,0.10)] hover:border-[rgba(255,253,249,0.28)] bg-[#2C1215]/40 hover:bg-[#58181D]/50 text-[#D6CCC2] hover:text-[#FAF8F5] text-xs font-medium flex items-center justify-between transition cursor-pointer"
                >
                  <span>Explore Public Tools</span>
                  <span className="text-[10px] text-[#FED7AA] font-semibold">AI Studio →</span>
                </button>
              </div>
            )}

            {/* If Affiliated and currently viewing public tools, provide button to return to focused mode */}
            {isAffiliatedUser && showPublicTools && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPublicTools(false);
                    setActiveTool('sms-dashboard');
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-[#7F1D1D]/20 hover:bg-[#651414]/30 border border-[#7F1D1D]/40 text-[#FED7AA] text-xs font-medium flex items-center justify-between transition cursor-pointer"
                >
                  <span>← Return to School SMS</span>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#7F1D1D]/30">Focused</span>
                </button>
              </div>
            )}

            {/* ======================================================= */}
            {/* SECTION: TEACHER'S AI STUDIO (EXISTING TOOLS)           */}
            {/* HIDDEN for Parents, Students, Super Admin & Staff       */}
            {/* ======================================================= */}
            {!isParentUser && !isStudentUser && !isSuperAdminActive && (!isAffiliatedUser || showPublicTools) && (
              <>
                <div className="pt-4 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-[#D6CCC2]/75 flex items-center justify-between">
                  <span>Teacher's AI Studio</span>
                  {isAffiliatedUser && (
                    <span className="text-[9px] text-[#FED7AA] font-semibold uppercase">Public</span>
                  )}
                </div>

                {/* MODULE 1: AI Lesson Plan */}
                <button
                  type="button"
                  onClick={() => selectTool('lesson-plan')}
                  className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    activeTool === 'lesson-plan'
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-3'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3.5'
                  }`}
                >
                  <BookOpen className={`w-4 h-4 shrink-0 ${activeTool === 'lesson-plan' ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                  <div className="truncate">
                    <span className="block truncate">1. AI Lesson Planner</span>
                    <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                      STBB / PTB Plans
                    </span>
                  </div>
                </button>

                {/* MODULE 2: Salary Calculator */}
                <button
                  type="button"
                  onClick={() => selectTool('salary-calculator')}
                  className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    activeTool === 'salary-calculator'
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-3'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3.5'
                  }`}
                >
                  <Calculator className={`w-4 h-4 shrink-0 ${activeTool === 'salary-calculator' ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                  <div className="truncate">
                    <span className="block truncate">2. Sindh Salary Calculator</span>
                    <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                      Budget 2026 · BPS-01 to 22
                    </span>
                  </div>
                </button>

                {/* MODULE 3: Leave Application */}
                <button
                  type="button"
                  onClick={() => selectTool('leave-generator')}
                  className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    activeTool === 'leave-generator'
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-3'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3.5'
                  }`}
                >
                  <FileSignature className={`w-4 h-4 shrink-0 ${activeTool === 'leave-generator' ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                  <div className="truncate">
                    <span className="block truncate">3. SELD FRAMES Leave</span>
                    <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                      38 Leave Types · A4 Proforma
                    </span>
                  </div>
                </button>

                {/* MODULE 4: AtlierCV Studio */}
                <button
                  type="button"
                  onClick={() => selectTool('atlier-cv')}
                  className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    activeTool === 'atlier-cv'
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-3'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3.5'
                  }`}
                >
                  <Briefcase className={`w-4 h-4 shrink-0 ${activeTool === 'atlier-cv' ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                  <div className="truncate flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="block truncate">4. AtlierCV Studio</span>
                      <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase rounded bg-[#7F1D1D]/20 text-[#FED7AA] border border-[#7F1D1D]/30 shrink-0">
                        ATS
                      </span>
                    </div>
                    <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                      AI Resume Studio
                    </span>
                  </div>
                </button>

                {/* MODULE 5: Service Book Calculator */}
                <button
                  type="button"
                  onClick={() => selectTool('service-book')}
                  className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    activeTool === 'service-book'
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-3'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3.5'
                  }`}
                >
                  <BookCheck className={`w-4 h-4 shrink-0 ${activeTool === 'service-book' ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                  <div className="truncate flex-1">
                    <span className="block truncate">5. Service Book &amp; Pension</span>
                    <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                      Time Scale &amp; 365d Leave
                    </span>
                  </div>
                </button>

                {/* MODULE 6: AI Question Paper Maker */}
                <button
                  type="button"
                  onClick={() => selectTool('question-paper')}
                  className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-left text-sm transition-all cursor-pointer ${
                    activeTool === 'question-paper'
                      ? 'bg-[#C2410C] text-[#FFFDF9] font-semibold shadow-xs border-l-[3px] border-[#FED7AA] pl-3'
                      : 'text-[#D6CCC2] hover:text-[#FAF8F5] hover:bg-[rgba(255,253,249,0.08)] pl-3.5'
                  }`}
                >
                  <FileSpreadsheet className={`w-4 h-4 shrink-0 ${activeTool === 'question-paper' ? 'text-[#FED7AA]' : 'text-[#D6CCC2]/75'}`} />
                  <div className="truncate flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="block truncate">6. AI Question Paper</span>
                      <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase rounded bg-[#7F1D1D]/20 text-[#FED7AA] border border-[#7F1D1D]/30 shrink-0">
                        AI
                      </span>
                    </div>
                    <span className="text-[11px] block truncate text-[#D6CCC2]/75">
                      Class 1–12 Exam Maker
                    </span>
                  </div>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Sidebar Footer: Unified Auth Card */}
        <div className="p-4 border-t border-[rgba(255,253,249,0.10)] bg-black/20 space-y-3">
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
          className="no-print fixed inset-0 z-30 bg-[#2C1215]/60 backdrop-blur-xs lg:hidden"
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
                setActiveTool('super-admin');
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
              <button
                type="button"
                onClick={() =>
                  selectTool(
                    isParentUser
                      ? 'sms-parent'
                      : isStudentUser
                      ? 'sms-student-portal'
                      : isSuperAdminActive
                      ? isImpersonating
                        ? 'sms-dashboard'
                        : 'super-admin'
                      : isAffiliatedUser && !showPublicTools
                      ? 'sms-dashboard'
                      : 'dashboard'
                  )
                }
                className="font-medium text-[#57534E] dark:text-[#D6CCC2] hover:text-[#651414] dark:hover:text-[#FED7AA] cursor-pointer shrink-0"
              >
                PakEdu
              </button>
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
              <button
                type="button"
                onClick={() => selectTool('sms-parent')}
                className="px-3 py-1.5 rounded-t-lg border-b-2 border-[#C2410C] bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold cursor-pointer"
              >
                Parent Portal (Read-Only)
              </button>
            ) : isStudentUser ? (
              <button
                type="button"
                onClick={() => selectTool('sms-student-portal')}
                className="px-3 py-1.5 rounded-t-lg border-b-2 border-[#C2410C] bg-[#FFF7ED] dark:bg-[#2C1215] text-[#C2410C] dark:text-[#FDBA74] font-bold cursor-pointer"
              >
                Student Portal (Read-Only)
              </button>
            ) : isSuperAdminActive ? (
              isImpersonating ? (
                <>
                  <button
                    type="button"
                    onClick={() => selectTool('sms-dashboard')}
                    className="px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold cursor-pointer"
                  >
                    School Admin View (Read-Only)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      exitImpersonation();
                      setSuperAdminTab('directory');
                      setActiveTool('super-admin');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#2C1215] text-white font-semibold hover:bg-[#58181D] cursor-pointer"
                  >
                    Exit Read-Only View
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setSuperAdminTab('analytics');
                      selectTool('super-admin');
                    }}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      activeTool === 'super-admin' && superAdminTab === 'analytics'
                        ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                        : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                    }`}
                  >
                    Platform Overview
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSuperAdminTab('directory');
                      selectTool('super-admin');
                    }}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      activeTool === 'super-admin' && (superAdminTab === 'directory' || superAdminTab === 'pending_requests')
                        ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                        : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                    }`}
                  >
                    Super Admin Fleet
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSuperAdminTab('notices');
                      selectTool('super-admin');
                    }}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      activeTool === 'super-admin' && superAdminTab === 'notices'
                        ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                        : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                    }`}
                  >
                    Notice Board
                  </button>
                </>
              )
            ) : isAffiliatedUser && !showPublicTools ? (
              <>
                <button
                  type="button"
                  onClick={() => selectTool('sms-dashboard')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeTool === 'sms-dashboard'
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  {userRole === 'teacher' ? 'My Dashboard' : 'Command Center'}
                </button>
                <button
                  type="button"
                  onClick={() => selectTool('sms-classes')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeTool === 'sms-classes'
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  {userRole === 'teacher' ? 'My Classes' : 'Classes'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSmsFilterClassId(undefined);
                    selectTool('sms-students');
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeTool === 'sms-students'
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  {userRole === 'teacher' ? 'My Students' : 'Students'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSmsAttendanceClassId(undefined);
                    selectTool('sms-attendance');
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeTool === 'sms-attendance'
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  {userRole === 'teacher' ? 'Take Attendance' : 'Attendance'}
                </button>
                <button
                  type="button"
                  onClick={() => selectTool('sms-exams')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeTool === 'sms-exams'
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  Exams &amp; Results
                </button>
                <button
                  type="button"
                  onClick={() => selectTool('sms-timetable')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeTool === 'sms-timetable'
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  Timetable
                </button>
                <button
                  type="button"
                  onClick={() => selectTool('sms-homework')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeTool === 'sms-homework'
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  Homework
                </button>
                {userRole === 'admin' && (
                  <button
                    type="button"
                    onClick={() => selectTool('sms-certificates')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      activeTool === 'sms-certificates'
                        ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                        : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                    }`}
                  >
                    Certificates
                  </button>
                )}
                {userRole === 'admin' && (
                  <button
                    type="button"
                    onClick={() => selectTool('sms-staff')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      activeTool === 'sms-staff'
                        ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                        : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                    }`}
                  >
                    Faculty
                  </button>
                )}
                {canCollectFee && (
                  <button
                    type="button"
                    onClick={() => selectTool('sms-fees')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      activeTool === 'sms-fees'
                        ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                        : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                    }`}
                  >
                    Fees &amp; Accounts
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => selectTool('sms-profile')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeTool === 'sms-profile'
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  My Profile
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => selectTool('dashboard')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeTool === 'dashboard'
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => selectTool(demoMode || isAffiliatedUser ? 'sms-dashboard' : 'sms-onboarding')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeTool.startsWith('sms-')
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  {isAffiliatedUser ? 'School Operations' : demoMode ? 'School SMS' : 'Join School'}
                </button>
                <button
                  type="button"
                  onClick={() => selectTool('lesson-plan')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeTool === 'lesson-plan'
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  Lesson Plans
                </button>
                <button
                  type="button"
                  onClick={() => selectTool('salary-calculator')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeTool === 'salary-calculator'
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  Salary
                </button>
                <button
                  type="button"
                  onClick={() => selectTool('leave-generator')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeTool === 'leave-generator'
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  Leave
                </button>
                <button
                  type="button"
                  onClick={() => selectTool('atlier-cv')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeTool === 'atlier-cv'
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  CV Studio
                </button>
                <button
                  type="button"
                  onClick={() => selectTool('service-book')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeTool === 'service-book'
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  Service Book
                </button>
                <button
                  type="button"
                  onClick={() => selectTool('question-paper')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeTool === 'question-paper'
                      ? 'bg-[#FEF2F2]/70 dark:bg-[#2C1215] text-[#7F1D1D] dark:text-[#FCA5A5] font-bold border-b-2 border-[#C2410C] rounded-b-none'
                      : 'hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
                  }`}
                >
                  Exam Maker
                </button>
              </>
            )}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap justify-end">
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
                  onClick={() => setUserRole('admin')}
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
                  onClick={() => setUserRole('teacher')}
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
                    selectTool('super-admin');
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
        <main className="app-content-container flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6 min-w-0 overflow-x-hidden">
          {/* Animated Updates Ticker */}
          <div className="no-print flex items-center bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-xl shadow-xs overflow-hidden">
            <div className="bg-[#2C1215] dark:bg-[#2C1215] text-white px-3.5 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 shrink-0 z-10">
              <Bell className="w-3.5 h-3.5 text-[#FED7AA]" />
              <span>Updates</span>
            </div>
            <div className="flex-1 overflow-hidden relative py-2">
              <div className="allforu-ticker-track items-center gap-8 text-xs font-medium text-[#57534E] dark:text-[#E7E0D4]">
                <span
                  onClick={() => selectTool('atlier-cv')}
                  className="inline-flex items-center gap-2 px-4 cursor-pointer hover:text-[#651414]"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#7F1D1D]" />
                  <span>AtlierCV Studio now locally integrated! Build ATS-ready resumes with AI.</span>
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-[#FEF2F2] text-[#7F1D1D] dark:bg-[#3F1014]/60 dark:text-[#FCA5A5] border border-[#FECACA]/60 dark:border-[#7F1D1D]/60">
                    NEW
                  </span>
                </span>
                <span
                  onClick={() => selectTool('salary-calculator')}
                  className="inline-flex items-center gap-2 px-4 cursor-pointer hover:text-[#651414]"
                >
                  <span>Sindh Budget 2026 Pay &amp; Pension scales active for BPS-01 to BPS-22.</span>
                </span>
                <span
                  onClick={() => selectTool('question-paper')}
                  className="inline-flex items-center gap-2 px-4 cursor-pointer hover:text-[#651414]"
                >
                  <span>Question Paper Maker: Class 1–12 bilingual exam builder with school logo.</span>
                </span>
              </div>
            </div>
          </div>

          {/* =================================================================== */}
          {/* CONDITIONAL HEADER: ONLY HERO ON DASHBOARD, COMPACT HEADER ON TOOLS */}
          {/* =================================================================== */}
          {activeTool === 'dashboard' ? (
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
                      onClick={() => selectTool('lesson-plan')}
                      className="allforu-btn-demo px-6 py-2.5 text-xs sm:text-sm cursor-pointer"
                    >
                      Open Lesson Planner →
                    </button>
                    <button
                      type="button"
                      onClick={() => selectTool('atlier-cv')}
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
                          selectTool('sms-dashboard');
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
                onClick={() => selectTool('sms-dashboard')}
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
                  onClick={(e) => { e.stopPropagation(); selectTool('sms-classes'); }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#C2410C] hover:bg-[#9A3412] text-[#FFFDF9] text-xs font-semibold rounded-xl shrink-0 transition cursor-pointer"
                >
                  <span>Manage Classes &amp; Sections</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* 6 ERP Module Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Card 1 */}
                <div
                  onClick={() => selectTool('lesson-plan')}
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
                  onClick={() => selectTool('salary-calculator')}
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
                  onClick={() => selectTool('leave-generator')}
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
                  onClick={() => selectTool('atlier-cv')}
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
                  onClick={() => selectTool('service-book')}
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
                  onClick={() => selectTool('question-paper')}
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
          ) : (
            /* COMPACT TOOL HEADER: Shows only when inside a specific tool */
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
                onClick={() => selectTool('dashboard')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#44403C] dark:text-[#E7E0D4] bg-[#F3EFEA] hover:bg-[#E7E0D4] dark:bg-[#2C1215] dark:hover:bg-[#4A1C20] rounded-xl transition-colors shrink-0 cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>All Modules</span>
              </button>
            </div>
          )}

          {/* =================================================================== */}
          {/* ACTIVE TOOL WORKSPACE WITH SMOOTH MOTION FADE-IN                   */}
          {/* =================================================================== */}
          <motion.div
            key={activeTool}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {/* SCHOOL MANAGEMENT SYSTEM (SMS) VIEWS */}
            {activeTool === 'sms-dashboard' && (
              <SmsDashboard
                onNavigateToClasses={() => selectTool('sms-classes')}
                onNavigateToStudents={() => {
                  setSmsFilterClassId(undefined);
                  selectTool('sms-students');
                }}
                onNavigateToAttendance={(classId) => {
                  setSmsAttendanceClassId(classId);
                  selectTool('sms-attendance');
                }}
                onNavigateToStaff={() => selectTool('sms-staff')}
                onNavigateToProfile={() => selectTool('sms-profile')}
                onNavigateToExams={() => selectTool('sms-exams')}
                onNavigateToTimetable={() => selectTool('sms-timetable')}
                onNavigateToHomework={() => selectTool('sms-homework')}
                onNavigateToCertificates={() => selectTool('sms-certificates')}
              />
            )}

            {activeTool === 'sms-classes' && (
              <ClassesManagement
                onNavigateToAttendance={(classId) => {
                  setSmsAttendanceClassId(classId);
                  selectTool('sms-attendance');
                }}
                onNavigateToStudents={(classId) => {
                  setSmsFilterClassId(classId);
                  selectTool('sms-students');
                }}
              />
            )}

            {activeTool === 'sms-students' && (
              <StudentDirectory
                onBack={() => selectTool('sms-dashboard')}
                onNavigateToAttendance={(classId) => {
                  setSmsAttendanceClassId(classId);
                  selectTool('sms-attendance');
                }}
                initialClassId={smsFilterClassId}
              />
            )}

            {activeTool === 'sms-attendance' && (
              <DailyAttendanceRegister
                onBack={() => selectTool('sms-dashboard')}
                initialClassId={smsAttendanceClassId}
              />
            )}

            {activeTool === 'sms-onboarding' && (
              <SmsOnboarding
                currentUser={currentUser}
                onOpenAuthModal={() => openAuthModal('signin')}
                onOnboardingComplete={() => selectTool('sms-dashboard')}
                initialTab={smsOnboardingTab}
              />
            )}

            {activeTool === 'sms-staff' && (
              <TeacherManagement onBack={() => selectTool('sms-dashboard')} />
            )}

            {activeTool === 'sms-profile' && (
              <TeacherProfile
                onBack={() => selectTool('sms-dashboard')}
                onNavigateToAttendance={(classId) => {
                  setSmsAttendanceClassId(classId);
                  selectTool('sms-attendance');
                }}
                onNavigateToStudents={(classId) => {
                  setSmsFilterClassId(classId);
                  selectTool('sms-students');
                }}
              />
            )}

            {/* Fee Management & Financials Module */}
            {activeTool === 'sms-fees' && (
              <FeeManagement onBack={() => selectTool('sms-dashboard')} />
            )}

            {/* Phase B: Exams & Student Results Module */}
            {activeTool === 'sms-exams' && (
              <ExamsResults onBack={() => selectTool('sms-dashboard')} />
            )}

            {/* Phase D: Class Timetable, Homework Diary & Official Certificates */}
            {activeTool === 'sms-timetable' && (
              <TimetableManager onBack={() => selectTool('sms-dashboard')} />
            )}

            {activeTool === 'sms-homework' && (
              <HomeworkManager onBack={() => selectTool('sms-dashboard')} />
            )}

            {activeTool === 'sms-certificates' && (
              <CertificatesManager onBack={() => selectTool('sms-dashboard')} />
            )}

            {/* Phase C: Parent Portal (Strict Read-Only Child Progress) */}
            {activeTool === 'sms-parent' && <ParentDashboard />}

            {/* Student Portal (Strict Read-Only Self Progress) */}
            {activeTool === 'sms-student-portal' && <StudentDashboard />}

            {/* SUPER ADMIN CONSOLE VIEW */}
            {activeTool === 'super-admin' && (
              <SuperAdminDashboard
                activeTab={superAdminTab}
                onTabChange={setSuperAdminTab}
                onNavigateToSchool={() => setActiveTool('sms-dashboard')}
                onOpenRegisterSchool={() => selectTool('sms-onboarding')}
              />
            )}

            {/* TEACHER'S AI STUDIO VIEWS (EXISTING MODULES) */}
            {activeTool === 'lesson-plan' && (
              <LessonPlanTool
                currentUser={currentUser}
                onRequestSignIn={() => openAuthModal('signin')}
              />
            )}

            {activeTool === 'salary-calculator' && <SalaryCalculatorTool />}

            {activeTool === 'leave-generator' && <LeaveApplicationTool />}

            {activeTool === 'atlier-cv' && (
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
            )}

            {activeTool === 'service-book' && <ServiceBookCalculatorTool />}

            {activeTool === 'question-paper' && <QuestionPaperTool />}
          </motion.div>
        </main>

        {/* Enterprise SaaS Footer */}
        <footer className="app-footer no-print border-t border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] bg-[#FFFDF9] dark:bg-[#211415] px-6 py-4 text-xs text-[#57534E] dark:text-[#D6CCC2] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[#1C1917] dark:text-[#FAF8F5]">
              PakEdu &amp; Sindh SELD Official Portal
            </span>
            <span className="font-mono text-[11px] bg-[#F3EFEA] dark:bg-[#2C1215] text-[#57534E] dark:text-[#E7E0D4] px-2 py-0.5 rounded">
              v{portalVersion}
            </span>
            <span>·</span>
            <span>
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
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SmsProvider>
        <AppContent />
      </SmsProvider>
    </AuthProvider>
  );
}
