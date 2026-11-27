import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Link2,
  Loader2,
  Lock,
  Paperclip,
  Printer,
  Sparkles,
  Trash2,
  Unlink,
  X,
} from 'lucide-react';
import { auth } from '../../../firebase';
import { useSms } from '../context/SmsContext';
import {
  Exam,
  SchoolQuestionPaper,
  SchoolQuestionPaperDifficulty,
  SchoolQuestionPaperLanguage,
} from '../types';
import {
  GeneratedQuestionPaper,
  validateQuestionPaperRequest,
} from '../../../utils/questionPaperLogic';
import { parseJsonResponseText } from '../../../utils/apiResponse';
import { triggerPrintDocument } from '../../../utils/printDocument';
import { exportA4ElementAsPdf } from '../../../utils/mobilePdfExport';
import {
  buildSmartSyllabusContextFromLessonPlans,
  buildSmsOfflineFallbackQuestionPaper,
} from '../utils/aiIntegrationHelpers';

interface ExamQuestionPapersSectionProps {
  exams: Exam[];
  initialExamId?: string;
  onPaperPreviewModalChange?: (isOpen: boolean) => void;
}

export const ExamQuestionPapersSection: React.FC<ExamQuestionPapersSectionProps> = ({
  exams,
  initialExamId,
  onPaperPreviewModalChange,
}) => {
  const {
    activeSchool,
    classes,
    filteredClassesForUser,
    currentUserProfile,
    canManageExams,
    canAccessSchoolAiContent,
    filteredLessonPlansForUser,
    filteredQuestionPapersForUser,
    saveSchoolQuestionPaper,
    attachQuestionPaperToExam,
    deleteSchoolQuestionPaper,
    isSuperAdmin,
    isReadOnlyImpersonation,
  } = useSms();

  if (isSuperAdmin || isReadOnlyImpersonation || !canAccessSchoolAiContent) {
    return (
      <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-rose-200 dark:border-rose-800 rounded-2xl p-8 text-center space-y-2">
        <Lock className="w-8 h-8 text-rose-500 mx-auto" />
        <h3 className="text-base font-bold text-[#1C1917] dark:text-[#FAF8F5]">
          Access Restricted
        </h3>
        <p className="text-xs text-[#57534E] dark:text-[#D6CCC2]">
          School-level AI Question Papers are isolated from Super Admin &amp; read-only sessions.
        </p>
      </div>
    );
  }

  const selectableClasses = useMemo(
    () => (canManageExams ? classes : filteredClassesForUser),
    [canManageExams, classes, filteredClassesForUser]
  );

  const [selectedExamId, setSelectedExamId] = useState<string>(
    initialExamId || exams[0]?.id || ''
  );
  const [selectedClassId, setSelectedClassId] = useState<string>(
    selectableClasses[0]?.id || ''
  );
  const [subject, setSubject] = useState<string>(
    exams[0]?.subjects?.[0]?.name || 'Science'
  );
  const [difficulty, setDifficulty] = useState<SchoolQuestionPaperDifficulty>('Medium');
  const [totalMarks, setTotalMarks] = useState<number>(
    exams[0]?.subjects?.[0]?.totalMarks || 50
  );
  const [timeAllowed, setTimeAllowed] = useState<string>('2 Hours');
  const [language, setLanguage] = useState<SchoolQuestionPaperLanguage>('English');
  const [manualSyllabusNotes, setManualSyllabusNotes] = useState<string>('');
  const [selectedLessonPlanIds, setSelectedLessonPlanIds] = useState<string[]>([]);
  const [attachToSelectedExam, setAttachToSelectedExam] = useState<boolean>(true);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Saved Papers Filter & Printable A4 Modal
  const [filterExamId, setFilterExamId] = useState<string>('all');
  const [previewPaper, setPreviewPaper] = useState<SchoolQuestionPaper | null>(null);
  const [showAnswerKey, setShowAnswerKey] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const a4SheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialExamId && exams.some((e) => e.id === initialExamId)) {
      setSelectedExamId(initialExamId);
    }
  }, [initialExamId, exams]);

  useEffect(() => {
    onPaperPreviewModalChange?.(Boolean(previewPaper));
  }, [previewPaper, onPaperPreviewModalChange]);

  useEffect(() => {
    if (selectableClasses.length === 0) {
      setSelectedClassId('');
      return;
    }
    if (!selectableClasses.some((c) => c.id === selectedClassId)) {
      setSelectedClassId(selectableClasses[0].id);
    }
  }, [selectableClasses, selectedClassId]);

  const selectedExamObj = useMemo(
    () => exams.find((e) => e.id === selectedExamId) || null,
    [exams, selectedExamId]
  );

  const selectedClassObj = useMemo(
    () => selectableClasses.find((c) => c.id === selectedClassId) || null,
    [selectableClasses, selectedClassId]
  );

  // Exam subjects suggestion list + auto-update subject/marks when switching exam
  const examSubjectOptions = useMemo(
    () => selectedExamObj?.subjects || [],
    [selectedExamObj]
  );

  const handleExamSelectionChange = (examId: string) => {
    setSelectedExamId(examId);
    const ex = exams.find((e) => e.id === examId);
    if (ex?.subjects?.length) {
      setSubject(ex.subjects[0].name);
      setTotalMarks(
        Math.max(10, Math.min(200, Number(ex.subjects[0].totalMarks) || 50))
      );
    }
  };

  // Smart Lesson Plans available for selected Class (matching Subject prioritized first)
  const matchingLessonPlans = useMemo(() => {
    if (!selectedClassId) return [];
    const normSubj = subject.trim().toLowerCase();
    return [...filteredLessonPlansForUser]
      .filter((lp) => lp.classId === selectedClassId)
      .sort((a, b) => {
        const aMatch = normSubj && a.subject.toLowerCase().includes(normSubj) ? 0 : 1;
        const bMatch = normSubj && b.subject.toLowerCase().includes(normSubj) ? 0 : 1;
        return aMatch - bMatch;
      });
  }, [filteredLessonPlansForUser, selectedClassId, subject]);

  const checkedLessonPlans = useMemo(
    () => matchingLessonPlans.filter((lp) => selectedLessonPlanIds.includes(lp.id)),
    [matchingLessonPlans, selectedLessonPlanIds]
  );

  const combinedSyllabusPreview = useMemo(
    () =>
      buildSmartSyllabusContextFromLessonPlans({
        plans: checkedLessonPlans,
        manualNotes: manualSyllabusNotes,
      }),
    [checkedLessonPlans, manualSyllabusNotes]
  );

  const toggleLessonPlanContext = (planId: string) => {
    setSelectedLessonPlanIds((prev) =>
      prev.includes(planId) ? prev.filter((id) => id !== planId) : [...prev, planId]
    );
  };

  const handleSelectAllClassLessonPlans = () => {
    if (matchingLessonPlans.length === 0) return;
    if (selectedLessonPlanIds.length === matchingLessonPlans.length) {
      setSelectedLessonPlanIds([]);
    } else {
      setSelectedLessonPlanIds(matchingLessonPlans.map((lp) => lp.id));
    }
  };

  const handleGenerateQuestionPaper = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!selectedClassObj) {
      setFeedback({
        type: 'error',
        text: canManageExams
          ? 'Please select a valid Class for the question paper.'
          : 'You can only generate papers for classes assigned to your account.',
      });
      return;
    }

    const effectiveSyllabus =
      combinedSyllabusPreview ||
      `${selectedClassObj.grade} ${subject.trim()} — Core Curriculum Chapters & Concepts`;

    const classLabel = `${selectedClassObj.grade}${
      selectedClassObj.section ? ` (${selectedClassObj.section})` : ''
    }`;

    const validation = validateQuestionPaperRequest({
      className: classLabel,
      subject: subject.trim(),
      difficulty,
      totalMarks,
      timeAllowed,
      language,
      syllabusCovered: effectiveSyllabus,
    });

    if (!validation.valid || !validation.sanitized) {
      setFeedback({
        type: 'error',
        text: validation.error || 'Please verify question paper inputs.',
      });
      return;
    }

    setIsGenerating(true);
    try {
      let generatedPaper: GeneratedQuestionPaper | null = null;
      let generationSource: 'gemini-ai' | 'offline-template' = 'offline-template';

      try {
        const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : '';
        const response = await fetch('/api/generate-question-paper', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          },
          body: JSON.stringify(validation.sanitized),
        });

        const rawText = await response.text();
        const parsed = parseJsonResponseText<{
          paper?: GeneratedQuestionPaper;
          error?: string;
        }>(rawText, response.status, response.headers.get('content-type'));

        if (response.ok && parsed.ok && parsed.data?.paper) {
          generatedPaper = parsed.data.paper;
          generationSource = 'gemini-ai';
        }
      } catch {
        // Fallback to offline template cleanly below
      }

      if (!generatedPaper) {
        generatedPaper = buildSmsOfflineFallbackQuestionPaper(validation.sanitized);
        generationSource = 'offline-template';
      }

      const paperId = `qp_${selectedClassObj.id}_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 6)}`;

      const isAttached = Boolean(attachToSelectedExam && selectedExamObj);
      const record: Omit<SchoolQuestionPaper, 'schoolId'> = {
        id: paperId,
        examId: selectedExamObj?.id || undefined,
        examTitle: selectedExamObj?.title || undefined,
        attachedToExam: isAttached,
        attachedAt: isAttached ? new Date().toISOString() : undefined,
        classId: selectedClassObj.id,
        className: classLabel,
        grade: selectedClassObj.grade,
        section: selectedClassObj.section,
        subject: validation.sanitized.subject,
        difficulty: validation.sanitized.difficulty,
        totalMarks: generatedPaper.totalMarks || validation.sanitized.totalMarks,
        timeAllowed: validation.sanitized.timeAllowed,
        language: validation.sanitized.language,
        syllabusCovered: validation.sanitized.syllabusCovered,
        linkedLessonPlanIds: checkedLessonPlans.map((lp) => lp.id),
        linkedLessonPlanTopics: checkedLessonPlans.map((lp) => lp.topic),
        generationSource,
        paper: generatedPaper,
        createdByUid: currentUserProfile?.uid || auth.currentUser?.uid || 'teacher',
        createdByName: currentUserProfile?.fullName || 'Faculty Member',
      };

      const saved = await saveSchoolQuestionPaper(record);
      if (saved) {
        const fullSavedRecord: SchoolQuestionPaper = {
          ...record,
          schoolId: activeSchool.id,
        };
        setPreviewPaper(fullSavedRecord);
        setFeedback({
          type: 'success',
          text: `Generated ${record.subject} Question Paper (${record.totalMarks} Marks · ${record.difficulty}) via ${
            generationSource === 'gemini-ai' ? 'Gemini AI' : 'Offline Curriculum Template'
          }${
            checkedLessonPlans.length > 0
              ? ` using ${checkedLessonPlans.length} linked lesson plan(s)`
              : ''
          }${isAttached && selectedExamObj ? ` and attached to "${selectedExamObj.title}"` : ''}.`,
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const displayedPapers = useMemo(() => {
    if (filterExamId === 'all') return filteredQuestionPapersForUser;
    if (filterExamId === 'unattached') {
      return filteredQuestionPapersForUser.filter((qp) => !qp.attachedToExam);
    }
    return filteredQuestionPapersForUser.filter((qp) => qp.examId === filterExamId);
  }, [filteredQuestionPapersForUser, filterExamId]);

  const handleDownloadPaperPdf = async () => {
    if (!a4SheetRef.current || !previewPaper) return;
    setIsExportingPdf(true);
    try {
      const safeSubj = previewPaper.subject.replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeCls = previewPaper.grade.replace(/[^a-zA-Z0-9_-]/g, '_');
      await exportA4ElementAsPdf(
        a4SheetRef.current,
        `QuestionPaper_${safeCls}_${safeSubj}_${previewPaper.totalMarks}M.pdf`
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Main Form + List Card (hidden on print when A4 modal is open) */}
      <div className={previewPaper ? 'no-print space-y-5' : 'space-y-5'}>
        {/* Feedback */}
        {feedback && (
          <div
            className={`px-4 py-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 border ${
              feedback.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="p-0.5 hover:opacity-75 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* AI Question Paper Generator Card */}
        <form
          onSubmit={handleGenerateQuestionPaper}
          className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5] flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                  Generate Question Paper with AI
                </h2>
                <p className="text-xs text-[#57534E] dark:text-[#D6CCC2]">
                  Select exam, {canManageExams ? 'class' : 'assigned class'}, subject &amp; difficulty, and optionally pull taught Lesson Plans for context-aware questions.
                </p>
              </div>
            </div>
            {!canManageExams && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <Lock className="w-3 h-3" />
                Assigned Classes Scope
              </span>
            )}
          </div>

          {selectableClasses.length === 0 ? (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
              No classes are assigned to your account. Only School Admins or Teachers assigned to a class can generate exam question papers.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Exam */}
                <div>
                  <label className="block text-[11px] font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    1. Reference Exam
                  </label>
                  <select
                    value={selectedExamId}
                    onChange={(e) => handleExamSelectionChange(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 text-xs font-semibold rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5]"
                  >
                    <option value="">-- Standalone / Assessment Paper --</option>
                    {exams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.title} ({ex.academicYear})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Class */}
                <div>
                  <label className="block text-[11px] font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    2. {canManageExams ? 'Class / Section' : 'Assigned Class'} *
                  </label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => {
                      setSelectedClassId(e.target.value);
                      setSelectedLessonPlanIds([]);
                    }}
                    className="w-full min-h-[42px] px-3 py-2 text-xs font-semibold rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5]"
                    required
                  >
                    {selectableClasses.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.grade} - {cls.section}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-[11px] font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    3. Subject *
                  </label>
                  <input
                    type="text"
                    list="sms-qp-subject-list"
                    value={subject}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSubject(val);
                      const matchedSubj = examSubjectOptions.find(
                        (s) => s.name.toLowerCase() === val.trim().toLowerCase()
                      );
                      if (matchedSubj) {
                        setTotalMarks(
                          Math.max(10, Math.min(200, Number(matchedSubj.totalMarks) || 50))
                        );
                      }
                    }}
                    placeholder="e.g., Physics, English, Science"
                    className="w-full min-h-[42px] px-3 py-2 text-xs font-semibold rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5]"
                    required
                  />
                  <datalist id="sms-qp-subject-list">
                    {examSubjectOptions.map((s) => (
                      <option key={s.id} value={s.name} />
                    ))}
                  </datalist>
                </div>

                {/* Difficulty */}
                <div>
                  <label className="block text-[11px] font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    4. Difficulty Level
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) =>
                      setDifficulty(e.target.value as SchoolQuestionPaperDifficulty)
                    }
                    className="w-full min-h-[42px] px-3 py-2 text-xs font-semibold rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5]"
                  >
                    <option value="Easy">Easy (Recall &amp; Core)</option>
                    <option value="Medium">Medium (Balanced BISE/STBB)</option>
                    <option value="Hard">Hard (HOTS &amp; Analytical)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Total Marks (10–200)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={200}
                    value={totalMarks}
                    onChange={(e) =>
                      setTotalMarks(Math.max(10, Math.min(200, Number(e.target.value) || 50)))
                    }
                    className="w-full min-h-[42px] px-3 py-2 text-xs font-mono font-bold rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Time Allowed
                  </label>
                  <input
                    type="text"
                    value={timeAllowed}
                    onChange={(e) => setTimeAllowed(e.target.value)}
                    placeholder="e.g., 2 Hours 30 Minutes"
                    className="w-full min-h-[42px] px-3 py-2 text-xs font-semibold rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Paper Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) =>
                      setLanguage(e.target.value as SchoolQuestionPaperLanguage)
                    }
                    className="w-full min-h-[42px] px-3 py-2 text-xs font-semibold rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5]"
                  >
                    <option value="English">English</option>
                    <option value="Urdu">Urdu (اردو)</option>
                    <option value="Sindhi">Sindhi (سنڌي)</option>
                  </select>
                </div>
              </div>

              {/* Smart Linking: Pull Context From Class Generated Lesson Plans */}
              <div className="p-4 rounded-2xl bg-[#FAF8F5] dark:bg-[#2C1215]/70 border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#00563B] dark:text-emerald-300">
                    <BookOpen className="w-4 h-4 shrink-0" />
                    <span>
                      Smart Lesson Plan Context ({matchingLessonPlans.length} saved for{' '}
                      {selectedClassObj?.grade || 'Class'})
                    </span>
                  </div>
                  {matchingLessonPlans.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectAllClassLessonPlans}
                      className="text-[11px] font-bold text-[#7F1D1D] dark:text-[#FCA5A5] hover:underline cursor-pointer"
                    >
                      {selectedLessonPlanIds.length === matchingLessonPlans.length
                        ? 'Clear Selection'
                        : 'Select All Plans'}
                    </button>
                  )}
                </div>

                {matchingLessonPlans.length === 0 ? (
                  <p className="text-[11px] text-[#78716C]">
                    No generated lesson plans saved for {selectedClassObj?.grade || 'this class'} yet. You can enter syllabus topics manually below, or generate class lesson plans first from Teacher Dashboard.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {matchingLessonPlans.map((lp) => {
                      const active = selectedLessonPlanIds.includes(lp.id);
                      return (
                        <button
                          key={lp.id}
                          type="button"
                          onClick={() => toggleLessonPlanContext(lp.id)}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition cursor-pointer ${
                            active
                              ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                              : 'bg-[#FFFDF9] dark:bg-[#211415] text-[#44403C] dark:text-[#E7E0D4] border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] hover:border-emerald-400'
                          }`}
                        >
                          {active ? '✓ ' : '+ '}
                          {lp.subject}: {lp.topic}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Manual Syllabus Notes / Auto Context Preview */}
              <div>
                <label className="block text-[11px] font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                  Syllabus Covered &amp; Additional Focus Notes
                </label>
                <textarea
                  rows={2}
                  value={manualSyllabusNotes}
                  onChange={(e) => setManualSyllabusNotes(e.target.value)}
                  placeholder="Optional chapters/topics (or select taught Lesson Plans above to auto-build context-aware questions)..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5]"
                />
                {checkedLessonPlans.length > 0 && (
                  <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                    Injecting {checkedLessonPlans.length} lesson plan(s) (chapters, SLOs &amp; key vocabulary) into AI Question Generation.
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                {selectedExamObj ? (
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#44403C] dark:text-[#E7E0D4] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={attachToSelectedExam}
                      onChange={(e) => setAttachToSelectedExam(e.target.checked)}
                      className="rounded border-[#D6CCC2] text-[#7F1D1D] focus:ring-[#7F1D1D]"
                    />
                    <span>
                      Attach generated paper to &ldquo;{selectedExamObj.title}&rdquo; as reference
                    </span>
                  </label>
                ) : (
                  <span className="text-[11px] text-[#78716C]">
                    Saved directly to School Question Bank (`schools/{activeSchool.id}/questionPapers`).
                  </span>
                )}

                <button
                  type="submit"
                  disabled={isGenerating}
                  className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#7F1D1D] hover:bg-[#651414] text-white text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-60"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating {language} Paper...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Question Paper with AI</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </form>

        {/* Saved & Attached Question Papers List */}
        <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
              Saved &amp; Attached Question Papers ({displayedPapers.length})
            </h3>
            <select
              value={filterExamId}
              onChange={(e) => setFilterExamId(e.target.value)}
              className="min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5]"
            >
              <option value="all">All Papers ({filteredQuestionPapersForUser.length})</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  Exam: {ex.title}
                </option>
              ))}
              <option value="unattached">Unattached Drafts</option>
            </select>
          </div>

          {displayedPapers.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#78716C] border border-dashed border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl">
              No question papers saved yet for this filter. Use the AI generator above to build and print your paper.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {displayedPapers.map((qp) => {
                const targetExamForAttach = qp.examId || selectedExamId || exams[0]?.id;
                return (
                  <div
                    key={qp.id}
                    className="p-4 rounded-2xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5]/75 dark:bg-[#2C1215]/60 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF2F2] dark:bg-[#3F1014]/70 text-[#7F1D1D] dark:text-[#FCA5A5]">
                            {qp.className}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF7ED] dark:bg-[#7C2D12]/60 text-[#C2410C] dark:text-[#FDBA74]">
                            {qp.subject} · {qp.totalMarks} Marks
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F3EFEA] dark:bg-[#211415] text-[#57534E] dark:text-[#D6CCC2]">
                            {qp.difficulty} · {qp.language}
                          </span>
                        </div>
                        {qp.attachedToExam && qp.examTitle ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <Paperclip className="w-3 h-3" />
                            <span>Attached: {qp.examTitle}</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F3EFEA] text-[#57534E] dark:bg-[#211415] dark:text-[#D6CCC2]">
                            Not Attached
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                        {qp.paper?.paperTitle || `${qp.grade} ${qp.subject}`}
                      </h4>
                      <div className="text-[11px] text-[#57534E] dark:text-[#D6CCC2]">
                        {qp.linkedLessonPlanIds?.length
                          ? `Smart Context: ${qp.linkedLessonPlanIds.length} Lesson Plan(s) · `
                          : ''}
                        By {qp.createdByName} · {qp.timeAllowed}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E7E0D4] dark:border-[rgba(255,253,249,0.12)]">
                      {targetExamForAttach ? (
                        <button
                          type="button"
                          onClick={() =>
                            void attachQuestionPaperToExam(
                              qp.id,
                              targetExamForAttach,
                              !qp.attachedToExam
                            )
                          }
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                            qp.attachedToExam
                              ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          }`}
                        >
                          {qp.attachedToExam ? (
                            <>
                              <Unlink className="w-3.5 h-3.5" />
                              <span>Detach from Exam</span>
                            </>
                          ) : (
                            <>
                              <Link2 className="w-3.5 h-3.5" />
                              <span>Attach to Exam</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-[10px] text-[#78716C]">No exams created</span>
                      )}

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAnswerKey(false);
                            setPreviewPaper(qp);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2C1215] hover:bg-[#58181D] text-white text-[11px] font-bold transition cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print Question Paper</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Delete question paper "${qp.subject} (${qp.className})"?`)) {
                              void deleteSchoolQuestionPaper(qp.id);
                            }
                          }}
                          title="Delete Question Paper"
                          className="p-1.5 text-[#78716C] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* A4 Printable Question Paper Preview & PDF Export Modal */}
      {previewPaper && (
        <div
          className="fixed inset-0 z-[9999] overflow-y-auto bg-black/75 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center print:static print:bg-transparent print:p-0 print:block"
          onClick={() => setPreviewPaper(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Printable Question Paper"
        >
          <div
            className="w-full max-w-4xl max-h-[92dvh] bg-[#FFFDF9] text-[#1C1917] rounded-2xl shadow-2xl flex flex-col overflow-hidden print:max-w-none print:max-h-none print:shadow-none print:rounded-none print:overflow-visible print:block"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Action Bar */}
            <div className="no-print shrink-0 flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-b border-[#E7E0D4] bg-[#FFFDF9]">
              <button
                type="button"
                onClick={() => setShowAnswerKey((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F3EFEA] hover:bg-[#E7E0D4] text-[#44403C] text-xs font-semibold cursor-pointer"
              >
                {showAnswerKey ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Hide Answer Key</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>Show MCQ Key (Teacher Copy)</span>
                  </>
                )}
              </button>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleDownloadPaperPdf}
                  disabled={isExportingPdf}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#C2410C] hover:bg-[#9A3412] text-white text-xs font-bold transition cursor-pointer disabled:opacity-60"
                >
                  {isExportingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={triggerPrintDocument}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#7F1D1D] hover:bg-[#651414] text-white text-xs font-bold transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Question Paper</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewPaper(null)}
                  className="p-2 rounded-xl bg-[#F3EFEA] hover:bg-[#E7E0D4] text-[#44403C] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable A4 Printable Paper */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#F3EFEA]/60 print:p-0 print:bg-white">
              <div
                ref={a4SheetRef}
                dir={previewPaper.language === 'Urdu' || previewPaper.language === 'Sindhi' ? 'rtl' : 'ltr'}
                className="printable-a4-sheet bg-white border border-[#E7E0D4] rounded-xl p-6 sm:p-8 text-[#1C1917] space-y-5 shadow-xs"
              >
                {/* School Header */}
                <div className="border-b-2 border-[#1C1917] pb-4">
                  <div className="flex items-center justify-center gap-4 text-center">
                    {activeSchool.logoUrl && (
                      <img
                        src={activeSchool.logoUrl}
                        alt="School Logo"
                        className="w-16 h-16 object-contain shrink-0"
                      />
                    )}
                    <div>
                      <h1 className="text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-[#1C1917]">
                        {activeSchool.name || 'School Examination'}
                      </h1>
                      {(activeSchool.district || activeSchool.taluka) && (
                        <p className="text-xs text-[#57534E] mt-0.5">
                          {[activeSchool.taluka, activeSchool.district, activeSchool.semisCode ? `SEMIS: ${activeSchool.semisCode}` : '']
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                      <p className="text-sm font-bold text-[#7F1D1D] mt-1">
                        {previewPaper.paper.paperTitle}
                      </p>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 border-t border-b border-[#D6CCC2] py-2 text-xs font-semibold">
                    <div>
                      <span className="text-[#57534E]">Class:</span> {previewPaper.className}
                    </div>
                    <div>
                      <span className="text-[#57534E]">Subject:</span> {previewPaper.subject}
                    </div>
                    <div>
                      <span className="text-[#57534E]">Time:</span> {previewPaper.timeAllowed}
                    </div>
                    <div className="sm:text-end font-mono">
                      <span className="text-[#57534E]">Total Marks:</span>{' '}
                      {previewPaper.paper.totalMarks}
                    </div>
                  </div>

                  <div className="mt-2.5 grid grid-cols-2 gap-4 text-xs text-[#44403C]">
                    <div className="flex items-end gap-2">
                      <span className="font-semibold shrink-0">Student Name:</span>
                      <div className="flex-1 border-b border-dotted border-slate-500 h-4" />
                    </div>
                    <div className="flex items-end gap-2">
                      <span className="font-semibold shrink-0">Roll No / GR#:</span>
                      <div className="flex-1 border-b border-dotted border-slate-500 h-4" />
                    </div>
                  </div>

                  {previewPaper.paper.instructions && (
                    <p className="mt-2.5 text-[11px] italic text-[#57534E] bg-[#FAF8F5] px-3 py-1.5 rounded border border-[#E7E0D4]">
                      <strong>Instructions:</strong> {previewPaper.paper.instructions}
                    </p>
                  )}
                </div>

                {/* Section A */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between border-b border-[#D6CCC2] pb-1">
                    <h2 className="text-sm font-extrabold uppercase tracking-wide">
                      {previewPaper.paper.sectionATitle}
                    </h2>
                    <span className="text-xs font-mono font-bold">
                      ({previewPaper.paper.mcqs.length} × 1 = {previewPaper.paper.sectionAMarks} Marks)
                    </span>
                  </div>
                  <div className="space-y-3 text-xs sm:text-sm">
                    {previewPaper.paper.mcqs.map((mcq, idx) => (
                      <div key={idx} className="space-y-1.5 break-inside-avoid">
                        <p className="font-semibold">
                          Q{idx + 1}. {mcq.question}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 ps-4 text-xs text-[#44403C]">
                          {mcq.options.map((opt, optIdx) => (
                            <div key={optIdx} className="flex items-start gap-1.5">
                              <span className="font-bold">({String.fromCharCode(97 + optIdx)})</span>
                              <span>{opt}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Section B */}
                <section className="space-y-3 pt-2">
                  <div className="flex items-center justify-between border-b border-[#D6CCC2] pb-1">
                    <div>
                      <h2 className="text-sm font-extrabold uppercase tracking-wide">
                        {previewPaper.paper.sectionBTitle}
                      </h2>
                      <p className="text-[11px] text-[#57534E]">{previewPaper.paper.sectionBNote}</p>
                    </div>
                    <span className="text-xs font-mono font-bold shrink-0">
                      ({previewPaper.paper.sectionBMarks} Marks)
                    </span>
                  </div>
                  <ol className="space-y-2 text-xs sm:text-sm ps-5 list-decimal">
                    {previewPaper.paper.shortQuestions.map((q, idx) => (
                      <li key={idx} className="leading-relaxed break-inside-avoid">
                        <div className="flex items-baseline justify-between gap-3">
                          <span>{q.question}</span>
                          <span className="text-[11px] font-mono text-[#57534E] shrink-0">
                            [{q.marks} Marks]
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>

                {/* Section C */}
                <section className="space-y-3 pt-2">
                  <div className="flex items-center justify-between border-b border-[#D6CCC2] pb-1">
                    <div>
                      <h2 className="text-sm font-extrabold uppercase tracking-wide">
                        {previewPaper.paper.sectionCTitle}
                      </h2>
                      <p className="text-[11px] text-[#57534E]">{previewPaper.paper.sectionCNote}</p>
                    </div>
                    <span className="text-xs font-mono font-bold shrink-0">
                      ({previewPaper.paper.sectionCMarks} Marks)
                    </span>
                  </div>
                  <ol className="space-y-2.5 text-xs sm:text-sm ps-5 list-decimal">
                    {previewPaper.paper.longQuestions.map((q, idx) => (
                      <li key={idx} className="leading-relaxed break-inside-avoid">
                        <div className="flex items-baseline justify-between gap-3">
                          <span>{q.question}</span>
                          <span className="text-[11px] font-mono text-[#57534E] shrink-0">
                            [{q.marks} Marks]
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>

                {/* Answer Key */}
                {showAnswerKey && (
                  <section className="mt-6 pt-4 border-t-2 border-dashed border-[#C2B7A8] break-inside-avoid">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#7F1D1D] mb-2">
                      Teacher Answer Key — Section A (MCQs)
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                      {previewPaper.paper.mcqs.map((mcq, idx) => (
                        <div
                          key={idx}
                          className="bg-[#FAF8F5] border border-[#E7E0D4] rounded px-2.5 py-1.5"
                        >
                          <span className="font-bold">Q{idx + 1}:</span>{' '}
                          <span className="text-emerald-700 font-semibold">{mcq.correctAnswer}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
