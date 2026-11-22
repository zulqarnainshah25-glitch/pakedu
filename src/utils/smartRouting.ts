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
 * - Super Admin (owner@pakedu.com or isSuperAdmin)
 * - Explicit 'admin' or 'principal' roles
 * - Designation matching Principal / Headmaster / Headmistress / Administrator / Admin
 * - Primary admin types
 * - Membership in school admin lists (adminUids, primaryAdminEmail, contactEmail)
 * - Known institutional admin accounts (e.g. waleedshah1@gmail.com)
 */
export function hasAdminCapabilities(
  user?: { email?: string | null; uid?: string } | null,
  profile?: UserProfile | null,
  schools?: School[] | null
): boolean {
  if (!user && !profile) return false;
  const email = (user?.email || profile?.email || '').trim().toLowerCase();
  const uid = user?.uid || profile?.uid || '';

  // 1. Super Admin
  if (email === 'owner@pakedu.com' || Boolean(profile?.isSuperAdmin) || profile?.role === 'super-admin') {
    return true;
  }

  // 2. Explicit Admin or Principal role in profile
  if (profile?.role === 'admin' || profile?.role === 'principal') {
    return true;
  }

  // 3. Primary admin type or admin designation
  if (profile?.primaryAdminType === 'principal' || profile?.primaryAdminType === 'teacher_admin') {
    return true;
  }
  if (
    profile?.designation &&
    /principal|headmaster|headmistress|administrator|admin|incharge/i.test(profile.designation)
  ) {
    return true;
  }

  // 4. Known institutional admin accounts (e.g. Waleed Shah)
  if (email === 'waleedshah1@gmail.com') {
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
 * Condition A: Super Admin (email === 'owner@pakedu.com' or isSuperAdmin) -> /super-admin
 * Condition B: Pending Approval (status === 'pending' without admin capabilities) -> /sms-onboarding
 * Condition C: Verified School Admin / Principal (hasAdminCapabilities) -> /sms-dashboard (role: admin)
 * Condition D: Verified Teacher (role === 'teacher' & active school affiliation) -> /sms-dashboard (role: teacher)
 * Condition E: General User (no school affiliation / status === 'none') -> /dashboard (Public AI Studio)
 */
export function determineSmartRoute(
  user: { email?: string | null; uid?: string } | null | undefined,
  profile: UserProfile | null | undefined,
  schools?: School[] | null
): SmartRouteResult {
  if (!user && !profile) {
    return {
      targetTool: 'dashboard',
      role: 'teacher',
      reason: 'No authenticated user; routed to public tools.',
    };
  }

  const userEmail = (user?.email || profile?.email || '').trim().toLowerCase();
  const isSuperAdminEmail = userEmail === 'owner@pakedu.com';
  const hasSuperAdminFlag = Boolean(profile?.isSuperAdmin) || profile?.role === 'super-admin';

  // Condition A (Super Admin)
  if (isSuperAdminEmail || hasSuperAdminFlag) {
    return {
      targetTool: 'super-admin',
      role: 'super-admin',
      reason: 'Condition A: Super Admin dashboard.',
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
  const isAdminCapable = hasAdminCapabilities(user, profile, schools);
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
