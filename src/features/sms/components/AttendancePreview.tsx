import React from 'react';
import { CalendarCheck2, ArrowLeft, Sparkles, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useSms } from '../context/SmsContext';

export const AttendancePreview: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { classes } = useSms();

  const SAMPLE_ROLL = [
    { roll: 1, gr: 'GR-1042', name: 'Muhammad Ali', status: 'present' },
    { roll: 2, gr: 'GR-1043', name: 'Syeda Fatima', status: 'present' },
    { roll: 3, gr: 'GR-1044', name: 'Bilal Ahmed', status: 'absent' },
    { roll: 4, gr: 'GR-1045', name: 'Zubair Khan', status: 'leave' },
    { roll: 5, gr: 'GR-1047', name: 'Hamza Tariq', status: 'present' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              Daily Attendance Register
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              Phase 3 Target
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 ml-7">
            Daily roll call, 1-click batch attendance, composite daily documents, and printable monthly register.
          </p>
        </div>
      </div>

      <div className="bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold">Daily Attendance Architecture (Phase 3 Architecture Preview)</div>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            In Phase 3, this screen will load the class roster and allow the teacher to take roll call in seconds using a single <strong>"Mark All Present"</strong> button, click to toggle <em>Absent</em> or <em>Leave</em>, and save the entire class ledger as a single composite document (<code className="font-mono text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded">YYYY-MM-DD_classId</code>) to minimize Firestore operations.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Sample Roll Call: Class 9 - Section A (Science) · Date: 2026-11-21
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="text-emerald-600">Present: 3</span>
            <span className="text-rose-600">Absent: 1</span>
            <span className="text-amber-600">Leave: 1</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Roll No.</th>
                <th className="py-3 px-4">GR Number</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Attendance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {SAMPLE_ROLL.map((r) => (
                <tr key={r.roll} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">#{r.roll}</td>
                  <td className="py-3 px-4 font-mono">{r.gr}</td>
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{r.name}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 ${
                        r.status === 'present'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : r.status === 'absent'
                          ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                          : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      }`}
                    >
                      {r.status === 'present' && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {r.status === 'absent' && <XCircle className="w-3.5 h-3.5" />}
                      {r.status === 'leave' && <Clock className="w-3.5 h-3.5" />}
                      <span className="capitalize">{r.status}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
