import React, { useMemo, useState, useEffect } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Plus,
  Search,
  Trash2,
  X,
  CheckCircle2,
  Clock,
  UserCheck,
} from 'lucide-react';
import { useSms } from '../context/SmsContext';

export const HomeworkManager: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const {
    classes,
    filteredClassesForUser,
    homeworkItems,
    saveHomework,
    deleteHomework,
    canPostHomework,
    userRole,
    currentUserProfile,
    activeTeacher,
    activeSchool,
  } = useSms();

  const isAdmin = userRole === 'admin' || userRole === 'principal' || userRole === 'super-admin';
  const selectableClasses = isAdmin ? classes : filteredClassesForUser;

  const [filterClassId, setFilterClassId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const defaultDueDate = () => {
    const dt = new Date();
    dt.setDate(dt.getDate() + 2);
    return dt.toISOString().split('T')[0];
  };

  const [formClassId, setFormClassId] = useState<string>(selectableClasses[0]?.id || '');
  const [formSubject, setFormSubject] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDueDate, setFormDueDate] = useState(defaultDueDate);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (selectableClasses.length > 0 && (!formClassId || !selectableClasses.some((c) => c.id === formClassId))) {
      setFormClassId(selectableClasses[0].id);
    }
  }, [selectableClasses, formClassId]);

  const visibleHomework = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const allowedClassSet = new Set(selectableClasses.map((c) => c.id));
    return homeworkItems
      .filter((hw) => {
        if (!isAdmin && allowedClassSet.size > 0 && !allowedClassSet.has(hw.classId)) {
          return false;
        }
        if (filterClassId !== 'all' && hw.classId !== filterClassId) {
          return false;
        }
        if (!q) return true;
        return (
          hw.subject.toLowerCase().includes(q) ||
          (hw.title || '').toLowerCase().includes(q) ||
          hw.description.toLowerCase().includes(q) ||
          hw.teacherName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [homeworkItems, selectableClasses, isAdmin, filterClassId, searchQuery]);

  const handleOpenPostModal = () => {
    setFormClassId(
      filterClassId !== 'all' && selectableClasses.some((c) => c.id === filterClassId)
        ? filterClassId
        : selectableClasses[0]?.id || ''
    );
    setFormSubject('');
    setFormTitle('');
    setFormDescription('');
    setFormDueDate(defaultDueDate());
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetCls = selectableClasses.find((c) => c.id === formClassId);
    if (!targetCls) {
      setFormError('Please select a class section.');
      return;
    }
    if (!formSubject.trim()) {
      setFormError('Subject is required.');
      return;
    }
    if (!formDescription.trim()) {
      setFormError('Homework description is required.');
      return;
    }
    if (!formDueDate) {
      setFormError('Due date is required.');
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      const id = `hw_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
      const ok = await saveHomework({
        id,
        classId: targetCls.id,
        grade: targetCls.grade,
        section: targetCls.section,
        subject: formSubject.trim(),
        title: formTitle.trim() || undefined,
        description: formDescription.trim(),
        assignedDate: new Date().toISOString().split('T')[0],
        dueDate: formDueDate,
        teacherId: currentUserProfile?.uid || activeTeacher?.id || 'teacher',
        teacherName: currentUserProfile?.fullName || activeTeacher?.name || 'Class Teacher',
        status: 'active',
      });
      if (ok) {
        setIsModalOpen(false);
      } else {
        setFormError('Failed to post homework. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const todayIso = new Date().toISOString().split('T')[0];

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
                  Daily Homework &amp; Class Diary
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Phase D
                </span>
              </div>
              <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-0.5">
                {activeSchool.name} · Post class homework assignments and submission due dates
              </p>
            </div>
          </div>

          {canPostHomework && (
            <button
              type="button"
              onClick={handleOpenPostModal}
              disabled={selectableClasses.length === 0}
              className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#7F1D1D] hover:bg-[#651414] text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Assign Homework</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters Bar (Mobile-First Touch Controls) */}
      <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#78716C] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search subject, topic, or teacher..."
            className="w-full min-h-[44px] pl-10 pr-3.5 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden focus:ring-2 focus:ring-[#7F1D1D]"
          />
        </div>

        <select
          value={filterClassId}
          onChange={(e) => setFilterClassId(e.target.value)}
          className="w-full min-h-[44px] px-3.5 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs font-semibold text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden focus:ring-2 focus:ring-[#7F1D1D] cursor-pointer"
        >
          <option value="all">All Accessible Classes ({selectableClasses.length})</option>
          {selectableClasses.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.grade} - {cls.section}
            </option>
          ))}
        </select>
      </div>

      {/* Homework Feed Cards */}
      {visibleHomework.length === 0 ? (
        <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-dashed border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-10 text-center space-y-2">
          <BookOpen className="w-10 h-10 text-[#FED7AA] mx-auto opacity-60" />
          <h3 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
            No Homework Posted Yet
          </h3>
          <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] max-w-md mx-auto">
            {canPostHomework
              ? 'Tap "Assign Homework" to publish an assignment with subject details and due date for students and parents.'
              : 'No homework entries match your class filter right now.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleHomework.map((hw) => {
            const isOverdue = hw.dueDate < todayIso;
            const isAuthor =
              isAdmin ||
              hw.teacherId === currentUserProfile?.uid ||
              hw.teacherId === activeTeacher?.id;

            return (
              <div
                key={hw.id}
                className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between gap-3 hover:border-[#7F1D1D] dark:hover:border-[#C2410C] transition"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2.5 py-0.5 rounded-lg bg-[#FEF2F2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5] border border-[#FECACA] dark:border-[#7F1D1D]/60 text-[11px] font-bold">
                        {hw.subject}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-[#F3EFEA] dark:bg-[#2C1215] text-[#44403C] dark:text-[#E7E0D4] text-[11px] font-semibold">
                        {hw.grade} - {hw.section || 'General'}
                      </span>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        isOverdue
                          ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                          : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      }`}
                    >
                      {isOverdue ? <Clock className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                      <span>Due: {hw.dueDate}</span>
                    </span>
                  </div>

                  {hw.title && (
                    <h3 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                      {hw.title}
                    </h3>
                  )}

                  <p className="text-xs text-[#57534E] dark:text-[#E7E0D4] leading-relaxed whitespace-pre-line">
                    {hw.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] flex items-center justify-between gap-2 text-[11px] text-[#57534E]">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-[#7F1D1D]" />
                      {hw.teacherName}
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-[#78716C]" />
                      Assigned: {hw.assignedDate}
                    </span>
                  </div>

                  {isAuthor && canPostHomework && (
                    <button
                      type="button"
                      onClick={() => deleteHomework(hw.id)}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                      title="Delete homework"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assign Homework Modal */}
      {isModalOpen && canPostHomework && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#2C1215]/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 sm:p-6 max-w-lg w-full max-h-[90dvh] overflow-y-auto shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#7F1D1D]" />
                <div>
                  <h3 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                    Post Class Homework
                  </h3>
                  <p className="text-[11px] text-[#78716C]">
                    Visible immediately to students &amp; parents in class diary
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

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Class &amp; Section *
                  </label>
                  <select
                    value={formClassId}
                    onChange={(e) => setFormClassId(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs font-semibold text-[#1C1917] dark:text-[#FAF8F5]"
                    required
                  >
                    {selectableClasses.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.grade} - {cls.section}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Subject *
                  </label>
                  <input
                    type="text"
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    placeholder="e.g., Mathematics, English, Sindhi"
                    className="w-full min-h-[44px] px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Assignment Title (Optional)
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g., Unit 3 Practice Questions"
                    className="w-full min-h-[44px] px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                  Homework Description &amp; Instructions *
                </label>
                <textarea
                  rows={4}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Write clear instructions, page numbers, or questions for students..."
                  className="w-full px-3 py-2.5 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5]"
                  required
                />
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
                  {isSaving ? 'Posting...' : 'Publish Homework'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
