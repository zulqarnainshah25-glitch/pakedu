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
  } = useSms();

  const isTeacher = userRole === 'teacher';
  const displayName = currentUserProfile?.fullName || activeTeacher.name;
  const designation = currentUserProfile?.designation || activeTeacher.designation;
  const email = currentUserProfile?.email || activeTeacher.email;
  const phone = currentUserProfile?.phone || activeTeacher.phone || '0300-1122334';
  const cnic = currentUserProfile?.cnic || '41303-1234567-1';

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
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Institutional credentials and allocated teaching responsibilities
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Profile Info Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-2xl shadow-xs shrink-0">
            {displayName.charAt(0)}
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
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {activeSchool.name} · Department of School Education, Govt. of Sindh
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-5 text-xs">
          <div>
            <span className="text-[11px] text-slate-400 block">Government Email</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
              {email}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-slate-400 block">Personal Phone</span>
            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 block">
              {phone}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-slate-400 block">CNIC Number</span>
            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 block">
              {cnic}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-slate-400 block">SEMIS Affiliation</span>
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 block">
              {activeSchool.semisCode}
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
              My Assigned Classes &amp; Incharge Registers ({filteredClassesForUser.length})
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Class sections where you are officially designated as the Class Teacher or Subject Incharge.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {filteredClassesForUser.map((cls) => {
            const isIncharge = cls.classTeacherId === activeTeacher.id;

            return (
              <div
                key={cls.id}
                className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-bold text-sm text-slate-900 dark:text-white block">
                      {cls.grade} - {cls.section}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Medium: {cls.medium} · Room: {cls.roomNumber || 'Assigned'}
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
                  <span>Enrolled: <strong>{cls.totalStudents || 0} students</strong></span>
                  <span>Session: <strong>{cls.academicYear}</strong></span>
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
      </div>
    </div>
  );
};
