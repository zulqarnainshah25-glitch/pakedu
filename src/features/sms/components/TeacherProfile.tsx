import React from 'react';
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
} from 'lucide-react';
import { useSms } from '../context/SmsContext';

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
  } = useSms();

  const isTeacher = userRole === 'teacher';
  const displayName = currentUserProfile?.fullName || activeTeacher?.name || 'Teacher';
  const fatherName = currentUserProfile?.fatherName || activeTeacher?.fatherName || '';
  const designation = currentUserProfile?.designation || activeTeacher?.designation || 'Teacher';
  const email = currentUserProfile?.email || activeTeacher?.email || '';
  const phone = currentUserProfile?.phone || activeTeacher?.phone || '0300-1122334';
  const cnic = currentUserProfile?.cnic || activeTeacher?.cnic || '41303-1234567-1';
  const joiningDate = currentUserProfile?.joiningDate || activeTeacher?.joiningDate || '2023-08-15';
  const schoolName = activeSchool?.name || currentUserProfile?.schoolName || 'Govt. Secondary School';
  const semisCode = activeSchool?.semisCode || currentUserProfile?.semisCode || '403020101';
  const assignedClassesList = filteredClassesForUser || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
                  Teacher Profile &amp; Teaching Portfolio (پروفائل)
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Verified Faculty
                </span>
                {canAdmitStudents && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                    <Award className="w-3 h-3 text-amber-600" />
                    Admission Incharge
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Institutional credentials and allocated teaching responsibilities
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Profile Info Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-2xl shadow-xs shrink-0">
              {displayName ? displayName.charAt(0).toUpperCase() : 'T'}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {displayName}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {designation}
                </span>
              </div>
              {fatherName && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  S/D/O {fatherName}
                </p>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {schoolName} · Department of School Education, Govt. of Sindh
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-mono">
              SEMIS: {semisCode}
            </span>
          </div>
        </div>

        {/* Institutional Authority Badge */}
        {canAdmitStudents ? (
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
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 rounded-xl text-xs flex items-center gap-2.5 text-slate-600 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              Standard Faculty Role: Authorized to conduct roll call and view student records for your assigned classes.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 pt-2 text-xs">
          <div>
            <span className="text-[11px] text-slate-400 block">Government Email</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
              {email || '—'}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-slate-400 block">Personal Phone</span>
            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 block">
              {phone || '—'}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-slate-400 block">CNIC Number</span>
            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 block">
              {cnic || '—'}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-slate-400 block">Appointment Date</span>
            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 block">
              {joiningDate || '—'}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-slate-400 block">Institutional Role</span>
            <span className="font-semibold text-indigo-600 dark:text-indigo-400 block">
              {canAdmitStudents ? 'Admission Incharge' : 'Class Teacher'}
            </span>
          </div>
        </div>
      </div>

      {/* Teaching Portfolio & Assigned Classes */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              My Assigned Classes &amp; Incharge Registers ({assignedClassesList.length})
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Class sections where you are officially designated as the Class Teacher or Subject Incharge.
          </p>
        </div>

        {assignedClassesList.length === 0 ? (
          <div className="text-center py-8 px-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
            <GraduationCap className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              No Class Registers Assigned Yet
            </p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
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
                  className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-sm text-slate-900 dark:text-white block">
                        {cls.grade || 'Class'} - {cls.section || 'A'}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Medium: {cls.medium || 'Sindhi'} · Room: {cls.roomNumber || 'Assigned'}
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isIncharge
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                      }`}
                    >
                      {isIncharge ? 'Class Incharge' : 'Subject Teacher'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 flex items-center justify-between pt-1">
                    <span>Enrolled: <strong>{cls.totalStudents ?? 0} students</strong></span>
                    <span>Session: <strong>{cls.academicYear || '2025-2026'}</strong></span>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center gap-2">
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
                      className="flex-1 py-1.5 px-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
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
    </div>
  );
};
