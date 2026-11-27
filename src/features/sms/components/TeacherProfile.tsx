import React, { useState } from 'react';
import {
  UserCheck,
  School as SchoolIcon,
  GraduationCap,
  Users,
  CalendarCheck2,
  Mail,
  Phone,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Building,
  ArrowRight,
  Award,
  Key,
  FileText,
  Banknote,
  Download,
  Lock,
  Bell,
  CheckCircle2,
} from 'lucide-react';
import { useSms } from '../context/SmsContext';
import { AppointmentLetterModal } from './AppointmentLetterModal';
import { PayslipPreviewModal } from './PayslipPreviewModal';
import { EmployeePayslip } from '../types';

interface TeacherProfileProps {
  onBack: () => void;
  onNavigateToAttendance: (classId?: string) => void;
  onNavigateToStudents: (classId?: string) => void;
}

export const TeacherProfile: React.FC<TeacherProfileProps> = ({
  onBack,
  onNavigateToAttendance,
  onNavigateToStudents,
}) => {
  const {
    activeTeacher,
    activeSchool,
    classes,
    filteredClassesForUser,
    userRole,
    currentUserProfile,
    canAdmitStudents,
    demoMode,
    canViewOwnPayslips,
    ownTeacherSalaryStructure,
    hasUnreadSalaryStructureUpdate,
    dismissTeacherSalaryNotification,
    ownTeacherPayslips,
    payrollSettings,
  } = useSms();

  const [appointmentLetterOpen, setAppointmentLetterOpen] = useState(false);
  const [selectedOwnPayslip, setSelectedOwnPayslip] = useState<EmployeePayslip | null>(null);

  const isAdmin = userRole === 'admin' || userRole === 'principal';
  const isApprovedFaculty =
    demoMode || isAdmin || currentUserProfile?.status === 'active';
  const displayName = currentUserProfile?.fullName || activeTeacher?.name || (isAdmin ? 'School Administrator' : 'Teacher');
  const fatherName = currentUserProfile?.fatherName || activeTeacher?.fatherName || '';
  const designation = currentUserProfile?.designation || activeTeacher?.designation || (isAdmin ? 'Principal / Headmaster' : 'Teacher');
  const email = currentUserProfile?.email || activeTeacher?.email || '';
  const phone = currentUserProfile?.phone || activeTeacher?.phone || '0300-1122334';
  const cnic = currentUserProfile?.cnic || activeTeacher?.cnic || '41303-1234567-1';
  const joiningDate = currentUserProfile?.joiningDate || activeTeacher?.joiningDate || '2023-08-15';
  const schoolName = activeSchool?.name || currentUserProfile?.schoolName || 'Govt. Secondary School';
  const semisCode = activeSchool?.semisCode || currentUserProfile?.semisCode || '403020101';
  const assignedClassesList = isAdmin ? (classes || []) : (filteredClassesForUser || []);
  const assignedClassesSummary =
    assignedClassesList.length > 0
      ? assignedClassesList.map((c) => `${c.grade} - ${c.section}`).join(', ')
      : 'General Faculty Duties';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
                  {isAdmin
                    ? 'School Admin & Institutional Profile (اسکول و انتظامی پروفائل)'
                    : 'Teacher Profile & Teaching Portfolio (پروفائل)'}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {isAdmin ? 'Verified Administrator' : 'Verified Faculty'}
                </span>
                {!isAdmin && canAdmitStudents && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                    <Award className="w-3 h-3 text-amber-600" />
                    Admission Incharge
                  </span>
                )}
              </div>
              <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-0.5">
                {isAdmin
                  ? 'Official institutional credentials, administrative authority, and school registration details'
                  : 'Institutional credentials and allocated teaching responsibilities'}
              </p>
            </div>
          </div>

          {isApprovedFaculty && (
            <button
              type="button"
              onClick={() => setAppointmentLetterOpen(true)}
              className="min-h-[44px] sm:min-h-[40px] w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#7F1D1D] hover:bg-[#651414] text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer shrink-0"
            >
              <FileText className="w-4 h-4" />
              <span>Generate Appointment Letter</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Profile Info Card */}
      <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#FEE2E2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5] flex items-center justify-center font-bold text-2xl shadow-xs shrink-0">
              {displayName ? displayName.charAt(0).toUpperCase() : (isAdmin ? 'A' : 'T')}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                  {displayName}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FEF2F2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5] border border-[#FECACA] dark:border-[#7F1D1D]/60">
                  {designation}
                </span>
              </div>
              {fatherName && (
                <p className="text-xs text-[#57534E] dark:text-[#D6CCC2]">
                  S/D/O {fatherName}
                </p>
              )}
              <p className="text-xs text-[#57534E] dark:text-[#D6CCC2]">
                {schoolName} · Department of School Education, Govt. of Sindh
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-[#F3EFEA] dark:bg-[#2C1215] text-[#44403C] dark:text-[#E7E0D4] text-xs font-mono">
              SEMIS: {semisCode}
            </span>
          </div>
        </div>

        {/* Institutional Authority Badge */}
        {isAdmin ? (
          <div className="p-3.5 bg-[#FEF2F2]/80 dark:bg-[#3F1014]/40 border border-[#FECACA] dark:border-[#7F1D1D]/60 rounded-xl text-xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FEE2E2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-[#7F1D1D] dark:text-[#FCA5A5]">
                School Principal / Head Administrator (پرنسپل / ہیڈ ماسٹر)
              </div>
              <div className="text-[11px] text-[#7F1D1D]/90 dark:text-[#FCA5A5] mt-0.5">
                Full institutional administrative control over faculty approvals, SIS student admissions, class section management, and official school records.
              </div>
            </div>
          </div>
        ) : canAdmitStudents ? (
          <div className="p-3.5 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl text-xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-amber-950 dark:text-amber-200">
                Official Admission Incharge (مجاز داخلہ انچارج)
              </div>
              <div className="text-[11px] text-amber-800/90 dark:text-amber-300/80 mt-0.5">
                Authorized by School Administration with elevated privileges: You can admit new students (+ Admit New Student), issue General Register (GR) numbers, and update student bio-data in the SIS Register.
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-[#FAF8F5] dark:bg-[#2C1215]/50 border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs flex items-center gap-2.5 text-[#57534E] dark:text-[#D6CCC2]">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              Standard Faculty Role: Authorized to conduct roll call and view student records for your assigned classes.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 pt-2 text-xs">
          <div>
            <span className="text-[11px] text-[#78716C] block">Government Email</span>
            <span className="font-semibold text-[#1C1917] dark:text-[#FAF8F5] truncate block">
              {email || '—'}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-[#78716C] block">Personal Phone</span>
            <span className="font-mono font-semibold text-[#1C1917] dark:text-[#FAF8F5] block">
              {phone || '—'}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-[#78716C] block">CNIC Number</span>
            <span className="font-mono font-semibold text-[#1C1917] dark:text-[#FAF8F5] block">
              {cnic || '—'}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-[#78716C] block">Appointment Date</span>
            <span className="font-mono font-semibold text-[#1C1917] dark:text-[#FAF8F5] block">
              {joiningDate || '—'}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-[#78716C] block">Institutional Role</span>
            <span className="font-semibold text-[#7F1D1D] dark:text-[#FCA5A5] block">
              {isAdmin
                ? 'Head Administrator'
                : canAdmitStudents
                ? 'Admission Incharge'
                : 'Class Teacher'}
            </span>
          </div>
        </div>
      </div>

      {/* Teaching Portfolio & Assigned Classes */}
      <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-[#7F1D1D] dark:text-[#FCA5A5]" />
            <h2 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
              {isAdmin
                ? `School Class Sections & Registers (${assignedClassesList.length})`
                : `My Assigned Classes & Incharge Registers (${assignedClassesList.length})`}
            </h2>
          </div>
          <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-0.5">
            {isAdmin
              ? 'Institutional class sections registered under this school administration.'
              : 'Class sections where you are officially designated as the Class Teacher or Subject Incharge.'}
          </p>
        </div>

        {assignedClassesList.length === 0 ? (
          <div className="text-center py-8 px-4 bg-[#FAF8F5] dark:bg-[#2C1215]/40 rounded-xl border border-dashed border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
            <GraduationCap className="w-8 h-8 text-[#78716C] mx-auto mb-2 opacity-50" />
            <p className="text-xs font-semibold text-[#44403C] dark:text-[#E7E0D4]">
              No Class Registers Assigned Yet
            </p>
            <p className="text-[11px] text-[#78716C] mt-1 max-w-sm mx-auto">
              Your School Administrator or Principal has not yet allocated class registers to your profile under &ldquo;Faculty &amp; Requests&rdquo;.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {assignedClassesList.map((cls) => {
              if (!cls) return null;
              const isIncharge = cls.classTeacherId === (activeTeacher?.id || currentUserProfile?.uid);

              return (
                <div
                  key={cls.id || Math.random()}
                  className="p-4 bg-[#FAF8F5] dark:bg-[#2C1215]/60 border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-sm text-[#1C1917] dark:text-[#FAF8F5] block">
                        {cls.grade || 'Class'} - {cls.section || 'A'}
                      </span>
                      <span className="text-[11px] text-[#57534E] dark:text-[#D6CCC2]">
                        Medium: {cls.medium || 'Sindhi'} · Room: {cls.roomNumber || 'Assigned'}
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isIncharge
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-[#FEF2F2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5] border border-[#FECACA] dark:border-[#7F1D1D]/60'
                      }`}
                    >
                      {isIncharge ? 'Class Incharge' : 'Subject Teacher'}
                    </span>
                  </div>

                  <div className="text-xs text-[#57534E] flex items-center justify-between pt-1">
                    <span>Enrolled: <strong>{cls.totalStudents ?? 0} students</strong></span>
                    <span>Session: <strong>{cls.academicYear || '2025-2026'}</strong></span>
                  </div>

                  <div className="pt-2 border-t border-[#E7E0D4]/60 dark:border-[rgba(255,253,249,0.14)] flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onNavigateToAttendance(cls.id)}
                      className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <CalendarCheck2 className="w-3.5 h-3.5" />
                      <span>Roll Call</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onNavigateToStudents(cls.id)}
                      className="flex-1 py-1.5 px-3 bg-[#F3EFEA] dark:bg-[#3F1014] hover:bg-[#E7E0D4] dark:hover:bg-slate-600 text-[#44403C] dark:text-[#FAF8F5] rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Students</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Self-Service Monthly Salary Payslips & Live Salary Structure Notification */}
      <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-6 shadow-sm space-y-4">
        {hasUnreadSalaryStructureUpdate && ownTeacherSalaryStructure && (
          <div className="p-4 rounded-xl bg-[#FFF7ED] dark:bg-[#7C2D12]/40 border border-[#FED7AA] dark:border-[#C2410C]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#C2410C] text-white flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#9A3412] dark:text-[#FDBA74]">
                  Your salary structure has been updated by Admin ({ownTeacherSalaryStructure.updatedByName || 'School Admin'})
                </div>
                <div className="text-[11px] text-[#7C2D12]/90 dark:text-[#FED7AA]/90 mt-0.5">
                  New Configured Net Pay: <strong className="font-mono">Rs. {(ownTeacherSalaryStructure.netSalary || 0).toLocaleString()}</strong>
                  {ownTeacherSalaryStructure.updatedAt
                    ? ` · Updated ${new Date(ownTeacherSalaryStructure.updatedAt).toLocaleString()}`
                    : ''}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissTeacherSalaryNotification}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C2410C] hover:bg-[#9A3412] text-white text-[11px] font-bold transition cursor-pointer shrink-0 self-start sm:self-center"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Acknowledge</span>
            </button>
          </div>
        )}

        {ownTeacherSalaryStructure && (
          <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-[#2C1215]/60 border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase text-[#78716C] block">Basic Salary</span>
              <strong className="font-mono text-[#1C1917] dark:text-[#FAF8F5]">
                Rs. {(ownTeacherSalaryStructure.basicSalary || 0).toLocaleString()}
              </strong>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-[#78716C] block">Allowances</span>
              <strong className="font-mono text-emerald-700 dark:text-emerald-400">
                + Rs. {(ownTeacherSalaryStructure.totalAllowances || 0).toLocaleString()}
              </strong>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-[#78716C] block">Deductions</span>
              <strong className="font-mono text-rose-700 dark:text-rose-400">
                - Rs. {(ownTeacherSalaryStructure.totalDeductions || 0).toLocaleString()}
              </strong>
            </div>
            <div className="sm:text-right">
              <span className="text-[10px] font-bold uppercase text-[#78716C] block">Configured Net Pay</span>
              <strong className="font-mono text-[#7F1D1D] dark:text-[#FCA5A5]">
                Rs. {(ownTeacherSalaryStructure.netSalary || 0).toLocaleString()}
              </strong>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-[#7F1D1D] dark:text-[#FCA5A5]" />
            <div>
              <h2 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                My Monthly Salary Payslips (میری تنخواہ سلپس)
              </h2>
              <p className="text-xs text-[#57534E] dark:text-[#D6CCC2]">
                View and download PDF copies of your own finalized monthly salary vouchers
              </p>
            </div>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0 self-start sm:self-auto ${
              canViewOwnPayslips
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : 'bg-[#F3EFEA] dark:bg-[#2C1215] text-[#57534E] dark:text-[#D6CCC2] border-[#E7E0D4]'
            }`}
          >
            {canViewOwnPayslips ? 'Own Payslips Enabled' : 'Disabled by Admin'}
          </span>
        </div>

        {!payrollSettings.teacherPayslipAccessEnabled || !canViewOwnPayslips ? (
          <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-[#2C1215]/50 border border-dashed border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] flex items-center gap-3 text-xs text-[#57534E] dark:text-[#D6CCC2]">
            <Lock className="w-4 h-4 text-[#78716C] shrink-0" />
            <span>
              Self-service payslip access is currently disabled by your School Administration.
            </span>
          </div>
        ) : ownTeacherPayslips.length === 0 ? (
          <div className="py-8 px-4 text-center bg-[#FAF8F5] dark:bg-[#2C1215]/40 rounded-xl border border-dashed border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] space-y-1">
            <Banknote className="w-7 h-7 text-[#78716C] mx-auto opacity-50" />
            <p className="text-xs font-semibold text-[#44403C] dark:text-[#E7E0D4]">
              No Finalized Payslips Available Yet
            </p>
            <p className="text-[11px] text-[#78716C] max-w-md mx-auto">
              Once School Administration finalizes your monthly payroll under Salary &amp; Payroll, your downloadable PDF payslips will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ownTeacherPayslips.map((slip) => (
              <div
                key={slip.id}
                className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-[#2C1215]/60 border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                      {slip.monthLabel}
                    </div>
                    <div className="text-[11px] font-mono text-[#78716C]">
                      {slip.payslipNumber}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      slip.status === 'paid'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    {slip.status === 'paid' ? 'Paid' : 'Finalized'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px] pt-2 border-t border-[#E7E0D4]/60 dark:border-[rgba(255,253,249,0.12)]">
                  <div>
                    <span className="text-[#78716C] block">Basic + Allow.</span>
                    <strong className="font-mono text-[#1C1917] dark:text-[#FAF8F5]">
                      Rs. {(slip.grossSalary || 0).toLocaleString()}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#78716C] block">Deductions</span>
                    <strong className="font-mono text-rose-700 dark:text-rose-400">
                      - Rs. {(slip.totalDeductions || 0).toLocaleString()}
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-[#78716C] block">Net Salary</span>
                    <strong className="font-mono text-[#7F1D1D] dark:text-[#FCA5A5]">
                      Rs. {(slip.netSalary || 0).toLocaleString()}
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedOwnPayslip(slip)}
                  className="min-h-[40px] w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#7F1D1D] hover:bg-[#651414] text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>View / Download PDF Payslip</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AppointmentLetterModal
        isOpen={appointmentLetterOpen}
        onClose={() => setAppointmentLetterOpen(false)}
        teacherName={displayName}
        fatherName={fatherName}
        designation={designation}
        cnic={cnic}
        email={email}
        phone={phone}
        joiningDate={joiningDate}
        assignedClassesLabel={assignedClassesSummary}
        school={activeSchool}
      />

      <PayslipPreviewModal
        isOpen={Boolean(selectedOwnPayslip)}
        onClose={() => setSelectedOwnPayslip(null)}
        school={activeSchool}
        payslip={selectedOwnPayslip}
      />
    </div>
  );
};
