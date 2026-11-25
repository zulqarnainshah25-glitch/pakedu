import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Award,
  BookOpen,
  Building,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  FileText,
  GraduationCap,
  KeyRound,
  Loader2,
  Lock,
  Printer,
  Receipt,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X,
  AlertCircle,
} from 'lucide-react';
import { useSms } from '../context/SmsContext';
import { calculateStudentFeeLedger } from '../utils/feeCalculations';
import { computeClassPositions, computeStudentExamResult } from '../utils/examCalculations';
import { Exam } from '../types';
import { fetchSchoolsFromFirestore } from '../services/smsFirestoreService';
import { triggerPrintDocument } from '../../../utils/printDocument';
import { exportA4ElementAsPdf } from '../../../utils/mobilePdfExport';

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
  } = useSms();

  // Linked child profile (strictly read-only — parents only receive their own linked child)
  const childStudent = useMemo(() => {
    if (!currentUserProfile?.childStudentId) return students[0] || null;
    return students.find((s) => s.id === currentUserProfile.childStudentId) || null;
  }, [students, currentUserProfile?.childStudentId]);

  const childTimetable = useMemo(() => {
    if (!childStudent) return [];
    return timetableEntries
      .filter((t) => t.classId === childStudent.classId)
      .sort((a, b) => a.day.localeCompare(b.day) || a.periodNumber - b.periodNumber);
  }, [timetableEntries, childStudent]);

  const childHomework = useMemo(() => {
    if (!childStudent) return [];
    return homeworkItems
      .filter((h) => h.classId === childStudent.classId)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [homeworkItems, childStudent]);

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

  const childAttendanceStats = useMemo(() => {
    if (!childStudent) {
      return {
        monthTotal: 0,
        monthPresent: 0,
        monthAbsent: 0,
        monthLeave: 0,
        monthLate: 0,
        monthPercentage: 0,
        overallPercentage: 0,
        overallTotal: 0,
        recentRows: [] as Array<{ date: string; status: string; note?: string }>,
      };
    }

    const allRows: Array<{ date: string; status: string; note?: string }> = [];
    Object.values(attendanceRegisters).forEach((reg) => {
      if (reg.classId !== childStudent.classId) return;
      const rec = reg.records?.[childStudent.id];
      if (rec) {
        allRows.push({
          date: reg.date,
          status: rec.status,
          note: rec.note,
        });
      }
    });

    allRows.sort((a, b) => b.date.localeCompare(a.date));

    const monthRows = allRows.filter((r) => r.date.startsWith(selectedAttendanceMonth));
    const countStatus = (rows: typeof allRows) => {
      let present = 0;
      let absent = 0;
      let leave = 0;
      let late = 0;
      rows.forEach((r) => {
        if (r.status === 'present') present++;
        else if (r.status === 'absent') absent++;
        else if (r.status === 'leave') leave++;
        else if (r.status === 'late') late++;
      });
      const total = rows.length;
      const pct = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
      return { total, present, absent, leave, late, pct };
    };

    const m = countStatus(monthRows);
    const o = countStatus(allRows);

    return {
      monthTotal: m.total,
      monthPresent: m.present,
      monthAbsent: m.absent,
      monthLeave: m.leave,
      monthLate: m.late,
      monthPercentage: m.pct,
      overallPercentage: o.pct,
      overallTotal: o.total,
      recentRows: monthRows.length > 0 ? monthRows : allRows.slice(0, 15),
    };
  }, [childStudent, attendanceRegisters, selectedAttendanceMonth]);

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
  const publishedExamsForChild = useMemo(() => {
    if (!childStudent) return [];
    return exams.filter(
      (ex) =>
        ex.status === 'published' &&
        (!ex.classIds || ex.classIds.length === 0 || ex.classIds.includes(childStudent.classId))
    );
  }, [exams, childStudent]);

  const [reportExamForPrint, setReportExamForPrint] = useState<Exam | null>(null);
  const [savingReportPdf, setSavingReportPdf] = useState(false);
  const reportCardSheetRef = useRef<HTMLDivElement | null>(null);

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
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-300">
                Parent Portal · Verification Required
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-1">
                Link Your Child&apos;s Student Profile
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
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
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Child&apos;s School <span className="text-rose-500">*</span>
              </label>
              <select
                value={claimSchoolId}
                onChange={(e) => setClaimSchoolId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
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
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Child&apos;s GR Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={claimGrNumber}
                  onChange={(e) => setClaimGrNumber(e.target.value)}
                  placeholder="e.g., GR-1042"
                  className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Parent Invite Code (From School)
                </label>
                <input
                  type="text"
                  value={claimInviteCode}
                  onChange={(e) => setClaimInviteCode(e.target.value)}
                  placeholder="e.g., PAR-1042-XXXX"
                  className="w-full px-3.5 py-2.5 text-xs font-mono uppercase rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Guardian Phone Number (Alternative verification if Invite Code omitted)
              </label>
              <input
                type="tel"
                value={claimPhone}
                onChange={(e) => setClaimPhone(e.target.value)}
                placeholder="e.g., 0300-1234567"
                className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={isClaiming}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
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
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-xl border border-slate-800 relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              {childStudent.photoUrl ? (
                <img
                  src={childStudent.photoUrl}
                  alt={childStudent.fullName}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-indigo-400/50 shadow-md shrink-0 bg-white"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-indigo-500/20 border-2 border-indigo-400/40 text-indigo-200 flex items-center justify-center font-black text-3xl shrink-0">
                  {childStudent.fullName.charAt(0)}
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>Parent Portal · Strict Read-Only</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/10 text-slate-200">
                    GR: {childStudent.grNumber}
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                  {childStudent.fullName}
                </h1>
                <div className="text-xs text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-1">
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
              <div className="flex items-center gap-1.5 text-indigo-300 font-bold text-[11px] uppercase">
                <Building className="w-3.5 h-3.5" />
                <span>{activeSchool.name}</span>
              </div>
              <div className="text-slate-300">SEMIS Code: <strong className="font-mono text-white">{activeSchool.semisCode}</strong></div>
              <div className="text-slate-300">Parent Account: <strong className="text-white">{currentUserProfile?.email}</strong></div>
            </div>
          </div>
        </div>

        {/* 3-Metric Top Summary Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Monthly Attendance % */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Monthly Attendance
              </span>
              <CalendarCheck2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white">
              {childAttendanceStats.monthTotal > 0 ? `${childAttendanceStats.monthPercentage}%` : '—'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Present: {childAttendanceStats.monthPresent} · Late: {childAttendanceStats.monthLate} · Absent: {childAttendanceStats.monthAbsent}
            </div>
          </div>

          {/* Fee Status Summary */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Fee Balance (Read-Only)
              </span>
              <CreditCard className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="text-3xl font-black text-rose-600 dark:text-rose-400 font-mono">
              Rs. {(childFeeLedger?.pendingBalance || 0).toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Total Due: Rs. {(childFeeLedger?.totalDue || 0).toLocaleString()} · Paid: Rs. {(childFeeLedger?.totalPaid || 0).toLocaleString()}
            </div>
          </div>

          {/* Published Exams Count */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Published Exam Results
              </span>
              <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
              {publishedExamsForChild.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Official A4 Report Cards ready for download
            </div>
          </div>
        </div>

        {/* Section 1: Attendance Summary & Log */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarCheck2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Attendance Summary &amp; Register History
              </h2>
            </div>
            <input
              type="month"
              value={selectedAttendanceMonth}
              onChange={(e) => setSelectedAttendanceMonth(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          {childAttendanceStats.recentRows.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              No attendance logs recorded yet for this month.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-60">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Attendance Status</th>
                    <th className="py-2.5 px-3">Teacher Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {childAttendanceStats.recentRows.map((r) => (
                    <tr key={r.date}>
                      <td className="py-2 px-3 font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {r.date}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            r.status === 'present'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : r.status === 'late'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : r.status === 'leave'
                              ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-500 dark:text-slate-400">
                        {r.note || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 2: Fee Status (Strict Read-Only) */}
        {childFeeLedger && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Fee Status &amp; Payment Receipts (Read-Only)
                </h2>
              </div>
              {childFeeLedger.activeConcession.concessionTitle && (
                <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-bold">
                  Approved Concession: {childFeeLedger.activeConcession.concessionTitle}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Due</span>
                <strong className="text-base font-mono text-slate-900 dark:text-white">
                  Rs. {childFeeLedger.totalDue.toLocaleString()}
                </strong>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
                <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 block">Total Paid</span>
                <strong className="text-base font-mono text-emerald-700 dark:text-emerald-300">
                  Rs. {childFeeLedger.totalPaid.toLocaleString()}
                </strong>
              </div>
              <div className="p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60">
                <span className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-400 block">Pending Balance</span>
                <strong className="text-base font-mono text-rose-700 dark:text-rose-300">
                  Rs. {childFeeLedger.pendingBalance.toLocaleString()}
                </strong>
              </div>
              <div className="p-3.5 rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60">
                <span className="text-[10px] font-bold uppercase text-sky-700 dark:text-sky-400 block">Advance Credit</span>
                <strong className="text-base font-mono text-sky-700 dark:text-sky-300">
                  Rs. {childFeeLedger.advanceBalance.toLocaleString()}
                </strong>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Billing Month</th>
                    <th className="py-2.5 px-3 text-right">Net Due</th>
                    <th className="py-2.5 px-3 text-right">Paid</th>
                    <th className="py-2.5 px-3 text-right">Pending Balance</th>
                    <th className="py-2.5 px-3">Receipt #</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {childFeeLedger.rows.map((row) => (
                    <tr key={row.month}>
                      <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                        {row.monthLabel}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        Rs. {row.netDue.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        Rs. {row.paidAmount.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                        Rs. {row.pendingBalance.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">
                        {row.receiptNumber || '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            row.status === 'paid'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : row.status === 'partial'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : row.status === 'advance_credit'
                              ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}
                        >
                          {row.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section 2B: Child Class Timetable & Daily Homework (Read-Only) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Class Timetable (Read-Only)
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-slate-400">
                {childTimetable.length} periods
              </span>
            </div>

            {childTimetable.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                Timetable schedule has not been published for this class yet.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-64">
                <table className="min-w-[420px] w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/70 text-[10px] uppercase text-slate-500">
                    <tr>
                      <th className="py-2 px-3">Day</th>
                      <th className="py-2 px-3">Period</th>
                      <th className="py-2 px-3">Subject</th>
                      <th className="py-2 px-3">Teacher</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {childTimetable.map((slot) => (
                      <tr key={slot.id}>
                        <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                          {slot.day}
                        </td>
                        <td className="py-2 px-3 font-mono text-indigo-600 dark:text-indigo-400">
                          P{slot.periodNumber}
                        </td>
                        <td className="py-2 px-3 font-semibold">{slot.subject}</td>
                        <td className="py-2 px-3 text-slate-500">{slot.teacherName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Daily Homework Diary
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-slate-400">
                {childHomework.length} assigned
              </span>
            </div>

            {childHomework.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                No active homework assigned for {childStudent.grade} - {childStudent.section}.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {childHomework.map((hw) => (
                  <div
                    key={hw.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                        {hw.subject}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-slate-500">
                        <Clock className="w-3 h-3" />
                        Due: {hw.dueDate}
                      </span>
                    </div>
                    {hw.title && (
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {hw.title}
                      </div>
                    )}
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                      {hw.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Exam Results & Downloadable PDF Report Cards */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Published Exam Results &amp; Report Cards (PDF)
            </h2>
          </div>

          {publishedExamsForChild.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              No published examination results available yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {publishedExamsForChild.map((ex) => {
                const record = examMarks.find(
                  (m) => m.examId === ex.id && m.studentId === childStudent.id
                );
                const computed = computeStudentExamResult(
                  ex,
                  record?.subjectMarks || {},
                  record?.absentSubjects || []
                );
                return (
                  <div
                    key={ex.id}
                    className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {ex.title}
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          {ex.termType} · Session {ex.academicYear}
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          computed.resultStatus === 'Pass'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : computed.resultStatus === 'Fail'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {computed.resultStatus}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Marks</span>
                        <strong className="font-mono text-slate-900 dark:text-white">
                          {computed.hasEnteredAnyMarks
                            ? `${computed.totalObtained} / ${computed.totalMax}`
                            : '—'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Percentage</span>
                        <strong className="font-mono text-slate-900 dark:text-white">
                          {computed.hasEnteredAnyMarks ? `${computed.percentage.toFixed(1)}%` : '—'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Grade</span>
                        <strong className="text-indigo-600 dark:text-indigo-400">
                          {computed.overallGrade}
                        </strong>
                      </div>
                    </div>

                    {record?.remarks && (
                      <p className="text-[11px] italic text-slate-600 dark:text-slate-300">
                        Teacher Remarks: &ldquo;{record.remarks}&rdquo;
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => setReportExamForPrint(ex)}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      <span>View &amp; Download Report Card (PDF)</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Printable Report Card PDF Modal for Parent (Strict Read-Only) */}
      {reportExamForPrint && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-6 print:static print:bg-transparent print:p-0 print:block"
          onClick={() => setReportExamForPrint(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-4xl max-h-[92vh] bg-white text-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden print:max-w-none print:max-h-none print:shadow-none print:rounded-none print:overflow-visible print:block"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="print:hidden shrink-0 flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-200 bg-white">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Official Report Card — {childStudent.fullName} ({reportExamForPrint.title})
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!reportCardSheetRef.current || !childStudent) return;
                    setSavingReportPdf(true);
                    try {
                      await exportA4ElementAsPdf(
                        reportCardSheetRef.current,
                        `Report-Card-${childStudent.grNumber}-${reportExamForPrint.title.replace(/\s+/g, '-')}.pdf`
                      );
                    } catch {
                      triggerPrintDocument();
                    } finally {
                      setSavingReportPdf(false);
                    }
                  }}
                  disabled={savingReportPdf}
                  className="min-h-[40px] px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {savingReportPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span>{savingReportPdf ? 'Saving PDF...' : 'Save / Share PDF'}</span>
                </button>
                <button
                  type="button"
                  onClick={triggerPrintDocument}
                  className="min-h-[40px] px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print / Save as PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReportExamForPrint(null)}
                  className="min-h-[40px] px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>Close</span>
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-4 sm:p-6 print:overflow-visible print:p-0">
              {(() => {
                const record = examMarks.find(
                  (m) => m.examId === reportExamForPrint.id && m.studentId === childStudent.id
                );
                const result = computeStudentExamResult(
                  reportExamForPrint,
                  record?.subjectMarks || {},
                  record?.absentSubjects || []
                );
                const remarks =
                  record?.remarks ||
                  result.suggestedRemark ||
                  'Consistent attendance and steady effort encouraged.';

                return (
                  <div
                    ref={reportCardSheetRef}
                    className="printable-a4-sheet bg-white text-slate-900 p-6 sm:p-8 border-2 border-slate-800 rounded-xl"
                  >
                    <div className="flex items-center justify-between gap-4 border-b-2 border-slate-900 pb-4">
                      <div className="flex items-center gap-4">
                        {activeSchool.logoUrl ? (
                          <img
                            src={activeSchool.logoUrl}
                            alt="School Logo"
                            className="w-16 h-16 object-contain rounded-xl border border-slate-300 bg-white p-1 shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-2xl bg-emerald-900 text-amber-300 flex flex-col items-center justify-center border-2 border-emerald-700 shrink-0">
                            <GraduationCap className="w-8 h-8" />
                            <span className="text-[8px] font-black uppercase text-white">SELD</span>
                          </div>
                        )}
                        <div>
                          <div className="text-[10px] font-bold tracking-widest text-emerald-800 uppercase">
                            GOVERNMENT OF SINDH · SCHOOL EDUCATION &amp; LITERACY DEPARTMENT
                          </div>
                          <h2 className="text-xl font-black text-slate-900 uppercase">
                            {activeSchool.name}
                          </h2>
                          <div className="text-xs text-slate-600 font-medium">
                            SEMIS Code: <strong className="font-mono text-slate-900">{activeSchool.semisCode}</strong> · {activeSchool.district}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="px-3 py-1 rounded bg-slate-900 text-white text-[10px] font-black uppercase inline-block">
                          PROGRESS REPORT CARD
                        </div>
                        <div className="text-sm font-black text-indigo-800 mt-1">
                          {reportExamForPrint.title}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Session: {reportExamForPrint.academicYear}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-500 block">Student Name</span>
                        <strong className="text-slate-900">{childStudent.fullName}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-500 block">Father&apos;s Name</span>
                        <strong className="text-slate-900">{childStudent.fatherName}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-500 block">GR Number</span>
                        <strong className="font-mono text-slate-900">{childStudent.grNumber}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-500 block">Class &amp; Section</span>
                        <strong className="text-slate-900">{childStudent.grade} - {childStudent.section}</strong>
                      </div>
                    </div>

                    <table className="w-full text-xs border-collapse border border-slate-400">
                      <thead>
                        <tr className="bg-slate-100 text-slate-900">
                          <th className="py-2 px-3 border border-slate-400 text-left">Subject</th>
                          <th className="py-2 px-3 border border-slate-400 text-center">Total Marks</th>
                          <th className="py-2 px-3 border border-slate-400 text-center">Passing Marks</th>
                          <th className="py-2 px-3 border border-slate-400 text-center">Marks Obtained</th>
                          <th className="py-2 px-3 border border-slate-400 text-center">%</th>
                          <th className="py-2 px-3 border border-slate-400 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.subjectRows.map((row) => (
                          <tr key={row.subjectId}>
                            <td className="py-2 px-3 border border-slate-300 font-bold text-slate-900">{row.subjectName}</td>
                            <td className="py-2 px-3 border border-slate-300 text-center font-mono">{row.totalMarks}</td>
                            <td className="py-2 px-3 border border-slate-300 text-center font-mono text-slate-600">{row.passingMarks}</td>
                            <td className="py-2 px-3 border border-slate-300 text-center font-mono font-bold">
                              {row.isAbsent ? 'AB' : row.obtainedMarks !== null ? row.obtainedMarks : '—'}
                            </td>
                            <td className="py-2 px-3 border border-slate-300 text-center font-mono">
                              {row.isEntered ? `${row.percentage.toFixed(1)}%` : '—'}
                            </td>
                            <td className="py-2 px-3 border border-slate-300 text-center font-bold uppercase text-[10px]">
                              {row.status}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-slate-900 text-white font-bold">
                          <td className="py-2.5 px-3 border border-slate-900 uppercase">Grand Aggregate</td>
                          <td className="py-2.5 px-3 border border-slate-900 text-center font-mono">{result.totalMax}</td>
                          <td className="py-2.5 px-3 border border-slate-900 text-center">—</td>
                          <td className="py-2.5 px-3 border border-slate-900 text-center font-mono">
                            {result.hasEnteredAnyMarks ? result.totalObtained : '—'}
                          </td>
                          <td className="py-2.5 px-3 border border-slate-900 text-center font-mono">
                            {result.hasEnteredAnyMarks ? `${result.percentage.toFixed(2)}%` : '—'}
                          </td>
                          <td className="py-2.5 px-3 border border-slate-900 text-center uppercase">{result.resultStatus}</td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="grid grid-cols-3 gap-3 mt-4 text-center text-xs">
                      <div className="p-3 rounded-xl border border-slate-300 bg-slate-50">
                        <span className="text-[10px] font-bold uppercase text-slate-500 block">Percentage</span>
                        <strong className="text-base font-black">{result.hasEnteredAnyMarks ? `${result.percentage.toFixed(2)}%` : '—'}</strong>
                      </div>
                      <div className="p-3 rounded-xl border border-slate-300 bg-slate-50">
                        <span className="text-[10px] font-bold uppercase text-slate-500 block">Grade</span>
                        <strong className="text-base font-black text-indigo-800">{result.overallGrade}</strong>
                      </div>
                      <div className="p-3 rounded-xl border border-slate-300 bg-slate-50">
                        <span className="text-[10px] font-bold uppercase text-slate-500 block">Monthly Attendance</span>
                        <strong className="text-base font-black text-emerald-700">
                          {childAttendanceStats.monthTotal > 0 ? `${childAttendanceStats.monthPercentage}%` : '—'}
                        </strong>
                      </div>
                    </div>

                    <div className="mt-4 p-3.5 rounded-xl border border-slate-300 bg-slate-50 text-xs">
                      <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Teacher&apos;s Remarks</span>
                      <p className="italic font-medium text-slate-900">&ldquo;{remarks}&rdquo;</p>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="print:hidden shrink-0 flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setReportExamForPrint(null)}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer"
              >
                Close / Cancel
              </button>
              <button
                type="button"
                onClick={triggerPrintDocument}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print / Save as PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
