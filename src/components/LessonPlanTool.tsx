import React, { useState, useEffect, useMemo } from 'react';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import {
  BookOpen,
  Download,
  Sparkles,
  Database,
  Layers,
  FileText,
  BarChart3,
  CheckCircle2,
  Scissors,
  RefreshCw,
  UploadCloud,
  Search,
  Table,
  ChevronRight,
} from 'lucide-react';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { sanitizeFirestoreData } from '../utils/firestoreSanitizer';
import { enqueueOfflineMutation } from '../services/offlineSyncService';
import {
  SUBJECT_OPTIONS,
  LessonPlanContent,
  SyllabusPreset,
  getSyllabusDocId,
  inferSectionFromClass,
  getClassesForSection,
  getFieldExamplesForClass,
  getClassDifficultyProfile,
  sanitizeLessonPlanForFirestore,
  parseVocabularyList,
  parseBloomAssessment,
} from '../data/syllabusPresets';
import { loadGoogleSheetSyllabusData } from '../data/googleSheetLoader';
import { triggerPrintDocument } from '../utils/printDocument';

interface LessonPlanToolProps {
  currentUser: User | null;
  onRequestSignIn: () => void;
}

type OutputViewMode = 'lesson-plan' | 'flashcards' | 'worksheet' | 'assessment';

function hasRtlScript(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F]/.test(text);
}

function buildLocalOfflineTemplatePlan(params: {
  board: string;
  section: string;
  className: string;
  subject: string;
  chapter: string;
  topic: string;
  duration: string;
  planType: string;
}): LessonPlanContent {
  const { board, className, subject, chapter, topic, duration, planType } = params;
  return {
    slos: `1. Understand the core principles of ${topic} (${subject}, ${className}).\n2. Demonstrate practical comprehension through guided classroom exercises.\n3. Apply ${board} curriculum standards to address real-world conceptual challenges.`,
    previousKnowledge: `Students possess baseline familiarity with ${subject} concepts covered in preceding units and grades.`,
    teachingAids: `Textbook (${board}), Whiteboard, Markers, Concept Flashcards, Audio/Visual presentation.`,
    introduction: `The teacher introduces ${topic} by connecting it to everyday situations and asks open-ended questions to stimulate class discussion.`,
    procedure: `1. Warm-up and review of prior knowledge (5 mins).\n2. Direct instruction: Teacher explains key principles of ${topic} (15 mins).\n3. Guided student interaction and peer discussion (10 mins).\n4. Formative comprehension check and recap (10 mins).`,
    teacherActivities: `Presents lesson objectives, writes key definitions on the board, facilitates class discussion, and guides individual practice.`,
    studentActivities: `Listen attentively, take structured notes, participate in guided textbook problem-solving, and complete peer-discussion exercises.`,
    assessment: `Formative evaluation through oral questioning, spot checks on understanding, and short exercise drills on ${topic}.`,
    homework: `Complete review questions and exercises for ${topic} from the textbook (${board}) in notebooks.`,
    vocabulary: `Key Terminology: Concept, Principle, Application, Analysis, Synthesis, ${topic}.`,
    lifeSkills: `Critical Thinking, Communication, Creative Problem Solving, and Analytical Reasoning.`,
    teacherReflection: `Learning outcomes were achieved within the allotted ${duration}. Additional reinforcement will be provided during future review sessions.`,
    questions: `1. Define the fundamental concept of ${topic}.\n2. How is this concept applied in practical scenarios?\n3. Summarize the key takeaway in your own words.`,
    exercise: `Textbook exercise for ${topic}: Answer questions 1 to 4 and complete the conceptual matching table.`,
    worksheetPrompt: `Create a concept map linking ${topic} to its main applications and sub-themes.`,
    bloomAssessment: `Knowledge: Define terms.\nComprehension: Explain mechanisms.\nApplication: Solve review exercise.\nAnalysis: Contrast with related concepts.`,
  };
}

export const LessonPlanTool: React.FC<LessonPlanToolProps> = ({
  currentUser,
  onRequestSignIn,
}) => {
  // Loaded Google Sheet Dataset
  const [sheetLessons, setSheetLessons] = useState<SyllabusPreset[]>([]);
  const [isLoadingSheet, setIsLoadingSheet] = useState(true);
  const [showDataExplorer, setShowDataExplorer] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form Inputs
  const [teacherName, setTeacherName] = useState('Ustad Zulqarnain Ali Shah');
  const [mobileNumber, setMobileNumber] = useState('0300-1234567');
  const [schoolName, setSchoolName] = useState('GBHS Latifabad No. 7, Hyderabad');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [duration, setDuration] = useState('40 Minutes');
  const [planType, setPlanType] = useState<'Daily' | 'Weekly'>('Daily');
  const [board, setBoard] = useState<'Sindh STBB' | 'Punjab PTB'>('Sindh STBB');
  const [section, setSection] = useState<'Primary' | 'Middle' | 'Secondary' | 'Higher Secondary'>('Primary');
  const [className, setClassName] = useState('KG');
  const [subject, setSubject] = useState('Sindhi');
  const [chapter, setChapter] = useState('1. الف-ب جي پٽي');
  const [topic, setTopic] = useState('بنيادي اکر');

  // Output & Firestore State
  // Requirement 2: Lesson plan output MUST NOT be displayed until the teacher clicks "Generate Lesson Plan"
  const [hasGeneratedPlan, setHasGeneratedPlan] = useState(false);
  const [activeView, setActiveView] = useState<OutputViewMode>('lesson-plan');
  const [lessonContent, setLessonContent] = useState<LessonPlanContent>({
    slos: '',
    previousKnowledge: '',
    teachingAids: '',
    introduction: '',
    procedure: '',
    teacherActivities: '',
    studentActivities: '',
    assessment: '',
    homework: '',
    vocabulary: '',
    lifeSkills: '',
    teacherReflection: '',
    questions: '',
    exercise: '',
    worksheetPrompt: '',
    bloomAssessment: '',
  });
  const [dataSource, setDataSource] = useState<'firestore' | 'google-sheet' | 'gemini-ai'>('google-sheet');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [firestoreCount, setFirestoreCount] = useState<number | null>(null);

  const refreshFirestoreCount = async () => {
    try {
      const q = query(collection(db, 'syllabus_data'), where('visibility', '==', 'public'));
      const snap = await getDocs(q);
      setFirestoreCount(snap.size);
    } catch {
      // Ignore initial count read errors
    }
  };

  // Load Google Sheet TSV files on mount (Populate dropdown options only; do NOT auto-render lesson plan below)
  useEffect(() => {
    let mounted = true;
    loadGoogleSheetSyllabusData()
      .then((items) => {
        if (!mounted) return;
        setSheetLessons(items);
        setIsLoadingSheet(false);
        if (items.length > 0) {
          const first = items[0];
          setBoard(first.board);
          setSection(first.section);
          setClassName(first.className);
          setSubject(first.subject);
          setChapter(first.chapter);
          setTopic(first.topic);
          setStatusBanner(
            `Database ready (${items.length} STBB curriculum topics indexed). Select your Board, Section, Class, Subject, Chapter & Topic below and click "Generate Lesson Plan".`
          );
        }
      })
      .catch((err) => {
        console.error('Error loading Google Sheet TSVs:', err);
        if (mounted) setIsLoadingSheet(false);
      });

    refreshFirestoreCount();
    return () => {
      mounted = false;
    };
  }, []);

  // Requirement 4: Classes filtered strictly by the selected Section
  const classesForSelectedSection = useMemo(() => {
    return getClassesForSection(section);
  }, [section]);

  // Requirement 5: Dynamic example placeholders & helper hints when a Class/Board has no pre-loaded data
  const fieldExamples = useMemo(() => {
    return getFieldExamplesForClass(section, className, board);
  }, [section, className, board]);

  // Requirement 3: Difficulty & Board profile for the selected configuration
  const difficultyProfile = useMemo(() => {
    return getClassDifficultyProfile(board, section, className, subject || 'General');
  }, [board, section, className, subject]);

  // Cascading options derived from the Google Sheet dataset for the selected Board + Class + Subject + Chapter
  const subjectsForClass = useMemo(() => {
    const set = new Set<string>();
    for (const item of sheetLessons) {
      if (
        item.board.toLowerCase() === board.toLowerCase() &&
        item.className.toLowerCase() === className.toLowerCase()
      ) {
        set.add(item.subject);
      }
    }
    return Array.from(set);
  }, [sheetLessons, board, className]);

  const chaptersForClassAndSubject = useMemo(() => {
    const set = new Set<string>();
    for (const item of sheetLessons) {
      if (
        item.board.toLowerCase() === board.toLowerCase() &&
        item.className.toLowerCase() === className.toLowerCase() &&
        item.subject.toLowerCase() === subject.toLowerCase()
      ) {
        set.add(item.chapter);
      }
    }
    return Array.from(set);
  }, [sheetLessons, board, className, subject]);

  const topicsForSelection = useMemo(() => {
    const filtered = sheetLessons.filter(
      (item) =>
        item.board.toLowerCase() === board.toLowerCase() &&
        item.className.toLowerCase() === className.toLowerCase() &&
        item.subject.toLowerCase() === subject.toLowerCase() &&
        (!chapter || item.chapter.toLowerCase() === chapter.toLowerCase())
    );
    if (filtered.length > 0) return filtered;
    return sheetLessons.filter(
      (item) =>
        item.board.toLowerCase() === board.toLowerCase() &&
        item.className.toLowerCase() === className.toLowerCase() &&
        item.subject.toLowerCase() === subject.toLowerCase()
    );
  }, [sheetLessons, board, className, subject, chapter]);

  const hasDatabaseContentForClass = subjectsForClass.length > 0;

  const populateFieldsFromPreset = (preset: SyllabusPreset) => {
    setBoard(preset.board);
    setSection(preset.section);
    setClassName(preset.className);
    setSubject(preset.subject);
    setChapter(preset.chapter);
    setTopic(preset.topic);
    setDuration(preset.duration);
    setPlanType(preset.planType);
  };

  const applyPresetLessonContent = (
    preset: SyllabusPreset,
    sourceLabel: 'firestore' | 'google-sheet' = 'google-sheet'
  ) => {
    populateFieldsFromPreset(preset);
    setLessonContent({
      slos: preset.slos,
      previousKnowledge: preset.previousKnowledge,
      teachingAids: preset.teachingAids,
      introduction: preset.introduction,
      procedure: preset.procedure,
      teacherActivities: preset.teacherActivities,
      studentActivities: preset.studentActivities,
      assessment: preset.assessment,
      homework: preset.homework,
      vocabulary: preset.vocabulary,
      lifeSkills: preset.lifeSkills,
      teacherReflection: preset.teacherReflection,
      questions: preset.questions,
      exercise: preset.exercise,
      worksheetPrompt: preset.worksheetPrompt,
      bloomAssessment: preset.bloomAssessment,
    });
    setDataSource(sourceLabel);
  };

  // Sync form fields when Board, Section, or Class changes:
  // - Hides any previously generated lesson plan until "Generate Lesson Plan" is clicked again.
  // - If pre-loaded data exists for (targetBoard + targetClass), selects the first valid Subject, Chapter, and Topic.
  // - If NO pre-loaded data exists (e.g. Class 9-12 or Punjab PTB), clears Subject, Chapter, and Topic to blank ('') so examples show!
  const syncSelectionForBoardSectionClass = (
    targetBoard: 'Sindh STBB' | 'Punjab PTB',
    targetSection: 'Primary' | 'Middle' | 'Secondary' | 'Higher Secondary',
    targetClass: string
  ) => {
    setBoard(targetBoard);
    setSection(targetSection);
    setClassName(targetClass);
    setHasGeneratedPlan(false);
    setStatusBanner(null);

    const matchesForClass = sheetLessons.filter(
      (i) =>
        i.board.toLowerCase() === targetBoard.toLowerCase() &&
        i.className.toLowerCase() === targetClass.toLowerCase()
    );

    if (matchesForClass.length > 0) {
      const first = matchesForClass[0];
      setSubject(first.subject);
      setChapter(first.chapter);
      setTopic(first.topic);
    } else {
      // Suggest high-quality default topic for AI generation when not in sheet
      const isHssc = targetSection === 'Higher Secondary' || ['Class 11', 'Class 12'].includes(targetClass);
      const isSsc = targetSection === 'Secondary' || ['Class 9', 'Class 10'].includes(targetClass);
      setSubject(isHssc ? 'Physics' : isSsc ? 'Physics' : 'General Science');
      setChapter(isHssc ? 'Chapter 12: Electrostatics' : isSsc ? 'Chapter 2: Kinematics' : 'Chapter 1');
      setTopic(isHssc ? "Coulomb's Law & Electric Field Intensity" : isSsc ? 'Motion & Velocity' : 'Living and Non-Living Things');
    }
  };

  const handleBoardChange = (newBoard: 'Sindh STBB' | 'Punjab PTB') => {
    syncSelectionForBoardSectionClass(newBoard, section, className);
  };

  // Requirement 4: Changing Section strictly filters Class options to that Section and selects the first Class of that Section
  const handleSectionChange = (
    newSection: 'Primary' | 'Middle' | 'Secondary' | 'Higher Secondary'
  ) => {
    const validClasses = getClassesForSection(newSection);
    const nextClass = validClasses.includes(className) ? className : validClasses[0];
    syncSelectionForBoardSectionClass(board, newSection, nextClass);
  };

  // Handle cascading Class change within the selected Section
  const handleClassChange = (newClass: string) => {
    const inferredSec = inferSectionFromClass(newClass);
    syncSelectionForBoardSectionClass(board, inferredSec, newClass);
  };

  // Handle cascading Subject change (only updates form fields, does NOT auto-show lesson plan)
  const handleSubjectChange = (newSubj: string) => {
    setSubject(newSubj);
    setHasGeneratedPlan(false);
    setStatusBanner(null);
    const matchesForSubj = sheetLessons.filter(
      (i) =>
        i.board.toLowerCase() === board.toLowerCase() &&
        i.className.toLowerCase() === className.toLowerCase() &&
        i.subject.toLowerCase() === newSubj.toLowerCase()
    );
    if (matchesForSubj.length > 0) {
      setChapter(matchesForSubj[0].chapter);
      setTopic(matchesForSubj[0].topic);
    } else {
      setChapter('');
      setTopic('');
    }
  };

  // Handle cascading Chapter change (only updates form fields, does NOT auto-show lesson plan)
  const handleChapterChange = (newChap: string) => {
    setChapter(newChap);
    setHasGeneratedPlan(false);
    setStatusBanner(null);
    const matchesForChap = sheetLessons.filter(
      (i) =>
        i.board.toLowerCase() === board.toLowerCase() &&
        i.className.toLowerCase() === className.toLowerCase() &&
        i.subject.toLowerCase() === subject.toLowerCase() &&
        i.chapter.toLowerCase() === newChap.toLowerCase()
    );
    if (matchesForChap.length > 0) {
      setTopic(matchesForChap[0].topic);
    }
  };

  // Handle cascading Topic change (only updates form fields, does NOT auto-show lesson plan)
  const handleTopicChange = (newTopic: string) => {
    setTopic(newTopic);
    setHasGeneratedPlan(false);
    setStatusBanner(null);
  };

  // Batch Import All Google Sheet Rows into Firestore `syllabus_data`
  const handleImportAllGoogleSheetToFirestore = async () => {
    if (!currentUser) {
      onRequestSignIn();
      return;
    }

    if (sheetLessons.length === 0) return;

    setIsImporting(true);
    setImportProgress({ done: 0, total: sheetLessons.length });
    setStatusBanner(null);
    const collectionPath = 'syllabus_data';

    try {
      const chunkSize = 150;
      for (let start = 0; start < sheetLessons.length; start += chunkSize) {
        const chunk = sheetLessons.slice(start, start + chunkSize);
        const batch = writeBatch(db);

        for (const item of chunk) {
          const docId = getSyllabusDocId(
            item.board,
            item.className,
            item.subject,
            item.chapter,
            item.topic
          );
          const sanitized = sanitizeLessonPlanForFirestore(
            {
              board: item.board,
              section: item.section,
              className: item.className,
              subject: item.subject,
              chapter: item.chapter,
              topic: item.topic,
              duration: item.duration,
              planType: item.planType,
            },
            item,
            currentUser.uid
          );

          batch.set(
            doc(db, collectionPath, docId),
            sanitizeFirestoreData({
              ...sanitized,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
        }

        await batch.commit();
        setImportProgress({
          done: Math.min(start + chunk.length, sheetLessons.length),
          total: sheetLessons.length,
        });
      }

      await refreshFirestoreCount();
      setDataSource('firestore');
      setStatusBanner(
        `Successfully imported all ${sheetLessons.length} Google Sheet lesson plans into Firebase Firestore collection "syllabus_data"!`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, collectionPath);
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  // Generate / Fetch Lesson Plan (1. Firestore syllabus_data -> 2. Google Sheet Index -> 3. Gemini AI calibrated to Board & Class)
  const handleGenerateLessonPlan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const isHssc = section === 'Higher Secondary' || ['Class 11', 'Class 12'].includes(className);
    const isSsc = section === 'Secondary' || ['Class 9', 'Class 10'].includes(className);
    const cleanSubject = subject.trim() || (isHssc ? 'Physics' : isSsc ? 'Physics' : 'General Science');
    const cleanChapter = chapter.trim() || (isHssc ? 'Chapter 12: Electrostatics' : isSsc ? 'Chapter 2: Kinematics' : 'Chapter 1');
    const cleanTopic = topic.trim() || (isHssc ? "Coulomb's Law & Electric Field Intensity" : isSsc ? 'Motion & Velocity' : 'Living and Non-Living Things');

    if (!subject.trim()) setSubject(cleanSubject);
    if (!chapter.trim()) setChapter(cleanChapter);
    if (!topic.trim()) setTopic(cleanTopic);

    setIsGenerating(true);
    setStatusBanner(null);

    const docId = getSyllabusDocId(board, className, cleanSubject, cleanChapter, cleanTopic);
    const docPath = `syllabus_data/${docId}`;

    try {
      // Step 1: Query Firestore `syllabus_data` first (strictly matching Board, Class, Subject, and Topic)
      let foundFirestoreDoc: Record<string, unknown> | null = null;
      try {
        const docSnap = await getDoc(doc(db, 'syllabus_data', docId));
        if (docSnap.exists()) {
          foundFirestoreDoc = docSnap.data() as Record<string, unknown>;
        } else {
          const q = query(
            collection(db, 'syllabus_data'),
            where('visibility', '==', 'public'),
            where('board', '==', board),
            where('className', '==', className),
            where('subject', '==', cleanSubject),
            where('topic', '==', cleanTopic)
          );
          const querySnap = await getDocs(q);
          if (!querySnap.empty) {
            foundFirestoreDoc = querySnap.docs[0].data() as Record<string, unknown>;
          }
        }
      } catch (firestoreReadErr) {
        console.warn('Firestore lookup warning:', firestoreReadErr);
      }

      if (foundFirestoreDoc) {
        setLessonContent({
          slos: String(foundFirestoreDoc.slos || ''),
          previousKnowledge: String(foundFirestoreDoc.previousKnowledge || ''),
          teachingAids: String(foundFirestoreDoc.teachingAids || ''),
          introduction: String(foundFirestoreDoc.introduction || ''),
          procedure: String(foundFirestoreDoc.procedure || ''),
          teacherActivities: String(foundFirestoreDoc.teacherActivities || ''),
          studentActivities: String(foundFirestoreDoc.studentActivities || ''),
          assessment: String(foundFirestoreDoc.assessment || ''),
          homework: String(foundFirestoreDoc.homework || ''),
          vocabulary: String(foundFirestoreDoc.vocabulary || ''),
          lifeSkills: String(foundFirestoreDoc.lifeSkills || ''),
          teacherReflection: String(foundFirestoreDoc.teacherReflection || ''),
          questions: String(foundFirestoreDoc.questions || foundFirestoreDoc.assessment || ''),
          exercise: String(foundFirestoreDoc.exercise || foundFirestoreDoc.worksheetPrompt || ''),
          worksheetPrompt: String(foundFirestoreDoc.worksheetPrompt || ''),
          bloomAssessment: String(foundFirestoreDoc.bloomAssessment || ''),
        });
        setDataSource('firestore');
        setHasGeneratedPlan(true);
        setStatusBanner(
          `Fetched directly from Firebase Firestore collection "syllabus_data" (${board} · ${className} · ${cleanSubject} · ${cleanTopic}).`
        );
        setIsGenerating(false);
        return;
      }

      // Step 2: Check imported Google Sheet dataset (strictly matching Board + Class + Subject + Topic)
      const sheetMatch =
        sheetLessons.find(
          (item) =>
            item.board.toLowerCase() === board.toLowerCase() &&
            item.className.toLowerCase() === className.toLowerCase() &&
            item.subject.toLowerCase() === cleanSubject.toLowerCase() &&
            item.topic.toLowerCase() === cleanTopic.toLowerCase()
        ) ||
        sheetLessons.find(
          (item) =>
            item.board.toLowerCase() === board.toLowerCase() &&
            item.className.toLowerCase() === className.toLowerCase() &&
            item.topic.toLowerCase() === cleanTopic.toLowerCase()
        );

      if (sheetMatch) {
        applyPresetLessonContent(sheetMatch, 'google-sheet');
        setHasGeneratedPlan(true);

        // If user is signed in, automatically persist this Google Sheet entry to Firestore `syllabus_data`
        if (currentUser && currentUser.emailVerified) {
          const sanitized = sanitizeLessonPlanForFirestore(
            {
              board,
              section: sheetMatch.section,
              className: sheetMatch.className,
              subject: sheetMatch.subject,
              chapter: sheetMatch.chapter,
              topic: sheetMatch.topic,
              duration,
              planType,
            },
            sheetMatch,
            currentUser.uid
          );
          if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            await enqueueOfflineMutation({
              entityType: 'lessonPlan',
              action: 'upsert',
              operation: 'saveLessonPlan',
              schoolId: 'global',
              userId: currentUser.uid,
              docPath,
              recordId: docId,
              recordLabel: `Lesson Plan · ${sheetMatch.subject} (${sheetMatch.topic})`,
              payload: sanitized,
            });
            // Offline plan queued locally in IndexedDB sync queue
            setStatusBanner(
              `Saved locally offline (${board} · ${sheetMatch.className} · ${sheetMatch.topic}) — queued to sync when online.`
            );
          } else {
            try {
              await setDoc(
                doc(db, 'syllabus_data', docId),
                sanitizeFirestoreData({
                  ...sanitized,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                })
              );
              await refreshFirestoreCount();
              setDataSource('firestore');
              setStatusBanner(
                `Loaded from Database & synced to Firestore "syllabus_data" (${board} · ${sheetMatch.className} · ${sheetMatch.subject} · ${sheetMatch.topic}).`
              );
            } catch (writeErr) {
              const code = (writeErr as any)?.code || '';
              if (
                (typeof navigator !== 'undefined' && navigator.onLine === false) ||
                code === 'unavailable'
              ) {
                await enqueueOfflineMutation({
                  entityType: 'lessonPlan',
                  action: 'upsert',
                  operation: 'saveLessonPlan',
                  schoolId: 'global',
                  userId: currentUser.uid,
                  docPath,
                  recordId: docId,
                  recordLabel: `Lesson Plan · ${sheetMatch.subject} (${sheetMatch.topic})`,
                  payload: sanitized,
                });
                setStatusBanner(
                  `Saved locally (${board} · ${sheetMatch.topic}) — queued to sync when online.`
                );
              } else {
                handleFirestoreError(writeErr, OperationType.CREATE, docPath);
              }
            }
          }
        } else {
          setStatusBanner(
            `Loaded exact match from curriculum database (${board} · ${sheetMatch.className} · ${sheetMatch.subject} · ${sheetMatch.topic}).`
          );
        }
        setIsGenerating(false);
        return;
      }

      // Step 3: If not in Firestore or Google Sheet, generate dynamically via Backend AI (/api/generate-lesson-plan)
      let generatedPlan: LessonPlanContent | null = null;

      try {
        const idToken = currentUser ? await currentUser.getIdToken() : '';
        const response = await fetch('/api/generate-lesson-plan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          },
          body: JSON.stringify({
            board,
            section,
            className,
            subject: cleanSubject,
            chapter: cleanChapter,
            topic: cleanTopic,
            duration,
            planType,
          }),
        });

        const rawText = await response.text();
        let result: { plan?: LessonPlanContent; error?: string } | null = null;
        try {
          if (!rawText.trimStart().toLowerCase().startsWith('<!doctype') && !rawText.trimStart().toLowerCase().startsWith('<html')) {
            result = JSON.parse(rawText);
          }
        } catch {
          result = null;
        }

        if (response.ok && result?.plan) {
          generatedPlan = result.plan;
        } else {
          console.warn('Backend endpoint returned error or empty response:', result?.error || response.status);
        }
      } catch (backendFetchErr) {
        console.warn('Backend endpoint fetch error, using local template fallback:', backendFetchErr);
      }

      // If backend was unreachable or returned an error, fallback to safe local/offline template (No client-side API key)
      if (!generatedPlan) {
        generatedPlan = buildLocalOfflineTemplatePlan({
          board,
          section,
          className,
          subject: cleanSubject,
          chapter: cleanChapter,
          topic: cleanTopic,
          duration,
          planType,
        });
        setStatusBanner(
          'Generated from institutional offline curriculum template (Server AI unavailable).'
        );
      }

      const finalizedPlan: LessonPlanContent = {
        ...generatedPlan,
        questions: generatedPlan.questions || generatedPlan.assessment || '',
        exercise: generatedPlan.exercise || generatedPlan.worksheetPrompt || '',
      };
      setLessonContent(finalizedPlan);
      setDataSource('gemini-ai');
      setHasGeneratedPlan(true);

        if (currentUser && currentUser.emailVerified) {
          const sanitized = sanitizeLessonPlanForFirestore(
            {
              board,
              section,
              className,
              subject: cleanSubject,
              chapter: cleanChapter,
              topic: cleanTopic,
              duration,
              planType,
            },
            generatedPlan,
            currentUser.uid
          );
          if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            await enqueueOfflineMutation({
              entityType: 'lessonPlan',
              action: 'upsert',
              operation: 'saveLessonPlan',
              schoolId: 'global',
              userId: currentUser.uid,
              docPath,
              recordId: docId,
              recordLabel: `Lesson Plan · ${cleanSubject} (${cleanTopic})`,
              payload: sanitized,
            });
            // Offline plan queued locally in IndexedDB sync queue
            setStatusBanner(
              `Offline mode: Saved lesson plan locally (${board} · ${cleanTopic}) and queued to sync when online.`
            );
          } else {
            try {
              await setDoc(
                doc(db, 'syllabus_data', docId),
                sanitizeFirestoreData({
                  ...sanitized,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                })
              );
              await refreshFirestoreCount();
              setStatusBanner(
                `Generated via AI calibrated for ${board} — ${className} (${section}) difficulty and saved to Firestore "syllabus_data".`
              );
            } catch (writeErr) {
              const code = (writeErr as any)?.code || '';
              if (
                (typeof navigator !== 'undefined' && navigator.onLine === false) ||
                code === 'unavailable'
              ) {
                await enqueueOfflineMutation({
                  entityType: 'lessonPlan',
                  action: 'upsert',
                  operation: 'saveLessonPlan',
                  schoolId: 'global',
                  userId: currentUser.uid,
                  docPath,
                  recordId: docId,
                  recordLabel: `Lesson Plan · ${cleanSubject} (${cleanTopic})`,
                  payload: sanitized,
                });
                setStatusBanner(
                  `Saved lesson plan locally (${board} · ${cleanTopic}) — queued to sync when online.`
                );
              } else {
                handleFirestoreError(writeErr, OperationType.CREATE, docPath);
              }
            }
          }
        } else {
          setStatusBanner(
            `Not in database — dynamically generated via AI strictly calibrated for ${board} · ${className} (${section} difficulty level).`
          );
        }
    } catch (err) {
      console.error('Error generating lesson plan:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Filtered lessons for the Google Sheet Data Explorer Modal/Table
  const filteredExplorerLessons = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sheetLessons.slice(0, 100);
    return sheetLessons
      .filter(
        (item) =>
          item.className.toLowerCase().includes(q) ||
          item.subject.toLowerCase().includes(q) ||
          item.chapter.toLowerCase().includes(q) ||
          item.topic.toLowerCase().includes(q) ||
          item.slos.toLowerCase().includes(q)
      )
      .slice(0, 100);
  }, [sheetLessons, searchQuery]);

  const isContentRtl = useMemo(() => {
    return (
      hasRtlScript(lessonContent.slos) ||
      hasRtlScript(lessonContent.introduction) ||
      hasRtlScript(topic)
    );
  }, [lessonContent.slos, lessonContent.introduction, topic]);

  const sloList = lessonContent.slos
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const procedureList = lessonContent.procedure
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const vocabItems = parseVocabularyList(lessonContent.vocabulary);
  const bloomQuestions = parseBloomAssessment(lessonContent.bloomAssessment);
  const worksheetQuestions = (lessonContent.exercise || lessonContent.worksheetPrompt)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const questionItems = (lessonContent.questions || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Google Sheet & Firestore Database Importer Bar (Hidden in Print) */}
      <div className="no-print bg-[#FFFDF9] border border-[#E7E0D4] rounded-xl p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#00563B]">
              <Database className="w-4 h-4 shrink-0" />
              <span>Firestore Collection: syllabus_data</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {firestoreCount !== null ? `${firestoreCount} Docs in Firestore` : 'Connected'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums font-semibold">
                {isLoadingSheet
                  ? 'Loading Google Sheet TSVs...'
                  : `${sheetLessons.length} Sindh STBB Topics Indexed (KG–Class 8)`}
              </span>
            </div>
            <h2 className="text-base font-bold text-[#1C1917] mt-1">
              Curriculum Database &amp; AI Lesson Plan Engine (Sindh STBB &amp; Punjab PTB)
            </h2>
            <p className="text-xs text-[#57534E] mt-0.5">
              Select your Board, Section, Class, Subject, Chapter &amp; Topic below, then click <strong>Generate Lesson Plan</strong>. If the topic exists in the database it is fetched directly; otherwise AI generates a Board- &amp; Class-difficulty calibrated lesson plan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowDataExplorer(!showDataExplorer)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#44403C] bg-[#F3EFEA] hover:bg-[#E7E0D4] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Table className="w-4 h-4 text-[#00563B]" />
              {showDataExplorer ? 'Hide Sheet Browser' : `Browse ${sheetLessons.length} Sheet Topics`}
            </button>

            <button
              type="button"
              onClick={handleImportAllGoogleSheetToFirestore}
              disabled={isImporting || isLoadingSheet}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#00563B] hover:bg-[#0F5E30] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <UploadCloud className="w-4 h-4" />
              {isImporting && importProgress
                ? `Importing to Firestore (${importProgress.done}/${importProgress.total})...`
                : currentUser
                ? `Import All ${sheetLessons.length} Rows to Firestore`
                : `Sign In & Import All ${sheetLessons.length} Rows to Firestore`}
            </button>
          </div>
        </div>

        {/* Progress Bar during Batch Import */}
        {isImporting && importProgress && (
          <div className="mt-4">
            <div className="flex justify-between text-xs font-mono text-[#00563B] mb-1">
              <span>Writing batch to /syllabus_data...</span>
              <span>
                {importProgress.done} / {importProgress.total} (
                {Math.round((importProgress.done / importProgress.total) * 100)}%)
              </span>
            </div>
            <div className="w-full h-2 bg-[#F3EFEA] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#00563B] transition-all duration-200"
                style={{
                  width: `${Math.round((importProgress.done / importProgress.total) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {statusBanner && (
          <div className="mt-3.5 flex items-center gap-2 text-xs text-[#00563B] bg-emerald-50/80 border border-emerald-200 rounded-lg px-3.5 py-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#00563B]" />
            <span>{statusBanner}</span>
          </div>
        )}

        {/* Interactive Google Sheet Data Browser */}
        {showDataExplorer && (
          <div className="mt-4 pt-4 border-t border-[#E7E0D4] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Class (e.g. KG, Class 4), Subject (Sindhi, Urdu, English, Math), Chapter, or Topic..."
                  className="w-full pl-9 pr-4 py-2 text-xs bg-[#FAF8F5] border border-[#D6CCC2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00563B] focus:bg-[#FFFDF9]"
                />
              </div>
              <span className="text-xs text-[#57534E] font-mono whitespace-nowrap">
                Showing {filteredExplorerLessons.length} of {sheetLessons.length} rows
              </span>
            </div>

            <div className="max-h-72 overflow-y-auto overflow-x-auto border border-[#E7E0D4] rounded-lg w-full">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#F3EFEA] sticky top-0 border-b border-[#E7E0D4] text-[#44403C]">
                  <tr>
                    <th className="py-2 px-3 font-semibold">Class</th>
                    <th className="py-2 px-3 font-semibold">Subject</th>
                    <th className="py-2 px-3 font-semibold">Chapter</th>
                    <th className="py-2 px-3 font-semibold">Topic</th>
                    <th className="py-2 px-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E0D4]">
                  {filteredExplorerLessons.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => {
                        populateFieldsFromPreset(item);
                        setHasGeneratedPlan(false);
                        setShowDataExplorer(false);
                        setStatusBanner(
                          `Selected "${item.topic}" (${item.className} · ${item.subject}). Now click "Generate Lesson Plan" below to view the complete lesson plan.`
                        );
                      }}
                      className="hover:bg-emerald-50/60 cursor-pointer transition-colors"
                    >
                      <td className="py-2 px-3 font-semibold text-[#1C1917] whitespace-nowrap">
                        {item.className}
                      </td>
                      <td className="py-2 px-3 text-[#00563B] font-medium whitespace-nowrap">
                        {item.subject}
                      </td>
                      <td className="py-2 px-3 text-[#57534E] max-w-48 truncate">
                        {item.chapter}
                      </td>
                      <td className="py-2 px-3 font-semibold text-[#1C1917] max-w-64 truncate">
                        {item.topic}
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-[#00563B] font-semibold">
                          Select Topic <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Lesson Plan Input Form (Hidden in Print) */}
      <form
        onSubmit={handleGenerateLessonPlan}
        className="no-print bg-[#FFFDF9] border border-[#E7E0D4] rounded-xl p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#E7E0D4]">
          <div>
            <h3 className="text-lg font-bold text-[#1C1917]">
              AI Lesson Plan Configuration
            </h3>
            <p className="text-xs text-[#57534E] mt-0.5">
              Select Board, Section, Class, Subject, Chapter, and Topic, then click <strong>Generate Lesson Plan</strong>.
            </p>
          </div>
          <div className="text-xs text-[#57534E] font-mono">
            {board} · {section} ({className}) · {planType} ({duration})
          </div>
        </div>

        {/* 12 Required Form Inputs in Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Teacher Name */}
          <div>
            <label className="block text-xs font-semibold text-[#44403C] mb-1.5">
              1. Teacher Name
            </label>
            <input
              type="text"
              required
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              placeholder="e.g., Ustad Ahmed Ali"
              className="w-full px-3 py-2 text-sm bg-[#FAF8F5] border border-[#D6CCC2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00563B] focus:bg-[#FFFDF9]"
            />
          </div>

          {/* 2. Mobile Number */}
          <div>
            <label className="block text-xs font-semibold text-[#44403C] mb-1.5">
              2. Mobile Number
            </label>
            <input
              type="text"
              required
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              placeholder="0300-1234567"
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#FAF8F5] border border-[#D6CCC2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00563B] focus:bg-[#FFFDF9]"
            />
          </div>

          {/* 3. School Name */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[#44403C] mb-1.5">
              3. School Name
            </label>
            <input
              type="text"
              required
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="e.g., GBHS Latifabad No. 7, Hyderabad"
              className="w-full px-3 py-2 text-sm bg-[#FAF8F5] border border-[#D6CCC2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00563B] focus:bg-[#FFFDF9]"
            />
          </div>

          {/* 4. Start Date */}
          <div>
            <label className="block text-xs font-semibold text-[#44403C] mb-1.5">
              4. Start Date
            </label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#FAF8F5] border border-[#D6CCC2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00563B] focus:bg-[#FFFDF9]"
            />
          </div>

          {/* 5. Duration */}
          <div>
            <label className="block text-xs font-semibold text-[#44403C] mb-1.5">
              5. Duration
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#FAF8F5] border border-[#D6CCC2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00563B] focus:bg-[#FFFDF9]"
            >
              <option value="35 Minutes">35 Minutes</option>
              <option value="40 Minutes">40 Minutes</option>
              <option value="45 Minutes">45 Minutes</option>
              <option value="60 Minutes">60 Minutes (Double Period)</option>
              <option value="1 Week (5 Periods)">1 Week (5 Periods)</option>
            </select>
          </div>

          {/* 6. Plan Type */}
          <div>
            <label className="block text-xs font-semibold text-[#44403C] mb-1.5">
              6. Plan Type
            </label>
            <select
              value={planType}
              onChange={(e) => setPlanType(e.target.value as 'Daily' | 'Weekly')}
              className="w-full px-3 py-2 text-sm bg-[#FAF8F5] border border-[#D6CCC2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00563B] focus:bg-[#FFFDF9]"
            >
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
            </select>
          </div>

          {/* 7. Select Board */}
          <div>
            <label className="block text-xs font-semibold text-[#44403C] mb-1.5">
              7. Select Board
            </label>
            <select
              value={board}
              onChange={(e) => handleBoardChange(e.target.value as 'Sindh STBB' | 'Punjab PTB')}
              className="w-full px-3 py-2 text-sm font-semibold text-[#00563B] bg-emerald-50/50 border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00563B] focus:bg-[#FFFDF9]"
            >
              <option value="Sindh STBB">Sindh STBB (Jamshoro)</option>
              <option value="Punjab PTB">Punjab PTB (Lahore)</option>
            </select>
          </div>

          {/* 8. Section (Strictly filters Class options in #9) */}
          <div>
            <label className="block text-xs font-semibold text-[#44403C] mb-1.5">
              8. Section
            </label>
            <select
              value={section}
              onChange={(e) =>
                handleSectionChange(
                  e.target.value as 'Primary' | 'Middle' | 'Secondary' | 'Higher Secondary'
                )
              }
              className="w-full px-3 py-2 text-sm font-semibold text-[#00563B] bg-emerald-50/50 border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00563B] focus:bg-[#FFFDF9]"
            >
              <option value="Primary">Primary (KG – Class 5)</option>
              <option value="Middle">Middle (Class 6 – Class 8)</option>
              <option value="Secondary">Secondary (Class 9 – Class 10)</option>
              <option value="Higher Secondary">Higher Secondary (Class 11 – Class 12)</option>
            </select>
          </div>

          {/* 9. Class (Strictly shows ONLY classes belonging to the selected Section) */}
          <div>
            <label className="block text-xs font-semibold text-[#44403C] mb-1.5">
              9. Class ({section} Section Only)
            </label>
            <select
              value={className}
              onChange={(e) => handleClassChange(e.target.value)}
              className="w-full px-3 py-2 text-sm font-semibold text-[#00563B] bg-emerald-50/50 border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00563B] focus:bg-[#FFFDF9]"
            >
              {classesForSelectedSection.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* 10. Subject (Cascading from Board + Class, or Blank with Example when unavailable) */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[#44403C] mb-1.5">
              10. Subject{' '}
              {hasDatabaseContentForClass
                ? `(${subjectsForClass.length} Available in ${board} for ${className})`
                : `(AI Mode for ${board} · ${className} — Type Subject Below)`}
            </label>
            {hasDatabaseContentForClass ? (
              <div className="space-y-1.5">
                <select
                  value={subjectsForClass.includes(subject) ? subject : ''}
                  onChange={(e) => {
                    if (e.target.value) handleSubjectChange(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-sm font-medium bg-emerald-50/50 border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00563B] focus:bg-[#FFFDF9]"
                >
                  <option value="" disabled>
                    -- Select Subject from Database --
                  </option>
                  {subjectsForClass.map((subj) => (
                    <option key={subj} value={subj}>
                      {subj}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  list="subject-suggestions"
                  required
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    setHasGeneratedPlan(false);
                  }}
                  placeholder={fieldExamples.subjectPlaceholder}
                  className="w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#D6CCC2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00563B] focus:bg-[#FFFDF9]"
                />
              </div>
            ) : (
              <>
                <input
                  type="text"
                  list="subject-suggestions"
                  required
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    setHasGeneratedPlan(false);
                  }}
                  placeholder={fieldExamples.subjectPlaceholder}
                  className="w-full px-3 py-2 text-sm bg-[#FAF8F5] border border-[#D6CCC2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00563B] focus:bg-[#FFFDF9]"
                />
                <span className="block text-[11px] text-[#57534E] mt-1">
                  {fieldExamples.subjectPlaceholder}
                </span>
              </>
            )}
            <datalist id="subject-suggestions">
              {SUBJECT_OPTIONS.map((subj) => (
                <option key={subj} value={subj} />
              ))}
            </datalist>
          </div>

          {/* 11. Chapter (Cascading Dropdown when available, or Blank with Example when unavailable) */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[#44403C] mb-1.5">
              11. Chapter{' '}
              {chaptersForClassAndSubject.length > 0
                ? `(${chaptersForClassAndSubject.length} Available in Database)`
                : `(Enter Chapter Name / Number)`}
            </label>
            <div className="space-y-1.5">
              {chaptersForClassAndSubject.length > 0 && (
                <select
                  value={chaptersForClassAndSubject.includes(chapter) ? chapter : ''}
                  onChange={(e) => {
                    if (e.target.value) handleChapterChange(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-sm bg-emerald-50/50 border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00563B] focus:bg-[#FFFDF9]"
                >
                  <option value="" disabled>
                    -- Select Chapter from Database --
                  </option>
                  {chaptersForClassAndSubject.map((ch) => (
                    <option key={ch} value={ch}>
                      {ch}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                required
                value={chapter}
                onChange={(e) => {
                  setChapter(e.target.value);
                  setHasGeneratedPlan(false);
                }}
                placeholder={fieldExamples.chapterPlaceholder}
                className={`w-full px-3 ${
                  chaptersForClassAndSubject.length > 0 ? 'py-1.5 text-xs' : 'py-2 text-sm'
                } bg-[#FAF8F5] border border-[#D6CCC2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00563B] focus:bg-[#FFFDF9]`}
              />
              {chaptersForClassAndSubject.length === 0 && (
                <span className="block text-[11px] text-[#57534E]">
                  {fieldExamples.chapterPlaceholder}
                </span>
              )}
            </div>
          </div>

          {/* 12. Topic (Cascading Dropdown when available, or Blank with Example when unavailable) */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[#44403C] mb-1.5">
              12. Lesson Topic{' '}
              {topicsForSelection.length > 0
                ? `(${topicsForSelection.length} Available in Database)`
                : `(Enter Specific Lesson Topic)`}
            </label>
            <div className="space-y-1.5">
              {topicsForSelection.length > 0 && (
                <select
                  value={
                    topicsForSelection.some((t) => t.topic === topic) ? topic : ''
                  }
                  onChange={(e) => {
                    if (e.target.value) handleTopicChange(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-sm font-semibold text-[#00563B] bg-emerald-50/50 border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00563B] focus:bg-[#FFFDF9]"
                >
                  <option value="" disabled>
                    -- Select Topic from Database --
                  </option>
                  {topicsForSelection.map((item) => (
                    <option key={item.id} value={item.topic}>
                      {item.topic}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                required
                value={topic}
                onChange={(e) => {
                  setTopic(e.target.value);
                  setHasGeneratedPlan(false);
                }}
                placeholder={fieldExamples.topicPlaceholder}
                className={`w-full px-3 ${
                  topicsForSelection.length > 0 ? 'py-1.5 text-xs' : 'py-2 text-sm'
                } bg-[#FAF8F5] border border-[#D6CCC2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00563B] focus:bg-[#FFFDF9]`}
              />
              {topicsForSelection.length === 0 && (
                <span className="block text-[11px] text-[#57534E]">
                  {fieldExamples.topicPlaceholder}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Helper Banner when Selected Class/Board is not in Pre-loaded Sheet */}
        {!hasDatabaseContentForClass && (
          <div className="bg-[#FEF2F2]/90 dark:bg-[#3F1014]/40 border border-[#FECACA] dark:border-[#7F1D1D]/60 rounded-xl px-4 py-3.5 text-xs text-[#7F1D1D] dark:text-[#FCA5A5] space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold flex items-center gap-1.5 text-[#7F1D1D] dark:text-[#FCA5A5]">
                <Sparkles className="w-4 h-4 text-[#7F1D1D] dark:text-[#FCA5A5]" />
                <span>AI Lesson Generator Active: {board} — {className} ({section})</span>
              </div>
              <button
                type="button"
                onClick={() => handleGenerateLessonPlan()}
                disabled={isGenerating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#7F1D1D] hover:bg-[#651414] active:scale-95 rounded-lg shadow-sm transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isGenerating ? 'Generating with AI...' : '✨ Generate with Gemini AI Now'}</span>
              </button>
            </div>
            <p className="text-[#57534E] dark:text-[#E7E0D4] leading-relaxed">
              Pre-loaded static sheet data is not found, but AI Lesson Generation is fully active! Enter your custom topic above or click <strong>Generate with Gemini AI Now</strong> to create a complete board-aligned lesson plan featuring 5 Q&amp;As, 8 Word Meanings, and 3 Exercises.
            </p>
            <p className="text-[11px] text-[#7F1D1D] dark:text-[#FCA5A5]">
              <strong>Curriculum Profile:</strong> {difficultyProfile.cognitiveLevel} · {difficultyProfile.boardStandard}
            </p>
          </div>
        )}

        <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-[#57534E]">
            Firestore Document ID:{' '}
            <code className="font-mono text-[#44403C] bg-[#F3EFEA] px-1.5 py-0.5 rounded">
              {getSyllabusDocId(
                board,
                className,
                subject || 'subject',
                chapter || 'chapter',
                topic || 'topic'
              )}
            </code>
          </div>
          <button
            type="submit"
            disabled={isGenerating}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#00563B] hover:bg-[#0F5E30] rounded-lg transition-colors shadow-xs cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Fetching from Database / AI...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Lesson Plan
              </>
            )}
          </button>
        </div>
      </form>

      {/* Requirement 2: Only display Action Buttons and Printable A4 Lesson Plan AFTER clicking "Generate Lesson Plan" */}
      {!hasGeneratedPlan ? (
        <div className="no-print bg-[#FFFDF9] border border-dashed border-[#D6CCC2] rounded-xl p-8 text-center space-y-2">
          <div className="w-11 h-11 rounded-full bg-emerald-50 text-[#00563B] flex items-center justify-center mx-auto">
            <BookOpen className="w-5 h-5" />
          </div>
          <h4 className="text-base font-bold text-[#1C1917]">
            Ready to Generate Your {board} ({className}) Lesson Plan
          </h4>
          <p className="text-xs text-[#57534E] max-w-xl mx-auto leading-relaxed">
            Configure your <strong>Board ({board})</strong>, <strong>Section ({section})</strong>,{' '}
            <strong>Class ({className})</strong>, <strong>Subject</strong>, <strong>Chapter</strong>,
            and <strong>Lesson Topic</strong> above, then click{' '}
            <span className="font-semibold text-[#00563B]">&ldquo;Generate Lesson Plan&rdquo;</span>{' '}
            to fetch from the database or dynamically generate via AI according to your selected Board
            and Class difficulty level.
          </p>
        </div>
      ) : (
        <>
          {/* Action Buttons Bar (After Generation - Hidden in Print) */}
          <div className="no-print bg-[#FFFDF9] border border-[#E7E0D4] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveView('lesson-plan')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeView === 'lesson-plan'
                    ? 'bg-[#00563B] text-white'
                    : 'bg-[#F3EFEA] text-[#44403C] hover:bg-[#E7E0D4]'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                Lesson Plan (All Sections)
              </button>

              <button
                type="button"
                onClick={() => setActiveView('flashcards')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeView === 'flashcards'
                    ? 'bg-[#00563B] text-white'
                    : 'bg-[#F3EFEA] text-[#44403C] hover:bg-[#E7E0D4]'
                }`}
              >
                <Layers className="w-4 h-4" />
                🎓 Flash Cards ({vocabItems.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveView('worksheet')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeView === 'worksheet'
                    ? 'bg-[#00563B] text-white'
                    : 'bg-[#F3EFEA] text-[#44403C] hover:bg-[#E7E0D4]'
                }`}
              >
                <FileText className="w-4 h-4" />
                📝 Worksheet
              </button>

              <button
                type="button"
                onClick={() => setActiveView('assessment')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeView === 'assessment'
                    ? 'bg-[#00563B] text-white'
                    : 'bg-[#F3EFEA] text-[#44403C] hover:bg-[#E7E0D4]'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                📊 Assessment
              </button>
            </div>

            <button
              type="button"
              onClick={triggerPrintDocument}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#2C1215] hover:bg-[#58181D] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              📥 Download PDF / Print A4
            </button>
          </div>

          {/* =================================================================== */}
          {/* PRINTABLE A4 DOCUMENT CONTAINER                                     */}
          {/* =================================================================== */}
          <div className="printable-a4-sheet bg-white border border-[#E7E0D4] rounded-xl p-6 sm:p-8 shadow-xs">
            {/* Official Institutional Header */}
            <div className="border-b-2 border-[#00563B] pb-4 mb-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold tracking-wider uppercase text-[#00563B]">
                    {board === 'Sindh STBB'
                      ? 'School Education & Literacy Department · Sindh Textbook Board (STBB)'
                      : 'School Education Department · Punjab Curriculum & Textbook Board (PTB)'}
                  </p>
                  <h1 className="text-xl sm:text-2xl font-bold text-[#1C1917] mt-0.5">
                    {activeView === 'lesson-plan' && `${planType} Instructional Lesson Plan`}
                    {activeView === 'flashcards' && `Printable Vocabulary Flash Cards`}
                    {activeView === 'worksheet' && `Student Activity & Creative Worksheet`}
                    {activeView === 'assessment' && `Bloom's Taxonomy Cognitive Assessment`}
                  </h1>
                </div>
                <div className="text-left sm:text-right text-xs text-[#57534E] font-mono tabular-nums">
                  <div>Date: {startDate}</div>
                  <div>Duration: {duration}</div>
                  <div className="no-print text-[11px] text-[#00563B] font-semibold mt-0.5">
                    Source:{' '}
                    {dataSource === 'firestore'
                      ? 'Firestore (syllabus_data)'
                      : dataSource === 'gemini-ai'
                      ? `AI Calibrated (${board} · ${className})`
                      : 'Curriculum Database (syllabus_data)'}
                  </div>
                </div>
              </div>

              {/* Teacher & Class Metadata Strip */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-[#E7E0D4] rounded-lg p-3 text-xs">
                <div>
                  <span className="text-[#57534E] block">Teacher Name:</span>
                  <span className="font-semibold text-[#1C1917]">{teacherName}</span>
                </div>
                <div>
                  <span className="text-[#57534E] block">Mobile Number:</span>
                  <span className="font-semibold font-mono tabular-nums text-[#1C1917]">
                    {mobileNumber}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-[#57534E] block">School / Institution:</span>
                  <span className="font-semibold text-[#1C1917]">{schoolName}</span>
                </div>
                <div>
                  <span className="text-[#57534E] block">Board &amp; Section:</span>
                  <span className="font-semibold text-[#1C1917]">
                    {board} ({section})
                  </span>
                </div>
                <div>
                  <span className="text-[#57534E] block">Class &amp; Subject:</span>
                  <span className="font-semibold text-[#1C1917]">
                    {className} · {subject}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-[#57534E] block">Chapter &amp; Topic:</span>
                  <span
                    dir={hasRtlScript(`${chapter} ${topic}`) ? 'rtl' : 'ltr'}
                    className="font-semibold text-[#00563B] block"
                  >
                    {chapter} — {topic}
                  </span>
                </div>
              </div>
            </div>

        {/* VIEW 1: COMPLETE LESSON PLAN (12 Core Sections + Questions & Exercise from Google Sheet) */}
        {activeView === 'lesson-plan' && (
          <div
            dir={isContentRtl ? 'rtl' : 'ltr'}
            className="space-y-4 text-sm text-[#1C1917]"
          >
            {/* 1. SLOs */}
            <section className="border border-[#E7E0D4] rounded-lg p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#00563B] mb-2">
                1. SLOs (Student Learning Outcomes / حاصلاتِ تعلم)
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#1C1917] leading-relaxed">
                {sloList.map((slo, idx) => (
                  <li key={idx}>{slo.replace(/^[-•*]\s*/, '')}</li>
                ))}
              </ul>
            </section>

            {/* 2. Previous Knowledge & 3. Teaching Aids */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <section className="border border-[#E7E0D4] rounded-lg p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#00563B] mb-2">
                  2. Previous Knowledge (سابقہ معلومات)
                </h3>
                <p className="leading-relaxed text-[#44403C]">{lessonContent.previousKnowledge}</p>
              </section>

              <section className="border border-[#E7E0D4] rounded-lg p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#00563B] mb-2">
                  3. Teaching Aids (تدریسی معاونات)
                </h3>
                <p className="leading-relaxed text-[#44403C]">{lessonContent.teachingAids}</p>
              </section>
            </div>

            {/* 4. Introduction */}
            <section className="border border-[#E7E0D4] rounded-lg p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#00563B] mb-2">
                4. Introduction (تعارف / تمہید)
              </h3>
              <p className="leading-relaxed text-[#44403C]">{lessonContent.introduction}</p>
            </section>

            {/* 5. Procedure (List) */}
            <section className="border border-[#E7E0D4] rounded-lg p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#00563B] mb-2">
                5. Procedure (طریقہ کار / تدریسی مراحل)
              </h3>
              <ol className="list-decimal list-inside space-y-1.5 text-[#1C1917] leading-relaxed">
                {procedureList.map((step, idx) => (
                  <li key={idx}>
                    {step.replace(/^(Step\s*\d+[:.)]?\s*|\d+[.)]\s*)/i, '')}
                  </li>
                ))}
              </ol>
            </section>

            {/* 6. Teacher Activities & 7. Student Activities */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <section className="border border-[#E7E0D4] rounded-lg p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#00563B] mb-2">
                  6. Teacher Activities (استاد کی سرگرمیاں)
                </h3>
                <p className="leading-relaxed text-[#44403C]">{lessonContent.teacherActivities}</p>
              </section>

              <section className="border border-[#E7E0D4] rounded-lg p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#00563B] mb-2">
                  7. Student Activities (طلبہ کی سرگرمیاں)
                </h3>
                <p className="leading-relaxed text-[#44403C]">{lessonContent.studentActivities}</p>
              </section>
            </div>

            {/* 8. Assessment & 9. Homework */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <section className="border border-[#E7E0D4] rounded-lg p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#00563B] mb-2">
                  8. Assessment (جائزہ / تشخیص)
                </h3>
                <p className="leading-relaxed text-[#44403C]">{lessonContent.assessment}</p>
              </section>

              <section className="border border-[#E7E0D4] rounded-lg p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#00563B] mb-2">
                  9. Homework (گھر کا کام)
                </h3>
                <p className="leading-relaxed text-[#44403C]">{lessonContent.homework}</p>
              </section>
            </div>

            {/* 10. Vocabulary / Word Meanings */}
            <section className="border border-[#E7E0D4] rounded-lg p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#00563B] mb-2">
                10. Vocabulary &amp; Word Meanings (الفاظ معنی / نوان لفظ)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {vocabItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-50 border border-[#E7E0D4] rounded px-3 py-2 text-xs"
                  >
                    <span className="font-bold text-[#1C1917]">{item.term}:</span>{' '}
                    <span className="text-[#44403C]">{item.definition}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* 11. Life Skills & 12. Teacher's Reflection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <section className="border border-[#E7E0D4] rounded-lg p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#00563B] mb-2">
                  11. Life Skills (زندگی کی مہارتیں)
                </h3>
                <p className="leading-relaxed text-[#44403C]">{lessonContent.lifeSkills}</p>
              </section>

              <section className="border border-[#E7E0D4] rounded-lg p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#00563B] mb-2">
                  12. Teacher&apos;s Reflection (تاثرات / جائزہ)
                </h3>
                <p className="leading-relaxed text-[#44403C]">{lessonContent.teacherReflection}</p>
              </section>
            </div>

            {/* Additional Mapped Sheet Columns: Questions (Q&A) & Exercises */}
            {(questionItems.length > 0 || worksheetQuestions.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {questionItems.length > 0 && (
                  <section className="border border-[#E7E0D4] rounded-lg p-4 bg-slate-50/40">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#00563B] mb-2">
                      Questions &amp; Answers (سوال و جواب / Q&amp;A)
                    </h3>
                    <ul className="space-y-1.5 text-xs sm:text-sm text-[#1C1917] leading-relaxed">
                      {questionItems.map((q, idx) => (
                        <li key={idx}>{q}</li>
                      ))}
                    </ul>
                  </section>
                )}

                {worksheetQuestions.length > 0 && (
                  <section className="border border-[#E7E0D4] rounded-lg p-4 bg-slate-50/40">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#00563B] mb-2">
                      Exercises &amp; Practice (مشقی سرگرمیاں)
                    </h3>
                    <ul className="space-y-1.5 text-xs sm:text-sm text-[#1C1917] leading-relaxed">
                      {worksheetQuestions.map((ex, idx) => (
                        <li key={idx}>{ex}</li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}

            {/* Signature Footer for Official School Record */}
            <div
              dir="ltr"
              className="pt-6 mt-4 border-t border-[#E7E0D4] grid grid-cols-2 gap-8 text-xs text-[#57534E]"
            >
              <div>
                <div className="h-10 border-b border-[#C2B7A8] mb-1.5" />
                <p className="font-semibold text-[#1C1917]">Signature of Subject Teacher</p>
                <p>{teacherName}</p>
              </div>
              <div>
                <div className="h-10 border-b border-[#C2B7A8] mb-1.5" />
                <p className="font-semibold text-[#1C1917]">
                  Checked &amp; Verified By (Headmaster / Principal)
                </p>
                <p>{schoolName}</p>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: FLASH CARDS (Term on Left, Definition on Right, Dashed Cutting Line in Middle) */}
        {activeView === 'flashcards' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-[#57534E] bg-slate-50 border border-[#E7E0D4] rounded-lg px-4 py-2.5">
              <span>
                Classroom Cut-Out Activity: Cut along the horizontal card borders and fold or cut along the center vertical dashed line.
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-[#00563B]">
                <Scissors className="w-3.5 h-3.5" /> Cut / Fold Line
              </span>
            </div>

            <div className="space-y-3">
              {vocabItems.map((item, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 sm:grid-cols-2 border-2 border-dashed border-[#D6CCC2] rounded-xl overflow-hidden bg-white"
                >
                  {/* Left Side: Term */}
                  <div className="p-5 flex flex-col justify-center bg-[#00563B]/5 border-b-2 sm:border-b-0 sm:border-r-2 border-dashed border-[#C2B7A8] relative">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-[#00563B] font-semibold">
                      TERM #{idx + 1} · {subject}
                    </span>
                    <h4
                      dir={hasRtlScript(item.term) ? 'rtl' : 'ltr'}
                      className="text-lg font-bold text-[#1C1917] mt-1"
                    >
                      {item.term}
                    </h4>
                    <span className="hidden sm:flex items-center justify-center w-6 h-6 rounded-full bg-white border border-[#D6CCC2] text-[#57534E] absolute -right-3 top-1/2 -translate-y-1/2">
                      <Scissors className="w-3.5 h-3.5" />
                    </span>
                  </div>

                  {/* Right Side: Definition */}
                  <div className="p-5 flex flex-col justify-center bg-white">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-[#78716C] font-semibold">
                      DEFINITION / MEANING (معنی)
                    </span>
                    <p
                      dir={hasRtlScript(item.definition) ? 'rtl' : 'ltr'}
                      className="text-sm text-[#1C1917] leading-relaxed mt-1 font-medium"
                    >
                      {item.definition}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 3: STUDENT WORKSHEET (Dotted Lines for Writing + Creative Drawing Box) */}
        {activeView === 'worksheet' && (
          <div className="space-y-6 text-sm">
            {/* Student Fill-In Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border border-[#D6CCC2] rounded-lg p-3.5 bg-slate-50/50 text-xs">
              <div className="flex items-end gap-2">
                <span className="font-semibold text-[#44403C] shrink-0">Student Name:</span>
                <div className="flex-1 border-b border-dotted border-slate-500 h-5" />
              </div>
              <div className="flex items-end gap-2">
                <span className="font-semibold text-[#44403C] shrink-0">Roll No / Sec:</span>
                <div className="flex-1 border-b border-dotted border-slate-500 h-5" />
              </div>
              <div className="flex items-end gap-2">
                <span className="font-semibold text-[#44403C] shrink-0">Marks Obtained:</span>
                <div className="flex-1 border-b border-dotted border-slate-500 h-5 font-mono text-right">
                  / 20
                </div>
              </div>
            </div>

            {/* Part A: Written Questions & Exercises with Dotted Writing Lines */}
            <div
              dir={isContentRtl ? 'rtl' : 'ltr'}
              className="space-y-5"
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#00563B]">
                Part A: Exercises &amp; Short-Answer Questions (Write on the dotted lines)
              </h3>

              {worksheetQuestions.map((qText, idx) => (
                <div key={idx} className="space-y-2.5">
                  <p className="font-semibold text-[#1C1917]">
                    {qText}
                  </p>
                  <div className="space-y-2.5 pt-1">
                    <div className="border-b-2 border-dotted border-[#C2B7A8] h-6" />
                    <div className="border-b-2 border-dotted border-[#C2B7A8] h-6" />
                  </div>
                </div>
              ))}
            </div>

            {/* Part B: Vocabulary Quick Match */}
            <div
              dir={isContentRtl ? 'rtl' : 'ltr'}
              className="space-y-2.5"
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#00563B]">
                Part B: Key Terms &amp; Sentences Practice
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {vocabItems.slice(0, 5).map((v, i) => (
                  <div key={i} className="flex items-end gap-2 text-xs">
                    <span className="font-bold text-[#1C1917] w-40 shrink-0">
                      {i + 1}. {v.term}:
                    </span>
                    <div className="flex-1 border-b-2 border-dotted border-[#C2B7A8] h-5" />
                  </div>
                ))}
              </div>
            </div>

            {/* Part C: Creative Drawing & Diagram Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#00563B]">
                  Part C: Creative Drawing, Labeled Diagram &amp; Activity Box
                </h3>
                <span className="text-xs font-mono text-[#57534E]">5 Marks</span>
              </div>
              <div className="border-2 border-dashed border-[#00563B]/50 rounded-xl h-64 bg-slate-50/40 flex flex-col justify-between p-4">
                <p className="text-xs text-[#57534E] italic">
                  Draw and label a neat diagram, picture, or visual chart illustrating &ldquo;{topic}&rdquo; ({chapter}):
                </p>
                <div className="flex items-center justify-between text-[11px] text-[#78716C] border-t border-dotted border-[#D6CCC2] pt-2">
                  <span>Label key parts clearly with pencil</span>
                  <span>Teacher Initials: _______________</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: BLOOM'S TAXONOMY ASSESSMENT */}
        {activeView === 'assessment' && (
          <div className="space-y-5 text-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 border border-[#E7E0D4] rounded-lg px-4 py-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#00563B]">
                  Bloom&apos;s Taxonomy Cognitive Assessment &amp; Q&amp;A
                </h3>
                <p className="text-xs text-[#57534E] mt-0.5">
                  Evaluates Lower-Order Thinking Skills (LOTS) to Higher-Order Thinking Skills (HOTS) using curriculum Q&amp;A.
                </p>
              </div>
              <div className="text-xs font-mono font-bold text-[#1C1917] tabular-nums">
                Total Marks:{' '}
                {bloomQuestions.reduce((acc, q) => acc + (Number(q.marks) || 3), 0)}
              </div>
            </div>

            <div className="overflow-x-auto border border-[#E7E0D4] rounded-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#00563B] text-white text-xs uppercase">
                    <th className="py-2.5 px-3.5 font-semibold w-12">#</th>
                    <th className="py-2.5 px-3.5 font-semibold w-48">Cognitive Domain Level</th>
                    <th className="py-2.5 px-3.5 font-semibold">Assessment Question / Q&amp;A</th>
                    <th className="py-2.5 px-3.5 font-semibold text-right w-24">Marks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E0D4] text-xs sm:text-sm">
                  {bloomQuestions.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[#FAF8F5]">
                      <td className="py-3 px-3.5 font-mono tabular-nums text-[#57534E]">
                        0{idx + 1}
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="font-bold text-[#00563B] block">{item.level}</span>
                        <span className="text-[11px] text-[#57534E]">
                          {idx < 2
                            ? 'Recall & Comprehension'
                            : idx < 4
                            ? 'Application & Analysis'
                            : 'Evaluation & Synthesis'}
                        </span>
                      </td>
                      <td
                        dir={hasRtlScript(item.question) ? 'rtl' : 'ltr'}
                        className="py-3 px-3.5 text-[#1C1917] leading-relaxed"
                      >
                        {item.question}
                        <div className="mt-2 border-b border-dotted border-[#D6CCC2] h-4" />
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono tabular-nums font-semibold text-[#1C1917]">
                        {item.marks} Marks
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
          </div>
        </>
      )}
    </div>
  );
};
