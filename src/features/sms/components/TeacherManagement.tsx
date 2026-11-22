import React, { useState } from 'react';
import {
  Users,
  UserCheck,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  GraduationCap,
  Sparkles,
  Phone,
  Mail,
  ShieldCheck,
  AlertCircle,
  X,
  Check,
} from 'lucide-react';
import { useSms } from '../context/SmsContext';
import { TeacherJoinRequest, TeacherInfo } from '../types';

export const TeacherManagement: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const {
    teachers,
    classes,
    pendingJoinRequests,
    approveJoinRequest,
    rejectJoinRequest,
    activeSchool,
  } = useSms();

  const [activeTab, setActiveTab] = useState<'roster' | 'requests'>('roster');
  const [selectedRequest, setSelectedRequest] = useState<TeacherJoinRequest | null>(null);

  // Approval Modal State
  const [assignedClassIds, setAssignedClassIds] = useState<string[]>([]);
  const [classTeacherForId, setClassTeacherForId] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const openApproveModal = (req: TeacherJoinRequest) => {
    setSelectedRequest(req);
    // Pre-select first class as default
    setAssignedClassIds(classes[0]?.id ? [classes[0].id] : []);
    setClassTeacherForId(classes[0]?.id || '');
  };

  const handleToggleClass = (classId: string) => {
    setAssignedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  const handleConfirmApproval = () => {
    if (!selectedRequest) return;

    approveJoinRequest(selectedRequest.id, assignedClassIds, classTeacherForId || undefined);
    setToastMessage(`Teacher "${selectedRequest.fullName}" has been approved and assigned.`);
    setSelectedRequest(null);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleReject = (req: TeacherJoinRequest) => {
    rejectJoinRequest(req.id);
    setToastMessage(`Request from "${req.fullName}" has been rejected.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              title="Return to SMS Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  Faculty &amp; Teacher Management (اساتذہ ڈائریکٹری)
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Staff Incharge
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {activeSchool.name} · SEMIS Code: <span className="font-mono">{activeSchool.semisCode}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold">
              Total Faculty: {teachers.length}
            </span>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 px-4 py-3 rounded-2xl flex items-center justify-between text-xs shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-medium">{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('roster')}
            className={`py-3.5 px-6 text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'roster'
                ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Active Faculty Roster ({teachers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`py-3.5 px-6 text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'requests'
                ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Pending Join Requests</span>
            {pendingJoinRequests.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                {pendingJoinRequests.length}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: ACTIVE FACULTY ROSTER */}
        {activeTab === 'roster' && (
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teachers.map((teacher) => {
                // Find classes where teacher is incharge
                const inchargeClasses = classes.filter((c) => c.classTeacherId === teacher.id);
                return (
                  <div
                    key={teacher.id}
                    className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-xl space-y-3 hover:border-indigo-300 dark:hover:border-indigo-700 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs">
                          {teacher.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-white text-xs">
                            {teacher.name}
                          </h3>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                            {teacher.designation}
                          </span>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        Active
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span className="truncate">{teacher.email}</span>
                      </div>
                      {teacher.phone && (
                        <div className="flex items-center gap-1.5 font-mono">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{teacher.phone}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-[10px] text-slate-400 block mb-1">
                        Assigned Class Incharge:
                      </span>
                      {inchargeClasses.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {inchargeClasses.map((c) => (
                            <span
                              key={c.id}
                              className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-semibold"
                            >
                              {c.grade} - {c.section}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">
                          No class assigned as incharge
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: PENDING JOIN REQUESTS */}
        {activeTab === 'requests' && (
          <div className="p-5">
            {pendingJoinRequests.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  No Pending Join Requests
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  All incoming teacher affiliation applications have been processed.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingJoinRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm shrink-0">
                        {req.fullName.charAt(0)}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 dark:text-white text-xs">
                            {req.fullName}
                          </h3>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            Pending Approval
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {req.designation} · CNIC: <span className="font-mono">{req.cnic || '—'}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-3 pt-0.5">
                          <span>Email: <strong>{req.email}</strong></span>
                          <span>Phone: <strong>{req.phone}</strong></span>
                          <span>Applied: <strong>{new Date(req.requestedAt).toLocaleDateString()}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => openApproveModal(req)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve &amp; Assign Class</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleReject(req)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-semibold transition cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Approve & Assign Class Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Approve Teacher &amp; Assign Classes
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Allocating teaching responsibilities for {selectedRequest.fullName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Teaching Class(es):
                </label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {classes.map((cls) => (
                    <label
                      key={cls.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={assignedClassIds.includes(cls.id)}
                          onChange={() => handleToggleClass(cls.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {cls.grade} - {cls.section}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">{cls.medium} Medium</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Designate as Primary Class Incharge (حاضری انچارج):
                </label>
                <select
                  value={classTeacherForId}
                  onChange={(e) => setClassTeacherForId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="">None (Subject Teacher only)</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.grade} - {c.section} (Currently: {c.classTeacherName})
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Assigning as Class Incharge gives this teacher permission to take daily roll call for that section.
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApproval}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                Confirm Approval &amp; Activate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
