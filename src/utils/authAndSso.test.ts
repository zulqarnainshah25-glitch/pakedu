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
} from './authAndSso';
import { calculateSindhSalary2026 } from '../data/salaryScale2026';
import { determineSmartRoute, hasAdminCapabilities } from './smartRouting';
import { School, UserProfile } from '../features/sms/types';
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
  isPlaceholderApiKey,
  parseServerEnv,
} from './envConfig';
import { PORTAL_VERSION } from './appVersion';

function runAllUnitTests() {
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
    assert.equal(parsedIncoming?.email, 'zulqarnainshah25@gmail.com');
    assert.equal(parsedIncoming?.displayName, 'Zulqarnain Shah');
    assert.equal(parsedIncoming?.uid, 'uid_786');
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
    assert.equal(dotEnv.includes('VITE_GEMINI_API_KEY='), true);
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

    // Case A: Super Admin Account
    const superAdminByEmail = determineSmartRoute(
      { email: 'owner@pakedu.com', uid: 'super_uid_1' },
      null,
      schoolDirectory
    );
    assert.equal(superAdminByEmail.targetTool, 'super-admin');
    assert.equal(superAdminByEmail.role, 'super-admin');

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

    console.log('✅ PASS: Automatic Smart Login Routing System Tests (All 4 Account Types + Pending + Admin Capabilities)');
  }

  console.log('\n🎉 ALL UNIT & SECURITY TESTS PASSED SUCCESSFULLY!');
}

runAllUnitTests();
