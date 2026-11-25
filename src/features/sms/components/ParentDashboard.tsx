import React, { useState, useMemo, useEffect } from 'react';
import {
  Award,
  Building,
  CalendarCheck2,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  GraduationCap,
  KeyRound,
  Lock,
  UserCheck,
  AlertCircle,
} from 'lucide-react';
import { useSms } from '../context/SmsContext';
import { calculateStudentFeeLedger } from '../utils/feeCalculations';
import {
  computeStudentAttendanceStats,
  filterStudentHomework,
  filterStudentTimetable,
  getPublishedExamsForClass,
} from '../utils/portalCalculations';
import { Exam } from '../types';
import { fetchSchoolsFromFirestore } from '../services/smsFirestoreService';
import { triggerPrintDocument } from '../../../utils/printDocument';
import {
  AttendanceLogSection,
  FeeStatusSection,
  PublishedExamsSection,
  ReportCardPrintModal,
  TimetableAndHomeworkSection,
} from './StudentAcademicSections';

interface ParentDashboardProps {
  onBack?: () => void;
}

export const ParentDashboard: React.FC<ParentDashboardProps> = () => {
  const {
    currentUserProfile,
    activeSchool,
    registeredSchools,
    classes,
    students,
    attendanceRegisters,
    feeStructures,
    feePayments,
    feeConcessions,
    exams,
    examMarks,
    timetableEntries,
    homeworkItems,
    linkParentToStudent,
    ensureChildStudentInviteForParent,
  } = useSms();

  // Linked child profile (strictly read-only — parents only receive their own linked child)
  const childStudent = useMemo(() => {
    if (!currentUserProfile?.childStudentId) return students[0] || null;
    return students.find((s) => s.id === currentUserProfile.childStudentId) || null;
  }, [students, currentUserProfile?.childStudentId]);

  const childTimetable = useMemo(
    () => filterStudentTimetable(timetableEntries, childStudent?.classId),
    [timetableEntries, childStudent?.classId]
  );

  const childHomework = useMemo(
    () => filterStudentHomework(homeworkItems, childStudent?.classId),
    [homeworkItems, childStudent?.classId]
  );

  const childClass = useMemo(() => {
    if (!childStudent) return classes[0] || null;
    return classes.find((c) => c.id === childStudent.classId) || null;
  }, [classes, childStudent]);

  // =========================================================================
  // Self-Claim Child Link UI State (if parent signed up via Google / unlinked)
  // =========================================================================
  const [claimSchoolId, setClaimSchoolId] = useState<string>(activeSchool?.id || '');
  const [claimGrNumber, setClaimGrNumber] = useState<string>(currentUserProfile?.childGrNumber || '');
  const [claimInviteCode, setClaimInviteCode] = useState<string>('');
  const [claimPhone, setClaimPhone] = useState<string>(currentUserProfile?.phone || '');
  const [availableSchools, setAvailableSchools] = useState(registeredSchools);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState<boolean>(false);

  useEffect(() => {
    if (!childStudent) {
      fetchSchoolsFromFirestore()
        .then((list) => {
          const activeOnly = (list || []).filter((s) => s.status !== 'suspended' && s.status !== 'pending_approval');
          if (activeOnly.length > 0) {
            setAvailableSchools(activeOnly);
            if (!claimSchoolId) setClaimSchoolId(activeOnly[0].id);
          }
        })
        .catch(() => {});
    }
  }, [childStudent, claimSchoolId]);

  const handleLinkChild = async (e: React.FormEvent) => {
    e.preventDefault();
    setClaimError(null);
    if (!claimSchoolId) {
      setClaimError('Please select your child’s school.');
      return;
    }
    if (!claimGrNumber.trim()) {
      setClaimError('Please enter your child’s GR / Admission Number.');
      return;
    }
    setIsClaiming(true);
    try {
      const linked = await linkParentToStudent({
        schoolId: claimSchoolId,
        grNumber: claimGrNumber.trim(),
        inviteCode: claimInviteCode.trim() || undefined,
        phone: claimPhone.trim() || undefined,
      });
      if (!linked) {
        setClaimError('Could not verify this GR Number & credentials with the selected school.');
      }
    } catch (err: any) {
      setClaimError(err?.message || 'Verification failed. Please check Invite Code, Email, or Guardian Phone.');
    } finally {
      setIsClaiming(false);
    }
  };

  // =========================================================================
  // Attendance Summary Calculations (Read-Only for Linked Child)
  // =========================================================================
  const [selectedAttendanceMonth, setSelectedAttendanceMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const childAttendanceStats = useMemo(
    () =>
      computeStudentAttendanceStats(
        childStudent?.id,
        childStudent?.classId,
        attendanceRegisters,
        selectedAttendanceMonth
      ),
    [childStudent?.id, childStudent?.classId, attendanceRegisters, selectedAttendanceMonth]
  );

  // =========================================================================
  // Fee Status & Ledger (Strict Read-Only)
  // =========================================================================
  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const childFeeLedger = useMemo(() => {
    if (!childStudent) return null;
    return calculateStudentFeeLedger(
      childStudent,
      feeStructures,
      feePayments,
      feeConcessions,
      currentMonthKey
    );
  }, [childStudent, feeStructures, feePayments, feeConcessions, currentMonthKey]);

  // =========================================================================
  // Exam Results & Printable Report Card (Strict Read-Only Published Exams)
  // =========================================================================
  const publishedExamsForChild = useMemo(
    () => getPublishedExamsForClass(exams, childStudent?.classId),
    [exams, childStudent?.classId]
  );

  const [reportExamForPrint, setReportExamForPrint] = useState<Exam | null>(null);
  const [generatedChildInvite, setGeneratedChildInvite] = useState<{
    inviteCode: string;
    inviteUrl: string;
  } | null>(null);
  const [isCreatingStudentInvite, setIsCreatingStudentInvite] = useState(false);
  const [studentInviteFeedback, setStudentInviteFeedback] = useState<string | null>(null);
  const [copiedChildInviteKey, setCopiedChildInviteKey] = useState<string | null>(null);

  const activeChildStudentCode =
    generatedChildInvite?.inviteCode || childStudent?.studentInviteCode || '';
  const isChildStudentLinked = Boolean(childStudent?.studentUid);
  const resolvedChildSchoolId = currentUserProfile?.schoolId || activeSchool.id;
  const activeChildStudentInviteUrl =
    generatedChildInvite?.inviteUrl ||
    (activeChildStudentCode && childStudent
      ? `${typeof window !== 'undefined' ? window.location.origin : ''}/?student_invite=${encodeURIComponent(
          activeChildStudentCode
        )}&school=${encodeURIComponent(resolvedChildSchoolId)}&gr=${encodeURIComponent(
          childStudent.grNumber
        )}`
      : '');

  const handleCreateChildStudentInvite = async () => {
    setIsCreatingStudentInvite(true);
    setStudentInviteFeedback(null);
    try {
      const res = await ensureChildStudentInviteForParent();
      if (res) {
        setGeneratedChildInvite(res);
        setStudentInviteFeedback(
          `Student Invite Code ready: ${res.inviteCode}. Your child can create a Student Portal account using only GR# ${childStudent?.grNumber} and this code (no email needed).`
        );
      } else {
        setStudentInviteFeedback(
          'Unable to create Student Invite Code automatically. Ask your school admin to verify your child link.'
        );
      }
    } finally {
      setIsCreatingStudentInvite(false);
    }
  };

  const handleCopyChildStudentValue = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedChildInviteKey(key);
      setTimeout(() => setCopiedChildInviteKey(null), 2000);
    } catch {
      setStudentInviteFeedback('Clipboard unavailable. Please copy the invite code manually.');
    }
  };

  useEffect(() => {
    if (!reportExamForPrint) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setReportExamForPrint(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [reportExamForPrint]);

  if (!childStudent) {
    const schoolOptions = availableSchools.length > 0 ? availableSchools : registeredSchools;

    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-200">
        <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#FEF2F2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5] flex items-center justify-center shrink-0">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FEE2E2] dark:bg-[#3F1014]/70 text-[#7F1D1D] dark:text-[#FCA5A5]">
                Parent Portal · Verification Required
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-[#1C1917] dark:text-[#FAF8F5] mt-1">
                Link Your Child&apos;s Student Profile
              </h2>
              <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-1 leading-relaxed">
                Enter your child&apos;s School and GR Number along with either your School Invite Code, registered Parent Email ({currentUserProfile?.email}), or Guardian Phone Number to unlock read-only attendance, fee ledger, and exam report cards.
              </p>
            </div>
          </div>

          {claimError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{claimError}</span>
            </div>
          )}

          <form onSubmit={handleLinkChild} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                Child&apos;s School <span className="text-rose-500">*</span>
              </label>
              <select
                value={claimSchoolId}
                onChange={(e) => setClaimSchoolId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5]"
                required
              >
                <option value="">-- Select School --</option>
                {schoolOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (SEMIS: {s.semisCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                  Child&apos;s GR Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={claimGrNumber}
                  onChange={(e) => setClaimGrNumber(e.target.value)}
                  placeholder="e.g., GR-1042"
                  className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                  Parent Invite Code (From School)
                </label>
                <input
                  type="text"
                  value={claimInviteCode}
                  onChange={(e) => setClaimInviteCode(e.target.value)}
                  placeholder="e.g., PAR-1042-XXXX"
                  className="w-full px-3.5 py-2.5 text-xs font-mono uppercase rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                Guardian Phone Number (Alternative verification if Invite Code omitted)
              </label>
              <input
                type="tel"
                value={claimPhone}
                onChange={(e) => setClaimPhone(e.target.value)}
                placeholder="e.g., 0300-1234567"
                className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5]"
              />
            </div>

            <button
              type="submit"
              disabled={isClaiming}
              className="w-full py-3 bg-[#7F1D1D] hover:bg-[#651414] text-white rounded-xl text-sm font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <KeyRound className="w-4 h-4" />
              <span>{isClaiming ? 'Verifying Student Link...' : 'Verify & Link Child Profile'}</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200">
      <div className={reportExamForPrint ? 'no-print space-y-6' : 'space-y-6'}>
        {/* Child Identity & School Header Card */}
        <div className="bg-gradient-to-br from-[#58181D] via-[#7F1D1D] to-[#3F1014] text-white rounded-3xl p-6 sm:p-7 shadow-xl border border-[rgba(255,253,249,0.14)] relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              {childStudent.photoUrl ? (
                <img
                  src={childStudent.photoUrl}
                  alt={childStudent.fullName}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-[#7F1D1D]/50 shadow-md shrink-0 bg-[#FFFDF9]"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-[#7F1D1D]/20 border-2 border-[#7F1D1D]/40 text-[#FED7AA] flex items-center justify-center font-black text-3xl shrink-0">
                  {childStudent.fullName.charAt(0)}
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>Parent Portal · Strict Read-Only</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/10 text-[#FAF8F5]">
                    GR: {childStudent.grNumber}
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                  {childStudent.fullName}
                </h1>
                <div className="text-xs text-[#E7E0D4] flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>Father: <strong>{childStudent.fatherName}</strong></span>
                  <span>·</span>
                  <span>
                    Class: <strong>{childStudent.grade} - {childStudent.section || childClass?.section || 'General'}</strong>
                  </span>
                  <span>·</span>
                  <span className="capitalize">Status: <strong className="text-emerald-300">{childStudent.status}</strong></span>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-2xl p-4 text-xs space-y-1 min-w-[240px]">
              <div className="flex items-center gap-1.5 text-[#FED7AA] font-bold text-[11px] uppercase">
                <Building className="w-3.5 h-3.5" />
                <span>{activeSchool.name}</span>
              </div>
              <div className="text-[#E7E0D4]">SEMIS Code: <strong className="font-mono text-white">{activeSchool.semisCode}</strong></div>
              <div className="text-[#E7E0D4]">Parent Account: <strong className="text-white">{currentUserProfile?.email}</strong></div>
            </div>
          </div>
        </div>

        {/* 3-Metric Top Summary Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Monthly Attendance % */}
          <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#57534E] uppercase tracking-wider">
                Monthly Attendance
              </span>
              <CalendarCheck2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-[#1C1917] dark:text-[#FAF8F5]">
              {childAttendanceStats.monthTotal > 0 ? `${childAttendanceStats.monthPercentage}%` : '—'}
            </div>
            <div className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-1">
              Present: {childAttendanceStats.monthPresent} · Late: {childAttendanceStats.monthLate} · Absent: {childAttendanceStats.monthAbsent}
            </div>
          </div>

          {/* Fee Status Summary */}
          <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#57534E] uppercase tracking-wider">
                Fee Balance (Read-Only)
              </span>
              <CreditCard className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="text-3xl font-black text-rose-600 dark:text-rose-400 font-mono">
              Rs. {(childFeeLedger?.pendingBalance || 0).toLocaleString()}
            </div>
            <div className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-1">
              Total Due: Rs. {(childFeeLedger?.totalDue || 0).toLocaleString()} · Paid: Rs. {(childFeeLedger?.totalPaid || 0).toLocaleString()}
            </div>
          </div>

          {/* Published Exams Count */}
          <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#57534E] uppercase tracking-wider">
                Published Exam Results
              </span>
              <Award className="w-5 h-5 text-[#7F1D1D] dark:text-[#FCA5A5]" />
            </div>
            <div className="text-3xl font-black text-[#7F1D1D] dark:text-[#FCA5A5]">
              {publishedExamsForChild.length}
            </div>
            <div className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-1">
              Official A4 Report Cards ready for download
            </div>
          </div>
        </div>

        {/* Child Student Portal Invite Card (Create/View Code on Parent Dashboard) */}
        <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#FED7AA] dark:border-[#C2410C]/50 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#FFF7ED] dark:bg-[#7C2D12]/60 text-[#C2410C] dark:text-[#FDBA74] flex items-center justify-center shrink-0">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                  Student Portal Access &amp; Invite Code
                </h2>
                <p className="text-xs text-[#57534E] dark:text-[#D6CCC2]">
                  Your child can register and log in using only their Student ID / GR Number and Invite Code (no email address required).
                </p>
              </div>
            </div>

            {isChildStudentLinked ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Student Account Linked
              </span>
            ) : activeChildStudentCode ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <KeyRound className="w-3.5 h-3.5" />
                Invite Code Ready
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#F3EFEA] dark:bg-[#2C1215] text-[#57534E] dark:text-[#E7E0D4]">
                Not Created Yet
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#2C1215]/60 border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)]">
              <div className="text-[11px] text-[#57534E] dark:text-[#D6CCC2]">Login Student ID / GR#</div>
              <div className="font-mono font-bold text-[#1C1917] dark:text-[#FAF8F5] mt-0.5">
                {childStudent.grNumber}
              </div>
              <div className="text-[10px] text-[#78716C] font-mono truncate mt-0.5">
                ID: {childStudent.id}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#FFF7ED]/70 dark:bg-[#7C2D12]/35 border border-[#FED7AA] dark:border-[#C2410C]/50">
              <div className="text-[11px] text-[#C2410C] dark:text-[#FDBA74]">Student Invite Code</div>
              <div className="font-mono font-bold text-[#C2410C] dark:text-[#FDBA74] mt-0.5">
                {activeChildStudentCode || 'Pending creation'}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {!activeChildStudentCode ? (
                <button
                  type="button"
                  onClick={handleCreateChildStudentInvite}
                  disabled={isCreatingStudentInvite}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#C2410C] hover:bg-[#9A3412] text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-60"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>
                    {isCreatingStudentInvite ? 'Creating Code...' : 'Create Student Invite Code'}
                  </span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleCopyChildStudentValue(activeChildStudentCode, 'code')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#C2410C] hover:bg-[#9A3412] text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
                  >
                    {copiedChildInviteKey === 'code' ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied Code</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyChildStudentValue(activeChildStudentInviteUrl, 'url')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#F3EFEA] dark:bg-[#2C1215] hover:bg-[#E7E0D4] dark:hover:bg-[#4A1C20] text-[#44403C] dark:text-[#FAF8F5] text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    {copiedChildInviteKey === 'url' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Copied Link</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Signup Link</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {studentInviteFeedback && (
            <div className="px-3 py-2 rounded-xl bg-[#FFF7ED] dark:bg-[#7C2D12]/40 border border-[#FED7AA] dark:border-[#C2410C]/50 text-xs text-[#C2410C] dark:text-[#FDBA74]">
              {studentInviteFeedback}
            </div>
          )}
        </div>

        <AttendanceLogSection
          attendanceStats={childAttendanceStats}
          selectedAttendanceMonth={selectedAttendanceMonth}
          onMonthChange={setSelectedAttendanceMonth}
        />

        {childFeeLedger && <FeeStatusSection feeLedger={childFeeLedger} />}

        <TimetableAndHomeworkSection
          timetableEntries={childTimetable}
          homeworkItems={childHomework}
          classLabel={`${childStudent.grade} - ${childStudent.section}`}
        />

        <PublishedExamsSection
          publishedExams={publishedExamsForChild}
          examMarks={examMarks}
          studentId={childStudent.id}
          onSelectExamForPrint={setReportExamForPrint}
        />
      </div>

      {reportExamForPrint && (
        <ReportCardPrintModal
          exam={reportExamForPrint}
          student={childStudent}
          activeSchool={activeSchool}
          examMarks={examMarks}
          attendanceStats={childAttendanceStats}
          onClose={() => setReportExamForPrint(null)}
          onPrint={triggerPrintDocument}
        />
      )}
    </div>
  );
};
