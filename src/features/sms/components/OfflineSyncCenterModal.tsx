import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  CloudOff,
  Database,
  Loader2,
  RefreshCw,
  Trash2,
  Wifi,
  WifiOff,
  X,
  XCircle,
} from 'lucide-react';
import {
  buildConflictComparisonFields,
  type ConflictResolutionChoice,
  type OfflineEntityType,
  type OfflineSyncItem,
  type OfflineSyncRunSummary,
} from '../../../services/offlineSyncService';

interface OfflineSyncCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOnline: boolean;
  offlineQueue: OfflineSyncItem[];
  isSyncing: boolean;
  lastSyncSummary: OfflineSyncRunSummary | null;
  lastSyncedAt: string | null;
  onSyncNow: () => Promise<OfflineSyncRunSummary>;
  onResolveConflict: (queueItemId: string, choice: ConflictResolutionChoice) => Promise<boolean>;
  onDiscardItem: (queueItemId: string) => Promise<void>;
  onClearSummary: () => void;
}

const ENTITY_LABELS: Record<OfflineEntityType, string> = {
  attendance: 'Attendance',
  feePayment: 'Fee Payment',
  feeStructure: 'Fee Structure',
  feeConcession: 'Fee Concession',
  student: 'Student Record',
  studentInvite: 'Student Invite',
  parentLink: 'Parent Link',
  studentLink: 'Student Portal Link',
  class: 'Class / Section',
  teacher: 'Faculty Profile',
  exam: 'Exam Setup',
  marks: 'Exam Marks',
  timetable: 'Timetable',
  homework: 'Homework Diary',
  certificate: 'Certificate',
  salaryStructure: 'Salary Structure',
  payslip: 'Employee Payslip',
  payrollSettings: 'Payroll Settings',
  school: 'School Record',
  schoolLogo: 'School Logo',
  joinRequest: 'Faculty Request',
  schoolRegistration: 'School Registration',
  globalNotice: 'Notice Board',
  noticeRead: 'Notice Read',
  lessonPlan: 'Lesson Plan',
  schoolLessonPlan: 'Class Lesson Plan',
  schoolQuestionPaper: 'AI Question Paper',
  cvDocument: 'CV Document',
};

export const OfflineSyncCenterModal: React.FC<OfflineSyncCenterModalProps> = ({
  isOpen,
  onClose,
  isOnline,
  offlineQueue,
  isSyncing,
  lastSyncSummary,
  lastSyncedAt,
  onSyncNow,
  onResolveConflict,
  onDiscardItem,
  onClearSummary,
}) => {
  const [resolvingKey, setResolvingKey] = useState<string | null>(null);
  const [offlineClickNotice, setOfflineClickNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const conflictItems = offlineQueue.filter((item) => item.status === 'conflict');
  const pendingOrFailedItems = offlineQueue.filter((item) => item.status !== 'conflict');
  const failedCount = offlineQueue.filter((item) => item.status === 'failed').length;

  const handleManualSync = async () => {
    setOfflineClickNotice(null);
    if (!isOnline || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
      setOfflineClickNotice(
        'Still offline. Connect to Wi-Fi or mobile data and click "Sync Now" again.'
      );
      return;
    }
    await onSyncNow();
  };

  const handleResolve = async (itemId: string, choice: ConflictResolutionChoice) => {
    setResolvingKey(`${itemId}:${choice}`);
    try {
      await onResolveConflict(itemId, choice);
    } finally {
      setResolvingKey(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] bg-[#2C1215]/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Offline Sync & Conflict Resolution Center"
    >
      <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.16)] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-[#1C1917] dark:text-[#FAF8F5]">
        {/* Header */}
        <div className="bg-[#2C1215] text-[#FAF8F5] px-5 py-4 flex items-center justify-between gap-3 border-b border-[rgba(255,253,249,0.12)]">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                !isOnline
                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                  : conflictItems.length > 0
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-[#C2410C]/25 text-[#FED7AA] border border-[#C2410C]/40'
              }`}
            >
              {isOnline ? <Cloud className="w-5 h-5" /> : <CloudOff className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold truncate">
                Offline Sync Center (IndexedDB Queue)
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#D6CCC2] mt-0.5">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    isOnline
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-red-500/25 text-red-200 border border-red-400/50'
                  }`}
                >
                  {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                  {isOnline ? 'Online' : 'Offline'}
                </span>
                <span>{offlineQueue.length} queued item(s)</span>
                {lastSyncedAt && (
                  <span className="hidden sm:inline">
                    · Last sync: {new Date(lastSyncedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#D6CCC2] hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer shrink-0"
            aria-label="Close Sync Center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Action Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#2C1215]/70 border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.12)]">
            <div className="flex items-center gap-2.5 text-xs">
              <Database className="w-4 h-4 text-[#C2410C] shrink-0" />
              <span className="text-[#44403C] dark:text-[#E7E0D4]">
                {offlineQueue.length === 0
                  ? 'All local records are synced with Firestore.'
                  : `${pendingOrFailedItems.length} waiting · ${conflictItems.length} conflict(s) · ${failedCount} failed`}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {lastSyncSummary && (
                <button
                  type="button"
                  onClick={onClearSummary}
                  className="px-3 py-2 text-xs font-semibold text-[#57534E] dark:text-[#D6CCC2] hover:bg-[#E7E0D4]/60 dark:hover:bg-white/10 rounded-xl transition cursor-pointer"
                >
                  Clear Log
                </button>
              )}
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncing || offlineQueue.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#C2410C] hover:bg-[#9A3412] disabled:opacity-50 text-[#FFFDF9] text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                {isSyncing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span>{isSyncing ? 'Syncing Queue...' : 'Sync Now'}</span>
              </button>
            </div>
          </div>

          {offlineClickNotice && (
            <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/50 border border-orange-300 dark:border-orange-700 text-xs font-medium text-orange-900 dark:text-orange-200 flex items-center gap-2">
              <WifiOff className="w-4 h-4 shrink-0 text-orange-600 dark:text-orange-400" />
              <span>{offlineClickNotice}</span>
            </div>
          )}

          {/* Sync Run Results (Per-Item Success/Failure Report) */}
          {lastSyncSummary && lastSyncSummary.results.length > 0 && (
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#57534E] dark:text-[#D6CCC2]">
                  Latest Sync Report ({lastSyncSummary.syncedCount} synced, {lastSyncSummary.conflictCount} conflicts, {lastSyncSummary.failedCount} failed)
                </h3>
                <span className="text-[11px] text-[#78716C]">
                  {new Date(lastSyncSummary.finishedAt).toLocaleTimeString()}
                </span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {lastSyncSummary.results.map((res) => (
                  <div
                    key={`${res.id}_${res.status}`}
                    className={`p-2.5 rounded-xl border text-xs flex items-start justify-between gap-3 ${
                      res.status === 'synced'
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
                        : res.status === 'conflict'
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
                        : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
                    }`}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      {res.status === 'synced' ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                      ) : res.status === 'conflict' ? (
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{res.recordLabel}</div>
                        <div className="text-[11px] opacity-85">{res.message}</div>
                      </div>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-white/70 dark:bg-black/20">
                      {res.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Conflict Resolution Cards */}
          {conflictItems.length > 0 && (
            <section className="space-y-3">
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-700 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-900 dark:text-rose-200">
                  <div className="font-bold text-sm">
                    Sync Conflict Detected ({conflictItems.length})
                  </div>
                  <p className="mt-0.5">
                    The following record(s) were modified online while you were offline. Review both versions below and choose which version to keep.
                  </p>
                </div>
              </div>

              {conflictItems.map((item) => {
                const comparisons = buildConflictComparisonFields(item);
                const busyLocal = resolvingKey === `${item.id}:keep-local`;
                const busyRemote = resolvingKey === `${item.id}:keep-remote`;
                const busyAny = resolvingKey?.startsWith(`${item.id}:`);

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border-2 border-amber-300 dark:border-amber-700 bg-[#FFFDF9] dark:bg-[#2C1215]/90 p-4 space-y-3.5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 mr-2">
                          {ENTITY_LABELS[item.entityType] || item.entityType}
                        </span>
                        <span className="font-bold text-sm">{item.recordLabel}</span>
                      </div>
                      <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                        {item.conflictReason || 'Modified both offline and online'}
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.12)]">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-[#F3EFEA] dark:bg-[#3F1014] text-[#44403C] dark:text-[#E7E0D4] uppercase text-[10px] font-bold">
                          <tr>
                            <th className="px-3 py-2">Field</th>
                            <th className="px-3 py-2">Your Offline Version (Local)</th>
                            <th className="px-3 py-2">Server Version (Online)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E7E0D4] dark:divide-[rgba(255,253,249,0.10)]">
                          {comparisons.map((row) => (
                            <tr
                              key={row.label}
                              className={row.changed ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}
                            >
                              <td className="px-3 py-2 font-semibold text-[#57534E] dark:text-[#D6CCC2]">
                                {row.label}
                              </td>
                              <td className="px-3 py-2 font-medium text-[#1C1917] dark:text-[#FAF8F5]">
                                {row.localValue}
                              </td>
                              <td className="px-3 py-2 font-medium text-[#7F1D1D] dark:text-[#FCA5A5]">
                                {row.remoteValue}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
                      <button
                        type="button"
                        disabled={Boolean(busyAny)}
                        onClick={() => handleResolve(item.id, 'keep-remote')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.20)] bg-[#2C1215] hover:bg-[#58181D] text-[#FAF8F5] text-xs font-bold transition cursor-pointer disabled:opacity-50"
                      >
                        {busyRemote && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>Keep Online Version</span>
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(busyAny)}
                        onClick={() => handleResolve(item.id, 'keep-local')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#C2410C] hover:bg-[#9A3412] text-[#FFFDF9] text-xs font-bold transition cursor-pointer disabled:opacity-50"
                      >
                        {busyLocal && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>Keep Local Version (Overwrite Online)</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {/* Queued Items List */}
          <section className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#57534E] dark:text-[#D6CCC2]">
              Queued Local Mutations ({pendingOrFailedItems.length})
            </h3>
            {pendingOrFailedItems.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-[#E7E0D4] dark:border-[rgba(255,253,249,0.16)] text-center text-xs text-[#78716C] dark:text-[#D6CCC2]">
                {conflictItems.length > 0
                  ? 'No other pending items. Resolve the conflict(s) above to finish syncing.'
                  : 'No pending local changes in the IndexedDB queue.'}
              </div>
            ) : (
              <div className="space-y-2">
                {pendingOrFailedItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.12)] bg-[#FAF8F5] dark:bg-[#2C1215]/60 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-[#7F1D1D]/15 text-[#7F1D1D] dark:text-[#FCA5A5] border border-[#7F1D1D]/30">
                          {ENTITY_LABELS[item.entityType] || item.entityType}
                        </span>
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded bg-[#E7E0D4] dark:bg-white/10 text-[#44403C] dark:text-[#E7E0D4]">
                          {item.action}
                        </span>
                        <span className="font-bold text-sm truncate">{item.recordLabel}</span>
                      </div>
                      <div className="text-[11px] text-[#78716C] dark:text-[#D6CCC2]">
                        Saved locally: {new Date(item.localUpdatedAt).toLocaleString()}
                        {item.attempts > 0 ? ` · Attempts: ${item.attempts}` : ''}
                      </div>
                      {item.errorMessage && (
                        <div className="text-[11px] font-medium text-red-700 dark:text-red-300">
                          Last error: {item.errorMessage}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                          item.status === 'syncing'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                            : item.status === 'failed'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200'
                            : 'bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-200'
                        }`}
                      >
                        {item.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => void onDiscardItem(item.id)}
                        disabled={isSyncing}
                        className="p-1.5 text-[#78716C] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition cursor-pointer disabled:opacity-40"
                        title="Discard queued change"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
