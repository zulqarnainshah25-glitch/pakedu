import React, { useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  KeyRound,
  ArrowRight,
  Building,
  GraduationCap,
  School as SchoolIcon,
  MapPin,
  Phone,
} from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import {
  validateAuthCredentials,
  checkAuthRateLimit,
  diagnoseFirebaseAuthError,
  FirebaseAuthDiagnosis,
  DemoUserSession,
  UNIFIED_FIREBASE_PROJECT_ID,
  ATLIER_CV_LIVE_URL,
} from '../utils/authAndSso';
import { useSms } from '../features/sms/context/SmsContext';
import { useAuth, setAuthSignupTransactionInFlight } from '../context/AuthContext';
import {
  saveSchoolToFirestore,
  saveSchoolRegistrationRequestToFirestore,
  saveUserProfileToFirestore,
  saveJoinRequestToFirestore,
  fetchSchoolsFromFirestore,
  verifyAndClaimParentLink,
  FirestoreSyncError,
} from '../features/sms/services/smsFirestoreService';
import {
  School,
  SchoolRegistrationRequest,
  TeacherJoinRequest,
  UserProfile,
} from '../features/sms/types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDemoSessionSuccess: (session: DemoUserSession) => void;
  initialMode?: 'signin' | 'signup';
  isMandatoryGate?: boolean;
  logoutNotice?: string | null;
  onSignupSuccess?: (
    intent: 'general' | 'sms' | 'parent',
    smsRole?: 'admin' | 'teacher'
  ) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onDemoSessionSuccess,
  initialMode = 'signin',
  isMandatoryGate = false,
  logoutNotice = null,
  onSignupSuccess,
}) => {
  const { submitSchoolRegistration, submitJoinRequest, registeredSchools } = useSms();
  const { refreshUserProfile } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>(initialMode);
  const [accountIntent, setAccountIntent] = useState<'general' | 'sms' | 'parent'>('general');
  const [smsRoleIntent, setSmsRoleIntent] = useState<'admin' | 'teacher'>('admin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Parent Portal Signup Fields
  const [parentFullName, setParentFullName] = useState('');
  const [parentPhone, setParentPhone] = useState('0300-');
  const [childGrNumber, setChildGrNumber] = useState('');
  const [parentInviteCode, setParentInviteCode] = useState('');
  const [parentSelectedSchoolId, setParentSelectedSchoolId] = useState('');
  const [parentTargetSemisCode, setParentTargetSemisCode] = useState('');
  const [parentIsManualSemis, setParentIsManualSemis] = useState(false);

  // Admin Specific Registration Fields
  const [adminFullName, setAdminFullName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [semisCode, setSemisCode] = useState('');
  const [board, setBoard] = useState<'Sindh STBB' | 'Punjab PTB' | 'Federal'>('Sindh STBB');
  const [district, setDistrict] = useState('Hyderabad');
  const [taluka, setTaluka] = useState('Latifabad');
  const [adminPhone, setAdminPhone] = useState('0300-');

  // Teacher Specific Join Fields
  const [teacherFullName, setTeacherFullName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [cnic, setCnic] = useState('');
  const [designation, setDesignation] = useState('JEST');
  const [teacherPhone, setTeacherPhone] = useState('0300-');
  const [targetSemisCode, setTargetSemisCode] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [availableSchools, setAvailableSchools] = useState<School[]>([]);
  const [isLoadingSchools, setIsLoadingSchools] = useState(false);
  const [isManualSemis, setIsManualSemis] = useState(false);

  // Auto-parse ?parent_invite=...&school=...&gr=... when opened via Admin Invite Link
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const inviteCode = params.get('parent_invite');
    const inviteSchool = params.get('school');
    const inviteGr = params.get('gr');
    if (inviteCode || inviteGr) {
      setMode('signup');
      setAccountIntent('parent');
      if (inviteCode) setParentInviteCode(inviteCode.trim().toUpperCase());
      if (inviteGr) setChildGrNumber(inviteGr.trim().toUpperCase());
      if (inviteSchool) setParentSelectedSchoolId(inviteSchool.trim());
    }
  }, [isOpen]);

  useEffect(() => {
    const needsSchools =
      isOpen &&
      mode === 'signup' &&
      ((accountIntent === 'sms' && smsRoleIntent === 'teacher') || accountIntent === 'parent');
    if (needsSchools) {
      let isMounted = true;
      setIsLoadingSchools(true);
      fetchSchoolsFromFirestore()
        .then((schools) => {
          if (!isMounted) return;
          const activeList = (schools || []).filter(
            (s) => s.status !== 'suspended' && s.status !== 'pending_approval'
          );
          const fallbackActive = (registeredSchools || []).filter(
            (s) => s.status !== 'suspended' && s.status !== 'pending_approval'
          );
          const combined = activeList.length > 0 ? activeList : fallbackActive;
          setAvailableSchools(combined);
          if (combined.length > 0 && !targetSemisCode) {
            setSelectedSchoolId(combined[0].id);
            setTargetSemisCode(combined[0].semisCode);
          }
          if (combined.length > 0 && !parentSelectedSchoolId) {
            setParentSelectedSchoolId(combined[0].id);
            setParentTargetSemisCode(combined[0].semisCode);
          }
        })
        .catch(() => {
          if (isMounted) {
            setAvailableSchools(registeredSchools || []);
            if (registeredSchools && registeredSchools.length > 0 && !targetSemisCode) {
              setSelectedSchoolId(registeredSchools[0].id);
              setTargetSemisCode(registeredSchools[0].semisCode);
            }
            if (registeredSchools && registeredSchools.length > 0 && !parentSelectedSchoolId) {
              setParentSelectedSchoolId(registeredSchools[0].id);
              setParentTargetSemisCode(registeredSchools[0].semisCode);
            }
          }
        })
        .finally(() => {
          if (isMounted) setIsLoadingSchools(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, mode, accountIntent, smsRoleIntent, registeredSchools]);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<FirebaseAuthDiagnosis | null>(null);
  const [copiedHostname, setCopiedHostname] = useState(false);

  if (!isOpen && !isMandatoryGate) return null;

  const currentHostname =
    typeof window !== 'undefined' ? window.location.hostname : 'allfaru.dpdns.org';

  const handleCopyHostname = async () => {
    try {
      await navigator.clipboard.writeText(currentHostname);
      setCopiedHostname(true);
      setTimeout(() => setCopiedHostname(false), 2500);
    } catch {
      setCopiedHostname(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setDiagnosis(null);

    let effectiveDisplayName = displayName;
    if (mode === 'signup') {
      if (accountIntent === 'general') {
        if (!displayName.trim()) {
          setErrorMessage('Full Name is required.');
          return;
        }
        effectiveDisplayName = displayName.trim();
      } else if (accountIntent === 'parent') {
        if (!parentFullName.trim()) {
          setErrorMessage('Parent / Guardian Full Name is required.');
          return;
        }
        if (!childGrNumber.trim()) {
          setErrorMessage("Your child's GR Number is required.");
          return;
        }
        if (parentIsManualSemis && (!parentTargetSemisCode.trim() || parentTargetSemisCode.trim().length < 5)) {
          setErrorMessage("Please enter a valid School SEMIS Code or select your child's school.");
          return;
        }
        if (!parentIsManualSemis && !parentSelectedSchoolId && !parentTargetSemisCode.trim()) {
          setErrorMessage("Please select your child's school.");
          return;
        }
        effectiveDisplayName = parentFullName.trim();
      } else if (accountIntent === 'sms' && smsRoleIntent === 'admin') {
        if (!adminFullName.trim()) {
          setErrorMessage('Admin Full Name is required.');
          return;
        }
        if (!schoolName.trim()) {
          setErrorMessage('Official School Name is required.');
          return;
        }
        if (!semisCode.trim() || semisCode.trim().length < 5) {
          setErrorMessage('Please enter a valid SEMIS Code (at least 5–9 digits).');
          return;
        }
        if (!district.trim() || !taluka.trim()) {
          setErrorMessage('District and Taluka are required.');
          return;
        }
        if (!adminPhone.trim() || adminPhone.trim() === '0300-') {
          setErrorMessage('Official Phone Number is required.');
          return;
        }
        effectiveDisplayName = adminFullName.trim();
      } else if (accountIntent === 'sms' && smsRoleIntent === 'teacher') {
        if (!teacherFullName.trim()) {
          setErrorMessage('Teacher Full Name is required.');
          return;
        }
        if (!fatherName.trim()) {
          setErrorMessage("Father's Name is required.");
          return;
        }
        if (!cnic.trim() || cnic.trim().length < 13) {
          setErrorMessage('Valid CNIC Number is required (e.g., 41303-1234567-1).');
          return;
        }
        if (!teacherPhone.trim() || teacherPhone.trim() === '0300-') {
          setErrorMessage('Official Phone Number is required.');
          return;
        }
        if (!targetSemisCode.trim() || targetSemisCode.trim().length < 5) {
          setErrorMessage("Target School's SEMIS Code is required.");
          return;
        }
        effectiveDisplayName = teacherFullName.trim();
      }
    }

    const validation = validateAuthCredentials({
      mode,
      email,
      password,
      displayName: effectiveDisplayName,
    });

    if (!validation.valid) {
      setErrorMessage(validation.error || 'Please check your input fields.');
      return;
    }

    const rateCheck = checkAuthRateLimit();
    if (!rateCheck.allowed) {
      setErrorMessage(
        `Too many login attempts. Please wait ${rateCheck.retryAfterSeconds} seconds before trying again.`
      );
      return;
    }

    setLoading(true);
    try {
      if (mode === 'reset') {
        await sendPasswordResetEmail(auth, validation.sanitizedEmail);
        setSuccessMessage(
          `Password reset link sent to ${validation.sanitizedEmail}. Check your inbox or spam folder.`
        );
        setLoading(false);
        return;
      }

      if (mode === 'signup') {
        setAuthSignupTransactionInFlight(true);
        try {
          const credential = await createUserWithEmailAndPassword(
            auth,
            validation.sanitizedEmail,
            password
          );
          if (effectiveDisplayName) {
            await updateProfile(credential.user, {
              displayName: effectiveDisplayName,
            });
          }

          // Save user role, status, and school linkage directly to Firestore BEFORE releasing auth listener sync
          if (accountIntent === 'sms') {
            if (smsRoleIntent === 'admin') {
              const sanitizedSemis = semisCode.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
              const schoolId = `sch_${sanitizedSemis || credential.user.uid.slice(0, 8)}`;
              const newSchool: School = {
                id: schoolId,
                name: schoolName.trim(),
                semisCode: semisCode.trim(),
                board,
                district: district.trim(),
                taluka: taluka.trim(),
                adminUids: [credential.user.uid],
                activeAcademicYear: '2025-2026',
                phone: adminPhone.trim(),
                email: validation.sanitizedEmail,
                status: 'pending_approval',
                primaryAdminType: 'principal',
                primaryAdminName: adminFullName.trim(),
                primaryAdminEmail: validation.sanitizedEmail,
                createdAt: new Date().toISOString(),
              };

              const requestId = `sch_req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
              const newRequest: SchoolRegistrationRequest = {
                id: requestId,
                schoolId: newSchool.id,
                schoolName: newSchool.name,
                semisCode: newSchool.semisCode,
                board: newSchool.board,
                district: newSchool.district,
                taluka: newSchool.taluka,
                activeAcademicYear: newSchool.activeAcademicYear,
                phone: newSchool.phone,
                email: newSchool.email,
                primaryAdminType: 'principal',
                adminUid: credential.user.uid,
                adminName: adminFullName.trim(),
                adminEmail: validation.sanitizedEmail,
                adminPhone: adminPhone.trim(),
                adminDesignation: 'Principal / Headmaster',
                requestedAt: new Date().toISOString(),
                status: 'pending',
              };

              // Step 1: Create users/{uid} document first (no schoolId prerequisite on create)
              const baseAdminProfile: UserProfile = {
                uid: credential.user.uid,
                email: validation.sanitizedEmail,
                fullName: adminFullName.trim(),
                role: 'admin',
                status: 'pending',
                designation: 'Principal / Headmaster',
                phone: adminPhone.trim(),
                primaryAdminType: 'principal',
                assignedClassIds: [],
                isSuperAdmin: false,
                isAdmissionIncharge: false,
                createdAt: new Date().toISOString(),
              };
              try {
                await saveUserProfileToFirestore(baseAdminProfile);
              } catch (profileErr) {
                // Ensure the basic teacher/none user document still self-heals if strict rules apply
                await saveUserProfileToFirestore({
                  ...baseAdminProfile,
                  role: 'teacher',
                  status: 'none',
                }).catch(() => {});
                throw profileErr;
              }

              // Step 2: Create pending_approval school doc and registration request
              await Promise.all([
                saveSchoolToFirestore(newSchool),
                saveSchoolRegistrationRequestToFirestore(newRequest),
              ]);

              // Step 3: Link users/{uid} to the newly created school
              const linkedAdminProfile: UserProfile = {
                ...baseAdminProfile,
                schoolId: newSchool.id,
                schoolName: newSchool.name,
                semisCode: newSchool.semisCode,
              };
              await saveUserProfileToFirestore(linkedAdminProfile);

              submitSchoolRegistration(
                {
                  id: newSchool.id,
                  name: newSchool.name,
                  semisCode: newSchool.semisCode,
                  board: newSchool.board,
                  district: newSchool.district,
                  taluka: newSchool.taluka,
                  activeAcademicYear: newSchool.activeAcademicYear,
                  phone: newSchool.phone,
                  email: newSchool.email,
                  primaryAdminType: 'principal',
                  primaryAdminName: newSchool.primaryAdminName,
                  primaryAdminEmail: newSchool.primaryAdminEmail,
                  status: 'pending_approval',
                },
                {
                  uid: credential.user.uid,
                  email: validation.sanitizedEmail,
                  fullName: adminFullName.trim(),
                  phone: adminPhone.trim(),
                  designation: 'Principal / Headmaster',
                  primaryAdminType: 'principal',
                },
                {
                  requestId: newRequest.id,
                  skipFirestoreSync: true,
                }
              );
            } else {
              // Teacher Signup
              const pool = availableSchools.length > 0 ? availableSchools : registeredSchools;
              const matchedSchool = pool.find(
                (s) => s.id === selectedSchoolId || s.semisCode.trim() === targetSemisCode.trim()
              );
              const resolvedSemis = matchedSchool ? matchedSchool.semisCode : targetSemisCode.trim();
              const sanitizedSemis = resolvedSemis.replace(/[^a-zA-Z0-9_-]/g, '_');
              const schoolId = matchedSchool ? matchedSchool.id : `sch_${sanitizedSemis}`;
              const resolvedSchoolName = matchedSchool ? matchedSchool.name : `Govt. School (SEMIS: ${resolvedSemis})`;

              const joinReqId = `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
              const newJoinReq: TeacherJoinRequest = {
                id: joinReqId,
                uid: credential.user.uid,
                fullName: teacherFullName.trim(),
                fatherName: fatherName.trim(),
                email: validation.sanitizedEmail,
                phone: teacherPhone.trim(),
                cnic: cnic.trim(),
                designation: designation.trim(),
                schoolId,
                schoolName: resolvedSchoolName,
                semisCode: resolvedSemis,
                requestedAt: new Date().toISOString(),
                status: 'pending',
              };

              const teacherProfile: UserProfile = {
                uid: credential.user.uid,
                email: validation.sanitizedEmail,
                fullName: teacherFullName.trim(),
                fatherName: fatherName.trim(),
                role: 'teacher',
                schoolId,
                schoolName: resolvedSchoolName,
                semisCode: resolvedSemis,
                status: 'pending',
                designation: designation.trim(),
                cnic: cnic.trim(),
                phone: teacherPhone.trim(),
                assignedClassIds: [],
                isSuperAdmin: false,
                isAdmissionIncharge: false,
                createdAt: new Date().toISOString(),
              };

              await saveUserProfileToFirestore(teacherProfile);
              await saveJoinRequestToFirestore(schoolId, newJoinReq);

              submitJoinRequest(
                {
                  uid: credential.user.uid,
                  fullName: teacherFullName.trim(),
                  fatherName: fatherName.trim(),
                  email: validation.sanitizedEmail,
                  phone: teacherPhone.trim(),
                  cnic: cnic.trim(),
                  designation: designation.trim(),
                  schoolId,
                  schoolName: resolvedSchoolName,
                  semisCode: resolvedSemis,
                },
                {
                  requestId: newJoinReq.id,
                  skipFirestoreSync: true,
                }
              );
            }
          } else if (accountIntent === 'parent') {
            const pool = availableSchools.length > 0 ? availableSchools : registeredSchools;
            const matchedSchool = pool.find(
              (s) =>
                s.id === parentSelectedSchoolId ||
                (parentTargetSemisCode.trim() && s.semisCode.trim() === parentTargetSemisCode.trim())
            );
            const resolvedSemis = matchedSchool ? matchedSchool.semisCode : parentTargetSemisCode.trim();
            const sanitizedSemis = resolvedSemis.replace(/[^a-zA-Z0-9_-]/g, '_');
            const targetSchoolId = matchedSchool
              ? matchedSchool.id
              : parentSelectedSchoolId || `sch_${sanitizedSemis}`;

            try {
              const claimed = await verifyAndClaimParentLink({
                schoolId: targetSchoolId,
                grNumber: childGrNumber.trim().toUpperCase(),
                uid: credential.user.uid,
                parentEmail: validation.sanitizedEmail,
                parentPhone: parentPhone.trim(),
                inviteCode: parentInviteCode.trim().toUpperCase(),
              });

              const linkedParentProfile: UserProfile = {
                uid: credential.user.uid,
                email: validation.sanitizedEmail,
                fullName: parentFullName.trim(),
                role: 'parent',
                status: 'active',
                schoolId: claimed.schoolId,
                schoolName: claimed.schoolName || matchedSchool?.name || '',
                semisCode: claimed.semisCode || resolvedSemis,
                phone: parentPhone.trim(),
                childStudentId: claimed.studentId,
                childGrNumber: claimed.grNumber,
                childName: claimed.studentName,
                parentLinkId: claimed.id,
                linkedInviteCode: parentInviteCode.trim().toUpperCase() || claimed.inviteCode,
                assignedClassIds: [],
                isSuperAdmin: false,
                isAdmissionIncharge: false,
                createdAt: new Date().toISOString(),
              };
              await saveUserProfileToFirestore(linkedParentProfile);
            } catch {
              const pendingParentProfile: UserProfile = {
                uid: credential.user.uid,
                email: validation.sanitizedEmail,
                fullName: parentFullName.trim(),
                role: 'parent',
                status: 'pending',
                schoolId: targetSchoolId || undefined,
                schoolName: matchedSchool?.name,
                semisCode: resolvedSemis || undefined,
                phone: parentPhone.trim(),
                childGrNumber: childGrNumber.trim().toUpperCase(),
                assignedClassIds: [],
                isSuperAdmin: false,
                isAdmissionIncharge: false,
                createdAt: new Date().toISOString(),
              };
              await saveUserProfileToFirestore(pendingParentProfile);
            }
          } else {
            // General User Signup
            const generalProfile: UserProfile = {
              uid: credential.user.uid,
              email: validation.sanitizedEmail,
              fullName: displayName.trim(),
              role: 'teacher',
              status: 'none',
              assignedClassIds: [],
              isSuperAdmin: false,
              isAdmissionIncharge: false,
              createdAt: new Date().toISOString(),
            };
            await saveUserProfileToFirestore(generalProfile);
          }

          await refreshUserProfile();
          onClose();
          if (onSignupSuccess) {
            onSignupSuccess(accountIntent, accountIntent === 'sms' ? smsRoleIntent : undefined);
          }
          return;
        } finally {
          setAuthSignupTransactionInFlight(false);
        }
      } else {
        await signInWithEmailAndPassword(auth, validation.sanitizedEmail, password);
      }

      onClose();
    } catch (err) {
      if (err instanceof FirestoreSyncError) {
        setErrorMessage(`Account created, but profile provisioning failed: ${err.message}`);
        return;
      }
      const diag = diagnoseFirebaseAuthError(
        err,
        currentHostname,
        UNIFIED_FIREBASE_PROJECT_ID
      );
      setDiagnosis(diag);
      setErrorMessage(diag.userMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setDiagnosis(null);

    const rateCheck = checkAuthRateLimit();
    if (!rateCheck.allowed) {
      setErrorMessage(
        `Too many login attempts. Please wait ${rateCheck.retryAfterSeconds} seconds before trying again.`
      );
      return;
    }

    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      await refreshUserProfile();
      onClose();
      if (mode === 'signup' && onSignupSuccess) {
        onSignupSuccess(accountIntent, accountIntent === 'sms' ? smsRoleIntent : undefined);
      }
    } catch (err) {
      const diag = diagnoseFirebaseAuthError(
        err,
        currentHostname,
        UNIFIED_FIREBASE_PROJECT_ID
      );
      if (diag.isPopupBlocked) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch {
          // Fall through to display diagnostic UI
        }
      }
      setDiagnosis(diag);
      setErrorMessage(diag.userMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleInstantFallbackSession = () => {
    const cleanEmail =
      email.trim().toLowerCase() || 'teacher.seld@allfaru.dpdns.org';
    const cleanName =
      displayName.trim() ||
      cleanEmail.split('@')[0].replace(/[._-]/g, ' ') ||
      'Sindh SELD Educator';

    onDemoSessionSuccess({
      uid: `seld_local_${Date.now()}`,
      email: cleanEmail,
      displayName: cleanName,
      isDemoFallback: true,
      createdAt: new Date().toISOString(),
    });
    onClose();
    if (mode === 'signup' && onSignupSuccess) {
      onSignupSuccess(accountIntent);
    }
  };

  return (
    <div
      className={
        isMandatoryGate
          ? 'no-print min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-950 relative overflow-y-auto'
          : 'no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn'
      }
      style={
        isMandatoryGate
          ? {
              background:
                'radial-gradient(circle at top left, #3b0764 0%, #0f172a 55%, #1e1b4b 100%)',
            }
          : undefined
      }
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      {isMandatoryGate && <div className="allforu-progress-bar no-print" />}

      {isMandatoryGate && (
        <div className="w-full max-w-4xl mb-4 flex items-center justify-between text-white px-1">
          <div className="flex items-center gap-2.5">
            <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              Allforu
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-pink-500/20 text-pink-200 border border-pink-400/30">
              PakEdu &amp; Sindh SELD Official Portal
            </span>
          </div>
          <span className="text-xs font-mono text-purple-200/80 hidden sm:inline">
            Mandatory Authentication Gate
          </span>
        </div>
      )}

      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-purple-500/25 overflow-hidden grid grid-cols-1 md:grid-cols-12">
        {/* Left Branding Panel (Identical to AtlierCV + Allforu Deep Purple & Neon Theme) */}
        <div
          className="md:col-span-5 p-7 text-white flex flex-col justify-between relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #5b21b6 0%, #1e1b4b 100%)',
          }}
        >
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-[11px] font-semibold tracking-wider uppercase text-pink-300 border border-white/15">
              <Sparkles className="w-3.5 h-3.5 text-pink-400" />
              Allforu × AtlierCV Unified ID
            </div>
            <h2
              id="auth-modal-title"
              className="text-2xl sm:text-3xl font-bold tracking-tight mt-4 leading-tight"
            >
              One Account for PakEdu Portal &amp; AtlierCV Studio
            </h2>
            <p className="text-xs sm:text-sm text-purple-100/85 mt-3 leading-relaxed">
              Portal open karne ke liye Sign In zaroori hai. Aapka ek hi account{' '}
              <strong>PakEdu SELD Portal</strong> aur{' '}
              <strong>AtlierCV Resume Studio</strong> dono ko unlock karta hai (Project:{' '}
              <code className="font-mono text-pink-300 font-semibold">
                {UNIFIED_FIREBASE_PROJECT_ID}
              </code>
              ).
            </p>

            <div className="mt-6 space-y-3 text-xs text-purple-100/90">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
                <span>
                  1. AI Lesson Plan Generator (Sindh STBB &amp; Punjab PTB + Firestore)
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
                <span>
                  2. Sindh Government Salary Calculator 2026 &amp; SELD Leave Proforma
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
                <span>
                  3. Integrated <strong className="text-white">AtlierCV Studio</strong> with Unified Login &amp; Logout Return
                </span>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-8 pt-4 border-t border-white/15 flex items-center justify-between text-[11px] text-purple-200/80">
            <span>Project: {UNIFIED_FIREBASE_PROJECT_ID}</span>
            <a
              href={ATLIER_CV_LIVE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-pink-300 hover:text-white font-semibold"
            >
              AtlierCV Live <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Right Authentication Form Panel */}
        <div className="md:col-span-7 p-6 sm:p-8 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col justify-between overflow-y-auto max-h-[92vh]">
          <div>
            {/* Logout Notice Banner (Shown when user logs out from Portal or AtlierCV) */}
            {logoutNotice && (
              <div className="mb-4 p-3 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-xs font-medium text-[#5b21b6] dark:text-purple-200 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#ec4899] shrink-0" />
                <span>{logoutNotice}</span>
              </div>
            )}

            {/* Top Mode Switcher & Close Button */}
            <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    mode === 'signin'
                      ? 'bg-[#5b21b6] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    mode === 'signup'
                      ? 'bg-[#5b21b6] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  Create Account
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('reset');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    mode === 'reset'
                      ? 'bg-[#5b21b6] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  Reset Password
                </button>
              </div>

              {!isMandatoryGate ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer"
                  aria-label="Close authentication modal"
                >
                  <X className="w-5 h-5" />
                </button>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-pink-100 dark:bg-pink-950/70 text-[#ec4899] border border-pink-200 dark:border-pink-800">
                  Login Required
                </span>
              )}
            </div>

            {/* Google Sign-In Button (Identical to AtlierCV) */}
            {mode !== 'reset' && (
              <div className="mt-5">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleGoogleAuth}
                  className="w-full flex items-center justify-center gap-3 py-2.5 px-4 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/70 rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-60"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.08.72-2.45 1.16-4.22 1.16-3.24 0-5.98-2.18-6.96-5.11H1.05v3.14C3.06 21.2 7.22 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.04 14.04c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.32H1.05C.38 7.66 0 9.18 0 11.75s.38 4.09 1.05 5.43l3.99-3.14z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.8 0 3.41.62 4.68 1.84l3.51-3.51C18.07 1.19 15.3 0 12 0 7.22 0 3.06 2.8 1.05 6.32l3.99 3.14c.98-2.93 3.72-5.11 6.96-5.11z"
                    />
                  </svg>
                  <span>Continue with Google Account</span>
                </button>

                <div className="relative my-4 flex items-center justify-center">
                  <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
                  <span className="bg-white dark:bg-slate-900 px-3 text-[11px] uppercase tracking-wider text-slate-400 font-medium whitespace-nowrap">
                    or continue with email
                  </span>
                  <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
                </div>
              </div>
            )}

            {/* Email / Password Form */}
            {mode === 'signin' && (
              <div className="p-3 bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-xl text-xs text-purple-950 dark:text-purple-200 flex items-start gap-2.5 my-2">
                <Sparkles className="w-4 h-4 text-[#5b21b6] dark:text-purple-400 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  Sign in with your registered email. The system will automatically route you to your respective dashboard (Portal Tools, School Admin, Teacher, or Super Admin).
                </p>
              </div>
            )}
            <form onSubmit={handleEmailAuth} className="space-y-3.5 mt-3">
              {mode === 'signup' && (
                <>
                  {/* Step 1: Account Intent Selection (General vs School Management) */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Select Account Type (اکاؤنٹ کی قسم منتخب کریں):
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* Option 1: General User (AI Tools Only) */}
                      <div
                        onClick={() => setAccountIntent('general')}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between text-left ${
                          accountIntent === 'general'
                            ? 'border-[#5b21b6] bg-purple-50/70 dark:bg-purple-950/40 text-slate-900 dark:text-white shadow-xs'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-2">
                            <div className={`p-1 rounded-md ${accountIntent === 'general' ? 'bg-[#5b21b6] text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                              <Sparkles className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs font-bold leading-tight">General User</span>
                          </div>
                          <input
                            type="radio"
                            name="accountIntent"
                            checked={accountIntent === 'general'}
                            onChange={() => setAccountIntent('general')}
                            className="text-[#5b21b6] focus:ring-[#5b21b6] cursor-pointer"
                          />
                        </div>
                        <p className="text-[11px] mt-1.5 text-slate-500 dark:text-slate-400 leading-snug">
                          AI Tools (Lesson Plans, Papers, Salary &amp; CV Studio)
                        </p>
                      </div>

                      {/* Option 2: School Management (Admin/Teacher) */}
                      <div
                        onClick={() => setAccountIntent('sms')}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between text-left ${
                          accountIntent === 'sms'
                            ? 'border-[#5b21b6] bg-purple-50/70 dark:bg-purple-950/40 text-slate-900 dark:text-white shadow-xs'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-2">
                            <div className={`p-1 rounded-md ${accountIntent === 'sms' ? 'bg-[#5b21b6] text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                              <Building className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs font-bold leading-tight">School Staff</span>
                          </div>
                          <input
                            type="radio"
                            name="accountIntent"
                            checked={accountIntent === 'sms'}
                            onChange={() => setAccountIntent('sms')}
                            className="text-[#5b21b6] focus:ring-[#5b21b6] cursor-pointer"
                          />
                        </div>
                        <p className="text-[11px] mt-1.5 text-slate-500 dark:text-slate-400 leading-snug">
                          Admin / Teacher (Register or Join School, Classes, Attendance)
                        </p>
                      </div>

                      {/* Option 3: Parent / Guardian (Read-Only Child Portal) */}
                      <div
                        onClick={() => setAccountIntent('parent')}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between text-left ${
                          accountIntent === 'parent'
                            ? 'border-[#5b21b6] bg-purple-50/70 dark:bg-purple-950/40 text-slate-900 dark:text-white shadow-xs'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-2">
                            <div className={`p-1 rounded-md ${accountIntent === 'parent' ? 'bg-[#5b21b6] text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                              <GraduationCap className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs font-bold leading-tight">Parent / Guardian</span>
                          </div>
                          <input
                            type="radio"
                            name="accountIntent"
                            checked={accountIntent === 'parent'}
                            onChange={() => setAccountIntent('parent')}
                            className="text-[#5b21b6] focus:ring-[#5b21b6] cursor-pointer"
                          />
                        </div>
                        <p className="text-[11px] mt-1.5 text-slate-500 dark:text-slate-400 leading-snug">
                          Link Child GR# for Attendance, Fees &amp; Report Cards (Read-Only)
                        </p>
                      </div>
                    </div>

                    {/* Step 2: Conditional Role Selection for School Management */}
                    {accountIntent === 'sms' && (
                      <div className="p-3 bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 rounded-xl space-y-2 mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="flex items-center justify-between">
                          <label className="block text-[11px] font-bold text-[#5b21b6] dark:text-purple-300">
                            Select your School Role (ادارہ جاتی کردار منتخب کریں):
                          </label>
                          <span className="text-[10px] text-purple-700 dark:text-purple-300 font-semibold uppercase tracking-wider">
                            Step 2 of 2
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {/* Option 1: Register New School (Admin/Principal) */}
                          <div
                            onClick={() => setSmsRoleIntent('admin')}
                            className={`p-2.5 rounded-lg border-2 cursor-pointer transition-all flex items-start gap-2.5 text-left ${
                              smsRoleIntent === 'admin'
                                ? 'border-[#5b21b6] bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                                : 'border-purple-200/70 dark:border-purple-900/40 hover:border-purple-300 bg-white/60 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            <input
                              type="radio"
                              name="smsRoleIntent"
                              value="admin"
                              checked={smsRoleIntent === 'admin'}
                              onChange={() => setSmsRoleIntent('admin')}
                              className="mt-0.5 text-[#5b21b6] focus:ring-[#5b21b6] cursor-pointer shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <Building className="w-3.5 h-3.5 text-[#5b21b6] dark:text-purple-400 shrink-0" />
                                <span className="text-xs font-bold leading-tight truncate">Register a New School</span>
                              </div>
                              <span className="block text-[11px] text-[#5b21b6] dark:text-purple-300 font-semibold mt-0.5">
                                (I am Admin / Principal)
                              </span>
                              <span className="block text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                                Submit institution for Super Admin review &amp; setup
                              </span>
                            </div>
                          </div>

                          {/* Option 2: Join Existing School (Teacher) */}
                          <div
                            onClick={() => setSmsRoleIntent('teacher')}
                            className={`p-2.5 rounded-lg border-2 cursor-pointer transition-all flex items-start gap-2.5 text-left ${
                              smsRoleIntent === 'teacher'
                                ? 'border-[#5b21b6] bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                                : 'border-purple-200/70 dark:border-purple-900/40 hover:border-purple-300 bg-white/60 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            <input
                              type="radio"
                              name="smsRoleIntent"
                              value="teacher"
                              checked={smsRoleIntent === 'teacher'}
                              onChange={() => setSmsRoleIntent('teacher')}
                              className="mt-0.5 text-[#5b21b6] focus:ring-[#5b21b6] cursor-pointer shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <GraduationCap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span className="text-xs font-bold leading-tight truncate">Join Existing School</span>
                              </div>
                              <span className="block text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5">
                                (I am a Teacher)
                              </span>
                              <span className="block text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                                Apply to join with SEMIS code &amp; get class roster
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Dynamic Fields 1: General User Full Name */}
                  {accountIntent === 'general' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Full Name (Teacher / Officer Name) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="e.g., Muhammad Farooq (PST / JEST)"
                          className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
                          required
                        />
                      </div>
                    </div>
                  )}

                  {/* Dynamic Fields 2: Admin Registration Fields */}
                  {accountIntent === 'sms' && smsRoleIntent === 'admin' && (
                    <div className="space-y-3 pt-2 border-t border-purple-100 dark:border-purple-900/40 animate-in fade-in duration-200">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#5b21b6] dark:text-purple-300">
                        <Building className="w-4 h-4 shrink-0 text-purple-600 dark:text-purple-400" />
                        <span>School Institutional Information (اسکول و ایڈمن تفصیلات):</span>
                      </div>

                      {/* Admin Full Name */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Admin / Principal Full Name <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={adminFullName}
                            onChange={(e) => setAdminFullName(e.target.value)}
                            placeholder="e.g., Muhammad Farooq (Headmaster)"
                            className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
                            required
                          />
                        </div>
                      </div>

                      {/* Official School Name */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Official School Name (سرکاری یا پرائیویٹ اسکول کا نام) <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <SchoolIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={schoolName}
                            onChange={(e) => setSchoolName(e.target.value)}
                            placeholder="e.g., Govt. Comprehensive High School Latifabad"
                            className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
                            required
                          />
                        </div>
                      </div>

                      {/* SEMIS Code & Educational Board */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            SEMIS Code (8–9 digits) <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={semisCode}
                              onChange={(e) => setSemisCode(e.target.value)}
                              placeholder="e.g., 403020101"
                              maxLength={10}
                              className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Educational Board <span className="text-rose-500">*</span>
                          </label>
                          <select
                            value={board}
                            onChange={(e) => setBoard(e.target.value as any)}
                            className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5b21b6] cursor-pointer"
                          >
                            <option value="Sindh STBB">Sindh STBB (Jamshoro)</option>
                            <option value="Punjab PTB">Punjab PTB (Lahore)</option>
                            <option value="Federal">Federal (Islamabad)</option>
                          </select>
                        </div>
                      </div>

                      {/* District & Taluka */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            District (ضلع) <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={district}
                              onChange={(e) => setDistrict(e.target.value)}
                              placeholder="e.g., Hyderabad"
                              className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Taluka / Tehsil (تعلقہ) <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={taluka}
                            onChange={(e) => setTaluka(e.target.value)}
                            placeholder="e.g., Latifabad"
                            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
                            required
                          />
                        </div>
                      </div>

                      {/* Official Phone Number */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Official Phone / WhatsApp Number <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={adminPhone}
                            onChange={(e) => setAdminPhone(e.target.value)}
                            placeholder="0300-1234567"
                            className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Dynamic Fields 3: Teacher Join Fields */}
                  {accountIntent === 'sms' && smsRoleIntent === 'teacher' && (
                    <div className="space-y-3 pt-2 border-t border-purple-100 dark:border-purple-900/40 animate-in fade-in duration-200">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        <GraduationCap className="w-4 h-4 shrink-0" />
                        <span>Teacher Credentials &amp; Target School (استاد کی تفصیلات):</span>
                      </div>

                      {/* Teacher Full Name & Father Name */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Teacher Full Name <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={teacherFullName}
                              onChange={(e) => setTeacherFullName(e.target.value)}
                              placeholder="e.g., Ms. Shabana Parveen"
                              className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Father's Name (والد کا نام) <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={fatherName}
                            onChange={(e) => setFatherName(e.target.value)}
                            placeholder="e.g., Abdul Sattar"
                            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
                            required
                          />
                        </div>
                      </div>

                      {/* CNIC & Designation */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            CNIC Number (شناختی کارڈ) <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={cnic}
                            onChange={(e) => setCnic(e.target.value)}
                            placeholder="41303-1234567-1"
                            maxLength={15}
                            className="w-full px-3.5 py-2.5 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Designation (عہدہ) <span className="text-rose-500">*</span>
                          </label>
                          <select
                            value={designation}
                            onChange={(e) => setDesignation(e.target.value)}
                            className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5b21b6] cursor-pointer"
                          >
                            <option value="PST">PST (Primary School Teacher)</option>
                            <option value="JEST">JEST (Junior Elementary School Teacher)</option>
                            <option value="HST">HST (High School Teacher)</option>
                            <option value="Subject Specialist">Subject Specialist (SS)</option>
                          </select>
                        </div>
                      </div>

                      {/* Phone & Target SEMIS */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Official Phone / WhatsApp <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={teacherPhone}
                              onChange={(e) => setTeacherPhone(e.target.value)}
                              placeholder="0300-1234567"
                              className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Target School to Join <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <Building className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <select
                              value={isManualSemis ? 'manual' : selectedSchoolId}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'manual') {
                                  setIsManualSemis(true);
                                  setSelectedSchoolId('');
                                } else {
                                  setIsManualSemis(false);
                                  setSelectedSchoolId(val);
                                  const pool = availableSchools.length > 0 ? availableSchools : registeredSchools;
                                  const found = pool.find((s) => s.id === val);
                                  if (found) {
                                    setTargetSemisCode(found.semisCode);
                                  }
                                }
                              }}
                              className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5b21b6] cursor-pointer"
                              required={!isManualSemis}
                            >
                              {isLoadingSchools && (
                                <option value="">Loading registered schools...</option>
                              )}
                              {!isLoadingSchools && (availableSchools.length > 0 || registeredSchools.length > 0) && (
                                <>
                                  <option value="">-- Select Your School from Directory --</option>
                                  {(availableSchools.length > 0 ? availableSchools : registeredSchools).map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.name} — SEMIS: {s.semisCode} ({s.district})
                                    </option>
                                  ))}
                                </>
                              )}
                              <option value="manual">Other School (Enter SEMIS Manually)...</option>
                            </select>
                          </div>

                          {/* Fallback or Manual SEMIS entry */}
                          {isManualSemis ? (
                            <div className="mt-2">
                              <input
                                type="text"
                                value={targetSemisCode}
                                onChange={(e) => setTargetSemisCode(e.target.value)}
                                placeholder="Enter 8-9 digit SEMIS Code"
                                maxLength={10}
                                className="w-full px-3.5 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
                                required
                              />
                            </div>
                          ) : (
                            targetSemisCode && (
                              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                                <span>Official SEMIS Code:</span>
                                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                  {targetSemisCode}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Parent / Guardian Verification & Child Link Fields */}
                  {accountIntent === 'parent' && (
                    <div className="space-y-3 p-3.5 bg-indigo-50/70 dark:bg-indigo-950/25 border border-indigo-200 dark:border-indigo-800/60 rounded-xl animate-in fade-in duration-200">
                      <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                        <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span>Parent / Guardian &amp; Child Verification (والدین و طالب علم کی تصدیق):</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Parent / Guardian Full Name <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={parentFullName}
                              onChange={(e) => setParentFullName(e.target.value)}
                              placeholder="e.g., Ghulam Mustafa Solangi"
                              className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Guardian Mobile Number
                          </label>
                          <div className="relative">
                            <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={parentPhone}
                              onChange={(e) => setParentPhone(e.target.value)}
                              placeholder="0300-1234567"
                              className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Child&apos;s School <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <Building className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <select
                            value={parentIsManualSemis ? 'manual' : parentSelectedSchoolId}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'manual') {
                                setParentIsManualSemis(true);
                                setParentSelectedSchoolId('');
                              } else {
                                setParentIsManualSemis(false);
                                setParentSelectedSchoolId(val);
                                const pool = availableSchools.length > 0 ? availableSchools : registeredSchools;
                                const found = pool.find((s) => s.id === val);
                                if (found) {
                                  setParentTargetSemisCode(found.semisCode);
                                }
                              }
                            }}
                            className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5b21b6] cursor-pointer"
                            required={!parentIsManualSemis}
                          >
                            {isLoadingSchools && (
                              <option value="">Loading schools directory...</option>
                            )}
                            {!isLoadingSchools && (availableSchools.length > 0 || registeredSchools.length > 0) && (
                              <>
                                <option value="">-- Select Your Child&apos;s School --</option>
                                {(availableSchools.length > 0 ? availableSchools : registeredSchools).map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name} — SEMIS: {s.semisCode}
                                  </option>
                                ))}
                              </>
                            )}
                            <option value="manual">Enter School SEMIS Code Manually...</option>
                          </select>
                        </div>

                        {parentIsManualSemis && (
                          <div className="mt-2">
                            <input
                              type="text"
                              value={parentTargetSemisCode}
                              onChange={(e) => setParentTargetSemisCode(e.target.value)}
                              placeholder="Enter 8-9 digit School SEMIS Code"
                              maxLength={12}
                              className="w-full px-3.5 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
                              required
                            />
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Child&apos;s GR Number <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={childGrNumber}
                            onChange={(e) => setChildGrNumber(e.target.value.toUpperCase())}
                            placeholder="e.g., GR-1001"
                            className="w-full px-3.5 py-2.5 text-sm font-mono uppercase rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Parent Invite Code (if provided by school)
                          </label>
                          <div className="relative">
                            <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={parentInviteCode}
                              onChange={(e) => setParentInviteCode(e.target.value.toUpperCase())}
                              placeholder="e.g., PKE-AB12CD"
                              className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono uppercase rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
                            />
                          </div>
                        </div>
                      </div>
                      <p className="text-[11px] text-indigo-800 dark:text-indigo-300 leading-snug">
                        Instant verification matches your email registered with the school, your Parent Invite Code, or your Guardian Phone number.
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Email Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {mode === 'signup' && accountIntent === 'sms'
                    ? smsRoleIntent === 'admin'
                      ? 'Admin Official Email (Login ID) *'
                      : 'Teacher Official Email (Login ID) *'
                    : mode === 'signup' && accountIntent === 'parent'
                    ? 'Parent Email Address (matches school record if pre-linked) *'
                    : 'Email Address *'}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="teacher@seld.gos.pk or Gmail address"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              {mode !== 'reset' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {mode === 'signup' ? 'Create Password (min. 6 characters) *' : 'Password *'}
                    </label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => setMode('reset')}
                        className="text-[11px] font-semibold text-[#5b21b6] dark:text-purple-400 hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        mode === 'signup'
                          ? 'Create password (min. 6 characters)'
                          : 'Enter your account password'
                      }
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
                      required
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-5 rounded-xl text-xs sm:text-sm font-semibold text-white shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                style={{
                  background: 'linear-gradient(135deg, #5b21b6 0%, #ec4899 100%)',
                }}
              >
                <KeyRound className="w-4 h-4" />
                <span>
                  {loading
                    ? 'Processing Authentication...'
                    : mode === 'signin'
                    ? 'Sign In to Portal & AtlierCV ID'
                    : mode === 'signup'
                    ? accountIntent === 'sms'
                      ? smsRoleIntent === 'admin'
                        ? 'Submit School Registration & Create Account'
                        : 'Submit Join Request & Create Account'
                      : accountIntent === 'parent'
                      ? 'Verify Child & Create Parent Account'
                      : 'Create Unified Account'
                    : 'Send Password Reset Email'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Success Banner */}
            {successMessage && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200">
                {successMessage}
              </div>
            )}

            {/* Diagnostic & Error Banner (Matches AtlierCV's smart diagnostics) */}
            {errorMessage && (
              <div className="mt-4 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 text-xs space-y-2.5">
                <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>

                {diagnosis?.isUnauthorizedDomain && (
                  <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-amber-200 dark:border-slate-700 text-[11px] text-slate-700 dark:text-slate-300 space-y-1.5">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      Firebase Console Domain Whitelist Steps:
                    </p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>
                        Open Firebase Console (Project:{' '}
                        <code className="font-mono font-bold">
                          {UNIFIED_FIREBASE_PROJECT_ID}
                        </code>
                        )
                      </li>
                      <li>
                        Go to{' '}
                        <strong>
                          Authentication → Settings → Authorized domains
                        </strong>
                      </li>
                      <li className="flex items-center justify-between gap-2 pt-1">
                        <span>
                          Add domain:{' '}
                          <code className="font-mono font-bold text-[#5b21b6] dark:text-pink-400">
                            {currentHostname}
                          </code>
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyHostname}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white font-semibold cursor-pointer"
                        >
                          {copiedHostname ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" /> Copy Domain
                            </>
                          )}
                        </button>
                      </li>
                    </ol>
                  </div>
                )}

                {diagnosis?.isProviderDisabled && (
                  <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-amber-200 dark:border-slate-700 text-[11px] text-slate-700 dark:text-slate-300 space-y-2">
                    <div className="font-semibold text-slate-900 dark:text-white flex items-center justify-between">
                      <span>Enable Email/Password in Firebase Console:</span>
                      <a
                        href={`https://console.firebase.google.com/project/${UNIFIED_FIREBASE_PROJECT_ID}/authentication/providers`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#5b21b6] dark:text-pink-400 hover:underline font-bold"
                      >
                        Open Console <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <p>
                      In Firebase Console (<code>{UNIFIED_FIREBASE_PROJECT_ID}</code>) →{' '}
                      <strong>Authentication → Sign-in method</strong>, click <strong>Email/Password</strong> and toggle <strong>Enable</strong>.
                    </p>
                  </div>
                )}

                {diagnosis?.shouldOfferDemoFallback && (
                  <button
                    type="button"
                    onClick={handleInstantFallbackSession}
                    className="w-full py-2 px-3 rounded-lg bg-[#5b21b6] hover:bg-[#4c1d95] text-white font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Continue with Instant Teacher Session (Offline-Ready Mode)
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
            <span>Unified Firebase Auth (`rising-safeguard-8bcxw`)</span>
            <button
              type="button"
              onClick={handleInstantFallbackSession}
              className="text-[#5b21b6] dark:text-pink-400 font-semibold hover:underline cursor-pointer"
            >
              🧪 Try Demo Mode (Sandbox) →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
