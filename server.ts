import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { getClassDifficultyProfile } from './src/data/syllabusPresets';
import {
  PORTAL_APP_NAME,
  PORTAL_LAST_UPDATED,
  PORTAL_VERSION,
} from './src/utils/appVersion';
import {
  computeBalancedMarksDistribution,
  validateQuestionPaperRequest,
} from './src/utils/questionPaperLogic';
import {
  extractReadableApiError,
  parseModelJsonText,
} from './src/utils/apiResponse';
import {
  getEffectiveGeminiApiKey,
  isPlaceholderApiKey,
  parseServerEnv,
} from './src/utils/envConfig';
import { registerCvBuilderEndpoints } from './src/utils/cvBuilderApi';
import {
  generateLessonPlanWithGemini,
  generateQuestionPaperWithGemini,
} from './src/utils/geminiCore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverEnv = parseServerEnv(process.env);
const app = express();
const PORT = 3000;

// Security Audit Rule 3: Restrict JSON payload size to prevent DoS memory exhaustion
app.use(express.json({ limit: '256kb' }));

// Security headers middleware
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Load & Concurrency Simulation Rule 4: In-memory cache & per-IP rate limiter for 1,000 concurrent users
const lessonPlanCache = new Map<string, { source: string; plan: Record<string, string>; timestamp: number }>();
const MAX_CACHE_ENTRIES = 500;
const CACHE_TTL_MS = serverEnv.cacheTtlMs;

const ipRequestCounts = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_IP_PER_MINUTE = serverEnv.rateLimitPerMinute;

function cleanServerField(val: unknown, fallback: string, maxLen = 100): string {
  if (typeof val !== 'string') return fallback;
  const cleaned = val
    .replace(/[<>`]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
  return cleaned || fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`DEADLINE_EXCEEDED: ${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise
      .then((value) => {
        if (timer) clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        if (timer) clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Calls Gemini structured JSON generation with automatic model fallback
 * (gemini-3.5-flash-lite <-> gemini-3.1-flash-lite).
 */
async function generateStructuredJsonWithRetry(
  ai: GoogleGenAI,
  contents: string,
  responseSchema?: Record<string, unknown>
): Promise<{ text: string; modelUsed: string }> {
  const attempts: Array<{
    model: string;
    timeoutMs: number;
    delayMs: number;
  }> = [
    { model: 'gemini-3.5-flash-lite', timeoutMs: 25_000, delayMs: 0 },
    { model: 'gemini-3.1-flash-lite', timeoutMs: 25_000, delayMs: 400 },
  ];

  let lastError: unknown;

  for (const attempt of attempts) {
    if (attempt.delayMs > 0) {
      await sleep(attempt.delayMs);
    }

    try {
      const config: Record<string, unknown> = {
        responseMimeType: 'application/json',
        temperature: 0.3,
      };
      if (responseSchema) {
        config.responseSchema = responseSchema;
      }

      const response = await withTimeout(
        ai.models.generateContent({
          model: attempt.model,
          contents,
          config,
        }),
        attempt.timeoutMs,
        attempt.model
      );

      const text = response.text;
      if (text && text.trim()) {
        return { text, modelUsed: attempt.model };
      }
      lastError = new Error(`Empty response from ${attempt.model}`);
    } catch (err) {
      lastError = err;
      console.warn(`Gemini attempt with ${attempt.model} failed, trying fallback model...`, err);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Gemini model did not return a valid response.');
}

interface LessonPlanRequest {
  board: string;
  section: string;
  className: string;
  subject: string;
  chapter: string;
  topic: string;
  duration: string;
  planType: string;
}

function buildFallbackLessonPlan(req: LessonPlanRequest) {
  const { board, section, className, subject, chapter, topic, duration, planType } = req;
  const profile = getClassDifficultyProfile(board, section, className, subject);
  const isEarlyPrimary = className === 'KG' || className === 'Class 1' || className === 'Class 2';
  const isSecondaryOrHigher =
    section === 'Secondary' ||
    section === 'Higher Secondary' ||
    className === 'Class 9' ||
    className === 'Class 10' ||
    className === 'Class 11' ||
    className === 'Class 12';

  const questions = isEarlyPrimary
    ? [
        `1. Point to and name two examples of "${topic}" from ${chapter} (${board} ${className}).`,
        `2. Can you say a short, simple sentence about "${topic}"?`,
        `3. Draw and color one picture showing "${topic}".`
      ].join('\n')
    : isSecondaryOrHigher
    ? [
        `1. State the formal definition, underlying principles, or mathematical/scientific formulation of "${topic}" as prescribed in ${chapter} (${board} ${className} ${subject}).`,
        `2. Derive, analyze, or critically evaluate the key mechanism/arguments of "${topic}" according to ${board} Board examination standards.`,
        `3. Solve a structured problem or real-world analytical case study applying "${topic}".`
      ].join('\n')
    : [
        `1. What is the main concept of "${topic}" in ${chapter} (${board} ${className})?`,
        `2. Give two real-life examples of "${topic}" observed in Pakistan.`,
        `3. Why is "${topic}" important in ${subject} (${className} - ${section})?`
      ].join('\n');

  const exercise = isEarlyPrimary
    ? [
        `1. Match the words of "${topic}" with their pictures.`,
        `2. Trace and write 3 simple words from "${topic}" (${chapter}).`,
        `3. Circle the correct picture for "${topic}".`
      ].join('\n')
    : isSecondaryOrHigher
    ? [
        `1. Answer 5 board-pattern Multiple Choice Questions (MCQs) testing conceptual depth on "${topic}" (${board} ${className}).`,
        `2. Write a comprehensive Short-Question response (3 marks) distinguishing the core components of "${topic}" in ${chapter}.`,
        `3. Attempt the Long/Analytical Question (5–8 marks) with labeled diagrams, equations, or textual citations from "${topic}".`
      ].join('\n')
    : [
        `1. Fill in the blanks using key terms from "${topic}" (${board} ${className}).`,
        `2. Write True or False for the statements in ${chapter}.`,
        `3. Use 5 vocabulary words from "${topic}" in your own sentences.`
      ].join('\n');

  return {
    slos: [
      `[${board} · ${className} (${section})] Define and explain "${topic}" from ${chapter} at the ${profile.cognitiveLevel}.`,
      `Align conceptual understanding of "${topic}" with ${profile.boardStandard}.`,
      `Apply ${className}-appropriate analytical skills, terminology, and practical examples of "${topic}" in ${subject}.`,
      `Demonstrate mastery of "${topic}" through ${profile.assessmentDepth}`
    ].join('\n'),
    previousKnowledge: isEarlyPrimary
      ? `Begin with a cheerful rhyme, picture flashcards, or real objects to check what ${className} children already recognize about "${topic}" from home and daily play.`
      : isSecondaryOrHigher
      ? `Pose 2–3 diagnostic conceptual questions linking "${topic}" to prerequisite ${board} concepts from earlier chapters (${chapter}), verifying readiness for ${className} board-level rigor.`
      : `Ask students 2–3 targeted warm-up questions connecting their prior experiences to "${topic}" (e.g., "What do you already observe in your surroundings related to ${topic}?" and "How does this connect to our previous lesson in ${chapter} of ${board}?").`,
    teachingAids: `${board} Official Prescribed ${subject} Textbook for ${className} (${section} Section), Whiteboard & Colored Markers, ${isSecondaryOrHigher ? 'Board Exam Past-Paper Reference Sheet & Labeled Scientific/Conceptual Chart' : 'Visual Flashcards & Activity Chart'} illustrating "${topic}", Printable Student Worksheets.`,
    introduction: `Begin the ${duration} (${planType}) session calibrated for ${className} (${section} — ${board}) by introducing "${topic}" (${chapter}). ${profile.pedagogicalFocus} Announce today's Student Learning Outcomes (SLOs) clearly on the board.`,
    procedure: [
      `Step 1 (Warm-Up & Prior Knowledge Check - 5 mins): Greet ${className} students, review prior concepts from ${chapter}, and activate schema for "${topic}" using ${board} context.`,
      `Step 2 (${className} Concept Presentation - 12 mins): Present "${topic}" from the ${board} ${subject} textbook. ${profile.vocabularyDepth}`,
      `Step 3 (Guided Demonstration & Examples - 8 mins): Work through 2 age-appropriate ${className} (${section}) examples on the whiteboard, emphasizing ${board} curriculum standards.`,
      `Step 4 (Collaborative Activity - 8 mins): Engage students in a ${section}-level structured activity on "${topic}" using flashcards and guided practice.`,
      `Step 5 (Formative Assessment & Wrap-Up - 7 mins): Check mastery using ${profile.assessmentDepth} and assign targeted homework.`
    ].join('\n'),
    teacherActivities: `Deliver ${className}-calibrated instruction following ${board} (${section}) guidelines; model accurate terminology and diagrams on the board; scaffold learners during guided practice; provide immediate formative feedback.`,
    studentActivities: `Participate actively in the ${className} warm-up inquiry; record structured notes/diagrams from ${chapter}; collaborate with peers on the "${topic}" activity; complete the ${section}-level worksheet and formative check.`,
    assessment: `Evaluate ${className} students using ${profile.assessmentDepth} Verify that learners meet the ${board} SLOs for "${topic}".`,
    homework: `Read "${topic}" in ${chapter} of the ${board} ${subject} Textbook for ${className}. Complete the ${section}-level review questions in your neat notebook and revise key vocabulary terms.`,
    vocabulary: [
      `${topic} :: The central concept studied in ${chapter} (${board} ${className} ${subject}).`,
      `Core Principle :: The fundamental rule or idea governing "${topic}" at the ${className} (${section}) level.`,
      `Curriculum Standard :: Official learning benchmark prescribed by ${board} for ${className}.`,
      `Conceptual Analysis :: Breaking down "${topic}" into clear, grade-appropriate components for ${className} learners.`,
      `Practical Application :: Using knowledge of "${topic}" to solve real-world or examination problems in ${subject}.`,
      `Synthesis & Review :: Connecting key takeaways from ${chapter} to build complete mastery in ${className}.`
    ].join('\n'),
    lifeSkills: `Critical Thinking & Problem Solving (${className} level), Collaborative Teamwork, Effective Communication, Academic Integrity & Lifelong Learning.`,
    teacherReflection: `Students of ${className} (${section}) engaged effectively with "${topic}" under the ${board} curriculum framework within ${duration}. Difficulty level was appropriately matched to ${className}; additional board-pattern practice will be reinforced in the next session.`,
    questions,
    exercise,
    worksheetPrompt: [
      `Q1. [${board} · ${className}] Define or explain "${topic}" (${chapter}) at your grade level.`,
      `Q2. Provide two ${className}-appropriate examples or applications of "${topic}" in ${subject}.`,
      `Q3. Complete the labeled diagram, model, or structured analytical chart of "${topic}" in the box below.`
    ].join('\n'),
    bloomAssessment: [
      `Remembering :: [${className} - ${board}] Recall and state the basic definition/facts of "${topic}" from ${chapter}. :: 2`,
      `Understanding :: Explain the main concept of "${topic}" in your own words suitable for ${className}. :: 3`,
      `Applying :: Apply the rules or concepts of "${topic}" to solve a ${className}-level problem in ${subject}. :: 3`,
      `Analyzing :: Analyze the key components or relationships within "${topic}" (${chapter}). :: 4`,
      `Evaluating :: Evaluate the importance or implications of "${topic}" according to ${board} ${className} standards. :: 4`,
      `Creating :: Create a labeled diagram, summary chart, or structured solution model for "${topic}". :: 4`
    ].join('\n')
  };
}

app.post('/api/generate-lesson-plan', async (req, res) => {
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const rateEntry = ipRequestCounts.get(clientIp);
  if (!rateEntry || now - rateEntry.windowStart > RATE_LIMIT_WINDOW_MS) {
    ipRequestCounts.set(clientIp, { count: 1, windowStart: now });
  } else {
    rateEntry.count += 1;
    if (rateEntry.count > MAX_REQUESTS_PER_IP_PER_MINUTE) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Serving cached/fallback lesson plan to protect server stability.',
      });
    }
  }

  const payload = (req.body || {}) as Partial<LessonPlanRequest>;
  const board = cleanServerField(payload.board, 'Sindh STBB', 40);
  const section = cleanServerField(payload.section, 'Primary', 40);
  const className = cleanServerField(payload.className, 'Class 5', 30);
  const subject = cleanServerField(payload.subject, 'General Science', 60);
  const chapter = cleanServerField(payload.chapter, 'Chapter 1', 100);
  const topic = cleanServerField(payload.topic, 'Introduction', 120);
  const duration = cleanServerField(payload.duration, '40 Minutes', 30);
  const planType = cleanServerField(payload.planType, 'Daily', 20);

  const cacheKey = `${board}|${section}|${className}|${subject}|${chapter}|${topic}|${duration}|${planType}`.toLowerCase();
  const cached = lessonPlanCache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return res.json({
      source: cached.source,
      plan: cached.plan,
      cached: true,
    });
  }

  try {
    const plan = await generateLessonPlanWithGemini(
      {
        board,
        section,
        className,
        subject,
        chapter,
        topic,
        duration,
        planType,
      },
      process.env.GEMINI_API_KEY
    );

    if (lessonPlanCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = lessonPlanCache.keys().next().value;
      if (oldestKey) lessonPlanCache.delete(oldestKey);
    }
    lessonPlanCache.set(cacheKey, {
      source: 'gemini-ai',
      plan: plan as unknown as Record<string, string>,
      timestamp: Date.now(),
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      source: 'gemini-ai',
      plan,
    });
  } catch (error) {
    console.warn('Gemini generation encountered an issue, serving curriculum fallback:', error);
    const fallbackPlan = buildFallbackLessonPlan({
      board,
      section,
      className,
      subject,
      chapter,
      topic,
      duration,
      planType,
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      source: 'ai-fallback',
      plan: fallbackPlan,
    });
  }
});

// Version fetch endpoint (v1.0.5)
app.get('/api/version', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    appName: PORTAL_APP_NAME,
    version: PORTAL_VERSION,
    lastUpdated: PORTAL_LAST_UPDATED,
    modules: [
      'AI Lesson Plan Generator',
      'Sindh Salary Calculator 2026',
      'SELD FRAMES Leave Proforma',
      'AtlierCV Studio',
      'Service Book Calculator',
      'AI Question Paper Maker',
    ],
  });
});

// LRU Cache for AI Question Papers
const questionPaperCache = new Map<
  string,
  { paper: Record<string, unknown>; timestamp: number }
>();

app.post('/api/generate-question-paper', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown';
  const now = Date.now();
  const rateEntry = ipRequestCounts.get(clientIp);
  if (!rateEntry || now - rateEntry.windowStart > RATE_LIMIT_WINDOW_MS) {
    ipRequestCounts.set(clientIp, { count: 1, windowStart: now });
  } else {
    rateEntry.count += 1;
    if (rateEntry.count > MAX_REQUESTS_PER_IP_PER_MINUTE) {
      return res.status(429).json({
        error:
          'Too many requests from this network. Please wait a minute before generating another Question Paper.',
      });
    }
  }

  const validation = validateQuestionPaperRequest(req.body || {});
  if (!validation.valid || !validation.sanitized) {
    return res.status(400).json({
      error: validation.error || 'Invalid question paper parameters.',
    });
  }

  const {
    className,
    subject,
    difficulty,
    totalMarks,
    timeAllowed,
    language,
    syllabusCovered,
  } = validation.sanitized;

  const dist = computeBalancedMarksDistribution(totalMarks);
  const cacheKey = `${className}|${subject}|${difficulty}|${totalMarks}|${language}|${syllabusCovered}`.toLowerCase();
  const cached = questionPaperCache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return res.json({
      source: 'gemini-ai-cached',
      paper: cached.paper,
    });
  }

  const apiKey = getEffectiveGeminiApiKey(process.env.GEMINI_API_KEY);

  try {
    const normalizedPaper = await generateQuestionPaperWithGemini(
      {
        className,
        subject,
        difficulty,
        totalMarks,
        timeAllowed,
        language,
        syllabusCovered,
      },
      apiKey
    );

    if (questionPaperCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = questionPaperCache.keys().next().value;
      if (oldestKey) questionPaperCache.delete(oldestKey);
    }
    questionPaperCache.set(cacheKey, {
      paper: normalizedPaper as unknown as Record<string, unknown>,
      timestamp: Date.now(),
    });

    return res.json({
      source: 'gemini-ai',
      paper: normalizedPaper,
    });
  } catch (error) {
    console.error('Gemini question paper generation failed:', error);
    const analyzed = extractReadableApiError(
      error,
      'Upstream AI service error while generating question paper.'
    );
    return res.status(analyzed.status).json({
      error: analyzed.message,
    });
  }
});

// CV Builder AI Endpoint (/api/build-cv)
registerCvBuilderEndpoints(app, serverEnv.geminiApiKey, serverEnv.fallbackModel);

// Strict JSON 404 guard so unmatched /api/* routes NEVER fall through to index.html (<!doctype html>)
app.all('/api/*', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(404).json({
    error: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// Express JSON error middleware so body-parser or payload-size errors on /api/* always return valid JSON
app.use(
  (
    err: unknown,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (req.path.startsWith('/api/')) {
      const status =
        typeof err === 'object' &&
        err !== null &&
        'status' in err &&
        typeof (err as { status?: number }).status === 'number'
          ? (err as { status: number }).status
          : 500;
      const message =
        err instanceof Error ? err.message : 'Unexpected API server error.';
      res.setHeader('Cache-Control', 'no-store');
      return res.status(status).json({ error: message });
    }
    return next(err);
  }
);

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
