export type QuestionPaperLanguage = 'English' | 'Urdu' | 'Sindhi';
export type QuestionPaperDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface MarksDistribution {
  totalMarks: number;
  mcqCount: number;
  mcqMarksEach: number;
  mcqTotalMarks: number;
  shortMarksEach: number;
  shortQuestionsRequired: number;
  shortQuestionsTotalInPaper: number;
  shortTotalMarks: number;
  longMarksEach: number;
  longQuestionsRequired: number;
  longQuestionsTotalInPaper: number;
  longTotalMarks: number;
}

export interface GeneratedMcqItem {
  question: string;
  options: string[];
  correctAnswer: string;
}

export interface GeneratedQuestionItem {
  question: string;
  marks: number;
}

export interface GeneratedQuestionPaper {
  paperTitle: string;
  instructions: string;
  sectionATitle: string;
  mcqs: GeneratedMcqItem[];
  sectionAMarks: number;
  sectionBTitle: string;
  sectionBNote: string;
  shortQuestions: GeneratedQuestionItem[];
  sectionBMarks: number;
  sectionCTitle: string;
  sectionCNote: string;
  longQuestions: GeneratedQuestionItem[];
  sectionCMarks: number;
  totalMarks: number;
}

export const ALLOWED_LOGO_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
] as const;

export const MAX_LOGO_SIZE_BYTES = 1.5 * 1024 * 1024; // 1.5 MB

export function validateSchoolLogoFile(file: {
  type: string;
  size: number;
}): { valid: boolean; error?: string } {
  const normalizedType = (file.type || '').toLowerCase();
  if (
    !ALLOWED_LOGO_MIME_TYPES.includes(
      normalizedType as (typeof ALLOWED_LOGO_MIME_TYPES)[number]
    )
  ) {
    return {
      valid: false,
      error:
        'Only PNG, JPG/JPEG, or WebP image files are allowed for the School Logo.',
    };
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return {
      valid: false,
      error: 'Selected logo file is empty or unreadable.',
    };
  }
  if (file.size > MAX_LOGO_SIZE_BYTES) {
    return {
      valid: false,
      error: 'Logo image size must be 1.5 MB or smaller for clean A4 printing.',
    };
  }
  return { valid: true };
}

/**
 * Computes a mathematically exact balance across Section A (MCQs),
 * Section B (Short Questions), and Section C (Long Questions) summing to totalMarks.
 */
export function computeBalancedMarksDistribution(
  rawTotalMarks: number
): MarksDistribution {
  const totalMarks = Number.isFinite(rawTotalMarks)
    ? Math.max(10, Math.min(200, Math.round(rawTotalMarks)))
    : 100;

  // Target ~20% MCQs (1 mark each)
  const mcqTotalMarks = Math.max(2, Math.min(30, Math.round(totalMarks * 0.2)));
  const remaining = totalMarks - mcqTotalMarks;

  // Split remaining roughly 50/50 between Short & Long Questions using clean integers
  const shortMarksEach = totalMarks <= 30 ? 2 : 3;
  let shortQuestionsRequired = Math.max(
    1,
    Math.round((remaining * 0.5) / shortMarksEach)
  );
  let shortTotalMarks = shortQuestionsRequired * shortMarksEach;
  let longTotalMarks = remaining - shortTotalMarks;

  // Adjust if longTotalMarks becomes too small
  while (longTotalMarks < 4 && shortQuestionsRequired > 1) {
    shortQuestionsRequired -= 1;
    shortTotalMarks = shortQuestionsRequired * shortMarksEach;
    longTotalMarks = remaining - shortTotalMarks;
  }

  // Pick a clean number of long questions to attempt so marks per question is clear
  let longQuestionsRequired = 2;
  if (longTotalMarks < 8) {
    longQuestionsRequired = 1;
  } else if (longTotalMarks >= 30 && longTotalMarks % 3 === 0) {
    longQuestionsRequired = 3;
  } else if (longTotalMarks % 2 !== 0 && longTotalMarks % 3 === 0) {
    longQuestionsRequired = 3;
  } else if (longTotalMarks % 2 !== 0 && longTotalMarks >= 10) {
    // Rebalance 1 mark into MCQs if needed so Long Questions divide evenly
    longQuestionsRequired = 2;
  }

  // Ensure exact integer division for longQuestionsRequired when > 1
  let finalMcqTotal = mcqTotalMarks;
  if (longQuestionsRequired === 2 && longTotalMarks % 2 !== 0) {
    finalMcqTotal += 1;
    longTotalMarks -= 1;
  } else if (longQuestionsRequired === 3 && longTotalMarks % 3 !== 0) {
    const mod = longTotalMarks % 3;
    finalMcqTotal += mod;
    longTotalMarks -= mod;
  }

  const longMarksEach = Math.round(longTotalMarks / longQuestionsRequired);
  const shortQuestionsTotalInPaper =
    shortQuestionsRequired + (shortQuestionsRequired >= 3 ? 2 : 1);
  const longQuestionsTotalInPaper = longQuestionsRequired + 1;

  return {
    totalMarks,
    mcqCount: finalMcqTotal,
    mcqMarksEach: 1,
    mcqTotalMarks: finalMcqTotal,
    shortMarksEach,
    shortQuestionsRequired,
    shortQuestionsTotalInPaper,
    shortTotalMarks,
    longMarksEach,
    longQuestionsRequired,
    longQuestionsTotalInPaper,
    longTotalMarks,
  };
}

export interface QuestionPaperRequestValidation {
  valid: boolean;
  error?: string;
  sanitized?: {
    className: string;
    subject: string;
    difficulty: QuestionPaperDifficulty;
    totalMarks: number;
    timeAllowed: string;
    language: QuestionPaperLanguage;
    syllabusCovered: string;
  };
}

export function validateQuestionPaperRequest(input: {
  className?: string;
  subject?: string;
  difficulty?: string;
  totalMarks?: number | string;
  timeAllowed?: string;
  language?: string;
  syllabusCovered?: string;
}): QuestionPaperRequestValidation {
  const className = (input.className || '').replace(/[<>`]/g, '').trim();
  const subject = (input.subject || '').replace(/[<>`]/g, '').trim();
  const syllabusCovered = (input.syllabusCovered || '')
    .replace(/[<>`]/g, '')
    .trim();
  const timeAllowed =
    (input.timeAllowed || '2 Hours 30 Minutes').replace(/[<>`]/g, '').trim() ||
    '2 Hours 30 Minutes';

  if (!className) {
    return { valid: false, error: 'Please select a Class (1st to 12th).' };
  }
  if (!subject) {
    return { valid: false, error: 'Please enter a Subject name.' };
  }
  if (syllabusCovered.length < 3) {
    return {
      valid: false,
      error:
        'Please enter Syllabus Covered (chapters or topics) so AI can craft relevant questions.',
    };
  }

  const parsedMarks = Number(input.totalMarks);
  if (!Number.isFinite(parsedMarks) || parsedMarks < 10 || parsedMarks > 200) {
    return {
      valid: false,
      error: 'Total Marks must be a valid number between 10 and 200.',
    };
  }

  const difficulty: QuestionPaperDifficulty =
    input.difficulty === 'Easy' ||
    input.difficulty === 'Medium' ||
    input.difficulty === 'Hard'
      ? input.difficulty
      : 'Medium';

  const language: QuestionPaperLanguage =
    input.language === 'English' ||
    input.language === 'Urdu' ||
    input.language === 'Sindhi'
      ? input.language
      : 'English';

  return {
    valid: true,
    sanitized: {
      className: className.slice(0, 40),
      subject: subject.slice(0, 80),
      difficulty,
      totalMarks: Math.round(parsedMarks),
      timeAllowed: timeAllowed.slice(0, 40),
      language,
      syllabusCovered: syllabusCovered.slice(0, 2500),
    },
  };
}
