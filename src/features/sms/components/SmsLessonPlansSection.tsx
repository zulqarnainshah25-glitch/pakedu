import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Database,
  Download,
  Eye,
  EyeOff,
  Loader2,
  Printer,
  Share2,
  Sparkles,
  Trash2,
  X,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { auth } from '../../../firebase';
import { useSms } from '../context/SmsContext';
import { SchoolLessonPlan, SchoolLessonSyllabusSource } from '../types';
import {
  LessonPlanContent,
  SUBJECT_OPTIONS,
  SyllabusPreset,
  inferSectionFromClass,
} from '../../../data/syllabusPresets';
import { loadGoogleSheetSyllabusData } from '../../../data/googleSheetLoader';
import { fetchPublicSyllabusForClassFromFirestore } from '../services/smsFirestoreService';
import {
  buildSmsOfflineFallbackLessonPlan,
  extractSyllabusStructureForClass,
  normalizeSmsGradeToSyllabusClassName,
} from '../utils/aiIntegrationHelpers';
import { triggerPrintDocument } from '../../../utils/printDocument';
import { exportA4ElementAsPdf } from '../../../utils/mobilePdfExport';

interface SmsLessonPlansSectionProps {
  isAdmin: boolean;
}

export const SmsLessonPlansSection: React.FC<SmsLessonPlansSectionProps> = ({ isAdmin }) => {
  const {
    activeSchool,
    classes,
    filteredClassesForUser,
    activeTeacher,
    currentUserProfile,
    filteredLessonPlansForUser,
    canAccessSchoolAiContent,
    saveSchoolLessonPlan,
    toggleShareLessonPlanWithParents,
    deleteSchoolLessonPlan,
    isSuperAdmin,
    isReadOnlyImpersonation,
  } = useSms();

  if (isSuperAdmin || isReadOnlyImpersonation || !canAccessSchoolAiContent) {
    return null;
  }

  const selectableClasses = isAdmin ? classes : filteredClassesForUser;

  const [tsvSyllabus, setTsvSyllabus] = useState<SyllabusPreset[]>([]);
  const [firestoreSyllabusByClass, setFirestoreSyllabusByClass] = useState<
    Record<string, SyllabusPreset[]>
  >({});
  const fetchedClassKeysRef = useRef<Set<string>>(new Set());
  const [isLoadingSyllabus, setIsLoadingSyllabus] = useState(false);

  const [selectedClassId, setSelectedClassId] = useState<string>(
    selectableClasses[0]?.id || ''
  );
  const [board, setBoard] = useState<'Sindh STBB' | 'Punjab PTB'>(
    activeSchool.board === 'Punjab PTB' ? 'Punjab PTB' : 'Sindh STBB'
  );
  const [subject, setSubject] = useState<string>('Science');
  const [chapter, setChapter] = useState<string>('');
  const [topic, setTopic] = useState<string>('');
  const [duration, setDuration] = useState<string>('40 Minutes');
  const [planType, setPlanType] = useState<'Daily' | 'Weekly'>('Daily');
  const [shareWithParentsOnSave, setShareWithParentsOnSave] = useState<boolean>(true);
  const [preferFreshAi, setPreferFreshAi] = useState<boolean>(false);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // List Filters & Preview Modal
  const [filterClassId, setFilterClassId] = useState<string>('all');
  const [filterShareStatus, setFilterShareStatus] = useState<'all' | 'shared' | 'private'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [previewPlan, setPreviewPlan] = useState<SchoolLessonPlan | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const previewA4Ref = useRef<HTMLDivElement>(null);

  // Keep selectedClassId valid as classes change
  useEffect(() => {
    if (selectableClasses.length === 0) {
      setSelectedClassId('');
      return;
    }
    if (!selectableClasses.some((c) => c.id === selectedClassId)) {
      setSelectedClassId(selectableClasses[0].id);
    }
  }, [selectableClasses, selectedClassId]);

  useEffect(() => {
    setBoard(activeSchool.board === 'Punjab PTB' ? 'Punjab PTB' : 'Sindh STBB');
  }, [activeSchool.board]);

  // Load Google Sheet TSV curriculum database once
  useEffect(() => {
    let active = true;
    loadGoogleSheetSyllabusData()
      .then((items) => {
        if (active && Array.isArray(items)) setTsvSyllabus(items);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const selectedClassObj = useMemo(
    () => selectableClasses.find((c) => c.id === selectedClassId) || null,
    [selectableClasses, selectedClassId]
  );

  const canonicalClassName = useMemo(
    () => normalizeSmsGradeToSyllabusClassName(selectedClassObj?.grade || 'Class 5'),
    [selectedClassObj?.grade]
  );

  // Smart Linking: Auto-fetch Firestore `syllabus_data` when class changes
  useEffect(() => {
    if (!selectedClassObj || !canonicalClassName) return;
    if (fetchedClassKeysRef.current.has(canonicalClassName)) return;

    let cancelled = false;
    fetchedClassKeysRef.current.add(canonicalClassName);
    setIsLoadingSyllabus(true);

    fetchPublicSyllabusForClassFromFirestore(canonicalClassName)
      .then((items) => {
        if (cancelled) return;
        setFirestoreSyllabusByClass((prev) => ({
          ...prev,
          [canonicalClassName]: items,
        }));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoadingSyllabus(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedClassObj, canonicalClassName]);

  // Combine Firestore & TSV syllabus presets for the selected class
  const combinedClassSyllabus = useMemo(() => {
    const fsItems = firestoreSyllabusByClass[canonicalClassName] || [];
    const seen = new Set<string>();
    const combined: SyllabusPreset[] = [];
    for (const item of [...fsItems, ...tsvSyllabus]) {
      if (!item) continue;
      const key = `${item.board}|${item.className}|${item.subject}|${item.chapter}|${item.topic}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      combined.push(item);
    }
    return combined;
  }, [firestoreSyllabusByClass, canonicalClassName, tsvSyllabus]);

  const classSyllabusSummary = useMemo(
    () =>
      extractSyllabusStructureForClass(
        combinedClassSyllabus,
        selectedClassObj?.grade || canonicalClassName,
        board,
        subject,
        chapter
      ),
    [combinedClassSyllabus, selectedClassObj?.grade, canonicalClassName, board, subject, chapter]
  );

  const allClassSubjectsCount = classSyllabusSummary.subjects.length;
  const allClassTopicsForClass = useMemo(
    () =>
      extractSyllabusStructureForClass(
        combinedClassSyllabus,
        selectedClassObj?.grade || canonicalClassName,
        board
      ),
    [combinedClassSyllabus, selectedClassObj?.grade, canonicalClassName, board]
  );

  // Auto-populate Subject / Chapter / Topic when teacher switches Class
  const handleSelectClassChange = (newClassId: string) => {
    setSelectedClassId(newClassId);
    const targetCls = selectableClasses.find((c) => c.id === newClassId);
    if (!targetCls) return;
    const summary = extractSyllabusStructureForClass(
      combinedClassSyllabus,
      targetCls.grade,
      board
    );
    if (summary.subjects.length > 0) {
      const nextSubj = summary.subjects.includes(subject) ? subject : summary.subjects[0];
      setSubject(nextSubj);
      const chapInfo = extractSyllabusStructureForClass(
        combinedClassSyllabus,
        targetCls.grade,
        board,
        nextSubj
      );
      if (chapInfo.chapters.length > 0) {
        const nextChap = chapInfo.chapters[0];
        setChapter(nextChap);
        const topicInfo = extractSyllabusStructureForClass(
          combinedClassSyllabus,
          targetCls.grade,
          board,
          nextSubj,
          nextChap
        );
        setTopic(topicInfo.topics[0]?.topic || '');
      } else {
        setChapter('');
        setTopic('');
      }
    }
  };

  // Auto-sync initial suggestions once TSV/Firestore syllabus arrives for first selected class
  useEffect(() => {
    if (!selectedClassObj) return;
    if (!chapter && classSyllabusSummary.subjects.length > 0) {
      const nextSubj = classSyllabusSummary.subjects.includes(subject)
        ? subject
        : classSyllabusSummary.subjects[0];
      if (nextSubj !== subject) setSubject(nextSubj);
      const subSummary = extractSyllabusStructureForClass(
        combinedClassSyllabus,
        selectedClassObj.grade,
        board,
        nextSubj
      );
      if (subSummary.chapters.length > 0) {
        const nextChap = subSummary.chapters[0];
        setChapter(nextChap);
        const topSummary = extractSyllabusStructureForClass(
          combinedClassSyllabus,
          selectedClassObj.grade,
          board,
          nextSubj,
          nextChap
        );
        if (topSummary.topics.length > 0 && !topic) {
          setTopic(topSummary.topics[0].topic);
        }
      }
    }
  }, [
    selectedClassObj,
    combinedClassSyllabus,
    classSyllabusSummary.subjects,
    board,
    subject,
    chapter,
    topic,
  ]);

  const subjectOptionsForClass = useMemo(() => {
    return Array.from(
      new Set([...classSyllabusSummary.subjects, ...SUBJECT_OPTIONS])
    );
  }, [classSyllabusSummary.subjects]);

  const handleGenerateAndSaveLessonPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!selectedClassObj) {
      setFeedback({
        type: 'error',
        text: isAdmin
          ? 'Please create at least one Class / Section first.'
          : 'No classes are currently assigned to your account. Contact your School Admin.',
      });
      return;
    }

    const cleanSubject = subject.trim() || 'General Science';
    const cleanChapter = chapter.trim() || 'Chapter 1: Core Concepts';
    const cleanTopic = topic.trim() || cleanChapter;
    const curriculumSection = inferSectionFromClass(canonicalClassName);

    setIsGenerating(true);
    try {
      let generatedContent: LessonPlanContent | null = null;
      let resolvedSource: SchoolLessonSyllabusSource = 'offline-template';

      // Smart Match: check Firestore `syllabus_data` / indexed curriculum first unless user explicitly requested Fresh AI
      if (!preferFreshAi) {
        const fsMatch = (firestoreSyllabusByClass[canonicalClassName] || []).find(
          (item) =>
            item.subject.toLowerCase() === cleanSubject.toLowerCase() &&
            (item.topic.toLowerCase() === cleanTopic.toLowerCase() ||
              item.chapter.toLowerCase() === cleanChapter.toLowerCase())
        );
        if (fsMatch) {
          generatedContent = { ...fsMatch };
          resolvedSource = 'firestore';
        } else {
          const sheetMatch = combinedClassSyllabus.find(
            (item) =>
              item.subject.toLowerCase() === cleanSubject.toLowerCase() &&
              (item.topic.toLowerCase() === cleanTopic.toLowerCase() ||
                item.chapter.toLowerCase() === cleanChapter.toLowerCase())
          );
          if (sheetMatch) {
            generatedContent = { ...sheetMatch };
            resolvedSource = 'google-sheet';
          }
        }
      }

      // Dynamic AI Generation via Backend Endpoint
      if (!generatedContent) {
        try {
          const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : '';
          const response = await fetch('/api/generate-lesson-plan', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
            },
            body: JSON.stringify({
              board,
              section: curriculumSection,
              className: canonicalClassName,
              subject: cleanSubject,
              chapter: cleanChapter,
              topic: cleanTopic,
              duration,
              planType,
            }),
          });
          const rawText = await response.text();
          if (
            !rawText.trimStart().toLowerCase().startsWith('<!doctype') &&
            !rawText.trimStart().toLowerCase().startsWith('<html')
          ) {
            const parsed = JSON.parse(rawText) as { plan?: LessonPlanContent };
            if (response.ok && parsed?.plan) {
              generatedContent = parsed.plan;
              resolvedSource = 'gemini-ai';
            }
          }
        } catch {
          // Fallback cleanly below
        }
      }

      // Offline/Fallback Institutional Curriculum Template
      if (!generatedContent) {
        generatedContent = buildSmsOfflineFallbackLessonPlan({
          board,
          section: curriculumSection,
          className: canonicalClassName,
          subject: cleanSubject,
          chapter: cleanChapter,
          topic: cleanTopic,
          duration,
          planType,
        });
        resolvedSource = 'offline-template';
      }

      const planId = `lp_${selectedClassObj.id}_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 6)}`;

      const teacherUid = currentUserProfile?.uid || auth.currentUser?.uid || activeTeacher?.id || 'teacher';
      const teacherName =
        currentUserProfile?.fullName || activeTeacher?.name || 'Class Teacher';

      const ok = await saveSchoolLessonPlan({
        id: planId,
        classId: selectedClassObj.id,
        grade: selectedClassObj.grade,
        section: selectedClassObj.section,
        teacherId: teacherUid,
        teacherUid,
        teacherName,
        board,
        curriculumSection,
        subject: cleanSubject,
        chapter: cleanChapter,
        topic: cleanTopic,
        duration,
        planType,
        syllabusSource: resolvedSource,
        slos: generatedContent.slos || '',
        previousKnowledge: generatedContent.previousKnowledge || '',
        teachingAids: generatedContent.teachingAids || '',
        introduction: generatedContent.introduction || '',
        procedure: generatedContent.procedure || '',
        teacherActivities: generatedContent.teacherActivities || '',
        studentActivities: generatedContent.studentActivities || '',
        assessment: generatedContent.assessment || '',
        homework: generatedContent.homework || '',
        vocabulary: generatedContent.vocabulary || '',
        lifeSkills: generatedContent.lifeSkills || '',
        teacherReflection: generatedContent.teacherReflection || '',
        questions: generatedContent.questions || '',
        exercise: generatedContent.exercise || '',
        worksheetPrompt: generatedContent.worksheetPrompt || '',
        bloomAssessment: generatedContent.bloomAssessment || '',
        sharedWithParents: shareWithParentsOnSave,
        sharedAt: shareWithParentsOnSave ? new Date().toISOString() : undefined,
        reviewedByAdmin: isAdmin,
      });

      if (ok) {
        setFeedback({
          type: 'success',
          text: `Saved lesson plan "${cleanTopic}" (${selectedClassObj.grade} · ${cleanSubject}) via ${
            resolvedSource === 'gemini-ai'
              ? 'Gemini AI'
              : resolvedSource === 'firestore'
              ? 'Firestore Syllabus DB'
              : resolvedSource === 'google-sheet'
              ? 'Indexed STBB Curriculum'
              : 'Offline Curriculum Template'
          }${shareWithParentsOnSave ? ' — shared with Parents as syllabus overview' : ''}.`,
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const displayedPlans = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return filteredLessonPlansForUser.filter((plan) => {
      if (filterClassId !== 'all' && plan.classId !== filterClassId) return false;
      if (filterShareStatus === 'shared' && !plan.sharedWithParents) return false;
      if (filterShareStatus === 'private' && plan.sharedWithParents) return false;
      if (!q) return true;
      return (
        plan.subject.toLowerCase().includes(q) ||
        plan.chapter.toLowerCase().includes(q) ||
        plan.topic.toLowerCase().includes(q) ||
        plan.teacherName.toLowerCase().includes(q) ||
        plan.grade.toLowerCase().includes(q)
      );
    });
  }, [filteredLessonPlansForUser, filterClassId, filterShareStatus, searchTerm]);

  const handleDownloadPreviewPdf = async () => {
    if (!previewA4Ref.current || !previewPlan) return;
    setIsExportingPdf(true);
    try {
      const safeTopic = previewPlan.topic.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
      await exportA4ElementAsPdf(
        previewA4Ref.current,
        `LessonPlan_${previewPlan.grade}_${previewPlan.subject}_${safeTopic}.pdf`
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                {isAdmin
                  ? 'School Lesson Plans & AI Syllabus Review'
                  : 'My Lesson Plans (AI Integrated)'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {filteredLessonPlansForUser.length} Saved
              </span>
              {!isAdmin && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  <Lock className="w-3 h-3" />
                  Assigned Classes Only
                </span>
              )}
            </div>
            <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-0.5">
              {isAdmin
                ? 'Generate, review across all faculty classes, print in A4 PDF, and approve parent syllabus sharing.'
                : 'Select your assigned class to auto-load syllabus topics, generate lesson plans with AI, save to school records, and share with parents.'}
            </p>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
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

      {/* Generator Form */}
      {selectableClasses.length === 0 ? (
        <div className="p-5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
          {isAdmin
            ? 'No classes found in this school yet. Add a Class / Section first to generate class-linked lesson plans.'
            : 'No classes are assigned to your teacher profile yet. Ask your School Admin to assign your classes.'}
        </div>
      ) : (
        <form
          onSubmit={handleGenerateAndSaveLessonPlan}
          className="bg-[#FAF8F5] dark:bg-[#2C1215]/60 border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 sm:p-5 space-y-4"
        >
          {/* Smart Syllabus Link Status Pill */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl px-3.5 py-2.5">
            <div className="flex items-center gap-2 text-[#00563B] dark:text-emerald-300 font-semibold">
              <Database className="w-3.5 h-3.5 shrink-0" />
              <span>
                Smart Syllabus Auto-Link ({canonicalClassName}):{' '}
                {isLoadingSyllabus
                  ? 'Fetching Firestore curriculum...'
                  : `${allClassSubjectsCount} subjects & ${allClassTopicsForClass.topics.length} curriculum topics available`}
              </span>
            </div>
            <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#57534E] dark:text-[#D6CCC2] cursor-pointer">
              <input
                type="checkbox"
                checked={preferFreshAi}
                onChange={(e) => setPreferFreshAi(e.target.checked)}
                className="rounded border-[#D6CCC2] text-[#7F1D1D] focus:ring-[#7F1D1D]"
              />
              <span>Force Fresh Gemini AI Generation</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Assigned Class */}
            <div>
              <label className="block text-[11px] font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                1. {isAdmin ? 'Class / Section' : 'My Assigned Class'} *
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => handleSelectClassChange(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 text-xs font-semibold rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FFFDF9] dark:bg-[#211415] text-[#1C1917] dark:text-[#FAF8F5]"
                required
              >
                {selectableClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.grade} - {cls.section}
                  </option>
                ))}
              </select>
            </div>

            {/* Curriculum Board */}
            <div>
              <label className="block text-[11px] font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                2. Textbook Board
              </label>
              <select
                value={board}
                onChange={(e) =>
                  setBoard(e.target.value === 'Punjab PTB' ? 'Punjab PTB' : 'Sindh STBB')
                }
                className="w-full min-h-[42px] px-3 py-2 text-xs font-semibold rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FFFDF9] dark:bg-[#211415] text-[#1C1917] dark:text-[#FAF8F5]"
              >
                <option value="Sindh STBB">Sindh STBB</option>
                <option value="Punjab PTB">Punjab PTB</option>
              </select>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-[11px] font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                3. Subject *
              </label>
              <input
                type="text"
                list="sms-lp-subject-suggestions"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g., Physics, English, Science"
                className="w-full min-h-[42px] px-3 py-2 text-xs font-semibold rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FFFDF9] dark:bg-[#211415] text-[#1C1917] dark:text-[#FAF8F5]"
                required
              />
              <datalist id="sms-lp-subject-suggestions">
                {subjectOptionsForClass.map((subj) => (
                  <option key={subj} value={subj} />
                ))}
              </datalist>
            </div>

            {/* Plan Type & Duration */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                  Duration
                </label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full min-h-[42px] px-2.5 py-2 text-xs font-semibold rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FFFDF9] dark:bg-[#211415] text-[#1C1917] dark:text-[#FAF8F5]"
                >
                  <option value="35 Minutes">35 Min</option>
                  <option value="40 Minutes">40 Min</option>
                  <option value="45 Minutes">45 Min</option>
                  <option value="60 Minutes">60 Min</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                  Cadence
                </label>
                <select
                  value={planType}
                  onChange={(e) =>
                    setPlanType(e.target.value === 'Weekly' ? 'Weekly' : 'Daily')
                  }
                  className="w-full min-h-[42px] px-2.5 py-2 text-xs font-semibold rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FFFDF9] dark:bg-[#211415] text-[#1C1917] dark:text-[#FAF8F5]"
                >
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Chapter */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-[#44403C] dark:text-[#E7E0D4]">
                4. Chapter / Unit *{' '}
                {classSyllabusSummary.chapters.length > 0 && (
                  <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
                    ({classSyllabusSummary.chapters.length} Auto-Populated)
                  </span>
                )}
              </label>
              {classSyllabusSummary.chapters.length > 0 && (
                <select
                  value={classSyllabusSummary.chapters.includes(chapter) ? chapter : ''}
                  onChange={(e) => {
                    const nextCh = e.target.value;
                    if (!nextCh) return;
                    setChapter(nextCh);
                    const matchedTopics = extractSyllabusStructureForClass(
                      combinedClassSyllabus,
                      selectedClassObj?.grade || canonicalClassName,
                      board,
                      subject,
                      nextCh
                    ).topics;
                    if (matchedTopics[0]) {
                      setTopic(matchedTopics[0].topic);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/50 text-[#1C1917] dark:text-[#FAF8F5]"
                >
                  <option value="">-- Pick Chapter from Class Syllabus --</option>
                  {classSyllabusSummary.chapters.map((ch) => (
                    <option key={ch} value={ch}>
                      {ch}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
                placeholder="Enter chapter name (e.g., Chapter 2: Kinematics)"
                className="w-full min-h-[40px] px-3 py-2 text-xs rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FFFDF9] dark:bg-[#211415] text-[#1C1917] dark:text-[#FAF8F5]"
                required
              />
            </div>

            {/* Topic */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-[#44403C] dark:text-[#E7E0D4]">
                5. Lesson Topic{' '}
                {classSyllabusSummary.topics.length > 0 && (
                  <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
                    ({classSyllabusSummary.topics.length} Topics Matched)
                  </span>
                )}
              </label>
              {classSyllabusSummary.topics.length > 0 && (
                <select
                  value={
                    classSyllabusSummary.topics.some((t) => t.topic === topic) ? topic : ''
                  }
                  onChange={(e) => {
                    if (e.target.value) setTopic(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/50 text-[#1C1917] dark:text-[#FAF8F5]"
                >
                  <option value="">-- Pick Topic from Class Syllabus --</option>
                  {classSyllabusSummary.topics.map((t) => (
                    <option key={t.id} value={t.topic}>
                      {t.topic}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Specific topic (optional, defaults to Chapter)"
                className="w-full min-h-[40px] px-3 py-2 text-xs rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FFFDF9] dark:bg-[#211415] text-[#1C1917] dark:text-[#FAF8F5]"
              />
            </div>
          </div>

          {/* Share with parents toggle & Generate CTA */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#44403C] dark:text-[#E7E0D4] cursor-pointer">
              <input
                type="checkbox"
                checked={shareWithParentsOnSave}
                onChange={(e) => setShareWithParentsOnSave(e.target.checked)}
                className="rounded border-[#D6CCC2] text-[#C2410C] focus:ring-[#C2410C]"
              />
              <span>Share with Parents as Class Syllabus Overview</span>
            </label>

            <button
              type="submit"
              disabled={isGenerating}
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#7F1D1D] hover:bg-[#651414] text-white text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-60"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating &amp; Saving Plan...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate &amp; Save Lesson Plan with AI</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Saved Lesson Plans Filter Bar & Cards */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#57534E] dark:text-[#D6CCC2]">
            {isAdmin
              ? `All School Lesson Plans (${displayedPlans.length})`
              : `My Saved Class Lesson Plans (${displayedPlans.length})`}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search subject, topic, teacher..."
              className="min-h-[36px] px-3 py-1.5 text-xs rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5]"
            />
            <select
              value={filterClassId}
              onChange={(e) => setFilterClassId(e.target.value)}
              className="min-h-[36px] px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5]"
            >
              <option value="all">
                {isAdmin ? 'All Classes' : 'All Assigned Classes'}
              </option>
              {selectableClasses.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.grade} - {cls.section}
                </option>
              ))}
            </select>
            <select
              value={filterShareStatus}
              onChange={(e) =>
                setFilterShareStatus(e.target.value as 'all' | 'shared' | 'private')
              }
              className="min-h-[36px] px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5]"
            >
              <option value="all">All Visibility</option>
              <option value="shared">Shared w/ Parents</option>
              <option value="private">Private Only</option>
            </select>
          </div>
        </div>

        {displayedPlans.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#78716C] border border-dashed border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl">
            No saved lesson plans match the current filter. Select a class, subject, and chapter above to generate your first AI lesson plan.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {displayedPlans.map((plan) => (
              <div
                key={plan.id}
                className="p-4 rounded-2xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5]/75 dark:bg-[#2C1215]/60 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF2F2] dark:bg-[#3F1014]/70 text-[#7F1D1D] dark:text-[#FCA5A5] border border-[#FECACA] dark:border-[#7F1D1D]/50">
                        {plan.grade} {plan.section ? `- ${plan.section}` : ''}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF7ED] dark:bg-[#7C2D12]/60 text-[#C2410C] dark:text-[#FDBA74] border border-[#FED7AA] dark:border-[#C2410C]/40">
                        {plan.subject}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F3EFEA] dark:bg-[#211415] text-[#57534E] dark:text-[#D6CCC2]">
                        {plan.board}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        plan.sharedWithParents
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-[#F3EFEA] text-[#57534E] dark:bg-[#211415] dark:text-[#D6CCC2]'
                      }`}
                    >
                      {plan.sharedWithParents ? 'Parent Shared' : 'Staff Only'}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5] leading-snug">
                    {plan.topic}
                  </h4>
                  <div className="text-[11px] font-semibold text-[#57534E] dark:text-[#D6CCC2]">
                    {plan.chapter} · {plan.duration} · Teacher: {plan.teacherName}
                  </div>
                  <p className="text-[11px] text-[#57534E] dark:text-[#D6CCC2] line-clamp-2 leading-relaxed">
                    {plan.slos}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E7E0D4] dark:border-[rgba(255,253,249,0.12)]">
                  <button
                    type="button"
                    onClick={() =>
                      void toggleShareLessonPlanWithParents(
                        plan.id,
                        !plan.sharedWithParents
                      )
                    }
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                      plan.sharedWithParents
                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-[#F3EFEA] hover:bg-[#E7E0D4] text-[#44403C] dark:bg-[#211415] dark:text-[#FAF8F5]'
                    }`}
                  >
                    {plan.sharedWithParents ? (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Shared w/ Parents</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Share w/ Parents</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPreviewPlan(plan)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2C1215] hover:bg-[#58181D] text-white text-[11px] font-bold transition cursor-pointer"
                    >
                      <Share2 className="w-3 h-3" />
                      <span>View / Print</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Delete lesson plan "${plan.topic}"?`)) {
                          void deleteSchoolLessonPlan(plan.id);
                        }
                      }}
                      title="Delete Lesson Plan"
                      className="p-1.5 text-[#78716C] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* A4 Lesson Plan Preview & Print Modal */}
      {previewPlan && (
        <div
          className="fixed inset-0 z-[9999] overflow-y-auto bg-black/75 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center print:static print:bg-transparent print:p-0 print:block"
          onClick={() => setPreviewPlan(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Lesson Plan Print Preview"
        >
          <div
            className="w-full max-w-4xl max-h-[90dvh] bg-[#FFFDF9] text-[#1C1917] rounded-2xl shadow-2xl flex flex-col overflow-hidden print:max-w-none print:max-h-none print:shadow-none print:rounded-none print:overflow-visible print:block"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="no-print shrink-0 flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-b border-[#E7E0D4] bg-[#FFFDF9]">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#1C1917] truncate">
                  Lesson Plan · {previewPlan.subject} ({previewPlan.grade})
                </h3>
                <p className="text-[11px] text-[#57534E] truncate">{previewPlan.topic}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleDownloadPreviewPdf}
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
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewPlan(null)}
                  className="p-2 rounded-xl bg-[#F3EFEA] hover:bg-[#E7E0D4] text-[#44403C] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable A4 Printable Sheet */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#F3EFEA]/60 print:p-0 print:bg-white">
              <div
                ref={previewA4Ref}
                className="printable-a4-sheet bg-white border border-[#E7E0D4] rounded-xl p-6 sm:p-8 text-[#1C1917] space-y-4 shadow-xs"
              >
                <div className="border-b-2 border-[#7F1D1D] pb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#7F1D1D]">
                      {activeSchool.name || 'PakEdu Institutional School'} · {previewPlan.board}
                    </div>
                    <h1 className="text-lg sm:text-xl font-extrabold text-[#1C1917] mt-0.5">
                      {previewPlan.topic}
                    </h1>
                    <p className="text-xs text-[#57534E]">{previewPlan.chapter}</p>
                  </div>
                  <div className="text-xs text-right space-y-0.5">
                    <div>
                      <strong>Class:</strong> {previewPlan.grade}{' '}
                      {previewPlan.section ? `- ${previewPlan.section}` : ''}
                    </div>
                    <div>
                      <strong>Subject:</strong> {previewPlan.subject} ·{' '}
                      <strong>{previewPlan.duration}</strong> ({previewPlan.planType})
                    </div>
                    <div>
                      <strong>Prepared By:</strong> {previewPlan.teacherName}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E7E0D4]">
                    <h4 className="font-extrabold uppercase text-[10px] tracking-wider text-[#7F1D1D] mb-1">
                      Student Learning Outcomes (SLOs)
                    </h4>
                    <p className="whitespace-pre-line leading-relaxed">{previewPlan.slos}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E7E0D4]">
                    <h4 className="font-extrabold uppercase text-[10px] tracking-wider text-[#7F1D1D] mb-1">
                      Previous Knowledge &amp; Teaching Aids
                    </h4>
                    <p className="whitespace-pre-line leading-relaxed">
                      {previewPlan.previousKnowledge}
                      {'\n'}
                      <strong>Aids:</strong> {previewPlan.teachingAids}
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-[#E7E0D4] text-xs space-y-2">
                  <h4 className="font-extrabold uppercase text-[10px] tracking-wider text-[#7F1D1D]">
                    Introduction &amp; Step-by-Step Procedure
                  </h4>
                  <p className="whitespace-pre-line leading-relaxed">{previewPlan.introduction}</p>
                  <div className="pt-2 border-t border-[#E7E0D4] whitespace-pre-line leading-relaxed">
                    {previewPlan.procedure}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E7E0D4]">
                    <h4 className="font-extrabold uppercase text-[10px] tracking-wider text-[#00563B] mb-1">
                      Teacher Activities
                    </h4>
                    <p className="whitespace-pre-line leading-relaxed">
                      {previewPlan.teacherActivities}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E7E0D4]">
                    <h4 className="font-extrabold uppercase text-[10px] tracking-wider text-[#00563B] mb-1">
                      Student Activities
                    </h4>
                    <p className="whitespace-pre-line leading-relaxed">
                      {previewPlan.studentActivities}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-white border border-[#E7E0D4]">
                    <h4 className="font-extrabold uppercase text-[10px] tracking-wider text-[#7F1D1D] mb-1">
                      Formative Assessment &amp; Bloom Check
                    </h4>
                    <p className="whitespace-pre-line leading-relaxed">{previewPlan.assessment}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white border border-[#E7E0D4]">
                    <h4 className="font-extrabold uppercase text-[10px] tracking-wider text-[#7F1D1D] mb-1">
                      Homework &amp; Vocabulary
                    </h4>
                    <p className="whitespace-pre-line leading-relaxed">
                      {previewPlan.homework}
                      {previewPlan.vocabulary ? `\n\n${previewPlan.vocabulary}` : ''}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
