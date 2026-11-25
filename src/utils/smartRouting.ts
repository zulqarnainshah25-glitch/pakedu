import { UserProfile, UserRole, School } from '../features/sms/types';

export type ActiveToolId =
  | 'dashboard'
  | 'sms-dashboard'
  | 'sms-classes'
  | 'sms-students'
  | 'sms-attendance'
  | 'sms-onboarding'
  | 'sms-staff'
  | 'sms-profile'
  | 'sms-fees'
  | 'sms-exams'
  | 'sms-timetable'
  | 'sms-homework'
  | 'sms-certificates'
  | 'sms-parent'
  | 'super-admin'
  | 'lesson-plan'
  | 'salary-calculator'
  | 'leave-generator'
  | 'atlier-cv'
  | 'service-book'
  | 'question-paper';

export interface SmartRouteResult {
  targetTool: ActiveToolId;
  role: UserRole;
  reason: string;
}

/**
 * Checks whether a given user or profile possesses administrative or principal capabilities.
 * Covers:
 * - Super Admin (verified custom claim superAdmin: true or profile isSuperAdmin / role)
 * - Explicit 'admin' or 'principal' roles
 * - Designation matching Principal / Headmaster / Headmistress / Administrator / Admin
 * - Primary admin types
 * - Membership in school admin lists (adminUids, primaryAdminEmail, email)
 * - Known institutional admin accounts (e.g. waleedshah1@gmail.com)
 */
export function hasAdminCapabilities(
  user?: { email?: string | null; uid?: string } | null,
  profile?: UserProfile | null,
  schools?: School[] | null,
  claims?: { superAdmin?: boolean; [key: string]: unknown } | null
): boolean {
  if (!user && !profile) return false;
  const email = (user?.email || profile?.email || '').trim().toLowerCase();
  const uid = user?.uid || profile?.uid || '';

  // 1. Super Admin (strictly via verified custom claim, profile role/flag, or verified profile owner email)
  if (
    Boolean(claims?.superAdmin) ||
    Boolean(profile?.isSuperAdmin) ||
    profile?.role === 'super-admin' ||
    Boolean(profile && (profile.email || '').trim().toLowerCase() === 'owner@pakedu.com')
  ) {
    return true;
  }

  // Explicit Parent role strictly has no administrative capabilities
  if (profile?.role === 'parent') {
    return false;
  }

  // 2. Explicit Admin or Principal role in profile
  if (profile?.role === 'admin' || profile?.role === 'principal') {
    return true;
  }

  // 3. Known institutional admin accounts (e.g. Zulqarnain Shah, Waleed Shah)
  if (email === 'zulqarnainshah25@gmail.com' || email === 'waleedshah1@gmail.com') {
    return true;
  }

  // 4. Primary admin type or admin designation
  if (profile?.primaryAdminType === 'principal' || profile?.primaryAdminType === 'teacher_admin') {
    return true;
  }
  if (
    profile?.designation &&
    /principal|headmaster|headmistress|administrator|admin|incharge/i.test(profile.designation)
  ) {
    return true;
  }

  // 5. Check registered schools list for admin affiliation
  if (schools && schools.length > 0) {
    const isSchoolAdmin = schools.some((school) => {
      const adminUids = school.adminUids || [];
      const primaryEmail = (school.primaryAdminEmail || '').trim().toLowerCase();
      const schoolEmail = (school.email || '').trim().toLowerCase();
      return (
        (uid && adminUids.includes(uid)) ||
        (email && primaryEmail === email) ||
        (email && schoolEmail === email)
      );
    });
    if (isSchoolAdmin) return true;
  }

  return false;
}

/**
 * Pure evaluation function for Automatic Smart Login Routing.
 *
 * Condition A: Super Admin (custom claim superAdmin or verified profile isSuperAdmin) -> /super-admin
 * Condition B: Pending Approval (status === 'pending' without admin capabilities) -> /sms-onboarding
 * Condition C: Verified School Admin / Principal (hasAdminCapabilities) -> /sms-dashboard (role: admin)
 * Condition D: Verified Teacher (role === 'teacher' & active school affiliation) -> /sms-dashboard (role: teacher)
 * Condition E: General User (no school affiliation / status === 'none') -> /dashboard (Public AI Studio)
 */
export function determineSmartRoute(
  user: { email?: string | null; uid?: string } | null | undefined,
  profile: UserProfile | null | undefined,
  schools?: School[] | null,
  claims?: { superAdmin?: boolean; [key: string]: unknown } | null
): SmartRouteResult {
  if (!user && !profile) {
    return {
      targetTool: 'dashboard',
      role: 'teacher',
      reason: 'No authenticated user; routed to public tools.',
    };
  }

  const email = (user?.email || profile?.email || '').trim().toLowerCase();

  // Condition A (Super Admin) - Via verified claim, profile role/flag, or verified profile owner email
  const hasSuperAdminFlag =
    Boolean(claims?.superAdmin) ||
    Boolean(profile?.isSuperAdmin) ||
    profile?.role === 'super-admin' ||
    Boolean(profile && (profile.email || '').trim().toLowerCase() === 'owner@pakedu.com');

  if (hasSuperAdminFlag) {
    return {
      targetTool: 'super-admin',
      role: 'super-admin',
      reason: 'Condition A: Super Admin dashboard via verified administrative credentials.',
    };
  }

  // Check School Status if affiliated
  const schoolId = profile?.schoolId;
  let isSchoolActive = true;
  if (schoolId && schools && schools.length > 0) {
    const matchedSchool = schools.find(
      (s) => s.id === schoolId || (profile?.semisCode && s.semisCode === profile.semisCode)
    );
    if (matchedSchool && matchedSchool.status === 'suspended') {
      isSchoolActive = false;
    }
  }

  // Condition P: Parent Portal (strictly read-only child progress view)
  if (profile?.role === 'parent') {
    return {
      targetTool: 'sms-parent',
      role: 'parent',
      reason: 'Condition P: Parent Portal access.',
    };
  }

  // Condition B (Pending Approval - School registration or teacher applicant under review)
  if (profile?.status === 'pending') {
    return {
      targetTool: 'sms-onboarding',
      role: profile.role || 'teacher',
      reason: 'Condition B: Application pending review.',
    };
  }

  // Condition C (Verified School Admin & Principal with Admin Capabilities)
  // Ensures every user with admin capabilities logs into the School Admin Dashboard
  const isAdminCapable = hasAdminCapabilities(user, profile, schools, claims);
  if (isAdminCapable) {
    if (!isSchoolActive) {
      return {
        targetTool: 'sms-onboarding',
        role: 'admin',
        reason: 'School is suspended or under review.',
      };
    }
    return {
      targetTool: 'sms-dashboard',
      role: 'admin',
      reason: 'Condition C: Verified School Admin / Principal dashboard.',
    };
  }

  // Condition D (Verified Teacher)
  if (
    profile?.role === 'teacher' &&
    profile?.status === 'active' &&
    Boolean(profile?.schoolId)
  ) {
    if (!isSchoolActive) {
      return {
        targetTool: 'sms-onboarding',
        role: 'teacher',
        reason: 'School is suspended or under review.',
      };
    }
    return {
      targetTool: 'sms-dashboard',
      role: 'teacher',
      reason: 'Condition D: Verified Teacher dashboard.',
    };
  }

  // Condition E (General User / Unaffiliated)
  return {
    targetTool: 'dashboard',
    role: 'teacher',
    reason: 'Condition E: General User (Teacher AI Studio public tools).',
  };
}
