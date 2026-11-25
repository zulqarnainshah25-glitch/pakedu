import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarCheck2,
  Calendar,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ArrowLeft,
  Printer,
  Sparkles,
  ShieldCheck,
  UserCheck,
  Save,
  Check,
  X,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { useSms } from '../context/SmsContext';
import { DailyClassAttendance, AttendanceRecord, Student } from '../types';

interface DailyAttendanceRegisterProps {
  onBack: () => void;
  initialClassId?: string;
}

export const DailyAttendanceRegister: React.FC<DailyAttendanceRegisterProps> = ({
  onBack,
  initialClassId,
}) => {
  const {
    userRole,
    classes,
    filteredClassesForUser,
    students,
    activeTeacher,
    activeSchool,
    attendanceRegisters,
    saveAttendance,
    getAttendance,
  } = useSms();

  const isAdmin = userRole === 'admin' || userRole === 'principal';

  // Date state: defaults to today's YYYY-MM-DD
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Selected class state
  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    if (initialClassId && filteredClassesForUser.some((c) => c.id === initialClassId)) {
      return initialClassId;
    }
    return filteredClassesForUser[0]?.id || classes[0]?.id || '';
  });

  // Keep selectedClassId valid when user role / classes change
  useEffect(() => {
    if (!filteredClassesForUser.some((c) => c.id === selectedClassId)) {
      if (filteredClassesForUser.length > 0) {
        setSelectedClassId(filteredClassesForUser[0].id);
      }
    }
  }, [filteredClassesForUser, selectedClassId]);

  // Active class object
  const currentClass = useMemo(() => {
    return classes.find((c) => c.id === selectedClassId) || classes[0];
  }, [classes, selectedClassId]);

  // Students belonging to the current selected class (only active students)
  const classStudents = useMemo(() => {
    return students
      .filter((s) => s.classId === selectedClassId && s.status === 'active')
      .sort((a, b) => a.grNumber.localeCompare(b.grNumber, undefined, { numeric: true }));
  }, [students, selectedClassId]);

  // In-memory working attendance records for the selected date & class: studentId -> AttendanceRecord
  const [attendanceState, setAttendanceState] = useState<Record<string, AttendanceRecord>>({});
  const [notesState, setNotesState] = useState<Record<string, string>>({});
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Composite register ID: YYYY-MM-DD_classId
  const registerId = `${selectedDate}_${selectedClassId}`;
  const savedRegister = attendanceRegisters[registerId];

  // Load existing records or default all to 'present' when date or class changes
  useEffect(() => {
    if (savedRegister && savedRegister.records) {
      // Load saved register
      const initialMap: Record<string, AttendanceRecord> = {};
      const noteMap: Record<string, string> = {};

      classStudents.forEach((st) => {
        if (savedRegister.records[st.id]) {
          initialMap[st.id] = { ...savedRegister.records[st.id] };
          if (savedRegister.records[st.id].note) {
            noteMap[st.id] = savedRegister.records[st.id].note!;
          }
        } else {
          // New student admitted after attendance was saved
          initialMap[st.id] = { status: 'present' };
        }
      });
      setAttendanceState(initialMap);
      setNotesState(noteMap);
      setHasUnsavedChanges(false);
    } else {
      // Default all to 'present' for convenient quick roll call
      const defaultMap: Record<string, AttendanceRecord> = {};
      classStudents.forEach((st) => {
        defaultMap[st.id] = { status: 'present' };
      });
      setAttendanceState(defaultMap);
      setNotesState({});
      setHasUnsavedChanges(false);
    }
  }, [selectedDate, selectedClassId, savedRegister, classStudents]);

  // Toggle or set a specific student's status
  const handleSetStatus = (studentId: string, status: 'present' | 'absent' | 'leave' | 'late') => {
    setAttendanceState((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
      },
    }));
    setHasUnsavedChanges(true);
  };

  // Update note for a student
  const handleNoteChange = (studentId: string, note: string) => {
    setNotesState((prev) => ({
      ...prev,
      [studentId]: note,
    }));
    setAttendanceState((prev) => {
      const cleanedNote = note.trim();
      const nextRec: AttendanceRecord = {
        status: prev[studentId]?.status || 'present',
        ...(cleanedNote ? { note: cleanedNote } : {}),
      };
      return {
        ...prev,
        [studentId]: nextRec,
      };
    });
    setHasUnsavedChanges(true);
  };

  // Quick Action: Mark All Present
  const handleMarkAllPresent = () => {
    const updated: Record<string, AttendanceRecord> = {};
    classStudents.forEach((st) => {
      const cleanedNote = notesState[st.id]?.trim();
      updated[st.id] = {
        status: 'present',
        ...(cleanedNote ? { note: cleanedNote } : {}),
      };
    });
    setAttendanceState(updated);
    setHasUnsavedChanges(true);
  };

  // Quick Action: Mark All Absent
  const handleMarkAllAbsent = () => {
    const updated: Record<string, AttendanceRecord> = {};
    classStudents.forEach((st) => {
      const cleanedNote = notesState[st.id]?.trim();
      updated[st.id] = {
        status: 'absent',
        ...(cleanedNote ? { note: cleanedNote } : {}),
      };
    });
    setAttendanceState(updated);
    setHasUnsavedChanges(true);
  };

  // Reset to last saved
  const handleResetToSaved = () => {
    if (savedRegister) {
      setAttendanceState(savedRegister.records);
      setHasUnsavedChanges(false);
    } else {
      handleMarkAllPresent();
      setHasUnsavedChanges(false);
    }
  };

  // Live Summary Calculation
  const summary = useMemo(() => {
    const total = classStudents.length;
    let present = 0;
    let absent = 0;
    let leave = 0;
    let late = 0;

    classStudents.forEach((st) => {
      const rec = attendanceState[st.id];
      const status = rec ? rec.status : 'present';
      if (status === 'present') present++;
      else if (status === 'absent') absent++;
      else if (status === 'leave') leave++;
      else if (status === 'late') late++;
    });

    const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    return {
      total,
      present,
      absent,
      leave,
      late,
      percentage,
    };
  }, [classStudents, attendanceState]);

  // Save the attendance register
  const handleSaveAttendance = () => {
    if (!currentClass) return;

    const recordsWithNotes: Record<string, AttendanceRecord> = {};
    classStudents.forEach((st) => {
      const current = attendanceState[st.id] || { status: 'present' };
      const cleanedNote = notesState[st.id]?.trim() || current.note?.trim();
      recordsWithNotes[st.id] = {
        status: current.status,
        ...(cleanedNote ? { note: cleanedNote } : {}),
      };
    });

    const attendanceDoc: DailyClassAttendance = {
      id: registerId,
      date: selectedDate,
      classId: selectedClassId,
      grade: currentClass.grade,
      section: currentClass.section,
      markedByUid: (isAdmin ? 'admin_uid' : activeTeacher.id) || 'system',
      markedByName: (isAdmin ? 'School Administrator' : activeTeacher.name) || 'Faculty',
      markedAt: new Date().toISOString(),
      records: recordsWithNotes,
      summary,
    };

    saveAttendance(attendanceDoc);
    setHasUnsavedChanges(false);
    setSaveToast(
      `Attendance for ${currentClass.grade} - ${currentClass.section} on ${selectedDate} saved successfully.`
    );
    setTimeout(() => setSaveToast(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Navigation */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              title="Return to SMS Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  Daily Attendance Register (حاضری رجسٹر)
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Phase 3 Live
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {activeSchool.name} · Session {activeSchool.activeAcademicYear}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
              title="Print Today's Attendance Sheet"
            >
              <Printer className="w-4 h-4" />
              <span>Print Sheet</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAttendance}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer ${
                hasUnsavedChanges
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{hasUnsavedChanges ? 'Save Changes *' : 'Save Register'}</span>
            </button>
          </div>
        </div>

        {/* Role & Incharge Notice */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
          {isAdmin ? (
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 px-3.5 py-2 rounded-xl">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  <strong>Admin Mode:</strong> You can select and mark attendance for <em>any class</em> in the institution.
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Composite Key: <code className="text-indigo-600 dark:text-indigo-400 font-bold">{registerId}</code>
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 px-3.5 py-2 rounded-xl">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  Marking roll call as <strong>{activeTeacher.name}</strong> (Assigned Class Teacher).
                </span>
              </div>
              <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                {filteredClassesForUser.length} Classes Assigned
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Save Success Toast */}
      {saveToast && (
        <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 px-4 py-3 rounded-2xl flex items-center justify-between text-xs shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-medium">{saveToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveToast(null)}
            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Date & Class Selector Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Date Picker */}
          <div className="md:col-span-4">
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Attendance Date (تاریخ حاضری)
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Class Selector */}
          <div className="md:col-span-5">
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Class &amp; Section (کلاس اور سیکشن)
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {filteredClassesForUser.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.grade} - {c.section} ({c.medium} Medium) · Incharge: {c.classTeacherName}
                </option>
              ))}
            </select>
          </div>

          {/* Status Indicator */}
          <div className="md:col-span-3 flex flex-col justify-end">
            <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Ledger Document Status
            </div>
            {savedRegister ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">Saved ({savedRegister.summary.percentage}% Present)</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs font-semibold text-amber-800 dark:text-amber-200">
                <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Not marked for this date</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Batch Actions Toolbar */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleMarkAllPresent}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Mark All Present (سب حاضر)</span>
            </button>

            <button
              type="button"
              onClick={handleMarkAllAbsent}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Mark All Absent</span>
            </button>

            {savedRegister && hasUnsavedChanges && (
              <button
                type="button"
                onClick={handleResetToSaved}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Saved</span>
              </button>
            )}
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {classStudents.length} Students on Roll
            {currentClass && ` · Room: ${currentClass.roomNumber || 'Assigned'}`}
          </div>
        </div>
      </div>

      {/* Live Summary KPI Bar & Progress */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Total Students</span>
            <span className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
              {summary.total}
            </span>
            <span className="text-[10px] text-slate-400 block">Class Enrollment</span>
          </div>

          <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/60 dark:border-emerald-800/60">
            <span className="text-[11px] text-emerald-700 dark:text-emerald-400 block font-medium">Present (P)</span>
            <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
              {summary.present}
            </span>
            <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 block">
              {summary.total > 0 ? `${Math.round((summary.present / summary.total) * 100)}%` : '0%'}
            </span>
          </div>

          <div className="p-3 bg-rose-50/70 dark:bg-rose-950/30 rounded-xl border border-rose-200/60 dark:border-rose-800/60">
            <span className="text-[11px] text-rose-700 dark:text-rose-400 block font-medium">Absent (A)</span>
            <span className="text-xl font-bold text-rose-700 dark:text-rose-300 tabular-nums">
              {summary.absent}
            </span>
            <span className="text-[10px] text-rose-600/80 dark:text-rose-400/80 block">
              {summary.total > 0 ? `${Math.round((summary.absent / summary.total) * 100)}%` : '0%'}
            </span>
          </div>

          <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200/60 dark:border-amber-800/60">
            <span className="text-[11px] text-amber-700 dark:text-amber-400 block font-medium">Leave (L)</span>
            <span className="text-xl font-bold text-amber-700 dark:text-amber-300 tabular-nums">
              {summary.leave}
            </span>
            <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 block">Approved Leaves</span>
          </div>

          <div className="p-3 bg-sky-50/70 dark:bg-sky-950/30 rounded-xl border border-sky-200/60 dark:border-sky-800/60">
            <span className="text-[11px] text-sky-700 dark:text-sky-400 block font-medium">Late (LT)</span>
            <span className="text-xl font-bold text-sky-700 dark:text-sky-300 tabular-nums">
              {summary.late}
            </span>
            <span className="text-[10px] text-sky-600/80 dark:text-sky-400/80 block">Late Arrivals</span>
          </div>
        </div>

        {/* Visual Multi-Segment Progress Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Today's Class Attendance Rate
            </span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {summary.percentage}%
            </span>
          </div>
          <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
            {summary.total > 0 && (
              <>
                <div
                  style={{ width: `${(summary.present / summary.total) * 100}%` }}
                  className="bg-emerald-500 h-full transition-all duration-300"
                  title={`Present: ${summary.present}`}
                />
                <div
                  style={{ width: `${(summary.late / summary.total) * 100}%` }}
                  className="bg-sky-500 h-full transition-all duration-300"
                  title={`Late: ${summary.late}`}
                />
                <div
                  style={{ width: `${(summary.leave / summary.total) * 100}%` }}
                  className="bg-amber-400 h-full transition-all duration-300"
                  title={`Leave: ${summary.leave}`}
                />
                <div
                  style={{ width: `${(summary.absent / summary.total) * 100}%` }}
                  className="bg-rose-500 h-full transition-all duration-300"
                  title={`Absent: ${summary.absent}`}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Roster Roll Call Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Student Roll Call List: {currentClass ? `${currentClass.grade} - ${currentClass.section}` : ''}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Click <strong>P</strong> (Present), <strong>A</strong> (Absent), <strong>L</strong> (Leave), or <strong>LT</strong> (Late)
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">GR No.</th>
                <th className="py-3 px-4">Student Name &amp; Father</th>
                <th className="py-3 px-4 text-center">Status (حاضری کی کیفیت)</th>
                <th className="py-3 px-4">Remarks / Leave Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {classStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      No active students found in this class
                    </p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      Admit students to this class in the Student Information System (SIS) to record their attendance.
                    </p>
                  </td>
                </tr>
              ) : (
                classStudents.map((st, index) => {
                  const currentRec = attendanceState[st.id] || { status: 'present' };
                  const currentStatus = currentRec.status;
                  const currentNote = notesState[st.id] || currentRec.note || '';

                  return (
                    <tr
                      key={st.id}
                      className={`transition-colors ${
                        currentStatus === 'absent'
                          ? 'bg-rose-50/40 dark:bg-rose-950/20'
                          : currentStatus === 'leave'
                          ? 'bg-amber-50/40 dark:bg-amber-950/20'
                          : currentStatus === 'late'
                          ? 'bg-sky-50/40 dark:bg-sky-950/20'
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Roll Number */}
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-400">
                        {index + 1}
                      </td>

                      {/* GR Number */}
                      <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                        {st.grNumber}
                      </td>

                      {/* Student Name & Father Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${
                              st.gender === 'Female'
                                ? 'bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300'
                                : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                            }`}
                          >
                            {st.fullName.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {st.fullName}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              S/D/O {st.fatherName}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 4-State Status Button Pill */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1 border border-slate-200 dark:border-slate-700">
                          {/* Present (P) */}
                          <button
                            type="button"
                            onClick={() => handleSetStatus(st.id, 'present')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                              currentStatus === 'present'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-white dark:hover:bg-slate-700'
                            }`}
                            title="Present (حاضر)"
                          >
                            P
                          </button>

                          {/* Absent (A) */}
                          <button
                            type="button"
                            onClick={() => handleSetStatus(st.id, 'absent')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                              currentStatus === 'absent'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white dark:hover:bg-slate-700'
                            }`}
                            title="Absent (غیر حاضر)"
                          >
                            A
                          </button>

                          {/* Leave (L) */}
                          <button
                            type="button"
                            onClick={() => handleSetStatus(st.id, 'leave')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                              currentStatus === 'leave'
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-white dark:hover:bg-slate-700'
                            }`}
                            title="Leave (رخصت)"
                          >
                            L
                          </button>

                          {/* Late (LT) */}
                          <button
                            type="button"
                            onClick={() => handleSetStatus(st.id, 'late')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                              currentStatus === 'late'
                                ? 'bg-sky-500 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-white dark:hover:bg-slate-700'
                            }`}
                            title="Late (تاخیر)"
                          >
                            LT
                          </button>
                        </div>
                      </td>

                      {/* Remarks / Reason */}
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={currentNote}
                          onChange={(e) => handleNoteChange(st.id, e.target.value)}
                          placeholder={
                            currentStatus === 'leave'
                              ? 'e.g. Medical leave, brother wedding...'
                              : currentStatus === 'absent'
                              ? 'e.g. Uninformed absence...'
                              : currentStatus === 'late'
                              ? 'e.g. Arrived 15 mins late (traffic)...'
                              : 'Optional remark...'
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Save Bar */}
        {classStudents.length > 0 && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {savedRegister ? (
                <span>
                  Last saved at{' '}
                  <strong className="text-slate-700 dark:text-slate-200">
                    {new Date(savedRegister.markedAt).toLocaleTimeString()}
                  </strong>{' '}
                  by {savedRegister.markedByName}
                </span>
              ) : (
                <span>Unsaved ledger. Click save to record today's register.</span>
              )}
            </div>

            <button
              type="button"
              onClick={handleSaveAttendance}
              className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-bold rounded-xl shadow-xs transition cursor-pointer ${
                hasUnsavedChanges
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{hasUnsavedChanges ? 'Confirm & Save Register *' : 'Save Register'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
