import React, { useState } from 'react';
import {
  Award,
  BookOpen,
  CalendarCheck2,
  CalendarDays,
  Clock,
  Download,
  GraduationCap,
  Loader2,
  Printer,
  Receipt,
  X,
} from 'lucide-react';
import {
  Exam,
  HomeworkItem,
  School,
  Student,
  StudentExamMarks,
  TimetableDay,
  TimetableEntry,
} from '../types';
import {
  StudentAttendanceSummary,
  TIMETABLE_DAY_ORDER,
} from '../utils/portalCalculations';
import { calculateStudentFeeLedger } from '../utils/feeCalculations';
import { computeStudentExamResult } from '../utils/examCalculations';
import { exportA4ElementAsPdf } from '../../../utils/mobilePdfExport';

export const AttendanceLogSection: React.FC<{
  attendanceStats: StudentAttendanceSummary;
  selectedAttendanceMonth: string;
  onMonthChange: (month: string) => void;
}> = ({ attendanceStats, selectedAttendanceMonth, onMonthChange }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
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
        onChange={(e) => onMonthChange(e.target.value)}
        className="min-h-[40px] px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
      />
    </div>

    {attendanceStats.recentRows.length === 0 ? (
      <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
        No attendance logs recorded yet for this month.
      </div>
    ) : (
      <div className="overflow-x-auto max-h-64">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 uppercase text-[10px]">
            <tr>
              <th className="py-2.5 px-3">Date</th>
              <th className="py-2.5 px-3">Attendance Status</th>
              <th className="py-2.5 px-3">Teacher Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {attendanceStats.recentRows.map((r) => (
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
);

export const TimetableAndHomeworkSection: React.FC<{
  timetableEntries: TimetableEntry[];
  homeworkItems: HomeworkItem[];
  classLabel: string;
}> = ({ timetableEntries, homeworkItems, classLabel }) => {
  const [selectedDay, setSelectedDay] = useState<'All' | TimetableDay>('All');
  const displayedTimetable =
    selectedDay === 'All'
      ? timetableEntries
      : timetableEntries.filter((t) => t.day === selectedDay);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Class Timetable (Read-Only)
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-slate-400">
            {displayedTimetable.length} periods
          </span>
        </div>

        {timetableEntries.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {(['All', ...TIMETABLE_DAY_ORDER] as Array<'All' | TimetableDay>).map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                  selectedDay === day
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {day === 'All' ? 'Full Week' : day.slice(0, 3)}
              </button>
            ))}
          </div>
        )}

        {displayedTimetable.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            Timetable schedule has not been published for this selection yet.
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
                {displayedTimetable.map((slot) => (
                  <tr key={slot.id}>
                    <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                      {slot.day}
                    </td>
                    <td className="py-2 px-3 font-mono text-indigo-600 dark:text-indigo-400">
                      P{slot.periodNumber}
                      {slot.timeSlot ? (
                        <span className="block text-[9px] text-slate-400 font-sans">
                          {slot.timeSlot}
                        </span>
                      ) : null}
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
            {homeworkItems.length} assigned
          </span>
        </div>

        {homeworkItems.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            No active homework assigned for {classLabel}.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {homeworkItems.map((hw) => (
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
                {hw.teacherName && (
                  <div className="text-[10px] text-slate-400">
                    Assigned by: {hw.teacherName}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const FeeStatusSection: React.FC<{
  feeLedger: ReturnType<typeof calculateStudentFeeLedger>;
}> = ({ feeLedger }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Receipt className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Fee Status &amp; Payment Receipts (Read-Only)
        </h2>
      </div>
      {feeLedger.activeConcession.concessionTitle && (
        <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-bold">
          Approved Concession: {feeLedger.activeConcession.concessionTitle}
        </span>
      )}
    </div>

    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
        <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Due</span>
        <strong className="text-base font-mono text-slate-900 dark:text-white">
          Rs. {feeLedger.totalDue.toLocaleString()}
        </strong>
      </div>
      <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
        <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 block">Total Paid</span>
        <strong className="text-base font-mono text-emerald-700 dark:text-emerald-300">
          Rs. {feeLedger.totalPaid.toLocaleString()}
        </strong>
      </div>
      <div className="p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60">
        <span className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-400 block">Pending Balance</span>
        <strong className="text-base font-mono text-rose-700 dark:text-rose-300">
          Rs. {feeLedger.pendingBalance.toLocaleString()}
        </strong>
      </div>
      <div className="p-3.5 rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60">
        <span className="text-[10px] font-bold uppercase text-sky-700 dark:text-sky-400 block">Advance Credit</span>
        <strong className="text-base font-mono text-sky-700 dark:text-sky-300">
          Rs. {feeLedger.advanceBalance.toLocaleString()}
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
          {feeLedger.rows.map((row) => (
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
);

export const PublishedExamsSection: React.FC<{
  publishedExams: Exam[];
  examMarks: StudentExamMarks[];
  studentId: string;
  onSelectExamForPrint: (exam: Exam) => void;
}> = ({ publishedExams, examMarks, studentId, onSelectExamForPrint }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
    <div className="flex items-center gap-2">
      <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
      <h2 className="text-base font-bold text-slate-900 dark:text-white">
        Published Exam Results &amp; Report Cards (PDF)
      </h2>
    </div>

    {publishedExams.length === 0 ? (
      <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
        No published examination results available yet.
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {publishedExams.map((ex) => {
          const record = examMarks.find(
            (m) => m.examId === ex.id && m.studentId === studentId
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
                onClick={() => onSelectExamForPrint(ex)}
                className="w-full min-h-[42px] py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition cursor-pointer"
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
);

export const ReportCardPrintModal: React.FC<{
  exam: Exam;
  student: Student;
  activeSchool: School;
  examMarks: StudentExamMarks[];
  attendanceStats: StudentAttendanceSummary;
  onClose: () => void;
  onPrint: () => void;
}> = ({ exam, student, activeSchool, examMarks, attendanceStats, onClose, onPrint }) => {
  const [savingReportPdf, setSavingReportPdf] = useState(false);
  const reportCardSheetRef = React.useRef<HTMLDivElement | null>(null);

  const record = examMarks.find(
    (m) => m.examId === exam.id && m.studentId === student.id
  );
  const result = computeStudentExamResult(
    exam,
    record?.subjectMarks || {},
    record?.absentSubjects || []
  );
  const remarks =
    record?.remarks ||
    result.suggestedRemark ||
    'Consistent attendance and steady effort encouraged.';

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-6 print:static print:bg-transparent print:p-0 print:block"
      onClick={onClose}
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
              Official Report Card — {student.fullName} ({exam.title})
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                if (!reportCardSheetRef.current) return;
                setSavingReportPdf(true);
                try {
                  await exportA4ElementAsPdf(
                    reportCardSheetRef.current,
                    `Report-Card-${student.grNumber}-${exam.title.replace(/\s+/g, '-')}.pdf`
                  );
                } catch {
                  onPrint();
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
              onClick={onPrint}
              className="min-h-[40px] px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save as PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Close</span>
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-4 sm:p-6 print:overflow-visible print:p-0">
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
                  {exam.title}
                </div>
                <div className="text-[11px] text-slate-500">
                  Session: {exam.academicYear}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Student Name</span>
                <strong className="text-slate-900">{student.fullName}</strong>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Father&apos;s Name</span>
                <strong className="text-slate-900">{student.fatherName}</strong>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500 block">GR Number</span>
                <strong className="font-mono text-slate-900">{student.grNumber}</strong>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Class &amp; Section</span>
                <strong className="text-slate-900">{student.grade} - {student.section}</strong>
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
                  {attendanceStats.monthTotal > 0 ? `${attendanceStats.monthPercentage}%` : '—'}
                </strong>
              </div>
            </div>

            <div className="mt-4 p-3.5 rounded-xl border border-slate-300 bg-slate-50 text-xs">
              <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Teacher&apos;s Remarks</span>
              <p className="italic font-medium text-slate-900">&ldquo;{remarks}&rdquo;</p>
            </div>
          </div>
        </div>

        <div className="print:hidden shrink-0 flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer"
          >
            Close / Cancel
          </button>
          <button
            type="button"
            onClick={onPrint}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save as PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};
