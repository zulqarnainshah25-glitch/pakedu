export interface LessonPlanContent {
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
}

export interface SyllabusPreset extends LessonPlanContent {
  id: string;
  board: 'Sindh STBB' | 'Punjab PTB';
  section: 'Primary' | 'Middle' | 'Secondary' | 'Higher Secondary';
  className: string;
  subject: string;
  chapter: string;
  topic: string;
  duration: string;
  planType: 'Daily' | 'Weekly';
}

export const CLASS_OPTIONS_BY_SECTION: Record<string, string[]> = {
  Primary: ['KG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5'],
  Middle: ['Class 6', 'Class 7', 'Class 8'],
  Secondary: ['Class 9', 'Class 10'],
  'Higher Secondary': ['Class 11', 'Class 12'],
};

export const ALL_CLASSES = [
  'KG',
  'Class 1',
  'Class 2',
  'Class 3',
  'Class 4',
  'Class 5',
  'Class 6',
  'Class 7',
  'Class 8',
  'Class 9',
  'Class 10',
  'Class 11',
  'Class 12',
];

export const SUBJECT_OPTIONS = [
  'English',
  'Urdu',
  'Asan Urdu',
  'Sindhi',
  'Mathematics',
  'Maths',
  'Math',
  'General Knowledge',
  'General Knowledge (Urdu)',
  'Science (Urdu)',
  'General Science',
  'Social Studies',
  'Social Studies (Sindhi)',
  'Social Studies (Urdu)',
  'Muasharti Uloom',
  'Islamiat',
  'Islamiat (Urdu)',
  'Mazhabi Taleemat',
  'ECCE',
  'Computer Science',
  'Physics',
  'Chemistry',
  'Biology',
];

export function inferSectionFromClass(
  className: string
): 'Primary' | 'Middle' | 'Secondary' | 'Higher Secondary' {
  const norm = className.trim();
  if (['KG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5'].includes(norm)) {
    return 'Primary';
  }
  if (['Class 6', 'Class 7', 'Class 8'].includes(norm)) {
    return 'Middle';
  }
  if (['Class 9', 'Class 10'].includes(norm)) {
    return 'Secondary';
  }
  return 'Higher Secondary';
}

/**
 * Strictly returns ONLY the classes belonging to the selected Section.
 * - Primary: KG to Class 5
 * - Middle: Class 6 to Class 8
 * - Secondary: Class 9 to Class 10
 * - Higher Secondary: Class 11 to Class 12
 */
export function getClassesForSection(
  section: 'Primary' | 'Middle' | 'Secondary' | 'Higher Secondary' | string
): string[] {
  return CLASS_OPTIONS_BY_SECTION[section] || CLASS_OPTIONS_BY_SECTION.Primary;
}

export interface ClassFieldExamples {
  subjectPlaceholder: string;
  chapterPlaceholder: string;
  topicPlaceholder: string;
  helperHint: string;
}

/**
 * Provides clear example placeholders for Subject, Chapter, and Topic when a Class/Board
 * does not have pre-loaded database rows, tailored to the Section, Class, and Board.
 */
export function getFieldExamplesForClass(
  section: string,
  className: string,
  board: string
): ClassFieldExamples {
  const boardShort = board === 'Punjab PTB' ? 'Punjab PTB' : 'Sindh STBB';

  if (section === 'Higher Secondary' || ['Class 11', 'Class 12'].includes(className)) {
    return {
      subjectPlaceholder: `Example: Physics, Chemistry, Biology, Mathematics, English (${className})`,
      chapterPlaceholder: `Example: Chapter 12: Electrostatics / Chapter 4: Hydrocarbons (${boardShort})`,
      topicPlaceholder: `Example: Coulomb's Law & Electric Field Intensity / Free Radical Substitution`,
      helperHint: `Database mein ${boardShort} ${className} ka pre-loaded data mojood nahi hai. Upar Subject, Chapter aur Topic likh kar "Generate Lesson Plan" par click karein — AI ${className} (Intermediate / HSSC) difficulty aur ${boardShort} curriculum ke mutabiq lesson plan tayar karega.`,
    };
  }

  if (section === 'Secondary' || ['Class 9', 'Class 10'].includes(className)) {
    return {
      subjectPlaceholder: `Example: Physics, Chemistry, Biology, Computer Science, Mathematics, English`,
      chapterPlaceholder: `Example: Chapter 3: Dynamics / Unit 2: Atomic Structure (${boardShort})`,
      topicPlaceholder: `Example: Newton's Second Law of Motion (F = ma) / Rutherford's Atomic Model`,
      helperHint: `Database mein ${boardShort} ${className} ka pre-loaded data mojood nahi hai. Upar Subject, Chapter aur Topic likh kar "Generate Lesson Plan" par click karein — AI ${className} (Matric / SSC Board) difficulty aur ${boardShort} syllabus ke mutabiq lesson plan tayar karega.`,
    };
  }

  if (section === 'Middle' || ['Class 6', 'Class 7', 'Class 8'].includes(className)) {
    return {
      subjectPlaceholder: `Example: General Science, Mathematics, English, Social Studies, Urdu, Sindhi`,
      chapterPlaceholder: `Example: Chapter 4: Environment and Feeding Relationships (${boardShort})`,
      topicPlaceholder: `Example: Photosynthesis & Respiration in Plants / Laws of Exponents`,
      helperHint: `Agar is Class/Board ka topic list mein nahi hai to apna Subject, Chapter aur Topic likh kar "Generate Lesson Plan" dabayein — AI ${className} (Middle Level) aur ${boardShort} ke mutabiq tayar karega.`,
    };
  }

  return {
    subjectPlaceholder:
      board === 'Punjab PTB'
        ? `Example: English, Urdu, Mathematics, General Knowledge, Islamiat`
        : `Example: Sindhi, Urdu, English, Mathematics, General Science`,
    chapterPlaceholder: `Example: Unit 1: My Family and School / باب اول (${boardShort})`,
    topicPlaceholder: `Example: Parts of a Plant / Nouns and Action Words / بنيادي اکر`,
    helperHint: `Apna Subject, Chapter aur Topic select ya type kar ke "Generate Lesson Plan" par click karein — AI ${className} (Primary Level) aur ${boardShort} ke mutabiq lesson plan tayar karega.`,
  };
}

export interface ClassDifficultyProfile {
  boardStandard: string;
  cognitiveLevel: string;
  pedagogicalFocus: string;
  vocabularyDepth: string;
  vocabularyAndDepth: string;
  assessmentDepth: string;
  assessmentRigor: string;
  languageNote: string;
}

/**
 * Calibrates cognitive difficulty, textbook terminology, and board alignment
 * across KG to Class 12 and between Sindh STBB and Punjab PTB.
 */
export function getClassDifficultyProfile(
  board: string,
  section: string,
  className: string,
  subject: string
): ClassDifficultyProfile {
  const isPunjab = board === 'Punjab PTB';
  const boardStandard = isPunjab
    ? 'Punjab Curriculum & Textbook Board (PCTB / PTB Lahore) aligned with the Single National Curriculum (SNC) / National Curriculum of Pakistan (NCP)'
    : 'Sindh Textbook Board (STBB Jamshoro) & Directorate of Curriculum, Assessment & Research (DCAR Sindh) official SLOs';

  const subjLower = subject.toLowerCase();
  const languageNote = subjLower.includes('sindhi')
    ? 'Write the lesson content primarily in clear, standard Sindhi script (سنڌي) suitable for Sindh STBB classrooms.'
    : subjLower.includes('urdu') || subjLower.includes('islamiat') || subjLower.includes('muasharti')
    ? 'Write the lesson content primarily in clear Urdu script (اردو) or bilingual Urdu/English appropriate for Pakistani schools.'
    : `Use clear, grade-appropriate English aligned with ${board} ${className} textbooks.`;

  const normClass = className.trim();
  if (normClass === 'KG' || normClass === 'Class 1' || normClass === 'Class 2') {
    const pedagogicalFocus = `Use playful, concrete, sensory, phonics-based, and storytelling pedagogy suited for ${normClass} (Ages 4–7).`;
    const vocabularyDepth = `Very simple, age-appropriate words and 4–6 word sentences suitable for ${normClass} children learning ${subject}. Avoid complex jargon; use flashcards, rhymes, pictures, and real classroom objects.`;
    const assessmentDepth = `oral spot-checks, picture/letter recognition, tracing, matching, and simple coloring/drawing activities.`;
    return {
      boardStandard,
      cognitiveLevel: `Early Childhood / Lower Primary (${normClass}, Ages 4–7)`,
      pedagogicalFocus,
      vocabularyDepth,
      vocabularyAndDepth: vocabularyDepth,
      assessmentDepth,
      assessmentRigor: assessmentDepth,
      languageNote,
    };
  }

  if (['Class 3', 'Class 4', 'Class 5'].includes(normClass) || section === 'Primary') {
    const pedagogicalFocus = `Focus on foundational concept building, guided reading, activity-based learning, and hands-on exploration for ${normClass} (Ages 8–10).`;
    const vocabularyDepth = `Clear, foundational ${subject} definitions with everyday Pakistani home/school examples suitable for ${normClass}.`;
    const assessmentDepth = `short fill-in-the-blanks, true/false, 1–2 sentence comprehension questions, and labeled basic diagrams.`;
    return {
      boardStandard,
      cognitiveLevel: `Upper Primary (${normClass}, Ages 8–10)`,
      pedagogicalFocus,
      vocabularyDepth,
      vocabularyAndDepth: vocabularyDepth,
      assessmentDepth,
      assessmentRigor: assessmentDepth,
      languageNote,
    };
  }

  if (['Class 6', 'Class 7', 'Class 8'].includes(normClass) || section === 'Middle') {
    const pedagogicalFocus = `Transition from concrete examples to structured conceptual reasoning, scientific/linguistic inquiry, and collaborative group tasks for ${normClass} (Ages 11–13).`;
    const vocabularyDepth = `Middle-school academic terminology for ${subject}, structured multi-step explanations, rules/formulas, and group inquiry tasks.`;
    const assessmentDepth = `structured short-answer questions, conceptual comparisons, practical numericals/grammar exercises, and Bloom's taxonomy checks.`;
    return {
      boardStandard,
      cognitiveLevel: `Middle / Elementary Level (${normClass}, Ages 11–13)`,
      pedagogicalFocus,
      vocabularyDepth,
      vocabularyAndDepth: vocabularyDepth,
      assessmentDepth,
      assessmentRigor: assessmentDepth,
      languageNote,
    };
  }

  if (['Class 9', 'Class 10'].includes(normClass) || section === 'Secondary') {
    const pedagogicalFocus = `Deliver high academic rigor aligned with BISE ${isPunjab ? 'Punjab' : 'Sindh'} Matriculation (SSC) board examinations for ${normClass} (Ages 14–16).`;
    const vocabularyDepth = `Formal secondary-level technical terminology, mathematical/scientific derivations, laws, equations, or critical literary analysis required in ${normClass} ${subject}.`;
    const assessmentDepth = `Matric Board exam pattern: MCQs, 2-to-3-mark Conceptual Short Questions (CRQs), and 4-to-5-mark Analytical/Descriptive Long Questions (ERQs).`;
    return {
      boardStandard,
      cognitiveLevel: `Secondary / Matriculation SSC Board Level (${normClass}, Ages 14–16)`,
      pedagogicalFocus,
      vocabularyDepth,
      vocabularyAndDepth: vocabularyDepth,
      assessmentDepth,
      assessmentRigor: assessmentDepth,
      languageNote,
    };
  }

  const pedagogicalFocus = `Deliver advanced pre-university Intermediate (HSSC / F.Sc / F.A) college-level analytical depth for ${normClass} (Ages 17–18).`;
  const vocabularyDepth = `Advanced theoretical framework, rigorous derivations, mechanisms, proofs, critical evaluation, and real-world/laboratory applications for ${normClass} ${subject}.`;
  const assessmentDepth = `Intermediate (F.Sc / F.A / ICS) Board exam pattern: HOTS analytical questions, derivations/numerical problems, and critical synthesis.`;
  return {
    boardStandard,
    cognitiveLevel: `Higher Secondary / Intermediate HSSC College Level (${normClass}, Ages 17–18)`,
    pedagogicalFocus,
    vocabularyDepth,
    vocabularyAndDepth: vocabularyDepth,
    assessmentDepth,
    assessmentRigor: assessmentDepth,
    languageNote,
  };
}

/**
 * Deterministic hash function that supports full Unicode (Urdu, Sindhi, English)
 * so every topic gets a unique, deterministic Firestore document ID matching ^[a-zA-Z0-9_\-]+$
 */
function unicodeHash(str: string): string {
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const combined = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return combined.toString(36);
}

/**
 * Generates a deterministic, Firestore-safe document ID matching ^[a-zA-Z0-9_\-]+$ and length <= 128
 * Preserves uniqueness even when Chapter/Topic are in Urdu or Sindhi script.
 */
export function getSyllabusDocId(
  board: string,
  className: string,
  subject: string,
  chapter: string,
  topic: string
): string {
  const normBoard = (board || 'Sindh STBB').trim().toLowerCase();
  const normClass = (className || '').trim().toLowerCase();
  const normSubject = (subject || '').trim().toLowerCase();
  const normChapter = (chapter || '').trim().toLowerCase();
  const normTopic = (topic || '').trim().toLowerCase();

  const hash = unicodeHash(`${normBoard}|${normClass}|${normSubject}|${normChapter}|${normTopic}`);
  const asciiPrefix = `${normClass}_${normSubject}_${normTopic}`
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);

  return `${asciiPrefix || 'syllabus'}_${hash}`.slice(0, 120);
}

/**
 * Sanitizes and truncates outgoing payload fields to strictly satisfy firebase-blueprint.json & firestore.rules
 */
export function sanitizeLessonPlanForFirestore(
  meta: {
    board: 'Sindh STBB' | 'Punjab PTB';
    section: 'Primary' | 'Middle' | 'Secondary' | 'Higher Secondary';
    className: string;
    subject: string;
    chapter: string;
    topic: string;
    duration: string;
    planType: 'Daily' | 'Weekly';
  },
  content: LessonPlanContent,
  authorId: string
) {
  const clamp = (val: string | undefined, max: number, fallback: string) => {
    const trimmed = (val || '').trim();
    if (!trimmed) return fallback;
    return trimmed.slice(0, max);
  };

  return {
    board: meta.board === 'Punjab PTB' ? 'Punjab PTB' : 'Sindh STBB',
    section: ['Primary', 'Middle', 'Secondary', 'Higher Secondary'].includes(meta.section)
      ? meta.section
      : inferSectionFromClass(meta.className),
    className: clamp(meta.className, 30, 'Class 1'),
    subject: clamp(meta.subject, 100, 'Urdu'),
    chapter: clamp(meta.chapter, 200, 'Unit 1'),
    topic: clamp(meta.topic, 200, 'Lesson 1'),
    duration: clamp(meta.duration, 50, '40 Minutes'),
    planType: meta.planType === 'Weekly' ? 'Weekly' : 'Daily',
    slos: clamp(content.slos, 3000, 'Achieve core curriculum learning outcomes.'),
    previousKnowledge: clamp(content.previousKnowledge, 2000, 'Review prior class concepts.'),
    teachingAids: clamp(content.teachingAids, 2000, 'Textbook, whiteboard, markers, charts.'),
    introduction: clamp(content.introduction, 3000, 'Introduce the topic with real-life examples.'),
    procedure: clamp(content.procedure, 5000, 'Step 1: Warm-up.\nStep 2: Explanation.\nStep 3: Activity.'),
    teacherActivities: clamp(content.teacherActivities, 3000, 'Explain concepts and guide students.'),
    studentActivities: clamp(content.studentActivities, 3000, 'Participate in group discussion and worksheet.'),
    assessment: clamp(content.assessment, 3000, 'Oral and written formative check.'),
    homework: clamp(content.homework, 2000, 'Complete textbook review questions.'),
    vocabulary: clamp(content.vocabulary, 4000, 'Concept :: Fundamental idea of the lesson'),
    lifeSkills: clamp(content.lifeSkills, 2000, 'Critical thinking and collaboration.'),
    teacherReflection: clamp(content.teacherReflection, 2000, 'Students engaged well with visual aids.'),
    questions: clamp(content.questions, 4000, 'Review questions from the lesson.'),
    exercise: clamp(content.exercise, 4000, 'Complete textbook exercises.'),
    worksheetPrompt: clamp(content.worksheetPrompt, 4000, 'Answer the questions and draw a labeled diagram.'),
    bloomAssessment: clamp(
      content.bloomAssessment,
      4000,
      'Remembering :: Define the main term. :: 2\nUnderstanding :: Explain with an example. :: 3'
    ),
    visibility: 'public',
    authorId: authorId.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 128) || 'teacher_user',
  };
}

export function parseVocabularyList(vocabString: string): Array<{ term: string; definition: string }> {
  const raw = (vocabString || '').trim();
  if (!raw) return [];

  // Check if formatted with numbered "1. Term = Meaning 2. Term = Meaning" on single or multiple lines
  if (/\d+\.\s*[^=]+=[^0-9]+/.test(raw) && !raw.includes('::')) {
    const matches = raw.split(/(?=\d+\.\s)/).map((s) => s.trim()).filter(Boolean);
    const parsedItems: Array<{ term: string; definition: string }> = [];
    for (const item of matches) {
      const cleaned = item.replace(/^\d+\.\s*/, '').trim();
      if (cleaned.includes('=')) {
        const [t, ...rest] = cleaned.split('=');
        parsedItems.push({
          term: t.trim(),
          definition: rest.join('=').trim(),
        });
      } else if (cleaned.includes(':')) {
        const [t, ...rest] = cleaned.split(':');
        parsedItems.push({
          term: t.trim(),
          definition: rest.join(':').trim(),
        });
      }
    }
    if (parsedItems.length > 0) return parsedItems;
  }

  const lines = raw
    .split(/\n|\|/)
    .map((l) => l.trim())
    .filter(Boolean);

  // If single line with comma/Arabic-comma separated words (e.g., "الف، ب، ٻ، نقطو، اکر")
  if (lines.length === 1 && !lines[0].includes('::') && !lines[0].includes('=')) {
    const tokens = lines[0]
      .split(/[,،|]/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (tokens.length > 1) {
      return tokens.map((token, idx) => ({
        term: token,
        definition: `Key curriculum vocabulary term #${idx + 1} from this lesson.`,
      }));
    }
  }

  return lines.map((line, idx) => {
    if (line.includes('::')) {
      const [term, ...rest] = line.split('::');
      return {
        term: term.replace(/^\d+[\.\)]\s*/, '').trim() || `Term ${idx + 1}`,
        definition: rest.join('::').trim() || 'Key term from lesson.',
      };
    }
    if (line.includes('=')) {
      const [term, ...rest] = line.split('=');
      return {
        term: term.replace(/^\d+[\.\)]\s*/, '').trim() || `Term ${idx + 1}`,
        definition: rest.join('=').trim() || 'Key term from lesson.',
      };
    }
    if (line.includes(':')) {
      const [term, ...rest] = line.split(':');
      return {
        term: term.replace(/^\d+[\.\)]\s*/, '').trim() || `Term ${idx + 1}`,
        definition: rest.join(':').trim() || 'Key term from lesson.',
      };
    }
    return {
      term: line.replace(/^\d+[\.\)]\s*/, '').trim() || `Key Term ${idx + 1}`,
      definition: 'Key vocabulary term from textbook lesson.',
    };
  });
}

export interface BloomQuestion {
  level: string;
  question: string;
  marks: number;
}

export function parseBloomAssessment(bloomString: string): BloomQuestion[] {
  const lines = (bloomString || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const defaultLevels = [
    'Remembering (تذکر / یادداشت)',
    'Understanding (تفہیم / سمجھ)',
    'Applying (اطلاق / استعمال)',
    'Analyzing (تجزیہ)',
    'Evaluating (جائزہ / قدر پیمائی)',
    'Creating (تخلیق)',
  ];

  return lines.map((line, idx) => {
    const parts = line.split('::').map((p) => p.trim());
    if (parts.length >= 3) {
      return {
        level: parts[0] || defaultLevels[idx % defaultLevels.length],
        question: parts[1] || line,
        marks: Number(parts[2]) || 3,
      };
    }
    if (parts.length === 2) {
      return {
        level: parts[0] || defaultLevels[idx % defaultLevels.length],
        question: parts[1],
        marks: 3,
      };
    }
    return {
      level: defaultLevels[idx % defaultLevels.length],
      question: line,
      marks: 3,
    };
  });
}

export const STBB_SYLLABUS_PRESETS: SyllabusPreset[] = [];
