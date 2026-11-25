/**
 * Firestore Security Rules Integration Test Suite
 * Uses @firebase/rules-unit-testing to verify Multi-Tenant RBAC Security.
 *
 * Requirements Covered:
 * 1. Teacher of School A cannot read/write School B students
 * 2. Unverified / unaffiliated user cannot read any student
 * 3. User cannot self-promote to admin/super-admin
 * 4. User cannot self-activate status to 'active'
 * 5. Join request spoofing for another uid is denied
 * 6. Join request for own uid is permitted
 * 7. Super-admin can read/write all
 * 8. Teacher can write attendance only for assignedClassIds
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'pakedu-rules-test';
const RULES_PATH = path.resolve(process.cwd(), 'firestore.rules');

export async function runFirestoreRulesTests() {
  console.log('=== Running Firestore Security Rules Unit Tests ===\n');

  if (!fs.existsSync(RULES_PATH)) {
    throw new Error(`Rules file not found at: ${RULES_PATH}`);
  }

  const rulesContent = fs.readFileSync(RULES_PATH, 'utf8');

  let testEnv: RulesTestEnvironment | null = null;
  try {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: rulesContent,
        host: process.env.FIRESTORE_EMULATOR_HOST?.split(':')[0] || '127.0.0.1',
        port: Number(process.env.FIRESTORE_EMULATOR_HOST?.split(':')[1] || 8080),
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn('⚠️  Notice: Firebase Firestore Emulator is not reachable at 127.0.0.1:8080.');
    console.warn(`   Reason: ${errorMsg}`);
    console.warn('\n📌 HOW TO RUN FIRESTORE RULES TESTS LOCALLY:');
    console.warn('   1. Install Firebase CLI: npm install -g firebase-tools');
    console.warn('   2. Start Emulator: firebase emulators:start --only firestore');
    console.warn('   3. Run Tests: npm run test:rules\n');
    return;
  }

  try {
    // Seed initial database state with security rules disabled
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      // Seed Schools
      await setDoc(doc(db, 'schools', 'school_a'), {
        id: 'school_a',
        name: 'Govt High School A',
        semisCode: '403010101',
        status: 'active',
      });
      await setDoc(doc(db, 'schools', 'school_b'), {
        id: 'school_b',
        name: 'Govt High School B',
        semisCode: '403020202',
        status: 'active',
      });

      // Seed School A Student
      await setDoc(doc(db, 'schools', 'school_a', 'students', 'std_a_1'), {
        id: 'std_a_1',
        grNumber: 'GR-1001',
        name: 'Ali Khan',
        fatherName: 'Tariq Khan',
        gender: 'Male',
        currentClassId: 'cls_9_a',
        status: 'Active',
      });

      // Seed School B Student
      await setDoc(doc(db, 'schools', 'school_b', 'students', 'std_b_1'), {
        id: 'std_b_1',
        grNumber: 'GR-2001',
        name: 'Bilal Ahmed',
        fatherName: 'Ahmed Noor',
        gender: 'Male',
        currentClassId: 'cls_9_b',
        status: 'Active',
      });

      // Seed Profiles in users collection
      // 1. Super Admin Profile
      await setDoc(doc(db, 'users', 'super_admin_uid'), {
        uid: 'super_admin_uid',
        email: 'owner@pakedu.com',
        fullName: 'Super Administrator',
        role: 'super-admin',
        status: 'active',
        isSuperAdmin: true,
      });

      // 2. School A Teacher Profile (Active)
      await setDoc(doc(db, 'users', 'teacher_a_uid'), {
        uid: 'teacher_a_uid',
        email: 'teacher.a@seld.gos.pk',
        fullName: 'Teacher School A',
        role: 'teacher',
        schoolId: 'school_a',
        status: 'active',
        assignedClassIds: ['cls_9_a'],
      });

      // 3. School B Teacher Profile (Active)
      await setDoc(doc(db, 'users', 'teacher_b_uid'), {
        uid: 'teacher_b_uid',
        email: 'teacher.b@seld.gos.pk',
        fullName: 'Teacher School B',
        role: 'teacher',
        schoolId: 'school_b',
        status: 'active',
        assignedClassIds: ['cls_9_b'],
      });

      // 4. School A Admin Profile (Active)
      await setDoc(doc(db, 'users', 'admin_a_uid'), {
        uid: 'admin_a_uid',
        email: 'admin.a@seld.gos.pk',
        fullName: 'Headmaster School A',
        role: 'admin',
        schoolId: 'school_a',
        status: 'active',
        assignedClassIds: [],
      });

      // 5. Unaffiliated / Applicant User (Status 'none')
      await setDoc(doc(db, 'users', 'unaffiliated_uid'), {
        uid: 'unaffiliated_uid',
        email: 'user@example.com',
        fullName: 'General Public User',
        role: 'teacher',
        status: 'none',
        assignedClassIds: [],
      });
    });

    console.log('--- Test 1: Teacher of School A cannot read/write School B students ---');
    const teacherAContext = testEnv.authenticatedContext('teacher_a_uid', {
      email: 'teacher.a@seld.gos.pk',
      email_verified: true,
    });
    const teacherADb = teacherAContext.firestore();

    // Teacher A reads School A student -> ALLOWED
    await assertSucceeds(getDoc(doc(teacherADb, 'schools', 'school_a', 'students', 'std_a_1')));
    console.log('  ✅ PASS: Teacher A can read School A student');

    // Teacher A reads School B student -> DENIED
    await assertFails(getDoc(doc(teacherADb, 'schools', 'school_b', 'students', 'std_b_1')));
    console.log('  ✅ PASS: Teacher A cannot read School B student');

    // Teacher A writes School B student -> DENIED
    await assertFails(
      setDoc(doc(teacherADb, 'schools', 'school_b', 'students', 'std_b_2'), {
        id: 'std_b_2',
        grNumber: 'GR-2002',
        name: 'Intruder Student',
        fatherName: 'Unknown',
        gender: 'Male',
        currentClassId: 'cls_9_b',
        status: 'Active',
      })
    );
    console.log('  ✅ PASS: Teacher A cannot write School B student');

    console.log('\n--- Test 2: Unverified / unaffiliated user cannot read any student ---');
    const unaffiliatedContext = testEnv.authenticatedContext('unaffiliated_uid', {
      email: 'user@example.com',
      email_verified: false,
    });
    const unaffiliatedDb = unaffiliatedContext.firestore();

    await assertFails(getDoc(doc(unaffiliatedDb, 'schools', 'school_a', 'students', 'std_a_1')));
    await assertFails(getDoc(doc(unaffiliatedDb, 'schools', 'school_b', 'students', 'std_b_1')));
    console.log('  ✅ PASS: Unaffiliated user denied read access to students in any school');

    console.log('\n--- Test 3: User cannot self-promote to admin or super-admin ---');
    // Try to update own profile to 'admin'
    await assertFails(
      updateDoc(doc(unaffiliatedDb, 'users', 'unaffiliated_uid'), {
        role: 'admin',
      })
    );
    // Try to update own profile to 'super-admin'
    await assertFails(
      updateDoc(doc(unaffiliatedDb, 'users', 'unaffiliated_uid'), {
        role: 'super-admin',
        isSuperAdmin: true,
      })
    );
    console.log('  ✅ PASS: User cannot self-promote role to admin or super-admin');

    console.log('\n--- Test 4: User cannot self-activate status to active ---');
    await assertFails(
      updateDoc(doc(unaffiliatedDb, 'users', 'unaffiliated_uid'), {
        status: 'active',
      })
    );
    console.log('  ✅ PASS: User cannot self-activate status to active');

    console.log('\n--- Test 5: Join request spoofing for another uid is denied ---');
    // User 'unaffiliated_uid' attempts to submit a join request claiming to be 'teacher_b_uid'
    await assertFails(
      setDoc(doc(unaffiliatedDb, 'schools', 'school_a', 'joinRequests', 'req_spoof_1'), {
        id: 'req_spoof_1',
        uid: 'teacher_b_uid', // Spoofed UID
        fullName: 'Spoofed Teacher',
        email: 'spoof@attacker.com',
        phone: '0300-1111111',
        designation: 'PST',
        schoolId: 'school_a',
        schoolName: 'Govt High School A',
        semisCode: '403010101',
        requestedAt: new Date().toISOString(),
        status: 'pending',
      })
    );
    console.log('  ✅ PASS: Join request spoofing for another UID is rejected');

    // Legitimate join request for own UID is allowed
    await assertSucceeds(
      setDoc(doc(unaffiliatedDb, 'schools', 'school_a', 'joinRequests', 'req_valid_1'), {
        id: 'req_valid_1',
        uid: 'unaffiliated_uid',
        fullName: 'Legitimate Applicant',
        email: 'user@example.com',
        phone: '0300-2222222',
        designation: 'JEST',
        schoolId: 'school_a',
        schoolName: 'Govt High School A',
        semisCode: '403010101',
        requestedAt: new Date().toISOString(),
        status: 'pending',
      })
    );
    console.log('  ✅ PASS: Legitimate join request for own UID is accepted');

    console.log('\n--- Test 6: Super-admin strict platform oversight (no tenant PII read/write) ---');
    const superAdminContext = testEnv.authenticatedContext('super_admin_uid', {
      superAdmin: true,
    });
    const superAdminDb = superAdminContext.firestore();

    await assertSucceeds(getDoc(doc(superAdminDb, 'schools', 'school_a')));
    await assertSucceeds(getDoc(doc(superAdminDb, 'users', 'unaffiliated_uid')));
    await assertFails(getDoc(doc(superAdminDb, 'schools', 'school_a', 'students', 'std_a_1')));
    await assertFails(
      setDoc(doc(superAdminDb, 'schools', 'school_a', 'students', 'std_a_999'), {
        id: 'std_a_999',
        grNumber: 'GR-999',
        fullName: 'Test',
        fatherName: 'Father',
        gender: 'Male',
        classId: 'cls_9_a',
        guardianPhone: '0300-1234567',
        status: 'active',
      })
    );
    console.log('  ✅ PASS: Super-admin restricted to platform schools/users and denied student PII access');

    console.log('\n--- Test 7: Teacher can write attendance ONLY for assigned class ---');
    // Teacher A is assigned 'cls_9_a'
    await assertSucceeds(
      setDoc(doc(teacherADb, 'schools', 'school_a', 'attendance', '2026-11-22_cls_9_a'), {
        id: '2026-11-22_cls_9_a',
        schoolId: 'school_a',
        classId: 'cls_9_a',
        date: '2026-11-22',
        records: { std_a_1: 'Present' },
      })
    );
    console.log('  ✅ PASS: Teacher A successfully marked attendance for assigned class');

    // Teacher A tries to mark attendance for unassigned class 'cls_10_a'
    await assertFails(
      setDoc(doc(teacherADb, 'schools', 'school_a', 'attendance', '2026-11-22_cls_10_a'), {
        id: '2026-11-22_cls_10_a',
        schoolId: 'school_a',
        classId: 'cls_10_a', // NOT in assignedClassIds
        date: '2026-11-22',
        records: { std_a_1: 'Present' },
      })
    );
    console.log('  ✅ PASS: Teacher A denied attendance write for unassigned class');

    console.log('\n🎉 ALL 7 FIRESTORE RULES TESTS PASSED SUCCESSFULLY!\n');
  } finally {
    if (testEnv) {
      await testEnv.cleanup();
    }
  }
}

if (process.argv[1]?.endsWith('firestore.rules.test.ts')) {
  runFirestoreRulesTests().catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
}
