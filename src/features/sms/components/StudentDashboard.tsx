import React, { useState, useMemo, useEffect } from 'react';
import {
  Award,
  BookOpen,
  Building,
  CalendarCheck2,
  CalendarDays,
  CreditCard,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  Lock,
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

interface StudentDashboardProps {
  onBack?: () => void;
}

type StudentTab =
  | 'overview'
  | 'attendance'
  | 'homework'
  | 'timetable'
  | 'results'
  | 'fees';

export const StudentDashboard: React.FC<StudentDashboardProps> = () => {
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
    linkStudentAccount,
  } = useSms();

  const [activeTab, setActiveTab] = useState<StudentTab>('overview');

  // Strictly scoped student profile (only their own studentId record)
  const studentProfile = useMemo(() => {
    if (!currentUserProfile?.studentId) return students[0] || null;
    return students.find((s) => s.id === currentUserProfile.studentId) || null;
  }, [students, currentUserProfile?.studentId]);

  const studentClass = useMemo(() => {
    if (!studentProfile) return classes[0] || null;
    return classes.find((c) => c.id === studentProfile.classId) || null;
  }, [classes, studentProfile]);

  const studentTimetable = useMemo(
    () => filterStudentTimetable(timetableEntries, studentProfile?.classId),
    [timetableEntries, studentProfile?.classId]
  );

  const studentHomework = useMemo(
    () => filterStudentHomework(homeworkItems, studentProfile?.classId),
    [homeworkItems, studentProfile?.classId]
  );

  const publishedExamsForStudent = useMemo(
    () => getPublishedExamsForClass(exams, studentProfile?.classId),
    [exams, studentProfile?.classId]
  );

  // =========================================================================
  // Self-Claim Student Link State (if unlinked after Google/pending signup)
  // =========================================================================
  const [claimSchoolId, setClaimSchoolId] = useState<string>(activeSchool?.id || '');
  const [claimGrNumber, setClaimGrNumber] = useState<string>(
    currentUserProfile?.studentGrNumber || ''
  );
  const [claimInviteCode, setClaimInviteCode] = useState<string>(
    currentUserProfile?.linkedInviteCode || ''
  );
  const [availableSchools, setAvailableSchools] = useState(registeredSchools);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState<boolean>(false);

  useEffect(() => {
    if (!studentProfile) {
      fetchSchoolsFromFirestore()
        .then((list) => {
          const activeOnly = (list || []).filter(
            (s) => s.status !== 'suspended' && s.status !== 'pending_approval'
          );
          if (activeOnly.length > 0) {
            setAvailableSchools(activeOnly);
            if (!claimSchoolId) setClaimSchoolId(activeOnly[0].id);
          }
        })
        .catch(() => {});
    }
  }, [studentProfile, claimSchoolId]);

  const handleLinkStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setClaimError(null);
    if (!claimSchoolId) {
      setClaimError('Please select your school.');
      return;
    }
    if (!claimGrNumber.trim()) {
      setClaimError('Please enter your GR / Admission Number.');
      return;
    }
    setIsClaiming(true);
    try {
      const linked = await linkStudentAccount({
        schoolId: claimSchoolId,
        grNumber: claimGrNumber.trim(),
        inviteCode: claimInviteCode.trim() || undefined,
      });
      if (!linked) {
        setClaimError('Could not verify your GR Number & Student Invite Code with this school.');
      }
    } catch (err: any) {
      setClaimError(
        err?.message || 'Verification failed. Please check your Invite Code or registered Student Email.'
      );
    } finally {
      setIsClaiming(false);
    }
  };

  // Attendance Stats (Monthly & Register Log)
  const [selectedAttendanceMonth, setSelectedAttendanceMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const studentAttendanceStats = useMemo(
    () =>
      computeStudentAttendanceStats(
        studentProfile?.id,
        studentProfile?.classId,
        attendanceRegisters,
        selectedAttendanceMonth
      ),
    [studentProfile?.id, studentProfile?.classId, attendanceRegisters, selectedAttendanceMonth]
  );

  // Read-Only Fee Status Ledger
  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const studentFeeLedger = useMemo(() => {
    if (!studentProfile) return null;
    return calculateStudentFeeLedger(
      studentProfile,
      feeStructures,
      feePayments,
      feeConcessions,
      currentMonthKey
    );
  }, [studentProfile, feeStructures, feePayments, feeConcessions, currentMonthKey]);

  const [reportExamForPrint, setReportExamForPrint] = useState<Exam | null>(null);

  useEffect(() => {
    if (!reportExamForPrint) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setReportExamForPrint(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [reportExamForPrint]);

  if (!studentProfile) {
    const schoolOptions = availableSchools.length > 0 ? availableSchools : registeredSchools;

    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-200">
        <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#FFF7ED] dark:bg-[#7C2D12]/60 text-[#C2410C] dark:text-[#FDBA74] flex items-center justify-center shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FFF7ED] dark:bg-[#7C2D12]/70 text-[#C2410C] dark:text-[#FDBA74]">
                Student Portal · Verification Required
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-[#1C1917] dark:text-[#FAF8F5] mt-1">
                Link Your Student Profile
              </h2>
              <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-1 leading-relaxed">
                Select your school and enter your GR Number along with your Student Invite Code (or sign in with your Student Email registered by school: {currentUserProfile?.email}) to access your attendance, homework, class timetable, and exam report cards.
              </p>
            </div>
          </div>

          {claimError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{claimError}</span>
            </div>
          )}

          <form onSubmit={handleLinkStudent} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                Your School <span className="text-rose-500">*</span>
              </label>
              <select
                value={claimSchoolId}
                onChange={(e) => setClaimSchoolId(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5]"
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
                  Your GR Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={claimGrNumber}
                  onChange={(e) => setClaimGrNumber(e.target.value)}
                  placeholder="e.g., GR-1042"
                  className="w-full min-h-[44px] px-3.5 py-2.5 text-xs font-mono rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                  Student Invite Code (From School)
                </label>
                <input
                  type="text"
                  value={claimInviteCode}
                  onChange={(e) => setClaimInviteCode(e.target.value)}
                  placeholder="e.g., STU-1042-XXXX"
                  className="w-full min-h-[44px] px-3.5 py-2.5 text-xs font-mono uppercase rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isClaiming}
              className="w-full min-h-[44px] py-3 bg-[#7F1D1D] hover:bg-[#651414] text-white rounded-xl text-sm font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <KeyRound className="w-4 h-4" />
              <span>{isClaiming ? 'Verifying Student Account...' : 'Verify & Open Student Portal'}</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  const classLabel = `${studentProfile.grade} - ${studentProfile.section || studentClass?.section || 'General'}`;

  const tabs: Array<{ id: StudentTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
    { id: 'attendance', label: 'Attendance', icon: <CalendarCheck2 className="w-3.5 h-3.5" /> },
    { id: 'homework', label: `Homework (${studentHomework.length})`, icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'timetable', label: 'Timetable', icon: <CalendarDays className="w-3.5 h-3.5" /> },
    { id: 'results', label: `Results (${publishedExamsForStudent.length})`, icon: <Award className="w-3.5 h-3.5" /> },
    { id: 'fees', label: 'Fee Status', icon: <CreditCard className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200">
      <div className={reportExamForPrint ? 'no-print space-y-6' : 'space-y-6'}>
        {/* Student Identity & School Header Card */}
        <div
          className="text-[#FAF8F5] rounded-3xl p-6 sm:p-7 shadow-xl border border-[rgba(255,253,249,0.14)] relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #58181D 0%, #3F1014 100%)' }}
        >
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              {studentProfile.photoUrl ? (
                <img
                  src={studentProfile.photoUrl}
                  alt={studentProfile.fullName}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-[#FED7AA]/50 shadow-md shrink-0 bg-[#FFFDF9]"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-[#C2410C]/25 border-2 border-[#FED7AA]/40 text-[#FED7AA] flex items-center justify-center font-black text-3xl shrink-0">
                  {studentProfile.fullName.charAt(0)}
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>Student Portal · Strict Read-Only</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/10 text-[#FAF8F5]">
                    GR: {studentProfile.grNumber}
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                  {studentProfile.fullName}
                </h1>
                <div className="text-xs text-[#E7E0D4] flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>Father: <strong>{studentProfile.fatherName}</strong></span>
                  <span>·</span>
                  <span>
                    Class: <strong>{classLabel}</strong>
                  </span>
                  <span>·</span>
                  <span className="capitalize">
                    Status: <strong className="text-emerald-300">{studentProfile.status}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-2xl p-4 text-xs space-y-1 w-full md:w-auto md:min-w-[240px]">
              <div className="flex items-center gap-1.5 text-[#FED7AA] font-bold text-[11px] uppercase">
                <Building className="w-3.5 h-3.5" />
                <span>{activeSchool.name}</span>
              </div>
              <div className="text-[#E7E0D4]">
                SEMIS Code: <strong className="font-mono text-white">{activeSchool.semisCode}</strong>
              </div>
              <div className="text-[#E7E0D4]">
                Student Login: <strong className="text-white">{currentUserProfile?.email}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* 4-Metric Student Summary Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-[#57534E] uppercase tracking-wider">
                Monthly Attendance
              </span>
              <CalendarCheck2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-[#1C1917] dark:text-[#FAF8F5]">
              {studentAttendanceStats.monthTotal > 0 ? `${studentAttendanceStats.monthPercentage}%` : '—'}
            </div>
            <div className="text-[11px] text-[#57534E] dark:text-[#D6CCC2] mt-1">
              Present: {studentAttendanceStats.monthPresent} · Absent: {studentAttendanceStats.monthAbsent}
            </div>
          </div>

          <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-[#57534E] uppercase tracking-wider">
                Homework Diary
              </span>
              <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
              {studentHomework.length}
            </div>
            <div className="text-[11px] text-[#57534E] dark:text-[#D6CCC2] mt-1">
              Assignments posted for {classLabel}
            </div>
          </div>

          <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-[#57534E] uppercase tracking-wider">
                Exam Results
              </span>
              <Award className="w-4 h-4 text-[#7F1D1D] dark:text-[#FCA5A5]" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-[#7F1D1D] dark:text-[#FCA5A5]">
              {publishedExamsForStudent.length}
            </div>
            <div className="text-[11px] text-[#57534E] dark:text-[#D6CCC2] mt-1">
              Published Report Cards (PDF)
            </div>
          </div>

          <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-[#57534E] uppercase tracking-wider">
                Fee Status
              </span>
              <CreditCard className="w-4 h-4 text-[#C2410C] dark:text-[#FDBA74]" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-[#1C1917] dark:text-[#FAF8F5] font-mono">
              {(studentFeeLedger?.pendingBalance || 0) === 0
                ? 'Paid / Clear'
                : `Rs. ${(studentFeeLedger?.pendingBalance || 0).toLocaleString()}`}
            </div>
            <div className="text-[11px] text-[#57534E] dark:text-[#D6CCC2] mt-1">
              Read-only pending fee balance
            </div>
          </div>
        </div>

        {/* Mobile-Friendly Section Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 whitespace-nowrap transition cursor-pointer shrink-0 ${
                activeTab === tab.id
                  ? 'bg-[#C2410C] text-white shadow-sm'
                  : 'bg-[#FFFDF9] dark:bg-[#211415] text-[#57534E] dark:text-[#E7E0D4] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] hover:bg-[#FAF8F5] dark:hover:bg-[#3F1014]'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {(activeTab === 'overview' || activeTab === 'attendance') && (
          <AttendanceLogSection
            attendanceStats={studentAttendanceStats}
            selectedAttendanceMonth={selectedAttendanceMonth}
            onMonthChange={setSelectedAttendanceMonth}
          />
        )}

        {(activeTab === 'overview' || activeTab === 'timetable' || activeTab === 'homework') && (
          <TimetableAndHomeworkSection
            timetableEntries={studentTimetable}
            homeworkItems={studentHomework}
            classLabel={classLabel}
          />
        )}

        {(activeTab === 'overview' || activeTab === 'results') && (
          <PublishedExamsSection
            publishedExams={publishedExamsForStudent}
            examMarks={examMarks}
            studentId={studentProfile.id}
            onSelectExamForPrint={setReportExamForPrint}
          />
        )}

        {(activeTab === 'overview' || activeTab === 'fees') && studentFeeLedger && (
          <FeeStatusSection feeLedger={studentFeeLedger} />
        )}
      </div>

      {reportExamForPrint && (
        <ReportCardPrintModal
          exam={reportExamForPrint}
          student={studentProfile}
          activeSchool={activeSchool}
          examMarks={examMarks}
          attendanceStats={studentAttendanceStats}
          onClose={() => setReportExamForPrint(null)}
          onPrint={triggerPrintDocument}
        />
      )}
    </div>
  );
};
