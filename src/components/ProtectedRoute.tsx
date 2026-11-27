import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export const POST_LOGIN_REDIRECT_STORAGE_KEY = 'pakedu_post_login_redirect';

/**
 * Validates and normalizes an internal app path for post-login redirect.
 * Rejects protocol-relative URLs (`//evil.com`), external schemes, control chars,
 * and landing/root entries (`/`, `/index.html`) to prevent open redirects or loops.
 */
export function sanitizePostLoginRedirectPath(rawPath?: string | null): string | null {
  if (typeof rawPath !== 'string') return null;
  const trimmed = rawPath.trim();
  if (!trimmed || !trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return null;
  }
  if (/[\u0000-\u001f\u007f\\]/.test(trimmed)) {
    return null;
  }
  const pathnameOnly = trimmed.split('?')[0].split('#')[0];
  if (
    pathnameOnly === '/' ||
    pathnameOnly === '' ||
    pathnameOnly.endsWith('/index.html')
  ) {
    return null;
  }
  return trimmed;
}

export function savePostLoginRedirectPath(rawPath?: string | null): string | null {
  const safePath = sanitizePostLoginRedirectPath(rawPath);
  if (!safePath) return null;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(POST_LOGIN_REDIRECT_STORAGE_KEY, safePath);
    }
  } catch {
    // Ignore storage access errors
  }
  return safePath;
}

export function getPostLoginRedirectPath(): string | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return sanitizePostLoginRedirectPath(
        window.sessionStorage.getItem(POST_LOGIN_REDIRECT_STORAGE_KEY)
      );
    }
  } catch {
    // Ignore storage access errors
  }
  return null;
}

export function clearPostLoginRedirectPath(): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(POST_LOGIN_REDIRECT_STORAGE_KEY);
    }
  } catch {
    // Ignore storage access errors
  }
}

export function consumePostLoginRedirectPath(): string | null {
  const saved = getPostLoginRedirectPath();
  clearPostLoginRedirectPath();
  return saved;
}

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
  const requestedFullPath = `${location.pathname}${location.search || ''}${location.hash || ''}`;

  const decision = evaluateRouteAccess(access, {
    allowedRoles,
    requireAffiliated,
    requireCanCollectFee,
    requirePayrollAccess,
    allowDuringImpersonation,
    unauthorizedMessage,
  });

  const targetRedirect = redirectTo || decision.redirectTo || '/dashboard';
  const shouldSavePostLoginRedirect =
    !access.isInitializing && !decision.allowed && targetRedirect === '/';

  useEffect(() => {
    if (shouldSavePostLoginRedirect) {
      savePostLoginRedirectPath(requestedFullPath);
    }
  }, [shouldSavePostLoginRedirect, requestedFullPath]);

  if (access.isInitializing) {
    return null;
  }

  if (!decision.allowed) {
    const safeFrom =
      targetRedirect === '/' ? savePostLoginRedirectPath(requestedFullPath) : null;
    return (
      <Navigate
        to={targetRedirect}
        replace
        state={{
          routeError: decision.reason,
          attemptedPath: location.pathname,
          ...(safeFrom ? { from: safeFrom } : {}),
        }}
      />
    );
  }

  return <>{children}</>;
};
