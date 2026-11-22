import { getAuth, GoogleAuthProvider, signOut } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  setLogLevel,
  doc,
  getDocFromServer
} from 'firebase/firestore';
import { auth, googleProvider } from '../../../firebase';
import { getApp } from 'firebase/app';
import firebaseAppletConfig from '../../../../firebase-applet-config.json';
import { resolveFirebaseConfig } from './firebaseConfigResolver';

// Silence internal Firestore retry noise
setLogLevel('silent');

export const CV_FIRESTORE_DATABASE_ID =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_FIRESTORE_DATABASE_ID) ||
  'ai-studio-bfe80d53-2c6c-47c4-a6ba-3a0042829551';

const app = getApp();

// Initialize or get Firestore for CV Studio
let cvFirestoreDb;
try {
  cvFirestoreDb = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    },
    CV_FIRESTORE_DATABASE_ID
  );
} catch {
  // If already initialized for this database ID
  cvFirestoreDb = getFirestore(app, CV_FIRESTORE_DATABASE_ID);
}

export const db = cvFirestoreDb;
export { auth, googleProvider };

export const FALLBACK_AUTH_STORAGE_KEY = 'ateliercv_fallback_auth_user';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email
        })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
