import React from 'react';
import { Users, Plus, Search, Filter, Download, ArrowLeft, Sparkles } from 'lucide-react';
import { useSms } from '../context/SmsContext';

export const StudentsPreview: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { classes, stats } = useSms();

  const SAMPLE_STUDENTS = [
    { gr: 'GR-1042', name: 'Muhammad Ali', father: 'Abdul Razzaq', class: 'Class 9-A', gender: 'Male', phone: '0300-1122334', status: 'active' },
    { gr: 'GR-1043', name: 'Syeda Fatima', father: 'Syed Munawwar Ali', class: 'Class 9-A', gender: 'Female', phone: '0312-9988776', status: 'active' },
    { gr: 'GR-1044', name: 'Bilal Ahmed', father: 'Muhammad Farooq', class: 'Class 9-B', gender: 'Male', phone: '0333-5566778', status: 'active' },
    { gr: 'GR-1045', name: 'Zubair Khan', father: 'Naseer Khan', class: 'Class 10-A', gender: 'Male', phone: '0345-1239876', status: 'active' },
    { gr: 'GR-1046', name: 'Dua Tariq', father: 'Tariq Mehmood', class: 'Class 5 (Sindhi)', gender: 'Female', phone: '0301-4455667', status: 'active' },
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
              Student Register &amp; Information System (SIS)
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
              Phase 2 Target
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 ml-7">
            General Register (GR) indexing, NADRA B-Form integration, and student profile records.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-semibold rounded-xl cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            <span>Admit Student (Phase 2)</span>
          </button>
        </div>
      </div>

      <div className="bg-sky-50/80 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-2xl p-4 text-xs text-sky-900 dark:text-sky-200 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold">Student Information System (Phase 2 Architecture Preview)</div>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            In Phase 2, this module will enable school administrators to register new students with GR Numbers, B-Form verification, guardian emergency contacts, and class-wise roll allocation. Below is the preliminary data structure preview.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Enrolled Students Preview ({SAMPLE_STUDENTS.length} sample records of {stats.totalStudents} total)
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">GR Number</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Father Name</th>
                <th className="py-3 px-4">Class &amp; Section</th>
                <th className="py-3 px-4">Gender</th>
                <th className="py-3 px-4">Guardian Contact</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {SAMPLE_STUDENTS.map((s) => (
                <tr key={s.gr} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-mono font-semibold text-indigo-600 dark:text-indigo-400">{s.gr}</td>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{s.name}</td>
                  <td className="py-3 px-4">{s.father}</td>
                  <td className="py-3 px-4 font-medium">{s.class}</td>
                  <td className="py-3 px-4">{s.gender}</td>
                  <td className="py-3 px-4 font-mono">{s.phone}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      Active
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
