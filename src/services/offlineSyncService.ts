import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export type OfflineEntityType =
  | 'attendance'
  | 'feePayment'
  | 'feeStructure'
  | 'feeConcession'
  | 'student'
  | 'studentInvite'
  | 'parentLink'
  | 'studentLink'
  | 'class'
  | 'teacher'
  | 'exam'
  | 'marks'
  | 'timetable'
  | 'homework'
  | 'certificate'
  | 'salaryStructure'
  | 'payslip'
  | 'payrollSettings'
  | 'school'
  | 'schoolLogo'
  | 'joinRequest'
  | 'schoolRegistration'
  | 'globalNotice'
  | 'noticeRead'
  | 'lessonPlan'
  | 'schoolLessonPlan'
  | 'schoolQuestionPaper'
  | 'cvDocument';

export type OfflineSyncAction = 'upsert' | 'delete';
export type OfflineQueueStatus = 'pending' | 'syncing' | 'conflict' | 'failed';
export type ConflictResolutionChoice = 'keep-local' | 'keep-remote';

export interface OfflineSyncItem<T = Record<string, any>> {
  id: string;
  entityType: OfflineEntityType;
  action: OfflineSyncAction;
  operation: string;
  schoolId: string;
  userId?: string;
  docPath: string;
  recordId: string;
  recordLabel: string;
  payload: T;
  baseUpdatedAt?: string;
  baseSnapshot?: Record<string, any> | null;
  queuedAt: string;
  localUpdatedAt: string;
  status: OfflineQueueStatus;
  attempts: number;
  errorMessage?: string;
  lastAttemptAt?: string;
  remoteSnapshot?: Record<string, any> | null;
  remoteUpdatedAt?: string;
  conflictReason?: string;
}

export interface ServerBaselineRecord {
  docPath: string;
  updatedAt?: string;
  snapshot: Record<string, any>;
  cachedAt: string;
}

export interface SyncItemResult {
  id: string;
  recordId: string;
  recordLabel: string;
  entityType: OfflineEntityType;
  docPath: string;
  status: 'synced' | 'conflict' | 'failed';
  message: string;
}

export interface OfflineSyncRunSummary {
  startedAt: string;
  finishedAt: string;
  totalProcessed: number;
  syncedCount: number;
  conflictCount: number;
  failedCount: number;
  results: SyncItemResult[];
}

export interface EnqueueOfflineMutationInput<T = Record<string, any>> {
  entityType: OfflineEntityType;
  action: OfflineSyncAction;
  operation: string;
  schoolId: string;
  userId?: string;
  docPath: string;
  recordId: string;
  recordLabel: string;
  payload: T;
  baseUpdatedAt?: string;
  baseSnapshot?: Record<string, any> | null;
  preserveErrorOnRetry?: boolean;
}

interface PakEduOfflineSyncSchema extends DBSchema {
  sync_queue: {
    key: string;
    value: OfflineSyncItem;
    indexes: {
      'by-docPath': string;
      'by-status': OfflineQueueStatus;
      'by-schoolId': string;
      'by-queuedAt': string;
    };
  };
  server_baselines: {
    key: string;
    value: ServerBaselineRecord;
  };
}

const DB_NAME = 'pakedu_offline_sync_db';
const DB_VERSION = 1;
const STORE_QUEUE = 'sync_queue';
const STORE_BASELINES = 'server_baselines';

// SSR / Node test fallback storage
const memoryQueue = new Map<string, OfflineSyncItem>();
const memoryBaselines = new Map<string, ServerBaselineRecord>();

const listeners = new Set<() => void>();
let dbPromise: Promise<IDBPDatabase<PakEduOfflineSyncSchema>> | null = null;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

async function getDb(): Promise<IDBPDatabase<PakEduOfflineSyncSchema> | null> {
  if (!hasIndexedDb()) return null;
  if (!dbPromise) {
    dbPromise = openDB<PakEduOfflineSyncSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_QUEUE)) {
          const queueStore = db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
          queueStore.createIndex('by-docPath', 'docPath', { unique: false });
          queueStore.createIndex('by-status', 'status', { unique: false });
          queueStore.createIndex('by-schoolId', 'schoolId', { unique: false });
          queueStore.createIndex('by-queuedAt', 'queuedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_BASELINES)) {
          db.createObjectStore(STORE_BASELINES, { keyPath: 'docPath' });
        }
      },
    }).catch((err) => {
      console.warn('[OfflineSync] IndexedDB unavailable, falling back to memory queue:', err);
      dbPromise = null;
      throw err;
    });
  }
  try {
    return await dbPromise;
  } catch {
    return null;
  }
}

export function subscribeOfflineQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyOfflineQueueChanged(): void {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // Ignore subscriber errors
    }
  });
}

export function resetInMemoryOfflineStoreForTests(): void {
  memoryQueue.clear();
  memoryBaselines.clear();
}

export function normalizeTimestampValue(val: unknown): string | undefined {
  if (!val) return undefined;
  if (typeof val === 'string') return val.trim() || undefined;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'object' && typeof (val as any).toDate === 'function') {
    try {
      return (val as any).toDate().toISOString();
    } catch {
      return undefined;
    }
  }
  if (typeof val === 'object' && typeof (val as any).seconds === 'number') {
    return new Date((val as any).seconds * 1000).toISOString();
  }
  return undefined;
}

function isFirestoreSentinel(val: unknown): boolean {
  if (!val || typeof val !== 'object') return false;
  const proto = Object.getPrototypeOf(val);
  if (proto !== Object.prototype && proto !== null && !(val instanceof Date)) {
    return typeof (val as any)._methodName === 'string' || typeof (val as any).isEqual === 'function';
  }
  return false;
}

/**
 * Ensures any payload saved to IndexedDB or compared for conflicts contains only
 * structured-clone-safe plain values (no functions, no `undefined`, no FieldValue sentinels).
 */
export function prepareCloneableValue(val: unknown): any {
  if (val === undefined || typeof val === 'function' || typeof val === 'symbol') {
    return undefined;
  }
  if (val === null || typeof val !== 'object') {
    return val;
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  const normalizedTs = normalizeTimestampValue(val);
  if (normalizedTs && isFirestoreSentinel(val)) {
    return normalizedTs;
  }
  if (isFirestoreSentinel(val)) {
    return undefined;
  }
  if (Array.isArray(val)) {
    const arr: any[] = [];
    for (const item of val) {
      const cleaned = prepareCloneableValue(item);
      if (cleaned !== undefined) arr.push(cleaned);
    }
    return arr;
  }
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(val)) {
    const cleaned = prepareCloneableValue(v);
    if (cleaned !== undefined) {
      out[k] = cleaned;
    }
  }
  return out;
}

const VOLATILE_COMPARE_KEYS = new Set([
  'updatedAt',
  'createdAt',
  'markedAt',
  'lastSyncedAt',
]);

export function stripTimestampsForCompare(val: unknown): any {
  if (val === undefined || val === null || typeof val !== 'object') {
    return val;
  }
  if (val instanceof Date) {
    return undefined;
  }
  if (Array.isArray(val)) {
    return val.map((item) => stripTimestampsForCompare(item));
  }
  const normalizedTs = normalizeTimestampValue(val);
  if (normalizedTs && !(val instanceof Date) && typeof (val as any).toDate === 'function') {
    return normalizedTs;
  }
  const out: Record<string, any> = {};
  const keys = Object.keys(val).sort();
  for (const k of keys) {
    if (VOLATILE_COMPARE_KEYS.has(k)) continue;
    const raw = (val as Record<string, any>)[k];
    if (raw === undefined) continue;
    const cleaned = stripTimestampsForCompare(raw);
    if (cleaned !== undefined) {
      out[k] = cleaned;
    }
  }
  return out;
}

export function deepRecordsEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepRecordsEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const objA = a as Record<string, any>;
  const objB = b as Record<string, any>;
  const keysA = Object.keys(objA).filter((k) => objA[k] !== undefined);
  const keysB = Object.keys(objB).filter((k) => objB[k] !== undefined);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (!Object.prototype.hasOwnProperty.call(objB, k)) return false;
    if (!deepRecordsEqual(objA[k], objB[k])) return false;
  }
  return true;
}

function parseIsoMs(iso?: string): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

export interface ConflictDetectionInput {
  action: OfflineSyncAction;
  baseUpdatedAt?: string;
  baseSnapshot?: Record<string, any> | null;
  localPayload: Record<string, any>;
  remoteExists: boolean;
  remoteData?: Record<string, any> | null;
  remoteUpdatedAt?: string;
}

export interface ConflictDetectionResult {
  hasConflict: boolean;
  reason?: string;
}

/**
 * Determines whether the remote Firestore document diverged while the client was offline.
 */
export function detectOfflineConflict(input: ConflictDetectionInput): ConflictDetectionResult {
  const {
    action,
    baseUpdatedAt,
    baseSnapshot,
    localPayload,
    remoteExists,
    remoteData,
    remoteUpdatedAt,
  } = input;

  if (!remoteExists || !remoteData) {
    if (action === 'delete') {
      return { hasConflict: false };
    }
    if (baseUpdatedAt || baseSnapshot) {
      return {
        hasConflict: true,
        reason: 'This record was deleted or archived online while you were modifying it offline.',
      };
    }
    return { hasConflict: false };
  }

  const cleanLocal = stripTimestampsForCompare(prepareCloneableValue(localPayload) || {});
  const cleanRemote = stripTimestampsForCompare(prepareCloneableValue(remoteData) || {});

  // Idempotent upsert: server already matches our local version
  if (action === 'upsert' && deepRecordsEqual(cleanRemote, cleanLocal)) {
    return { hasConflict: false };
  }

  // Concurrent offline creation against an existing remote record with same key
  if (!baseUpdatedAt && !baseSnapshot) {
    return {
      hasConflict: true,
      reason: 'Another update for this record was saved online while you worked offline.',
    };
  }

  // Primary comparison against cached baseline snapshot (immune to clock skew)
  if (baseSnapshot) {
    const cleanBase = stripTimestampsForCompare(prepareCloneableValue(baseSnapshot) || {});
    if (!deepRecordsEqual(cleanRemote, cleanBase)) {
      return {
        hasConflict: true,
        reason:
          action === 'delete'
            ? 'This record was updated online while queued for offline deletion.'
            : 'This record was modified online while you were offline.',
      };
    }
    return { hasConflict: false };
  }

  // Timestamp fallback when only baseUpdatedAt is available
  const remoteMs = parseIsoMs(remoteUpdatedAt);
  const baseMs = parseIsoMs(baseUpdatedAt);
  if (remoteMs > 0 && baseMs > 0 && remoteMs > baseMs + 2000) {
    return {
      hasConflict: true,
      reason: `Remote version was updated at ${new Date(remoteMs).toLocaleString()} after your offline copy.`,
    };
  }

  if (remoteUpdatedAt && baseUpdatedAt && remoteUpdatedAt !== baseUpdatedAt && !deepRecordsEqual(cleanRemote, cleanLocal)) {
    return {
      hasConflict: true,
      reason: 'Remote version changed online while you were offline.',
    };
  }

  return { hasConflict: false };
}

export async function getOfflineQueue(): Promise<OfflineSyncItem[]> {
  const db = await getDb();
  let items: OfflineSyncItem[];
  if (db) {
    items = await db.getAll(STORE_QUEUE);
  } else {
    items = Array.from(memoryQueue.values());
  }
  return items.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
}

export async function getServerBaseline(docPath: string): Promise<ServerBaselineRecord | null> {
  if (!docPath) return null;
  const db = await getDb();
  if (db) {
    return (await db.get(STORE_BASELINES, docPath)) || null;
  }
  return memoryBaselines.get(docPath) || null;
}

export async function recordServerBaseline(
  docPath: string,
  snapshot: Record<string, any>,
  updatedAt?: unknown
): Promise<void> {
  if (!docPath || !snapshot) return;
  const cleanSnapshot = prepareCloneableValue(snapshot) || {};
  const record: ServerBaselineRecord = {
    docPath,
    updatedAt: normalizeTimestampValue(updatedAt) || normalizeTimestampValue(snapshot.updatedAt),
    snapshot: cleanSnapshot,
    cachedAt: new Date().toISOString(),
  };
  const db = await getDb();
  if (db) {
    await db.put(STORE_BASELINES, record);
  } else {
    memoryBaselines.set(docPath, record);
  }
}

export async function recordServerBaselinesBatch(
  entries: Array<{ docPath: string; snapshot: Record<string, any>; updatedAt?: unknown }>
): Promise<void> {
  if (!entries.length) return;
  const nowIso = new Date().toISOString();
  const db = await getDb();
  if (db) {
    const tx = db.transaction(STORE_BASELINES, 'readwrite');
    for (const entry of entries) {
      if (!entry.docPath || !entry.snapshot) continue;
      const cleanSnapshot = prepareCloneableValue(entry.snapshot) || {};
      await tx.store.put({
        docPath: entry.docPath,
        updatedAt:
          normalizeTimestampValue(entry.updatedAt) ||
          normalizeTimestampValue(entry.snapshot.updatedAt),
        snapshot: cleanSnapshot,
        cachedAt: nowIso,
      });
    }
    await tx.done;
    return;
  }
  for (const entry of entries) {
    if (!entry.docPath || !entry.snapshot) continue;
    memoryBaselines.set(entry.docPath, {
      docPath: entry.docPath,
      updatedAt:
        normalizeTimestampValue(entry.updatedAt) ||
        normalizeTimestampValue(entry.snapshot.updatedAt),
      snapshot: prepareCloneableValue(entry.snapshot) || {},
      cachedAt: nowIso,
    });
  }
}

export async function removeServerBaseline(docPath: string): Promise<void> {
  if (!docPath) return;
  const db = await getDb();
  if (db) {
    await db.delete(STORE_BASELINES, docPath);
  } else {
    memoryBaselines.delete(docPath);
  }
}

export async function enqueueOfflineMutation<T = Record<string, any>>(
  input: EnqueueOfflineMutationInput<T>
): Promise<OfflineSyncItem<T>> {
  const nowIso = new Date().toISOString();
  const cleanPayload = (prepareCloneableValue(input.payload) || {}) as T;
  const baselineFromDb = await getServerBaseline(input.docPath);

  const db = await getDb();
  const existingMatches = db
    ? await db.getAllFromIndex(STORE_QUEUE, 'by-docPath', input.docPath)
    : Array.from(memoryQueue.values()).filter((i) => i.docPath === input.docPath);

  const existingQueued = existingMatches.find((i) => i.status !== 'syncing');

  // Coalesce create-then-delete while offline cleanly (no cloud operation required)
  if (
    existingQueued &&
    input.action === 'delete' &&
    !existingQueued.baseUpdatedAt &&
    !existingQueued.baseSnapshot &&
    !baselineFromDb
  ) {
    if (db) {
      await db.delete(STORE_QUEUE, existingQueued.id);
    } else {
      memoryQueue.delete(existingQueued.id);
    }
    notifyOfflineQueueChanged();
    return {
      ...existingQueued,
      action: 'delete',
      payload: cleanPayload,
      localUpdatedAt: nowIso,
    } as OfflineSyncItem<T>;
  }

  const resolvedBaseUpdatedAt =
    existingQueued?.baseUpdatedAt ||
    normalizeTimestampValue(input.baseUpdatedAt) ||
    baselineFromDb?.updatedAt ||
    normalizeTimestampValue((input.baseSnapshot as any)?.updatedAt);

  const resolvedBaseSnapshot =
    existingQueued?.baseSnapshot !== undefined
      ? existingQueued.baseSnapshot
      : input.baseSnapshot !== undefined
      ? (prepareCloneableValue(input.baseSnapshot) as Record<string, any> | null)
      : baselineFromDb?.snapshot || null;

  const item: OfflineSyncItem<T> = {
    id:
      existingQueued?.id ||
      `sync_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
    entityType: input.entityType,
    action: input.action,
    operation: input.operation,
    schoolId: input.schoolId || 'global',
    userId: input.userId,
    docPath: input.docPath,
    recordId: input.recordId,
    recordLabel: input.recordLabel,
    payload: cleanPayload,
    baseUpdatedAt: resolvedBaseUpdatedAt,
    baseSnapshot: resolvedBaseSnapshot,
    queuedAt: existingQueued?.queuedAt || nowIso,
    localUpdatedAt: nowIso,
    status: 'pending',
    attempts: existingQueued?.attempts || 0,
    errorMessage: input.preserveErrorOnRetry ? existingQueued?.errorMessage : undefined,
    remoteSnapshot: undefined,
    remoteUpdatedAt: undefined,
    conflictReason: undefined,
  };

  if (db) {
    await db.put(STORE_QUEUE, item as OfflineSyncItem);
  } else {
    memoryQueue.set(item.id, item as OfflineSyncItem);
  }

  notifyOfflineQueueChanged();
  return item;
}

export async function updateOfflineQueueItem(
  id: string,
  patch: Partial<OfflineSyncItem>
): Promise<OfflineSyncItem | null> {
  const db = await getDb();
  const current = db ? await db.get(STORE_QUEUE, id) : memoryQueue.get(id);
  if (!current) return null;

  const cleanPatch = prepareCloneableValue(patch) || {};
  const next: OfflineSyncItem = {
    ...current,
    ...cleanPatch,
    id: current.id,
  };

  if (db) {
    await db.put(STORE_QUEUE, next);
  } else {
    memoryQueue.set(next.id, next);
  }
  notifyOfflineQueueChanged();
  return next;
}

export async function removeOfflineQueueItem(id: string): Promise<void> {
  const db = await getDb();
  if (db) {
    await db.delete(STORE_QUEUE, id);
  } else {
    memoryQueue.delete(id);
  }
  notifyOfflineQueueChanged();
}

export async function clearOfflineQueue(): Promise<void> {
  const db = await getDb();
  if (db) {
    await db.clear(STORE_QUEUE);
  } else {
    memoryQueue.clear();
  }
  notifyOfflineQueueChanged();
}

export interface ConflictFieldComparison {
  label: string;
  localValue: string;
  remoteValue: string;
  changed: boolean;
}

function fmtCurrency(n: unknown): string {
  const num = Number(n);
  return Number.isFinite(num) ? `Rs. ${num.toLocaleString()}` : '-';
}

/**
 * Formats side-by-side comparison fields for the conflict resolution UI.
 */
export function buildConflictComparisonFields(item: OfflineSyncItem): ConflictFieldComparison[] {
  const local = (item.payload || {}) as Record<string, any>;
  const remote = (item.remoteSnapshot || null) as Record<string, any> | null;

  if (!remote) {
    return [
      {
        label: 'Document State',
        localValue: item.action === 'delete' ? 'Marked for Deletion' : 'Modified Locally',
        remoteValue: 'Deleted / Missing on Server',
        changed: true,
      },
      {
        label: 'Last Modified',
        localValue: new Date(item.localUpdatedAt).toLocaleString(),
        remoteValue: 'Not present online',
        changed: true,
      },
    ];
  }

  const rows: ConflictFieldComparison[] = [];
  const pushRow = (label: string, lVal: unknown, rVal: unknown) => {
    const lStr = lVal === undefined || lVal === null || lVal === '' ? '—' : String(lVal);
    const rStr = rVal === undefined || rVal === null || rVal === '' ? '—' : String(rVal);
    rows.push({
      label,
      localValue: lStr,
      remoteValue: rStr,
      changed: lStr !== rStr,
    });
  };

  switch (item.entityType) {
    case 'attendance': {
      pushRow('Class & Date', `${local.grade || ''} ${local.section || ''} (${local.date || ''})`.trim(), `${remote.grade || ''} ${remote.section || ''} (${remote.date || ''})`.trim());
      pushRow('Present / Absent', `${local.summary?.present ?? 0} P / ${local.summary?.absent ?? 0} A`, `${remote.summary?.present ?? 0} P / ${remote.summary?.absent ?? 0} A`);
      pushRow('Attendance %', `${local.summary?.percentage ?? 0}%`, `${remote.summary?.percentage ?? 0}%`);
      pushRow('Marked By', local.markedByName || local.conductedBy, remote.markedByName || remote.conductedBy);
      break;
    }
    case 'feePayment': {
      pushRow('Student & Month', `${local.studentName || ''} (${local.monthLabel || local.month || ''})`, `${remote.studentName || ''} (${remote.monthLabel || remote.month || ''})`);
      pushRow('Status', String(local.status || '').toUpperCase(), String(remote.status || '').toUpperCase());
      pushRow('Paid Amount', fmtCurrency(local.paidAmount), fmtCurrency(remote.paidAmount));
      pushRow('Pending Balance', fmtCurrency(local.pendingBalance), fmtCurrency(remote.pendingBalance));
      pushRow('Payment Method', local.paymentMethod || 'Cash', remote.paymentMethod || 'Cash');
      pushRow('Receipt #', local.receiptNumber || '—', remote.receiptNumber || '—');
      break;
    }
    case 'student': {
      pushRow('Full Name', local.fullName, remote.fullName);
      pushRow('GR Number', local.grNumber, remote.grNumber);
      pushRow('Class & Section', `${local.grade || ''} ${local.section || ''}`.trim(), `${remote.grade || ''} ${remote.section || ''}`.trim());
      pushRow('Guardian Phone', local.guardianPhone, remote.guardianPhone);
      pushRow('Status', local.status, remote.status);
      pushRow('Advance Balance', fmtCurrency(local.advanceBalance || 0), fmtCurrency(remote.advanceBalance || 0));
      break;
    }
    case 'salaryStructure': {
      pushRow('Employee', local.employeeName, remote.employeeName);
      pushRow('Designation', local.designation, remote.designation);
      pushRow('Basic Salary', fmtCurrency(local.basicSalary || 0), fmtCurrency(remote.basicSalary || 0));
      pushRow('Total Allowances', fmtCurrency(local.totalAllowances || 0), fmtCurrency(remote.totalAllowances || 0));
      pushRow('Total Deductions', fmtCurrency(local.totalDeductions || 0), fmtCurrency(remote.totalDeductions || 0));
      pushRow('Net Salary', fmtCurrency(local.netSalary || 0), fmtCurrency(remote.netSalary || 0));
      break;
    }
    case 'payslip': {
      pushRow('Employee & Month', `${local.employeeName || ''} (${local.monthLabel || local.month || ''})`, `${remote.employeeName || ''} (${remote.monthLabel || remote.month || ''})`);
      pushRow('Status', String(local.status || '').toUpperCase(), String(remote.status || '').toUpperCase());
      pushRow('Basic Salary', fmtCurrency(local.basicSalary || 0), fmtCurrency(remote.basicSalary || 0));
      pushRow('Net Payable', fmtCurrency(local.netSalary || 0), fmtCurrency(remote.netSalary || 0));
      pushRow('Payment Method', local.paymentMethod || '—', remote.paymentMethod || '—');
      break;
    }
    case 'schoolLessonPlan': {
      pushRow('Class & Subject', `${local.grade || ''} - ${local.section || ''} · ${local.subject || ''}`, `${remote.grade || ''} - ${remote.section || ''} · ${remote.subject || ''}`);
      pushRow('Chapter / Topic', `${local.chapter || ''} · ${local.topic || ''}`, `${remote.chapter || ''} · ${remote.topic || ''}`);
      pushRow('Shared w/ Parents', local.sharedWithParents ? 'Shared' : 'Private', remote.sharedWithParents ? 'Shared' : 'Private');
      break;
    }
    case 'schoolQuestionPaper': {
      pushRow('Exam Reference', local.examTitle || local.examId || 'Standalone', remote.examTitle || remote.examId || 'Standalone');
      pushRow('Class & Subject', `${local.className || ''} · ${local.subject || ''}`, `${remote.className || ''} · ${remote.subject || ''}`);
      pushRow('Marks & Difficulty', `${local.totalMarks || 0} (${local.difficulty || ''})`, `${remote.totalMarks || 0} (${remote.difficulty || ''})`);
      pushRow('Attached', local.attachedToExam ? 'Yes' : 'No', remote.attachedToExam ? 'Yes' : 'No');
      break;
    }
    default: {
      const candidateKeys = Array.from(
        new Set([...Object.keys(local), ...Object.keys(remote)])
      ).filter((k) => !VOLATILE_COMPARE_KEYS.has(k) && k !== 'id' && k !== 'schoolId');
      for (const key of candidateKeys.slice(0, 6)) {
        const lRaw = typeof local[key] === 'object' ? JSON.stringify(local[key]) : local[key];
        const rRaw = typeof remote[key] === 'object' ? JSON.stringify(remote[key]) : remote[key];
        pushRow(key, lRaw, rRaw);
      }
      break;
    }
  }

  pushRow(
    'Last Updated',
    new Date(item.localUpdatedAt).toLocaleString(),
    item.remoteUpdatedAt ? new Date(item.remoteUpdatedAt).toLocaleString() : 'Unknown'
  );

  return rows;
}
