import React, { useMemo, useState, useEffect } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Plus,
  Edit2,
  Trash2,
  X,
  BookOpen,
  UserCheck,
  ShieldCheck,
  MapPin,
} from 'lucide-react';
import { useSms } from '../context/SmsContext';
import { TimetableDay, TimetableEntry } from '../types';

const DAYS_OF_WEEK: TimetableDay[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const DEFAULT_PERIOD_SLOTS: Record<number, string> = {
  1: '08:00 AM - 08:45 AM',
  2: '08:45 AM - 09:30 AM',
  3: '09:30 AM - 10:15 AM',
  4: '10:35 AM - 11:20 AM',
  5: '11:20 AM - 12:05 PM',
  6: '12:05 PM - 12:50 PM',
  7: '12:50 PM - 01:30 PM',
  8: '01:30 PM - 02:10 PM',
};

export const TimetableManager: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const {
    classes,
    filteredClassesForUser,
    teachers,
    timetableEntries,
    saveTimetableEntry,
    deleteTimetableEntry,
    canManageTimetable,
    activeSchool,
    activeTeacher,
    userRole,
  } = useSms();

  const availableClasses = userRole === 'teacher' ? filteredClassesForUser : classes;
  const [selectedClassId, setSelectedClassId] = useState<string>(availableClasses[0]?.id || '');
  const [activeMobileDay, setActiveMobileDay] = useState<TimetableDay>('Monday');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);

  const [formDay, setFormDay] = useState<TimetableDay>('Monday');
  const [formPeriod, setFormPeriod] = useState<number>(1);
  const [formTimeSlot, setFormTimeSlot] = useState<string>(DEFAULT_PERIOD_SLOTS[1]);
  const [formSubject, setFormSubject] = useState<string>('');
  const [formTeacherId, setFormTeacherId] = useState<string>('');
  const [formRoomNumber, setFormRoomNumber] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (availableClasses.length > 0 && (!selectedClassId || !availableClasses.some((c) => c.id === selectedClassId))) {
      setSelectedClassId(availableClasses[0].id);
    }
  }, [availableClasses, selectedClassId]);

  const selectedClass = useMemo(
    () => availableClasses.find((c) => c.id === selectedClassId) || classes.find((c) => c.id === selectedClassId) || null,
    [availableClasses, classes, selectedClassId]
  );

  const classEntries = useMemo(() => {
    return timetableEntries
      .filter((e) => e.classId === selectedClassId)
      .sort((a, b) => a.periodNumber - b.periodNumber);
  }, [timetableEntries, selectedClassId]);

  const maxPeriodNumber = useMemo(() => {
    const highest = classEntries.reduce((max, item) => Math.max(max, item.periodNumber), 6);
    return Math.min(Math.max(highest, 6), 10);
  }, [classEntries]);

  const periodNumbers = useMemo(
    () => Array.from({ length: maxPeriodNumber }, (_, idx) => idx + 1),
    [maxPeriodNumber]
  );

  const openAddOrEdit = (preset?: { day?: TimetableDay; period?: number; entry?: TimetableEntry | null }) => {
    if (!canManageTimetable) return;
    const entry = preset?.entry || null;
    const periodNo = entry?.periodNumber || preset?.period || 1;
    setEditingEntry(entry);
    setFormDay(entry?.day || preset?.day || activeMobileDay);
    setFormPeriod(periodNo);
    setFormTimeSlot(entry?.timeSlot || DEFAULT_PERIOD_SLOTS[periodNo] || '08:00 AM - 08:45 AM');
    setFormSubject(entry?.subject || '');
    setFormTeacherId(entry?.teacherId || teachers[0]?.id || '');
    setFormRoomNumber(entry?.roomNumber || selectedClass?.roomNumber || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass) {
      setFormError('Please select a class first.');
      return;
    }
    if (!formSubject.trim()) {
      setFormError('Subject name is required.');
      return;
    }
    if (!formTeacherId.trim()) {
      setFormError('Please assign a teacher for this period.');
      return;
    }

    const matchedTeacher = teachers.find((t) => t.id === formTeacherId);
    const teacherName = matchedTeacher?.name || activeSchool.primaryAdminName || 'Faculty Member';

    setIsSaving(true);
    setFormError(null);
    try {
      const cleanDay = formDay.toLowerCase();
      const deterministicId =
        editingEntry?.id || `tt_${selectedClass.id}_${cleanDay}_p${formPeriod}`;

      const ok = await saveTimetableEntry({
        id: deterministicId,
        classId: selectedClass.id,
        grade: selectedClass.grade,
        section: selectedClass.section,
        day: formDay,
        periodNumber: formPeriod,
        timeSlot: formTimeSlot.trim() || DEFAULT_PERIOD_SLOTS[formPeriod] || '',
        subject: formSubject.trim(),
        teacherId: formTeacherId,
        teacherName,
        roomNumber: formRoomNumber.trim() || undefined,
      });
      if (ok) {
        setIsModalOpen(false);
      } else {
        setFormError('Failed to save timetable period. Please retry.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const teacherLookupId = activeTeacher?.id || '';

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#FAF8F5] hover:bg-[#F3EFEA] dark:hover:bg-[#3F1014] rounded-xl transition cursor-pointer shrink-0"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                  Class Timetable &amp; Period Schedule
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FEF2F2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5] border border-[#FECACA] dark:border-[#7F1D1D]/60">
                  {canManageTimetable ? 'Admin Builder' : 'Read-Only Schedule'}
                </span>
              </div>
              <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-0.5">
                {activeSchool.name} · Weekly class periods, subjects &amp; teacher allocations
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="min-h-[44px] px-3.5 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs font-semibold text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden focus:ring-2 focus:ring-[#7F1D1D] cursor-pointer"
            >
              {availableClasses.length === 0 ? (
                <option value="">No Classes Available</option>
              ) : (
                availableClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.grade} - {cls.section}
                  </option>
                ))
              )}
            </select>

            {canManageTimetable && selectedClass && (
              <button
                type="button"
                onClick={() => openAddOrEdit()}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#7F1D1D] hover:bg-[#651414] text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Period Slot</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Day Pill Selector + Day Cards (Compact Phone UX) */}
      <div className="md:hidden bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#57534E] flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-[#7F1D1D]" />
            <span>Daily Mobile View ({selectedClass ? `${selectedClass.grade} - ${selectedClass.section}` : 'Select Class'})</span>
          </h2>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {DAYS_OF_WEEK.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setActiveMobileDay(day)}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                activeMobileDay === day
                  ? 'bg-[#7F1D1D] text-white shadow-xs'
                  : 'bg-[#F3EFEA] dark:bg-[#2C1215] text-[#57534E] dark:text-[#E7E0D4]'
              }`}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>

        <div className="space-y-2.5">
          {classEntries.filter((e) => e.day === activeMobileDay).length === 0 ? (
            <div className="text-center py-6 px-3 rounded-xl bg-[#FAF8F5] dark:bg-[#2C1215]/50 border border-dashed border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-xs text-[#78716C]">
              No periods scheduled for {activeMobileDay}.
              {canManageTimetable && selectedClass && (
                <button
                  type="button"
                  onClick={() => openAddOrEdit({ day: activeMobileDay, period: 1 })}
                  className="mt-2 block mx-auto text-[#7F1D1D] dark:text-[#FCA5A5] font-bold underline cursor-pointer"
                >
                  + Schedule First Period
                </button>
              )}
            </div>
          ) : (
            classEntries
              .filter((e) => e.day === activeMobileDay)
              .map((entry) => {
                const isMine = teacherLookupId && entry.teacherId === teacherLookupId;
                return (
                  <div
                    key={entry.id}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                      isMine
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                        : 'bg-[#FAF8F5] dark:bg-[#2C1215]/60 border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-[#FEE2E2] dark:bg-[#3F1014]/70 text-[#7F1D1D] dark:text-[#FCA5A5] text-[10px] font-bold">
                          Period {entry.periodNumber}
                        </span>
                        {entry.timeSlot && (
                          <span className="text-[11px] font-mono text-[#57534E] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {entry.timeSlot}
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5] truncate">
                        {entry.subject}
                      </div>
                      <div className="text-[11px] text-[#57534E] dark:text-[#D6CCC2] flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1">
                          <UserCheck className="w-3 h-3" />
                          {entry.teacherName}
                        </span>
                        {entry.roomNumber && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {entry.roomNumber}
                          </span>
                        )}
                      </div>
                    </div>

                    {canManageTimetable && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openAddOrEdit({ entry })}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-[#57534E] dark:text-[#E7E0D4] cursor-pointer"
                          title="Edit period"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTimetableEntry(entry.id)}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-600 cursor-pointer"
                          title="Delete period"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* Scrollable Weekly Timetable Grid (All Screens — Horizontally Scrollable on Mobile) */}
      <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#7F1D1D] dark:text-[#FCA5A5]" />
            <h2 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
              Weekly Master Grid ({selectedClass ? `${selectedClass.grade} - ${selectedClass.section}` : 'Class'})
            </h2>
          </div>
          <span className="text-[11px] text-[#78716C]">
            {classEntries.length} period{classEntries.length === 1 ? '' : 's'} assigned · Scroll horizontally →
          </span>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="min-w-[780px] w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF8F5] dark:bg-[#2C1215]/80 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-[11px] uppercase tracking-wider text-[#57534E] dark:text-[#D6CCC2]">
                <th className="py-3 px-4 font-bold sticky left-0 z-10 bg-[#FAF8F5] dark:bg-[#2C1215] border-r border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] w-32">
                  Day / Period
                </th>
                {periodNumbers.map((p) => (
                  <th key={p} className="py-3 px-3 font-bold min-w-[140px]">
                    <div>Period {p}</div>
                    <div className="text-[9px] font-mono font-normal text-[#78716C] mt-0.5">
                      {DEFAULT_PERIOD_SLOTS[p] || ''}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E0D4] dark:divide-[rgba(255,253,249,0.10)]">
              {DAYS_OF_WEEK.map((day) => (
                <tr key={day} className="hover:bg-[#FAF8F5]/50 dark:hover:bg-[#3F1014]/30">
                  <td className="py-3 px-4 font-bold text-[#1C1917] dark:text-[#FAF8F5] sticky left-0 z-10 bg-[#FFFDF9] dark:bg-[#211415] border-r border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
                    {day}
                  </td>
                  {periodNumbers.map((periodNo) => {
                    const cell = classEntries.find(
                      (e) => e.day === day && e.periodNumber === periodNo
                    );
                    const isMine = cell && teacherLookupId && cell.teacherId === teacherLookupId;

                    return (
                      <td key={periodNo} className="p-2 align-top">
                        {cell ? (
                          <div
                            className={`p-2.5 rounded-xl border space-y-1 transition ${
                              isMine
                                ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                                : 'bg-[#FEF2F2]/50 dark:bg-[#3F1014]/25 border-[#FECACA] dark:border-[#7F1D1D]/60'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <span className="font-bold text-[#1C1917] dark:text-[#FAF8F5] leading-tight">
                                {cell.subject}
                              </span>
                              {canManageTimetable && (
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => openAddOrEdit({ entry: cell })}
                                    className="p-1 text-[#78716C] hover:text-[#651414] cursor-pointer"
                                    title="Edit slot"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteTimetableEntry(cell.id)}
                                    className="p-1 text-[#78716C] hover:text-rose-600 cursor-pointer"
                                    title="Delete slot"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="text-[10px] text-[#57534E] dark:text-[#E7E0D4] truncate">
                              {cell.teacherName}
                            </div>
                            {(cell.timeSlot || cell.roomNumber) && (
                              <div className="text-[9px] text-[#78716C] font-mono truncate">
                                {cell.roomNumber ? `${cell.roomNumber} · ` : ''}
                                {cell.timeSlot}
                              </div>
                            )}
                          </div>
                        ) : canManageTimetable && selectedClass ? (
                          <button
                            type="button"
                            onClick={() => openAddOrEdit({ day, period: periodNo })}
                            className="w-full min-h-[54px] rounded-xl border border-dashed border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] hover:border-[#7F1D1D] hover:bg-[#FEE2E2] dark:hover:bg-[#58181D]/20 text-[10px] text-[#78716C] hover:text-[#651414] transition flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Assign</span>
                          </button>
                        ) : (
                          <div className="min-h-[44px] flex items-center justify-center text-[10px] text-[#E7E0D4] dark:text-[#44403C]">
                            —
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Period Modal (Admin Only) */}
      {isModalOpen && canManageTimetable && selectedClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#2C1215]/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 sm:p-6 max-w-md w-full max-h-[90dvh] overflow-y-auto shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#7F1D1D]" />
                <div>
                  <h3 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                    {editingEntry ? 'Edit Period Schedule' : 'Assign Class Period'}
                  </h3>
                  <p className="text-[11px] text-[#78716C]">
                    {selectedClass.grade} - {selectedClass.section}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#78716C] hover:text-[#1C1917] rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Day *
                  </label>
                  <select
                    value={formDay}
                    onChange={(e) => setFormDay(e.target.value as TimetableDay)}
                    className="w-full min-h-[44px] px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs font-semibold text-[#1C1917] dark:text-[#FAF8F5]"
                  >
                    {DAYS_OF_WEEK.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Period No *
                  </label>
                  <select
                    value={formPeriod}
                    onChange={(e) => {
                      const nextNo = Number(e.target.value);
                      setFormPeriod(nextNo);
                      if (DEFAULT_PERIOD_SLOTS[nextNo]) {
                        setFormTimeSlot(DEFAULT_PERIOD_SLOTS[nextNo]);
                      }
                    }}
                    className="w-full min-h-[44px] px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs font-semibold text-[#1C1917] dark:text-[#FAF8F5]"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <option key={num} value={num}>
                        Period {num}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                  Subject Name *
                </label>
                <input
                  type="text"
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  placeholder="e.g., Mathematics, English, Physics"
                  className="w-full min-h-[44px] px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5]"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                  Assigned Teacher *
                </label>
                <select
                  value={formTeacherId}
                  onChange={(e) => setFormTeacherId(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs font-semibold text-[#1C1917] dark:text-[#FAF8F5]"
                  required
                >
                  <option value="">-- Select Teacher --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Time Slot
                  </label>
                  <input
                    type="text"
                    value={formTimeSlot}
                    onChange={(e) => setFormTimeSlot(e.target.value)}
                    placeholder="08:00 AM - 08:45 AM"
                    className="w-full min-h-[44px] px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Room / Lab
                  </label>
                  <input
                    type="text"
                    value={formRoomNumber}
                    onChange={(e) => setFormRoomNumber(e.target.value)}
                    placeholder="Room 101"
                    className="w-full min-h-[44px] px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 bg-[#F3EFEA] dark:bg-[#2C1215] text-[#44403C] dark:text-[#E7E0D4] rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="min-h-[44px] px-5 py-2 bg-[#7F1D1D] hover:bg-[#651414] text-white rounded-xl font-semibold shadow-xs transition cursor-pointer disabled:opacity-60"
                >
                  {isSaving ? 'Saving...' : 'Save Period'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
