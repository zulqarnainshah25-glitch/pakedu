/**
 * Unit & Security Tests (Rule 1: TDD & Rule 3: Security Self-Audit)
 * Tests Auth validation, XSS sanitization, brute-force rate limiting,
 * Open Redirect prevention on SSO URLs, and 2026 Salary Calculator edge cases.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  validateAuthCredentials,
  sanitizeTextInput,
  checkAuthRateLimit,
  resetAuthRateLimitForTesting,
  diagnoseFirebaseAuthError,
  buildAtlierCvSsoUrl,
  isPortalAccessAllowed,
  shouldTriggerSsoLogoutFromSearch,
  sanitizeReturnPortalOrigin,
  parseIncomingSsoSessionFromSearch,
  DEFAULT_MAIN_PORTAL_URL,
  ATLIER_CV_LIVE_URL,
  UNIFIED_FIREBASE_PROJECT_ID,
  buildSyntheticStudentEmail,
  isSyntheticStudentEmail,
  isGrOrStudentIdInput,
} from './authAndSso';
import { calculateSindhSalary2026 } from '../data/salaryScale2026';
import { determineSmartRoute, hasAdminCapabilities } from './smartRouting';
import { School, UserProfile, ClassFeeStructure, FeeConcessionRule, FeePayment, Student, Exam, StudentExamMarks } from '../features/sms/types';
import {
  buildApprovedSchoolEmployees,
  validateApprovedSalaryEmployee,
  buildSalaryStructureAuditFeed,
  EMPLOYEE_NOT_FOUND_IN_SCHOOL_ERROR,
} from '../features/sms/utils/payrollCalculations';
import {
  calculateStudentDiscount,
  calculateStudentFeeLedger,
  getExpectedClassMonthlyFee,
  getNextMonthKey,
} from '../features/sms/utils/feeCalculations';
import {
  computeAcademicGrade,
  computeStudentExamResult,
  computeClassPositions,
  formatOrdinalPosition,
} from '../features/sms/utils/examCalculations';
import { sanitizeFirestoreData } from './firestoreSanitizer';
import {
  getClassesForSection,
  getFieldExamplesForClass,
  getClassDifficultyProfile,
} from '../data/syllabusPresets';
import {
  SERVICE_BOOK_DISCLAIMER,
  calculateQualifyingService,
  calculatePensionEstimate,
  trackTimeScaleGrades,
  calculateLeaveEncashment,
} from './serviceBookLogic';
import {
  computeBalancedMarksDistribution,
  validateSchoolLogoFile,
  validateQuestionPaperRequest,
} from './questionPaperLogic';
import {
  extractReadableApiError,
  parseJsonResponseText,
  parseModelJsonText,
} from './apiResponse';
import {
  normalizeSmsGradeToSyllabusClassName,
  filterSyllabusPresetsForClass,
  extractSyllabusStructureForClass,
  buildSmartSyllabusContextFromLessonPlans,
  buildSmsOfflineFallbackLessonPlan,
  buildSmsOfflineFallbackQuestionPaper,
  filterLessonPlansForRole,
  filterQuestionPapersForRole,
  getAttachedQuestionPapersForExam,
} from '../features/sms/utils/aiIntegrationHelpers';
import { SchoolLessonPlan, SchoolQuestionPaper } from '../features/sms/types';
import {
  isPlaceholderApiKey,
  parseServerEnv,
} from './envConfig';
import { PORTAL_VERSION } from './appVersion';
import { saveFileUniversal } from '../features/cv-builder/lib/mobileFileSaver';
import { triggerPrintDocument } from './printDocument';
import type { ElectronAPI } from '../types/electron';

async function runAllUnitTests() {
  console.log('=== Running PakEdu & AtlierCV Unit & Security Test Suite ===\n');

  // 1. XSS & Input Sanitization Tests
  {
    const malicious = '<script>alert("xss")</script>Muhammed "Ali" \u0000\u0007';
    const cleaned = sanitizeTextInput(malicious);
    assert.equal(cleaned.includes('<'), false, 'Should strip <');
    assert.equal(cleaned.includes('>'), false, 'Should strip >');
    assert.equal(cleaned.includes('"'), false, 'Should strip quotes');
    assert.equal(cleaned.includes('\u0000'), false, 'Should strip null bytes');
    assert.equal(sanitizeTextInput(null), '', 'Should handle null input safely');
    assert.equal(sanitizeTextInput(undefined), '', 'Should handle undefined input safely');
    console.log('✅ PASS: XSS & Null-Byte Sanitization Tests');
  }

  // 2. Auth Credential Validation Edge Cases
  {
    const nullEmail = validateAuthCredentials({ mode: 'signin', email: null, password: 'secretPassword' });
    assert.equal(nullEmail.valid, false);

    const badEmail = validateAuthCredentials({ mode: 'signin', email: 'not-an-email', password: 'secretPassword' });
    assert.equal(badEmail.valid, false);

    const shortPassSignup = validateAuthCredentials({
      mode: 'signup',
      email: 'teacher@seld.gos.pk',
      password: '123',
      displayName: 'Ustad Ahmed',
    });
    assert.equal(shortPassSignup.valid, false);

    const missingNameSignup = validateAuthCredentials({
      mode: 'signup',
      email: 'teacher@seld.gos.pk',
      password: 'securePassword123',
      displayName: ' ',
    });
    assert.equal(missingNameSignup.valid, false);

    const validSignup = validateAuthCredentials({
      mode: 'signup',
      email: '  Teacher@SELD.gos.pk ',
      password: 'securePassword123',
      displayName: '<b>Ahmed Khan</b>',
    });
    assert.equal(validSignup.valid, true);
    assert.equal(validSignup.sanitizedEmail, 'teacher@seld.gos.pk');
    assert.equal(validSignup.sanitizedDisplayName, 'bAhmed Khan/b');
    console.log('✅ PASS: Auth Credential Validation & Edge Case Tests');
  }

  // 3. Brute-Force Rate Limiter Tests
  {
    resetAuthRateLimitForTesting();
    const baseTime = 1_700_000_000_000;
    for (let i = 0; i < 6; i++) {
      const res = checkAuthRateLimit(baseTime + i * 100);
      assert.equal(res.allowed, true, `Attempt ${i + 1} should be allowed`);
    }
    const blocked = checkAuthRateLimit(baseTime + 1000);
    assert.equal(blocked.allowed, false, '7th rapid attempt within 60s must be blocked');
    assert.equal(blocked.retryAfterSeconds > 0, true);

    // After 61 seconds, window resets
    const afterWindow = checkAuthRateLimit(baseTime + 61_000);
    assert.equal(afterWindow.allowed, true, 'Attempt after 60s window must be allowed');
    resetAuthRateLimitForTesting();
    console.log('✅ PASS: Brute-Force Login Rate Limiter Tests');
  }

  // 4. Open-Redirect & SSO URL Security Tests
  {
    const evilRedirect = buildAtlierCvSsoUrl({
      targetBaseUrl: 'https://evil-phishing-site.example.com/steal-token',
      user: { uid: 'uid_123', email: 'teacher@seld.gos.pk', displayName: 'Sanaullah' },
    });
    assert.equal(
      evilRedirect.startsWith(ATLIER_CV_LIVE_URL),
      true,
      'Untrusted domain must fallback to official AtlierCV URL'
    );

    const javascriptProtocol = buildAtlierCvSsoUrl({
      targetBaseUrl: 'javascript:alert(1)',
      user: { uid: 'uid_123', email: 'teacher@seld.gos.pk', displayName: 'Sanaullah' },
    });
    assert.equal(
      javascriptProtocol.startsWith(ATLIER_CV_LIVE_URL),
      true,
      'javascript: URI must be blocked and fallback to official AtlierCV URL'
    );

    const validSsoUrl = new URL(
      buildAtlierCvSsoUrl({
        user: { uid: 'user_99', email: 'faru@allfaru.dpdns.org', displayName: 'Allforu Teacher' },
        templateHint: 'executive-ats',
        portalOrigin: DEFAULT_MAIN_PORTAL_URL,
      })
    );
    assert.equal(validSsoUrl.hostname, 'atlier-cv.vercel.app');
    assert.equal(validSsoUrl.searchParams.get('firebase_project'), UNIFIED_FIREBASE_PROJECT_ID);
    assert.equal(validSsoUrl.searchParams.get('sso_email'), 'faru@allfaru.dpdns.org');
    assert.equal(validSsoUrl.searchParams.get('template'), 'executive-ats');
    assert.equal(validSsoUrl.searchParams.get('portal_url'), DEFAULT_MAIN_PORTAL_URL);
    assert.equal(
      validSsoUrl.searchParams.get('logout_redirect'),
      `${DEFAULT_MAIN_PORTAL_URL}/?sso_logout=1`
    );
    console.log('✅ PASS: Open-Redirect Prevention & Cross-Platform SSO URL Builder Tests');
  }

  // 5. Firebase Auth Error Diagnostics Tests
  {
    const unauthDiag = diagnoseFirebaseAuthError(
      { code: 'auth/unauthorized-domain', message: 'Firebase: Error (auth/unauthorized-domain).' },
      'preview.run.app'
    );
    assert.equal(unauthDiag.isUnauthorizedDomain, true);
    assert.equal(unauthDiag.shouldOfferDemoFallback, true);

    const disabledDiag = diagnoseFirebaseAuthError(
      new Error('Firebase: Error (auth/operation-not-allowed).')
    );
    assert.equal(disabledDiag.isProviderDisabled, true);
    assert.equal(disabledDiag.shouldOfferDemoFallback, true);
    console.log('✅ PASS: Firebase Auth Error Diagnostics & Fallback Tests');
  }

  // 6. 2026 Salary Calculator Integration & Boundary Edge Cases
  {
    // BPS-14 Stage 5 (Primary/JEST Teacher scale)
    const bps14 = calculateSindhSalary2026(14, 5);
    assert.equal(bps14.bpsRow.bps, 14);
    assert.equal(bps14.adhoc2023RatePercent, 35);
    assert.equal(bps14.differential2026 > 0, true, 'BPS 1-16 receives 2% Differential Allowance 2026');
    assert.equal(bps14.netSalary, bps14.grossSalary - bps14.totalDeductions);

    // BPS-17 Stage 0 (Gazetted Officer / Subject Specialist)
    const bps17 = calculateSindhSalary2026(17, 0);
    assert.equal(bps17.adhoc2023RatePercent, 30);
    assert.equal(bps17.differential2026, 0, 'BPS 17-22 gets 0 Differential Allowance 2026');

    // Out-of-range inputs (e.g. negative stage or invalid BPS)
    const clamped = calculateSindhSalary2026(999, -10, -500);
    assert.equal(clamped.bpsRow.bps, 14, 'Invalid BPS falls back to default BPS-14 teacher scale safely');
    assert.equal(Number.isFinite(clamped.netSalary), true);
    console.log('✅ PASS: Sindh Government Salary Calculator 2026 Boundary & Math Tests');
  }

  // 7. Mandatory Login Gate & Bi-Directional Cross-App SSO / Logout Tests
  {
    const unauthState = isPortalAccessAllowed({
      currentUser: null,
      demoSession: null,
      authInitializing: false,
    });
    assert.equal(unauthState.allowed, false, 'Unauthenticated user must NOT be allowed into portal');
    assert.equal(unauthState.mustShowLoginGate, true, 'Mandatory login gate must be shown');

    const initState = isPortalAccessAllowed({
      currentUser: null,
      demoSession: null,
      authInitializing: true,
    });
    assert.equal(initState.allowed, false);
    assert.equal(initState.isInitializing, true);

    const authedState = isPortalAccessAllowed({
      currentUser: { uid: 'u1', email: 'teacher@seld.gos.pk' },
      demoSession: null,
      authInitializing: false,
    });
    assert.equal(authedState.allowed, true, 'Authenticated user is allowed into portal');
    assert.equal(authedState.mustShowLoginGate, false);

    assert.equal(shouldTriggerSsoLogoutFromSearch('?sso_logout=1'), true);
    assert.equal(shouldTriggerSsoLogoutFromSearch('?logged_out=true'), true);
    assert.equal(shouldTriggerSsoLogoutFromSearch('?tab=atlier'), false);
    assert.equal(sanitizeReturnPortalOrigin('javascript:alert(1)'), DEFAULT_MAIN_PORTAL_URL);

    const parsedIncoming = parseIncomingSsoSessionFromSearch(
      '?sso_email=ZulqarnainShah25%40gmail.com&sso_name=Zulqarnain+Shah&sso_uid=uid_786'
    );
    assert.equal(parsedIncoming, null, 'Unauthenticated ?sso_email query param must return null');
    console.log('✅ PASS: Mandatory Login Gate & Bi-Directional Cross-Platform Logout/SSO Tests');
  }

  // 8. Section-to-Class Filtering, Blank Field Examples, Class/Board Difficulty Calibration & Sidebar Blog Removal Tests
  {
    assert.deepEqual(getClassesForSection('Primary'), [
      'KG',
      'Class 1',
      'Class 2',
      'Class 3',
      'Class 4',
      'Class 5',
    ]);
    assert.deepEqual(getClassesForSection('Middle'), ['Class 6', 'Class 7', 'Class 8']);
    assert.deepEqual(getClassesForSection('Secondary'), ['Class 9', 'Class 10']);
    assert.deepEqual(getClassesForSection('Higher Secondary'), ['Class 11', 'Class 12']);

    const secExamples = getFieldExamplesForClass('Secondary', 'Class 9', 'Sindh STBB');
    assert.equal(secExamples.subjectPlaceholder.includes('Example:'), true);
    assert.equal(secExamples.chapterPlaceholder.includes('Example:'), true);
    assert.equal(secExamples.topicPlaceholder.includes('Example:'), true);

    const kgProfile = getClassDifficultyProfile('Sindh STBB', 'Primary', 'KG', 'Sindhi');
    assert.equal(kgProfile.cognitiveLevel.includes('Early Childhood'), true);
    assert.equal(kgProfile.boardStandard.includes('Sindh Textbook Board'), true);
    assert.equal(kgProfile.languageNote.includes('Sindhi'), true);

    const ptb12Profile = getClassDifficultyProfile('Punjab PTB', 'Higher Secondary', 'Class 12', 'Physics');
    assert.equal(ptb12Profile.cognitiveLevel.includes('Higher Secondary'), true);
    assert.equal(ptb12Profile.boardStandard.includes('Punjab Curriculum & Textbook Board'), true);

    const appTsxSource = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf-8');
    assert.equal(
      appTsxSource.includes('Official Blog'),
      false,
      'App.tsx sidebar must not contain the Allfaru/Allforu Official Blog button'
    );
    assert.equal(
      appTsxSource.includes('ALLFORU_BLOG_URL'),
      false,
      'App.tsx must not render ALLFORU_BLOG_URL navigation links'
    );
    console.log('✅ PASS: Section-to-Class Filtering, Blank Field Examples, Board/Class Difficulty & Sidebar Blog Removal Tests');
  }

  // 9. Service Book Calculator (Qualifying Service, Pension, Time Scale, Leave Encashment & Disclaimer)
  {
    assert.equal(
      SERVICE_BOOK_DISCLAIMER,
      'This is an estimation tool for personal planning. It is not an official legal document. Final benefits depend on verified Service Book entries and Sindh Finance Department rules.'
    );

    // 6-month rounding rule test
    const fiveMonths = calculateQualifyingService({
      appointmentDate: '2010-01-01',
      retirementDate: '2020-06-20', // 10y 5m 19d -> 10 yrs
    });
    assert.equal(fiveMonths.valid, true);
    assert.equal(fiveMonths.roundedUpBySixMonthRule, false);
    assert.equal(fiveMonths.qualifyingYearsCapped, 10);

    const sixMonths = calculateQualifyingService({
      appointmentDate: '2010-01-01',
      retirementDate: '2020-07-01', // 10y 6m 0d -> 11 yrs
    });
    assert.equal(sixMonths.valid, true);
    assert.equal(sixMonths.roundedUpBySixMonthRule, true);
    assert.equal(sixMonths.qualifyingYearsCapped, 11);

    // Maximum 30 years cap test
    const over30 = calculateQualifyingService({
      appointmentDate: '1990-01-01',
      retirementDate: '2025-01-01',
      previousServiceYears: 2,
    });
    assert.equal(over30.isCappedAt30, true);
    assert.equal(over30.qualifyingYearsCapped, 30);

    // Invalid date order boundary
    const invalidDates = calculateQualifyingService({
      appointmentDate: '2025-01-01',
      retirementDate: '2020-01-01',
    });
    assert.equal(invalidDates.valid, false);

    // Pension Estimator formula + 35% commutation cap + 30 years cap
    const pension = calculatePensionEstimate({
      pensionableEmoluments: 100_000,
      qualifyingYears: 40, // clamped to 30
      commutationPercent: 50, // clamped to 35%
      ageNextBirthday: 60, // factor 12.3719
    });
    assert.equal(pension.effectiveQualifyingYears, 30);
    assert.equal(pension.effectiveCommutationPercent, 35);
    assert.equal(pension.grossMonthlyPension, 70_000); // (100000 * 30 * 7)/300 = 70000
    assert.equal(pension.commutedMonthlyPortion, 24_500);
    assert.equal(pension.netMonthlyPension, 45_500);
    assert.equal(pension.commutationLumpSum, Math.round(24_500 * 12 * 12.3719));

    // Time Scale Tracker (JEST BS-14 -> 9y BS-15, 14y BS-16; HST BS-15 -> 9y BS-17)
    const jestMilestones = trackTimeScaleGrades(
      'jest-bs14',
      '2018-09-01',
      '2045-01-01',
      '2026-11-18'
    );
    assert.equal(jestMilestones[0].targetBps, 15);
    assert.equal(jestMilestones[0].dueDate, '2027-09-01');
    assert.equal(jestMilestones[1].targetBps, 16);
    assert.equal(jestMilestones[1].dueDate, '2032-09-01');

    const hstMilestones = trackTimeScaleGrades(
      'hst-bs15',
      '2015-01-01',
      '2040-01-01',
      '2026-11-18'
    );
    assert.equal(hstMilestones[0].targetBps, 17);
    assert.equal(hstMilestones[0].status, 'achieved');

    // Leave Encashment (365 days cap)
    const encashment = calculateLeaveEncashment({
      reckonableMonthlyPay: 80_000,
      earnedLeaveDays: 500, // clamped to 365
    });
    assert.equal(encashment.cappedDays, 365);
    assert.equal(encashment.estimatedAmount, 80_000 * 12);
    console.log('✅ PASS: Service Book Calculator Math, Caps, Time Scale & Disclaimer Tests');
  }

  // 10. AI Question Paper Maker Balancing, Input Validation, Logo Security & Version Tests
  {
    for (const total of [10, 25, 50, 75, 100, 120, 150, 200]) {
      const dist = computeBalancedMarksDistribution(total);
      assert.equal(
        dist.mcqTotalMarks + dist.shortTotalMarks + dist.longTotalMarks,
        dist.totalMarks,
        `Marks distribution must strictly sum to ${total}`
      );
      assert.equal(dist.mcqCount >= 2, true);
      assert.equal(dist.shortQuestionsRequired >= 1, true);
      assert.equal(dist.longQuestionsRequired >= 1, true);
    }

    // Security audit: block SVG script-bearing upload and oversized logos
    const svgUpload = validateSchoolLogoFile({ type: 'image/svg+xml', size: 2048 });
    assert.equal(svgUpload.valid, false, 'SVG must be rejected to prevent SVG XSS');
    const hugeUpload = validateSchoolLogoFile({ type: 'image/png', size: 5 * 1024 * 1024 });
    assert.equal(hugeUpload.valid, false, 'Oversized logo (>1.5MB) must be rejected');
    const validPng = validateSchoolLogoFile({ type: 'image/png', size: 120_000 });
    assert.equal(validPng.valid, true);

    const badPaper = validateQuestionPaperRequest({
      className: 'Class 9',
      subject: 'Physics',
      totalMarks: 500,
      syllabusCovered: 'Kinematics',
    });
    assert.equal(badPaper.valid, false);

    const goodPaper = validateQuestionPaperRequest({
      className: 'Class 10',
      subject: '<script>Chemistry</script>',
      difficulty: 'Hard',
      totalMarks: 75,
      language: 'Sindhi',
      syllabusCovered: 'Acids, Bases and Salts',
    });
    assert.equal(goodPaper.valid, true);
    assert.equal(goodPaper.sanitized?.subject.includes('<'), false);
    assert.equal(goodPaper.sanitized?.language, 'Sindhi');
    assert.equal(PORTAL_VERSION, '1.0.6');
    console.log('✅ PASS: Question Paper Marks Balancing, Logo XSS/Size Validation & v1.0.6 Tests');
  }

  // 11. Safe JSON/HTML Response Guard, Markdown JSON Parsing & Gemini Error Resilience Tests
  {
    // Reproduces the exact bug reported: `Unexpected token '<', "<!doctype "... is not valid JSON`
    const htmlFallback = parseJsonResponseText(
      '<!doctype html><html><body>Not JSON</body></html>',
      200,
      'text/html; charset=utf-8'
    );
    assert.equal(htmlFallback.ok, false);
    assert.equal(htmlFallback.isHtml, true);
    assert.equal(htmlFallback.error?.includes('HTML'), true);

    const html502 = parseJsonResponseText(
      '<!DOCTYPE html><html><title>502 Bad Gateway</title></html>',
      502,
      'text/html'
    );
    assert.equal(html502.ok, false);
    assert.equal(html502.isHtml, true);
    assert.equal(html502.error?.includes('502'), true);

    const validJson = parseJsonResponseText<{ ok: boolean }>(
      '{"ok":true}',
      200,
      'application/json'
    );
    assert.equal(validJson.ok, true);
    assert.equal(validJson.data?.ok, true);

    const emptyBody = parseJsonResponseText('', 500, 'application/json');
    assert.equal(emptyBody.ok, false);

    // Markdown fenced JSON stripping from LLM responses
    const fenced = parseModelJsonText<{ paperTitle: string }>(
      '```json\n{"paperTitle":"Class 9 Science"}\n```'
    );
    assert.equal(fenced.paperTitle, 'Class 9 Science');

    // Clean Gemini nested error extraction
    const spike503 = extractReadableApiError(
      new Error(
        '{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}'
      )
    );
    assert.equal(spike503.status, 503);
    assert.equal(spike503.isTransient, true);
    assert.equal(spike503.message.includes('high demand'), true);

    const auth403 = extractReadableApiError(
      new Error('{"error":{"code":403,"message":"API_KEY_INVALID","status":"PERMISSION_DENIED"}}')
    );
    assert.equal(auth403.status, 403);
    assert.equal(auth403.isTransient, false);
    assert.equal(auth403.message.includes('Settings > Secrets'), true);

    // Integration guard: verify server.ts protects /api/* from Vite/SPA HTML fallback
    const serverTsSource = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf-8');
    assert.equal(
      serverTsSource.includes("app.all('/api/*'"),
      true,
      'server.ts must include a strict JSON 404 guard for unmatched /api/* routes'
    );
    assert.equal(
      serverTsSource.includes('generateStructuredJsonWithRetry'),
      true,
      'server.ts must use retry + fallback helper for transient Gemini 503 spikes'
    );
    console.log('✅ PASS: Safe JSON/HTML Fallback Guard, Model Retry & Error Extraction Tests');
  }

  // 12. Environment Configuration (.env / .env.example) & Secret Leakage Security Audit Tests
  {
    assert.equal(isPlaceholderApiKey(''), true);
    assert.equal(isPlaceholderApiKey('MY_GEMINI_API_KEY'), true);
    assert.equal(isPlaceholderApiKey('YOUR_GEMINI_API_KEY_HERE'), true);
    assert.equal(isPlaceholderApiKey('AIzaSyExampleRealLookingKey123456'), false);

    // Rejects deprecated or injected model names and clamps numeric bounds
    const envParsed = parseServerEnv({
      GEMINI_API_KEY: 'YOUR_GEMINI_API_KEY_HERE',
      GEMINI_PRIMARY_MODEL: 'gemini-1.5-flash', // deprecated -> must fall back to allowlist
      GEMINI_FALLBACK_MODEL: 'malicious-model',
      API_RATE_LIMIT_PER_MINUTE: '999999', // must clamp to 500
      API_CACHE_TTL_MINUTES: '-5', // must clamp to 1
    });
    assert.equal(envParsed.hasValidGeminiApiKey, false);
    assert.equal(envParsed.primaryModel, 'gemini-4-hydrogen');
    assert.equal(envParsed.fallbackModel, 'gemini-3.1-flash-lite');
    assert.equal(envParsed.rateLimitPerMinute, 500);
    assert.equal(envParsed.cacheTtlMs, 60_000);

    // Verify .gitignore ignores .env* and .env/.env.example exist with zero leaked live API keys
    const gitignore = fs.readFileSync(path.resolve(process.cwd(), '.gitignore'), 'utf-8');
    const envExample = fs.readFileSync(path.resolve(process.cwd(), '.env.example'), 'utf-8');
    const dotEnv = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf-8');

    assert.equal(gitignore.includes('.env'), true, '.gitignore must protect .env files from Git commits');
    assert.equal(envExample.includes('GEMINI_API_KEY='), true);
    assert.equal(dotEnv.includes('GEMINI_API_KEY='), true);
    assert.equal(envExample.includes('VITE_GEMINI_API_KEY'), false, '.env.example must NOT expose client VITE_GEMINI_API_KEY');
    assert.equal(dotEnv.includes('VITE_GEMINI_API_KEY'), false, '.env must NOT contain client VITE_GEMINI_API_KEY');
    assert.equal(
      /AIza[0-9A-Za-z_-]{20,}/.test(envExample),
      false,
      '.env.example must never contain a real Google/Gemini API key'
    );
    assert.equal(
      /AQ\.[0-9A-Za-z_-]{20,}/.test(envExample),
      false,
      '.env.example must never contain a real Gemini API key'
    );
    assert.equal(
      /AQ\.[0-9A-Za-z_-]{20,}/.test(dotEnv),
      false,
      '.env must never contain a hardcoded leaked key'
    );
    console.log('✅ PASS: Environment Config Validation, Model Allowlist & Secret Leakage Security Audit Tests');
  }

  // 13. Automatic Smart Login Routing System Tests (All 4 Account Types + Pending)
  {
    const mockActiveSchool: School = {
      id: 'sch_403020101',
      name: 'Govt. Comprehensive High School Latifabad',
      semisCode: '403020101',
      board: 'Sindh STBB',
      district: 'Hyderabad',
      taluka: 'Latifabad',
      adminUids: ['uid_admin_01'],
      activeAcademicYear: '2025-2026',
      status: 'active',
      primaryAdminType: 'principal',
      primaryAdminName: 'Muhammad Farooq',
      primaryAdminEmail: 'admin@pakedu.com',
    };

    const mockSuspendedSchool: School = {
      ...mockActiveSchool,
      id: 'sch_suspended_01',
      semisCode: '403020999',
      status: 'suspended',
    };

    const schoolDirectory = [mockActiveSchool, mockSuspendedSchool];

    // Case A: Super Admin Account via Verified Custom Claims
    const superAdminByClaim = determineSmartRoute(
      { email: 'superadmin@domain.com', uid: 'super_uid_1' },
      null,
      schoolDirectory,
      { superAdmin: true }
    );
    assert.equal(superAdminByClaim.targetTool, 'super-admin');
    assert.equal(superAdminByClaim.role, 'super-admin');

    // Case A2: Plain email (even owner@pakedu.com) without claims or profile must NOT get Super Admin
    const unverifiedEmailRoute = determineSmartRoute(
      { email: 'owner@pakedu.com', uid: 'attacker_uid' },
      null,
      schoolDirectory,
      null
    );
    assert.equal(unverifiedEmailRoute.targetTool, 'dashboard');
    assert.equal(unverifiedEmailRoute.role, 'teacher');

    const superAdminByProfile = determineSmartRoute(
      { email: 'delegate@pakedu.com', uid: 'super_uid_2' },
      {
        uid: 'super_uid_2',
        email: 'delegate@pakedu.com',
        fullName: 'Super Delegate',
        role: 'super-admin',
        isSuperAdmin: true,
        status: 'active',
        assignedClassIds: [],
      },
      schoolDirectory
    );
    assert.equal(superAdminByProfile.targetTool, 'super-admin');
    assert.equal(superAdminByProfile.role, 'super-admin');

    // Case B: Pending Approval (Admin or Teacher)
    const pendingAdmin = determineSmartRoute(
      { email: 'pending.admin@gmail.com', uid: 'admin_req_1' },
      {
        uid: 'admin_req_1',
        email: 'pending.admin@gmail.com',
        fullName: 'Applicant Principal',
        role: 'admin',
        schoolId: 'sch_pending_01',
        schoolName: 'Govt. New School',
        status: 'pending',
        assignedClassIds: [],
      },
      schoolDirectory
    );
    assert.equal(pendingAdmin.targetTool, 'sms-onboarding');
    assert.equal(pendingAdmin.role, 'admin');

    const pendingTeacher = determineSmartRoute(
      { email: 'pending.teacher@gmail.com', uid: 'teacher_req_1' },
      {
        uid: 'teacher_req_1',
        email: 'pending.teacher@gmail.com',
        fullName: 'Applicant Teacher',
        role: 'teacher',
        schoolId: mockActiveSchool.id,
        schoolName: mockActiveSchool.name,
        status: 'pending',
        assignedClassIds: [],
      },
      schoolDirectory
    );
    assert.equal(pendingTeacher.targetTool, 'sms-onboarding');
    assert.equal(pendingTeacher.role, 'teacher');

    // Case C: Verified School Admin
    const verifiedAdmin = determineSmartRoute(
      { email: 'admin@pakedu.com', uid: 'uid_admin_01' },
      {
        uid: 'uid_admin_01',
        email: 'admin@pakedu.com',
        fullName: 'Muhammad Farooq',
        role: 'admin',
        schoolId: mockActiveSchool.id,
        schoolName: mockActiveSchool.name,
        status: 'active',
        assignedClassIds: [],
      },
      schoolDirectory
    );
    assert.equal(verifiedAdmin.targetTool, 'sms-dashboard');
    assert.equal(verifiedAdmin.role, 'admin');

    // Case C2: School Admin with suspended school -> must go to onboarding
    const suspendedAdmin = determineSmartRoute(
      { email: 'suspended@pakedu.com', uid: 'uid_admin_sus' },
      {
        uid: 'uid_admin_sus',
        email: 'suspended@pakedu.com',
        fullName: 'Suspended Admin',
        role: 'admin',
        schoolId: mockSuspendedSchool.id,
        schoolName: mockSuspendedSchool.name,
        status: 'active',
        assignedClassIds: [],
      },
      schoolDirectory
    );
    assert.equal(suspendedAdmin.targetTool, 'sms-onboarding');

    // Case D: Verified Teacher
    const verifiedTeacher = determineSmartRoute(
      { email: 'teacher@seld.gos.pk', uid: 'uid_teacher_01' },
      {
        uid: 'uid_teacher_01',
        email: 'teacher@seld.gos.pk',
        fullName: 'Ms. Shabana Parveen',
        role: 'teacher',
        schoolId: mockActiveSchool.id,
        schoolName: mockActiveSchool.name,
        status: 'active',
        assignedClassIds: ['cls_9_a'],
      },
      schoolDirectory
    );
    assert.equal(verifiedTeacher.targetTool, 'sms-dashboard');
    assert.equal(verifiedTeacher.role, 'teacher');

    // Case E: General Public User (No schoolId or unaffiliated)
    const generalUserWithProfile = determineSmartRoute(
      { email: 'freelancer@gmail.com', uid: 'gen_uid_1' },
      {
        uid: 'gen_uid_1',
        email: 'freelancer@gmail.com',
        fullName: 'General Educator',
        role: 'teacher',
        status: 'none',
        assignedClassIds: [],
      },
      schoolDirectory
    );
    assert.equal(generalUserWithProfile.targetTool, 'dashboard');
    assert.equal(generalUserWithProfile.role, 'teacher');

    const generalUserWithoutProfile = determineSmartRoute(
      { email: 'user@example.com', uid: 'gen_uid_2' },
      null,
      schoolDirectory
    );
    assert.equal(generalUserWithoutProfile.targetTool, 'dashboard');
    assert.equal(generalUserWithoutProfile.role, 'teacher');

    // Case F: User with Admin / Principal capabilities (Waleed Shah, Principal role, Designation)
    // 1. Waleed Shah specifically must route to School Admin Dashboard
    const waleedShahUser = { email: 'waleedshah1@gmail.com', uid: 'uid_waleed_shah' };
    const waleedShahProfile: UserProfile = {
      uid: 'uid_waleed_shah',
      email: 'waleedshah1@gmail.com',
      fullName: 'Waleed Shah',
      role: 'principal',
      designation: 'Principal',
      status: 'active',
      assignedClassIds: [],
    };
    assert.equal(hasAdminCapabilities(waleedShahUser, waleedShahProfile, schoolDirectory), true);

    const waleedShahRoute = determineSmartRoute(waleedShahUser, waleedShahProfile, schoolDirectory);
    assert.equal(waleedShahRoute.targetTool, 'sms-dashboard');
    assert.equal(waleedShahRoute.role, 'admin');

    // 2. Generic Principal with designation 'Headmaster' or role 'principal'
    const principalProfile: UserProfile = {
      uid: 'uid_principal_2',
      email: 'headmaster@school.edu.pk',
      fullName: 'Ghulam Rasool',
      role: 'principal',
      designation: 'Headmaster (BPS-18)',
      status: 'active',
      assignedClassIds: [],
    };
    assert.equal(hasAdminCapabilities(null, principalProfile, schoolDirectory), true);
    const principalRoute = determineSmartRoute({ email: principalProfile.email, uid: principalProfile.uid }, principalProfile, schoolDirectory);
    assert.equal(principalRoute.targetTool, 'sms-dashboard');
    assert.equal(principalRoute.role, 'admin');

    // 3. User affiliated as school administrator in school.adminUids
    const schoolAdminUser = { email: 'inst.admin@district.gov.pk', uid: 'uid_inst_admin' };
    const schoolWithAdmin: School = {
      ...mockActiveSchool,
      adminUids: ['uid_inst_admin'],
    };
    assert.equal(hasAdminCapabilities(schoolAdminUser, null, [schoolWithAdmin]), true);
    const instAdminRoute = determineSmartRoute(schoolAdminUser, null, [schoolWithAdmin]);
    assert.equal(instAdminRoute.targetTool, 'sms-dashboard');
    assert.equal(instAdminRoute.role, 'admin');

    // 4. Regular teacher must NOT have admin capabilities
    assert.equal(hasAdminCapabilities({ email: 'teacher@school.edu' }, {
      uid: 't_1',
      email: 'teacher@school.edu',
      fullName: 'Regular Teacher',
      role: 'teacher',
      status: 'active',
      assignedClassIds: [],
    }, schoolDirectory), false);

    // 5. Custom claims superAdmin gives admin capabilities; plain email does not
    assert.equal(hasAdminCapabilities({ email: 'any.super@domain.com' }, null, null, { superAdmin: true }), true);
    assert.equal(hasAdminCapabilities({ email: 'owner@pakedu.com' }, null, null, null), false);

    console.log('✅ PASS: Automatic Smart Login Routing System Tests (All 4 Account Types + Pending + Admin Capabilities)');
  }

  // 14. Serverless Security & Vercel Headers Security Audit Tests
  {
    const vercelConfig = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf-8')
    );
    assert.ok(vercelConfig.headers, 'vercel.json must define security headers');
    const globalHeaderRule = vercelConfig.headers.find((h: any) => h.source === '/(.*)');
    assert.ok(globalHeaderRule, 'vercel.json must have global /(.*) header rule');

    const headersMap = new Map<string, string>();
    for (const hdr of globalHeaderRule.headers) {
      headersMap.set(hdr.key, hdr.value);
    }

    assert.equal(headersMap.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(headersMap.get('X-Frame-Options'), 'DENY');
    assert.equal(headersMap.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
    assert.ok(headersMap.get('Permissions-Policy')?.includes('camera=()'));
    assert.ok(headersMap.get('Content-Security-Policy')?.includes("default-src 'self'"));
    assert.ok(headersMap.get('Content-Security-Policy')?.includes('https://apis.google.com'));

    const apiHeaderRule = vercelConfig.headers.find((h: any) => h.source === '/api/(.*)');
    assert.ok(apiHeaderRule, 'vercel.json must have /api/(.*) CORS header rule');
    const apiHeadersMap = new Map<string, string>();
    for (const hdr of apiHeaderRule.headers) {
      apiHeadersMap.set(hdr.key, hdr.value);
    }
    assert.equal(apiHeadersMap.get('Access-Control-Allow-Origin'), 'https://pakedu.vercel.app');

    // 15. Verify api/_security.ts uses zero-secret jose JWT verification without firebase-admin
    const securityCode = fs.readFileSync(path.resolve(process.cwd(), 'api/_security.ts'), 'utf-8');
    assert.equal(securityCode.includes('firebase-admin'), false, 'api/_security.ts must NOT use firebase-admin SDK');
    assert.equal(securityCode.includes("from 'jose'"), true, 'api/_security.ts must import from jose');
    assert.equal(securityCode.includes('verifyFirebaseToken'), true, 'api/_security.ts must export verifyFirebaseToken');
    assert.equal(securityCode.includes('securetoken@system.gserviceaccount.com'), true, 'Must use Google public certificates');

    console.log('✅ PASS: Serverless Security & Vercel Headers Security Audit Tests');
  }

  // 16. Advanced Fee Management: Concessions, Partial Payments, Advance Balance & Student Fee Ledger
  {
    const concessionRules: FeeConcessionRule[] = [
      { id: 'c_orphan', schoolId: 'sch_1', title: 'Orphan Discount', discountType: 'percentage', value: 50, isActive: true },
      { id: 'c_staff', schoolId: 'sch_1', title: 'Staff Child', discountType: 'percentage', value: 100, isActive: true },
      { id: 'c_fixed', schoolId: 'sch_1', title: 'Hardship Waiver', discountType: 'fixed', value: 400, isActive: true },
    ];
    const structures: ClassFeeStructure[] = [
      {
        id: 'cls_9_a',
        schoolId: 'sch_1',
        classId: 'cls_9_a',
        grade: 'Class 9',
        monthlyTuitionFee: 1500,
        admissionFee: 2000,
        examFee: 500,
        customCharges: [{ id: 'lab', title: 'Lab Fund', amount: 500 }],
        academicYear: '2025-2026',
      },
    ];

    const orphanStudent: Student = {
      id: 'stu_1',
      grNumber: 'GR-2001',
      fullName: 'Bilal Ahmed',
      fatherName: 'Farooq Ahmed',
      dob: '2011-01-01',
      gender: 'Male',
      classId: 'cls_9_a',
      grade: 'Class 9',
      section: 'A',
      admissionDate: '2025-04-01',
      status: 'active',
      guardianPhone: '0300-1234567',
      concessionId: 'c_orphan',
      concessionTitle: 'Orphan Discount',
      concessionType: 'percentage',
      concessionValue: 50,
    };

    const classFee = getExpectedClassMonthlyFee('cls_9_a', structures);
    assert.equal(classFee.grossMonthlyFee, 2000);

    const orphanDisc = calculateStudentDiscount(orphanStudent, classFee.grossMonthlyFee, concessionRules);
    assert.equal(orphanDisc.discountAmount, 1000);
    assert.equal(orphanDisc.concessionTitle, 'Orphan Discount');
    assert.equal(orphanDisc.percentEffective, 50);

    assert.equal(getNextMonthKey('2026-11'), '2026-12');
    assert.equal(getNextMonthKey('2026-12'), '2027-01');

    // Partial payment + Next Month Advance scenario in Student Fee Ledger
    const partialNov: FeePayment = {
      id: 'p_nov',
      schoolId: 'sch_1',
      studentId: 'stu_1',
      studentName: 'Bilal Ahmed',
      grNumber: 'GR-2001',
      classId: 'cls_9_a',
      grade: 'Class 9',
      section: 'A',
      month: '2026-11',
      monthLabel: 'November 2026',
      academicYear: '2025-2026',
      baseAmount: 1500,
      customChargesAmount: 500,
      discount: 1000,
      netAmount: 1000,
      paidAmount: 600,
      pendingBalance: 400,
      status: 'partial',
    };

    const partialLedger = calculateStudentFeeLedger(
      orphanStudent,
      structures,
      [partialNov],
      concessionRules,
      '2026-11'
    );
    assert.equal(partialLedger.totalDue, 1000);
    assert.equal(partialLedger.totalPaid, 600);
    assert.equal(partialLedger.pendingBalance, 400);
    assert.equal(partialLedger.advanceBalance, 0);

    // Settled Nov + Rs. 500 advance toward Dec 2026
    const paidNov: FeePayment = { ...partialNov, paidAmount: 1000, pendingBalance: 0, advanceGenerated: 500, status: 'paid' };
    const advDec: FeePayment = {
      ...partialNov,
      id: 'p_dec',
      month: '2026-12',
      monthLabel: 'December 2026',
      paidAmount: 500,
      advanceUsed: 500,
      pendingBalance: 500,
      status: 'partial',
    };
    const advanceLedger = calculateStudentFeeLedger(
      orphanStudent,
      structures,
      [paidNov, advDec],
      concessionRules,
      '2026-11'
    );
    assert.equal(advanceLedger.totalDue, 1000);
    assert.equal(advanceLedger.totalPaid, 1500);
    assert.equal(advanceLedger.pendingBalance, 0);
    assert.equal(advanceLedger.advanceBalance, 500);

    console.log('✅ PASS: Advanced Fee Management (Concessions, Partial Payments, Advance Credit & Ledger) Tests');
  }

  // 16. Auto-Role Provisioning & Firestore Rules Security Guard Tests
  {
    const rulesSrc = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');
    const authCtxSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/context/AuthContext.tsx'), 'utf-8');
    const authModalSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/AuthModal.tsx'), 'utf-8');
    const smsCtxSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/features/sms/context/SmsContext.tsx'), 'utf-8');

    // Verify /users/{uid} rules allow self-registration as teacher or admin (none/pending) without requiring schoolId first
    assert.equal(rulesSrc.includes("(incoming().get('role', '') in ['teacher', 'admin'])"), true);
    assert.equal(rulesSrc.includes("(incoming().get('status', '') in ['none', 'pending'])"), true);
    assert.equal(
      rulesSrc.includes("(!('isSuperAdmin' in incoming()) || incoming().isSuperAdmin == false)"),
      true,
      'firestore.rules must block self-assignment of isSuperAdmin on user create/update'
    );
    assert.equal(
      rulesSrc.includes("incoming().get('isAdmissionIncharge', false) == false"),
      true,
      'firestore.rules must block self-assignment of isAdmissionIncharge on create/onboarding'
    );
    // Verify user can link schoolId after creation when unlinked, while active status remains protected
    assert.equal(rulesSrc.includes("existing().get('schoolId', '') == ''"), true);
    // Verify School Admin can approve teachers in /users/{uid} for their own schoolId
    assert.equal(rulesSrc.includes("isSchoolAdmin(incoming().get('schoolId', ''))"), true);
    // Verify /schools/{schoolId} allows pending_approval creation by creator and reading active schools
    assert.equal(rulesSrc.includes("incoming().get('status', '') == 'pending_approval'"), true);
    assert.equal(rulesSrc.includes("existing().get('status', '') == 'active'"), true);

    // Verify AuthContext prevents signup race condition, self-heals missing user docs with teacher/none, and preserves pending status
    assert.equal(authCtxSrc.includes('setAuthSignupTransactionInFlight'), true);
    assert.equal(authCtxSrc.includes('isExplicitlyPendingOrRejected'), true);
    assert.equal(authCtxSrc.includes("role: 'teacher'"), true);
    assert.equal(authCtxSrc.includes("status: 'none'"), true);

    // Verify smsFirestoreService strips undefined values so setDoc never fails on optional fields
    const serviceSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/features/sms/services/smsFirestoreService.ts'), 'utf-8');
    assert.equal(serviceSrc.includes('sanitizeFirestoreData'), true);

    // Verify AuthModal uses signup transaction lock, follows 3-step admin signup (user -> school -> link), and refreshes AuthContext
    assert.equal(authModalSrc.includes('setAuthSignupTransactionInFlight(true)'), true);
    assert.equal(authModalSrc.includes('await refreshUserProfile()'), true);
    assert.equal(authModalSrc.includes('skipFirestoreSync: true'), true);
    assert.equal(authModalSrc.includes('linkedAdminProfile'), true);

    // Verify Super Admin school approval updates both activatedSchool and admin users/{uid} (with semisCode)
    assert.equal(smsCtxSrc.includes('semisCode: target.semisCode'), true);
    assert.equal(smsCtxSrc.includes('saveSchoolToFirestore(activatedSchool)'), true);

    console.log('✅ PASS: Auto-Role Provisioning, Signup Race Guard & Firestore Rules Security Tests');
  }

  // 17. Phase B: Exams & Results Calculations, Class Positions & Firestore RBAC Rules Tests
  {
    assert.equal(computeAcademicGrade(85).grade, 'A+');
    assert.equal(computeAcademicGrade(75).grade, 'A');
    assert.equal(computeAcademicGrade(65).grade, 'B');
    assert.equal(computeAcademicGrade(55).grade, 'C');
    assert.equal(computeAcademicGrade(45).grade, 'D');
    assert.equal(computeAcademicGrade(33).grade, 'E');
    assert.equal(computeAcademicGrade(25).grade, 'F');

    assert.equal(formatOrdinalPosition(1), '1st');
    assert.equal(formatOrdinalPosition(2), '2nd');
    assert.equal(formatOrdinalPosition(3), '3rd');
    assert.equal(formatOrdinalPosition(11), '11th');
    assert.equal(formatOrdinalPosition(21), '21st');

    const mockExam: Exam = {
      id: 'exam_term1',
      schoolId: 'sch_1',
      title: 'First Term 2026',
      termType: 'First Term',
      academicYear: '2025-2026',
      classIds: ['cls_9_a'],
      subjects: [
        { id: 'eng', name: 'English', totalMarks: 100, passingMarks: 33 },
        { id: 'math', name: 'Mathematics', totalMarks: 100, passingMarks: 33 },
        { id: 'isl', name: 'Islamiyat', totalMarks: 50, passingMarks: 17 },
      ],
      status: 'published',
    };

    const s1: Student = {
      id: 's1',
      grNumber: 'GR-1',
      fullName: 'Amina',
      fatherName: 'Tariq',
      dob: '2011-01-01',
      gender: 'Female',
      classId: 'cls_9_a',
      grade: 'Class 9',
      section: 'A',
      admissionDate: '2025-04-01',
      status: 'active',
      guardianPhone: '0300-1111111',
    };
    const s2: Student = { ...s1, id: 's2', grNumber: 'GR-2', fullName: 'Bilal' };
    const s3: Student = { ...s1, id: 's3', grNumber: 'GR-3', fullName: 'Zainab' };
    const s4: Student = { ...s1, id: 's4', grNumber: 'GR-4', fullName: 'Usman' };

    const resAmina = computeStudentExamResult(mockExam, { eng: 90, math: 95, isl: 45 });
    assert.equal(resAmina.totalObtained, 230);
    assert.equal(resAmina.totalMax, 250);
    assert.equal(resAmina.percentage, 92);
    assert.equal(resAmina.overallGrade, 'A+');
    assert.equal(resAmina.resultStatus, 'Pass');

    // Failing one subject (20 < 33) marks overall resultStatus 'Fail' despite high total
    const resFail = computeStudentExamResult(mockExam, { eng: 90, math: 20, isl: 45 });
    assert.equal(resFail.resultStatus, 'Fail');

    // Absent in one subject marks overall Fail and 0 in absent subject
    const resAbsent = computeStudentExamResult(mockExam, { eng: 80, isl: 40 }, ['math']);
    assert.equal(resAbsent.resultStatus, 'Fail');
    assert.equal(resAbsent.subjectRows[1].isAbsent, true);

    const marksList: StudentExamMarks[] = [
      {
        id: 'm1',
        schoolId: 'sch_1',
        examId: 'exam_term1',
        classId: 'cls_9_a',
        studentId: 's1',
        studentName: 'Amina',
        grNumber: 'GR-1',
        grade: 'Class 9',
        subjectMarks: { eng: 90, math: 95, isl: 45 },
        totalObtained: 230,
        totalMax: 250,
        percentage: 92,
        overallGrade: 'A+',
        resultStatus: 'Pass',
      },
      {
        id: 'm2',
        schoolId: 'sch_1',
        examId: 'exam_term1',
        classId: 'cls_9_a',
        studentId: 's2',
        studentName: 'Bilal',
        grNumber: 'GR-2',
        grade: 'Class 9',
        subjectMarks: { eng: 80, math: 80, isl: 40 },
        totalObtained: 200,
        totalMax: 250,
        percentage: 80,
        overallGrade: 'A+',
        resultStatus: 'Pass',
      },
      {
        id: 'm3',
        schoolId: 'sch_1',
        examId: 'exam_term1',
        classId: 'cls_9_a',
        studentId: 's3',
        studentName: 'Zainab',
        grNumber: 'GR-3',
        grade: 'Class 9',
        subjectMarks: { eng: 80, math: 80, isl: 40 },
        totalObtained: 200,
        totalMax: 250,
        percentage: 80,
        overallGrade: 'A+',
        resultStatus: 'Pass',
      },
    ];

    const standings = computeClassPositions(mockExam, [s1, s2, s3, s4], marksList);
    assert.equal(standings.get('s1')?.position, 1);
    assert.equal(standings.get('s2')?.position, 2);
    assert.equal(standings.get('s3')?.position, 2); // tie handled properly
    assert.equal(standings.get('s4')?.position, undefined); // unentered marks unranked

    // Verify RBAC rules in firestore.rules for /exams and /marks
    const rulesSrc = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');
    assert.equal(rulesSrc.includes('match /exams/{examId}'), true);
    assert.equal(rulesSrc.includes('match /marks/{markId}'), true);
    assert.equal(rulesSrc.includes('isValidExam(incoming())'), true);
    assert.equal(rulesSrc.includes('isValidExamMarks(incoming())'), true);
    assert.equal(rulesSrc.includes('incoming().classId in userDoc().assignedClassIds'), true);

    console.log('✅ PASS: Phase B Exams & Results Calculations, Class Positions & Firestore RBAC Tests');
  }

  // 18. Global Firestore Undefined-Field Sanitization & Write Coverage Tests
  {
    // Mock Firestore serverTimestamp sentinel (non-plain prototype / FieldValue-like object)
    class MockFieldValue {
      readonly _methodName = 'serverTimestamp';
    }
    const sentinel = new MockFieldValue();

    // 1. Attendance payload with undefined nested record notes & top-level optional fields
    const dirtyAttendance = {
      id: '2026-11-25_cls_9_a',
      schoolId: 'sch_1',
      classId: 'cls_9_a',
      date: '2026-11-25',
      conductedBy: undefined,
      notes: undefined,
      records: {
        stu_1: { status: 'present', note: undefined },
        stu_2: { status: 'absent', note: 'Medical leave' },
      },
      updatedAt: sentinel,
    };
    const cleanAtt = sanitizeFirestoreData(dirtyAttendance);
    assert.equal('conductedBy' in cleanAtt, false);
    assert.equal('notes' in cleanAtt, false);
    assert.equal('note' in cleanAtt.records.stu_1, false);
    assert.equal(cleanAtt.records.stu_2.note, 'Medical leave');
    assert.equal(cleanAtt.updatedAt, sentinel, 'FieldValue sentinel must be preserved untouched');

    // 2. Fee payment payload with undefined installment note & optional concession fields
    const dirtyPayment = {
      id: 'pay_1',
      schoolId: 'sch_1',
      studentId: 'stu_1',
      month: '2026-11',
      receiptNumber: 'RCPT-2026-0001',
      paymentMethod: 'Cash',
      notes: 'Paid in full',
      concessionId: undefined,
      allocatedNextMonth: undefined,
      installments: [
        { amount: 1500, date: '2026-11-25', receiptNumber: 'RCPT-1', note: undefined },
      ],
    };
    const cleanPay = sanitizeFirestoreData(dirtyPayment);
    assert.equal('concessionId' in cleanPay, false);
    assert.equal('allocatedNextMonth' in cleanPay, false);
    assert.equal('note' in cleanPay.installments[0], false);
    assert.equal(cleanPay.installments[0].amount, 1500);

    // 3. Student payload with optional undefined fields
    const dirtyStudent = {
      id: 'stu_1',
      grNumber: 'GR-100',
      fullName: 'Ali',
      fatherName: 'Ahmed',
      bFormNumber: undefined,
      address: undefined,
      classId: 'cls_9_a',
      status: 'active',
    };
    const cleanStu = sanitizeFirestoreData(dirtyStudent);
    assert.equal('bFormNumber' in cleanStu, false);
    assert.equal('address' in cleanStu, false);
    assert.equal(cleanStu.fullName, 'Ali');

    // 4. Verify global coverage in firebase config, smsFirestoreService, LessonPlanTool, and cv-builder service
    const firebaseTs = fs.readFileSync(path.resolve(process.cwd(), 'src/firebase.ts'), 'utf-8');
    const cvFirebaseTs = fs.readFileSync(path.resolve(process.cwd(), 'src/features/cv-builder/lib/firebase.ts'), 'utf-8');
    const smsServiceTs = fs.readFileSync(path.resolve(process.cwd(), 'src/features/sms/services/smsFirestoreService.ts'), 'utf-8');
    const cvServiceTs = fs.readFileSync(path.resolve(process.cwd(), 'src/features/cv-builder/lib/firestoreService.ts'), 'utf-8');
    const lessonPlanTsx = fs.readFileSync(path.resolve(process.cwd(), 'src/components/LessonPlanTool.tsx'), 'utf-8');
    const rulesSrc = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');

    assert.equal(firebaseTs.includes('ignoreUndefinedProperties: true'), true);
    assert.equal(cvFirebaseTs.includes('ignoreUndefinedProperties: true'), true);
    assert.equal(smsServiceTs.includes("from '../../../utils/firestoreSanitizer'"), true);
    assert.equal(cvServiceTs.includes("from '../../../utils/firestoreSanitizer'"), true);
    assert.equal(lessonPlanTsx.includes("from '../utils/firestoreSanitizer'"), true);
    assert.equal(rulesSrc.includes("'markedByUid', 'markedByName'"), true);

    // Ensure zero raw `setDoc(..., {` remain in smsFirestoreService.ts without sanitizeFirestoreData
    const setDocCount = (smsServiceTs.match(/\bsetDoc\(/g) || []).length;
    const sanitizedCount = (smsServiceTs.match(/sanitizeFirestoreData\(/g) || []).length;
    assert.equal(sanitizedCount >= setDocCount, true, 'Every setDoc in smsFirestoreService must be sanitized');

    console.log('✅ PASS: Global Firestore Undefined-Field Sanitization & Write Coverage Tests');
  }

  // 19. Phase C: Parent Portal Routing, Strict Read-Only RBAC & Child Isolation Tests
  {
    const parentSchool: any = {
      id: 'sch_401020304',
      name: 'Govt. Boys High School Latifabad',
      semisCode: '401020304',
      status: 'active',
      primaryAdminEmail: 'parent@family.pk', // Even if email collides, role==='parent' must NEVER get admin powers
    };

    const linkedParentProfile: any = {
      uid: 'uid_parent_1',
      email: 'parent@family.pk',
      fullName: 'Ghulam Mustafa',
      role: 'parent',
      status: 'active',
      schoolId: 'sch_401020304',
      schoolName: 'Govt. Boys High School Latifabad',
      semisCode: '401020304',
      childStudentId: 'stu_ali_101',
      childGrNumber: 'GR-1001',
      childName: 'Ali Raza',
      parentLinkId: 'sch_401020304__GR-1001',
      assignedClassIds: [],
      isSuperAdmin: false,
      isAdmissionIncharge: false,
    };

    assert.equal(
      hasAdminCapabilities({ email: 'parent@family.pk', uid: 'uid_parent_1' }, linkedParentProfile, [parentSchool]),
      false,
      'Parent role must NEVER inherit Admin capabilities'
    );

    const linkedParentRoute = determineSmartRoute(
      { email: 'parent@family.pk', uid: 'uid_parent_1' },
      linkedParentProfile,
      [parentSchool]
    );
    assert.equal(linkedParentRoute.role, 'parent');
    assert.equal(linkedParentRoute.targetTool, 'sms-parent');
    assert.equal(typeof linkedParentRoute.reason, 'string');

    const unlinkedParentProfile: any = {
      uid: 'uid_parent_2',
      email: 'newparent@family.pk',
      fullName: 'Abdul Karim',
      role: 'parent',
      status: 'pending',
      assignedClassIds: [],
      isSuperAdmin: false,
      isAdmissionIncharge: false,
    };
    assert.equal(
      hasAdminCapabilities({ email: 'newparent@family.pk', uid: 'uid_parent_2' }, unlinkedParentProfile, [parentSchool]),
      false
    );
    const unlinkedParentRoute = determineSmartRoute(
      { email: 'newparent@family.pk', uid: 'uid_parent_2' },
      unlinkedParentProfile,
      [parentSchool]
    );
    assert.equal(unlinkedParentRoute.role, 'parent');
    assert.equal(unlinkedParentRoute.targetTool, 'sms-parent');

    // Verify Firestore Rules enforce strict read-only child-scoped isolation
    const rulesSrc = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');
    assert.equal(rulesSrc.includes("in ['teacher', 'admin', 'principal']"), true, 'isSchoolMember must exclude parent');
    assert.equal(rulesSrc.includes('function isSchoolParent(schoolId)'), true);
    assert.equal(rulesSrc.includes('function isVerifiedParentClaim(data)'), true);
    assert.equal(rulesSrc.includes("match /parentLinks/{linkId}"), true);
    assert.equal(rulesSrc.includes("studentId == userDoc().get('childStudentId', '')"), true, 'Parent student read must be scoped to childStudentId');
    assert.equal(rulesSrc.includes("existing().get('studentId', '') == userDoc().get('childStudentId', '')"), true, 'Parent marks & fees must be scoped to childStudentId');
    assert.equal(rulesSrc.includes("existing().get('status', '') == 'published'"), true, 'Parent exam reads must be restricted to published exams');

    // Verify SmsContext uses strict child-scoped Firestore queries for parents
    const smsContextSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/features/sms/context/SmsContext.tsx'), 'utf-8');
    assert.equal(smsContextSrc.includes('fetchSingleStudentFromFirestore'), true);
    assert.equal(smsContextSrc.includes('fetchChildFeePaymentsFromFirestore'), true);
    assert.equal(smsContextSrc.includes('fetchChildMarksFromFirestore'), true);
    assert.equal(smsContextSrc.includes('fetchPublishedExamsFromFirestore'), true);
    assert.equal(smsContextSrc.includes('generateParentInviteForStudent'), true);

    // Verify Parent Portal UI across StudentDirectory, AuthModal, ParentDashboard, and App
    const studentDirSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/features/sms/components/StudentDirectory.tsx'), 'utf-8');
    const authModalSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/AuthModal.tsx'), 'utf-8');
    const parentDashSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/features/sms/components/ParentDashboard.tsx'), 'utf-8');
    const appSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf-8');

    assert.equal(studentDirSrc.includes('Parent Portal Access'), true);
    assert.equal(studentDirSrc.includes('Generate Invite Code & Link'), true);
    assert.equal(studentDirSrc.includes('parentEmail'), true);
    assert.equal(authModalSrc.includes("accountIntent === 'parent'"), true);
    assert.equal(authModalSrc.includes('verifyAndClaimParentLink'), true);
    assert.equal(authModalSrc.includes('parent_invite'), true);
    assert.equal(parentDashSrc.includes('calculateStudentFeeLedger'), true);
    assert.equal(parentDashSrc.includes('triggerPrintDocument'), true);
    assert.equal(parentDashSrc.includes('Parent Portal · Strict Read-Only'), true);
    assert.equal(appSrc.includes('isParentUser'), true);
    assert.equal(appSrc.includes('path="/parent/dashboard"'), true);

    console.log('✅ PASS: Phase C Parent Portal Routing, Strict Read-Only RBAC & Isolation Tests');
  }

  // 20. Mobile Split-Screen Auth, Splash Screen, Appointment Letter & Phase D Modules Tests
  {
    const authModalSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/AuthModal.tsx'), 'utf-8');
    const appSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf-8');
    const indexCss = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf-8');
    const mobilePdfSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/utils/mobilePdfExport.ts'), 'utf-8');
    const letterModalSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/features/sms/components/AppointmentLetterModal.tsx'), 'utf-8');
    const teacherProfileSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/features/sms/components/TeacherProfile.tsx'), 'utf-8');
    const teacherMgmtSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/features/sms/components/TeacherManagement.tsx'), 'utf-8');
    const timetableSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/features/sms/components/TimetableManager.tsx'), 'utf-8');
    const homeworkSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/features/sms/components/HomeworkManager.tsx'), 'utf-8');
    const certificatesSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/features/sms/components/CertificatesManager.tsx'), 'utf-8');
    const rulesSrc = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');
    const smsContextSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/features/sms/context/SmsContext.tsx'), 'utf-8');

    // 1. Split-screen AuthModal (Desktop Form Left + Navy/Indigo Branding Right, Mobile Slim Banner Top + 44px touch targets)
    assert.equal(authModalSrc.includes('order-2 lg:order-1 lg:col-span-7'), true);
    assert.equal(authModalSrc.includes('order-1 lg:order-2 lg:col-span-5'), true);
    assert.equal(authModalSrc.includes('min-h-[44px]'), true);
    assert.equal(authModalSrc.includes('handleGoogleAuth'), true);

    // 2. Mobile-responsive startup splash screen
    assert.equal(appSrc.includes('min-h-[100dvh] w-[100vw]'), true);
    assert.equal(appSrc.includes('pakedu-splash-ring'), true);
    assert.equal(appSrc.includes('pakedu-splash-bar'), true);
    assert.equal(indexCss.includes('@keyframes pakeduSplashPulse'), true);
    assert.equal(indexCss.includes('@keyframes pakeduSplashSlide'), true);

    // 3. Appointment / Job Offer Letter & Mobile PDF Exporter
    assert.equal(mobilePdfSrc.includes('exportA4ElementAsPdf'), true);
    assert.equal(mobilePdfSrc.includes('saveFileUniversal'), true);
    assert.equal(letterModalSrc.includes('Appointment &amp; Job Offer Letter'), true);
    assert.equal(letterModalSrc.includes('exportA4ElementAsPdf'), true);
    assert.equal(letterModalSrc.includes('triggerPrintDocument'), true);
    assert.equal(teacherProfileSrc.includes('Generate Appointment Letter'), true);
    assert.equal(teacherProfileSrc.includes('AppointmentLetterModal'), true);
    assert.equal(teacherMgmtSrc.includes('AppointmentLetterModal'), true);

    // 4. Phase D: Timetable, Homework & Certificates (TC / Character) + RBAC rules
    assert.equal(timetableSrc.includes('overflow-x-auto'), true);
    assert.equal(timetableSrc.includes('canManageTimetable'), true);
    assert.equal(homeworkSrc.includes('canPostHomework'), true);
    assert.equal(homeworkSrc.includes('Assign Homework'), true);
    assert.equal(certificatesSrc.includes('canManageCertificates'), true);
    assert.equal(certificatesSrc.includes('Transfer / School Leaving Certificate (TC)'), true);
    assert.equal(certificatesSrc.includes('Character Certificate'), true);
    assert.equal(certificatesSrc.includes('exportA4ElementAsPdf'), true);

    assert.equal(appSrc.includes('path="/sms/timetable"'), true);
    assert.equal(appSrc.includes('path="/sms/homework"'), true);
    assert.equal(appSrc.includes('path="/sms/certificates"'), true);
    assert.equal(smsContextSrc.includes('saveTimetableEntry'), true);
    assert.equal(smsContextSrc.includes('saveHomework'), true);
    assert.equal(smsContextSrc.includes('saveCertificate'), true);

    assert.equal(rulesSrc.includes('match /timetable/{entryId}'), true);
    assert.equal(rulesSrc.includes('match /homework/{homeworkId}'), true);
    assert.equal(rulesSrc.includes('match /certificates/{certificateId}'), true);

    console.log('✅ PASS: Mobile Split-Screen Auth, Splash, Appointment Letter & Phase D Tests');
  }

  // 21. Super Admin Strict RBAC Isolation, Global Notice Board & Read-Only Oversight Tests
  {
    const rulesSrc = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');
    const smsContextSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/features/sms/context/SmsContext.tsx'), 'utf-8');
    const appSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf-8');
    const superAdminDashSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/features/sms/components/SuperAdminDashboard.tsx'), 'utf-8');
    const smsDashSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/features/sms/components/SmsDashboard.tsx'), 'utf-8');

    // 1. firestore.rules isolates tenant subcollections away from Super Admin & enables Global Notice Board + analytics summary
    const isSchoolMemberStart = rulesSrc.indexOf('function isSchoolMember(schoolId)');
    const isSchoolParentStart = rulesSrc.indexOf('function isSchoolParent(schoolId)');
    const isSchoolAdminStart = rulesSrc.indexOf('function isSchoolAdmin(schoolId)');
    const canAuthorStart = rulesSrc.indexOf('function canAuthorSyllabus()');
    const isParentHelperBlock = rulesSrc.slice(isSchoolMemberStart, isSchoolParentStart);
    assert.equal(isSchoolMemberStart > -1 && isSchoolParentStart > isSchoolMemberStart && isSchoolAdminStart > isSchoolMemberStart && canAuthorStart > isSchoolAdminStart, true);
    assert.equal(isParentHelperBlock.includes('isSuperAdmin()'), false);
    const isSchoolAdminBlock = rulesSrc.slice(isSchoolAdminStart, canAuthorStart);
    assert.equal(isSchoolAdminBlock.includes('isSuperAdmin()'), false);
    assert.equal(rulesSrc.includes('match /globalNotices/{noticeId}'), true);
    assert.equal(rulesSrc.includes("'analytics'"), true);

    // 2. SmsContext enforces read-only impersonation, blocks school-level writes & manages notices
    assert.equal(smsContextSrc.includes('isReadOnlyImpersonation'), true);
    assert.equal(smsContextSrc.includes('blockSchoolMutation'), true);
    assert.equal(smsContextSrc.includes('PLATFORM_SYNC_OPERATIONS'), true);
    assert.equal(smsContextSrc.includes('publishGlobalNotice'), true);
    assert.equal(smsContextSrc.includes('markNoticeAsRead'), true);
    assert.equal(smsContextSrc.includes('saveSchoolAnalyticsToFirestore'), true);
    assert.equal(smsContextSrc.includes('Strict Super Admin RBAC Isolation'), true);

    // 3. App.tsx hides school-level modules from Super Admin & renders Read-Only banner
    assert.equal(appSrc.includes('isSuperAdminActive'), true);
    assert.equal(appSrc.includes('You are viewing as School Admin - Read Only'), true);
    assert.equal(appSrc.includes('Platform Overview'), true);
    assert.equal(appSrc.includes('Super Admin Fleet'), true);
    assert.equal(appSrc.includes('Notice Board'), true);

    // 4. SuperAdminDashboard & SmsDashboard Notice Board + Read-Only View controls
    assert.equal(superAdminDashSrc.includes('View as School Admin'), true);
    assert.equal(superAdminDashSrc.includes('Notice Board'), true);
    assert.equal(superAdminDashSrc.includes('publishGlobalNotice'), true);
    assert.equal(superAdminDashSrc.includes('PLATFORM ANALYTICS OVERVIEW'), true);
    assert.equal(smsDashSrc.includes('Notifications &amp; Notices'), true);
    assert.equal(smsDashSrc.includes('markNoticeAsRead'), true);
    assert.equal(smsDashSrc.includes('Read-Only School Admin View'), true);

    console.log('✅ PASS: Super Admin RBAC Isolation, Global Notice Board & Read-Only Oversight Tests');
  }

  // 22. Student Portal Authentication, Self-Scoped Queries & Strict Read-Only RBAC Tests
  {
    const studentSchool: School = {
      id: 'sch_student_01',
      name: 'GBHS Latifabad',
      semisCode: '403020111',
      board: 'Sindh STBB',
      district: 'Hyderabad',
      taluka: 'Latifabad',
      adminUids: ['uid_admin_1'],
      activeAcademicYear: '2025-2026',
      status: 'active',
      primaryAdminType: 'principal',
      primaryAdminName: 'Head Master',
      primaryAdminEmail: 'student.portal@school.pk', // Collision check: student role never gets admin powers
    };

    const linkedStudentProfile: UserProfile = {
      uid: 'uid_student_1',
      email: 'student.portal@school.pk',
      fullName: 'Bilal Ahmed',
      role: 'student',
      schoolId: 'sch_student_01',
      schoolName: 'GBHS Latifabad',
      semisCode: '403020111',
      status: 'active',
      studentId: 'std_101',
      studentGrNumber: 'GR-1042',
      studentLinkId: 'sch_student_01__GR-1042',
      assignedClassIds: [],
      isSuperAdmin: false,
      isAdmissionIncharge: false,
    };

    assert.equal(
      hasAdminCapabilities({ email: 'student.portal@school.pk', uid: 'uid_student_1' }, linkedStudentProfile, [studentSchool]),
      false,
      'Student role must NEVER receive administrative privileges even if email collides'
    );

    const linkedStudentRoute = determineSmartRoute(
      { email: 'student.portal@school.pk', uid: 'uid_student_1' },
      linkedStudentProfile,
      [studentSchool]
    );
    assert.equal(linkedStudentRoute.role, 'student');
    assert.equal(linkedStudentRoute.targetTool, 'sms-student-portal');

    const pendingStudentRoute = determineSmartRoute(
      { email: 'newstudent@school.pk', uid: 'uid_student_2' },
      { ...linkedStudentProfile, uid: 'uid_student_2', status: 'pending', studentId: undefined },
      [studentSchool]
    );
    assert.equal(pendingStudentRoute.role, 'student');
    assert.equal(pendingStudentRoute.targetTool, 'sms-student-portal');

    const rulesSrc = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');
    const serviceSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/features/sms/services/smsFirestoreService.ts'), 'utf-8');
    const smsContextSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/features/sms/context/SmsContext.tsx'), 'utf-8');
    const studentDirSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/features/sms/components/StudentDirectory.tsx'), 'utf-8');
    const authModalSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/AuthModal.tsx'), 'utf-8');
    const studentDashSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/features/sms/components/StudentDashboard.tsx'), 'utf-8');
    const sharedSectionsSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/features/sms/components/StudentAcademicSections.tsx'), 'utf-8');
    const appSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf-8');

    // Firestore rules Student Isolation
    assert.equal(rulesSrc.includes('function isSchoolStudent(schoolId)'), true);
    assert.equal(rulesSrc.includes('function isSchoolStudentInClass(schoolId, targetClassId)'), true);
    assert.equal(rulesSrc.includes('function isVerifiedStudentClaim(data)'), true);
    assert.equal(rulesSrc.includes('match /studentLinks/{linkId}'), true);
    assert.equal(rulesSrc.includes("studentId == userDoc().get('studentId', '')"), true);
    assert.equal(rulesSrc.includes("existing().get('studentId', '') == userDoc().get('studentId', '')"), true);

    // Service & SmsContext student self-link & class-scoped queries
    assert.equal(serviceSrc.includes('verifyAndClaimStudentLink'), true);
    assert.equal(serviceSrc.includes('fetchStudentPortalLinksForSchoolFromFirestore'), true);
    assert.equal(serviceSrc.includes('fetchSingleClassFromFirestore'), true);
    assert.equal(serviceSrc.includes('fetchSingleFeeStructureFromFirestore'), true);
    assert.equal(smsContextSrc.includes('fetchSingleFeeStructureFromFirestore'), true);
    assert.equal(smsContextSrc.includes('generateStudentInviteForStudent'), true);
    assert.equal(smsContextSrc.includes('linkStudentAccount'), true);
    assert.equal(smsContextSrc.includes('studentPortalLinks'), true);

    // UI Components & Routing Isolation
    assert.equal(studentDirSrc.includes('Student Portal Access'), true);
    assert.equal(studentDirSrc.includes('Generate Student Invite'), true);
    assert.equal(authModalSrc.includes("accountIntent === 'student'"), true);
    assert.equal(authModalSrc.includes('verifyAndClaimStudentLink'), true);
    assert.equal(authModalSrc.includes('student_invite'), true);
    assert.equal(studentDashSrc.includes('Student Portal · Strict Read-Only'), true);
    assert.equal(sharedSectionsSrc.includes('Daily Homework Diary'), true);
    assert.equal(sharedSectionsSrc.includes('Class Timetable (Read-Only)'), true);
    assert.equal(appSrc.includes('isStudentUser'), true);
    assert.equal(appSrc.includes('path="/student/dashboard"'), true);

    console.log('✅ PASS: Student Portal Auth, Invite Claim, Strict Read-Only RBAC & Isolation Tests');
  }

  // 23. Email-Free Student Auth, GR / Student ID Login, & Admin/Parent Dashboard Invite Creation
  {
    assert.equal(
      buildSyntheticStudentEmail('sch_419030330', 'GR-1001'),
      'stu.gr1001.sch_419030330@student.pakedu.app'
    );
    assert.equal(
      buildSyntheticStudentEmail('sch_419030330', '  gr1001 '),
      'stu.gr1001.sch_419030330@student.pakedu.app'
    );
    assert.equal(isSyntheticStudentEmail('stu.gr1001.sch_419030330@student.pakedu.app'), true);
    assert.equal(isSyntheticStudentEmail('teacher@seld.gos.pk'), false);

    assert.equal(isGrOrStudentIdInput('GR-1001'), true);
    assert.equal(isGrOrStudentIdInput('std_001'), true);
    assert.equal(isGrOrStudentIdInput('teacher@seld.gos.pk'), false);
    assert.equal(isGrOrStudentIdInput(''), false);

    const syntheticValidation = validateAuthCredentials({
      mode: 'signup',
      email: buildSyntheticStudentEmail('sch_419030330', 'GR-1001'),
      password: 'password123',
      displayName: 'Shazia Bibi',
    });
    assert.equal(syntheticValidation.valid, true);

    const authModalSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/AuthModal.tsx'), 'utf-8');
    const smsDashSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/features/sms/components/SmsDashboard.tsx'), 'utf-8');
    const parentDashSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/features/sms/components/ParentDashboard.tsx'), 'utf-8');
    const smsContextSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/features/sms/context/SmsContext.tsx'), 'utf-8');
    const rulesSrc = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');

    // AuthModal email-free student signup + GR login UI & Auth rollback
    assert.equal(authModalSrc.includes('buildSyntheticStudentEmail'), true);
    assert.equal(authModalSrc.includes('isGrOrStudentIdInput'), true);
    assert.equal(authModalSrc.includes('newlyCreatedStudentUser.delete()'), true);
    assert.equal(authModalSrc.includes('Email Address or Student GR / ID *'), true);
    assert.equal(authModalSrc.includes('Student GR / ID detected — Select Your School *'), true);

    // Admin Dashboard (SmsDashboard) + Parent Dashboard + SmsContext Invite Creation
    assert.equal(smsDashSrc.includes('generateMissingStudentInvites'), true);
    assert.equal(smsDashSrc.includes('generateStudentInviteForStudent'), true);
    assert.equal(smsDashSrc.includes('Student Portal Invite Codes'), true);
    assert.equal(parentDashSrc.includes('ensureChildStudentInviteForParent'), true);
    assert.equal(parentDashSrc.includes('Create Student Invite Code'), true);
    assert.equal(smsContextSrc.includes('generateMissingStudentInvites'), true);
    assert.equal(smsContextSrc.includes('ensureChildStudentInviteForParent'), true);

    // Firestore Rules parent-scoped studentInviteCode init guard
    assert.equal(rulesSrc.includes("existing().get('studentInviteCode', '') == ''"), true);

    console.log('✅ PASS: Email-Free Student Signup, GR/ID Login & Admin/Parent Dashboard Invite Code Tests');
  }

  // 24. Windows Desktop Electron Shell, Preload IPC, Frontend File Saver & Print Integration Tests
  {
    const root = process.cwd();
    const electronTypesSrc = fs.readFileSync(path.resolve(root, 'src/types/electron.d.ts'), 'utf-8');
    const fileSaverSrc = fs.readFileSync(path.resolve(root, 'src/features/cv-builder/lib/mobileFileSaver.ts'), 'utf-8');
    const printDocSrc = fs.readFileSync(path.resolve(root, 'src/utils/printDocument.ts'), 'utf-8');
    const mainJsSrc = fs.readFileSync(path.resolve(root, 'electron/main.js'), 'utf-8');
    const preloadCjsSrc = fs.readFileSync(path.resolve(root, 'electron/preload.cjs'), 'utf-8');
    const builderJson = JSON.parse(fs.readFileSync(path.resolve(root, 'electron-builder.json'), 'utf-8'));
    const pkgJson = JSON.parse(fs.readFileSync(path.resolve(root, 'package.json'), 'utf-8'));
    const viteConfigSrc = fs.readFileSync(path.resolve(root, 'vite.config.ts'), 'utf-8');
    const gitignoreSrc = fs.readFileSync(path.resolve(root, '.gitignore'), 'utf-8');
    const winWorkflowSrc = fs.readFileSync(path.resolve(root, '.github/workflows/windows-build.yml'), 'utf-8');

    // 1. TypeScript declarations contract
    assert.equal(electronTypesSrc.includes('export interface ElectronSaveFileResult'), true);
    assert.equal(electronTypesSrc.includes('export interface ElectronPrintResult'), true);
    assert.equal(electronTypesSrc.includes('export interface ElectronAPI'), true);
    assert.equal(electronTypesSrc.includes('interface Window'), true);
    assert.equal(electronTypesSrc.includes('electronAPI?: ElectronAPI'), true);

    // 2. mobileFileSaver.ts Strategy 0 precedes Strategy 1 (Capacitor) & preserves Web fallbacks
    const electronIdx = fileSaverSrc.indexOf('window.electronAPI?.saveFile');
    const capacitorIdx = fileSaverSrc.indexOf('isNativePlatform');
    assert.equal(electronIdx > -1 && capacitorIdx > electronIdx, true, 'Electron Strategy 0 must run before Capacitor Strategy 1');
    assert.equal(fileSaverSrc.includes('blob.arrayBuffer()'), true);
    assert.equal(fileSaverSrc.includes('new Uint8Array'), true);
    assert.equal(fileSaverSrc.includes('if (result?.canceled)'), true);
    assert.equal(fileSaverSrc.includes('if (result?.error)'), true);
    assert.equal(fileSaverSrc.includes('navigator.share'), true);
    assert.equal(fileSaverSrc.includes('URL.createObjectURL(blob)'), true);

    // 3. printDocument.ts preserves printing-mode isolation & routes to Electron IPC or window.print()
    assert.equal(printDocSrc.includes("document.body.classList.add('printing-mode')"), true);
    assert.equal(printDocSrc.includes("document.body.classList.remove('printing-mode')"), true);
    assert.equal(printDocSrc.includes('window.electronAPI?.printDocument'), true);
    assert.equal(printDocSrc.includes('silent: false'), true);
    assert.equal(printDocSrc.includes('printBackground: true'), true);
    assert.equal(printDocSrc.includes('window.print()'), true);

    // 4. Electron main process security, navigation guards, and IPC channels
    assert.equal(mainJsSrc.includes('contextIsolation: true'), true);
    assert.equal(mainJsSrc.includes('nodeIntegration: false'), true);
    assert.equal(mainJsSrc.includes('sandbox: true'), true);
    assert.equal(mainJsSrc.includes('preload.cjs'), true);
    assert.equal(mainJsSrc.includes("ipcMain.handle('save-file'"), true);
    assert.equal(mainJsSrc.includes("ipcMain.handle('print-document'"), true);
    assert.equal(mainJsSrc.includes('dialog.showSaveDialog'), true);
    assert.equal(mainJsSrc.includes('event.sender.print('), true);
    assert.equal(mainJsSrc.includes('http://localhost:3000'), true);
    assert.equal(mainJsSrc.includes('../dist/index.html'), true);
    assert.equal(mainJsSrc.includes('setWindowOpenHandler'), true);
    assert.equal(mainJsSrc.includes('shell.openExternal'), true);

    // 5. Electron preload bridge matches ElectronAPI contract
    assert.equal(preloadCjsSrc.includes("contextBridge.exposeInMainWorld('electronAPI'"), true);
    assert.equal(preloadCjsSrc.includes('isElectron: true'), true);
    assert.equal(preloadCjsSrc.includes("ipcRenderer.invoke('save-file'"), true);
    assert.equal(preloadCjsSrc.includes("ipcRenderer.invoke('print-document'"), true);

    // 6. Packaging & CI workflow configuration
    assert.equal(builderJson.appId, 'pk.pakedu.portal');
    assert.equal(builderJson.productName, 'PakEdu Portal');
    assert.equal(builderJson.directories?.output, 'release');
    assert.equal(Array.isArray(builderJson.files) && builderJson.files.includes('dist/**/*'), true);
    assert.equal(Array.isArray(builderJson.files) && builderJson.files.includes('electron/**/*'), true);
    assert.equal(builderJson.win?.signAndEditExecutable, false);
    assert.equal(
      Array.isArray(builderJson.win?.target) &&
        builderJson.win.target.some((t: { target?: string; arch?: string[] }) => t.target === 'nsis' && t.arch?.includes('x64')),
      true
    );

    assert.equal(pkgJson.main, 'electron/main.js');
    assert.equal(typeof pkgJson.scripts?.['electron:dev'] === 'string' && pkgJson.scripts['electron:dev'].includes('electron'), true);
    assert.equal(
      typeof pkgJson.scripts?.['electron:build'] === 'string' &&
        pkgJson.scripts['electron:build'].includes('vite build') &&
        pkgJson.scripts['electron:build'].includes('electron-builder'),
      true
    );
    assert.equal(Boolean(pkgJson.devDependencies?.electron), true);
    assert.equal(Boolean(pkgJson.devDependencies?.['electron-builder']), true);
    assert.equal(Boolean(pkgJson.devDependencies?.concurrently), true);

    assert.equal(viteConfigSrc.includes("base: './'"), true);
    assert.equal(gitignoreSrc.includes('release/'), true);
    assert.equal(winWorkflowSrc.includes('windows-latest'), true);
    assert.equal(winWorkflowSrc.includes('npm install --legacy-peer-deps'), true);
    assert.equal(winWorkflowSrc.includes('npm run build'), true);
    assert.equal(winWorkflowSrc.includes('npx electron-builder --win --x64 --publish never'), true);
    assert.equal(winWorkflowSrc.includes('release/*.exe'), true);

    // 7. Runtime mock test for saveFileUniversal & triggerPrintDocument via window.electronAPI
    const g = globalThis as unknown as {
      window?: Record<string, unknown>;
      document?: Record<string, unknown>;
    };
    const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, 'window');
    const hadDocument = Object.prototype.hasOwnProperty.call(globalThis, 'document');
    const prevWindow = g.window;
    const prevDocument = g.document;

    try {
      let capturedSavePayload: { data: Uint8Array; fileName: string; mimeType?: string } | null = null;
      let capturedPrintOpts: { silent?: boolean; printBackground?: boolean } | undefined;
      const bodyClasses = new Set<string>();

      g.document = {
        createElement: () => {
          throw new Error('Web anchor fallback must not run when Electron IPC handles saveFile');
        },
        body: {
          classList: {
            add: (cls: string) => bodyClasses.add(cls),
            remove: (cls: string) => bodyClasses.delete(cls),
          },
        },
      };

      const happyElectronApi: ElectronAPI = {
        isElectron: true,
        saveFile: async (payload) => {
          capturedSavePayload = payload;
          return { canceled: false, filePath: 'C:\\Users\\PakEdu\\Documents\\Challan.pdf' };
        },
        printDocument: async (options) => {
          capturedPrintOpts = options;
          return { success: true };
        },
      };

      g.window = {
        electronAPI: happyElectronApi,
        addEventListener: () => {},
        removeEventListener: () => {},
      };

      // Happy path: Blob bytes converted to Uint8Array and passed to Electron IPC
      await saveFileUniversal(new Blob(['%PDF-1.4'], { type: 'application/pdf' }), 'Challan.pdf', 'application/pdf');
      assert.notEqual(capturedSavePayload, null);
      assert.equal(capturedSavePayload!.fileName, 'Challan.pdf');
      assert.equal(capturedSavePayload!.mimeType, 'application/pdf');
      assert.equal(capturedSavePayload!.data instanceof Uint8Array, true);
      assert.equal(new TextDecoder().decode(capturedSavePayload!.data), '%PDF-1.4');

      // Cancel path: must resolve cleanly without falling through to Web anchor download
      g.window.electronAPI = {
        ...happyElectronApi,
        saveFile: async () => ({ canceled: true }),
      };
      await saveFileUniversal(new Blob(['cancel-data'], { type: 'text/plain' }), 'Canceled.txt', 'text/plain');

      // Error path: must surface IPC write failure rather than silently swallowing it
      g.window.electronAPI = {
        ...happyElectronApi,
        saveFile: async () => ({ canceled: false, error: 'Write permission denied' }),
      };
      await assert.rejects(
        () => saveFileUniversal(new Blob(['err-data'], { type: 'application/pdf' }), 'Fail.pdf', 'application/pdf'),
        /Write permission denied/
      );

      // Print IPC path: applies printing-mode, invokes printDocument inside 80ms timeout, cleans up in finally
      g.window.electronAPI = happyElectronApi;
      triggerPrintDocument();
      assert.equal(bodyClasses.has('printing-mode'), true, 'printing-mode must be applied immediately');
      await new Promise((resolve) => setTimeout(resolve, 140));
      assert.deepEqual(capturedPrintOpts, { silent: false, printBackground: true });
      assert.equal(bodyClasses.has('printing-mode'), false, 'printing-mode must be removed in finally after Electron print');
    } finally {
      if (hadWindow) {
        g.window = prevWindow;
      } else {
        delete g.window;
      }
      if (hadDocument) {
        g.document = prevDocument;
      } else {
        delete g.document;
      }
    }

    console.log('✅ PASS: Windows Desktop Electron Shell, IPC Save/Print & Packaging Tests');
  }

  // 25. Warm Ivory, Terracotta & Deep Burgundy Editorial Theme + Print Isolation Tests
  {
    const root = process.cwd();
    const indexCss = fs.readFileSync(path.resolve(root, 'src/index.css'), 'utf-8');
    const authModalSrc = fs.readFileSync(path.resolve(root, 'src/components/AuthModal.tsx'), 'utf-8');
    const appSrc = fs.readFileSync(path.resolve(root, 'src/App.tsx'), 'utf-8');
    const superAdminSrc = fs.readFileSync(path.resolve(root, 'src/features/sms/components/SuperAdminDashboard.tsx'), 'utf-8');

    // Core CSS tokens & print isolation
    assert.equal(indexCss.includes('#FAF8F5'), true);
    assert.equal(indexCss.includes('#FFFDF9'), true);
    assert.equal(indexCss.includes('#E7E0D4'), true);
    assert.equal(indexCss.includes('#2C1215'), true);
    assert.equal(indexCss.includes('#58181D'), true);
    assert.equal(indexCss.includes('#7F1D1D'), true);
    assert.equal(indexCss.includes('#C2410C'), true);
    assert.equal(indexCss.includes('background: #ffffff !important;'), true);
    assert.equal(indexCss.includes('color: #000000 !important;'), true);

    // Flagship screen tokens
    assert.equal(authModalSrc.includes('bg-[#F3EFEA]'), true);
    assert.equal(authModalSrc.includes('#58181D'), true);
    assert.equal(authModalSrc.includes('rgba(255, 253, 249, 0.06)'), true);
    assert.equal(authModalSrc.includes('bg-[#7F1D1D]'), true);
    assert.equal(authModalSrc.includes('bg-[#C2410C]'), true);
    assert.equal(appSrc.includes('bg-[#2C1215]'), true);
    assert.equal(appSrc.includes('bg-[#FFFDF9]'), true);
    assert.equal(appSrc.includes('#58181D'), true);
    assert.equal(superAdminSrc.includes('#58181D'), true);
    assert.equal(superAdminSrc.includes('bg-[#C2410C]'), true);

    // Zero leftover indigo-*, violet-*, purple-*, or UI blue-* brand classes across .tsx/.css UI
    const walkUi = (dir: string): string[] => {
      const out: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walkUi(full));
        else if (full.endsWith('.tsx') || full.endsWith('.css')) out.push(full);
      }
      return out;
    };
    const bannedPattern = /\b(?:indigo|violet|purple|blue)-(?:50|100|200|300|400|500|600|700|800|900|950)\b/;
    for (const file of walkUi(path.resolve(root, 'src'))) {
      const content = fs.readFileSync(file, 'utf-8');
      assert.equal(
        bannedPattern.test(content),
        false,
        `Leftover cool brand class found in ${path.relative(root, file)}`
      );
    }

    console.log('✅ PASS: Warm Ivory, Terracotta & Deep Burgundy Editorial Theme & Print Isolation Tests');
  }

  // Test 26: Sidebar badge alignment/overflow guard & stale Super Admin session reset guard
  {
    const fs = await import('fs');
    const path = await import('path');
    const root = process.cwd();
    const appSrc = fs.readFileSync(path.resolve(root, 'src/App.tsx'), 'utf-8');
    const authCtxSrc = fs.readFileSync(path.resolve(root, 'src/context/AuthContext.tsx'), 'utf-8');
    const smsCtxSrc = fs.readFileSync(path.resolve(root, 'src/features/sms/context/SmsContext.tsx'), 'utf-8');

    // 1. Sidebar width, inner horizontal padding, flex-1 min-w-0 pr-2 wrapper, and flush shrink-0 ml-auto badges
    assert.equal(appSrc.includes('w-[272px] lg:w-72'), true);
    assert.equal(appSrc.includes('px-3 py-3 space-y-1 overflow-x-hidden'), true);
    assert.equal(appSrc.includes('flex items-center gap-2.5 flex-1 min-w-0 pr-2'), true);
    assert.equal(
      appSrc.includes('shrink-0 ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wider'),
      true
    );
    assert.equal(appSrc.includes('ENTERPRISE'), true);

    // 2. Logout & role-switch state reset across AuthContext, SmsContext, and App shell
    assert.equal(authCtxSrc.includes("'pakedu_active_tool'"), true);
    assert.equal(authCtxSrc.includes('window.history.replaceState'), true);

    assert.equal(smsCtxSrc.includes('resetSmsSessionState'), true);
    assert.equal(smsCtxSrc.includes('!authCtx.authLoading && !authCtx.currentUser'), true);
    assert.equal(smsCtxSrc.includes("setUserRoleState('teacher')"), true);
    assert.equal(smsCtxSrc.includes('if (demoMode)'), true);

    assert.equal(appSrc.includes('resetSmsSessionState()'), true);
    assert.equal(appSrc.includes('shellIdentityKey'), true);
    assert.equal(appSrc.includes('path="/super-admin"'), true);
    assert.equal(appSrc.includes("allowedRoles={['super-admin']}"), true);
    assert.equal(appSrc.includes('effectiveRole'), true);

    console.log('✅ PASS: Sidebar Badge Alignment & Stale Super Admin Logout/Role-Switch Reset Tests');
  }

  // Test 27: Offline Data Sync (idb IndexedDB Queue, Background Auto-Sync, Manual Sync & Conflict Handling)
  {
    const fs = await import('fs');
    const path = await import('path');
    const offlineSync = await import('../services/offlineSyncService');
    const root = process.cwd();

    // 1. Package dependency and source integration checks
    const pkgJson = JSON.parse(fs.readFileSync(path.resolve(root, 'package.json'), 'utf-8'));
    assert.equal(Boolean(pkgJson.dependencies?.idb), true, 'idb package must be installed in dependencies');

    const offlineSyncSrc = fs.readFileSync(path.resolve(root, 'src/services/offlineSyncService.ts'), 'utf-8');
    const smsServiceSrc = fs.readFileSync(path.resolve(root, 'src/features/sms/services/smsFirestoreService.ts'), 'utf-8');
    const smsCtxSrc = fs.readFileSync(path.resolve(root, 'src/features/sms/context/SmsContext.tsx'), 'utf-8');
    const appSrc = fs.readFileSync(path.resolve(root, 'src/App.tsx'), 'utf-8');
    const syncModalSrc = fs.readFileSync(
      path.resolve(root, 'src/features/sms/components/OfflineSyncCenterModal.tsx'),
      'utf-8'
    );

    assert.equal(offlineSyncSrc.includes("from 'idb'"), true);
    assert.equal(offlineSyncSrc.includes('openDB'), true);
    assert.equal(smsServiceSrc.includes('syncOfflineQueueItemToFirestore'), true);
    assert.equal(smsServiceSrc.includes('getDocFromServer'), true);
    assert.equal(smsServiceSrc.includes('recordServerBaselinesBatch'), true);
    assert.equal(smsCtxSrc.includes('syncNow'), true);
    assert.equal(smsCtxSrc.includes('resolveSyncConflict'), true);
    assert.equal(smsCtxSrc.includes("window.addEventListener('online'"), true);
    assert.equal(smsCtxSrc.includes('OfflineSyncCenterModal'), true);
    assert.equal(
      appSrc.includes('You are offline. Data is saved locally and will sync when online.'),
      true
    );
    assert.equal(appSrc.includes('Sync Now'), true);
    assert.equal(syncModalSrc.includes('Keep Local Version'), true);
    assert.equal(syncModalSrc.includes('Keep Online Version'), true);

    // 2. IndexedDB queue behavior, FIFO order, coalescing, and create-then-delete cleanup
    offlineSync.resetInMemoryOfflineStoreForTests();

    const baseAtt = {
      id: '2026-11-27_cls_9a',
      date: '2026-11-27',
      classId: 'cls_9a',
      grade: 'Class 9',
      section: 'A',
      markedByUid: 't_1',
      markedByName: 'Ali',
      markedAt: '2026-11-27T08:00:00.000Z',
      records: { std_1: { status: 'present' } },
      summary: { total: 1, present: 1, absent: 0, leave: 0, late: 0, percentage: 100 },
      updatedAt: '2026-11-27T08:00:00.000Z',
    };
    await offlineSync.recordServerBaseline(
      'schools/sch_1/attendance/2026-11-27_cls_9a',
      baseAtt,
      baseAtt.updatedAt
    );

    await offlineSync.enqueueOfflineMutation({
      entityType: 'attendance',
      action: 'upsert',
      operation: 'saveAttendance',
      schoolId: 'sch_1',
      docPath: 'schools/sch_1/attendance/2026-11-27_cls_9a',
      recordId: '2026-11-27_cls_9a',
      recordLabel: 'Attendance · Class 9 - A (2026-11-27)',
      payload: {
        ...baseAtt,
        records: { std_1: { status: 'absent' } },
        summary: { total: 1, present: 0, absent: 1, leave: 0, late: 0, percentage: 0 },
      },
      baseUpdatedAt: baseAtt.updatedAt,
      baseSnapshot: baseAtt,
    });

    // Second offline edit to same attendance coalesces while preserving initial baseline
    await offlineSync.enqueueOfflineMutation({
      entityType: 'attendance',
      action: 'upsert',
      operation: 'saveAttendance',
      schoolId: 'sch_1',
      docPath: 'schools/sch_1/attendance/2026-11-27_cls_9a',
      recordId: '2026-11-27_cls_9a',
      recordLabel: 'Attendance · Class 9 - A (2026-11-27)',
      payload: {
        ...baseAtt,
        records: { std_1: { status: 'late' } },
        summary: { total: 1, present: 0, absent: 0, leave: 0, late: 1, percentage: 100 },
      },
    });

    await offlineSync.enqueueOfflineMutation({
      entityType: 'feePayment',
      action: 'upsert',
      operation: 'saveFeePayment',
      schoolId: 'sch_1',
      docPath: 'schools/sch_1/feePayments/pay_1',
      recordId: 'pay_1',
      recordLabel: 'Fee Payment · Student 1',
      payload: {
        id: 'pay_1',
        studentId: 'std_1',
        studentName: 'Student 1',
        month: '2026-11',
        paidAmount: 1500,
        pendingBalance: 0,
        status: 'paid',
      },
    });

    const tempStu = await offlineSync.enqueueOfflineMutation({
      entityType: 'student',
      action: 'upsert',
      operation: 'addStudent',
      schoolId: 'sch_1',
      docPath: 'schools/sch_1/students/std_temp_offline',
      recordId: 'std_temp_offline',
      recordLabel: 'Student Admission · Temp',
      payload: { id: 'std_temp_offline', fullName: 'Temp Student' },
    });
    assert.equal(Boolean(tempStu.id), true);

    // Deleting a student created while offline cancels its own pending upsert
    await offlineSync.enqueueOfflineMutation({
      entityType: 'student',
      action: 'delete',
      operation: 'deleteStudent',
      schoolId: 'sch_1',
      docPath: 'schools/sch_1/students/std_temp_offline',
      recordId: 'std_temp_offline',
      recordLabel: 'Delete Student · Temp',
      payload: { id: 'std_temp_offline' },
    });

    const queue = await offlineSync.getOfflineQueue();
    assert.equal(queue.length, 2);
    assert.equal(queue[0].recordId, '2026-11-27_cls_9a');
    assert.equal(queue[0].baseUpdatedAt, '2026-11-27T08:00:00.000Z');
    assert.equal(queue[0].payload.records.std_1.status, 'late');
    assert.equal(queue[1].recordId, 'pay_1');

    // 3. Conflict Detection Matrix
    const noConflictSameServer = offlineSync.detectOfflineConflict({
      action: 'upsert',
      baseUpdatedAt: baseAtt.updatedAt,
      baseSnapshot: baseAtt,
      localPayload: queue[0].payload,
      remoteExists: true,
      remoteData: { ...baseAtt, updatedAt: '2026-11-27T08:00:05.000Z' },
      remoteUpdatedAt: '2026-11-27T08:00:05.000Z',
    });
    assert.equal(noConflictSameServer.hasConflict, false);

    const serverModifiedOnline = offlineSync.detectOfflineConflict({
      action: 'upsert',
      baseUpdatedAt: baseAtt.updatedAt,
      baseSnapshot: baseAtt,
      localPayload: queue[0].payload,
      remoteExists: true,
      remoteData: {
        ...baseAtt,
        records: { std_1: { status: 'absent' } },
        summary: { total: 1, present: 0, absent: 1, leave: 0, late: 0, percentage: 0 },
        markedByName: 'Principal',
      },
      remoteUpdatedAt: '2026-11-27T09:15:00.000Z',
    });
    assert.equal(serverModifiedOnline.hasConflict, true);

    const concurrentCreateOffline = offlineSync.detectOfflineConflict({
      action: 'upsert',
      localPayload: { ...baseAtt, records: { std_1: { status: 'late' } } },
      remoteExists: true,
      remoteData: baseAtt,
      remoteUpdatedAt: '2026-11-27T09:00:00.000Z',
    });
    assert.equal(concurrentCreateOffline.hasConflict, true);

    const idempotentRetry = offlineSync.detectOfflineConflict({
      action: 'upsert',
      localPayload: baseAtt,
      remoteExists: true,
      remoteData: { ...baseAtt, updatedAt: '2026-11-27T09:05:00.000Z' },
      remoteUpdatedAt: '2026-11-27T09:05:00.000Z',
    });
    assert.equal(idempotentRetry.hasConflict, false);

    const deletedOnlineConflict = offlineSync.detectOfflineConflict({
      action: 'upsert',
      baseUpdatedAt: baseAtt.updatedAt,
      baseSnapshot: baseAtt,
      localPayload: queue[0].payload,
      remoteExists: false,
      remoteData: null,
    });
    assert.equal(deletedOnlineConflict.hasConflict, true);

    const diffRows = offlineSync.buildConflictComparisonFields({
      ...queue[0],
      status: 'conflict',
      remoteSnapshot: { ...baseAtt, markedByName: 'Principal' },
      remoteUpdatedAt: '2026-11-27T09:15:00.000Z',
    });
    assert.equal(diffRows.some((r) => r.label === 'Marked By' && r.changed), true);

    offlineSync.resetInMemoryOfflineStoreForTests();
    console.log('✅ PASS: Offline Data Sync (IndexedDB Queue, Coalescing & Conflict Detection) Tests');
  }

  // Test 28: Android APK & Mobile Responsive UI (Sidebar Scroll, Mobile Bottom Nav & Safe Viewport Guards)
  {
    const fs = await import('fs');
    const path = await import('path');
    const root = process.cwd();
    const indexHtmlSrc = fs.readFileSync(path.resolve(root, 'index.html'), 'utf-8');
    const indexCssSrc = fs.readFileSync(path.resolve(root, 'src/index.css'), 'utf-8');
    const appSrc = fs.readFileSync(path.resolve(root, 'src/App.tsx'), 'utf-8');
    const classesSrc = fs.readFileSync(
      path.resolve(root, 'src/features/sms/components/ClassesManagement.tsx'),
      'utf-8'
    );
    const teacherMgmtSrc = fs.readFileSync(
      path.resolve(root, 'src/features/sms/components/TeacherManagement.tsx'),
      'utf-8'
    );
    const studentDirSrc = fs.readFileSync(
      path.resolve(root, 'src/features/sms/components/StudentDirectory.tsx'),
      'utf-8'
    );

    // 1. Viewport safe-area cover & mobile sidebar scroll rules
    assert.equal(indexHtmlSrc.includes('viewport-fit=cover'), true);
    assert.equal(indexCssSrc.includes('.app-sidebar'), true);
    assert.equal(indexCssSrc.includes('overflow-y: auto;'), true);
    assert.equal(indexCssSrc.includes('max-height: 100dvh;'), true);
    assert.equal(indexCssSrc.includes('.app-bottom-nav'), true);
    assert.equal(indexCssSrc.includes('body.printing-mode .app-bottom-nav'), true);

    // 2. Sidebar drawer & inner scroll container fixes in App.tsx
    assert.equal(appSrc.includes('h-[100dvh] max-h-[100dvh] overflow-y-auto overscroll-contain'), true);
    assert.equal(appSrc.includes('flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden'), true);
    assert.equal(appSrc.includes('pb-24 lg:py-6'), true);

    // 3. Mobile-only Bottom Navigation Bar with 5 core items (Home, Profile, Sync, Notices, More)
    assert.equal(appSrc.includes('aria-label="Mobile Bottom Navigation"'), true);
    assert.equal(appSrc.includes('app-bottom-nav no-print lg:hidden fixed bottom-0'), true);
    assert.equal(appSrc.includes('>Home<'), true);
    assert.equal(appSrc.includes('>Profile<'), true);
    assert.equal(appSrc.includes('>Sync<'), true);
    assert.equal(appSrc.includes('>Notices<'), true);
    assert.equal(appSrc.includes('>More<'), true);

    // 4. Responsive scrollable modals across core SMS components (safe at 375px / 414px)
    assert.equal(classesSrc.includes('max-h-[90dvh] overflow-y-auto'), true);
    assert.equal(teacherMgmtSrc.includes('max-h-[90dvh] overflow-y-auto'), true);
    assert.equal(studentDirSrc.includes('max-h-[90dvh] overflow-y-auto'), true);

    console.log('✅ PASS: Android APK & Mobile Responsive Sidebar Scroll, Bottom Nav & Modal Viewport Tests');
  }

  // Test 29: Salary & Payroll Module (Calculations, History Tracker, RBAC, Firestore Rules & PDF Export)
  {
    const root = process.cwd();
    const {
      buildPayrollMonthKey,
      buildPayslipDocId,
      buildPayslipFromStructure,
      calculateSalaryTotals,
      buildEmployeeYearlyPayrollTracker,
      doesPayslipBelongToUser,
      numberToRupeesWords,
    } = await import('../features/sms/utils/payrollCalculations');

    // 1. Net Salary = (Basic + Allowances) - Deductions + Adjustments
    const baseTotals = calculateSalaryTotals({
      basicSalary: 60000,
      allowances: [
        { id: 'hra', label: 'House Rent', amount: 12000 },
        { id: 'med', label: 'Medical', amount: 5000 },
        { id: 'trp', label: 'Transport', amount: 4000 },
      ],
      deductions: [
        { id: 'tax', label: 'Income Tax', amount: 1500 },
        { id: 'gpf', label: 'Provident Fund', amount: 3500 },
        { id: 'loan', label: 'Loan', amount: 2000 },
      ],
    });
    assert.equal(baseTotals.totalAllowances, 21000);
    assert.equal(baseTotals.grossSalary, 81000);
    assert.equal(baseTotals.totalDeductions, 7000);
    assert.equal(baseTotals.netSalary, 74000);

    // Pre-finalization individual salary bonus/deduction adjustment & floor-at-zero guard
    const bonusTotals = calculateSalaryTotals({
      basicSalary: 60000,
      allowances: [{ id: 'hra', label: 'House Rent', amount: 12000 }],
      deductions: [{ id: 'tax', label: 'Tax', amount: 2000 }],
      adjustmentAmount: 5000,
    });
    assert.equal(bonusTotals.netSalary, 75000);

    const floorTotals = calculateSalaryTotals({
      basicSalary: 10000,
      allowances: [],
      deductions: [{ id: 'loan', label: 'Loan', amount: 15000 }],
      adjustmentAmount: -1000,
    });
    assert.equal(floorTotals.netSalary, 0, 'Net salary should clamp cleanly at 0');

    // 2. Monthly Payslip Builder & 12-Month Tracker
    const sampleStructure: any = {
      id: 'emp_01',
      schoolId: 'sch_1',
      employeeId: 'emp_01',
      employeeUid: 'uid_teacher_1',
      employeeName: 'Ms. Hina',
      employeeEmail: 'hina@seld.gos.pk',
      designation: 'HST Science',
      employeeType: 'teaching',
      basicSalary: 50000,
      allowances: [{ id: 'a1', label: 'House Rent', amount: 8000 }],
      deductions: [{ id: 'd1', label: 'Provident Fund', amount: 3000 }],
      totalAllowances: 8000,
      grossSalary: 58000,
      totalDeductions: 3000,
      netSalary: 55000,
    };
    const novKey = buildPayrollMonthKey(2026, 11);
    assert.equal(novKey, '2026-11');
    assert.equal(buildPayslipDocId(novKey, 'emp_01'), '2026-11__emp_01');

    const draftSlip = buildPayslipFromStructure(sampleStructure, {
      schoolId: 'sch_1',
      month: novKey,
    });
    assert.equal(draftSlip.netSalary, 55000);
    assert.equal(draftSlip.status, 'draft');
    assert.equal(draftSlip.isFinalized, false);

    const octPaidSlip = {
      ...draftSlip,
      id: '2026-10__emp_01',
      month: '2026-10',
      monthNumber: 10,
      status: 'paid' as const,
      isFinalized: true,
    };
    const decFinalizedSlip = {
      ...draftSlip,
      id: '2026-12__emp_01',
      month: '2026-12',
      monthNumber: 12,
      status: 'finalized' as const,
      isFinalized: true,
    };
    const tracker = buildEmployeeYearlyPayrollTracker('emp_01', 2026, [octPaidSlip, decFinalizedSlip]);
    assert.equal(tracker.length, 12);
    assert.equal(tracker[9].trackerState, 'paid'); // Oct
    assert.equal(tracker[10].trackerState, 'unpaid'); // Nov
    assert.equal(tracker[11].trackerState, 'pending'); // Dec

    // 3. Teacher payslip ownership check & words formatter
    assert.equal(
      doesPayslipBelongToUser(draftSlip, { uid: 'uid_teacher_1', email: 'other@seld.gos.pk' }),
      true
    );
    assert.equal(
      doesPayslipBelongToUser(draftSlip, { uid: 'someone_else', email: 'HINA@seld.gos.pk' }),
      true
    );
    assert.equal(
      doesPayslipBelongToUser(draftSlip, { uid: 'someone_else', email: 'other@seld.gos.pk' }),
      false
    );
    assert.equal(numberToRupeesWords(55000), 'Rupees Fifty-Five Thousand Only');

    // 4. Firestore rules, Service layer, UI & RBAC checks
    const rulesSrc = fs.readFileSync(path.resolve(root, 'firestore.rules'), 'utf-8');
    const serviceSrc = fs.readFileSync(
      path.resolve(root, 'src/features/sms/services/smsFirestoreService.ts'),
      'utf-8'
    );
    const smsCtxSrc = fs.readFileSync(
      path.resolve(root, 'src/features/sms/context/SmsContext.tsx'),
      'utf-8'
    );
    const appSrc = fs.readFileSync(path.resolve(root, 'src/App.tsx'), 'utf-8');
    const payrollSrc = fs.readFileSync(
      path.resolve(root, 'src/features/sms/components/SalaryPayroll.tsx'),
      'utf-8'
    );
    const payslipModalSrc = fs.readFileSync(
      path.resolve(root, 'src/features/sms/components/PayslipPreviewModal.tsx'),
      'utf-8'
    );
    const teacherProfileSrc = fs.readFileSync(
      path.resolve(root, 'src/features/sms/components/TeacherProfile.tsx'),
      'utf-8'
    );

    assert.equal(rulesSrc.includes('match /salaryStructures/{employeeId}'), true);
    assert.equal(rulesSrc.includes('match /payrollSettings/{settingId}'), true);
    assert.equal(rulesSrc.includes('match /payslips/{payslipId}'), true);
    assert.equal(rulesSrc.includes('function isTeacherPayslipPortalEnabled(schoolId)'), true);
    assert.equal(serviceSrc.includes('saveSalaryStructureToFirestore'), true);
    assert.equal(serviceSrc.includes('savePayslipToFirestore'), true);
    assert.equal(serviceSrc.includes('fetchTeacherOwnPayslipsFromFirestore'), true);
    assert.equal(smsCtxSrc.includes('canAccessSalaryPayroll'), true);
    assert.equal(smsCtxSrc.includes('canViewOwnPayslips'), true);
    assert.equal(smsCtxSrc.includes('ownTeacherPayslips'), true);
    assert.equal(appSrc.includes('path="/sms/salary"'), true);
    assert.equal(appSrc.includes('requirePayrollAccess'), true);
    assert.equal(payrollSrc.includes('Salary Structure'), true);
    assert.equal(payrollSrc.includes('Generate'), true);
    assert.equal(payrollSrc.includes('Salary History'), true);
    assert.equal(payslipModalSrc.includes('exportA4ElementAsPdf'), true);
    assert.equal(payslipModalSrc.includes('triggerPrintDocument'), true);
    assert.equal(teacherProfileSrc.includes('ownTeacherPayslips'), true);
    assert.equal(teacherProfileSrc.includes('PayslipPreviewModal'), true);

    console.log('✅ PASS: Salary & Payroll Calculations, Monthly Tracker, RBAC, Firestore Rules & PDF Tests');
  }

  // Test 30: Deep SMS AI Integration (Lesson Plans, Question Papers, Smart Context Linking & Strict RBAC)
  {
    console.log('\n--- Test 30: AI Lesson Planner & Question Paper SMS Integration ---');

    // 1. Smart Grade Normalization & Syllabus Auto-Population
    assert.equal(normalizeSmsGradeToSyllabusClassName('Grade 9'), 'Class 9');
    assert.equal(normalizeSmsGradeToSyllabusClassName('IX'), 'Class 9');
    assert.equal(normalizeSmsGradeToSyllabusClassName('ECE / Prep'), 'KG');
    assert.equal(normalizeSmsGradeToSyllabusClassName('Class 10'), 'Class 10');

    const baseOfflinePlan = buildSmsOfflineFallbackLessonPlan({
      board: 'Sindh STBB',
      section: 'Secondary',
      className: 'Class 9',
      subject: 'Physics',
      chapter: 'Chapter 2: Kinematics',
      topic: 'Uniform Acceleration',
      duration: '40 Minutes',
      planType: 'Daily',
    });

    const mockPresets = [
      {
        id: 'p1',
        board: 'Sindh STBB' as const,
        section: 'Secondary' as const,
        className: 'Class 9',
        subject: 'Physics',
        chapter: 'Chapter 2: Kinematics',
        topic: 'Uniform Acceleration',
        duration: '40 Minutes',
        planType: 'Daily' as const,
        ...baseOfflinePlan,
      },
      {
        id: 'p2',
        board: 'Sindh STBB' as const,
        section: 'Middle' as const,
        className: 'Class 6',
        subject: 'Science',
        chapter: 'Chapter 1: Cells',
        topic: 'Animal Cell',
        duration: '40 Minutes',
        planType: 'Daily' as const,
        ...baseOfflinePlan,
      },
    ];

    const class9Filtered = filterSyllabusPresetsForClass(mockPresets, 'Grade 9', 'Sindh STBB');
    assert.equal(class9Filtered.length, 1);
    assert.equal(class9Filtered[0].subject, 'Physics');

    const extracted = extractSyllabusStructureForClass(mockPresets, 'IX', 'Sindh STBB', 'Physics');
    assert.deepEqual(extracted.subjects, ['Physics']);
    assert.deepEqual(extracted.chapters, ['Chapter 2: Kinematics']);
    assert.equal(extracted.topics.length, 1);

    // 2. Smart Context Injection from Lesson Plans -> Question Paper Generation
    const lpAssignedShared: SchoolLessonPlan = {
      id: 'lp_9a_1',
      schoolId: 'sch_1',
      classId: 'cls_9a',
      grade: 'Class 9',
      section: 'A',
      teacherId: 't_1',
      teacherName: 'Sir Ahmed',
      board: 'Sindh STBB',
      curriculumSection: 'Secondary',
      subject: 'Physics',
      chapter: 'Chapter 2: Kinematics',
      topic: 'Equations of Motion',
      duration: '40 Minutes',
      planType: 'Daily',
      ...baseOfflinePlan,
      sharedWithParents: true,
    };
    const lpAssignedPrivate: SchoolLessonPlan = {
      ...lpAssignedShared,
      id: 'lp_9a_2',
      topic: 'Scalars vs Vectors',
      sharedWithParents: false,
    };
    const lpOtherClassShared: SchoolLessonPlan = {
      ...lpAssignedShared,
      id: 'lp_10a_1',
      classId: 'cls_10a',
      grade: 'Class 10',
      topic: 'Simple Harmonic Motion',
      sharedWithParents: true,
    };

    const injectedContext = buildSmartSyllabusContextFromLessonPlans({
      plans: [lpAssignedShared, lpAssignedPrivate],
      manualNotes: 'Focus on graphical proofs',
    });
    assert.equal(injectedContext.includes('Equations of Motion'), true);
    assert.equal(injectedContext.includes('Scalars vs Vectors'), true);
    assert.equal(injectedContext.includes('Focus on graphical proofs'), true);
    assert.equal(injectedContext.length <= 2400, true);

    const offlinePaper = buildSmsOfflineFallbackQuestionPaper({
      className: 'Class 9 (A)',
      subject: 'Physics',
      difficulty: 'Medium',
      totalMarks: 50,
      timeAllowed: '2 Hours',
      language: 'English',
      syllabusCovered: injectedContext,
    });
    assert.equal(offlinePaper.totalMarks, 50);
    assert.equal(
      offlinePaper.sectionAMarks + offlinePaper.sectionBMarks + offlinePaper.sectionCMarks,
      50
    );

    const allPlans = [lpAssignedShared, lpAssignedPrivate, lpOtherClassShared];
    const qpAssigned: SchoolQuestionPaper = {
      id: 'qp_9a_1',
      schoolId: 'sch_1',
      examId: 'exam_1',
      examTitle: 'Mid Term 2026',
      attachedToExam: true,
      classId: 'cls_9a',
      className: 'Class 9 - A',
      grade: 'Class 9',
      subject: 'Physics',
      difficulty: 'Medium',
      totalMarks: 50,
      timeAllowed: '2 Hours',
      language: 'English',
      syllabusCovered: injectedContext,
      linkedLessonPlanIds: ['lp_9a_1'],
      paper: offlinePaper,
      createdByUid: 't_1',
      createdByName: 'Sir Ahmed',
    };
    const qpOtherClass: SchoolQuestionPaper = {
      ...qpAssigned,
      id: 'qp_10a_1',
      classId: 'cls_10a',
      className: 'Class 10 - A',
      grade: 'Class 10',
      attachedToExam: false,
    };
    const allPapers = [qpAssigned, qpOtherClass];

    // 3. Strict RBAC Matrix Verification
    // Teachers: assigned classes only
    assert.deepEqual(
      filterLessonPlansForRole(allPlans, { role: 'teacher', assignedClassIds: ['cls_9a'] }).map((p) => p.id),
      ['lp_9a_1', 'lp_9a_2']
    );
    assert.deepEqual(
      filterQuestionPapersForRole(allPapers, { role: 'teacher', assignedClassIds: ['cls_9a'] }).map((p) => p.id),
      ['qp_9a_1']
    );
    // Admins: all school plans & papers
    assert.equal(filterLessonPlansForRole(allPlans, { role: 'admin' }).length, 3);
    assert.equal(filterQuestionPapersForRole(allPapers, { role: 'admin' }).length, 2);
    // Parents: ONLY shared plans for child's class; ZERO question papers
    assert.deepEqual(
      filterLessonPlansForRole(allPlans, { role: 'parent', childClassId: 'cls_9a' }).map((p) => p.id),
      ['lp_9a_1']
    );
    assert.equal(filterQuestionPapersForRole(allPapers, { role: 'parent' }).length, 0);
    // Super Admin & Read-Only Impersonation: ZERO access to school-level AI content
    assert.equal(filterLessonPlansForRole(allPlans, { role: 'super-admin', isSuperAdmin: true }).length, 0);
    assert.equal(filterQuestionPapersForRole(allPapers, { role: 'super-admin', isSuperAdmin: true }).length, 0);
    assert.equal(
      filterLessonPlansForRole(allPlans, { role: 'admin', isReadOnlyImpersonation: true }).length,
      0
    );
    assert.equal(
      filterQuestionPapersForRole(allPapers, { role: 'admin', isReadOnlyImpersonation: true }).length,
      0
    );
    // Exam Attachment lookup
    assert.deepEqual(
      getAttachedQuestionPapersForExam(allPapers, 'exam_1').map((p) => p.id),
      ['qp_9a_1']
    );

    // 4. Wiring, Firestore Rules, Sanitization & Print/PDF Checks
    const root = process.cwd();
    const rulesSrc = fs.readFileSync(path.resolve(root, 'firestore.rules'), 'utf-8');
    const serviceSrc = fs.readFileSync(
      path.resolve(root, 'src/features/sms/services/smsFirestoreService.ts'),
      'utf-8'
    );
    const smsCtxSrc = fs.readFileSync(
      path.resolve(root, 'src/features/sms/context/SmsContext.tsx'),
      'utf-8'
    );
    const dashboardSrc = fs.readFileSync(
      path.resolve(root, 'src/features/sms/components/SmsDashboard.tsx'),
      'utf-8'
    );
    const parentDashSrc = fs.readFileSync(
      path.resolve(root, 'src/features/sms/components/ParentDashboard.tsx'),
      'utf-8'
    );
    const examsSrc = fs.readFileSync(
      path.resolve(root, 'src/features/sms/components/ExamsResults.tsx'),
      'utf-8'
    );
    const lpCompSrc = fs.readFileSync(
      path.resolve(root, 'src/features/sms/components/SmsLessonPlansSection.tsx'),
      'utf-8'
    );
    const qpCompSrc = fs.readFileSync(
      path.resolve(root, 'src/features/sms/components/ExamQuestionPapersSection.tsx'),
      'utf-8'
    );

    assert.equal(rulesSrc.includes('match /lessonPlans/{planId}'), true);
    assert.equal(rulesSrc.includes('match /questionPapers/{paperId}'), true);
    assert.equal(rulesSrc.includes('isSchoolParentInClass(schoolId, existing().get(\'classId\', \'\'))'), true);
    assert.equal(serviceSrc.includes('saveSchoolLessonPlanToFirestore'), true);
    assert.equal(serviceSrc.includes('saveSchoolQuestionPaperToFirestore'), true);
    assert.equal(serviceSrc.includes('fetchSharedLessonPlansForParentFromFirestore'), true);
    assert.equal(serviceSrc.includes('fetchPublicSyllabusForClassFromFirestore'), true);
    assert.equal(smsCtxSrc.includes('saveSchoolLessonPlan'), true);
    assert.equal(smsCtxSrc.includes('saveSchoolQuestionPaper'), true);
    assert.equal(smsCtxSrc.includes('attachQuestionPaperToExam'), true);
    assert.equal(dashboardSrc.includes('SmsLessonPlansSection'), true);
    assert.equal(parentDashSrc.includes('Class Syllabus &amp; Shared Lesson Overview'), true);
    assert.equal(examsSrc.includes('Generate Question Paper with AI'), true);
    assert.equal(examsSrc.includes('ExamQuestionPapersSection'), true);
    assert.equal(lpCompSrc.includes('My Lesson Plans (AI Integrated)'), true);
    assert.equal(qpCompSrc.includes('Print Question Paper'), true);
    assert.equal(qpCompSrc.includes('exportA4ElementAsPdf'), true);

    console.log('✅ PASS: AI Lesson Planner & Question Paper SMS Integration, Smart Linking & RBAC Tests');
  }

  // Test 31: Strict Approved-Employee Salary Validation, Audit History Log & Teacher Salary Notifications
  {
    console.log('\n--- Test 31: Salary Strict Employee Selection, Validation, Audit Log & Teacher Notifications ---');

    const teachersList = [
      {
        id: 'uid_teacher_a',
        name: 'Sir Tariq Mehmood',
        designation: 'PST',
        email: 'tariq@seld.gos.pk',
        phone: '03001112233',
        status: 'active' as const,
        assignedClasses: ['cls_9a'],
      },
      {
        id: 'uid_resigned_teacher',
        name: 'Resigned Former Teacher',
        designation: 'JEST',
        email: 'resigned@seld.gos.pk',
        status: 'resigned' as const,
        assignedClasses: [],
      },
    ];
    const staffUsersList: UserProfile[] = [
      {
        uid: 'uid_admin_a',
        email: 'admin@seld.gos.pk',
        fullName: 'Asif Ali',
        role: 'admin',
        schoolId: 'school_gbps_1',
        status: 'active',
        designation: 'Headmaster',
        assignedClassIds: [],
      },
      {
        uid: 'uid_pending_teacher',
        email: 'pending@seld.gos.pk',
        fullName: 'Unapproved Applicant',
        role: 'teacher',
        schoolId: 'school_gbps_1',
        status: 'pending',
        designation: 'JEST',
        assignedClassIds: [],
      },
      {
        uid: 'uid_other_school_teacher',
        email: 'external@seld.gos.pk',
        fullName: 'External Teacher',
        role: 'teacher',
        schoolId: 'school_other_2',
        status: 'active',
        designation: 'HST',
        assignedClassIds: [],
      },
    ];

    // 1. Only verified active members of school_gbps_1 appear in dropdown roster
    const approved = buildApprovedSchoolEmployees({
      schoolId: 'school_gbps_1',
      teachers: teachersList,
      staffUsers: staffUsersList,
    });
    assert.equal(approved.length, 2);
    assert.equal(approved.some((e) => e.employeeName === 'Sir Tariq Mehmood'), true);
    assert.equal(approved.some((e) => e.employeeName === 'Asif Ali'), true);
    assert.equal(approved.some((e) => e.employeeName === 'Resigned Former Teacher'), false);
    assert.equal(approved.some((e) => e.employeeName === 'Unapproved Applicant'), false);
    assert.equal(approved.some((e) => e.employeeName === 'External Teacher'), false);

    // 2. Random / unapproved employee rejected with exact error message
    const badCheck = validateApprovedSalaryEmployee({
      employeeId: 'random_person_999',
      employeeEmail: 'nobody@example.com',
      approvedEmployees: approved,
    });
    assert.equal(badCheck.valid, false);
    assert.equal(badCheck.error, EMPLOYEE_NOT_FOUND_IN_SCHOOL_ERROR);

    const goodCheck = validateApprovedSalaryEmployee({
      employeeId: 'uid_teacher_a',
      approvedEmployees: approved,
    });
    assert.equal(goodCheck.valid, true);
    assert.equal(goodCheck.matchedEmployee?.employeeName, 'Sir Tariq Mehmood');

    // 3. Audit Feed tracks created & updated events with Admin actor and timestamp
    const feed = buildSalaryStructureAuditFeed([
      {
        id: 'uid_teacher_a',
        schoolId: 'school_gbps_1',
        employeeId: 'uid_teacher_a',
        employeeUid: 'uid_teacher_a',
        employeeName: 'Sir Tariq Mehmood',
        employeeEmail: 'tariq@seld.gos.pk',
        designation: 'PST',
        employeeType: 'teaching',
        basicSalary: 35000,
        allowances: [],
        deductions: [],
        totalAllowances: 0,
        grossSalary: 35000,
        totalDeductions: 0,
        netSalary: 35000,
        createdByName: 'Asif Ali',
        updatedByName: 'Asif Ali',
        createdAt: '2026-11-26T09:00:00.000Z',
        updatedAt: '2026-11-27T10:00:00.000Z',
        auditTrail: [
          {
            id: 'a2',
            action: 'updated',
            actorUid: 'uid_admin_a',
            actorName: 'Asif Ali',
            timestamp: '2026-11-27T10:00:00.000Z',
            basicSalary: 35000,
            netSalary: 35000,
          },
          {
            id: 'a1',
            action: 'created',
            actorUid: 'uid_admin_a',
            actorName: 'Asif Ali',
            timestamp: '2026-11-26T09:00:00.000Z',
            basicSalary: 30000,
            netSalary: 30000,
          },
        ],
      },
    ]);
    assert.equal(feed.length, 2);
    assert.equal(feed[0].action, 'updated');
    assert.equal(feed[0].actorName, 'Asif Ali');
    assert.equal(feed[1].action, 'created');

    // 4. Static Verification across Rules, Services, Context, Payroll UI & TeacherProfile
    const root = process.cwd();
    const rulesSrc = fs.readFileSync(path.resolve(root, 'firestore.rules'), 'utf-8');
    const serviceSrc = fs.readFileSync(
      path.resolve(root, 'src/features/sms/services/smsFirestoreService.ts'),
      'utf-8'
    );
    const payrollSrc = fs.readFileSync(
      path.resolve(root, 'src/features/sms/components/SalaryPayroll.tsx'),
      'utf-8'
    );
    const teacherProfileSrc = fs.readFileSync(
      path.resolve(root, 'src/features/sms/components/TeacherProfile.tsx'),
      'utf-8'
    );
    const dashSrc = fs.readFileSync(
      path.resolve(root, 'src/features/sms/components/SmsDashboard.tsx'),
      'utf-8'
    );

    assert.equal(rulesSrc.includes('isSchoolMember(schoolId)'), true);
    assert.equal(rulesSrc.includes("'auditTrail'"), true);
    assert.equal(serviceSrc.includes('fetchApprovedSchoolStaffUsersFromFirestore'), true);
    assert.equal(serviceSrc.includes('fetchTeacherOwnSalaryStructureFromFirestore'), true);
    assert.equal(serviceSrc.includes('subscribeTeacherOwnPayrollFromFirestore'), true);
    assert.equal(payrollSrc.includes('Select Verified School Teacher / Active Staff'), true);
    assert.equal(payrollSrc.includes('Salary Structure Audit Log'), true);
    assert.equal(teacherProfileSrc.includes('hasUnreadSalaryStructureUpdate'), true);
    assert.equal(teacherProfileSrc.includes('Your salary structure has been updated by Admin'), true);
    assert.equal(dashSrc.includes('hasUnreadSalaryStructureUpdate'), true);

    console.log('✅ PASS: Strict Approved-Employee Salary Validation, Audit History & Teacher Auto-Sync Notification Tests');
  }

  // Test 32: React Router v7 Migration, ProtectedRoute RBAC Guards, Dynamic URL Params & Smart Routing Paths
  {
    console.log('\n--- Test 32: React Router Migration & ProtectedRoute RBAC Tests ---');
    const fs = await import('fs');
    const path = await import('path');
    const { getRoutePathForTool, navigateBySmartRoute } = await import('./smartRouting');
    const { evaluateRouteAccess } = await import('../components/ProtectedRoute');

    // 1. Canonical route path resolution & navigateBySmartRoute helper
    assert.equal(getRoutePathForTool('dashboard'), '/dashboard');
    assert.equal(getRoutePathForTool('sms-dashboard'), '/sms');
    assert.equal(getRoutePathForTool('sms-classes'), '/sms/classes');
    assert.equal(getRoutePathForTool('sms-students'), '/sms/students');
    assert.equal(getRoutePathForTool('sms-attendance'), '/sms/attendance');
    assert.equal(getRoutePathForTool('sms-fees'), '/sms/fees');
    assert.equal(getRoutePathForTool('sms-exams'), '/sms/exams');
    assert.equal(getRoutePathForTool('sms-timetable'), '/sms/timetable');
    assert.equal(getRoutePathForTool('sms-homework'), '/sms/homework');
    assert.equal(getRoutePathForTool('sms-payroll'), '/sms/salary');
    assert.equal(getRoutePathForTool('sms-profile'), '/sms/profile');
    assert.equal(getRoutePathForTool('super-admin'), '/super-admin');
    assert.equal(getRoutePathForTool('lesson-plan'), '/teacher/lesson-planner');
    assert.equal(getRoutePathForTool('question-paper'), '/teacher/question-paper');
    assert.equal(getRoutePathForTool('sms-parent'), '/parent/dashboard');
    assert.equal(getRoutePathForTool('sms-student-portal'), '/student/dashboard');

    const adminSmart = determineSmartRoute(
      { email: 'principal@school.pk', uid: 'p_1' },
      { uid: 'p_1', email: 'principal@school.pk', fullName: 'Principal', role: 'admin', status: 'active', schoolId: 'sch_1', assignedClassIds: [] },
      []
    );
    assert.equal(adminSmart.targetPath, '/sms');

    let capturedPath = '';
    let capturedOpts: { replace?: boolean } | undefined;
    navigateBySmartRoute(
      (to, opts) => {
        capturedPath = to;
        capturedOpts = opts;
      },
      adminSmart
    );
    assert.equal(capturedPath, '/sms');
    assert.equal(capturedOpts?.replace, true);

    // 2. ProtectedRoute RBAC & Role Isolation evaluation
    // Unauthenticated blocked to '/'
    const unauthDecision = evaluateRouteAccess(
      { isAuthenticated: false, effectiveRole: 'general' },
      { allowedRoles: ['admin'] }
    );
    assert.equal(unauthDecision.allowed, false);
    assert.equal(unauthDecision.redirectTo, '/');

    // Teacher blocked from Salary & Payroll -> redirects to /dashboard with error message
    const teacherSalaryDecision = evaluateRouteAccess(
      {
        isAuthenticated: true,
        effectiveRole: 'teacher',
        isAffiliated: true,
        canAccessSalaryPayroll: false,
      },
      {
        allowedRoles: ['admin', 'principal', 'super-admin'],
        requirePayrollAccess: true,
        requireAffiliated: true,
      }
    );
    assert.equal(teacherSalaryDecision.allowed, false);
    assert.equal(teacherSalaryDecision.redirectTo, '/dashboard');
    assert.equal(Boolean(teacherSalaryDecision.reason && teacherSalaryDecision.reason.includes('Access Denied')), true);

    // School Admin allowed on Salary & Payroll
    const adminSalaryDecision = evaluateRouteAccess(
      {
        isAuthenticated: true,
        effectiveRole: 'admin',
        isAffiliated: true,
        canAccessSalaryPayroll: true,
      },
      {
        allowedRoles: ['admin', 'principal', 'super-admin'],
        requirePayrollAccess: true,
        requireAffiliated: true,
      }
    );
    assert.equal(adminSalaryDecision.allowed, true);

    // Non-super-admin blocked from /super-admin
    const adminSuperDecision = evaluateRouteAccess(
      { isAuthenticated: true, effectiveRole: 'admin', isAffiliated: true },
      { allowedRoles: ['super-admin'] }
    );
    assert.equal(adminSuperDecision.allowed, false);
    assert.equal(adminSuperDecision.redirectTo, '/dashboard');

    // Super Admin allowed on /sms ONLY while impersonating
    const superNoImpersonateSms = evaluateRouteAccess(
      { isAuthenticated: true, effectiveRole: 'super-admin', isImpersonating: false },
      { allowedRoles: ['admin', 'principal', 'teacher'], requireAffiliated: true, allowDuringImpersonation: true }
    );
    assert.equal(superNoImpersonateSms.allowed, false);

    const superWithImpersonateSms = evaluateRouteAccess(
      { isAuthenticated: true, effectiveRole: 'super-admin', isImpersonating: true },
      { allowedRoles: ['admin', 'principal', 'teacher'], requireAffiliated: true, allowDuringImpersonation: true }
    );
    assert.equal(superWithImpersonateSms.allowed, true);

    // Parent strictly blocked from Student/SMS routes
    const parentToStudentDecision = evaluateRouteAccess(
      { isAuthenticated: true, effectiveRole: 'parent' },
      { allowedRoles: ['student'] }
    );
    assert.equal(parentToStudentDecision.allowed, false);
    assert.equal(parentToStudentDecision.redirectTo, '/dashboard');

    // 3. Source-level Verification: React Router hooks, routes, links, dynamic params, no legacy activeTool/selectTool state
    const root = process.cwd();
    const pkgJson = JSON.parse(fs.readFileSync(path.resolve(root, 'package.json'), 'utf-8'));
    assert.equal(Boolean(pkgJson.dependencies?.['react-router-dom']), true);

    const appSrc = fs.readFileSync(path.resolve(root, 'src/App.tsx'), 'utf-8');
    const studentDirSrc = fs.readFileSync(
      path.resolve(root, 'src/features/sms/components/StudentDirectory.tsx'),
      'utf-8'
    );
    const examsSrc = fs.readFileSync(
      path.resolve(root, 'src/features/sms/components/ExamsResults.tsx'),
      'utf-8'
    );

    assert.equal(appSrc.includes('<BrowserRouter>'), true);
    assert.equal(appSrc.includes('<Routes>'), true);
    assert.equal(appSrc.includes('useNavigate'), true);
    assert.equal(appSrc.includes('useLocation'), true);
    assert.equal(appSrc.includes('useParams'), true);
    assert.equal(appSrc.includes('<Link'), true);
    assert.equal(appSrc.includes('activeTool'), false, 'activeTool state must be completely removed from App.tsx');
    assert.equal(appSrc.includes('selectTool'), false, 'selectTool helper must be completely removed from App.tsx');

    for (const expectedRoute of [
      'path="/"',
      'path="/dashboard"',
      'path="/sms"',
      'path="/sms/classes"',
      'path="/sms/students"',
      'path="/sms/students/:studentId"',
      'path="/sms/attendance"',
      'path="/sms/fees"',
      'path="/sms/exams"',
      'path="/sms/exams/:examId/report/:studentId"',
      'path="/sms/timetable"',
      'path="/sms/homework"',
      'path="/sms/salary"',
      'path="/sms/profile"',
      'path="/super-admin"',
      'path="/teacher/lesson-planner"',
      'path="/teacher/question-paper"',
      'path="/parent/dashboard"',
      'path="/student/dashboard"',
      'path="*"',
    ]) {
      assert.equal(appSrc.includes(expectedRoute), true, `Missing route definition: ${expectedRoute}`);
    }

    assert.equal(studentDirSrc.includes('initialStudentId'), true);
    assert.equal(studentDirSrc.includes('onOpenStudentProfile'), true);
    assert.equal(examsSrc.includes('initialExamId'), true);
    assert.equal(examsSrc.includes('initialReportStudentId'), true);
    assert.equal(examsSrc.includes('onOpenReportCardRoute'), true);

    console.log('✅ PASS: React Router v7, ProtectedRoute RBAC, Dynamic URL Params & Smart Routing Tests');
  }

  console.log('\n🎉 ALL UNIT & SECURITY TESTS PASSED SUCCESSFULLY!');
}

runAllUnitTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
