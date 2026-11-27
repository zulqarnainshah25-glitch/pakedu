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
  Edit2,
  Key,
  Award,
  Calendar,
  Search,
  FileText,
} from 'lucide-react';
import { useSms } from '../context/SmsContext';
import { TeacherJoinRequest, TeacherInfo } from '../types';
import { AppointmentLetterModal } from './AppointmentLetterModal';

export const TeacherManagement: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const {
    teachers,
    classes,
    pendingJoinRequests,
    approveJoinRequest,
    rejectJoinRequest,
    updateTeacherProfile,
    toggleAdmissionIncharge,
    activeSchool,
  } = useSms();

  const [activeTab, setActiveTab] = useState<'roster' | 'profiles' | 'requests'>('roster');
  const [selectedRequest, setSelectedRequest] = useState<TeacherJoinRequest | null>(null);
  const [teacherSearch, setTeacherSearch] = useState('');

  // Approval Modal State
  const [assignedClassIds, setAssignedClassIds] = useState<string[]>([]);
  const [classTeacherForId, setClassTeacherForId] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Edit Teacher Profile Modal State
  const [editingTeacher, setEditingTeacher] = useState<TeacherInfo | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCnic, setEditCnic] = useState('');
  const [editJoiningDate, setEditJoiningDate] = useState('');
  const [editIsAdmissionIncharge, setEditIsAdmissionIncharge] = useState(false);
  const [letterTeacher, setLetterTeacher] = useState<TeacherInfo | null>(null);

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

  // Open Edit Profile Modal
  const openEditProfile = (t: TeacherInfo) => {
    setEditingTeacher(t);
    setEditName(t.name);
    setEditDesignation(t.designation);
    setEditPhone(t.phone || '');
    setEditCnic(t.cnic || '');
    setEditJoiningDate(t.joiningDate || '2023-08-15');
    setEditIsAdmissionIncharge(!!t.isAdmissionIncharge);
  };

  const handleSaveTeacherProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;

    updateTeacherProfile(editingTeacher.id, {
      name: editName.trim(),
      designation: editDesignation.trim(),
      phone: editPhone.trim(),
      cnic: editCnic.trim(),
      joiningDate: editJoiningDate,
      isAdmissionIncharge: editIsAdmissionIncharge,
    });

    setToastMessage(`Profile for "${editName}" updated successfully.`);
    setEditingTeacher(null);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleToggleIncharge = (t: TeacherInfo) => {
    toggleAdmissionIncharge(t.id);
    const updatedStatus = !t.isAdmissionIncharge;
    setToastMessage(
      updatedStatus
        ? `"${t.name}" designated as Official Admission Incharge (مجاز داخلہ انچارج).`
        : `Admission Incharge privileges revoked for "${t.name}".`
    );
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Filtered teachers for profiles tab
  const filteredTeachers = teachers.filter((t) => {
    const q = teacherSearch.toLowerCase().trim();
    return (
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.designation.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q) ||
      (t.cnic && t.cnic.includes(q)) ||
      (t.phone && t.phone.includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="p-2 text-[#78716C] hover:text-[#57534E] dark:hover:text-[#FAF8F5] hover:bg-[#F3EFEA] dark:hover:bg-[#3F1014] rounded-xl transition cursor-pointer"
              title="Return to SMS Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                  Faculty &amp; Teacher Management (اساتذہ ڈائریکٹری)
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FEF2F2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5] border border-[#FECACA] dark:border-[#7F1D1D]/60">
                  Staff Incharge
                </span>
              </div>
              <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-0.5">
                {activeSchool.name} · SEMIS Code: <span className="font-mono">{activeSchool.semisCode}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-[#F3EFEA] dark:bg-[#2C1215] text-[#57534E] dark:text-[#E7E0D4] text-xs font-semibold">
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
      <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl overflow-hidden shadow-sm">
        <div className="flex border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('roster')}
            className={`py-3.5 px-5 sm:px-6 text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'roster'
                ? 'border-b-2 border-[#7F1D1D] text-[#7F1D1D] dark:text-[#FCA5A5] bg-[#FEF2F2]/40 dark:bg-[#3F1014]/20'
                : 'text-[#57534E] hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Active Faculty Roster ({teachers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('profiles')}
            className={`py-3.5 px-5 sm:px-6 text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'profiles'
                ? 'border-b-2 border-[#7F1D1D] text-[#7F1D1D] dark:text-[#FCA5A5] bg-[#FEF2F2]/40 dark:bg-[#3F1014]/20'
                : 'text-[#57534E] hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Teacher Profiles &amp; Institutional Roles</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`py-3.5 px-5 sm:px-6 text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'requests'
                ? 'border-b-2 border-[#7F1D1D] text-[#7F1D1D] dark:text-[#FCA5A5] bg-[#FEF2F2]/40 dark:bg-[#3F1014]/20'
                : 'text-[#57534E] hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
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
                    className="p-4 bg-[#FAF8F5] dark:bg-[#2C1215]/60 border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-xl space-y-3 hover:border-[#7F1D1D] dark:hover:border-[#C2410C] transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#FEE2E2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5] flex items-center justify-center font-bold text-xs">
                          {teacher.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-bold text-[#1C1917] dark:text-[#FAF8F5] text-xs">
                            {teacher.name}
                          </h3>
                          <span className="text-[10px] text-[#57534E] dark:text-[#D6CCC2] block">
                            {teacher.designation}
                          </span>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        Active
                      </span>
                    </div>

                    <div className="text-[11px] text-[#57534E] dark:text-[#D6CCC2] space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3 text-[#78716C]" />
                        <span className="truncate">{teacher.email}</span>
                      </div>
                      {teacher.phone && (
                        <div className="flex items-center gap-1.5 font-mono">
                          <Phone className="w-3 h-3 text-[#78716C]" />
                          <span>{teacher.phone}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-[#E7E0D4]/60 dark:border-[rgba(255,253,249,0.14)]">
                      <span className="text-[10px] text-[#78716C] block mb-1">
                        Assigned Class Incharge:
                      </span>
                      {inchargeClasses.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {inchargeClasses.map((c) => (
                            <span
                              key={c.id}
                              className="px-2 py-0.5 rounded-lg bg-[#FEF2F2] dark:bg-[#3F1014]/50 text-[#7F1D1D] dark:text-[#FCA5A5] border border-[#FECACA] dark:border-[#7F1D1D]/60 text-[10px] font-semibold"
                            >
                              {c.grade} - {c.section}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-[#78716C] italic">
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

        {/* TAB 2: TEACHER PROFILES & INSTITUTIONAL ROLES */}
        {activeTab === 'profiles' && (
          <div className="p-5 space-y-4">
            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by teacher name, designation, CNIC, or phone..."
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5] placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#7F1D1D]"
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-[#57534E] dark:text-[#D6CCC2]">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Admin Delegation: Assigning <strong>Admission Incharge</strong> allows the teacher to admit and edit students.</span>
              </div>
            </div>

            {/* Teacher Profiles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTeachers.map((teacher) => {
                const inchargeClasses = classes.filter((c) => c.classTeacherId === teacher.id);
                const assignedClasses = classes.filter((c) => (teacher.assignedClasses || []).includes(c.id));

                return (
                  <div
                    key={teacher.id}
                    className="p-5 bg-[#FAF8F5] dark:bg-[#2C1215]/60 border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl space-y-4 hover:border-[#7F1D1D] dark:hover:border-[#C2410C] transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-[#FEE2E2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5] flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                          {teacher.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-[#1C1917] dark:text-[#FAF8F5] text-sm">
                              {teacher.name}
                            </h3>
                          </div>
                          <span className="text-xs text-[#57534E] dark:text-[#D6CCC2] block">
                            {teacher.designation}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        {teacher.isAdmissionIncharge ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                            <Award className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            Admission Incharge
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F3EFEA] dark:bg-[#2C1215] text-[#57534E] dark:text-[#D6CCC2] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
                            Faculty
                          </span>
                        )}
                        <span className="text-[10px] text-[#78716C] font-mono">
                          ID: {teacher.id}
                        </span>
                      </div>
                    </div>

                    {/* Detailed Institutional Attributes */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E7E0D4]/60 dark:border-[rgba(255,253,249,0.14)] text-xs">
                      <div>
                        <span className="text-[10px] text-[#78716C] block">CNIC (شناختی کارڈ)</span>
                        <span className="font-mono font-semibold text-[#1C1917] dark:text-[#FAF8F5] text-[11px]">
                          {teacher.cnic || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#78716C] block">Joining Date</span>
                        <span className="font-mono text-[#1C1917] dark:text-[#FAF8F5] text-[11px]">
                          {teacher.joiningDate || '2023-08-15'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#78716C] block">Official Contact</span>
                        <span className="font-mono text-[#44403C] dark:text-[#E7E0D4] text-[11px] truncate block">
                          {teacher.phone || '0300-1122334'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#78716C] block">Email Address</span>
                        <span className="text-[#44403C] dark:text-[#E7E0D4] text-[11px] truncate block" title={teacher.email}>
                          {teacher.email}
                        </span>
                      </div>
                    </div>

                    {/* Assigned Classes */}
                    <div className="pt-2 border-t border-[#E7E0D4]/60 dark:border-[rgba(255,253,249,0.14)] text-xs">
                      <span className="text-[10px] text-[#78716C] block mb-1">
                        Class Incharge &amp; Sections:
                      </span>
                      {inchargeClasses.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {inchargeClasses.map((c) => (
                            <span
                              key={c.id}
                              className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-semibold"
                            >
                              Incharge: {c.grade} - {c.section}
                            </span>
                          ))}
                        </div>
                      ) : assignedClasses.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {assignedClasses.map((c) => (
                            <span
                              key={c.id}
                              className="px-2 py-0.5 rounded-lg bg-[#FEF2F2] dark:bg-[#3F1014]/50 text-[#7F1D1D] dark:text-[#FCA5A5] border border-[#FECACA] dark:border-[#7F1D1D]/60 text-[10px] font-semibold"
                            >
                              {c.grade} - {c.section}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-[#78716C] italic">No class currently assigned</span>
                      )}
                    </div>

                    {/* Actions: Edit Profile, Offer Letter & Toggle Admission Incharge */}
                    <div className="pt-3 border-t border-[#E7E0D4]/60 dark:border-[rgba(255,253,249,0.14)] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditProfile(teacher)}
                          className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F3EFEA] hover:bg-[#E7E0D4] dark:bg-[#3F1014] dark:hover:bg-slate-600 text-[#44403C] dark:text-[#FAF8F5] rounded-xl text-xs font-semibold transition cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-[#57534E]" />
                          <span>Edit Profile</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setLetterTeacher(teacher)}
                          className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold transition cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Appointment Letter</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleIncharge(teacher)}
                        className={`min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                          teacher.isAdmissionIncharge
                            ? 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                            : 'bg-[#FEF2F2] hover:bg-[#FEE2E2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5] border border-[#FECACA] dark:border-[#7F1D1D]/60'
                        }`}
                        title={teacher.isAdmissionIncharge ? 'Revoke Admission Incharge Authority' : 'Designate as Admission Incharge'}
                      >
                        <Key className="w-3.5 h-3.5" />
                        <span>
                          {teacher.isAdmissionIncharge
                            ? 'Revoke Admission Incharge'
                            : 'Assign Admission Incharge'}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: PENDING JOIN REQUESTS */}
        {activeTab === 'requests' && (
          <div className="p-5">
            {pendingJoinRequests.length === 0 ? (
              <div className="py-12 text-center text-[#78716C]">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-[#44403C] dark:text-[#E7E0D4]">
                  No Pending Join Requests
                </p>
                <p className="text-xs text-[#78716C] mt-1 max-w-sm mx-auto">
                  All incoming teacher affiliation applications have been processed.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingJoinRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 bg-[#FAF8F5] dark:bg-[#2C1215]/60 border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm shrink-0">
                        {req.fullName.charAt(0)}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-[#1C1917] dark:text-[#FAF8F5] text-xs">
                            {req.fullName}
                          </h3>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            Pending Approval
                          </span>
                        </div>
                        <div className="text-[11px] text-[#57534E] dark:text-[#E7E0D4]">
                          <span className="font-semibold text-[#7F1D1D] dark:text-[#FCA5A5]">{req.designation}</span>
                          {req.fatherName && (
                            <span> · S/D/O <strong className="text-[#1C1917] dark:text-[#FAF8F5]">{req.fatherName}</strong></span>
                          )}
                          <span> · CNIC: <strong className="font-mono text-[#1C1917] dark:text-[#FAF8F5]">{req.cnic || '—'}</strong></span>
                        </div>
                        <div className="text-[10px] text-[#78716C] flex flex-wrap items-center gap-x-3 gap-y-0.5 pt-0.5">
                          <span>Email: <strong className="text-[#57534E] dark:text-[#E7E0D4]">{req.email}</strong></span>
                          <span>Phone: <strong className="font-mono text-[#57534E] dark:text-[#E7E0D4]">{req.phone}</strong></span>
                          {req.semisCode && <span>SEMIS: <strong className="font-mono text-[#7F1D1D] dark:text-[#FCA5A5]">{req.semisCode}</strong></span>}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#2C1215]/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 sm:p-6 max-w-md w-full max-h-[90dvh] overflow-y-auto shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                    Approve Teacher &amp; Assign Classes
                  </h3>
                  <p className="text-[11px] text-[#78716C]">
                    Allocating teaching responsibilities for {selectedRequest.fullName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="p-1.5 text-[#78716C] hover:text-[#57534E] dark:hover:text-[#FAF8F5] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Applicant Full Details Review Card */}
              <div className="p-3 bg-[#FAF8F5] dark:bg-[#2C1215]/80 rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1C1917] dark:text-[#FAF8F5] text-xs">
                    {selectedRequest.fullName}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FEF2F2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5] border border-[#FECACA] dark:border-[#7F1D1D]/60">
                    {selectedRequest.designation}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-[#E7E0D4]/60 dark:border-[rgba(255,253,249,0.14)]">
                  <div>
                    <span className="text-[10px] text-[#78716C] block">Father&apos;s Name</span>
                    <span className="font-semibold text-[#1C1917] dark:text-[#FAF8F5]">
                      {selectedRequest.fatherName || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#78716C] block">NADRA CNIC</span>
                    <span className="font-mono font-semibold text-[#1C1917] dark:text-[#FAF8F5]">
                      {selectedRequest.cnic || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#78716C] block">Official Phone</span>
                    <span className="font-mono font-semibold text-[#1C1917] dark:text-[#FAF8F5]">
                      {selectedRequest.phone || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#78716C] block">Official Email</span>
                    <span className="font-mono text-[#1C1917] dark:text-[#FAF8F5] truncate block" title={selectedRequest.email}>
                      {selectedRequest.email}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1.5">
                  Select Teaching Class(es):
                </label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {classes.map((cls) => (
                    <label
                      key={cls.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={assignedClassIds.includes(cls.id)}
                          onChange={() => handleToggleClass(cls.id)}
                          className="rounded text-[#7F1D1D] focus:ring-[#7F1D1D] cursor-pointer"
                        />
                        <span className="font-semibold text-[#1C1917] dark:text-[#FAF8F5]">
                          {cls.grade} - {cls.section}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#78716C]">{cls.medium} Medium</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                  Designate as Primary Class Incharge (حاضری انچارج):
                </label>
                <select
                  value={classTeacherForId}
                  onChange={(e) => setClassTeacherForId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden focus:ring-2 focus:ring-[#7F1D1D] cursor-pointer"
                >
                  <option value="">None (Subject Teacher only)</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.grade} - {c.section} (Currently: {c.classTeacherName})
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-[#78716C] mt-1 block">
                  Assigning as Class Incharge gives this teacher permission to take daily roll call for that section.
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="px-3.5 py-2 bg-[#F3EFEA] dark:bg-[#2C1215] text-[#57534E] dark:text-[#E7E0D4] rounded-xl text-xs font-semibold cursor-pointer"
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

      {/* Edit Teacher Profile Modal */}
      {editingTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#2C1215]/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 sm:p-6 max-w-lg w-full max-h-[90dvh] overflow-y-auto shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#FEF2F2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5] flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                    Edit Teacher Profile &amp; Role
                  </h3>
                  <p className="text-[11px] text-[#78716C]">
                    Institutional details for {editingTeacher.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingTeacher(null)}
                className="p-1.5 text-[#78716C] hover:text-[#57534E] dark:hover:text-[#FAF8F5] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTeacherProfile} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Full Name:
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden focus:ring-2 focus:ring-[#7F1D1D]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Designation:
                  </label>
                  <input
                    type="text"
                    required
                    value={editDesignation}
                    onChange={(e) => setEditDesignation(e.target.value)}
                    placeholder="e.g., HST (Science), PST, JST"
                    className="w-full px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden focus:ring-2 focus:ring-[#7F1D1D]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    CNIC (شناختی کارڈ نمبر):
                  </label>
                  <input
                    type="text"
                    value={editCnic}
                    onChange={(e) => setEditCnic(e.target.value)}
                    placeholder="41303-1234567-1"
                    className="w-full px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs font-mono text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden focus:ring-2 focus:ring-[#7F1D1D]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Official Contact Phone:
                  </label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="0300-1234567"
                    className="w-full px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs font-mono text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden focus:ring-2 focus:ring-[#7F1D1D]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                  Joining / Appointment Date:
                </label>
                <input
                  type="date"
                  value={editJoiningDate}
                  onChange={(e) => setEditJoiningDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden focus:ring-2 focus:ring-[#7F1D1D]"
                />
              </div>

              {/* Special Institutional Role: Admission Incharge */}
              <div className="p-3 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-1.5">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsAdmissionIncharge}
                    onChange={(e) => setEditIsAdmissionIncharge(e.target.checked)}
                    className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-amber-950 dark:text-amber-200 block text-xs">
                      Designate as Official Admission Incharge (داخلہ انچارج)
                    </span>
                    <span className="text-[11px] text-amber-800/80 dark:text-amber-300/80 block mt-0.5">
                      Grants this teacher delegated institutional authority to register new admissions (+ Admit New Student), update General Register (GR) bio-data, and manage student enrollments.
                    </span>
                  </div>
                </label>
              </div>

              <div className="pt-3 border-t border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTeacher(null)}
                  className="px-3.5 py-2 bg-[#F3EFEA] dark:bg-[#2C1215] text-[#57534E] dark:text-[#E7E0D4] rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#7F1D1D] hover:bg-[#651414] text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  Save Profile Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {letterTeacher && (
        <AppointmentLetterModal
          isOpen={true}
          onClose={() => setLetterTeacher(null)}
          teacherName={letterTeacher.name}
          fatherName={letterTeacher.fatherName}
          designation={letterTeacher.designation}
          cnic={letterTeacher.cnic}
          email={letterTeacher.email}
          phone={letterTeacher.phone}
          joiningDate={letterTeacher.joiningDate}
          assignedClassesLabel={
            classes
              .filter(
                (c) =>
                  c.classTeacherId === letterTeacher.id ||
                  (letterTeacher.assignedClasses || []).includes(c.id)
              )
              .map((c) => `${c.grade} - ${c.section}`)
              .join(', ') || 'General Faculty Duties'
          }
          school={activeSchool}
        />
      )}
    </div>
  );
};
