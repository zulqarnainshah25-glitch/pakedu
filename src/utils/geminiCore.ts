import { GoogleGenAI, Type } from '@google/genai';
import { getEffectiveGeminiApiKey } from './envConfig';
import {
  computeBalancedMarksDistribution,
  GeneratedQuestionPaper,
  QuestionPaperDifficulty,
  QuestionPaperLanguage,
} from './questionPaperLogic';

export interface QuestionPaperPayload {
  className: string;
  subject: string;
  difficulty: QuestionPaperDifficulty;
  totalMarks: number;
  timeAllowed: string;
  language: QuestionPaperLanguage;
  syllabusCovered: string;
}

export interface LessonPlanPayload {
  board?: string;
  section?: string;
  className?: string;
  subject?: string;
  chapter?: string;
  topic?: string;
  duration?: string;
  planType?: string;
}

export interface MappedLessonPlan {
  slos: string;
  previousKnowledge: string;
  teachingAids: string;
  introduction: string;
  procedure: string;
  teacherActivities: string;
  studentActivities: string;
  assessment: string;
  homework: string;
  vocabulary: string;
  lifeSkills: string;
  teacherReflection: string;
  questions: string;
  exercise: string;
  worksheetPrompt: string;
  bloomAssessment: string;
  wordMeanings?: string;
  qa?: string;
  otherExercises?: string;
}

function safeStr(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val.trim();
  if (Array.isArray(val)) return val.map((v) => safeStr(v)).filter(Boolean).join('\n');
  if (typeof val === 'object') {
    return Object.entries(val as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${safeStr(v)}`)
      .join('\n');
  }
  return String(val).trim();
}

/**
 * Format procedure into newline-separated steps so that UI components split cleanly.
 */
function formatProcedure(val: unknown): string {
  if (!val) return '';
  if (Array.isArray(val)) {
    return val.map((item, idx) => {
      const s = safeStr(item);
      return /^(Step\s*\d+|Phase\s*\d+|\d+[\.\)])/i.test(s) ? s : `Step ${idx + 1}: ${s}`;
    }).join('\n');
  }
  const str = String(val).trim();
  if (str.includes(' | ')) {
    return str.split(' | ').map((s, idx) => {
      const trimmed = s.trim();
      return /^(Step\s*\d+|Phase\s*\d+|\d+[\.\)])/i.test(trimmed) ? trimmed : `Step ${idx + 1}: ${trimmed}`;
    }).join('\n');
  }
  return str;
}

/**
 * Normalizes word meanings and vocabulary into clean Term = Meaning lines
 */
function formatVocabulary(wordMeaningsRaw: unknown, vocabRaw: unknown): string {
  const wm = safeStr(wordMeaningsRaw);
  const vc = safeStr(vocabRaw);
  if (wm && vc && wm !== vc) {
    return `${wm}\n${vc}`;
  }
  return wm || vc || '';
}

/**
 * Calls Gemini using the exact prompt logic from the Google Apps Script backend.
 */
export async function generateLessonPlanWithGemini(
  payload: LessonPlanPayload,
  explicitApiKey?: string
): Promise<MappedLessonPlan> {
  const apiKey = getEffectiveGeminiApiKey(explicitApiKey);
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'pakedu-portal',
      },
    },
  });

  const cls = payload.className || 'Class 5';
  const subj = payload.subject || 'General Science';
  const chap = payload.chapter || 'Chapter 1';
  const top = payload.topic || 'General Topic';
  const board = payload.board || 'Sindh Textbook Board (STBB)';
  const duration = payload.duration || '40 Minutes';
  const planType = payload.planType || 'Daily';

  // EXACT PROMPT LOGIC FROM OLD GOOGLE APPS SCRIPT
  const promptText = `You are a Senior Curriculum Expert and Native Linguist for the ${board}, Pakistan.
Task: Create a highly detailed, professional, and practical ${planType} lesson plan (${duration}) for Class: ${cls}, Subject: ${subj}, Chapter: ${chap}, Topic: ${top}.

CRITICAL LANGUAGE RULES (MANDATORY):
1. Carefully analyze the Subject Name: "${subj}".
2. If the subject name contains a language in brackets (e.g., "Science (Urdu)", "Math (Sindhi)"), you MUST write the ENTIRE lesson plan exactly in THAT specified language (Urdu, Sindhi, etc.).
3. If the Subject itself is a language (e.g., "Urdu", "Sindhi") or "Islamiyat", you MUST write entirely in that language.
4. ONLY if no local language is specified or implied in the subject name, use English (with local Pakistan context).
5. When writing in Urdu or Sindhi, use proper right-to-left academic script, pure vocabulary, and zero grammatical errors. Do not mix English and Urdu/Sindhi sentences.

CRITICAL CONTENT REQUIREMENTS:
- "Q&A": You MUST generate EXACTLY 5 comprehensive questions with in-depth, detailed answers. Short or one-line answers are strictly prohibited. Format each as: Q1: Question?\\nA1: Detailed answer...
- "Word Meanings": Provide at least 8 difficult words from the topic with their exact contextual meanings. Format each as: Word = Meaning (or Word :: Meaning).
- "Other Exercises": Generate at least 3 active learning exercises (e.g., Fill in the blanks, True/False, Match the columns) with complete sentences and their answers.
- Ensure sections like Procedure, Introduction, and Activities are detailed and step-by-step.

OUTPUT FORMAT:
Return ONLY a raw JSON object (no markdown, no backticks, no code blocks) with EXACTLY these keys:
"SLOs", "PreviousKnowledge", "TeachingAids", "Introduction", "Procedure", "TeacherActivities", "StudentActivities", "Assessment", "Homework", "Reflection", "Questions", "Vocabulary", "LifeSkills", "Exercise", "Word Meanings", "Q&A", "Other Exercises".`;

  const candidateModels = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];
  let lastError: unknown;

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: promptText,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      });

      const rawText = (response.text || '').trim();
      if (!rawText) continue;

      const cleaned = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const aiData = JSON.parse(cleaned) as Record<string, unknown>;

      const questionsStr = safeStr(aiData['Q&A'] || aiData['Questions'] || aiData['QA']);
      const wordMeaningsStr = safeStr(aiData['Word Meanings'] || aiData['WordMeanings']);
      const otherExercisesStr = safeStr(aiData['Other Exercises'] || aiData['OtherExercises'] || aiData['Exercise']);
      const procedureStr = formatProcedure(aiData['Procedure']);
      const vocabularyStr = formatVocabulary(wordMeaningsStr, aiData['Vocabulary']);

      return {
        slos: safeStr(aiData['SLOs'] || aiData['slos']),
        previousKnowledge: safeStr(aiData['PreviousKnowledge'] || aiData['previousKnowledge']),
        teachingAids: safeStr(aiData['TeachingAids'] || aiData['teachingAids']),
        introduction: safeStr(aiData['Introduction'] || aiData['introduction']),
        procedure: procedureStr,
        teacherActivities: safeStr(aiData['TeacherActivities'] || aiData['teacherActivities']),
        studentActivities: safeStr(aiData['StudentActivities'] || aiData['studentActivities']),
        assessment: safeStr(aiData['Assessment'] || aiData['assessment']),
        homework: safeStr(aiData['Homework'] || aiData['homework']),
        teacherReflection: safeStr(aiData['Reflection'] || aiData['teacherReflection'] || aiData['TeacherReflection']),
        questions: questionsStr,
        vocabulary: vocabularyStr,
        lifeSkills: safeStr(aiData['LifeSkills'] || aiData['lifeSkills']),
        exercise: otherExercisesStr,
        worksheetPrompt: otherExercisesStr,
        bloomAssessment: safeStr(aiData['Assessment']),
        wordMeanings: wordMeaningsStr,
        qa: questionsStr,
        otherExercises: otherExercisesStr,
      };
    } catch (err) {
      lastError = err;
      console.warn(`Attempt with ${model} failed, failing over to next model:`, err);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Gemini API was unable to generate lesson plan.');
}

export async function generateQuestionPaperWithGemini(
  params: QuestionPaperPayload,
  explicitApiKey?: string
): Promise<GeneratedQuestionPaper> {
  const apiKey = getEffectiveGeminiApiKey(explicitApiKey);
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'pakedu-portal',
      },
    },
  });

  const dist = computeBalancedMarksDistribution(params.totalMarks);

  const languageDirective =
    params.language === 'Urdu'
      ? 'Write the ENTIRE question paper (paperTitle, instructions, section titles, section notes, all MCQs, options, correctAnswer, shortQuestions, and longQuestions) in natural, standard academic Urdu script (اردو). Only JSON keys remain in English.'
      : params.language === 'Sindhi'
      ? 'Write the ENTIRE question paper (paperTitle, instructions, section titles, section notes, all MCQs, options, correctAnswer, shortQuestions, and longQuestions) in natural, standard academic Sindhi script (سنڌي). Only JSON keys remain in English.'
      : 'Write the entire question paper in clear, academic Pakistani board examination English.';

  const prompt = `You are an Expert Board Examiner for Pakistani Schools (BISE / STBB / PTB).
Create a balanced, classroom-ready Question Paper strictly matching these specifications:
- Class: ${params.className}
- Subject: ${params.subject}
- Difficulty Level: ${params.difficulty} (${params.difficulty === 'Easy' ? 'focus on foundational recall and comprehension' : params.difficulty === 'Hard' ? 'focus on HOTS, numericals, conceptual analysis, and critical evaluation' : 'standard balanced board exam mix of knowledge, understanding, and application'})
- Total Marks: ${dist.totalMarks}
- Time Allowed: ${params.timeAllowed}
- Paper Language: ${params.language}
- Syllabus Covered: ${params.syllabusCovered}

LANGUAGE REQUIREMENT:
${languageDirective}

EXACT STRUCTURE & MARKS BALANCE (STRICT):
1. Section A (MCQs): Generate EXACTLY ${dist.mcqCount} Multiple Choice Questions, each worth 1 mark (Total = ${dist.mcqTotalMarks} marks). Each MCQ must have exactly 4 distinct options and a correctAnswer matching one of the options.
2. Section B (Short Questions): Generate EXACTLY ${dist.shortQuestionsTotalInPaper} Short Questions, with the instruction to attempt any ${dist.shortQuestionsRequired} questions (${dist.shortMarksEach} marks each, Section B Total = ${dist.shortTotalMarks} marks).
3. Section C (Long / Descriptive Questions): Generate EXACTLY ${dist.longQuestionsTotalInPaper} Long Questions, with the instruction to attempt any ${dist.longQuestionsRequired} questions (${dist.longMarksEach} marks each, Section C Total = ${dist.longTotalMarks} marks).

Verify every single question comes directly from the Syllabus Covered and matches the cognitive level of ${params.className}.`;

  const questionPaperSchema = {
    type: Type.OBJECT,
    properties: {
      paperTitle: { type: Type.STRING },
      instructions: { type: Type.STRING },
      sectionATitle: { type: Type.STRING },
      mcqs: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            correctAnswer: { type: Type.STRING },
          },
          required: ['question', 'options', 'correctAnswer'],
        },
      },
      sectionBTitle: { type: Type.STRING },
      sectionBNote: { type: Type.STRING },
      shortQuestions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            marks: { type: Type.INTEGER },
          },
          required: ['question', 'marks'],
        },
      },
      sectionCTitle: { type: Type.STRING },
      sectionCNote: { type: Type.STRING },
      longQuestions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            marks: { type: Type.INTEGER },
          },
          required: ['question', 'marks'],
        },
      },
    },
    required: [
      'paperTitle',
      'instructions',
      'sectionATitle',
      'mcqs',
      'sectionBTitle',
      'sectionBNote',
      'shortQuestions',
      'sectionCTitle',
      'sectionCNote',
      'longQuestions',
    ],
  };

  const candidateModels = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];
  let lastError: unknown;

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: questionPaperSchema,
          temperature: 0.3,
        },
      });

      const text = (response.text || '').trim();
      if (!text) continue;

      const cleaned = text
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsed = JSON.parse(cleaned) as Record<string, any>;

      return {
        paperTitle: (typeof parsed.paperTitle === 'string' && parsed.paperTitle) || `${params.className} ${params.subject} Examination`,
        instructions: (typeof parsed.instructions === 'string' && parsed.instructions) || 'Attempt all sections neatly.',
        sectionATitle: (typeof parsed.sectionATitle === 'string' && parsed.sectionATitle) || 'Section A — Multiple Choice Questions (MCQs)',
        mcqs: Array.isArray(parsed.mcqs) ? parsed.mcqs.slice(0, dist.mcqCount) : [],
        sectionAMarks: dist.mcqTotalMarks,
        sectionBTitle: (typeof parsed.sectionBTitle === 'string' && parsed.sectionBTitle) || 'Section B — Short Questions',
        sectionBNote: (typeof parsed.sectionBNote === 'string' && parsed.sectionBNote) || `Attempt any ${dist.shortQuestionsRequired} questions (${dist.shortMarksEach} marks each).`,
        shortQuestions: Array.isArray(parsed.shortQuestions)
          ? parsed.shortQuestions.slice(0, dist.shortQuestionsTotalInPaper).map((q: any) => ({
              question: String(q.question || ''),
              marks: dist.shortMarksEach,
            }))
          : [],
        sectionBMarks: dist.shortTotalMarks,
        sectionCTitle: (typeof parsed.sectionCTitle === 'string' && parsed.sectionCTitle) || 'Section C — Long / Descriptive Questions',
        sectionCNote: (typeof parsed.sectionCNote === 'string' && parsed.sectionCNote) || `Attempt any ${dist.longQuestionsRequired} questions (${dist.longMarksEach} marks each).`,
        longQuestions: Array.isArray(parsed.longQuestions)
          ? parsed.longQuestions.slice(0, dist.longQuestionsTotalInPaper).map((q: any) => ({
              question: String(q.question || ''),
              marks: dist.longMarksEach,
            }))
          : [],
        sectionCMarks: dist.longTotalMarks,
        totalMarks: dist.totalMarks,
      };
    } catch (err) {
      lastError = err;
      console.warn(`Question paper generation attempt with ${model} failed, trying next model:`, err);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Gemini API was unable to generate question paper.');
}
