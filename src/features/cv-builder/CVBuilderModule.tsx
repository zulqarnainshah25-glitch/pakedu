import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User } from 'firebase/auth';
import { auth } from '../../firebase';
import {
  ensureUserProfile,
  fetchUserCVs,
  saveCVToFirestore,
  deleteCVFromFirestore,
  fetchTemplatesFromFirestore,
  flushPendingSyncAndSave,
  incrementUserPdfExportCount,
  incrementUserWordExportCount,
  upgradeUserPlanToPremium,
  submitPaymentProof,
  fetchPaymentPlans,
  fetchPaymentAccounts,
  updateUserPlanAndQuota,
  subscribeToUserProfile,
  subscribeToTemplatesInFirestore,
  subscribeToPaymentPlans,
  subscribeToPaymentAccounts
} from './lib/firestoreService';
import {
  SEED_TEMPLATES,
  DEMO_ADMIN_USER,
  DEFAULT_PAYMENT_PLANS,
  DEFAULT_PAYMENT_ACCOUNTS,
  createEmptyCV,
  createSampleCV
} from './data/seedTemplates';
import {
  CVDocument,
  CVTemplate,
  SyncStatus,
  UserProfile,
  PaymentPlan,
  PaymentAccountsConfig,
  PlanTier
} from './types/cv';
import { DashboardView } from './components/DashboardView';
import { CVFormWorkspace } from './components/CVFormWorkspace';
import { PreviewEditorStudio } from './components/PreviewEditorStudio';
import { AdminPanel } from './components/AdminPanel';
import { AdminLoginModal } from './components/AdminLoginModal';
import { PaywallModal } from './components/PaywallModal';
import { WelcomeUpgradeModal } from './components/WelcomeUpgradeModal';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Shield,
  Sparkles,
  FileText,
  Eye,
  FolderOpen,
  Cloud,
  Check,
  RefreshCw,
  HelpCircle,
  Plus
} from 'lucide-react';
import {
  cleanCVDocumentText,
  stripSampleResidue,
  expandRawDutiesToProfessionalBullets,
  rewriteRawSummaryToEnglish
} from './lib/textSanitizer';

export type CVModuleTab = 'form' | 'preview' | 'dashboard' | 'admin';

interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'warning' | 'error';
}

const DRAFT_STORAGE_PREFIX = 'ateliercv_v5_draft_';
const CV_STORAGE_PREFIX = 'ateliercv_v5_cv_';

export interface CVBuilderModuleProps {
  currentUser: User | null;
  demoSession?: { uid: string; email: string; displayName: string } | null;
  initialTemplateId?: string;
  onRequestSignIn?: () => void;
}

export const CVBuilderModule: React.FC<CVBuilderModuleProps> = ({
  currentUser,
  demoSession,
  initialTemplateId,
  onRequestSignIn
}) => {
  const activeUid = currentUser?.uid || demoSession?.uid || 'pakedu_teacher';
  const activeEmail = currentUser?.email || demoSession?.email || 'teacher@pakedu.pk';
  const activeDisplayName =
    currentUser?.displayName || demoSession?.displayName || 'PakEdu Teacher';

  const [activeTab, setActiveTab] = useState<CVModuleTab>('form');
  const [templates, setTemplates] = useState<CVTemplate[]>(SEED_TEMPLATES);
  const [savedCVs, setSavedCVs] = useState<CVDocument[]>([]);
  const [currentCV, setCurrentCV] = useState<CVDocument>(() => {
    const empty = cleanCVDocumentText(createEmptyCV(activeUid));
    if (initialTemplateId) {
      empty.templateId = initialTemplateId;
    }
    empty.fullName = activeDisplayName !== 'PakEdu Teacher' ? activeDisplayName : '';
    empty.email = activeEmail !== 'teacher@pakedu.pk' ? activeEmail : '';
    return empty;
  });

  const [userProfile, setUserProfile] = useState<UserProfile>(() => ({
    uid: activeUid,
    email: activeEmail,
    displayName: activeDisplayName,
    role:
      activeEmail.toLowerCase().includes('zulqarnain') || activeEmail.toLowerCase().includes('admin')
        ? 'admin'
        : 'user',
    plan: 'unlimited',
    pdfExportsUsed: 0,
    wordExportsUsed: 0
  }));

  const [isBuildingAI, setIsBuildingAI] = useState(false);
  const [draftSavedTimestamp, setDraftSavedTimestamp] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);

  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallReason, setPaywallReason] = useState('');
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [activatedPlanCelebration, setActivatedPlanCelebration] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Admin Security State
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('ateliercv_admin_auth') === 'true';
    } catch {
      return false;
    }
  });
  const [adminLoginModalOpen, setAdminLoginModalOpen] = useState(false);

  const [paymentPlans, setPaymentPlans] = useState<PaymentPlan[]>(DEFAULT_PAYMENT_PLANS);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccountsConfig>(
    DEFAULT_PAYMENT_ACCOUNTS
  );

  const debounceTimerRef = useRef<number | null>(null);
  const dirtyForFirestoreRef = useRef<boolean>(false);
  const latestCVRef = useRef<CVDocument>(currentCV);
  latestCVRef.current = currentCV;

  const notify = useCallback(
    (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
      const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  // Load Templates and Firestore profile on mount or user switch
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const loadedTemplates = await fetchTemplatesFromFirestore();
        if (mounted && loadedTemplates.length > 0) {
          setTemplates(loadedTemplates);
        }
      } catch {
        // Use seed templates fallback
      }

      try {
        const profile = await ensureUserProfile(activeUid, activeEmail, activeDisplayName);
        if (mounted && profile) {
          setUserProfile(profile);
        }
      } catch {
        // Continue with local session profile
      }

      // Restore user's draft if existing
      const draftKey = `${DRAFT_STORAGE_PREFIX}${activeUid}`;
      try {
        const rawDraft = localStorage.getItem(draftKey);
        if (rawDraft) {
          const parsed = cleanCVDocumentText(JSON.parse(rawDraft) as CVDocument);
          if (mounted) {
            setCurrentCV({ ...parsed, userId: activeUid });
          }
        }
      } catch {
        // Ignore
      }

      // Load saved CVs from Firestore
      try {
        const userCVs = await fetchUserCVs(activeUid);
        if (mounted && userCVs.length > 0) {
          setSavedCVs(userCVs.map((d) => cleanCVDocumentText(d)));
        }
      } catch {
        // Offline
      }
    })();

    const unsubTemplates = subscribeToTemplatesInFirestore((liveTemplates) => {
      if (mounted) setTemplates(liveTemplates);
    });

    return () => {
      mounted = false;
      unsubTemplates();
    };
  }, [activeUid, activeEmail, activeDisplayName]);

  // If initialTemplateId changes, update current CV's template
  useEffect(() => {
    if (initialTemplateId) {
      setCurrentCV((prev) => ({ ...prev, templateId: initialTemplateId }));
    }
  }, [initialTemplateId]);

  // Debounced auto-save to localStorage
  const handleCVChange = useCallback(
    (updated: CVDocument) => {
      const cleaned = stripSampleResidue(updated);
      setCurrentCV(cleaned);
      latestCVRef.current = cleaned;
      dirtyForFirestoreRef.current = true;
      setSyncStatus('local-saved');

      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = window.setTimeout(() => {
        const uid = activeUid || 'guest';
        const draftKey = `${DRAFT_STORAGE_PREFIX}${uid}`;
        const cvStorageKey = `${CV_STORAGE_PREFIX}${cleaned.id}`;
        try {
          const serialized = JSON.stringify(cleanCVDocumentText(cleaned));
          localStorage.setItem(draftKey, serialized);
          localStorage.setItem(cvStorageKey, serialized);
          const timeStr = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
          setDraftSavedTimestamp(timeStr);
        } catch {
          // Ignore quota errors
        }
      }, 600);
    },
    [activeUid]
  );

  // Sync to Firestore
  const syncCurrentCVToDatabase = useCallback(async (): Promise<boolean> => {
    const cvToSync = cleanCVDocumentText(latestCVRef.current);
    const uid = activeUid || 'guest';

    try {
      const serialized = JSON.stringify(cvToSync);
      localStorage.setItem(`${DRAFT_STORAGE_PREFIX}${uid}`, serialized);
      localStorage.setItem(`${CV_STORAGE_PREFIX}${cvToSync.id}`, serialized);
    } catch {
      // Ignore
    }

    setSavedCVs((prev) => {
      const idx = prev.findIndex((item) => item.id === cvToSync.id);
      if (idx === -1) return [cvToSync, ...prev];
      const copy = [...prev];
      copy[idx] = cvToSync;
      return copy;
    });

    setSyncStatus('syncing');
    try {
      await saveCVToFirestore(cvToSync, uid);
      dirtyForFirestoreRef.current = false;
      setSyncStatus('synced');
      setLastSyncedTime(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
      return true;
    } catch {
      setSyncStatus('offline-queued');
      return false;
    }
  }, [activeUid]);

  // Periodic background Firestore sync every 10 seconds if dirty
  useEffect(() => {
    const interval = setInterval(() => {
      if (dirtyForFirestoreRef.current) {
        syncCurrentCVToDatabase().catch(() => {});
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [syncCurrentCVToDatabase]);

  const handleClearForm = () => {
    const fresh = cleanCVDocumentText(createEmptyCV(activeUid));
    if (activeDisplayName && activeDisplayName !== 'PakEdu Teacher') {
      fresh.fullName = activeDisplayName;
    }
    if (activeEmail && activeEmail !== 'teacher@pakedu.pk') {
      fresh.email = activeEmail;
    }
    setCurrentCV(fresh);
    latestCVRef.current = fresh;
    setDraftSavedTimestamp('');
    notify('CV Form clear ho gaya hai! Naya data enter karein.', 'success');
  };

  // AI Build CV with local rewriter fallback
  const handleBuildCV = async () => {
    setIsBuildingAI(true);
    const formOnlyCV: CVDocument = stripSampleResidue({
      ...currentCV,
      summary: '',
      skillGroups: [],
      experience: (currentCV.experience || []).map((exp) => ({
        ...exp,
        bullets: []
      }))
    });

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);

    try {
      const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const response = await fetch('/api/build-cv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ cv: formOnlyCV }),
        signal: controller.signal
      });
      window.clearTimeout(timeoutId);

      const result = await response.json();
      if (!response.ok || result.fallbackUsed) {
        const mergedFallback: CVDocument = cleanCVDocumentText({
          ...formOnlyCV,
          ...(result.data || {}),
          id: currentCV.id,
          userId: activeUid,
          templateId: currentCV.templateId,
          photoDataUrl: currentCV.photoDataUrl,
          isPolished: true
        });
        handleCVChange(mergedFallback);
        syncCurrentCVToDatabase().catch(() => {});
        notify(
          'Aap ke form data se executive English CV tayyar kar diya gaya hai!',
          'success'
        );
        setActiveTab('preview');
        return;
      }

      const polishedCV: CVDocument = cleanCVDocumentText({
        ...formOnlyCV,
        ...result.data,
        id: currentCV.id,
        userId: activeUid,
        templateId: currentCV.templateId,
        photoDataUrl: currentCV.photoDataUrl,
        isPolished: true
      });

      handleCVChange(polishedCV);
      syncCurrentCVToDatabase().catch(() => {});
      notify('AI ne aap ka CV professional English mein polish kar diya hai!', 'success');
      setActiveTab('preview');
    } catch {
      window.clearTimeout(timeoutId);
      // Client-side fallback
      const fallbackExp = formOnlyCV.experience.map((exp) => ({
        ...exp,
        bullets: expandRawDutiesToProfessionalBullets(
          exp.rawDescription,
          exp.role,
          exp.company
        )
      }));
      const fallbackCV: CVDocument = cleanCVDocumentText({
        ...formOnlyCV,
        summary: rewriteRawSummaryToEnglish(
          formOnlyCV.rawSummary,
          formOnlyCV.jobTitle,
          fallbackExp,
          formOnlyCV.skills
        ),
        experience: fallbackExp,
        isPolished: true
      });
      handleCVChange(fallbackCV);
      syncCurrentCVToDatabase().catch(() => {});
      notify('Aap ke data se editable CV preview generate kar diya gaya hai.', 'success');
      setActiveTab('preview');
    } finally {
      setIsBuildingAI(false);
    }
  };

  const handleRecordPdfExport = async () => {
    if (!userProfile) return;
    try {
      const nextCount = await incrementUserPdfExportCount(
        userProfile.uid,
        userProfile.pdfExportsUsed
      );
      setUserProfile({ ...userProfile, pdfExportsUsed: nextCount });
    } catch {
      setUserProfile({ ...userProfile, pdfExportsUsed: userProfile.pdfExportsUsed + 1 });
    }
  };

  const handleRecordWordExport = async () => {
    if (!userProfile) return;
    try {
      const nextCount = await incrementUserWordExportCount(
        userProfile.uid,
        userProfile.wordExportsUsed
      );
      setUserProfile({ ...userProfile, wordExportsUsed: nextCount });
    } catch {
      setUserProfile({ ...userProfile, wordExportsUsed: userProfile.wordExportsUsed + 1 });
    }
  };

  const handleSubmitPaymentProof = async (proof: any) => {
    try {
      await submitPaymentProof(proof);
      notify('Payment receipt submit ho gayi hai! Admin review ke baad plan activate ho jayega.', 'success');
    } catch {
      notify('Receipt save karne mein issue aya. Please retry karein.', 'error');
    }
  };

  const handleInstantActivatePlan = async (tier: PlanTier) => {
    if (!userProfile) return;
    try {
      await updateUserPlanAndQuota(userProfile.uid, tier);
      setUserProfile({ ...userProfile, plan: tier });
      notify(`Mubarak! ${tier.toUpperCase()} Plan activate ho gaya hai!`, 'success');
      setPaywallOpen(false);
    } catch {
      setUserProfile({ ...userProfile, plan: tier });
      notify(`${tier.toUpperCase()} Plan locally activated!`, 'success');
      setPaywallOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* =================================================================== */}
      {/* INTEGRATED SUB-NAVBAR HEADER FOR CV BUILDER MODULE                 */}
      {/* =================================================================== */}
      <div className="no-print bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left: Studio Branding & Active Status */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#7F1D1D] dark:bg-[#C2410C] text-white flex items-center justify-center shrink-0 shadow-sm">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                AtlierCV Studio
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#FEF2F2] text-[#7F1D1D] dark:bg-[#3F1014]/70 dark:text-[#FCA5A5] border border-[#FECACA]/60 dark:border-[#7F1D1D]/60">
                INTEGRATED
              </span>
            </div>
            <p className="text-xs text-[#57534E] dark:text-[#D6CCC2]">
              AI Professional Resume &amp; ATS CV Builder
            </p>
          </div>
        </div>

        {/* Center: Module Navigation Tabs */}
        <div className="flex items-center gap-1 bg-[#F3EFEA] dark:bg-[#2C1215]/90 p-1 rounded-xl border border-[#E7E0D4]/60 dark:border-[rgba(255,253,249,0.14)]">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'form'
                ? 'bg-[#FFFDF9] dark:bg-[#3F1014] text-[#7F1D1D] dark:text-[#FAF8F5] shadow-xs font-semibold'
                : 'text-[#57534E] dark:text-[#E7E0D4] hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-[#7F1D1D]" />
            <span>1. CV Form</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'preview'
                ? 'bg-[#FFFDF9] dark:bg-[#3F1014] text-[#7F1D1D] dark:text-[#FAF8F5] shadow-xs font-semibold'
                : 'text-[#57534E] dark:text-[#E7E0D4] hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-[#7F1D1D]" />
            <span>2. Live Editor &amp; Export</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-[#FFFDF9] dark:bg-[#3F1014] text-[#7F1D1D] dark:text-[#FAF8F5] shadow-xs font-semibold'
                : 'text-[#57534E] dark:text-[#E7E0D4] hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5 text-emerald-600" />
            <span>My CVs ({savedCVs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (isAdminLoggedIn) {
                setActiveTab('admin');
              } else {
                setAdminLoginModalOpen(true);
              }
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-[#FFFDF9] dark:bg-[#3F1014] text-[#7F1D1D] dark:text-[#FAF8F5] shadow-xs font-semibold'
                : 'text-[#57534E] hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
            }`}
            title="Admin Governance Panel"
          >
            <Shield className="w-3.5 h-3.5 text-[#78716C]" />
            <span className="hidden sm:inline">Admin</span>
          </button>
        </div>

        {/* Right: Quick Plan & Sync Status Badges */}
        <div className="flex items-center gap-2">
          {syncStatus === 'syncing' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Syncing...</span>
            </span>
          )}

          {syncStatus === 'synced' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg">
              <Cloud className="w-3 h-3 text-emerald-600" />
              <span>Cloud Synced</span>
            </span>
          )}

          {userProfile?.plan === 'free' ? (
            <button
              type="button"
              onClick={() => {
                setPaywallReason('Tamam 6 templates aur unlimited downloads unlock karein.');
                setPaywallOpen(true);
              }}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/80 dark:text-amber-200 px-3 py-1 rounded-lg cursor-pointer transition-colors"
            >
              <Sparkles className="w-3 h-3 text-amber-600" />
              <span>Upgrade Plan</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 dark:bg-emerald-950/80 dark:text-emerald-300 px-3 py-1 rounded-lg capitalize">
              <Check className="w-3 h-3 text-emerald-600" />
              <span>{userProfile?.plan || 'Pro'}</span>
            </span>
          )}
        </div>
      </div>

      {/* Real-Time Plan Activation Celebration Banner */}
      {activatedPlanCelebration && (
        <div className="no-print bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
            <span>{activatedPlanCelebration}</span>
          </div>
          <button
            type="button"
            onClick={() => setActivatedPlanCelebration(null)}
            className="p-1 hover:bg-[#FFFDF9]/20 rounded-md text-white transition-colors cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* ACTIVE WORKSPACE VIEW                                               */}
      {/* =================================================================== */}
      {activeTab === 'form' && (
        <CVFormWorkspace
          cv={currentCV}
          templates={templates}
          isPremiumUser={userProfile?.plan !== 'free'}
          isBuildingAI={isBuildingAI}
          draftSavedTimestamp={draftSavedTimestamp}
          onChangeCV={handleCVChange}
          onLoadSampleData={() => {
            const sample = createSampleCV(activeUid);
            sample.id = currentCV.id;
            handleCVChange(sample);
            notify('Sample career data loaded into CV form.', 'success');
          }}
          onClearForm={handleClearForm}
          onBuildCV={handleBuildCV}
          onOpenPaywall={(reason) => {
            setPaywallReason(reason);
            setPaywallOpen(true);
          }}
        />
      )}

      {activeTab === 'preview' && (
        <PreviewEditorStudio
          cv={currentCV}
          templates={templates}
          user={userProfile}
          syncStatus={syncStatus}
          lastSyncedTime={lastSyncedTime}
          onChangeCV={handleCVChange}
          onBlurSync={() => {
            syncCurrentCVToDatabase();
          }}
          onManualSaveChanges={syncCurrentCVToDatabase}
          onBackToForm={() => setActiveTab('form')}
          onOpenPaywall={(reason) => {
            setPaywallReason(reason);
            setPaywallOpen(true);
          }}
          onRecordPdfExport={handleRecordPdfExport}
          onRecordWordExport={handleRecordWordExport}
          onNotify={notify}
        />
      )}

      {activeTab === 'dashboard' && (
        <DashboardView
          user={userProfile}
          cvs={savedCVs}
          templates={templates}
          onCreateNewCV={() => {
            const fresh = cleanCVDocumentText(createEmptyCV(activeUid));
            fresh.fullName = activeDisplayName !== 'PakEdu Teacher' ? activeDisplayName : '';
            fresh.email = activeEmail !== 'teacher@pakedu.pk' ? activeEmail : '';
            setCurrentCV(fresh);
            handleCVChange(fresh);
            setActiveTab('form');
            notify('New blank CV initialized.', 'success');
          }}
          onEditCV={(cv: CVDocument, openInPreview: boolean) => {
            setCurrentCV(cv);
            handleCVChange(cv);
            setActiveTab(openInPreview ? 'preview' : 'form');
            notify(`Loaded "${cv.title}".`, 'success');
          }}
          onDuplicateCV={async (cv: CVDocument) => {
            const dup = {
              ...cv,
              id: `cv_${Date.now()}_copy`,
              title: `${cv.title} (Copy)`
            };
            setSavedCVs((prev) => [dup, ...prev]);
            try {
              await saveCVToFirestore(dup, activeUid);
            } catch {
              // Local save
            }
            notify(`Duplicated "${cv.title}".`, 'success');
          }}
          onDeleteCV={async (cvId: string) => {
            setSavedCVs((prev) => prev.filter((item) => item.id !== cvId));
            try {
              await deleteCVFromFirestore(cvId);
            } catch {
              // Ignore
            }
            notify('CV deleted.', 'success');
          }}
          onOpenPaywall={(reason: string) => {
            setPaywallReason(reason);
            setPaywallOpen(true);
          }}
        />
      )}

      {activeTab === 'admin' && (
        <AdminPanel
          currentUser={userProfile}
          templates={templates}
          userCVs={savedCVs}
          onRefreshTemplates={async () => {
            try {
              const loaded = await fetchTemplatesFromFirestore();
              setTemplates(loaded);
            } catch {
              // Ignore
            }
          }}
          onNotify={notify}
          onExitAdminSession={() => {
            setIsAdminLoggedIn(false);
            try {
              sessionStorage.removeItem('ateliercv_admin_auth');
            } catch {
              // Ignore
            }
            setActiveTab('form');
          }}
        />
      )}

      {/* Paywall Modal */}
      {userProfile && (
        <PaywallModal
          isOpen={paywallOpen}
          reason={paywallReason}
          userId={userProfile.uid}
          userEmail={userProfile.email}
          userName={userProfile.displayName}
          currentPlan={userProfile.plan}
          plans={paymentPlans}
          paymentAccounts={paymentAccounts}
          onClose={() => setPaywallOpen(false)}
          onSubmitPaymentProof={handleSubmitPaymentProof}
          onInstantActivatePlan={handleInstantActivatePlan}
        />
      )}

      {/* Welcome Upgrade Modal */}
      {userProfile && (
        <WelcomeUpgradeModal
          isOpen={showWelcomeModal}
          userName={userProfile.displayName}
          userEmail={userProfile.email}
          plan={userProfile.plan}
          onClose={() => setShowWelcomeModal(false)}
          onOpenPlans={() => {
            setPaywallReason('Tamam 6 templates aur high download limits unlock karein.');
            setPaywallOpen(true);
          }}
        />
      )}

      {/* Admin Login Modal */}
      <AdminLoginModal
        isOpen={adminLoginModalOpen}
        onClose={() => setAdminLoginModalOpen(false)}
        onSuccess={() => {
          setIsAdminLoggedIn(true);
          try {
            sessionStorage.setItem('ateliercv_admin_auth', 'true');
          } catch {
            // ignore
          }
          setActiveTab('admin');
          notify('Admin authentication successful! Governance panel active.', 'success');
        }}
      />

      {/* Floating Toast Notifications */}
      <div className="no-print fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-medium transition-all ${
              t.type === 'success'
                ? 'bg-[#2C1215] text-white border-[rgba(255,253,249,0.14)]'
                : t.type === 'warning'
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : 'bg-red-50 text-red-900 border-red-300'
            }`}
          >
            {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {t.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
            {t.type === 'error' && <XCircle className="w-4 h-4 text-red-600 shrink-0" />}
            <span className="flex-1">{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
