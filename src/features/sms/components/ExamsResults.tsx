import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Edit2,
  FileText,
  GraduationCap,
  Lock,
  Plus,
  Printer,
  Save,
  ShieldAlert,
  Sparkles,
  Trash2,
  TrendingUp,
  Trophy,
  Upload,
  Users,
  X,
  Building,
  AlertCircle,
} from 'lucide-react';
import { useSms } from '../context/SmsContext';
import {
  Exam,
  ExamStatus,
  ExamSubject,
  ExamTermType,
  Student,
  StudentExamMarks,
} from '../types';
import {
  DEFAULT_SELD_SUBJECT_PRESETS,
  StudentClassStanding,
  computeClassPositions,
  computeStudentExamResult,
} from '../utils/examCalculations';
import { triggerPrintDocument } from '../../../utils/printDocument';
import { validateSchoolLogoFile } from '../../../utils/questionPaperLogic';
import { ExamQuestionPapersSection } from './ExamQuestionPapersSection';
import { getAttachedQuestionPapersForExam } from '../utils/aiIntegrationHelpers';

export type ExamTabId = 'setup' | 'marks' | 'reports' | 'papers';

interface ExamsResultsProps {
  onBack?: () => void;
  initialTab?: ExamTabId;
  initialExamId?: string;
  initialReportStudentId?: string;
  onOpenReportCardRoute?: (examId: string | null, studentId: string | null) => void;
}

interface ReportPrintModalShellProps {
  title: string;
  printLabel: string;
  onPrint: () => void;
  onClose: () => void;
  children: React.ReactNode;
}

const ReportPrintModalShell: React.FC<ReportPrintModalShellProps> = ({
  title,
  printLabel,
  onPrint,
  onClose,
  children,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-6 print:static print:bg-transparent print:p-0 print:block"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] bg-[#FFFDF9] text-[#1C1917] rounded-2xl shadow-2xl flex flex-col overflow-hidden print:max-w-none print:max-h-none print:shadow-none print:rounded-none print:overflow-visible print:block"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="print:hidden shrink-0 flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-[#E7E0D4] bg-[#FFFDF9]">
          <div className="flex items-center gap-2.5 min-w-0">
            <Award className="w-5 h-5 text-[#7F1D1D] shrink-0" />
            <h3 className="text-base font-bold text-[#1C1917] truncate">{title}</h3>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onPrint}
              className="px-4 py-2 bg-[#7F1D1D] hover:bg-[#651414] text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{printLabel}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="px-3.5 py-2 bg-[#F3EFEA] hover:bg-[#E7E0D4] text-[#44403C] font-semibold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Close</span>
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-4 sm:p-6 print:overflow-visible print:p-0">
          {children}
        </div>

        <div className="print:hidden shrink-0 flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 border-t border-[#E7E0D4] bg-[#FAF8F5]">
          <span className="text-[11px] text-[#57534E]">
            A4 Print &amp; PDF Ready · Press Esc or Close to return
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#FFFDF9] hover:bg-[#F3EFEA] border border-[#D6CCC2] text-[#44403C] font-semibold text-xs rounded-xl transition cursor-pointer"
            >
              Close / Cancel
            </button>
            <button
              type="button"
              onClick={onPrint}
              className="px-4 py-2 bg-[#7F1D1D] hover:bg-[#651414] text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{printLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Fallback crisp SVG School Crest when no custom school logo is uploaded.
 */
const DefaultSchoolCrest: React.FC = () => (
  <div className="w-16 h-16 rounded-2xl bg-emerald-900 text-amber-300 flex flex-col items-center justify-center border-2 border-emerald-700 shrink-0 shadow-xs">
    <GraduationCap className="w-8 h-8" />
    <span className="text-[8px] font-black tracking-widest uppercase mt-0.5 text-white">SELD</span>
  </div>
);

export const ExamsResults: React.FC<ExamsResultsProps> = ({
  onBack,
  initialTab,
  initialExamId,
  initialReportStudentId,
  onOpenReportCardRoute,
}) => {
  const {
    activeSchool,
    setActiveSchool,
    registeredSchools,
    classes,
    filteredClassesForUser,
    students,
    exams,
    examMarks,
    saveExam,
    deleteExam,
    saveBulkStudentMarks,
    canManageExams,
    canEnterMarksForClass,
    updateSchoolLogo,
    isSuperAdmin,
    userRole,
    currentUserProfile,
    loadingClasses,
    refreshActiveSchoolClasses,
    filteredQuestionPapersForUser,
    canAccessSchoolAiContent,
    isReadOnlyImpersonation,
  } = useSms();

  const [isPaperModalOpen, setIsPaperModalOpen] = useState(false);
  const [paperGeneratorExamId, setPaperGeneratorExamId] = useState<string | undefined>(undefined);

  const defaultTab: ExamTabId =
    initialTab && (initialTab !== 'setup' || canManageExams)
      ? initialTab
      : canManageExams
      ? 'setup'
      : 'marks';

  const [activeTab, setActiveTab] = useState<ExamTabId>(defaultTab);
  const [feedbackBanner, setFeedbackBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (activeTab === 'setup' && !canManageExams) {
      setActiveTab('marks');
    }
  }, [activeTab, canManageExams]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackBanner({ type, text });
    setTimeout(() => setFeedbackBanner(null), 4500);
  };

  // =========================================================================
  // TAB 1 STATE: EXAM SETUP (Admin Only)
  // =========================================================================
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [examTitle, setExamTitle] = useState<string>('');
  const [termType, setTermType] = useState<ExamTermType>('First Term');
  const [academicYear, setAcademicYear] = useState<string>(activeSchool.activeAcademicYear || '2025-2026');
  const [examStatus, setExamStatus] = useState<ExamStatus>('published');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedExamClassIds, setSelectedExamClassIds] = useState<string[]>([]);
  const [examSubjects, setExamSubjects] = useState<ExamSubject[]>(() =>
    DEFAULT_SELD_SUBJECT_PRESETS.slice(0, 5).map((s, idx) => ({
      id: `subj_${idx + 1}_${s.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      ...s,
    }))
  );
  const [newSubjName, setNewSubjName] = useState<string>('');
  const [newSubjTotal, setNewSubjTotal] = useState<number>(100);
  const [newSubjPassing, setNewSubjPassing] = useState<number>(33);
  const [isSavingExam, setIsSavingExam] = useState<boolean>(false);

  // Sync default class checks when activeSchool classes load for new exams
  useEffect(() => {
    if (!editingExamId && classes.length > 0 && selectedExamClassIds.length === 0) {
      setSelectedExamClassIds(classes.map((c) => c.id));
    }
  }, [classes, editingExamId]);

  const resetExamForm = () => {
    setEditingExamId(null);
    setExamTitle('');
    setTermType('First Term');
    setAcademicYear(activeSchool.activeAcademicYear || '2025-2026');
    setExamStatus('published');
    setStartDate('');
    setEndDate('');
    setSelectedExamClassIds(classes.map((c) => c.id));
    setExamSubjects(
      DEFAULT_SELD_SUBJECT_PRESETS.slice(0, 5).map((s, idx) => ({
        id: `subj_${idx + 1}_${s.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        ...s,
      }))
    );
  };

  const handleEditExam = (exam: Exam) => {
    setEditingExamId(exam.id);
    setExamTitle(exam.title);
    setTermType(exam.termType || 'First Term');
    setAcademicYear(exam.academicYear || '2025-2026');
    setExamStatus(exam.status || 'published');
    setStartDate(exam.startDate || '');
    setEndDate(exam.endDate || '');
    setSelectedExamClassIds(exam.classIds || []);
    setExamSubjects(exam.subjects || []);
    setActiveTab('setup');
  };

  const handleToggleExamClass = (classId: string) => {
    setSelectedExamClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  const handleAddSubjectRow = () => {
    const cleanName = newSubjName.trim();
    if (!cleanName) {
      showToast('Please enter a subject name first.', 'error');
      return;
    }
    const maxM = Math.max(1, Number(newSubjTotal) || 100);
    const passM = Math.max(0, Math.min(maxM, Number(newSubjPassing) || 0));
    const subjId = `subj_${Date.now().toString(36)}_${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 12)}`;
    setExamSubjects((prev) => [
      ...prev,
      { id: subjId, name: cleanName, totalMarks: maxM, passingMarks: passM },
    ]);
    setNewSubjName('');
    setNewSubjTotal(100);
    setNewSubjPassing(33);
  };

  const handleLoadSeldPresets = () => {
    setExamSubjects(
      DEFAULT_SELD_SUBJECT_PRESETS.map((s, idx) => ({
        id: `subj_${idx + 1}_${s.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        ...s,
      }))
    );
    showToast('Loaded standard Sindh SELD 7-subject scheme.');
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageExams) {
      showToast('Permission Denied: Only School Admins can configure exams.', 'error');
      return;
    }
    if (!examTitle.trim()) {
      showToast('Exam Title (e.g., "First Term 2026") is required.', 'error');
      return;
    }
    if (selectedExamClassIds.length === 0) {
      showToast('Please select at least one Class / Section for this exam.', 'error');
      return;
    }
    const validSubjects = examSubjects.filter((s) => s.name.trim() && Number(s.totalMarks) > 0);
    if (validSubjects.length === 0) {
      showToast('Please define at least one subject with valid total marks.', 'error');
      return;
    }

    setIsSavingExam(true);
    try {
      const id =
        editingExamId ||
        `exam_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
      const ok = await saveExam({
        id,
        title: examTitle.trim(),
        termType,
        academicYear: academicYear.trim() || '2025-2026',
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        classIds: selectedExamClassIds,
        subjects: validSubjects.map((s) => ({
          ...s,
          name: s.name.trim(),
          totalMarks: Math.max(1, Number(s.totalMarks) || 100),
          passingMarks: Math.max(0, Math.min(Number(s.totalMarks) || 100, Number(s.passingMarks) || 0)),
        })),
        status: examStatus,
      });

      if (ok) {
        showToast(
          editingExamId
            ? `Updated exam "${examTitle.trim()}" successfully.`
            : `Created exam "${examTitle.trim()}" with ${validSubjects.length} subjects.`
        );
        setSelectedExamId(id);
        resetExamForm();
      }
    } finally {
      setIsSavingExam(false);
    }
  };

  // =========================================================================
  // TAB 2 & 3 SHARED SELECTION + MARKS ENTRY STATE
  // =========================================================================
  const [selectedExamId, setSelectedExamId] = useState<string>(() => initialExamId || exams[0]?.id || '');
  const lastRouteReportStudentRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (initialExamId && exams.some((e) => e.id === initialExamId)) {
      setSelectedExamId(initialExamId);
    } else if (exams.length > 0 && (!selectedExamId || !exams.some((e) => e.id === selectedExamId))) {
      setSelectedExamId(exams[0].id);
    }
  }, [exams, selectedExamId, initialExamId]);

  const activeExam = useMemo(
    () => exams.find((e) => e.id === selectedExamId) || null,
    [exams, selectedExamId]
  );

  // RBAC: Admins see all classes included in the exam; Teachers see ONLY their assigned classes intersected with exam.classIds
  const accessibleClassesForExam = useMemo(() => {
    const basePool = canManageExams ? classes : filteredClassesForUser;
    if (!activeExam) return basePool;
    if (!activeExam.classIds || activeExam.classIds.length === 0) return basePool;
    return basePool.filter((c) => activeExam.classIds.includes(c.id));
  }, [canManageExams, classes, filteredClassesForUser, activeExam]);

  const [selectedClassId, setSelectedClassId] = useState<string>('');

  useEffect(() => {
    if (accessibleClassesForExam.length > 0) {
      if (!selectedClassId || !accessibleClassesForExam.some((c) => c.id === selectedClassId)) {
        setSelectedClassId(accessibleClassesForExam[0].id);
      }
    } else {
      setSelectedClassId('');
    }
  }, [accessibleClassesForExam, selectedClassId]);

  const selectedClassObj = useMemo(
    () => classes.find((c) => c.id === selectedClassId) || null,
    [classes, selectedClassId]
  );

  const studentsInSelectedClass = useMemo(() => {
    if (!selectedClassId) return [];
    return students
      .filter((s) => s.classId === selectedClassId && s.status === 'active')
      .sort((a, b) => a.grNumber.localeCompare(b.grNumber));
  }, [students, selectedClassId]);

  // Draft map per studentId -> { marks: Record<subjId, number | null>, absent: string[], remarks: string }
  const [marksDraft, setMarksDraft] = useState<
    Record<
      string,
      {
        subjectMarks: Record<string, number | null>;
        absentSubjects: string[];
        remarks: string;
      }
    >
  >({});
  const [hasUnsavedDraft, setHasUnsavedDraft] = useState<boolean>(false);
  const [isSavingMarks, setIsSavingMarks] = useState<boolean>(false);

  // Hydrate marksDraft whenever exam, class, or saved examMarks change
  useEffect(() => {
    if (!activeExam || !selectedClassId) {
      setMarksDraft({});
      setHasUnsavedDraft(false);
      return;
    }

    const initial: Record<
      string,
      {
        subjectMarks: Record<string, number | null>;
        absentSubjects: string[];
        remarks: string;
      }
    > = {};

    studentsInSelectedClass.forEach((stu) => {
      const existing = examMarks.find(
        (m) => m.examId === activeExam.id && m.studentId === stu.id
      );
      initial[stu.id] = {
        subjectMarks: existing?.subjectMarks ? { ...existing.subjectMarks } : {},
        absentSubjects: existing?.absentSubjects ? [...existing.absentSubjects] : [],
        remarks: existing?.remarks || '',
      };
    });

    setMarksDraft(initial);
    setHasUnsavedDraft(false);
  }, [activeExam, selectedClassId, studentsInSelectedClass, examMarks]);

  const isTeacherAuthorizedForSelectedClass = useMemo(() => {
    return canEnterMarksForClass(selectedClassId);
  }, [canEnterMarksForClass, selectedClassId, currentUserProfile]);

  const handleMarkChange = (studentId: string, subject: ExamSubject, rawValue: string) => {
    setHasUnsavedDraft(true);
    setMarksDraft((prev) => {
      const cur = prev[studentId] || { subjectMarks: {}, absentSubjects: [], remarks: '' };
      let parsed: number | null = null;
      if (rawValue.trim() !== '') {
        const num = Number(rawValue);
        if (!Number.isNaN(num)) {
          parsed = Math.max(0, Math.min(subject.totalMarks, num));
        }
      }
      return {
        ...prev,
        [studentId]: {
          ...cur,
          absentSubjects: cur.absentSubjects.filter((id) => id !== subject.id),
          subjectMarks: {
            ...cur.subjectMarks,
            [subject.id]: parsed,
          },
        },
      };
    });
  };

  const handleToggleAbsent = (studentId: string, subjectId: string) => {
    setHasUnsavedDraft(true);
    setMarksDraft((prev) => {
      const cur = prev[studentId] || { subjectMarks: {}, absentSubjects: [], remarks: '' };
      const isCurrentlyAbsent = cur.absentSubjects.includes(subjectId);
      const nextAbsent = isCurrentlyAbsent
        ? cur.absentSubjects.filter((id) => id !== subjectId)
        : [...cur.absentSubjects, subjectId];
      const nextSubjectMarks = { ...cur.subjectMarks };
      if (!isCurrentlyAbsent) {
        nextSubjectMarks[subjectId] = null;
      }
      return {
        ...prev,
        [studentId]: {
          ...cur,
          absentSubjects: nextAbsent,
          subjectMarks: nextSubjectMarks,
        },
      };
    });
  };

  const handleRemarksChange = (studentId: string, remarks: string) => {
    setHasUnsavedDraft(true);
    setMarksDraft((prev) => {
      const cur = prev[studentId] || { subjectMarks: {}, absentSubjects: [], remarks: '' };
      return {
        ...prev,
        [studentId]: {
          ...cur,
          remarks,
        },
      };
    });
  };

  const handleAutoFillRemarks = () => {
    if (!activeExam) return;
    setHasUnsavedDraft(true);
    setMarksDraft((prev) => {
      const next = { ...prev };
      studentsInSelectedClass.forEach((stu) => {
        const cur = next[stu.id] || { subjectMarks: {}, absentSubjects: [], remarks: '' };
        const computed = computeStudentExamResult(
          activeExam,
          cur.subjectMarks,
          cur.absentSubjects
        );
        if (computed.hasEnteredAnyMarks && !cur.remarks.trim()) {
          next[stu.id] = {
            ...cur,
            remarks: computed.suggestedRemark,
          };
        }
      });
      return next;
    });
    showToast('Suggested Teacher Remarks filled for students with empty remarks.');
  };

  const handleSaveAllClassMarks = async () => {
    if (!activeExam || !selectedClassObj) return;
    if (!isTeacherAuthorizedForSelectedClass) {
      showToast('Permission Denied: This class is not assigned to your account.', 'error');
      return;
    }
    if (studentsInSelectedClass.length === 0) {
      showToast('No enrolled students in this class.', 'error');
      return;
    }

    setIsSavingMarks(true);
    try {
      const recordsToSave: Array<Omit<StudentExamMarks, 'schoolId'>> = studentsInSelectedClass.map(
        (stu) => {
          const entry = marksDraft[stu.id] || {
            subjectMarks: {},
            absentSubjects: [],
            remarks: '',
          };
          const computed = computeStudentExamResult(
            activeExam,
            entry.subjectMarks,
            entry.absentSubjects
          );
          return {
            id: `${activeExam.id}_${stu.id}`,
            examId: activeExam.id,
            classId: selectedClassObj.id,
            studentId: stu.id,
            studentName: stu.fullName,
            grNumber: stu.grNumber,
            grade: stu.grade || selectedClassObj.grade,
            section: stu.section || selectedClassObj.section,
            subjectMarks: entry.subjectMarks,
            absentSubjects: entry.absentSubjects,
            remarks: entry.remarks.trim(),
            totalObtained: computed.totalObtained,
            totalMax: computed.totalMax,
            percentage: computed.percentage,
            overallGrade: computed.overallGrade,
            resultStatus: computed.resultStatus,
          };
        }
      );

      const ok = await saveBulkStudentMarks(recordsToSave);
      if (ok) {
        setHasUnsavedDraft(false);
        showToast(
          `Saved exam marks for ${recordsToSave.length} students (${selectedClassObj.grade} - ${selectedClassObj.section}).`
        );
      }
    } finally {
      setIsSavingMarks(false);
    }
  };

  // Live standings computed from marksDraft on Marks Entry OR persisted examMarks on Report Cards
  const liveClassStandings = useMemo<Map<string, StudentClassStanding>>(() => {
    if (!activeExam) return new Map<string, StudentClassStanding>();
    const syntheticList: StudentExamMarks[] = studentsInSelectedClass.map((stu) => {
      const d = marksDraft[stu.id];
      const existing = examMarks.find(
        (m) => m.examId === activeExam.id && m.studentId === stu.id
      );
      return {
        id: `${activeExam.id}_${stu.id}`,
        schoolId: activeSchool.id,
        examId: activeExam.id,
        classId: stu.classId,
        studentId: stu.id,
        studentName: stu.fullName,
        grNumber: stu.grNumber,
        grade: stu.grade,
        section: stu.section,
        subjectMarks: d ? d.subjectMarks : existing?.subjectMarks || {},
        absentSubjects: d ? d.absentSubjects : existing?.absentSubjects || [],
        remarks: d ? d.remarks : existing?.remarks || '',
        totalObtained: 0,
        totalMax: 0,
        percentage: 0,
        overallGrade: '—',
        resultStatus: 'Pending',
      };
    });
    return computeClassPositions(activeExam, studentsInSelectedClass, syntheticList);
  }, [activeExam, studentsInSelectedClass, marksDraft, examMarks, activeSchool.id]);

  // =========================================================================
  // TAB 3 STATE: REPORT CARDS & GAZETTE
  // =========================================================================
  const [sortBy, setSortBy] = useState<'position' | 'gr'>('position');
  const [reportStudentsForPrint, setReportStudentsForPrint] = useState<Student[] | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  // Sync dynamic report card URL param /sms/exams/:examId/report/:studentId
  useEffect(() => {
    if (!initialReportStudentId) {
      if (lastRouteReportStudentRef.current) {
        setReportStudentsForPrint(null);
      }
      lastRouteReportStudentRef.current = undefined;
      return;
    }
    const targetExam =
      (initialExamId && exams.find((e) => e.id === initialExamId)) || activeExam;
    if (!targetExam) return;

    const basePool = canManageExams ? classes : filteredClassesForUser;
    const allowedClassIds = new Set(
      (!targetExam.classIds || targetExam.classIds.length === 0
        ? basePool
        : basePool.filter((c) => targetExam.classIds.includes(c.id))
      ).map((c) => c.id)
    );
    const matchedStudent = students.find(
      (s) => s.id === initialReportStudentId && allowedClassIds.has(s.classId)
    );
    if (!matchedStudent) return;

    lastRouteReportStudentRef.current = initialReportStudentId;
    if (selectedExamId !== targetExam.id) {
      setSelectedExamId(targetExam.id);
    }
    if (selectedClassId !== matchedStudent.classId) {
      setSelectedClassId(matchedStudent.classId);
    }
    setActiveTab('reports');
    setReportStudentsForPrint([matchedStudent]);
  }, [
    initialExamId,
    initialReportStudentId,
    exams,
    activeExam,
    classes,
    filteredClassesForUser,
    canManageExams,
    students,
    selectedExamId,
    selectedClassId,
  ]);

  const reportStandings = useMemo<Map<string, StudentClassStanding>>(() => {
    if (!activeExam) return new Map<string, StudentClassStanding>();
    return computeClassPositions(activeExam, studentsInSelectedClass, examMarks);
  }, [activeExam, studentsInSelectedClass, examMarks]);

  const sortedReportStudents = useMemo(() => {
    const copy = [...studentsInSelectedClass];
    if (sortBy === 'position') {
      return copy.sort((a, b) => {
        const posA = reportStandings.get(a.id)?.position ?? 9999;
        const posB = reportStandings.get(b.id)?.position ?? 9999;
        if (posA !== posB) return posA - posB;
        return a.grNumber.localeCompare(b.grNumber);
      });
    }
    return copy.sort((a, b) => a.grNumber.localeCompare(b.grNumber));
  }, [studentsInSelectedClass, sortBy, reportStandings]);

  const gazetteSummary = useMemo(() => {
    let entered = 0;
    let passed = 0;
    let failed = 0;
    let pctSum = 0;
    let topperName = '—';
    let topperScore = '';

    sortedReportStudents.forEach((stu) => {
      const st = reportStandings.get(stu.id);
      if (!st || !st.result.hasEnteredAnyMarks) return;
      entered += 1;
      pctSum += st.result.percentage;
      if (st.result.resultStatus === 'Pass') passed += 1;
      if (st.result.resultStatus === 'Fail') failed += 1;
      if (st.position === 1 && !topperScore) {
        topperName = stu.fullName;
        topperScore = `${st.result.totalObtained}/${st.result.totalMax} (${st.result.percentage.toFixed(1)}%)`;
      }
    });

    const passRate = entered > 0 ? Math.round((passed / entered) * 100) : 0;
    const avgPct = entered > 0 ? Math.round((pctSum / entered) * 10) / 10 : 0;
    return { entered, passed, failed, passRate, avgPct, topperName, topperScore };
  }, [sortedReportStudents, reportStandings]);

  const handleSchoolLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLogoError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateSchoolLogoFile({ type: file.type, size: file.size });
    if (!validation.valid) {
      setLogoError(validation.error || 'Invalid logo file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        await updateSchoolLogo(reader.result);
        showToast('School logo saved for official report cards.');
      }
    };
    reader.readAsDataURL(file);
  };

  // Access check: Only active SMS members / admins / teachers / super admin
  const isParentOnly = currentUserProfile?.role !== 'admin' &&
    currentUserProfile?.role !== 'principal' &&
    currentUserProfile?.role !== 'super-admin' &&
    currentUserProfile?.role !== 'teacher';

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200">
      {/* Main Screen Content (hidden cleanly on print when modal is open) */}
      <div className={reportStudentsForPrint || isPaperModalOpen ? 'no-print space-y-6' : 'space-y-6'}>
        {/* Header Banner */}
        <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-5 shadow-xs">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#7F1D1D]/10 dark:bg-[#C2410C]/20 text-[#7F1D1D] dark:text-[#FCA5A5] flex items-center justify-center shrink-0 border border-[#7F1D1D]/20">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                    Exams &amp; Student Results
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FEE2E2] dark:bg-[#3F1014]/70 text-[#7F1D1D] dark:text-[#FCA5A5] border border-[#FECACA] dark:border-[#7F1D1D]/60">
                    {activeSchool.name || 'School Academics'}
                  </span>
                  {!canManageExams && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>Teacher Scope: Assigned Classes</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-0.5">
                  Configure examinations, record student marks per subject, compute class positions, and print official A4 Report Cards.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canAccessSchoolAiContent && !isSuperAdmin && !isReadOnlyImpersonation && (
                <button
                  type="button"
                  onClick={() => {
                    setPaperGeneratorExamId(selectedExamId || exams[0]?.id);
                    setActiveTab('papers');
                  }}
                  className="px-4 py-2 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-xl text-xs font-bold shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate Question Paper with AI</span>
                </button>
              )}
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="px-3.5 py-2 bg-[#F3EFEA] hover:bg-[#E7E0D4] dark:bg-[#2C1215] dark:hover:bg-[#4A1C20] text-[#44403C] dark:text-[#FAF8F5] rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  ← Back to Command Center
                </button>
              )}
            </div>
          </div>

          {/* Super Admin School Switcher */}
          {isSuperAdmin && registeredSchools.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-[#57534E] dark:text-[#E7E0D4]">
                <Building className="w-4 h-4 text-[#7F1D1D] shrink-0" />
                <span className="font-semibold">Super Admin School Context:</span>
              </div>
              <select
                value={activeSchool.id}
                onChange={(e) => {
                  const chosen = registeredSchools.find((s) => s.id === e.target.value);
                  if (chosen) {
                    setActiveSchool(chosen);
                    refreshActiveSchoolClasses(chosen.id);
                  }
                }}
                className="sm:w-96 px-3 py-2 text-xs rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5] font-semibold"
              >
                {registeredSchools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (SEMIS: {s.semisCode})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Feedback Toast */}
          {feedbackBanner && (
            <div
              className={`mt-4 px-4 py-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 border ${
                feedbackBanner.type === 'error'
                  ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {feedbackBanner.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                )}
                <span>{feedbackBanner.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackBanner(null)}
                className="p-0.5 hover:opacity-75 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Tabs Navigation */}
          <div className="mt-5 flex flex-wrap gap-2">
            {canManageExams && (
              <button
                type="button"
                onClick={() => setActiveTab('setup')}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                  activeTab === 'setup'
                    ? 'bg-[#7F1D1D] text-white shadow-sm'
                    : 'bg-[#F3EFEA] dark:bg-[#2C1215] text-[#57534E] dark:text-[#E7E0D4] hover:bg-[#E7E0D4] dark:hover:bg-[#4A1C20]'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>1. Exam Setup (Admin)</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('marks')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'marks'
                  ? 'bg-[#7F1D1D] text-white shadow-sm'
                  : 'bg-[#F3EFEA] dark:bg-[#2C1215] text-[#57534E] dark:text-[#E7E0D4] hover:bg-[#E7E0D4] dark:hover:bg-[#4A1C20]'
              }`}
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>{canManageExams ? '2. Marks Entry' : '1. Enter Class Marks'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reports')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'reports'
                  ? 'bg-[#7F1D1D] text-white shadow-sm'
                  : 'bg-[#F3EFEA] dark:bg-[#2C1215] text-[#57534E] dark:text-[#E7E0D4] hover:bg-[#E7E0D4] dark:hover:bg-[#4A1C20]'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>{canManageExams ? '3. Report Cards & Positions' : '2. Report Cards & Results'}</span>
            </button>
            {canAccessSchoolAiContent && !isSuperAdmin && !isReadOnlyImpersonation && (
              <button
                type="button"
                onClick={() => setActiveTab('papers')}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                  activeTab === 'papers'
                    ? 'bg-[#7F1D1D] text-white shadow-sm'
                    : 'bg-[#F3EFEA] dark:bg-[#2C1215] text-[#57534E] dark:text-[#E7E0D4] hover:bg-[#E7E0D4] dark:hover:bg-[#4A1C20]'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {canManageExams ? '4. AI Question Papers' : '3. AI Question Papers'} ({filteredQuestionPapersForUser.length})
                </span>
              </button>
            )}
          </div>
        </div>

        {/* ================================================================= */}
        {/* TAB 1: EXAM SETUP (ADMIN ONLY) */}
        {/* ================================================================= */}
        {activeTab === 'setup' && (
          !canManageExams ? (
            <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-rose-200 dark:border-rose-800 rounded-2xl p-8 text-center space-y-2">
              <ShieldAlert className="w-8 h-8 text-rose-500 mx-auto" />
              <h3 className="text-base font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                Administrator Access Required
              </h3>
              <p className="text-xs text-[#57534E] dark:text-[#D6CCC2]">
                Only School Administrators or Principals can create or modify exams. Teachers can enter marks for assigned classes under &ldquo;Enter Class Marks&rdquo;.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Create / Edit Exam Form */}
              <form
                onSubmit={handleSaveExam}
                className="lg:col-span-7 bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-6 space-y-5 shadow-xs"
              >
                <div className="flex items-center justify-between border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] pb-3">
                  <div>
                    <h2 className="text-base font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                      {editingExamId ? 'Edit Examination Scheme' : 'Create New Examination'}
                    </h2>
                    <p className="text-xs text-[#57534E] dark:text-[#D6CCC2]">
                      Define term title, participating classes, and subject marks breakdown.
                    </p>
                  </div>
                  {editingExamId && (
                    <button
                      type="button"
                      onClick={resetExamForm}
                      className="text-xs font-semibold text-[#57534E] hover:text-[#1C1917] dark:hover:text-[#FAF8F5] cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                {/* Title & Term */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                      Exam Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={examTitle}
                      onChange={(e) => setExamTitle(e.target.value)}
                      placeholder="e.g., First Term 2026"
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                      Exam Term / Category
                    </label>
                    <select
                      value={termType}
                      onChange={(e) => setTermType(e.target.value as ExamTermType)}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5]"
                    >
                      <option value="First Term">First Term</option>
                      <option value="Mid Term">Mid Term</option>
                      <option value="Annual">Annual Examination</option>
                      <option value="Pre-Board">Pre-Board / Mock</option>
                      <option value="Monthly Test">Monthly Assessment</option>
                    </select>
                  </div>
                </div>

                {/* Year, Status & Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                      Academic Year
                    </label>
                    <input
                      type="text"
                      value={academicYear}
                      onChange={(e) => setAcademicYear(e.target.value)}
                      placeholder="2025-2026"
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                      Exam Status
                    </label>
                    <select
                      value={examStatus}
                      onChange={(e) => setExamStatus(e.target.value as ExamStatus)}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5]"
                    >
                      <option value="published">Published (Active Marks Entry)</option>
                      <option value="draft">Draft (Setup Only)</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                      Start Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5]"
                    />
                  </div>
                </div>

                {/* Class Selector Checkboxes */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#44403C] dark:text-[#E7E0D4]">
                      Select Classes Included in Exam <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setSelectedExamClassIds(classes.map((c) => c.id))}
                        className="text-[#7F1D1D] dark:text-[#FCA5A5] font-semibold hover:underline cursor-pointer"
                      >
                        Select All ({classes.length})
                      </button>
                      <span className="text-[#E7E0D4]">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedExamClassIds([])}
                        className="text-[#57534E] hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  {loadingClasses ? (
                    <p className="text-xs text-[#78716C]">Loading classes...</p>
                  ) : classes.length === 0 ? (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                      No classes found in {activeSchool.name}. Please add classes in &ldquo;Classes &amp; Sections&rdquo; first.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {classes.map((cls) => {
                        const checked = selectedExamClassIds.includes(cls.id);
                        return (
                          <button
                            key={cls.id}
                            type="button"
                            onClick={() => handleToggleExamClass(cls.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                              checked
                                ? 'bg-[#7F1D1D] text-white border-[#7F1D1D] shadow-xs'
                                : 'bg-[#FAF8F5] dark:bg-[#2C1215] text-[#44403C] dark:text-[#E7E0D4] border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]'
                            }`}
                          >
                            {cls.grade} - {cls.section}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Subjects & Total Marks Builder */}
                <div className="space-y-3 pt-2 border-t border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-bold text-[#1C1917] dark:text-[#FAF8F5] uppercase tracking-wider">
                        Subjects &amp; Maximum Marks ({examSubjects.length})
                      </h3>
                      <p className="text-[11px] text-[#57534E] dark:text-[#D6CCC2]">
                        Total Combined Marks:{' '}
                        <strong className="text-[#7F1D1D] dark:text-[#FCA5A5]">
                          {examSubjects.reduce((sum, s) => sum + (Number(s.totalMarks) || 0), 0)}
                        </strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleLoadSeldPresets}
                      className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[11px] font-bold flex items-center gap-1.5 hover:bg-amber-100 transition cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Load SELD 7-Subject Scheme</span>
                    </button>
                  </div>

                  {/* Subject List */}
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {examSubjects.map((subj, idx) => (
                      <div
                        key={subj.id}
                        className="grid grid-cols-12 gap-2 items-center bg-[#FAF8F5] dark:bg-[#2C1215]/70 p-2 rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]"
                      >
                        <div className="col-span-6">
                          <input
                            type="text"
                            value={subj.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              setExamSubjects((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, name: val } : item))
                              );
                            }}
                            placeholder="Subject Name"
                            className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FFFDF9] dark:bg-[#211415] text-[#1C1917] dark:text-[#FAF8F5]"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            min={1}
                            max={1000}
                            value={subj.totalMarks}
                            onChange={(e) => {
                              const num = Number(e.target.value) || 0;
                              setExamSubjects((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, totalMarks: num } : item
                                )
                              );
                            }}
                            title="Total Marks"
                            className="w-full px-2 py-1.5 text-xs font-mono rounded-lg border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FFFDF9] dark:bg-[#211415] text-[#1C1917] dark:text-[#FAF8F5] text-center"
                          />
                          <span className="text-[9px] text-[#78716C] block text-center">Max</span>
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            min={0}
                            max={subj.totalMarks}
                            value={subj.passingMarks}
                            onChange={(e) => {
                              const num = Number(e.target.value) || 0;
                              setExamSubjects((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, passingMarks: num } : item
                                )
                              );
                            }}
                            title="Passing Marks"
                            className="w-full px-2 py-1.5 text-xs font-mono rounded-lg border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FFFDF9] dark:bg-[#211415] text-[#1C1917] dark:text-[#FAF8F5] text-center"
                          />
                          <span className="text-[9px] text-[#78716C] block text-center">Pass</span>
                        </div>
                        <div className="col-span-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() =>
                              setExamSubjects((prev) => prev.filter((_, i) => i !== idx))
                            }
                            title="Remove subject"
                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Quick Add Subject Row */}
                  <div className="grid grid-cols-12 gap-2 items-end pt-1">
                    <div className="col-span-6">
                      <label className="text-[10px] font-semibold text-[#57534E] block mb-1">
                        Add Subject
                      </label>
                      <input
                        type="text"
                        value={newSubjName}
                        onChange={(e) => setNewSubjName(e.target.value)}
                        placeholder="e.g., Chemistry / Computer Science"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5]"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-semibold text-[#57534E] block mb-1">
                        Total Marks
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        value={newSubjTotal}
                        onChange={(e) => setNewSubjTotal(Number(e.target.value))}
                        className="w-full px-2 py-2 text-xs font-mono rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5] text-center"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-semibold text-[#57534E] block mb-1">
                        Pass Marks
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={newSubjTotal}
                        value={newSubjPassing}
                        onChange={(e) => setNewSubjPassing(Number(e.target.value))}
                        className="w-full px-2 py-2 text-xs font-mono rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5] text-center"
                      />
                    </div>
                    <div className="col-span-2">
                      <button
                        type="button"
                        onClick={handleAddSubjectRow}
                        className="w-full py-2 bg-[#3F1014] hover:bg-[#58181D] dark:bg-[#3F1014] dark:hover:bg-slate-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSavingExam}
                  className="w-full py-3 bg-[#7F1D1D] hover:bg-[#651414] text-white rounded-xl text-sm font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {isSavingExam
                      ? 'Saving Exam...'
                      : editingExamId
                      ? 'Update Exam & Subjects'
                      : 'Create Exam & Activate Marks Entry'}
                  </span>
                </button>
              </form>

              {/* Right Column: Configured Exams List */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-5 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                      Configured Exams ({exams.length})
                    </h2>
                    <span className="text-[11px] text-[#57534E]">Multi-tenant isolated</span>
                  </div>

                  {exams.length === 0 ? (
                    <div className="p-8 text-center text-xs text-[#78716C] border border-dashed border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl">
                      No exams configured yet. Create your first exam (e.g., &ldquo;First Term 2026&rdquo;) on the left.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {exams.map((ex) => {
                        const maxSum = (ex.subjects || []).reduce(
                          (acc, s) => acc + (Number(s.totalMarks) || 0),
                          0
                        );
                        return (
                          <div
                            key={ex.id}
                            className="p-4 rounded-2xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5]/70 dark:bg-[#2C1215]/50 space-y-2.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                                    {ex.title}
                                  </h3>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                      ex.status === 'published'
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                    }`}
                                  >
                                    {ex.status}
                                  </span>
                                </div>
                                <div className="text-[11px] text-[#57534E] dark:text-[#D6CCC2] mt-0.5">
                                  {ex.termType} · Session {ex.academicYear} · {ex.subjects.length} Subjects ({maxSum} Marks)
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleEditExam(ex)}
                                  title="Edit Exam"
                                  className="p-1.5 text-[#57534E] hover:text-[#651414] hover:bg-[#FEE2E2] dark:hover:bg-[#58181D]/60 rounded-lg transition cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm(`Delete "${ex.title}" and its saved marks?`)) {
                                      deleteExam(ex.id);
                                      showToast(`Exam "${ex.title}" deleted.`);
                                    }
                                  }}
                                  title="Delete Exam"
                                  className="p-1.5 text-[#78716C] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Subjects chips */}
                            <div className="flex flex-wrap gap-1.5">
                              {ex.subjects.map((s) => (
                                <span
                                  key={s.id}
                                  className="px-2 py-0.5 rounded-md bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-[10px] font-medium text-[#44403C] dark:text-[#E7E0D4]"
                                >
                                  {s.name} ({s.totalMarks})
                                </span>
                              ))}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedExamId(ex.id);
                                  setActiveTab('marks');
                                }}
                                className="flex-1 py-1.5 px-3 bg-[#FEF2F2] hover:bg-[#FEE2E2] dark:bg-[#3F1014]/60 dark:hover:bg-[#58181D]/60 text-[#7F1D1D] dark:text-[#FCA5A5] text-xs font-bold rounded-xl transition cursor-pointer"
                              >
                                Enter Marks →
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedExamId(ex.id);
                                  setActiveTab('reports');
                                }}
                                className="flex-1 py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-xl transition cursor-pointer"
                              >
                                Report Cards →
                              </button>
                              {canAccessSchoolAiContent && !isSuperAdmin && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPaperGeneratorExamId(ex.id);
                                    setActiveTab('papers');
                                  }}
                                  className="w-full py-1.5 px-3 bg-[#FFF7ED] hover:bg-[#FFEDD5] dark:bg-[#7C2D12]/50 dark:hover:bg-[#9A3412]/50 text-[#C2410C] dark:text-[#FDBA74] text-xs font-bold rounded-xl transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>
                                    AI Papers ({getAttachedQuestionPapersForExam(filteredQuestionPapersForUser, ex.id).length} Attached)
                                  </span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        )}

        {/* ================================================================= */}
        {/* TAB 2: MARKS ENTRY (TEACHERS ASSIGNED CLASSES + ADMIN) */}
        {/* ================================================================= */}
        {activeTab === 'marks' && (
          <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-6 space-y-5 shadow-xs">
            {/* Selector Strip */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] pb-5">
              <div>
                <label className="block text-xs font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1.5">
                  Select Examination
                </label>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5]"
                >
                  {exams.length === 0 && <option value="">No exams created yet</option>}
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.title} ({ex.academicYear}) — {ex.subjects.length} Subjects
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1.5">
                  Select Class &amp; Section {userRole === 'teacher' && '(Assigned Only)'}
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5]"
                >
                  {accessibleClassesForExam.length === 0 && (
                    <option value="">No eligible classes assigned</option>
                  )}
                  {accessibleClassesForExam.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.grade} - {cls.section} ({cls.medium})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleAutoFillRemarks}
                  disabled={!activeExam || studentsInSelectedClass.length === 0}
                  className="px-3.5 py-2.5 bg-[#F3EFEA] hover:bg-[#E7E0D4] dark:bg-[#2C1215] dark:hover:bg-[#4A1C20] text-[#44403C] dark:text-[#FAF8F5] rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  Auto-Fill Remarks
                </button>
                <button
                  type="button"
                  onClick={handleSaveAllClassMarks}
                  disabled={
                    isSavingMarks ||
                    !activeExam ||
                    !selectedClassId ||
                    studentsInSelectedClass.length === 0 ||
                    !isTeacherAuthorizedForSelectedClass ||
                    isParentOnly
                  }
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {isSavingMarks
                      ? 'Saving...'
                      : hasUnsavedDraft
                      ? 'Save Unsaved Marks*'
                      : 'Save Class Marks'}
                  </span>
                </button>
              </div>
            </div>

            {/* Guard messages */}
            {!activeExam ? (
              <div className="p-10 text-center text-xs text-[#78716C]">
                No exams configured yet. {canManageExams ? 'Go to "1. Exam Setup" to create an exam.' : 'Ask your School Administrator to create an exam schedule.'}
              </div>
            ) : accessibleClassesForExam.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-1.5">
                <Lock className="w-6 h-6 text-amber-600 mx-auto" />
                <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  No Assigned Classes Linked to &ldquo;{activeExam.title}&rdquo;
                </h3>
                <p className="text-xs text-amber-700 dark:text-amber-300 max-w-lg mx-auto">
                  Teachers can only enter marks for classes assigned to their profile by the School Administrator.
                </p>
              </div>
            ) : studentsInSelectedClass.length === 0 ? (
              <div className="p-10 text-center text-xs text-[#78716C]">
                No active enrolled students found in {selectedClassObj?.grade} - {selectedClassObj?.section}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b-2 border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215]/80 text-[#57534E] dark:text-[#E7E0D4]">
                      <th className="py-3 px-3 font-bold whitespace-nowrap">GR #</th>
                      <th className="py-3 px-3 font-bold min-w-[160px]">Student Name</th>
                      {activeExam.subjects.map((subj) => (
                        <th key={subj.id} className="py-3 px-2 font-bold text-center min-w-[105px]">
                          <div>{subj.name}</div>
                          <div className="text-[10px] font-normal text-[#78716C]">
                            Max {subj.totalMarks} · Pass {subj.passingMarks}
                          </div>
                        </th>
                      ))}
                      <th className="py-3 px-3 font-bold text-center whitespace-nowrap">Total</th>
                      <th className="py-3 px-2 font-bold text-center whitespace-nowrap">% / Grade</th>
                      <th className="py-3 px-2 font-bold text-center whitespace-nowrap">Pos</th>
                      <th className="py-3 px-3 font-bold min-w-[190px]">Teacher&apos;s Remarks</th>
                      <th className="py-3 px-2 font-bold text-right">Card</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E0D4] dark:divide-[rgba(255,253,249,0.10)]">
                    {studentsInSelectedClass.map((stu) => {
                      const entry = marksDraft[stu.id] || {
                        subjectMarks: {},
                        absentSubjects: [],
                        remarks: '',
                      };
                      const standing = liveClassStandings.get(stu.id);
                      const computed =
                        standing?.result ||
                        computeStudentExamResult(
                          activeExam,
                          entry.subjectMarks,
                          entry.absentSubjects
                        );

                      return (
                        <tr
                          key={stu.id}
                          className="hover:bg-[#FAF8F5]/70 dark:hover:bg-[#3F1014]/40 transition-colors"
                        >
                          <td className="py-2.5 px-3 font-mono font-bold text-[#44403C] dark:text-[#E7E0D4] whitespace-nowrap">
                            {stu.grNumber}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                              {stu.fullName}
                            </div>
                            <div className="text-[10px] text-[#78716C]">S/D/o {stu.fatherName}</div>
                          </td>
                          {activeExam.subjects.map((subj) => {
                            const isAbsent = entry.absentSubjects.includes(subj.id);
                            const val = entry.subjectMarks[subj.id];
                            const isFailMark =
                              !isAbsent &&
                              val !== null &&
                              val !== undefined &&
                              val < subj.passingMarks;

                            return (
                              <td key={subj.id} className="py-2 px-1.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <input
                                    type="number"
                                    min={0}
                                    max={subj.totalMarks}
                                    disabled={isAbsent || !isTeacherAuthorizedForSelectedClass || isParentOnly}
                                    value={isAbsent || val === null || val === undefined ? '' : val}
                                    onChange={(e) => handleMarkChange(stu.id, subj, e.target.value)}
                                    placeholder={isAbsent ? 'AB' : '—'}
                                    className={`w-16 px-2 py-1.5 text-center font-mono font-bold rounded-lg border text-xs ${
                                      isAbsent
                                        ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-700 text-rose-600'
                                        : isFailMark
                                        ? 'bg-rose-50/60 dark:bg-rose-950/40 border-rose-400 text-rose-700 dark:text-rose-300'
                                        : 'bg-[#FFFDF9] dark:bg-[#2C1215] border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-[#1C1917] dark:text-[#FAF8F5]'
                                    }`}
                                  />
                                  <button
                                    type="button"
                                    disabled={!isTeacherAuthorizedForSelectedClass || isParentOnly}
                                    onClick={() => handleToggleAbsent(stu.id, subj.id)}
                                    title={isAbsent ? 'Mark Present' : 'Mark Absent'}
                                    className={`px-1.5 py-1 rounded text-[10px] font-bold border transition cursor-pointer ${
                                      isAbsent
                                        ? 'bg-rose-600 text-white border-rose-600'
                                        : 'bg-[#F3EFEA] dark:bg-[#2C1215] text-[#57534E] border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] hover:bg-[#E7E0D4]'
                                    }`}
                                  >
                                    AB
                                  </button>
                                </div>
                              </td>
                            );
                          })}

                          <td className="py-2.5 px-3 text-center font-mono font-bold whitespace-nowrap text-[#1C1917] dark:text-[#FAF8F5]">
                            {computed.hasEnteredAnyMarks
                              ? `${computed.totalObtained} / ${computed.totalMax}`
                              : '—'}
                          </td>
                          <td className="py-2.5 px-2 text-center whitespace-nowrap">
                            {computed.hasEnteredAnyMarks ? (
                              <div className="inline-flex flex-col items-center">
                                <span className="font-mono font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                                  {computed.percentage.toFixed(1)}%
                                </span>
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                    computed.resultStatus === 'Pass'
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                      : computed.resultStatus === 'Fail'
                                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                      : 'bg-[#F3EFEA] text-[#57534E]'
                                  }`}
                                >
                                  {computed.overallGrade} · {computed.resultStatus}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[#78716C]">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center font-bold text-[#7F1D1D] dark:text-[#FCA5A5] whitespace-nowrap">
                            {standing?.positionLabel || '—'}
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={entry.remarks}
                              disabled={!isTeacherAuthorizedForSelectedClass || isParentOnly}
                              onChange={(e) => handleRemarksChange(stu.id, e.target.value)}
                              placeholder="Teacher's remarks..."
                              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FFFDF9] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5]"
                            />
                          </td>
                          <td className="py-2 px-2 text-right">
                            <button
                              type="button"
                              onClick={() => setReportStudentsForPrint([stu])}
                              title="Preview Report Card"
                              className="p-1.5 bg-[#FEF2F2] hover:bg-[#FEE2E2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5] rounded-lg transition cursor-pointer"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: AI QUESTION PAPERS & SMART LESSON CONTEXT */}
        {/* ================================================================= */}
        {activeTab === 'papers' && (
          <ExamQuestionPapersSection
            exams={exams}
            initialExamId={paperGeneratorExamId || selectedExamId}
            onPaperPreviewModalChange={setIsPaperModalOpen}
          />
        )}

        {/* ================================================================= */}
        {/* TAB 3: REPORT CARDS & CLASS GAZETTE */}
        {/* ================================================================= */}
        {activeTab === 'reports' && (
          <div className="space-y-5">
            {/* Controls & Logo Uploader */}
            <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1.5">
                    Select Examination
                  </label>
                  <select
                    value={selectedExamId}
                    onChange={(e) => setSelectedExamId(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs font-semibold rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5]"
                  >
                    {exams.length === 0 && <option value="">No exams available</option>}
                    {exams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.title} ({ex.academicYear})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1.5">
                    Select Class &amp; Section
                  </label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs font-semibold rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5]"
                  >
                    {accessibleClassesForExam.length === 0 && (
                      <option value="">No classes accessible</option>
                    )}
                    {accessibleClassesForExam.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.grade} - {cls.section}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1.5">
                    Sort Result Gazette By
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'position' | 'gr')}
                    className="w-full px-3 py-2.5 text-xs font-semibold rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5]"
                  >
                    <option value="position">Class Position (1st, 2nd, 3rd...)</option>
                    <option value="gr">GR / Admission Number</option>
                  </select>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  {canManageExams && (
                    <label className="px-3 py-2.5 bg-[#F3EFEA] hover:bg-[#E7E0D4] dark:bg-[#2C1215] dark:hover:bg-[#4A1C20] text-[#44403C] dark:text-[#FAF8F5] rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{activeSchool.logoUrl ? 'Change Logo' : 'School Logo'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleSchoolLogoUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                  <button
                    type="button"
                    disabled={!activeExam || sortedReportStudents.length === 0}
                    onClick={() => setReportStudentsForPrint(sortedReportStudents)}
                    className="px-4 py-2.5 bg-[#7F1D1D] hover:bg-[#651414] text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print All Report Cards ({sortedReportStudents.length})</span>
                  </button>
                </div>
              </div>

              {logoError && (
                <div className="text-xs text-rose-600 font-semibold">{logoError}</div>
              )}

              {/* Summary KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                <div className="p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#2C1215]/70 border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#57534E] uppercase">
                    <span>Results Entered</span>
                    <Users className="w-4 h-4 text-[#7F1D1D]" />
                  </div>
                  <div className="text-xl font-black text-[#1C1917] dark:text-[#FAF8F5] mt-1">
                    {gazetteSummary.entered} / {sortedReportStudents.length}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center justify-between text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">
                    <span>Pass Percentage</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
                    {gazetteSummary.passRate}% ({gazetteSummary.passed} Passed)
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FFF7ED]/70 dark:bg-[#7C2D12]/30 border border-[#FED7AA] dark:border-[#C2410C]/50">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#C2410C] dark:text-[#FDBA74] uppercase">
                    <span>Class Average</span>
                    <TrendingUp className="w-4 h-4 text-[#C2410C]" />
                  </div>
                  <div className="text-xl font-black text-[#C2410C] dark:text-[#FDBA74] mt-1">
                    {gazetteSummary.avgPct}%
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center justify-between text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase">
                    <span>1st Position</span>
                    <Trophy className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-sm font-black text-amber-900 dark:text-amber-200 mt-1 truncate">
                    {gazetteSummary.topperName}
                  </div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-400 font-mono">
                    {gazetteSummary.topperScore || 'Pending'}
                  </div>
                </div>
              </div>
            </div>

            {/* Results Table */}
            <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl overflow-hidden shadow-xs">
              {!activeExam || sortedReportStudents.length === 0 ? (
                <div className="p-10 text-center text-xs text-[#78716C]">
                  Select an exam and class with students to view results and print Report Cards.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#FAF8F5] dark:bg-[#2C1215]/80 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-[#57534E] dark:text-[#E7E0D4]">
                        <th className="py-3 px-4 font-bold">Pos</th>
                        <th className="py-3 px-4 font-bold">GR #</th>
                        <th className="py-3 px-4 font-bold">Student Name</th>
                        <th className="py-3 px-4 font-bold text-right">Marks Obtained</th>
                        <th className="py-3 px-4 font-bold text-center">Percentage</th>
                        <th className="py-3 px-4 font-bold text-center">Grade</th>
                        <th className="py-3 px-4 font-bold text-center">Result</th>
                        <th className="py-3 px-4 font-bold">Teacher&apos;s Remarks</th>
                        <th className="py-3 px-4 font-bold text-right">Report Card</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7E0D4] dark:divide-[rgba(255,253,249,0.10)]">
                      {sortedReportStudents.map((stu) => {
                        const standing = reportStandings.get(stu.id);
                        const result = standing?.result;
                        const remarks =
                          standing?.marksRecord?.remarks || result?.suggestedRemark || '—';

                        return (
                          <tr key={stu.id} className="hover:bg-[#FAF8F5]/70 dark:hover:bg-[#3F1014]/40">
                            <td className="py-3 px-4 font-black text-[#7F1D1D] dark:text-[#FCA5A5] whitespace-nowrap">
                              {standing?.position ? (
                                <span className="px-2.5 py-1 rounded-full bg-[#FEF2F2] dark:bg-[#3F1014]/60 border border-[#FECACA] dark:border-[#7F1D1D]/60 text-[11px]">
                                  {standing.positionLabel}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-[#44403C] dark:text-[#E7E0D4]">
                              {stu.grNumber}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                                {stu.fullName}
                              </div>
                              <div className="text-[11px] text-[#78716C]">
                                Father: {stu.fatherName}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                              {result?.hasEnteredAnyMarks
                                ? `${result.totalObtained} / ${result.totalMax}`
                                : '—'}
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-bold">
                              {result?.hasEnteredAnyMarks ? `${result.percentage.toFixed(2)}%` : '—'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-2 py-0.5 rounded bg-[#F3EFEA] dark:bg-[#2C1215] font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                                {result?.overallGrade || '—'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  result?.resultStatus === 'Pass'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : result?.resultStatus === 'Fail'
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                    : 'bg-[#F3EFEA] text-[#57534E]'
                                }`}
                              >
                                {result?.resultStatus || 'Pending'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-[#57534E] dark:text-[#E7E0D4] max-w-xs truncate">
                              {remarks}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setReportStudentsForPrint([stu]);
                                  if (activeExam) {
                                    onOpenReportCardRoute?.(activeExam.id, stu.id);
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#7F1D1D] hover:bg-[#651414] text-white font-bold text-[11px] rounded-xl transition cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Print Card</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* PRINTABLE A4 REPORT CARD(S) MODAL (.printable-a4-sheet) */}
      {/* =================================================================== */}
      {reportStudentsForPrint && activeExam && (
        <ReportPrintModalShell
          title={
            reportStudentsForPrint.length === 1
              ? `Official Report Card — ${reportStudentsForPrint[0].fullName} (${activeExam.title})`
              : `Class Result Cards Batch (${reportStudentsForPrint.length} Students — ${activeExam.title})`
          }
          printLabel={
            reportStudentsForPrint.length === 1
              ? 'Print Report Card / Save as PDF'
              : `Print All (${reportStudentsForPrint.length} Report Cards)`
          }
          onPrint={triggerPrintDocument}
          onClose={() => {
            setReportStudentsForPrint(null);
            if (initialReportStudentId || onOpenReportCardRoute) {
              onOpenReportCardRoute?.(null, null);
            }
          }}
        >
          <div className="printable-a4-sheet bg-white text-[#1C1917] space-y-8">
            {reportStudentsForPrint.map((stu, idx) => {
              const standing =
                liveClassStandings.get(stu.id) || reportStandings.get(stu.id);
              const result =
                standing?.result ||
                computeStudentExamResult(
                  activeExam,
                  marksDraft[stu.id]?.subjectMarks || {},
                  marksDraft[stu.id]?.absentSubjects || []
                );
              const teacherRemarks =
                marksDraft[stu.id]?.remarks ||
                standing?.marksRecord?.remarks ||
                result.suggestedRemark ||
                'Consistent attendance and steady classroom participation encouraged.';

              return (
                <div
                  key={stu.id}
                  className={`bg-white text-[#1C1917] p-6 sm:p-8 border-2 border-[#1C1917] rounded-xl print-break-inside-avoid ${
                    idx < reportStudentsForPrint.length - 1 ? 'print-page-break-after mb-8' : ''
                  }`}
                >
                  {/* School Letterhead Header */}
                  <div className="flex items-center justify-between gap-4 border-b-2 border-[#1C1917] pb-4">
                    <div className="flex items-center gap-4">
                      {activeSchool.logoUrl ? (
                        <img
                          src={activeSchool.logoUrl}
                          alt="School Logo"
                          className="w-16 h-16 object-contain rounded-xl border border-[#D6CCC2] bg-white p-1 shrink-0"
                        />
                      ) : (
                        <DefaultSchoolCrest />
                      )}
                      <div>
                        <div className="text-[10px] font-bold tracking-widest text-emerald-800 uppercase">
                          GOVERNMENT OF SINDH · SCHOOL EDUCATION &amp; LITERACY DEPARTMENT
                        </div>
                        <h2 className="text-xl font-black text-[#1C1917] uppercase leading-tight">
                          {activeSchool.name || 'Govt. Comprehensive High School'}
                        </h2>
                        <div className="text-xs text-[#57534E] font-medium mt-0.5">
                          SEMIS Code: <strong className="font-mono text-[#1C1917]">{activeSchool.semisCode || '403020101'}</strong> ·{' '}
                          {activeSchool.taluka ? `${activeSchool.taluka}, ` : ''}
                          {activeSchool.district || 'Sindh'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="px-3 py-1 rounded-md bg-[#2C1215] text-white text-[10px] font-black uppercase tracking-wider inline-block">
                        PROGRESS REPORT CARD
                      </div>
                      <div className="text-sm font-black text-[#7F1D1D] mt-1">
                        {activeExam.title}
                      </div>
                      <div className="text-[11px] text-[#57534E]">
                        Session: {activeExam.academicYear} · Issued: {new Date().toLocaleDateString('en-GB')}
                      </div>
                    </div>
                  </div>

                  {/* Student Profile Block */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5 p-4 bg-slate-50 rounded-xl border border-[#E7E0D4] text-xs">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-[#57534E] block">
                        Student Name
                      </span>
                      <strong className="text-sm text-[#1C1917]">{stu.fullName}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-[#57534E] block">
                        Father&apos;s Name
                      </span>
                      <strong className="text-[#1C1917]">{stu.fatherName}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-[#57534E] block">
                        GR Number
                      </span>
                      <strong className="font-mono text-[#1C1917]">{stu.grNumber}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-[#57534E] block">
                        Class &amp; Section
                      </span>
                      <strong className="text-[#1C1917]">
                        {stu.grade || selectedClassObj?.grade} - {stu.section || selectedClassObj?.section || 'General'}
                      </strong>
                    </div>
                  </div>

                  {/* Subject-Wise Marks Breakdown Table */}
                  <table className="w-full text-xs border-collapse border border-[#C2B7A8]">
                    <thead>
                      <tr className="bg-slate-100 text-[#1C1917]">
                        <th className="py-2 px-3 border border-[#C2B7A8] text-left">#</th>
                        <th className="py-2 px-3 border border-[#C2B7A8] text-left">Subject</th>
                        <th className="py-2 px-3 border border-[#C2B7A8] text-center">Total Marks</th>
                        <th className="py-2 px-3 border border-[#C2B7A8] text-center">Passing Marks</th>
                        <th className="py-2 px-3 border border-[#C2B7A8] text-center">Marks Obtained</th>
                        <th className="py-2 px-3 border border-[#C2B7A8] text-center">Percentage</th>
                        <th className="py-2 px-3 border border-[#C2B7A8] text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.subjectRows.map((row, rIdx) => (
                        <tr key={row.subjectId}>
                          <td className="py-2 px-3 border border-[#D6CCC2] font-mono text-[#57534E]">
                            {rIdx + 1}
                          </td>
                          <td className="py-2 px-3 border border-[#D6CCC2] font-bold text-[#1C1917]">
                            {row.subjectName}
                          </td>
                          <td className="py-2 px-3 border border-[#D6CCC2] text-center font-mono">
                            {row.totalMarks}
                          </td>
                          <td className="py-2 px-3 border border-[#D6CCC2] text-center font-mono text-[#57534E]">
                            {row.passingMarks}
                          </td>
                          <td className="py-2 px-3 border border-[#D6CCC2] text-center font-mono font-bold text-[#1C1917]">
                            {row.isAbsent ? 'AB (Absent)' : row.obtainedMarks !== null ? row.obtainedMarks : '—'}
                          </td>
                          <td className="py-2 px-3 border border-[#D6CCC2] text-center font-mono">
                            {row.isEntered ? `${row.percentage.toFixed(1)}%` : '—'}
                          </td>
                          <td className="py-2 px-3 border border-[#D6CCC2] text-center font-bold uppercase text-[10px]">
                            <span
                              className={
                                row.status === 'Pass'
                                  ? 'text-emerald-700'
                                  : row.status === 'Fail' || row.status === 'Absent'
                                  ? 'text-rose-700'
                                  : 'text-[#57534E]'
                              }
                            >
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-[#2C1215] text-white font-bold">
                        <td colSpan={2} className="py-2.5 px-3 border border-[#1C1917] uppercase text-[11px]">
                          Grand Aggregate
                        </td>
                        <td className="py-2.5 px-3 border border-[#1C1917] text-center font-mono">
                          {result.totalMax}
                        </td>
                        <td className="py-2.5 px-3 border border-[#1C1917] text-center">—</td>
                        <td className="py-2.5 px-3 border border-[#1C1917] text-center font-mono">
                          {result.hasEnteredAnyMarks ? result.totalObtained : '—'}
                        </td>
                        <td className="py-2.5 px-3 border border-[#1C1917] text-center font-mono">
                          {result.hasEnteredAnyMarks ? `${result.percentage.toFixed(2)}%` : '—'}
                        </td>
                        <td className="py-2.5 px-3 border border-[#1C1917] text-center uppercase">
                          {result.resultStatus}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Key Outcome Boxes */}
                  <div className="grid grid-cols-4 gap-3 mt-5 text-center text-xs">
                    <div className="p-3 rounded-xl border border-[#D6CCC2] bg-slate-50">
                      <span className="text-[10px] font-bold uppercase text-[#57534E] block">
                        Percentage
                      </span>
                      <strong className="text-base font-black text-[#1C1917]">
                        {result.hasEnteredAnyMarks ? `${result.percentage.toFixed(2)}%` : '—'}
                      </strong>
                    </div>
                    <div className="p-3 rounded-xl border border-[#D6CCC2] bg-slate-50">
                      <span className="text-[10px] font-bold uppercase text-[#57534E] block">
                        Grade
                      </span>
                      <strong className="text-base font-black text-[#7F1D1D]">
                        {result.overallGrade}
                      </strong>
                    </div>
                    <div className="p-3 rounded-xl border border-[#D6CCC2] bg-slate-50">
                      <span className="text-[10px] font-bold uppercase text-[#57534E] block">
                        Class Position
                      </span>
                      <strong className="text-base font-black text-emerald-800">
                        {standing?.positionLabel || '—'}
                      </strong>
                    </div>
                    <div className="p-3 rounded-xl border border-[#D6CCC2] bg-slate-50">
                      <span className="text-[10px] font-bold uppercase text-[#57534E] block">
                        Final Result
                      </span>
                      <strong
                        className={`text-base font-black uppercase ${
                          result.resultStatus === 'Pass'
                            ? 'text-emerald-700'
                            : result.resultStatus === 'Fail'
                            ? 'text-rose-700'
                            : 'text-[#57534E]'
                        }`}
                      >
                        {result.resultStatus}
                      </strong>
                    </div>
                  </div>

                  {/* Teacher Remarks */}
                  <div className="mt-4 p-3.5 rounded-xl border border-[#D6CCC2] bg-slate-50 text-xs">
                    <span className="text-[10px] font-bold uppercase text-[#57534E] block mb-1">
                      Class Teacher&apos;s Remarks
                    </span>
                    <p className="font-medium text-[#1C1917] italic">&ldquo;{teacherRemarks}&rdquo;</p>
                  </div>

                  {/* Signature Footer */}
                  <div className="flex items-end justify-between pt-12 text-xs">
                    <div className="text-center">
                      <div className="w-36 border-b border-slate-600 mb-1"></div>
                      <span className="text-[10px] font-bold text-[#57534E] uppercase">
                        Class Teacher Signature
                      </span>
                    </div>
                    <div className="text-center">
                      <div className="w-36 border-b border-slate-600 mb-1"></div>
                      <span className="text-[10px] font-bold text-[#57534E] uppercase">
                        Controller of Exams
                      </span>
                    </div>
                    <div className="text-center">
                      <div className="w-36 border-b border-slate-600 mb-1"></div>
                      <span className="text-[10px] font-bold text-[#57534E] uppercase">
                        Principal / Headmaster
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ReportPrintModalShell>
      )}
    </div>
  );
};
