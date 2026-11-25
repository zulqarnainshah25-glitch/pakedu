import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Filter,
  ArrowLeft,
  Sparkles,
  Edit2,
  Trash2,
  Eye,
  X,
  CheckCircle2,
  AlertCircle,
  FileText,
  Phone,
  MapPin,
  Calendar,
  GraduationCap,
  ShieldCheck,
  UserCheck,
  Printer,
  Download,
  Receipt,
  Tag,
  Mail,
  KeyRound,
  Copy,
  Check,
  Upload,
  Link2,
  Camera,
} from 'lucide-react';
import { useSms } from '../context/SmsContext';
import { Student } from '../types';
import { calculateStudentFeeLedger } from '../utils/feeCalculations';

interface StudentDirectoryProps {
  onBack: () => void;
  onNavigateToAttendance?: (classId?: string) => void;
  initialClassId?: string;
}

export const StudentDirectory: React.FC<StudentDirectoryProps> = ({
  onBack,
  onNavigateToAttendance,
  initialClassId,
}) => {
  const {
    userRole,
    classes,
    loadingClasses,
    refreshActiveSchoolClasses,
    students,
    filteredStudentsForUser,
    addStudent,
    updateStudent,
    deleteStudent,
    activeSchool,
    activeTeacher,
    canAdmitStudents,
    feeStructures,
    feePayments,
    feeConcessions,
    applyStudentConcession,
    generateParentInviteForStudent,
    studentPortalLinks,
    generateStudentInviteForStudent,
  } = useSms();

  const isAdmin = userRole === 'admin' || userRole === 'principal' || userRole === 'super-admin';
  const canAdmitOrEdit = isAdmin || canAdmitStudents;

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string>(initialClassId || 'All');
  const [selectedGender, setSelectedGender] = useState<'All' | 'Male' | 'Female'>('All');
  const [selectedStatus, setSelectedStatus] = useState<'All' | 'active' | 'struck_off' | 'transferred' | 'graduated'>('All');

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [grNumber, setGrNumber] = useState('');
  const [bFormNumber, setBFormNumber] = useState('');
  const [dob, setDob] = useState('2011-01-01');
  const [gender, setGender] = useState<'Male' | 'Female'>('Male');
  const [classId, setClassId] = useState(classes[0]?.id || '');
  const [admissionDate, setAdmissionDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [status, setStatus] = useState<'active' | 'struck_off' | 'transferred' | 'graduated'>('active');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [address, setAddress] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [selectedConcessionId, setSelectedConcessionId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [inviteEmailInput, setInviteEmailInput] = useState('');
  const [generatedInvite, setGeneratedInvite] = useState<{ code: string; url: string } | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [studentInviteEmailInput, setStudentInviteEmailInput] = useState('');
  const [generatedStudentInvite, setGeneratedStudentInvite] = useState<{ code: string; url: string } | null>(null);
  const [copiedStudentInvite, setCopiedStudentInvite] = useState(false);
  const [isGeneratingStudentInvite, setIsGeneratingStudentInvite] = useState(false);
  const [studentInviteMessage, setStudentInviteMessage] = useState<string | null>(null);

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const activeViewingStudent = useMemo(() => {
    if (!viewingStudent) return null;
    return students.find((s) => s.id === viewingStudent.id) || viewingStudent;
  }, [viewingStudent, students]);

  const viewingStudentLedger = useMemo(() => {
    if (!viewingStudent) return null;
    // Always sync with latest student object from context
    const latestStudent = students.find((s) => s.id === viewingStudent.id) || viewingStudent;
    return calculateStudentFeeLedger(
      latestStudent,
      feeStructures,
      feePayments,
      feeConcessions,
      currentMonthKey
    );
  }, [viewingStudent, students, feeStructures, feePayments, feeConcessions, currentMonthKey]);

  useEffect(() => {
    if (!viewingStudent) {
      setInviteEmailInput('');
      setGeneratedInvite(null);
      setCopiedInvite(false);
      setInviteMessage(null);
      setStudentInviteEmailInput('');
      setGeneratedStudentInvite(null);
      setCopiedStudentInvite(false);
      setStudentInviteMessage(null);
      return;
    }
    const latest = students.find((s) => s.id === viewingStudent.id) || viewingStudent;
    setInviteEmailInput(latest.parentEmail || '');
    setGeneratedInvite(null);
    setCopiedInvite(false);
    setInviteMessage(null);
    setStudentInviteEmailInput(
      latest.studentEmail || studentPortalLinks[latest.id]?.studentEmail || ''
    );
    setGeneratedStudentInvite(null);
    setCopiedStudentInvite(false);
    setStudentInviteMessage(null);
  }, [viewingStudent?.id]);

  // Ensure classes for the active school are fetched from Firestore
  useEffect(() => {
    if (activeSchool?.id) {
      refreshActiveSchoolClasses(activeSchool.id);
    }
  }, [activeSchool?.id]);

  // Keep classId synced when classes load asynchronously while Admission modal is open
  useEffect(() => {
    if (isFormModalOpen && !editingStudent && classes.length > 0) {
      const exists = classes.some((c) => c.id === classId);
      if (!classId || !exists) {
        setClassId(classes[0].id);
      }
    }
  }, [isFormModalOpen, editingStudent, classes, classId]);

  // Suggest next GR number automatically
  const suggestNextGrNumber = (): string => {
    const grNumbers = students
      .map((s) => {
        const match = s.grNumber.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => n > 0);
    const maxGr = grNumbers.length > 0 ? Math.max(...grNumbers) : 1000;
    return `GR-${maxGr + 1}`;
  };

  const handlePhotoUpload = (file: File | undefined) => {
    if (!file) return;
    setPhotoError(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPhotoError('Please upload a JPEG, PNG, or WebP image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhotoError('Student photo must be under 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setPhotoError('Unable to read the selected photo file.');
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => setPhotoError('Invalid image file selected.');
      img.onload = () => {
        const maxDim = 256;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setPhotoUrl(String(reader.result || ''));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setPhotoUrl(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateParentInvite = async () => {
    if (!activeViewingStudent) return;
    setIsGeneratingInvite(true);
    setInviteMessage(null);
    setCopiedInvite(false);
    try {
      const cleanEmail = inviteEmailInput.trim().toLowerCase();
      const result = await generateParentInviteForStudent(
        activeViewingStudent.id,
        cleanEmail || undefined
      );
      if (!result) {
        setInviteMessage('Unable to generate invite right now.');
        return;
      }
      setGeneratedInvite({ code: result.inviteCode, url: result.inviteUrl });
      setViewingStudent((prev) =>
        prev
          ? {
              ...prev,
              parentEmail: cleanEmail || prev.parentEmail,
              parentInviteCode: result.inviteCode,
            }
          : null
      );
      setInviteMessage('Parent invite code & link generated and synced.');
    } catch (err: any) {
      setInviteMessage(err?.message || 'Unable to generate invite right now.');
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  const handleGenerateStudentInvite = async () => {
    if (!activeViewingStudent) return;
    setIsGeneratingStudentInvite(true);
    setStudentInviteMessage(null);
    setCopiedStudentInvite(false);
    try {
      const cleanEmail = studentInviteEmailInput.trim().toLowerCase();
      const result = await generateStudentInviteForStudent(
        activeViewingStudent.id,
        cleanEmail || undefined
      );
      if (!result) {
        setStudentInviteMessage('Unable to generate student invite right now.');
        return;
      }
      setGeneratedStudentInvite({ code: result.inviteCode, url: result.inviteUrl });
      setViewingStudent((prev) =>
        prev
          ? {
              ...prev,
              studentEmail: cleanEmail || prev.studentEmail,
              studentInviteCode: result.inviteCode,
            }
          : null
      );
      setStudentInviteMessage('Student invite code & link generated and synced.');
    } catch (err: any) {
      setStudentInviteMessage(err?.message || 'Unable to generate student invite right now.');
    } finally {
      setIsGeneratingStudentInvite(false);
    }
  };

  const handleCopyParentInviteUrl = (urlText: string, type: 'parent' | 'student' = 'parent') => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(urlText).catch(() => {});
    }
    if (type === 'student') {
      setCopiedStudentInvite(true);
      setTimeout(() => setCopiedStudentInvite(false), 2500);
    } else {
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2500);
    }
  };

  const openAddModal = () => {
    if (activeSchool?.id) {
      refreshActiveSchoolClasses(activeSchool.id);
    }
    setEditingStudent(null);
    setFullName('');
    setFatherName('');
    setGrNumber(suggestNextGrNumber());
    setBFormNumber('');
    setDob('2011-01-01');
    setGender('Male');
    setClassId(classes[0]?.id || '');
    setAdmissionDate(new Date().toISOString().split('T')[0]);
    setStatus('active');
    setGuardianPhone('');
    setAddress('');
    setParentEmail('');
    setStudentEmail('');
    setPhotoUrl('');
    setPhotoError(null);
    setSelectedConcessionId('');
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const openEditModal = (student: Student) => {
    if (activeSchool?.id) {
      refreshActiveSchoolClasses(activeSchool.id);
    }
    setEditingStudent(student);
    setFullName(student.fullName);
    setFatherName(student.fatherName);
    setGrNumber(student.grNumber);
    setBFormNumber(student.bFormNumber || '');
    setDob(student.dob);
    setGender(student.gender);
    setClassId(student.classId);
    setAdmissionDate(student.admissionDate);
    setStatus(student.status);
    setGuardianPhone(student.guardianPhone || '');
    setAddress(student.address || '');
    setParentEmail(student.parentEmail || '');
    setStudentEmail(student.studentEmail || '');
    setPhotoUrl(student.photoUrl || '');
    setPhotoError(null);
    setSelectedConcessionId(student.concessionId || '');
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Mandatory Fields Validation
    if (!fullName.trim()) {
      setFormError('Full Name is required.');
      return;
    }
    if (!fatherName.trim()) {
      setFormError("Father's Name is required.");
      return;
    }
    if (!grNumber.trim()) {
      setFormError('General Register (GR) Number is required.');
      return;
    }
    if (!classId.trim()) {
      setFormError(
        classes.length === 0
          ? 'No classes found for this school. Please create a Class & Section first.'
          : 'Please select a Class & Section.'
      );
      return;
    }
    const selectedClass = classes.find((c) => c.id === classId);
    if (!selectedClass) {
      setFormError('Selected Class & Section is invalid. Please choose a valid class.');
      return;
    }
    const trimmedPhone = guardianPhone.trim();
    const phoneDigits = trimmedPhone.replace(/\D/g, '');
    if (!trimmedPhone || phoneDigits.length < 7) {
      setFormError('Guardian Phone Number is required (enter at least 7 digits, e.g., 0300-1234567).');
      return;
    }

    // Check GR uniqueness
    const grDuplicate = students.find(
      (s) =>
        s.grNumber.trim().toLowerCase() === grNumber.trim().toLowerCase() &&
        s.id !== editingStudent?.id
    );
    if (grDuplicate) {
      setFormError(`GR Number "${grNumber}" is already assigned to ${grDuplicate.fullName}. GR numbers must be unique.`);
      return;
    }

    const grade = selectedClass.grade;
    const section = selectedClass.section;
    const matchedRule = selectedConcessionId
      ? feeConcessions.find((r) => r.id === selectedConcessionId)
      : undefined;

    const cleanParentEmail = parentEmail.trim().toLowerCase();
    const cleanStudentEmail = studentEmail.trim().toLowerCase();
    const cleanPhotoUrl = photoUrl.trim();
    const payload: Omit<Student, 'id'> = {
      fullName: fullName.trim(),
      fatherName: fatherName.trim(),
      grNumber: grNumber.trim().toUpperCase(),
      bFormNumber: bFormNumber.trim() || undefined,
      dob,
      gender,
      classId,
      grade,
      section,
      admissionDate,
      status,
      guardianPhone: guardianPhone.trim(),
      address: address.trim() || undefined,
      parentEmail: editingStudent ? cleanParentEmail : cleanParentEmail || undefined,
      studentEmail: editingStudent ? cleanStudentEmail : cleanStudentEmail || undefined,
      photoUrl: editingStudent ? cleanPhotoUrl : cleanPhotoUrl || undefined,
      concessionId: matchedRule ? matchedRule.id : '',
      concessionTitle: matchedRule ? matchedRule.title : '',
      concessionType: matchedRule ? matchedRule.discountType : 'percentage',
      concessionValue: matchedRule ? matchedRule.value : 0,
    };

    if (editingStudent) {
      updateStudent(editingStudent.id, payload);
      setSuccessToast(`Student record for ${fullName} updated successfully.`);
    } else {
      const created = addStudent(payload);
      setSuccessToast(
        created?.studentInviteCode
          ? `Student ${fullName} (${payload.grNumber}) admitted! Student Invite Code: ${created.studentInviteCode}`
          : `Student ${fullName} (${payload.grNumber}) admitted successfully.`
      );
    }

    setIsFormModalOpen(false);
    setTimeout(() => setSuccessToast(null), 5000);
  };

  const handleDelete = (student: Student) => {
    deleteStudent(student.id);
    setDeleteConfirmId(null);
    setSuccessToast(`Student record for ${student.fullName} has been removed.`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  // Filter students
  const displayedStudents = useMemo(() => {
    return filteredStudentsForUser.filter((s) => {
      // Search query filter (Name, Father, GR, B-Form)
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        s.fullName.toLowerCase().includes(q) ||
        s.fatherName.toLowerCase().includes(q) ||
        s.grNumber.toLowerCase().includes(q) ||
        (s.bFormNumber && s.bFormNumber.toLowerCase().includes(q)) ||
        (s.guardianPhone && s.guardianPhone.includes(q));

      // Class filter
      const matchClass = selectedClassId === 'All' || s.classId === selectedClassId;

      // Gender filter
      const matchGender = selectedGender === 'All' || s.gender === selectedGender;

      // Status filter
      const matchStatus = selectedStatus === 'All' || s.status === selectedStatus;

      return matchSearch && matchClass && matchGender && matchStatus;
    });
  }, [
    filteredStudentsForUser,
    searchQuery,
    selectedClassId,
    selectedGender,
    selectedStatus,
  ]);

  // Aggregate stats for current view
  const aggregateCounts = useMemo(() => {
    const total = filteredStudentsForUser.length;
    const active = filteredStudentsForUser.filter((s) => s.status === 'active').length;
    const male = filteredStudentsForUser.filter((s) => s.gender === 'Male').length;
    const female = filteredStudentsForUser.filter((s) => s.gender === 'Female').length;
    return { total, active, male, female };
  }, [filteredStudentsForUser]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
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
                  Student Information System (SIS)
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FEF2F2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5] border border-[#FECACA] dark:border-[#7F1D1D]/60">
                  General Register (GR)
                </span>
              </div>
              <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-0.5">
                {activeSchool.name} · Session {activeSchool.activeAcademicYear}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {canAdmitOrEdit ? (
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#7F1D1D] hover:bg-[#651414] text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Admit New Student</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F3EFEA] dark:bg-[#2C1215] text-[#57534E] dark:text-[#D6CCC2] text-xs font-medium rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Teacher Incharge View (Read-Only)</span>
              </div>
            )}
          </div>
        </div>

        {/* Role Banner */}
        <div className="mt-4 pt-4 border-t border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
          {isAdmin ? (
            <div className="flex items-center justify-between text-xs text-[#57534E] dark:text-[#E7E0D4] bg-[#FAF8F5] dark:bg-[#2C1215]/50 px-3.5 py-2 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>
                  <strong>Administrator Access:</strong> Full authority to admit students, issue GR numbers, update bio-data, and process withdrawals.
                </span>
              </div>
              <span className="text-[11px] font-mono text-[#78716C]">Total Records: {students.length}</span>
            </div>
          ) : canAdmitStudents ? (
            <div className="flex items-center justify-between text-xs text-amber-900 dark:text-amber-200 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-3.5 py-2 rounded-xl">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  <strong>Delegated Admission Incharge (مجاز داخلہ انچارج):</strong> Authorized by school administration to admit new students, issue GR numbers, and edit student records.
                </span>
              </div>
              <span className="text-[11px] font-medium text-amber-800 dark:text-amber-300">
                {displayedStudents.length} Students in view
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-[#57534E] dark:text-[#E7E0D4] bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 px-3.5 py-2 rounded-xl">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  Logged in as <strong>{activeTeacher.name}</strong>. Showing student roster for your assigned classes.
                </span>
              </div>
              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                {displayedStudents.length} Students in your classes
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Success Notification Toast */}
      {successToast && (
        <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 px-4 py-3 rounded-2xl flex items-center justify-between text-xs shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-medium">{successToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessToast(null)}
            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-3.5 shadow-xs">
          <div className="text-[11px] text-[#57534E] dark:text-[#D6CCC2]">Total Enrolled</div>
          <div className="text-xl font-bold text-[#1C1917] dark:text-[#FAF8F5] mt-0.5 tabular-nums">
            {aggregateCounts.total}
          </div>
          <div className="text-[10px] text-[#7F1D1D] dark:text-[#FCA5A5] mt-0.5">
            {isAdmin ? 'All School Classes' : 'Assigned Class(es)'}
          </div>
        </div>

        <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-3.5 shadow-xs">
          <div className="text-[11px] text-[#57534E] dark:text-[#D6CCC2]">Active Students</div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
            {aggregateCounts.active}
          </div>
          <div className="text-[10px] text-[#57534E] mt-0.5">Regular roll register</div>
        </div>

        <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-3.5 shadow-xs">
          <div className="text-[11px] text-[#57534E] dark:text-[#D6CCC2]">Boys (Male)</div>
          <div className="text-xl font-bold text-[#C2410C] dark:text-[#FDBA74] mt-0.5 tabular-nums">
            {aggregateCounts.male}
          </div>
          <div className="text-[10px] text-[#57534E] mt-0.5">
            {aggregateCounts.total > 0
              ? `${Math.round((aggregateCounts.male / aggregateCounts.total) * 100)}% of total`
              : '0%'}
          </div>
        </div>

        <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-3.5 shadow-xs">
          <div className="text-[11px] text-[#57534E] dark:text-[#D6CCC2]">Girls (Female)</div>
          <div className="text-xl font-bold text-pink-600 dark:text-pink-400 mt-0.5 tabular-nums">
            {aggregateCounts.female}
          </div>
          <div className="text-[10px] text-[#57534E] mt-0.5">
            {aggregateCounts.total > 0
              ? `${Math.round((aggregateCounts.female / aggregateCounts.total) * 100)}% of total`
              : '0%'}
          </div>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-[#78716C] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Student Name, Father's Name, GR No, B-Form..."
              className="w-full pl-9 pr-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5] placeholder:text-[#78716C] focus:outline-hidden focus:ring-2 focus:ring-[#7F1D1D]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#78716C] hover:text-[#57534E] dark:hover:text-[#FAF8F5]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Class Filter */}
          <div className="md:col-span-3">
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden focus:ring-2 focus:ring-[#7F1D1D] cursor-pointer"
            >
              <option value="All">All Classes ({classes.length})</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.grade} - {c.section} ({c.medium})
                </option>
              ))}
            </select>
          </div>

          {/* Gender Filter */}
          <div className="md:col-span-2">
            <select
              value={selectedGender}
              onChange={(e) => setSelectedGender(e.target.value as any)}
              className="w-full px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden focus:ring-2 focus:ring-[#7F1D1D] cursor-pointer"
            >
              <option value="All">All Genders</option>
              <option value="Male">Boys (Male)</option>
              <option value="Female">Girls (Female)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="md:col-span-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="w-full px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden focus:ring-2 focus:ring-[#7F1D1D] cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="active">Active Enrolled</option>
              <option value="struck_off">Struck Off (Kharij)</option>
              <option value="transferred">Transferred (SLC Issued)</option>
              <option value="graduated">Graduated (Passed)</option>
            </select>
          </div>
        </div>

        {/* Filter tags & active counts */}
        <div className="flex items-center justify-between text-xs text-[#57534E] dark:text-[#D6CCC2] pt-1">
          <div>
            Showing <strong className="text-[#1C1917] dark:text-[#FAF8F5]">{displayedStudents.length}</strong> of{' '}
            {filteredStudentsForUser.length} students
            {(searchQuery || selectedClassId !== 'All' || selectedGender !== 'All' || selectedStatus !== 'All') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedClassId('All');
                  setSelectedGender('All');
                  setSelectedStatus('All');
                }}
                className="ml-3 text-[#7F1D1D] dark:text-[#FCA5A5] hover:underline cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1 text-[11px] text-[#57534E] hover:text-[#1C1917] dark:hover:text-[#FAF8F5] cursor-pointer"
              title="Print Current Student List"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print List</span>
            </button>
          </div>
        </div>
      </div>

      {/* Students Data Table */}
      <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF8F5] dark:bg-[#2C1215]/70 text-[#57534E] dark:text-[#E7E0D4] font-semibold border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
              <tr>
                <th className="py-3 px-4">GR No.</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Father's Name</th>
                <th className="py-3 px-4">Class &amp; Section</th>
                <th className="py-3 px-4">NADRA B-Form</th>
                <th className="py-3 px-4">Gender</th>
                <th className="py-3 px-4">Guardian Contact</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E0D4] dark:divide-[rgba(255,253,249,0.10)] text-[#44403C] dark:text-[#E7E0D4]">
              {displayedStudents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#78716C]">
                    <Users className="w-8 h-8 mx-auto text-[#E7E0D4] dark:text-[#A8A29E] mb-2" />
                    <p className="text-sm font-semibold text-[#44403C] dark:text-[#E7E0D4]">No students found</p>
                    <p className="text-xs text-[#78716C] mt-1 max-w-sm mx-auto">
                      {searchQuery || selectedClassId !== 'All'
                        ? 'Try adjusting your search query or class filter.'
                        : 'No student records have been created in this register yet.'}
                    </p>
                    {canAdmitOrEdit && (
                      <button
                        type="button"
                        onClick={openAddModal}
                        className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#7F1D1D] text-white rounded-xl text-xs font-semibold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Admit First Student</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                displayedStudents.map((student) => {
                  const classInfo = classes.find((c) => c.id === student.classId);
                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-[#FAF8F5]/80 dark:hover:bg-[#3F1014]/40 transition-colors"
                    >
                      {/* GR Number */}
                      <td className="py-3 px-4 font-mono font-bold text-[#7F1D1D] dark:text-[#FCA5A5] whitespace-nowrap">
                        {student.grNumber}
                      </td>

                      {/* Student Name */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          {student.photoUrl ? (
                            <img
                              src={student.photoUrl}
                              alt={student.fullName}
                              className="w-7 h-7 rounded-full object-cover border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] shrink-0"
                            />
                          ) : (
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${
                                student.gender === 'Female'
                                  ? 'bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300'
                                  : 'bg-[#FEE2E2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5]'
                              }`}
                            >
                              {student.fullName.charAt(0)}
                            </div>
                          )}
                          <div>
                            <button
                              type="button"
                              onClick={() => setViewingStudent(student)}
                              className="font-bold text-[#1C1917] dark:text-[#FAF8F5] hover:text-[#651414] dark:hover:text-[#FED7AA] transition cursor-pointer text-left block"
                            >
                              {student.fullName}
                            </button>
                            {student.concessionTitle && (student.concessionValue || 0) > 0 && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 mt-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[9px] font-bold">
                                <Tag className="w-2.5 h-2.5" />
                                {student.concessionTitle} (
                                {student.concessionType === 'fixed'
                                  ? `Rs.${student.concessionValue}`
                                  : `${student.concessionValue}%`}
                                )
                              </span>
                            )}
                            <span className="text-[10px] text-[#78716C] block sm:hidden">
                              S/D/O {student.fatherName}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Father's Name */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="text-[#1C1917] dark:text-[#FAF8F5]">{student.fatherName}</span>
                      </td>

                      {/* Class & Section */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-[#1C1917] dark:text-[#FAF8F5]">
                          {student.grade} - {student.section}
                        </div>
                        {classInfo && (
                          <div className="text-[10px] text-[#78716C]">
                            {classInfo.medium} Medium
                          </div>
                        )}
                      </td>

                      {/* NADRA B-Form */}
                      <td className="py-3 px-4 font-mono text-[11px] text-[#57534E] dark:text-[#E7E0D4] whitespace-nowrap">
                        {student.bFormNumber || (
                          <span className="text-[#78716C] font-sans italic text-[10px]">Not provided</span>
                        )}
                      </td>

                      {/* Gender */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            student.gender === 'Female'
                              ? 'bg-pink-50 dark:bg-pink-950/50 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800'
                              : 'bg-[#FFF7ED] dark:bg-[#7C2D12]/50 text-[#C2410C] dark:text-[#FDBA74] border border-[#FED7AA] dark:border-[#C2410C]/50'
                          }`}
                        >
                          {student.gender}
                        </span>
                      </td>

                      {/* Guardian Contact */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#44403C] dark:text-[#E7E0D4]">
                          <Phone className="w-3 h-3 text-[#78716C]" />
                          <span>{student.guardianPhone}</span>
                        </div>
                        {student.address && (
                          <div className="text-[10px] text-[#78716C] truncate max-w-[140px]" title={student.address}>
                            {student.address}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {student.status === 'active' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Active
                          </span>
                        )}
                        {student.status === 'struck_off' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            Struck Off
                          </span>
                        )}
                        {student.status === 'transferred' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            Transferred (SLC)
                          </span>
                        )}
                        {student.status === 'graduated' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FFF7ED] dark:bg-[#7C2D12]/60 text-[#C2410C] dark:text-[#FDBA74] border border-[#FED7AA] dark:border-[#C2410C]/50">
                            Graduated
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setViewingStudent(student)}
                            className="p-1.5 text-[#78716C] hover:text-[#651414] dark:hover:text-[#FED7AA] hover:bg-[#F3EFEA] dark:hover:bg-[#3F1014] rounded-lg transition cursor-pointer"
                            title="View Full Profile"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {canAdmitOrEdit && (
                            <button
                              type="button"
                              onClick={() => openEditModal(student)}
                              className="p-1.5 text-[#78716C] hover:text-[#651414] dark:hover:text-[#FED7AA] hover:bg-[#F3EFEA] dark:hover:bg-[#3F1014] rounded-lg transition cursor-pointer"
                              title="Edit Bio-data"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(student.id)}
                              className="p-1.5 text-[#78716C] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                              title="Delete / Withdraw"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2C1215]/60 backdrop-blur-xs">
          <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                Withdraw / Delete Student Record?
              </h3>
              <p className="text-xs text-[#57534E] dark:text-[#D6CCC2]">
                Are you sure you want to delete this student from the General Register? This will also decrement the class enrollment count.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2 bg-[#F3EFEA] dark:bg-[#2C1215] hover:bg-[#E7E0D4] dark:hover:bg-[#4A1C20] text-[#44403C] dark:text-[#E7E0D4] text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = students.find((s) => s.id === deleteConfirmId);
                  if (target) handleDelete(target);
                }}
                className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Profile Card Modal (View Details + Fee Ledger) */}
      {viewingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2C1215]/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-5 animate-in fade-in my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {viewingStudent.photoUrl ? (
                  <img
                    src={viewingStudent.photoUrl}
                    alt={viewingStudent.fullName}
                    className="w-12 h-12 rounded-2xl object-cover border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] shrink-0"
                  />
                ) : (
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 ${
                      viewingStudent.gender === 'Female'
                        ? 'bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300'
                        : 'bg-[#FEE2E2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5]'
                    }`}
                  >
                    {viewingStudent.fullName.charAt(0)}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                    {viewingStudent.fullName}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-[#57534E] dark:text-[#D6CCC2]">
                    <span>S/D/O {viewingStudent.fatherName}</span>
                    <span>·</span>
                    <span className="font-mono font-semibold text-[#7F1D1D] dark:text-[#FCA5A5]">
                      {viewingStudent.grNumber}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewingStudent(null)}
                className="p-1.5 text-[#78716C] hover:text-[#57534E] dark:hover:text-[#FAF8F5] rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Student Info Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-[#FAF8F5] dark:bg-[#2C1215]/60 p-4 rounded-xl border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)]">
              <div>
                <span className="text-[11px] text-[#78716C] block">Class &amp; Section</span>
                <span className="font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                  {viewingStudent.grade} - {viewingStudent.section}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-[#78716C] block">Status</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 capitalize">
                  {viewingStudent.status}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-[#78716C] block">NADRA B-Form No.</span>
                <span className="font-mono font-semibold text-[#1C1917] dark:text-[#FAF8F5]">
                  {viewingStudent.bFormNumber || 'Not Registered'}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-[#78716C] block">Gender</span>
                <span className="font-semibold text-[#1C1917] dark:text-[#FAF8F5]">
                  {viewingStudent.gender}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-[#78716C] block">Date of Birth</span>
                <span className="font-mono text-[#1C1917] dark:text-[#FAF8F5]">
                  {viewingStudent.dob}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-[#78716C] block">Admission Date</span>
                <span className="font-mono text-[#1C1917] dark:text-[#FAF8F5]">
                  {viewingStudent.admissionDate}
                </span>
              </div>

              <div className="col-span-2">
                <span className="text-[11px] text-[#78716C] block">Guardian Phone</span>
                <span className="font-mono font-bold text-[#7F1D1D] dark:text-[#FCA5A5]">
                  {viewingStudent.guardianPhone}
                </span>
              </div>

              {viewingStudent.address && (
                <div className="col-span-2">
                  <span className="text-[11px] text-[#78716C] block">Residential Address</span>
                  <span className="text-[#44403C] dark:text-[#E7E0D4]">
                    {viewingStudent.address}
                  </span>
                </div>
              )}
            </div>

            {/* Fee Ledger & Concession Assignment */}
            {viewingStudentLedger && (
              <div className="space-y-3 border-t border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] pt-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <h4 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                      Student Fee Ledger &amp; Balances
                    </h4>
                  </div>

                  {/* Permanent Concession Assignment (Admin Only) */}
                  {isAdmin ? (
                    <div className="flex items-center gap-1.5">
                      <label htmlFor="profile-concession-select" className="text-[10px] font-bold text-[#57534E]">
                        Permanent Discount:
                      </label>
                      <select
                        id="profile-concession-select"
                        value={
                          (students.find((s) => s.id === viewingStudent.id) || viewingStudent)
                            .concessionId || ''
                        }
                        onChange={(e) => {
                          const rule = feeConcessions.find((r) => r.id === e.target.value) || null;
                          applyStudentConcession(viewingStudent.id, rule);
                          setViewingStudent((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  concessionId: rule ? rule.id : '',
                                  concessionTitle: rule ? rule.title : '',
                                  concessionType: rule ? rule.discountType : 'percentage',
                                  concessionValue: rule ? rule.value : 0,
                                }
                              : null
                          );
                        }}
                        className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg text-[11px] font-semibold text-amber-800 dark:text-amber-200 cursor-pointer"
                      >
                        <option value="">No Concession (Full Fee)</option>
                        {feeConcessions
                          .filter((r) => r.isActive !== false)
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.title} ({r.discountType === 'fixed' ? `Rs.${r.value}` : `${r.value}%`})
                            </option>
                          ))}
                      </select>
                    </div>
                  ) : viewingStudentLedger.activeConcession.concessionTitle ? (
                    <span className="px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-[11px] font-bold">
                      Concession: {viewingStudentLedger.activeConcession.concessionTitle} (
                      {viewingStudentLedger.activeConcession.discountType === 'fixed'
                        ? `Rs.${viewingStudentLedger.activeConcession.discountValue}`
                        : `${viewingStudentLedger.activeConcession.discountValue}%`}
                      )
                    </span>
                  ) : null}
                </div>

                {/* 4 KPI Ledger Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#2C1215]/70 border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
                    <span className="text-[10px] font-bold uppercase text-[#78716C] block">Total Due</span>
                    <strong className="text-sm font-mono text-[#1C1917] dark:text-[#FAF8F5]">
                      Rs. {viewingStudentLedger.totalDue.toLocaleString()}
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
                    <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 block">Total Paid</span>
                    <strong className="text-sm font-mono text-emerald-700 dark:text-emerald-300">
                      Rs. {viewingStudentLedger.totalPaid.toLocaleString()}
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60">
                    <span className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-400 block">Pending Balance</span>
                    <strong className="text-sm font-mono text-rose-700 dark:text-rose-300">
                      Rs. {viewingStudentLedger.pendingBalance.toLocaleString()}
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl bg-[#FFF7ED]/70 dark:bg-[#7C2D12]/30 border border-[#FED7AA] dark:border-[#C2410C]/50">
                    <span className="text-[10px] font-bold uppercase text-[#C2410C] dark:text-[#FDBA74] block">Advance Balance</span>
                    <strong className="text-sm font-mono text-[#C2410C] dark:text-[#FDBA74]">
                      Rs. {viewingStudentLedger.advanceBalance.toLocaleString()}
                    </strong>
                  </div>
                </div>

                {/* Monthly Fee Ledger Breakdown Table */}
                <div className="border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl overflow-hidden">
                  <div className="overflow-x-auto max-h-48">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead className="bg-[#FAF8F5] dark:bg-[#2C1215]/70 text-[#57534E] dark:text-[#E7E0D4] font-bold uppercase text-[10px] sticky top-0">
                        <tr>
                          <th className="py-2 px-3">Month</th>
                          <th className="py-2 px-3 text-right">Net Due</th>
                          <th className="py-2 px-3 text-right">Discount</th>
                          <th className="py-2 px-3 text-right">Paid</th>
                          <th className="py-2 px-3 text-right">Balance</th>
                          <th className="py-2 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E7E0D4] dark:divide-[rgba(255,253,249,0.10)]">
                        {viewingStudentLedger.rows.map((row) => (
                          <tr key={row.month} className="hover:bg-[#FAF8F5]/50 dark:hover:bg-[#3F1014]/30">
                            <td className="py-2 px-3 font-semibold text-[#1C1917] dark:text-[#FAF8F5]">
                              <div>{row.monthLabel}</div>
                              {row.receiptNumber && (
                                <div className="text-[9px] font-mono text-[#78716C]">{row.receiptNumber}</div>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              Rs. {row.netDue.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-amber-600 dark:text-amber-400">
                              {row.discount > 0 ? `-Rs. ${row.discount.toLocaleString()}` : '-'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              Rs. {row.paidAmount.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                              {row.isFutureMonth
                                ? `Credit`
                                : `Rs. ${row.pendingBalance.toLocaleString()}`}
                            </td>
                            <td className="py-2 px-3">
                              {row.status === 'paid' && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-bold uppercase text-[9px]">
                                  Paid
                                </span>
                              )}
                              {row.status === 'partial' && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 font-bold uppercase text-[9px]">
                                  Partial
                                </span>
                              )}
                              {row.status === 'unpaid' && (
                                <span className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 font-bold uppercase text-[9px]">
                                  Unpaid
                                </span>
                              )}
                              {row.status === 'advance_credit' && (
                                <span className="px-1.5 py-0.5 rounded bg-[#FFF7ED] dark:bg-[#7C2D12]/70 text-[#C2410C] dark:text-[#FDBA74] font-bold uppercase text-[9px]">
                                  Advance Credit
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Parent Portal Access & Child Linkage */}
            {activeViewingStudent && (
              <div className="p-4 rounded-xl bg-[#FEF2F2]/70 dark:bg-[#3F1014]/30 border border-[#FECACA] dark:border-[#7F1D1D]/60 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-[#7F1D1D] dark:text-[#FCA5A5]" />
                    <div>
                      <h4 className="text-xs font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                        Parent Portal Access
                      </h4>
                      <p className="text-[11px] text-[#57534E] dark:text-[#D6CCC2]">
                        Allow parent/guardian read-only access to attendance, fee ledger, and report cards
                      </p>
                    </div>
                  </div>
                  {activeViewingStudent.parentUid ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-3 h-3" />
                      Linked
                    </span>
                  ) : activeViewingStudent.parentInviteCode ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      <KeyRound className="w-3 h-3" />
                      Invite Ready
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#F3EFEA] dark:bg-[#2C1215] text-[#57534E] dark:text-[#D6CCC2] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
                      Not Linked
                    </span>
                  )}
                </div>

                {activeViewingStudent.parentUid && (
                  <div className="text-[11px] text-emerald-800 dark:text-emerald-300 bg-white/80 dark:bg-[#211415]/60 border border-emerald-200 dark:border-emerald-800/50 rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Linked Parent Email:{' '}
                      <strong className="font-mono">
                        {activeViewingStudent.parentEmail || 'Verified Parent Account'}
                      </strong>
                    </span>
                    {activeViewingStudent.parentLinkedAt && (
                      <span className="text-[10px] text-[#57534E]">
                        Since {new Date(activeViewingStudent.parentLinkedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                )}

                {canAdmitStudents && (
                  <div className="space-y-2.5">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <Mail className="w-3.5 h-3.5 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          value={inviteEmailInput}
                          onChange={(e) => setInviteEmailInput(e.target.value)}
                          placeholder="Parent email (e.g., parent@gmail.com)"
                          className="w-full pl-8 pr-3 py-2 text-xs bg-[#FFFDF9] dark:bg-[#211415] border border-[#FECACA] dark:border-[#7F1D1D]/60 rounded-xl text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden focus:ring-2 focus:ring-[#7F1D1D]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleGenerateParentInvite}
                        disabled={isGeneratingInvite}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#7F1D1D] hover:bg-[#651414] text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-60 shrink-0"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>
                          {isGeneratingInvite
                            ? 'Generating...'
                            : 'Generate Invite Code & Link'}
                        </span>
                      </button>
                    </div>

                    {(generatedInvite?.code || activeViewingStudent.parentInviteCode) && (
                      <div className="p-2.5 rounded-xl bg-[#FFFDF9] dark:bg-[#211415] border border-[#FECACA] dark:border-[#7F1D1D]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-[#57534E]">Invite Code:</span>
                            <span className="font-mono font-bold text-[#7F1D1D] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#3F1014]/60 px-2 py-0.5 rounded">
                              {generatedInvite?.code || activeViewingStudent.parentInviteCode}
                            </span>
                          </div>
                          <p className="text-[10px] text-[#78716C] truncate">
                            {generatedInvite?.url ||
                              `${typeof window !== 'undefined' ? window.location.origin : ''}/?parent_invite=${encodeURIComponent(
                                activeViewingStudent.parentInviteCode || ''
                              )}&school=${encodeURIComponent(activeSchool.id)}&gr=${encodeURIComponent(
                                activeViewingStudent.grNumber
                              )}`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyParentInviteUrl(
                              generatedInvite?.url ||
                                `${typeof window !== 'undefined' ? window.location.origin : ''}/?parent_invite=${encodeURIComponent(
                                  activeViewingStudent.parentInviteCode || ''
                                )}&school=${encodeURIComponent(activeSchool.id)}&gr=${encodeURIComponent(
                                  activeViewingStudent.grNumber
                                )}`
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F3EFEA] dark:bg-[#2C1215] hover:bg-[#E7E0D4] dark:hover:bg-[#4A1C20] text-[#44403C] dark:text-[#FAF8F5] text-[11px] font-semibold rounded-lg transition cursor-pointer shrink-0"
                        >
                          {copiedInvite ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Copied Link</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Invite Link</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {inviteMessage && (
                      <p className="text-[11px] font-medium text-[#7F1D1D] dark:text-[#FCA5A5]">
                        {inviteMessage}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Student Portal Access & Student Login Linkage */}
            {activeViewingStudent && (() => {
              const liveStudentLink = studentPortalLinks[activeViewingStudent.id];
              const isStudentLinked = Boolean(
                activeViewingStudent.studentUid || liveStudentLink?.status === 'linked'
              );
              const activeCode =
                generatedStudentInvite?.code ||
                liveStudentLink?.inviteCode ||
                activeViewingStudent.studentInviteCode ||
                '';
              const activeStudentUrl =
                generatedStudentInvite?.url ||
                `${typeof window !== 'undefined' ? window.location.origin : ''}/?student_invite=${encodeURIComponent(
                  activeCode
                )}&school=${encodeURIComponent(activeSchool.id)}&gr=${encodeURIComponent(
                  activeViewingStudent.grNumber
                )}`;

              return (
                <div className="p-4 rounded-xl bg-[#FFF7ED]/70 dark:bg-[#7C2D12]/30 border border-[#FED7AA] dark:border-[#C2410C]/50 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-[#C2410C] dark:text-[#FDBA74]" />
                      <div>
                        <h4 className="text-xs font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                          Student Portal Access (Email-Free GR / ID Login)
                        </h4>
                        <p className="text-[11px] text-[#57534E] dark:text-[#D6CCC2]">
                          Login ID: <span className="font-mono font-semibold text-[#44403C] dark:text-[#FAF8F5]">{activeViewingStudent.grNumber}</span> · Student ID: <span className="font-mono">{activeViewingStudent.id}</span> (no email needed)
                        </p>
                      </div>
                    </div>
                    {isStudentLinked ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3" />
                        Linked
                      </span>
                    ) : activeCode ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        <KeyRound className="w-3 h-3" />
                        Invite Ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#F3EFEA] dark:bg-[#2C1215] text-[#57534E] dark:text-[#D6CCC2] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
                        Not Linked
                      </span>
                    )}
                  </div>

                  {isStudentLinked && (
                    <div className="text-[11px] text-emerald-800 dark:text-emerald-300 bg-white/80 dark:bg-[#211415]/60 border border-emerald-200 dark:border-emerald-800/50 rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                      <span>
                        Linked Student Email:{' '}
                        <strong className="font-mono">
                          {liveStudentLink?.studentEmail ||
                            activeViewingStudent.studentEmail ||
                            'Verified Student Account'}
                        </strong>
                      </span>
                      {(liveStudentLink?.claimedAt || activeViewingStudent.studentLinkedAt) && (
                        <span className="text-[10px] text-[#57534E]">
                          Since{' '}
                          {new Date(
                            liveStudentLink?.claimedAt || activeViewingStudent.studentLinkedAt!
                          ).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}

                  {canAdmitStudents && (
                    <div className="space-y-2.5">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                          <Mail className="w-3.5 h-3.5 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="email"
                            value={studentInviteEmailInput}
                            onChange={(e) => setStudentInviteEmailInput(e.target.value)}
                            placeholder="Optional notification email (not required for student login)"
                            className="w-full pl-8 pr-3 py-2 text-xs bg-[#FFFDF9] dark:bg-[#211415] border border-[#FED7AA] dark:border-[#C2410C]/50 rounded-xl text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden focus:ring-2 focus:ring-[#C2410C]"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleGenerateStudentInvite}
                          disabled={isGeneratingStudentInvite}
                          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#C2410C] hover:bg-[#9A3412] text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-60 shrink-0"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>
                            {isGeneratingStudentInvite
                              ? 'Generating...'
                              : 'Generate Student Invite'}
                          </span>
                        </button>
                      </div>

                      {activeCode && (
                        <div className="p-2.5 rounded-xl bg-[#FFFDF9] dark:bg-[#211415] border border-[#FED7AA] dark:border-[#C2410C]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-[#57534E]">Student Code:</span>
                              <span className="font-mono font-bold text-[#C2410C] dark:text-[#FDBA74] bg-[#FFF7ED] dark:bg-[#7C2D12]/60 px-2 py-0.5 rounded">
                                {activeCode}
                              </span>
                            </div>
                            <p className="text-[10px] text-[#78716C] truncate">
                              {activeStudentUrl}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyParentInviteUrl(activeStudentUrl, 'student')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F3EFEA] dark:bg-[#2C1215] hover:bg-[#E7E0D4] dark:hover:bg-[#4A1C20] text-[#44403C] dark:text-[#FAF8F5] text-[11px] font-semibold rounded-lg transition cursor-pointer shrink-0"
                          >
                            {copiedStudentInvite ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                                <span>Copied Link</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Invite Link</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {studentInviteMessage && (
                        <p className="text-[11px] font-medium text-[#C2410C] dark:text-[#FDBA74]">
                          {studentInviteMessage}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* School context */}
            <div className="text-[11px] text-[#78716C] border-t border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] pt-3 flex items-center justify-between">
              <span>{activeSchool.name}</span>
              <span className="font-mono">SEMIS: {activeSchool.semisCode}</span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    const target = viewingStudent;
                    setViewingStudent(null);
                    openEditModal(target);
                  }}
                  className="px-3.5 py-1.5 bg-[#FEF2F2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5] rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Edit Record
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewingStudent(null)}
                className="px-4 py-1.5 bg-[#2C1215] dark:bg-white text-white dark:text-[#1C1917] rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Student Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2C1215]/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#FEF2F2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5] flex items-center justify-center">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                    {editingStudent ? 'Edit Student Bio-Data' : 'New Student Admission (GR)'}
                  </h3>
                  <p className="text-[11px] text-[#78716C]">
                    Pakistani School Student Information System Record
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-1.5 text-[#78716C] hover:text-[#57534E] dark:hover:text-[#FAF8F5] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveStudent} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Student Full Name */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Student Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g., Muhammad Ali"
                    className="w-full px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden focus:ring-2 focus:ring-[#7F1D1D]"
                  />
                </div>

                {/* Father's Name */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Father's Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fatherName}
                    onChange={(e) => setFatherName(e.target.value)}
                    placeholder="e.g., Abdul Razzaq"
                    className="w-full px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden focus:ring-2 focus:ring-[#7F1D1D]"
                  />
                </div>

                {/* General Register (GR) Number */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    GR / Admission No. <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={grNumber}
                    onChange={(e) => setGrNumber(e.target.value)}
                    placeholder="e.g., GR-1050"
                    className="w-full px-3 py-2 font-mono font-bold bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#7F1D1D] dark:text-[#FCA5A5] focus:outline-hidden focus:ring-2 focus:ring-[#7F1D1D]"
                  />
                  <span className="text-[10px] text-[#78716C] mt-0.5 block">Unique General Register identifier</span>
                </div>

                {/* NADRA B-Form Number */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    NADRA B-Form No. (Optional)
                  </label>
                  <input
                    type="text"
                    value={bFormNumber}
                    onChange={(e) => setBFormNumber(e.target.value)}
                    placeholder="e.g., 41303-1234567-1"
                    className="w-full px-3 py-2 font-mono bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden focus:ring-2 focus:ring-[#7F1D1D]"
                  />
                  <span className="text-[10px] text-[#78716C] mt-0.5 block">National Child Registration Certificate</span>
                </div>

                {/* Class & Section */}
                <div>
                  <label htmlFor="admission-class-select" className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Class &amp; Section <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="admission-class-select"
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    required
                    disabled={loadingClasses}
                    className="w-full px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden focus:ring-2 focus:ring-[#7F1D1D] cursor-pointer disabled:opacity-60"
                  >
                    <option value="">
                      {loadingClasses
                        ? 'Loading classes from school...'
                        : classes.length === 0
                        ? '-- No Classes Configured --'
                        : '-- Select Class & Section --'}
                    </option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.grade} - {c.section} ({c.medium})
                      </option>
                    ))}
                  </select>
                  {!loadingClasses && classes.length === 0 && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 block">
                      No classes found in {activeSchool.name}. Add classes in Classes &amp; Sections first.
                    </span>
                  )}
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Gender <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setGender('Male')}
                      className={`py-2 text-xs font-semibold rounded-xl border transition cursor-pointer ${
                        gender === 'Male'
                          ? 'bg-[#FEF2F2] dark:bg-[#3F1014]/60 border-[#7F1D1D] text-[#7F1D1D] dark:text-[#FCA5A5]'
                          : 'bg-[#FAF8F5] dark:bg-[#2C1215] border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-[#57534E] dark:text-[#D6CCC2]'
                      }`}
                    >
                      👦 Male (Boy)
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender('Female')}
                      className={`py-2 text-xs font-semibold rounded-xl border transition cursor-pointer ${
                        gender === 'Female'
                          ? 'bg-pink-50 dark:bg-pink-950/60 border-pink-500 text-pink-700 dark:text-pink-300'
                          : 'bg-[#FAF8F5] dark:bg-[#2C1215] border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-[#57534E] dark:text-[#D6CCC2]'
                      }`}
                    >
                      👧 Female (Girl)
                    </button>
                  </div>
                </div>

                {/* Date of Birth */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Date of Birth <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden focus:ring-2 focus:ring-[#7F1D1D]"
                  />
                </div>

                {/* Admission Date */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Admission Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={admissionDate}
                    onChange={(e) => setAdmissionDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden focus:ring-2 focus:ring-[#7F1D1D]"
                  />
                </div>

                {/* Guardian Phone Number */}
                <div>
                  <label htmlFor="admission-guardian-phone" className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Guardian Phone No. <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="admission-guardian-phone"
                    type="tel"
                    required
                    value={guardianPhone}
                    onChange={(e) => setGuardianPhone(e.target.value)}
                    placeholder="e.g., 0300-1234567"
                    className="w-full px-3 py-2 font-mono bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden focus:ring-2 focus:ring-[#7F1D1D]"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Enrollment Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden focus:ring-2 focus:ring-[#7F1D1D] cursor-pointer"
                  >
                    <option value="active">Active (Enrolled)</option>
                    <option value="struck_off">Struck Off (Kharij)</option>
                    <option value="transferred">Transferred (SLC)</option>
                    <option value="graduated">Graduated (Passed)</option>
                  </select>
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                  Residential Address (Mohallah / Unit / City)
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g., House 42, Block D, Latifabad Unit 7, Hyderabad"
                  className="w-full px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden focus:ring-2 focus:ring-[#7F1D1D]"
                />
              </div>

              {/* Parent Email, Student Email & Photo (Optional) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-[#FAF8F5] dark:bg-[#2C1215]/50 border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl">
                <div>
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Parent Email (for Parent Portal Login)
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={parentEmail}
                      onChange={(e) => setParentEmail(e.target.value)}
                      placeholder="e.g., parent@gmail.com"
                      className="w-full pl-8 pr-3 py-2 bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden focus:ring-2 focus:ring-[#7F1D1D]"
                    />
                  </div>
                  <span className="text-[10px] text-[#78716C] mt-1 block">
                    Matches automatically when the parent creates a Parent Portal account.
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Student Email (for Student Portal Login)
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                      placeholder="e.g., student@gmail.com"
                      className="w-full pl-8 pr-3 py-2 bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden focus:ring-2 focus:ring-[#C2410C]"
                    />
                  </div>
                  <span className="text-[10px] text-[#78716C] mt-1 block">
                    Optional pre-verified login email for the Student Portal.
                  </span>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Student Photo (Optional — JPEG/PNG)
                  </label>
                  <div className="flex items-center gap-2.5">
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt="Student preview"
                        className="w-10 h-10 rounded-xl object-cover border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] dark:bg-[#3F1014]/60 border border-[#FECACA] dark:border-[#7F1D1D]/60 flex items-center justify-center text-[#7F1D1D] shrink-0">
                        <Camera className="w-4 h-4" />
                      </div>
                    )}
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FFFDF9] dark:bg-[#211415] hover:bg-[#F3EFEA] dark:hover:bg-[#3F1014] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-lg text-[11px] font-semibold text-[#44403C] dark:text-[#FAF8F5] cursor-pointer transition">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{photoUrl ? 'Change Photo' : 'Upload Photo'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => handlePhotoUpload(e.target.files?.[0])}
                        className="hidden"
                      />
                    </label>
                    {photoUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoUrl('');
                          setPhotoError(null);
                        }}
                        className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {photoError && (
                    <span className="text-[10px] text-rose-500 mt-1 block font-medium">
                      {photoError}
                    </span>
                  )}
                </div>
              </div>

              {/* Permanent Fee Concession / Scholarship (Admin Only) */}
              {isAdmin && (
                <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl">
                  <label htmlFor="admission-concession-select" className="block text-[11px] font-bold text-amber-900 dark:text-amber-200 mb-1">
                    Permanent Fee Concession / Scholarship (Optional — Admin Only)
                  </label>
                  <select
                    id="admission-concession-select"
                    value={selectedConcessionId}
                    onChange={(e) => setSelectedConcessionId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FFFDF9] dark:bg-[#211415] border border-amber-300 dark:border-amber-700 rounded-xl text-xs font-semibold text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="">-- No Permanent Discount (Standard Fee) --</option>
                    {feeConcessions
                      .filter((r) => r.isActive !== false)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title} ({r.discountType === 'fixed' ? `Rs. ${r.value} off` : `${r.value}% off`})
                        </option>
                      ))}
                  </select>
                  <span className="text-[10px] text-amber-700 dark:text-amber-300 mt-1 block">
                    Automatically applied whenever monthly fee vouchers or collections are generated for this student.
                  </span>
                </div>
              )}

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 bg-[#F3EFEA] dark:bg-[#2C1215] hover:bg-[#E7E0D4] dark:hover:bg-[#4A1C20] text-[#44403C] dark:text-[#E7E0D4] text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#7F1D1D] hover:bg-[#651414] text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
                >
                  {editingStudent ? 'Save Changes' : 'Confirm Admission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
