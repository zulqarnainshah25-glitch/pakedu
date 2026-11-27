import {
  ALL_CLASSES,
  LessonPlanContent,
  SyllabusPreset,
  inferSectionFromClass,
} from '../../../data/syllabusPresets';
import {
  GeneratedQuestionPaper,
  QuestionPaperDifficulty,
  QuestionPaperLanguage,
  computeBalancedMarksDistribution,
} from '../../../utils/questionPaperLogic';
import {
  SchoolLessonPlan,
  SchoolQuestionPaper,
  UserRole,
} from '../types';

const WORD_NUMBERS: Record<string, string> = {
  kg: 'KG',
  katchi: 'KG',
  ece: 'KG',
  nursery: 'KG',
  prep: 'KG',
  one: 'Class 1',
  two: 'Class 2',
  three: 'Class 3',
  four: 'Class 4',
  five: 'Class 5',
  six: 'Class 6',
  seven: 'Class 7',
  eight: 'Class 8',
  nine: 'Class 9',
  ten: 'Class 10',
  eleven: 'Class 11',
  twelve: 'Class 12',
  first: 'Class 1',
  second: 'Class 2',
  third: 'Class 3',
  fourth: 'Class 4',
  fifth: 'Class 5',
  sixth: 'Class 6',
  seventh: 'Class 7',
  eighth: 'Class 8',
  ninth: 'Class 9',
  tenth: 'Class 10',
  eleventh: 'Class 11',
  twelfth: 'Class 12',
  i: 'Class 1',
  ii: 'Class 2',
  iii: 'Class 3',
  iv: 'Class 4',
  v: 'Class 5',
  vi: 'Class 6',
  vii: 'Class 7',
  viii: 'Class 8',
  ix: 'Class 9',
  x: 'Class 10',
  xi: 'Class 11',
  xii: 'Class 12',
  matric: 'Class 10',
  'first year': 'Class 11',
  'second year': 'Class 12',
};

/**
 * Normalizes any SMS class grade string (e.g., "Grade 5", "IX", "KG-A", "Class 9th")
 * into canonical syllabus dataset names ('KG' | 'Class 1' .. 'Class 12').
 */
export function normalizeSmsGradeToSyllabusClassName(rawGrade: string): string {
  const cleaned = (rawGrade || '').trim();
  if (!cleaned) return 'Class 5';

  const exactMatch = ALL_CLASSES.find(
    (c) => c.toLowerCase() === cleaned.toLowerCase()
  );
  if (exactMatch) return exactMatch;

  const lower = cleaned.toLowerCase();
  if (/\b(kg|ece|katchi|nursery|prep)\b/i.test(lower)) {
    return 'KG';
  }

  const numMatch = lower.match(/\b(1[0-2]|[1-9])(?:st|nd|rd|th)?\b/);
  if (numMatch) {
    const n = Number(numMatch[1]);
    if (n >= 1 && n <= 12) return `Class ${n}`;
  }

  for (const [token, mapped] of Object.entries(WORD_NUMBERS)) {
    const regex = new RegExp(`\\b${token}\\b`, 'i');
    if (regex.test(lower)) return mapped;
  }

  return cleaned;
}

/**
 * Filters indexed curriculum syllabus entries for an SMS Class (and optional board/subject)
 * so selecting a class auto-populates matching subjects, chapters, and topics.
 */
export function filterSyllabusPresetsForClass(
  presets: SyllabusPreset[],
  gradeOrClassName: string,
  board?: 'Sindh STBB' | 'Punjab PTB',
  subject?: string
): SyllabusPreset[] {
  const canonicalClass = normalizeSmsGradeToSyllabusClassName(gradeOrClassName);
  const normSubj = (subject || '').trim().toLowerCase();

  return (presets || []).filter((item) => {
    if (!item) return false;
    const itemClass = normalizeSmsGradeToSyllabusClassName(item.className);
    if (itemClass.toLowerCase() !== canonicalClass.toLowerCase()) return false;
    if (board && item.board && item.board.toLowerCase() !== board.toLowerCase()) {
      return false;
    }
    if (normSubj && item.subject.toLowerCase() !== normSubj) {
      return false;
    }
    return true;
  });
}

/**
 * Extracts distinct sorted subjects, chapters, and topics from syllabus presets matching a class.
 */
export function extractSyllabusStructureForClass(
  presets: SyllabusPreset[],
  gradeOrClassName: string,
  board?: 'Sindh STBB' | 'Punjab PTB',
  subject?: string,
  chapter?: string
): {
  canonicalClassName: string;
  curriculumSection: 'Primary' | 'Middle' | 'Secondary' | 'Higher Secondary';
  subjects: string[];
  chapters: string[];
  topics: SyllabusPreset[];
} {
  const canonicalClassName = normalizeSmsGradeToSyllabusClassName(gradeOrClassName);
  const curriculumSection = inferSectionFromClass(canonicalClassName);

  const forClass = filterSyllabusPresetsForClass(presets, canonicalClassName, board);
  const subjects = Array.from(new Set(forClass.map((i) => i.subject).filter(Boolean))).sort();

  const forSubject = subject?.trim()
    ? forClass.filter((i) => i.subject.toLowerCase() === subject.trim().toLowerCase())
    : forClass;
  const chapters = Array.from(new Set(forSubject.map((i) => i.chapter).filter(Boolean)));

  const topics = chapter?.trim()
    ? forSubject.filter((i) => i.chapter.toLowerCase() === chapter.trim().toLowerCase())
    : forSubject;

  return {
    canonicalClassName,
    curriculumSection,
    subjects,
    chapters,
    topics,
  };
}

/**
 * Builds rich, bounded context (<= 2400 chars) from selected School Lesson Plans
 * plus optional manual teacher notes to feed Question Paper AI generation.
 */
export function buildSmartSyllabusContextFromLessonPlans(params: {
  plans: SchoolLessonPlan[];
  manualNotes?: string;
}): string {
  const { plans, manualNotes } = params;
  const parts: string[] = [];

  if (manualNotes && manualNotes.trim()) {
    parts.push(`Syllabus Scope / Chapters:\n${manualNotes.trim()}`);
  }

  if (plans.length > 0) {
    const planSummaries = plans.map((p, idx) => {
      const firstTwoSlos = (p.slos || '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 2)
        .join('; ');
      const vocabPreview = (p.vocabulary || '')
        .split('\n')
        .map((v) => v.split('::')[0]?.trim())
        .filter(Boolean)
        .slice(0, 5)
        .join(', ');
      return [
        `[${idx + 1}] ${p.chapter} — ${p.topic} (${p.subject})`,
        firstTwoSlos ? `SLOs: ${firstTwoSlos}` : '',
        vocabPreview ? `Key Concepts/Vocabulary: ${vocabPreview}` : '',
        p.assessment ? `Assessment Focus: ${p.assessment.split('\n')[0]?.slice(0, 140)}` : '',
      ]
        .filter(Boolean)
        .join(' | ');
    });
    parts.push(`Taught Lesson Plans Context (${plans.length}):\n${planSummaries.join('\n')}`);
  }

  const combined = parts.join('\n\n').trim();
  return combined.slice(0, 2400);
}

/**
 * Builds a complete, curriculum-aligned fallback lesson plan when the server AI endpoint is unreachable/offline.
 */
export function buildSmsOfflineFallbackLessonPlan(params: {
  board: 'Sindh STBB' | 'Punjab PTB';
  section: 'Primary' | 'Middle' | 'Secondary' | 'Higher Secondary';
  className: string;
  subject: string;
  chapter: string;
  topic: string;
  duration: string;
  planType: 'Daily' | 'Weekly';
}): LessonPlanContent {
  const { board, section, className, subject, chapter, topic, duration, planType } = params;
  const isHssc = section === 'Higher Secondary' || ['Class 11', 'Class 12'].includes(className);
  const isSsc = section === 'Secondary' || ['Class 9', 'Class 10'].includes(className);

  if (isHssc || isSsc) {
    return {
      slos: `Students will be able to:\n1. Define, analyze, and apply core principles of "${topic}" in ${subject} (${board} ${className}).\n2. Solve board-pattern conceptual questions and numerical/application problems from ${chapter}.\n3. Connect theoretical principles of "${topic}" with practical scientific/real-world applications.`,
      previousKnowledge: `Ask 2–3 diagnostic board-style warm-up questions reviewing foundational concepts leading into "${topic}" in ${chapter}.`,
      teachingAids: `${board} ${className} ${subject} Textbook, Whiteboard & Markers, Concept Mind-Map, Formula/Summary Reference Sheet.`,
      introduction: `Introduce "${topic}" (${planType} lesson · ${duration}) by framing a real-world problem and connecting it to core learning outcomes of ${chapter}.`,
      procedure: `Step 1 (5 min): Diagnostic recall of prerequisite concepts.\nStep 2 (15 min): Structured derivation/explanation of "${topic}" with worked examples.\nStep 3 (10 min): Guided practice using past-paper short & analytical items.\nStep 4 (10 min): Peer check, recap, and exit ticket assessment.`,
      teacherActivities: `Present key definitions and derivations of "${topic}" cleanly on the board, model step-by-step problem solving, and probe conceptual misconceptions.`,
      studentActivities: `Record structured notes, work in pairs to solve guided practice questions from ${chapter}, and defend reasoning during class review.`,
      assessment: `1. Quick oral/written concept check on core principles of "${topic}".\n2. Two short exam-style questions testing understanding & application.`,
      homework: `Review class notes for "${topic}", solve Textbook Exercise questions for ${chapter}, and prepare 1 analytical question for next class.`,
      vocabulary: `Core Principle :: Fundamental rule/definition governing ${topic}\nDerivation :: Step-by-step logical proof or concept development\nApplication :: Practical use of ${topic} concepts`,
      lifeSkills: `Analytical reasoning, quantitative problem-solving, and structured written communication.`,
      teacherReflection: `Monitor conceptual accuracy during guided practice and note topics needing remedial reinforcement before exams.`,
      questions: `1. Define the core concepts introduced in "${topic}".\n2. Explain the practical significance of "${topic}" with one clear example.`,
      exercise: `Complete Section A (MCQs) & Section B (Short Questions) related to "${topic}" from ${board} Textbook.`,
      worksheetPrompt: `Prepare a structured summary sheet covering definitions, formulas/rules, and 2 solved examples from "${topic}".`,
      bloomAssessment: `Remembering :: State the primary definition/law in "${topic}". :: 2\nUnderstanding :: Explain why "${topic}" behaves as observed in ${chapter}. :: 3\nApplying :: Solve a novel board-style application item based on "${topic}". :: 5`,
    };
  }

  return {
    slos: `Students will be able to:\n1. Understand key ideas and vocabulary of "${topic}" (${subject}, ${className}).\n2. Read, explain, and answer core comprehension/exercise questions from ${chapter}.\n3. Apply concepts from "${topic}" to everyday examples.`,
    previousKnowledge: `Ask simple warm-up questions about what students already know from daily life related to "${topic}".`,
    teachingAids: `${board} ${className} Textbook, Whiteboard, Flashcards, Visual Charts.`,
    introduction: `Greet students, recap the previous lesson, and introduce "${topic}" (${planType} plan · ${duration}) using visual examples.`,
    procedure: `Step 1 (5 min): Warm-up story/question on "${topic}".\nStep 2 (15 min): Read aloud & explain "${topic}" with examples.\nStep 3 (12 min): Interactive board & notebook practice.\nStep 4 (8 min): Quick quiz and recap.`,
    teacherActivities: `Model clear pronunciation/explanation on the board, demonstrate visual examples, and assist students individually during notebook work.`,
    studentActivities: `Listen attentively, repeat key vocabulary words, participate in pair reading, and complete notebook questions cleanly.`,
    assessment: `Ask 3 short oral check questions and inspect student notebook responses on "${topic}".`,
    homework: `Learn new words/concepts from "${topic}" and write answers to 2 review questions neatly in notebook.`,
    vocabulary: `Key Concept :: Main idea taught in ${topic}\nVocabulary :: Essential words and meanings from ${chapter}\nPractice :: Reinforcement activity for mastery`,
    lifeSkills: `Active listening, clear communication, curiosity, and neat notebook organization.`,
    teacherReflection: `Ensure shy learners participate during pair work and revisit tricky vocabulary next period.`,
    questions: `1. What is the main lesson learned from "${topic}"?\n2. Give one everyday example related to "${topic}".`,
    exercise: `Complete textbook comprehension and fill-in-the-blank activities for "${topic}".`,
    worksheetPrompt: `Draw/label one concept or write 3 neat sentences summarizing "${topic}".`,
    bloomAssessment: `Remembering :: Recall two key facts from "${topic}". :: 2\nUnderstanding :: Describe "${topic}" in your own words. :: 3\nApplying :: Share one real-life example of "${topic}". :: 3`,
  };
}

/**
 * Generates an aligned offline fallback question paper matching exact section marks distribution.
 */
export function buildSmsOfflineFallbackQuestionPaper(request: {
  className: string;
  subject: string;
  difficulty: QuestionPaperDifficulty;
  totalMarks: number;
  timeAllowed: string;
  language: QuestionPaperLanguage;
  syllabusCovered: string;
}): GeneratedQuestionPaper {
  const distribution = computeBalancedMarksDistribution(request.totalMarks);
  const isUrdu = request.language === 'Urdu';
  const isSindhi = request.language === 'Sindhi';

  const cleanTopics = (request.syllabusCovered || request.subject)
    .split(/\n|;|\|/)
    .map((t) => t.replace(/^\[\d+\]\s*/, '').trim())
    .filter(Boolean);

  const pickTopic = (index: number) =>
    cleanTopics.length > 0
      ? cleanTopics[index % cleanTopics.length].slice(0, 90)
      : request.subject;

  const sectionATitle = isUrdu
    ? 'حصہ اول: کثیر الانتخابی سوالات (MCQs)'
    : isSindhi
    ? 'حصو پهريون: گهڻ-چونڊ سوال (MCQs)'
    : 'Section A: Multiple Choice Questions (MCQs)';
  const sectionBTitle = isUrdu
    ? 'حصہ دوم: مختصر سوالات'
    : isSindhi
    ? 'حصو ٻيو: مختصر سوال'
    : 'Section B: Short Answer Questions';
  const sectionCTitle = isUrdu
    ? 'حصہ سوم: تفصیلی سوالات'
    : isSindhi
    ? 'حصو ٽيون: تفصيلي سوال'
    : 'Section C: Descriptive / Long Questions';

  const mcqs = Array.from({ length: Math.max(1, distribution.mcqCount) }, (_, i) => {
    const focus = pickTopic(i);
    return {
      question: isUrdu
        ? `(${request.subject}) "${focus}" کے حوالے سے درست آپشن منتخب کریں (سوال ${i + 1})۔`
        : isSindhi
        ? `(${request.subject}) "${focus}" بابت صحيح جواب چونڊيو (سوال ${i + 1})۔`
        : `Which statement best describes the core concept of "${focus}" in ${request.subject} (Q${i + 1})?`,
      options: ['(A) Core Principle A', '(B) Concept B', '(C) Application C', '(D) Definition D'],
      correctAnswer: '(A) Core Principle A',
    };
  });

  const shortQuestions = Array.from(
    { length: Math.max(1, distribution.shortQuestionsTotalInPaper) },
    (_, i) => {
      const focus = pickTopic(i);
      return {
        question: isUrdu
          ? `"${focus}" کی مختصر تعریف اور اہمیت مثال کے ساتھ بیان کریں (سوال ${i + 1})۔`
          : isSindhi
          ? `"${focus}" جي مختصر تعريف ۽ اهميت مثال سان بيان ڪريو (سوال ${i + 1})۔`
          : `Define and briefly explain "${focus}" with one relevant example from ${request.subject}.`,
        marks: distribution.shortMarksEach,
      };
    }
  );

  const longQuestions = Array.from(
    { length: Math.max(1, distribution.longQuestionsTotalInPaper) },
    (_, i) => {
      const focus = pickTopic(i);
      return {
        question: isUrdu
          ? `تفصیلی نوٹ تحریر کریں: "${focus}" کے بنیادی اصول، وضاحت اور عملی اہمیت بیان کریں۔`
          : isSindhi
          ? `تفصيلي نوٽ لکو: "${focus}" جا بنيادي اصول، وضاحت ۽ عملي اهميت بيان ڪريو.`
          : `Analyze in detail "${focus}", explaining its core principles, structure/derivation, and practical significance.`,
        marks: distribution.longMarksEach,
      };
    }
  );

  return {
    paperTitle: `${request.className} Examination — ${request.subject}`,
    instructions:
      'Attempt all sections cleanly. Section A is compulsory. Write neat and well-structured answers.',
    sectionATitle,
    mcqs,
    sectionAMarks: distribution.mcqTotalMarks,
    sectionBTitle,
    sectionBNote: `Attempt any ${distribution.shortQuestionsRequired} out of ${distribution.shortQuestionsTotalInPaper} questions. (${distribution.shortMarksEach} marks each)`,
    shortQuestions,
    sectionBMarks: distribution.shortTotalMarks,
    sectionCTitle,
    sectionCNote: `Attempt any ${distribution.longQuestionsRequired} out of ${distribution.longQuestionsTotalInPaper} questions. (${distribution.longMarksEach} marks each)`,
    longQuestions,
    sectionCMarks: distribution.longTotalMarks,
    totalMarks: distribution.totalMarks,
  };
}

/**
 * Enforces RBAC filtering for School Lesson Plans:
 * - Super Admin & Read-Only Impersonation: NO access ([])
 * - School Admin / Principal: All plans in school
 * - Teacher: ONLY plans belonging to their assignedClassIds
 * - Parent: ONLY shared plans (sharedWithParents === true) in their child's classId
 * - Student: NO direct lesson-plan access unless explicitly shared (strictly empty here per Parent-share spec)
 */
export function filterLessonPlansForRole(
  plans: SchoolLessonPlan[],
  ctx: {
    role: UserRole;
    isSuperAdmin?: boolean;
    isReadOnlyImpersonation?: boolean;
    assignedClassIds?: string[];
    childClassId?: string;
  }
): SchoolLessonPlan[] {
  if (!Array.isArray(plans) || ctx.isSuperAdmin || ctx.isReadOnlyImpersonation || ctx.role === 'super-admin') {
    return [];
  }
  if (ctx.role === 'admin' || ctx.role === 'principal') {
    return plans;
  }
  if (ctx.role === 'teacher') {
    const allowed = new Set(ctx.assignedClassIds || []);
    return plans.filter((p) => Boolean(p && allowed.has(p.classId)));
  }
  if (ctx.role === 'parent') {
    if (!ctx.childClassId) return [];
    return plans.filter((p) => Boolean(p && p.sharedWithParents === true && p.classId === ctx.childClassId));
  }
  return [];
}

/**
 * Enforces RBAC filtering for School Question Papers:
 * - Super Admin, Parent, Student & Read-Only Impersonation: NO access ([])
 * - School Admin / Principal: All papers in school
 * - Teacher: ONLY papers belonging to their assignedClassIds
 */
export function filterQuestionPapersForRole(
  papers: SchoolQuestionPaper[],
  ctx: {
    role: UserRole;
    isSuperAdmin?: boolean;
    isReadOnlyImpersonation?: boolean;
    assignedClassIds?: string[];
  }
): SchoolQuestionPaper[] {
  if (!Array.isArray(papers) || ctx.isSuperAdmin || ctx.isReadOnlyImpersonation || ctx.role === 'super-admin') {
    return [];
  }
  if (ctx.role === 'admin' || ctx.role === 'principal') {
    return papers;
  }
  if (ctx.role === 'teacher') {
    const allowed = new Set(ctx.assignedClassIds || []);
    return papers.filter((p) => Boolean(p && allowed.has(p.classId)));
  }
  return [];
}

/**
 * Returns question papers attached to a specific exam.
 */
export function getAttachedQuestionPapersForExam(
  papers: SchoolQuestionPaper[],
  examId: string
): SchoolQuestionPaper[] {
  if (!examId || !Array.isArray(papers)) return [];
  return papers.filter((p) => p.examId === examId && p.attachedToExam === true);
}
