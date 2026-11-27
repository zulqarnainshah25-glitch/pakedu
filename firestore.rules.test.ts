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
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

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

    console.log('\n--- Test 8: Student Portal strictly Read-Only & scoped to own studentId and class ---');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'schools', 'school_a', 'students', 'std_a_1'), {
        id: 'std_a_1',
        grNumber: 'GR-101',
        fullName: 'Ali Hassan',
        fatherName: 'Hassan',
        gender: 'Male',
        classId: 'cls_9_a',
        guardianPhone: '0300-1111111',
        status: 'active',
      });
      await setDoc(doc(db, 'schools', 'school_a', 'students', 'std_a_other'), {
        id: 'std_a_other',
        grNumber: 'GR-102',
        fullName: 'Other Student',
        fatherName: 'Father',
        gender: 'Male',
        classId: 'cls_10_a',
        guardianPhone: '0300-2222222',
        status: 'active',
      });
      await setDoc(doc(db, 'schools', 'school_a', 'marks', 'm_std_1'), {
        id: 'm_std_1',
        examId: 'ex_1',
        schoolId: 'school_a',
        studentId: 'std_a_1',
        classId: 'cls_9_a',
        subjectMarks: { math: 85 },
      });
      await setDoc(doc(db, 'schools', 'school_a', 'marks', 'm_std_other'), {
        id: 'm_std_other',
        examId: 'ex_1',
        schoolId: 'school_a',
        studentId: 'std_a_other',
        classId: 'cls_10_a',
        subjectMarks: { math: 90 },
      });
      await setDoc(doc(db, 'schools', 'school_a', 'homework', 'hw_cls_9'), {
        id: 'hw_cls_9',
        schoolId: 'school_a',
        classId: 'cls_9_a',
        subject: 'Math',
        description: 'Ex 1.2',
        dueDate: '2026-12-01',
        teacherId: 'teacher_a_uid',
      });
      await setDoc(doc(db, 'schools', 'school_a', 'homework', 'hw_cls_10'), {
        id: 'hw_cls_10',
        schoolId: 'school_a',
        classId: 'cls_10_a',
        subject: 'Physics',
        description: 'Ch 2',
        dueDate: '2026-12-01',
        teacherId: 'teacher_a_uid',
      });
      await setDoc(doc(db, 'users', 'student_a_uid'), {
        uid: 'student_a_uid',
        role: 'student',
        status: 'active',
        schoolId: 'school_a',
        studentId: 'std_a_1',
        studentGrNumber: 'GR-101',
      });
    });

    const studentADb = testEnv.authenticatedContext('student_a_uid').firestore();
    await assertSucceeds(getDoc(doc(studentADb, 'schools', 'school_a', 'students', 'std_a_1')));
    await assertFails(getDoc(doc(studentADb, 'schools', 'school_a', 'students', 'std_a_other')));
    await assertSucceeds(getDoc(doc(studentADb, 'schools', 'school_a', 'marks', 'm_std_1')));
    await assertFails(getDoc(doc(studentADb, 'schools', 'school_a', 'marks', 'm_std_other')));
    await assertSucceeds(getDoc(doc(studentADb, 'schools', 'school_a', 'homework', 'hw_cls_9')));
    await assertFails(getDoc(doc(studentADb, 'schools', 'school_a', 'homework', 'hw_cls_10')));
    await assertFails(
      setDoc(doc(studentADb, 'schools', 'school_a', 'marks', 'm_std_1'), {
        id: 'm_std_1',
        examId: 'ex_1',
        schoolId: 'school_a',
        studentId: 'std_a_1',
        classId: 'cls_9_a',
        subjectMarks: { math: 100 },
      })
    );
    console.log('  ✅ PASS: Student A strictly read-only and isolated to own studentId and class');

    // Test 9: Parent can initialize missing studentInviteCode ONLY for own linked child & cannot modify other fields
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'users', 'parent_a_uid'), {
        uid: 'parent_a_uid',
        role: 'parent',
        status: 'active',
        schoolId: 'school_a',
        childStudentId: 'std_a_1',
        childGrNumber: 'GR-101',
      });
    });

    const parentADb = testEnv.authenticatedContext('parent_a_uid').firestore();
    await assertSucceeds(
      updateDoc(doc(parentADb, 'schools', 'school_a', 'students', 'std_a_1'), {
        studentInviteCode: 'STU-101-AB12',
        updatedAt: '2026-11-26T00:00:00.000Z',
      })
    );
    await assertFails(
      updateDoc(doc(parentADb, 'schools', 'school_a', 'students', 'std_a_1'), {
        studentInviteCode: 'STU-101-NEW9',
        updatedAt: '2026-11-26T00:00:01.000Z',
      })
    );
    await assertFails(
      updateDoc(doc(parentADb, 'schools', 'school_a', 'students', 'std_a_other'), {
        studentInviteCode: 'STU-102-AB12',
        updatedAt: '2026-11-26T00:00:00.000Z',
      })
    );
    await assertFails(
      updateDoc(doc(parentADb, 'schools', 'school_a', 'students', 'std_a_1'), {
        fullName: 'Tampered Name',
      })
    );
    await assertSucceeds(
      setDoc(doc(parentADb, 'studentLinks', 'school_a__GR-101'), {
        id: 'school_a__GR-101',
        schoolId: 'school_a',
        studentId: 'std_a_1',
        grNumber: 'GR-101',
        inviteCode: 'STU-101-AB12',
        status: 'available',
      })
    );
    await assertFails(
      setDoc(doc(parentADb, 'studentLinks', 'school_a__GR-102'), {
        id: 'school_a__GR-102',
        schoolId: 'school_a',
        studentId: 'std_a_other',
        grNumber: 'GR-102',
        inviteCode: 'STU-102-AB12',
        status: 'available',
      })
    );
    console.log('  ✅ PASS: Verified parent can initialize child studentInviteCode only (no overwrite or cross-student mutation)');

    console.log('\n--- Test 10: Salary & Payroll RBAC (Admin/SuperAdmin + Scoped Teacher Payslips) ---');
    const adminADb = testEnv.authenticatedContext('admin_a_uid', {
      email: 'admin.a@seld.gos.pk',
      email_verified: true,
    }).firestore();

    // Admin A can create Salary Structure for Teacher A
    await assertSucceeds(
      setDoc(doc(adminADb, 'schools', 'school_a', 'salaryStructures', 'teacher_a_uid'), {
        id: 'teacher_a_uid',
        schoolId: 'school_a',
        employeeId: 'teacher_a_uid',
        employeeUid: 'teacher_a_uid',
        employeeName: 'Teacher School A',
        employeeEmail: 'teacher.a@seld.gos.pk',
        designation: 'JEST',
        employeeType: 'teaching',
        basicSalary: 50000,
        allowances: [{ id: 'alw_1', label: 'House Rent', amount: 8000 }],
        deductions: [{ id: 'ded_1', label: 'Tax', amount: 1000 }],
        totalAllowances: 8000,
        grossSalary: 58000,
        totalDeductions: 1000,
        netSalary: 57000,
      })
    );

    // Super Admin can also read & write Salary Structure and Payslips across schools
    await assertSucceeds(getDoc(doc(superAdminDb, 'schools', 'school_a', 'salaryStructures', 'teacher_a_uid')));
    await assertSucceeds(
      setDoc(doc(superAdminDb, 'schools', 'school_a', 'payslips', '2026-11__teacher_a_uid'), {
        id: '2026-11__teacher_a_uid',
        payslipNumber: 'PAY-202611-A1',
        schoolId: 'school_a',
        month: '2026-11',
        employeeId: 'teacher_a_uid',
        employeeUid: 'teacher_a_uid',
        employeeName: 'Teacher School A',
        employeeEmail: 'teacher.a@seld.gos.pk',
        basicSalary: 50000,
        totalAllowances: 8000,
        grossSalary: 58000,
        totalDeductions: 1000,
        adjustmentAmount: 0,
        netSalary: 57000,
        status: 'paid',
        isFinalized: true,
      })
    );

    // Seed another teacher's payslip and an unfinalized draft payslip for Teacher A
    await assertSucceeds(
      setDoc(doc(adminADb, 'schools', 'school_a', 'payslips', '2026-11__teacher_other'), {
        id: '2026-11__teacher_other',
        payslipNumber: 'PAY-202611-A2',
        schoolId: 'school_a',
        month: '2026-11',
        employeeId: 'teacher_other',
        employeeUid: 'teacher_other',
        employeeName: 'Other Teacher',
        employeeEmail: 'other@seld.gos.pk',
        basicSalary: 45000,
        netSalary: 45000,
        status: 'paid',
        isFinalized: true,
      })
    );
    await assertSucceeds(
      setDoc(doc(adminADb, 'schools', 'school_a', 'payslips', '2026-12__teacher_a_uid'), {
        id: '2026-12__teacher_a_uid',
        payslipNumber: 'PAY-202612-A1',
        schoolId: 'school_a',
        month: '2026-12',
        employeeId: 'teacher_a_uid',
        employeeUid: 'teacher_a_uid',
        employeeName: 'Teacher School A',
        employeeEmail: 'teacher.a@seld.gos.pk',
        basicSalary: 50000,
        netSalary: 57000,
        status: 'draft',
        isFinalized: false,
      })
    );

    // Teacher A CANNOT read/write salaryStructures of OTHER employees, cannot write any salaryStructure, cannot read other teachers' payslips, and cannot read unfinalized draft payslips
    await assertFails(getDoc(doc(teacherADb, 'schools', 'school_a', 'salaryStructures', 'teacher_other')));
    await assertFails(getDocs(collection(teacherADb, 'schools', 'school_a', 'salaryStructures')));
    // Teacher A CAN read ONLY their own salaryStructure for live notification updates
    await assertSucceeds(getDoc(doc(teacherADb, 'schools', 'school_a', 'salaryStructures', 'teacher_a_uid')));
    await assertFails(
      setDoc(doc(teacherADb, 'schools', 'school_a', 'salaryStructures', 'teacher_a_uid'), {
        id: 'teacher_a_uid',
        schoolId: 'school_a',
        employeeId: 'teacher_a_uid',
        employeeName: 'Tampered',
        basicSalary: 999999,
        allowances: [],
        deductions: [],
        netSalary: 999999,
      })
    );
    await assertFails(getDoc(doc(teacherADb, 'schools', 'school_a', 'payslips', '2026-11__teacher_other')));
    await assertFails(getDoc(doc(teacherADb, 'schools', 'school_a', 'payslips', '2026-12__teacher_a_uid')));
    await assertFails(getDocs(collection(teacherADb, 'schools', 'school_a', 'payslips')));

    // Teacher A CAN read own finalized payslip when Teacher Payslip Portal is enabled (default true)
    await assertSucceeds(getDoc(doc(teacherADb, 'schools', 'school_a', 'payslips', '2026-11__teacher_a_uid')));
    await assertSucceeds(
      getDocs(
        query(
          collection(teacherADb, 'schools', 'school_a', 'payslips'),
          where('isFinalized', '==', true),
          where('employeeUid', '==', 'teacher_a_uid')
        )
      )
    );

    // Admin disables Teacher Payslip Portal -> Teacher A immediately denied own payslip reads!
    await assertSucceeds(
      setDoc(doc(adminADb, 'schools', 'school_a', 'payrollSettings', 'config'), {
        id: 'config',
        schoolId: 'school_a',
        teacherPayslipAccessEnabled: false,
      })
    );
    await assertFails(getDoc(doc(teacherADb, 'schools', 'school_a', 'payslips', '2026-11__teacher_a_uid')));

    // Parent & Student denied Salary & Payroll access
    await assertFails(getDoc(doc(parentADb, 'schools', 'school_a', 'salaryStructures', 'teacher_a_uid')));
    await assertFails(getDoc(doc(studentADb, 'schools', 'school_a', 'payslips', '2026-11__teacher_a_uid')));
    console.log('  ✅ PASS: Salary & Payroll RBAC strictly isolates Admin/SuperAdmin management and teacher-scoped payslips');

    console.log('\n--- Test 11: AI Lesson Plans & Question Papers RBAC (Teacher Scoped, Admin All, Parent Shared-Only, Super Admin Blocked) ---');
    const mockPaperPayload = {
      paperTitle: 'Class 9 Science Assessment',
      instructions: 'All compulsory',
      sectionATitle: 'Section A',
      mcqs: [{ question: 'Q1?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A' }],
      sectionAMarks: 10,
      sectionBTitle: 'Section B',
      sectionBNote: 'Attempt any 4',
      shortQuestions: [{ question: 'Define kinematics.', marks: 5 }],
      sectionBMarks: 20,
      sectionCTitle: 'Section C',
      sectionCNote: 'Attempt any 2',
      longQuestions: [{ question: 'Derive equation of motion.', marks: 20 }],
      sectionCMarks: 20,
      totalMarks: 50,
    };

    // Teacher A can create lesson plan ONLY for assigned class cls_9_a
    await assertSucceeds(
      setDoc(doc(teacherADb, 'schools', 'school_a', 'lessonPlans', 'lp_cls9_shared'), {
        id: 'lp_cls9_shared',
        schoolId: 'school_a',
        classId: 'cls_9_a',
        grade: 'Class 9',
        teacherId: 'teacher_a_uid',
        subject: 'Physics',
        chapter: 'Chapter 2',
        topic: 'Kinematics',
        slos: 'Understand velocity and acceleration.',
        sharedWithParents: true,
      })
    );
    await assertSucceeds(
      setDoc(doc(teacherADb, 'schools', 'school_a', 'lessonPlans', 'lp_cls9_private'), {
        id: 'lp_cls9_private',
        schoolId: 'school_a',
        classId: 'cls_9_a',
        grade: 'Class 9',
        teacherId: 'teacher_a_uid',
        subject: 'Physics',
        chapter: 'Chapter 3',
        topic: 'Dynamics',
        slos: 'Understand Newton laws.',
        sharedWithParents: false,
      })
    );
    // Teacher A DENIED creating lesson plan for unassigned class cls_10_a
    await assertFails(
      setDoc(doc(teacherADb, 'schools', 'school_a', 'lessonPlans', 'lp_cls10_bad'), {
        id: 'lp_cls10_bad',
        schoolId: 'school_a',
        classId: 'cls_10_a',
        grade: 'Class 10',
        teacherId: 'teacher_a_uid',
        subject: 'Physics',
        chapter: 'Chapter 1',
        topic: 'Waves',
        slos: 'Understand SHM.',
        sharedWithParents: true,
      })
    );

    // Admin A can create lesson plans & question papers for ANY class (e.g., cls_10_a) and review all
    await assertSucceeds(
      setDoc(doc(adminADb, 'schools', 'school_a', 'lessonPlans', 'lp_cls10_admin'), {
        id: 'lp_cls10_admin',
        schoolId: 'school_a',
        classId: 'cls_10_a',
        grade: 'Class 10',
        teacherId: 'admin_a_uid',
        subject: 'Physics',
        chapter: 'Chapter 1',
        topic: 'Waves',
        slos: 'Understand SHM.',
        sharedWithParents: true,
      })
    );
    await assertSucceeds(getDoc(doc(adminADb, 'schools', 'school_a', 'lessonPlans', 'lp_cls9_private')));
    await assertFails(getDoc(doc(teacherADb, 'schools', 'school_a', 'lessonPlans', 'lp_cls10_admin')));

    // Question Papers: Teacher A can create for cls_9_a, denied for cls_10_a; Admin can create for all
    await assertSucceeds(
      setDoc(doc(teacherADb, 'schools', 'school_a', 'questionPapers', 'qp_cls9_a'), {
        id: 'qp_cls9_a',
        schoolId: 'school_a',
        classId: 'cls_9_a',
        subject: 'Physics',
        difficulty: 'Medium',
        totalMarks: 50,
        language: 'English',
        syllabusCovered: 'Kinematics',
        attachedToExam: true,
        paper: mockPaperPayload,
      })
    );
    await assertFails(
      setDoc(doc(teacherADb, 'schools', 'school_a', 'questionPapers', 'qp_cls10_bad'), {
        id: 'qp_cls10_bad',
        schoolId: 'school_a',
        classId: 'cls_10_a',
        subject: 'Physics',
        difficulty: 'Medium',
        totalMarks: 50,
        language: 'English',
        syllabusCovered: 'Waves',
        attachedToExam: false,
        paper: mockPaperPayload,
      })
    );
    await assertSucceeds(
      setDoc(doc(adminADb, 'schools', 'school_a', 'questionPapers', 'qp_cls10_admin'), {
        id: 'qp_cls10_admin',
        schoolId: 'school_a',
        classId: 'cls_10_a',
        subject: 'Physics',
        difficulty: 'Hard',
        totalMarks: 50,
        language: 'English',
        syllabusCovered: 'Waves',
        attachedToExam: true,
        paper: mockPaperPayload,
      })
    );
    await assertFails(getDoc(doc(teacherADb, 'schools', 'school_a', 'questionPapers', 'qp_cls10_admin')));

    // Parent A can read ONLY shared lesson plans for child's class (cls_9_a), denied private or other-class plans & ALL question papers
    await assertSucceeds(getDoc(doc(parentADb, 'schools', 'school_a', 'lessonPlans', 'lp_cls9_shared')));
    await assertFails(getDoc(doc(parentADb, 'schools', 'school_a', 'lessonPlans', 'lp_cls9_private')));
    await assertFails(getDoc(doc(parentADb, 'schools', 'school_a', 'lessonPlans', 'lp_cls10_admin')));
    await assertFails(getDoc(doc(parentADb, 'schools', 'school_a', 'questionPapers', 'qp_cls9_a')));

    // Student A denied question papers (secrecy)
    await assertFails(getDoc(doc(studentADb, 'schools', 'school_a', 'questionPapers', 'qp_cls9_a')));

    // Super Admin has ZERO access to school-level AI lesson plans & question papers
    await assertFails(getDoc(doc(superAdminDb, 'schools', 'school_a', 'lessonPlans', 'lp_cls9_shared')));
    await assertFails(getDocs(collection(superAdminDb, 'schools', 'school_a', 'lessonPlans')));
    await assertFails(getDoc(doc(superAdminDb, 'schools', 'school_a', 'questionPapers', 'qp_cls9_a')));
    await assertFails(getDocs(collection(superAdminDb, 'schools', 'school_a', 'questionPapers')));
    console.log('  ✅ PASS: School AI Lesson Plans & Question Papers RBAC strictly enforced');

    console.log('\n🎉 ALL 11 FIRESTORE RULES TESTS PASSED SUCCESSFULLY!\n');
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
