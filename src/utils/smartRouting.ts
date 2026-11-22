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
 * Pure evaluation function for Automatic Smart Login Routing.
 *
 * Condition A: Super Admin (email === 'owner@pakedu.com' or isSuperAdmin) -> /super-admin
 * Condition B: Pending Approval (status === 'pending') -> /sms-onboarding
 * Condition C: Verified School Admin (role === 'admin' & active school) -> /sms-dashboard
 * Condition D: Verified Teacher (role === 'teacher' & active school affiliation) -> /sms-dashboard
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

  // Condition B (Pending Approval)
  if (profile?.status === 'pending') {
    return {
      targetTool: 'sms-onboarding',
      role: profile.role || 'teacher',
      reason: 'Condition B: Application pending review.',
    };
  }

  // Check School Status if affiliated
  const schoolId = profile?.schoolId;
  let isSchoolActive = true;
  if (schoolId && schools && schools.length > 0) {
    const matchedSchool = schools.find(
      (s) => s.id === schoolId || (profile?.semisCode && s.semisCode === profile.semisCode)
    );
    if (matchedSchool) {
      if (matchedSchool.status === 'suspended') {
        isSchoolActive = false;
      }
    }
  }

  // Condition C (Verified School Admin)
  if (
    (profile?.role === 'admin' || profile?.role === 'principal') &&
    profile?.status === 'active'
  ) {
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
      reason: 'Condition C: Verified School Admin dashboard.',
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
