import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Sparkles,
  Upload,
  Trash2,
  Printer,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Building2,
} from 'lucide-react';
import {
  QuestionPaperLanguage,
  QuestionPaperDifficulty,
  GeneratedQuestionPaper,
  computeBalancedMarksDistribution,
  validateSchoolLogoFile,
  validateQuestionPaperRequest,
} from '../utils/questionPaperLogic';
import { triggerPrintDocument } from '../utils/printDocument';
import { parseJsonResponseText } from '../utils/apiResponse';
import { auth } from '../firebase';

function buildOfflineTemplateQuestionPaper(request: {
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

  const mcqs = Array.from({ length: Math.max(1, distribution.mcqCount) }, (_, i) => ({
    question: isUrdu
      ? `${request.subject} (${request.className}) سے متعلق معروضی سوال نمبر ${i + 1}۔`
      : isSindhi
      ? `${request.subject} (${request.className}) بابت معروضي سوال نمبر ${i + 1}۔`
      : `Select the correct answer regarding key concepts of ${request.subject} (Q${i + 1}).`,
    options: ['(A) Option A', '(B) Option B', '(C) Option C', '(D) Option D'],
    correctAnswer: '(A) Option A',
  }));

  const shortQuestions = Array.from(
    { length: Math.max(1, distribution.shortQuestionsTotalInPaper) },
    (_, i) => ({
      question: isUrdu
        ? `${request.subject} کے تحت مختصر وضاحت کریں (سوال نمبر ${i + 1})۔`
        : isSindhi
        ? `${request.subject} هيٺ مختصر وضاحت ڪريو (سوال نمبر ${i + 1})۔`
        : `Briefly explain the principle and significance of ${request.subject} (Q${i + 1}).`,
      marks: distribution.shortMarksEach,
    })
  );

  const longQuestions = Array.from(
    { length: Math.max(1, distribution.longQuestionsTotalInPaper) },
    (_, i) => ({
      question: isUrdu
        ? `تفصیلی جواب تحریر کریں: ${request.syllabusCovered || request.subject} پر تفصیلی نوٹ لکھیں۔`
        : isSindhi
        ? `تفصيلي جواب لکو: ${request.syllabusCovered || request.subject} تي تفصيلي نوٽ لکو.`
        : `Write a comprehensive, detailed analytical response on ${request.syllabusCovered || request.subject}.`,
      marks: distribution.longMarksEach,
    })
  );

  return {
    paperTitle: `${request.className} Examination — ${request.subject}`,
    instructions: 'All sections are compulsory. Maintain neat handwriting and clean presentation.',
    sectionATitle,
    mcqs,
    sectionAMarks: distribution.mcqTotalMarks,
    sectionBTitle,
    sectionBNote: `Attempt any ${distribution.shortQuestionsRequired} out of ${distribution.shortQuestionsTotalInPaper} questions. Each question carries ${distribution.shortMarksEach} marks.`,
    shortQuestions,
    sectionBMarks: distribution.shortTotalMarks,
    sectionCTitle,
    sectionCNote: `Attempt any ${distribution.longQuestionsRequired} out of ${distribution.longQuestionsTotalInPaper} questions. Each question carries ${distribution.longMarksEach} marks.`,
    longQuestions,
    sectionCMarks: distribution.longTotalMarks,
    totalMarks: distribution.totalMarks,
  };
}

const PAPER_CLASSES = [
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

const SUBJECT_SUGGESTIONS = [
  'English',
  'Urdu',
  'Sindhi',
  'Mathematics',
  'General Science',
  'Social Studies',
  'Pakistan Studies',
  'Islamiat',
  'Computer Science',
  'Physics',
  'Chemistry',
  'Biology',
];

export const QuestionPaperTool: React.FC = () => {
  // Paper Configuration Inputs
  const [className, setClassName] = useState('Class 9');
  const [subject, setSubject] = useState('General Science');
  const [difficulty, setDifficulty] = useState<QuestionPaperDifficulty>('Medium');
  const [totalMarks, setTotalMarks] = useState<number>(50);
  const [timeAllowed, setTimeAllowed] = useState('2 Hours');
  const [language, setLanguage] = useState<QuestionPaperLanguage>('English');
  const [syllabusCovered, setSyllabusCovered] = useState(
    'Chapter 1: Cell Structure & Functions, Chapter 2: Balanced Diet & Nutrition, Chapter 3: Human Respiratory System'
  );

  // School Branding Inputs
  const [schoolName, setSchoolName] = useState(
    'Government Boys High School Latifabad No. 7'
  );
  const [schoolAddress, setSchoolAddress] = useState(
    'Unit No. 7, Latifabad, District Hyderabad, Sindh'
  );
  const [examTitle, setExamTitle] = useState('First Term Examination 2026');
  const [schoolLogoDataUrl, setSchoolLogoDataUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  // Output State
  const [generatedPaper, setGeneratedPaper] =
    useState<GeneratedQuestionPaper | null>(null);
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const previewDistribution = computeBalancedMarksDistribution(totalMarks);
  const isRtlPaper = language === 'Urdu' || language === 'Sindhi';

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLogoError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateSchoolLogoFile({
      type: file.type,
      size: file.size,
    });
    if (!validation.valid) {
      setLogoError(validation.error || 'Invalid image file.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result.startsWith('data:image/')) {
        setSchoolLogoDataUrl(reader.result);
      } else {
        setLogoError('Could not read uploaded logo image.');
      }
    };
    reader.onerror = () => {
      setLogoError('Failed to load logo image.');
    };
    reader.readAsDataURL(file);
  };

  const handleGeneratePaper = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusNotice(null);

    const validation = validateQuestionPaperRequest({
      className,
      subject,
      difficulty,
      totalMarks,
      timeAllowed,
      language,
      syllabusCovered,
    });

    if (!validation.valid || !validation.sanitized) {
      setErrorMsg(validation.error || 'Please check your input fields.');
      return;
    }

    setIsGenerating(true);
    try {
      let lastErrorMessage = 'Unable to generate question paper right now.';

      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, 900));
        }

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
          source?: string;
        }>(rawText, response.status, response.headers.get('content-type'));

        if (!parsed.ok || !parsed.data) {
          lastErrorMessage =
            parsed.error ||
            `Failed to generate Question Paper (HTTP ${response.status}).`;
          if (attempt === 0 && (parsed.isHtml || response.status >= 500)) {
            continue;
          }
          throw new Error(lastErrorMessage);
        }

        const data = parsed.data;
        if (response.ok && data?.paper) {
          setGeneratedPaper(data.paper);
          setStatusNotice(
            `AI Question Paper generated cleanly in ${validation.sanitized.language} (${validation.sanitized.totalMarks} Marks · ${validation.sanitized.difficulty} Difficulty).`
          );
          return;
        }

        lastErrorMessage =
          data?.error ||
          parsed.error ||
          `Failed to generate Question Paper (HTTP ${response.status}).`;
      }

      // If backend was unreachable or returned an error, fallback to institutional template
      const fallbackPaper = buildOfflineTemplateQuestionPaper(validation.sanitized);
      setGeneratedPaper(fallbackPaper);
      setStatusNotice(
        `Generated from institutional examination template (${validation.sanitized.language} · ${validation.sanitized.totalMarks} Marks · Server AI offline).`
      );
      return;
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Unable to generate question paper right now.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* =================================================================== */}
      {/* INPUT FORM & SCHOOL BRANDING PANEL (HIDDEN IN PRINT)                */}
      {/* =================================================================== */}
      <form
        onSubmit={handleGeneratePaper}
        className="no-print bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-6 shadow-xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#5b21b6]">
              <FileSpreadsheet className="w-4 h-4" />
              <span>AI Assessment Studio</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">
              AI Question Paper Maker (English / Urdu / Sindhi)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Generate balanced MCQs, Short Questions, and Long Questions tailored to your Class, Difficulty, Total Marks, Language, and School Branding.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-600 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-lg">
            Auto Marks Split: {previewDistribution.mcqTotalMarks} MCQs +{' '}
            {previewDistribution.shortTotalMarks} Short +{' '}
            {previewDistribution.longTotalMarks} Long ={' '}
            <strong className="text-[#5b21b6]">{previewDistribution.totalMarks}</strong>
          </div>
        </div>

        {/* School Branding Section */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
            <Building2 className="w-4 h-4 text-[#5b21b6]" />
            <span>School Branding Header (Prints at Top of Paper)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-start">
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                School / Institution Name
              </label>
              <input
                type="text"
                required
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="e.g., Government Boys High School..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Exam Title
              </label>
              <input
                type="text"
                value={examTitle}
                onChange={(e) => setExamTitle(e.target.value)}
                placeholder="e.g., Annual Exam 2026"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                School Logo (PNG / JPG)
              </label>
              <div className="flex items-center gap-2">
                <label className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#5b21b6] bg-purple-100 hover:bg-purple-200 border border-purple-300 rounded-lg cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{schoolLogoDataUrl ? 'Change Logo' : 'Upload Logo'}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
                {schoolLogoDataUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setSchoolLogoDataUrl(null);
                      setLogoError(null);
                    }}
                    title="Remove logo"
                    className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                School Address / City
              </label>
              <input
                type="text"
                value={schoolAddress}
                onChange={(e) => setSchoolAddress(e.target.value)}
                placeholder="e.g., Taluka Qasimabad, District Hyderabad, Sindh"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
              />
            </div>

            {schoolLogoDataUrl && (
              <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-lg p-2">
                <img
                  src={schoolLogoDataUrl}
                  alt="School Logo Preview"
                  className="w-10 h-10 object-contain rounded"
                />
                <span className="text-[11px] font-medium text-emerald-700">
                  Logo Ready for Print
                </span>
              </div>
            )}
          </div>

          {logoError && (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {logoError}
            </div>
          )}
        </div>

        {/* Paper Options & Syllabus Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Class (1st to 12th)
            </label>
            <select
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="w-full px-3 py-2 text-sm font-semibold text-[#5b21b6] bg-purple-50/60 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
            >
              {PAPER_CLASSES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Subject
            </label>
            <input
              type="text"
              list="qp-subject-list"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Physics, English, Sindhi"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5b21b6] focus:bg-white"
            />
            <datalist id="qp-subject-list">
              {SUBJECT_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Paper Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as QuestionPaperLanguage)}
              className="w-full px-3 py-2 text-sm font-semibold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
            >
              <option value="English">English</option>
              <option value="Urdu">Urdu (اردو)</option>
              <option value="Sindhi">Sindhi (سنڌي)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Difficulty Level
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as QuestionPaperDifficulty)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
            >
              <option value="Easy">Easy (Recall &amp; Basic)</option>
              <option value="Medium">Medium (Standard Board)</option>
              <option value="Hard">Hard (Conceptual &amp; HOTS)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Total Marks
              </label>
              <input
                type="number"
                min={10}
                max={200}
                required
                value={totalMarks}
                onChange={(e) =>
                  setTotalMarks(Math.max(10, Math.min(200, Number(e.target.value) || 50)))
                }
                className="w-full px-2.5 py-2 text-sm font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Time Allowed
              </label>
              <input
                type="text"
                value={timeAllowed}
                onChange={(e) => setTimeAllowed(e.target.value)}
                placeholder="2 Hours"
                className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Syllabus Covered (Chapters, Topics, or Key Learning Points)
          </label>
          <textarea
            rows={3}
            required
            value={syllabusCovered}
            onChange={(e) => setSyllabusCovered(e.target.value)}
            placeholder="Paste chapters, topics, or specific book units covered for this exam..."
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5b21b6] focus:bg-white"
          />
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2.5 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {statusNotice && (
          <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusNotice}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
          <button
            type="submit"
            disabled={isGenerating}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-60"
            style={{
              background: 'linear-gradient(135deg, #5b21b6 0%, #ec4899 100%)',
            }}
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Generating {language} Paper...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Paper
              </>
            )}
          </button>
        </div>
      </form>

      {/* =================================================================== */}
      {/* QUESTION PAPER PREVIEW / EMPTY PLACEHOLDER OR PRINTABLE A4 SHEET    */}
      {/* =================================================================== */}
      {!generatedPaper ? (
        <div className="no-print bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center space-y-2">
          <div className="w-11 h-11 rounded-full bg-purple-50 text-[#5b21b6] flex items-center justify-center mx-auto">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <h4 className="text-base font-bold text-slate-900">
            Configure Your Paper &amp; Click &ldquo;Generate Paper&rdquo;
          </h4>
          <p className="text-xs text-slate-500 max-w-xl mx-auto leading-relaxed">
            Your custom School Name, Address, Logo, Language ({language}), Difficulty ({difficulty}), and Total Marks ({totalMarks}) will be formatted into a clean A4 exam paper with MCQs, Short Questions, and Long Questions.
          </p>
        </div>
      ) : (
        <>
          {/* Action Bar (Hidden in Print) */}
          <div className="no-print bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowAnswerKey(!showAnswerKey)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                {showAnswerKey ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    Hide MCQ Answer Key
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    Show MCQ Answer Key (Teacher Copy)
                  </>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={triggerPrintDocument}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4" />
              Print / Download PDF (A4)
            </button>
          </div>

          {/* ================================================================= */}
          {/* PRINTABLE A4 QUESTION PAPER                                       */}
          {/* ================================================================= */}
          <div
            dir={isRtlPaper ? 'rtl' : 'ltr'}
            className="printable-a4-sheet bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs text-slate-900 space-y-5"
          >
            {/* School Branding Header */}
            <div className="border-b-2 border-slate-900 pb-4">
              <div className="flex items-center justify-center gap-4 text-center">
                {schoolLogoDataUrl && (
                  <img
                    src={schoolLogoDataUrl}
                    alt="School Logo"
                    className="w-16 h-16 object-contain shrink-0"
                  />
                )}
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-slate-900">
                    {schoolName}
                  </h1>
                  {schoolAddress && (
                    <p className="text-xs text-slate-600 mt-0.5">{schoolAddress}</p>
                  )}
                  <p className="text-sm font-bold text-[#5b21b6] mt-1">
                    {generatedPaper.paperTitle || examTitle}
                  </p>
                </div>
              </div>

              {/* Paper Metadata Row */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 border-t border-b border-slate-300 py-2 text-xs font-semibold">
                <div>
                  <span className="text-slate-500">Class:</span> {className}
                </div>
                <div>
                  <span className="text-slate-500">Subject:</span> {subject}
                </div>
                <div>
                  <span className="text-slate-500">Time:</span> {timeAllowed}
                </div>
                <div className="sm:text-end font-mono">
                  <span className="text-slate-500">Total Marks:</span>{' '}
                  {generatedPaper.totalMarks}
                </div>
              </div>

              {/* Student Name / Roll No Row for Printed Paper */}
              <div className="mt-2.5 grid grid-cols-2 gap-4 text-xs text-slate-700">
                <div className="flex items-end gap-2">
                  <span className="font-semibold shrink-0">Student Name:</span>
                  <div className="flex-1 border-b border-dotted border-slate-500 h-4" />
                </div>
                <div className="flex items-end gap-2">
                  <span className="font-semibold shrink-0">Roll No / Section:</span>
                  <div className="flex-1 border-b border-dotted border-slate-500 h-4" />
                </div>
              </div>

              {generatedPaper.instructions && (
                <p className="mt-2.5 text-[11px] italic text-slate-600 bg-slate-50 px-3 py-1.5 rounded border border-slate-200">
                  <strong>Instructions:</strong> {generatedPaper.instructions}
                </p>
              )}
            </div>

            {/* SECTION A: MCQs */}
            <section className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-300 pb-1">
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-900">
                  {generatedPaper.sectionATitle}
                </h2>
                <span className="text-xs font-mono font-bold text-slate-700">
                  ({generatedPaper.mcqs.length} × 1 = {generatedPaper.sectionAMarks}{' '}
                  Marks)
                </span>
              </div>

              <div className="space-y-3 text-xs sm:text-sm">
                {generatedPaper.mcqs.map((mcq, idx) => (
                  <div key={idx} className="space-y-1.5 break-inside-avoid">
                    <p className="font-semibold text-slate-900">
                      Q{idx + 1}. {mcq.question}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 ps-4 text-xs text-slate-700">
                      {mcq.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-start gap-1.5">
                          <span className="font-bold">
                            ({String.fromCharCode(97 + optIdx)})
                          </span>
                          <span>{opt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* SECTION B: SHORT QUESTIONS */}
            <section className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-slate-300 pb-1">
                <div>
                  <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-900">
                    {generatedPaper.sectionBTitle}
                  </h2>
                  <p className="text-[11px] text-slate-600">
                    {generatedPaper.sectionBNote}
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-slate-700 shrink-0">
                  ({generatedPaper.sectionBMarks} Marks)
                </span>
              </div>

              <ol className="space-y-2 text-xs sm:text-sm ps-5 list-decimal">
                {generatedPaper.shortQuestions.map((q, idx) => (
                  <li key={idx} className="leading-relaxed break-inside-avoid">
                    <div className="flex items-baseline justify-between gap-3">
                      <span>{q.question}</span>
                      <span className="text-[11px] font-mono text-slate-500 shrink-0">
                        [{q.marks} Marks]
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {/* SECTION C: LONG / DESCRIPTIVE QUESTIONS */}
            <section className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-slate-300 pb-1">
                <div>
                  <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-900">
                    {generatedPaper.sectionCTitle}
                  </h2>
                  <p className="text-[11px] text-slate-600">
                    {generatedPaper.sectionCNote}
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-slate-700 shrink-0">
                  ({generatedPaper.sectionCMarks} Marks)
                </span>
              </div>

              <ol className="space-y-2.5 text-xs sm:text-sm ps-5 list-decimal">
                {generatedPaper.longQuestions.map((q, idx) => (
                  <li key={idx} className="leading-relaxed break-inside-avoid">
                    <div className="flex items-baseline justify-between gap-3">
                      <span>{q.question}</span>
                      <span className="text-[11px] font-mono text-slate-500 shrink-0">
                        [{q.marks} Marks]
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {/* Optional MCQ Answer Key (Teacher Copy) */}
            {showAnswerKey && (
              <section className="mt-6 pt-4 border-t-2 border-dashed border-slate-400 break-inside-avoid">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#5b21b6] mb-2">
                  Teacher Answer Key — Section A (MCQs)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  {generatedPaper.mcqs.map((mcq, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5"
                    >
                      <span className="font-bold">Q{idx + 1}:</span>{' '}
                      <span className="text-emerald-700 font-semibold">
                        {mcq.correctAnswer}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
};
