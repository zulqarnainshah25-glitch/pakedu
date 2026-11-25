import React, { useState } from 'react';
import {
  School as SchoolIcon,
  GraduationCap,
  Users,
  ShieldCheck,
  UserCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Building,
  KeyRound,
  LogIn,
  RotateCcw,
  Search,
  User,
  Mail,
  Phone,
  HelpCircle,
} from 'lucide-react';
import { useSms } from '../context/SmsContext';
import { useAuth } from '../../../context/AuthContext';
import { PrimaryAdminType } from '../types';

interface SmsOnboardingProps {
  currentUser: { uid: string; email: string | null; displayName: string | null } | null;
  onOpenAuthModal: () => void;
  onOnboardingComplete: () => void;
  initialTab?: 'register' | 'join';
}

export const SmsOnboarding: React.FC<SmsOnboardingProps> = ({
  currentUser,
  onOpenAuthModal,
  onOnboardingComplete,
  initialTab,
}) => {
  const {
    activeSchool,
    registeredSchools,
    registerNewSchool,
    submitSchoolRegistration,
    submitJoinRequest,
    currentUserProfile,
    pendingJoinRequests,
    approveJoinRequest,
    classes,
    demoMode,
  } = useSms();

  const [activeTab, setActiveTab] = useState<'register' | 'join'>(() => {
    if (initialTab) return initialTab;
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('pakedu_signup_sms_role');
      if (stored === 'join' || stored === 'register') return stored;
    }
    return 'register';
  });

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // School Registration Form State
  const [schoolName, setSchoolName] = useState('');
  const [semisCode, setSemisCode] = useState('');
  const [board, setBoard] = useState<'Sindh STBB' | 'Punjab PTB' | 'Federal'>('Sindh STBB');
  const [district, setDistrict] = useState('Hyderabad');
  const [taluka, setTaluka] = useState('Latifabad');
  const [adminPhone, setAdminPhone] = useState('0300-');
  const [academicYear, setAcademicYear] = useState('2025-2026');

  // Primary Administrator Selection (Requirement 3)
  const [primaryAdminType, setPrimaryAdminType] = useState<PrimaryAdminType>('principal');
  const [delegatedAdminName, setDelegatedAdminName] = useState('');
  const [delegatedAdminEmail, setDelegatedAdminEmail] = useState('');
  const [delegatedAdminPhone, setDelegatedAdminPhone] = useState('');

  // Teacher Join Form State
  const [teacherName, setTeacherName] = useState(currentUser?.displayName || '');
  const [teacherFatherName, setTeacherFatherName] = useState('');
  const [cnic, setCnic] = useState('');
  const [designation, setDesignation] = useState('JEST (Junior Elementary School Teacher)');
  const [targetSemisCode, setTargetSemisCode] = useState(activeSchool?.semisCode || '403020101');
  const [teacherPhone, setTeacherPhone] = useState('0300-');

  const [formError, setFormError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [checkingApproval, setCheckingApproval] = useState(false);

  const { refreshUserProfile } = useAuth();

  const handleCheckApprovalStatus = async () => {
    setCheckingApproval(true);
    setFormError(null);
    try {
      const refreshed = await refreshUserProfile();
      if (refreshed?.status === 'active') {
        setSuccessToast('Your institutional account has been approved! Redirecting to dashboard...');
        onOnboardingComplete();
      } else {
        setSuccessToast('Status checked: Your application is still awaiting administrator review.');
        setTimeout(() => setSuccessToast(null), 4000);
      }
    } catch {
      setFormError('Unable to check approval status right now. Please try again.');
    } finally {
      setCheckingApproval(false);
    }
  };

  // If user profile status
  const isPending = currentUserProfile?.status === 'pending';

  // Human-readable SEMIS code lookup
  const matchedPendingSchool = registeredSchools.find((s) => s.id === currentUserProfile?.schoolId);
  const displaySemisCode =
    currentUserProfile?.semisCode ||
    matchedPendingSchool?.semisCode ||
    (currentUserProfile?.schoolId?.startsWith('sch_')
      ? currentUserProfile.schoolId.replace(/^sch_/, '')
      : currentUserProfile?.schoolId) ||
    '—';
  const isActive = currentUserProfile?.status === 'active' && Boolean(currentUserProfile?.schoolId);

  // Handle Register School (Path A)
  const handleRegisterSchool = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!schoolName.trim()) {
      setFormError('Official School Name is required.');
      return;
    }
    if (!semisCode.trim() || semisCode.length < 5) {
      setFormError('Please enter a valid SEMIS Code (at least 5 digits).');
      return;
    }

    if (primaryAdminType === 'delegated') {
      if (!delegatedAdminName.trim() || !delegatedAdminEmail.trim()) {
        setFormError('Please provide the Full Name and Official Email of the assigned Administrator.');
        return;
      }
    }

    const email = currentUser?.email || 'admin@school.pakedu.pk';
    const uid = currentUser?.uid || `uid_${Date.now()}`;
    const callerName = currentUser?.displayName || 'Educator Admin';

    const primaryAdminName =
      primaryAdminType === 'delegated' ? delegatedAdminName.trim() : callerName;
    const primaryAdminEmail =
      primaryAdminType === 'delegated' ? delegatedAdminEmail.trim().toLowerCase() : email;

    submitSchoolRegistration(
      {
        name: schoolName.trim(),
        semisCode: semisCode.trim(),
        board,
        district: district.trim(),
        taluka: taluka.trim(),
        activeAcademicYear: academicYear,
        phone: adminPhone.trim(),
        email: primaryAdminEmail,
        status: 'pending_approval',
        primaryAdminType,
        primaryAdminName,
        primaryAdminEmail,
      },
      {
        fullName: callerName,
        email,
        phone: adminPhone.trim(),
        uid,
        primaryAdminType,
      }
    );

    setSuccessToast(
      `School registration for "${schoolName}" submitted! Application forwarded to Portal Super Admin for verification.`
    );
  };

  // Handle Join School as Teacher (Path B)
  const handleJoinSchool = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!teacherName.trim()) {
      setFormError('Teacher Full Name is required.');
      return;
    }
    if (!targetSemisCode.trim()) {
      setFormError('Target School SEMIS Code is required.');
      return;
    }

    // Lookup school by SEMIS
    const targetSchool = registeredSchools.find(
      (s) => s.semisCode.trim().toLowerCase() === targetSemisCode.trim().toLowerCase()
    ) || registeredSchools[0] || activeSchool;

    const email = currentUser?.email || 'teacher@pakedu.pk';
    const uid = currentUser?.uid || `uid_t_${Date.now()}`;

    submitJoinRequest({
      uid,
      fullName: teacherName.trim(),
      fatherName: teacherFatherName.trim() || undefined,
      email,
      phone: teacherPhone.trim(),
      cnic: cnic.trim() || undefined,
      designation: designation.trim(),
      schoolId: targetSchool.id,
      schoolName: targetSchool.name,
      semisCode: targetSchool.semisCode,
    });

    setSuccessToast(
      `Join request sent to ${targetSchool.name}. Application is now pending administrator review.`
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Institutional Header */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Sindh SELD School Management System · Verification Gateway</span>
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">
            Institutional Onboarding &amp; Verification
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
            To safeguard student General Register (GR) records and official daily attendance registers, each educator must belong to a verified school institution.
          </p>
        </div>
      </div>

      {/* Success Notification */}
      {successToast && (
        <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 px-4 py-3 rounded-2xl flex items-center gap-2 text-xs shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-semibold">{successToast}</span>
        </div>
      )}

      {/* CASE 1: NOT LOGGED IN */}
      {!currentUser ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-12 text-center space-y-5 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
            <KeyRound className="w-7 h-7" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Authentication Required
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Please sign in with your official teacher or school administrator account. After signing in, you will be able to register a new school or join an existing one.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md transition cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In / Create Account</span>
            </button>
          </div>
        </div>
      ) : isPending ? (
        /* CASE 2: APPLICATION PENDING REVIEW (ADMIN VS TEACHER) */
        currentUserProfile?.role === 'admin' ? (
          /* Subcase A: School Registration Pending Super Admin Approval */
          <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/80 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Building className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                  Super Admin Approval Pending
                </span>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  School Registration Under Review
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Your registration application for <strong className="text-slate-800 dark:text-slate-200">{currentUserProfile?.schoolName}</strong> has been submitted to the Portal Super Admin. Once reviewed and approved, your School Administrator role and command center will activate automatically.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500 text-[11px] block">Registered Institution:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {currentUserProfile?.schoolName || 'New School Registration'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">SEMIS Code:</span>
                  <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                    {displaySemisCode}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Applicant Administrator:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {currentUserProfile?.fullName || currentUser.displayName || 'Administrator'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Designation:</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {currentUserProfile?.designation || 'Principal / Administrator'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Official Email:</span>
                  <span className="font-mono text-slate-900 dark:text-white">
                    {currentUserProfile?.email || currentUser.email}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Super Admin Verification Gate Active</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  As an institutional security policy, all new school establishments require clearance by the Portal Super Administrator to prevent unauthorized data access and preserve multi-tenant isolation.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCheckApprovalStatus}
                disabled={checkingApproval}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs whitespace-nowrap transition cursor-pointer disabled:opacity-60 shrink-0"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${checkingApproval ? 'animate-spin' : ''}`} />
                <span>{checkingApproval ? 'Checking...' : 'Check Approval Status'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Subcase B: Teacher Affiliation Pending School Admin Approval */
          <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/80 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                  Application Under Review
                </span>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Faculty Affiliation Request Submitted
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Your application has been received by the School Administrator. Once verified and assigned to your classes under &ldquo;Faculty &amp; Requests&rdquo;, you will have immediate access to your attendance register.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500 text-[11px] block">Applied School:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {currentUserProfile?.schoolName || 'Govt. Comprehensive High School'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">SEMIS Code:</span>
                  <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                    {displaySemisCode}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Applicant Name:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {currentUserProfile?.fullName || currentUser.displayName || 'Teacher'}
                  </span>
                </div>
                {currentUserProfile?.fatherName && (
                  <div>
                    <span className="text-slate-500 text-[11px] block">Father&apos;s Name:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {currentUserProfile.fatherName}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-slate-500 text-[11px] block">Designation:</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {currentUserProfile?.designation || 'Faculty Member'}
                  </span>
                </div>
                {currentUserProfile?.cnic && (
                  <div>
                    <span className="text-slate-500 text-[11px] block">CNIC:</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      {currentUserProfile.cnic}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-slate-500 text-[11px] block">Applicant Email:</span>
                  <span className="font-mono text-slate-900 dark:text-white">
                    {currentUserProfile?.email || currentUser.email}
                  </span>
                </div>
                {currentUserProfile?.phone && (
                  <div>
                    <span className="text-slate-500 text-[11px] block">Contact Phone:</span>
                    <span className="font-mono text-slate-900 dark:text-white">
                      {currentUserProfile.phone}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Strict Institutional Security Policy Active</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Your application is securely queued for administrative review. Once your school headmaster or administrator verifies your account and allocates your classes under &ldquo;Faculty &amp; Requests&rdquo;, your School Operations workspace will unlock automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCheckApprovalStatus}
                disabled={checkingApproval}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs whitespace-nowrap transition cursor-pointer disabled:opacity-60 shrink-0"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${checkingApproval ? 'animate-spin' : ''}`} />
                <span>{checkingApproval ? 'Checking...' : 'Check Approval Status'}</span>
              </button>
            </div>
          </div>
        )
      ) : isActive ? (
        /* CASE 3: ALREADY AFFILIATED */
        <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/80 rounded-3xl p-6 sm:p-8 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                Active Institutional Membership
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Affiliated with {currentUserProfile?.schoolName}
              </h2>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            You are actively enrolled as{' '}
            <strong className="text-slate-900 dark:text-white">
              {currentUserProfile?.role === 'admin' ? 'School Administrator' : 'Class Teacher'}
            </strong>
            . You can access your daily register or switch affiliation below.
          </p>
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onOnboardingComplete}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              Open SMS Command Center →
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('join')}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:underline cursor-pointer"
            >
              Request Switch to Another School
            </button>
          </div>
        </div>
      ) : (
        /* CASE 4: LOGGED IN BUT UNAFFILIATED -> CHOOSE PATH A OR PATH B */
        <div className="space-y-6">
          {/* Explicit Role Selection Header */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider block mb-1">
              Select Your Institutional Role:
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Please specify whether you are registering a new school institution as an administrator or joining an existing school as a faculty teacher.
            </p>
          </div>

          {/* Path Selector Tabs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Path A Tab Card */}
            <div
              onClick={() => {
                setActiveTab('register');
                setFormError(null);
              }}
              className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-4 ${
                activeTab === 'register'
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 shadow-md ring-2 ring-indigo-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  activeTab === 'register'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Building className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    (a) School Admin / Principal
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    Register School
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Register a new school establishment. Application goes to Portal Super Admin for review &amp; clearance.
                </p>
              </div>
            </div>

            {/* Path B Tab Card */}
            <div
              onClick={() => {
                setActiveTab('join');
                setFormError(null);
              }}
              className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-4 ${
                activeTab === 'join'
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 shadow-md ring-2 ring-indigo-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  activeTab === 'join'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <GraduationCap className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    (b) Teacher / Faculty
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    Join Existing
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Join an existing registered school by entering its SEMIS code. Application goes to your School Administrator for approval.
                </p>
              </div>
            </div>
          </div>

          {/* Form Error Banner */}
          {formError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 shadow-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* PATH A FORM: REGISTER SCHOOL */}
          {activeTab === 'register' ? (
            <form
              onSubmit={handleRegisterSchool}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm"
            >
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Step 1: School Identity &amp; Government Registry
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Enter official School Education &amp; Literacy Department (SELD) institutional parameters.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* School Name */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Official School Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="e.g., Govt. Comprehensive Boys Higher Secondary School Latifabad"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* SEMIS Code */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                    <span>SEMIS Code (8–9 digits) *</span>
                    <span className="text-[10px] text-indigo-500 font-mono">Unique ID</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={semisCode}
                    onChange={(e) => setSemisCode(e.target.value)}
                    placeholder="e.g., 403020101"
                    className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Curriculum Board */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Curriculum &amp; Board *
                  </label>
                  <select
                    value={board}
                    onChange={(e) => setBoard(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Sindh STBB">Sindh Textbook Board (STBB)</option>
                    <option value="Punjab PTB">Punjab Textbook Board (PTB)</option>
                    <option value="Federal">Federal Board (FBISE)</option>
                  </select>
                </div>

                {/* District */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    District *
                  </label>
                  <input
                    type="text"
                    required
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="e.g., Hyderabad, Karachi Central, Dadu, Sukkur"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Taluka */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Taluka / Sub-division *
                  </label>
                  <input
                    type="text"
                    required
                    value={taluka}
                    onChange={(e) => setTaluka(e.target.value)}
                    placeholder="e.g., Latifabad, Qasimabad, City"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Step 2: Primary Administrator Designation (Requirement 3) */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Step 2: Who is the Primary Administrator? *
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Decide who has administrative rights to configure classes, teachers, and approve faculty requests.
                  </p>
                </div>

                {/* Radio Options */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Option 1: Principal */}
                  <label
                    className={`p-4 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between space-y-2 ${
                      primaryAdminType === 'principal'
                        ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 ring-1 ring-indigo-500'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="primaryAdminType"
                        value="principal"
                        checked={primaryAdminType === 'principal'}
                        onChange={() => setPrimaryAdminType('principal')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                        I am the Principal
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      I am the Headmaster / Principal and will manage the school.
                    </span>
                  </label>

                  {/* Option 2: Teacher Admin */}
                  <label
                    className={`p-4 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between space-y-2 ${
                      primaryAdminType === 'teacher_admin'
                        ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 ring-1 ring-indigo-500'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="primaryAdminType"
                        value="teacher_admin"
                        checked={primaryAdminType === 'teacher_admin'}
                        onChange={() => setPrimaryAdminType('teacher_admin')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                        I am a Teacher / Staff
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      I am an educator registering with Admin permissions.
                    </span>
                  </label>

                  {/* Option 3: Delegated */}
                  <label
                    className={`p-4 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between space-y-2 ${
                      primaryAdminType === 'delegated'
                        ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 ring-1 ring-indigo-500'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="primaryAdminType"
                        value="delegated"
                        checked={primaryAdminType === 'delegated'}
                        onChange={() => setPrimaryAdminType('delegated')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                        Assign Different Person
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Designate another official as the Primary Admin.
                    </span>
                  </label>
                </div>

                {/* If Delegated: Extra Inputs */}
                {primaryAdminType === 'delegated' && (
                  <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 space-y-3 animate-in fade-in">
                    <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 block">
                      Enter Designated Administrator's Credentials
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          Admin Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={delegatedAdminName}
                          onChange={(e) => setDelegatedAdminName(e.target.value)}
                          placeholder="e.g., Sir Ghulam Mustafa"
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          Admin Official Email *
                        </label>
                        <input
                          type="email"
                          required
                          value={delegatedAdminEmail}
                          onChange={(e) => setDelegatedAdminEmail(e.target.value)}
                          placeholder="e.g., principal@seld.gos.pk"
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          Admin Phone
                        </label>
                        <input
                          type="tel"
                          value={delegatedAdminPhone}
                          onChange={(e) => setDelegatedAdminPhone(e.target.value)}
                          placeholder="0300-1234567"
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Ready to activate school database.
                </span>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md transition cursor-pointer flex items-center gap-2"
                >
                  <span>Register School &amp; Open Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          ) : (
            /* PATH B FORM: JOIN EXISTING SCHOOL AS FACULTY */
            <form
              onSubmit={handleJoinSchool}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm"
            >
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Faculty Enrollment Application
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select your school by SEMIS code. Your application will be sent to the school headmaster for approval.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Teacher Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Your Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    placeholder="e.g., Ms. Shabana Parveen"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Father's Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Father&apos;s Name
                  </label>
                  <input
                    type="text"
                    value={teacherFatherName}
                    onChange={(e) => setTeacherFatherName(e.target.value)}
                    placeholder="e.g., Muhammad Usman"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Designation */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Official Teaching Cadre / Designation *
                  </label>
                  <select
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="PST (Primary School Teacher)">PST (Primary School Teacher)</option>
                    <option value="JEST (Junior Elementary School Teacher)">JEST (Junior Elementary School Teacher)</option>
                    <option value="EST (Elementary School Teacher)">EST (Elementary School Teacher)</option>
                    <option value="HST (High School Teacher)">HST (High School Teacher)</option>
                    <option value="Subject Specialist (SS)">Subject Specialist (SS)</option>
                    <option value="Senior Subject Specialist (SSS)">Senior Subject Specialist (SSS)</option>
                    <option value="Lecturer / Assistant Professor">Lecturer / Assistant Professor</option>
                  </select>
                </div>

                {/* Target School Selection by SEMIS */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Target School (Select from Directory)
                  </label>
                  <select
                    value={targetSemisCode}
                    onChange={(e) => setTargetSemisCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    {registeredSchools.map((s) => (
                      <option key={s.id} value={s.semisCode}>
                        {s.name} (SEMIS: {s.semisCode} - {s.district})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Target SEMIS Code Manual Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Target SEMIS Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={targetSemisCode}
                    onChange={(e) => setTargetSemisCode(e.target.value)}
                    placeholder="e.g., 403020101"
                    className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* CNIC */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    NADRA CNIC (13 digits)
                  </label>
                  <input
                    type="text"
                    value={cnic}
                    onChange={(e) => setCnic(e.target.value)}
                    placeholder="41303-1234567-1"
                    className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Contact Phone Number
                  </label>
                  <input
                    type="tel"
                    value={teacherPhone}
                    onChange={(e) => setTeacherPhone(e.target.value)}
                    placeholder="0300-1234567"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Application will be sent to the school principal.
                </span>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md transition cursor-pointer flex items-center gap-2"
                >
                  <span>Submit Affiliation Application</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
