import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from '../firebase';
import { UserProfile, UserRole, School } from '../features/sms/types';
import {
  fetchUserProfileFromFirestore,
  saveUserProfileToFirestore,
  fetchSchoolsFromFirestore,
} from '../features/sms/services/smsFirestoreService';
import {
  determineSmartRoute,
  hasAdminCapabilities,
  SmartRouteResult,
  ActiveToolId,
} from '../utils/smartRouting';

export { determineSmartRoute, hasAdminCapabilities };
export type { SmartRouteResult, ActiveToolId };

export interface AuthContextType {
  currentUser: User | null;
  currentUserProfile: UserProfile | null;
  authLoading: boolean;
  smartRoute: SmartRouteResult | null;
  determineSmartRoute: typeof determineSmartRoute;
  refreshUserProfile: () => Promise<UserProfile | null>;
  setCurrentUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let authSignupTransactionInFlight = false;
export function setAuthSignupTransactionInFlight(inFlight: boolean) {
  authSignupTransactionInFlight = inFlight;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('sms_current_user_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [authLoading, setAuthLoading] = useState(true);
  const [smartRoute, setSmartRoute] = useState<SmartRouteResult | null>(null);

  const fetchProfileAndCalculateRoute = useCallback(async (user: User | null): Promise<UserProfile | null> => {
    if (!user) {
      setCurrentUser(null);
      setCurrentUserProfile(null);
      setSmartRoute(null);
      setAuthLoading(false);
      return null;
    }

    setCurrentUser(user);
    try {
      // Read Firebase token claims (superAdmin custom claim)
      const tokenResult = await user.getIdTokenResult();
      const userEmail = (user.email || '').trim().toLowerCase();
      const hasTokenSuperAdminClaim = Boolean(tokenResult.claims.superAdmin);
      const isOwner = userEmail === 'owner@pakedu.com';
      const isSuperAdminClaim = hasTokenSuperAdminClaim || isOwner;

      // 1. Fetch live profile from Firestore
      let profile = await fetchUserProfileFromFirestore(user.uid);

      // Avoid creating a premature default teacher profile while a signup form is writing the requested role/school profile
      if (!profile && authSignupTransactionInFlight) {
        return null;
      }

      if (!profile) {
        // Self-heal missing Firestore user document immediately with a rule-compliant baseline profile
        // so logged-in users / newly signed-up accounts never remain without a `users/{uid}` document.
        const basicProfile: UserProfile = hasTokenSuperAdminClaim
          ? {
              uid: user.uid,
              email: user.email || '',
              fullName: user.displayName || 'Portal Super Admin',
              role: 'super-admin',
              status: 'active',
              assignedClassIds: [],
              isSuperAdmin: true,
              createdAt: new Date().toISOString(),
            }
          : {
              uid: user.uid,
              email: user.email || '',
              fullName: user.displayName || 'Educator',
              role: 'teacher',
              status: 'none',
              assignedClassIds: [],
              isSuperAdmin: false,
              isAdmissionIncharge: false,
              createdAt: new Date().toISOString(),
            };
        try {
          await saveUserProfileToFirestore(basicProfile);
        } catch (createErr) {
          console.error('[AuthContext] Auto-create basic profile failed:', createErr);
        }
        profile = basicProfile;
      } else if (hasTokenSuperAdminClaim || profile.isSuperAdmin || profile.role === 'super-admin') {
        profile.role = 'super-admin';
        profile.isSuperAdmin = true;
        profile.status = 'active';
      }

      // 2. Fetch schools for verification
      const schools = await fetchSchoolsFromFirestore().catch(() => []);

      const uEmail = (user.email || profile.email || '').trim().toLowerCase();
      const matchedSchool = schools.find((s) => {
        const adminUids = s.adminUids || [];
        const primaryEmail = (s.primaryAdminEmail || '').trim().toLowerCase();
        const schoolEmail = (s.email || '').trim().toLowerCase();
        return (
          (profile?.schoolId && s.id === profile.schoolId) ||
          adminUids.includes(user.uid) ||
          (uEmail && primaryEmail === uEmail) ||
          (uEmail && schoolEmail === uEmail)
        );
      });

      const isExplicitlyPendingOrRejected =
        profile.status === 'pending' || profile.status === 'rejected';
      const isAlreadyAdminRoleInProfile =
        profile.role === 'admin' || profile.role === 'principal';
      const isApprovedInMatchedSchool =
        Boolean(matchedSchool) &&
        matchedSchool!.status === 'active' &&
        (
          (matchedSchool!.adminUids || []).includes(user.uid) ||
          (uEmail && (matchedSchool!.primaryAdminEmail || '').trim().toLowerCase() === uEmail) ||
          (uEmail && (matchedSchool!.email || '').trim().toLowerCase() === uEmail)
        );

      // Normalize active admin profile ONLY when their school/admin status authorizes it
      // (never attempt a privileged write on an unapproved 'none' / 'pending' profile)
      if (
        hasAdminCapabilities(user, profile, schools, tokenResult.claims) &&
        !isSuperAdminClaim &&
        profile.role !== 'super-admin' &&
        profile.role !== 'parent' &&
        profile.role !== 'student' &&
        (
          isApprovedInMatchedSchool ||
          (isAlreadyAdminRoleInProfile && !isExplicitlyPendingOrRejected)
        )
      ) {
        const needsUpdate =
          profile.role !== 'admin' ||
          profile.status !== 'active' ||
          (!profile.schoolId && Boolean(matchedSchool));
        profile.role = 'admin';
        profile.status = 'active';
        if (matchedSchool) {
          profile.schoolId = profile.schoolId || matchedSchool.id;
          profile.semisCode = profile.semisCode || matchedSchool.semisCode;
          profile.schoolName = profile.schoolName || matchedSchool.name;
        }
        if (needsUpdate) {
          saveUserProfileToFirestore(profile).catch((err) =>
            console.warn('[AuthContext] Admin profile sync notice:', err)
          );
        }
      }

      // 3. Calculate smart route based on Firestore profile + verified claims
      const route = determineSmartRoute(user, profile, schools, tokenResult.claims);

      setCurrentUserProfile(profile);
      setSmartRoute(route);

      try {
        localStorage.setItem('sms_current_user_profile', JSON.stringify(profile));
        localStorage.setItem('sms_user_role', route.role);
      } catch {
        // Ignore storage errors
      }
      return profile;
    } catch (err) {
      console.warn('[AuthContext] Error in profile routing:', err);
      const fallbackProfile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        fullName: user.displayName || 'Educator',
        role: 'teacher',
        status: 'none',
        assignedClassIds: [],
        isSuperAdmin: false,
        isAdmissionIncharge: false,
      };
      // Attempt best-effort self-heal so missing user doc is created cleanly
      saveUserProfileToFirestore(fallbackProfile).catch(() => {});
      const fallbackRoute = determineSmartRoute(user, fallbackProfile, []);
      setCurrentUserProfile(fallbackProfile);
      setSmartRoute(fallbackRoute);
      return fallbackProfile;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      fetchProfileAndCalculateRoute(user);
    });
    return () => unsubscribe();
  }, [fetchProfileAndCalculateRoute]);

  const refreshUserProfile = useCallback(async () => {
    if (auth.currentUser) {
      return await fetchProfileAndCalculateRoute(auth.currentUser);
    }
    return null;
  }, [fetchProfileAndCalculateRoute]);

  const signOutUser = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn('[AuthContext] Sign-out warning:', err);
    }
    setCurrentUser(null);
    setCurrentUserProfile(null);
    setSmartRoute(null);
    try {
      localStorage.removeItem('sms_current_user_profile');
      localStorage.removeItem('demo_user_session');
      sessionStorage.removeItem('pakedu_active_tool');
    } catch {
      // Ignore
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentUserProfile,
        authLoading,
        smartRoute,
        determineSmartRoute,
        refreshUserProfile,
        setCurrentUserProfile,
        signOutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
