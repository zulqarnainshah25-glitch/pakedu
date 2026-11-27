import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export type PortalAccessRole =
  | 'super-admin'
  | 'admin'
  | 'principal'
  | 'teacher'
  | 'parent'
  | 'student'
  | 'general';

export interface RouteAccessContext {
  isAuthenticated: boolean;
  isInitializing?: boolean;
  effectiveRole: PortalAccessRole;
  isAffiliated?: boolean;
  isImpersonating?: boolean;
  canCollectFee?: boolean;
  canAccessSalaryPayroll?: boolean;
  demoMode?: boolean;
}

export interface RouteAccessRequirement {
  allowedRoles?: PortalAccessRole[];
  requireAffiliated?: boolean;
  requireCanCollectFee?: boolean;
  requirePayrollAccess?: boolean;
  allowDuringImpersonation?: boolean;
  unauthorizedMessage?: string;
}

export interface RouteAccessDecision {
  allowed: boolean;
  redirectTo?: string;
  reason?: string;
}

export function evaluateRouteAccess(
  ctx: RouteAccessContext,
  req: RouteAccessRequirement
): RouteAccessDecision {
  if (!ctx.isAuthenticated) {
    return {
      allowed: false,
      redirectTo: '/',
      reason: 'Please sign in to access this page.',
    };
  }

  // Strictly block tenant/other routes during Super Admin impersonation unless explicitly permitted
  if (ctx.effectiveRole === 'super-admin' && ctx.isImpersonating) {
    if (req.allowDuringImpersonation) {
      return { allowed: true };
    }
    return {
      allowed: false,
      redirectTo: '/dashboard',
      reason:
        req.unauthorizedMessage ||
        'Access Denied: Super Admin Read-Only School View is restricted to the SMS overview.',
    };
  }

  // Role allowlist validation
  if (req.allowedRoles && req.allowedRoles.length > 0) {
    if (!req.allowedRoles.includes(ctx.effectiveRole)) {
      return {
        allowed: false,
        redirectTo: '/dashboard',
        reason:
          req.unauthorizedMessage ||
          `Access Denied: Your current role (${ctx.effectiveRole}) is not authorized to open this route.`,
      };
    }
  }

  // Strict Salary & Payroll RBAC (School Admin / Principal / Super Admin only)
  if (req.requirePayrollAccess && !ctx.canAccessSalaryPayroll) {
    return {
      allowed: false,
      redirectTo: '/dashboard',
      reason:
        req.unauthorizedMessage ||
        'Access Denied: Salary & Payroll is restricted to School Administrators and Super Admins.',
    };
  }

  // Fee Collection RBAC (Admin / Principal / Admission Incharge)
  if (req.requireCanCollectFee && !ctx.canCollectFee) {
    return {
      allowed: false,
      redirectTo: '/dashboard',
      reason:
        req.unauthorizedMessage ||
        'Access Denied: Fee Management requires Administrator or Admission Incharge privileges.',
    };
  }

  // Verified school affiliation check for internal SMS operations
  if (
    req.requireAffiliated &&
    !ctx.demoMode &&
    !ctx.isAffiliated &&
    !(ctx.effectiveRole === 'super-admin' && ctx.isImpersonating && req.allowDuringImpersonation)
  ) {
    return {
      allowed: false,
      redirectTo: '/dashboard',
      reason:
        req.unauthorizedMessage ||
        'School Affiliation Required: Register or get approved by your school principal to open this SMS module.',
    };
  }

  return { allowed: true };
}

export interface ProtectedRouteProps extends RouteAccessRequirement {
  access: RouteAccessContext;
  redirectTo?: string;
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  access,
  allowedRoles,
  requireAffiliated,
  requireCanCollectFee,
  requirePayrollAccess,
  allowDuringImpersonation,
  unauthorizedMessage,
  redirectTo,
  children,
}) => {
  const location = useLocation();

  if (access.isInitializing) {
    return null;
  }

  const decision = evaluateRouteAccess(access, {
    allowedRoles,
    requireAffiliated,
    requireCanCollectFee,
    requirePayrollAccess,
    allowDuringImpersonation,
    unauthorizedMessage,
  });

  if (!decision.allowed) {
    return (
      <Navigate
        to={redirectTo || decision.redirectTo || '/dashboard'}
        replace
        state={{
          routeError: decision.reason,
          attemptedPath: location.pathname,
        }}
      />
    );
  }

  return <>{children}</>;
};
