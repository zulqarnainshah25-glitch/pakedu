import React from 'react';
import {
  School as SchoolIcon,
  GraduationCap,
  Users,
  CalendarCheck2,
  UserCheck,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  BookOpen,
  Award,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { useSms } from '../context/SmsContext';

interface SmsDashboardProps {
  onNavigateToClasses: () => void;
  onNavigateToStudents: () => void;
  onNavigateToAttendance: (classId?: string) => void;
  onNavigateToStaff?: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToExams?: () => void;
}

export const SmsDashboard: React.FC<SmsDashboardProps> = ({
  onNavigateToClasses,
  onNavigateToStudents,
  onNavigateToAttendance,
  onNavigateToStaff,
  onNavigateToProfile,
  onNavigateToExams,
}) => {
  const {
    userRole,
    setUserRole,
    demoMode,
    setDemoMode,
    currentUserProfile,
    activeSchool,
    classes,
    filteredClassesForUser,
    teachers,
    stats,
    activeTeacher,
    attendanceRegisters,
    todayAttendanceStats,
    pendingJoinRequests,
  } = useSms();

  const isAdmin = userRole === 'admin' || userRole === 'principal';
  const todayDate = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      {/* Suspended Alert Banner */}
      {activeSchool.status === 'suspended' && (
        <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 p-4 rounded-2xl flex items-start gap-3 shadow-xs animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-bold text-sm">Institution Suspended by Super Admin</h3>
            <p className="text-xs text-rose-700 dark:text-rose-300">
              This school's portal access is under administrative suspension ({activeSchool.suspendedReason || 'Policy & Compliance Review'}). Attendance submissions and alterations are locked. Contact your District Education Officer or Portal Super Admin.
            </p>
          </div>
        </div>
      )}

      {/* Top Welcome & Role Switcher Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>School Management System · Phase 3 Operational</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              {activeSchool.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Command Center for real-time admissions, daily attendance ledgers, faculty allocations, and school analytics.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
              <span>SEMIS: <strong className="text-white font-mono">{activeSchool.semisCode}</strong></span>
              <span>·</span>
              <span>District: <strong className="text-white">{activeSchool.district}</strong></span>
              <span>·</span>
              <span>Session: <strong className="text-emerald-400">{activeSchool.activeAcademicYear}</strong></span>
            </div>
          </div>

          {/* Persona Card: Demo Switcher vs Real Verified Profile */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3.5 flex flex-col gap-2 shrink-0">
            <div className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
              <span>{demoMode ? '🧪 Demo Sandbox Persona:' : '🛡️ Verified Identity:'}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                {userRole.toUpperCase()}
              </span>
            </div>

            {demoMode ? (
              <>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setUserRole('admin')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      isAdmin
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-700/70 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    👑 Admin View
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserRole('teacher')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      !isAdmin
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-700/70 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    🧑‍🏫 Teacher View
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-amber-300/80">Demo Role Switcher Active</span>
                  <button
                    type="button"
                    onClick={() => setDemoMode(false)}
                    className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    Turn Off Demo
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>
                    {currentUserProfile?.fullName || 'Verified Institutional User'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-300">
                  Role: <strong>{isAdmin ? 'School Administrator' : 'Class Teacher'}</strong> · {activeSchool.name}
                </div>
                <button
                  type="button"
                  onClick={() => setDemoMode(true)}
                  className="mt-1 text-[10px] text-indigo-300 hover:text-indigo-200 underline block cursor-pointer"
                >
                  Enable Demo Mode for Testing →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Admin Alert: Pending Join Requests */}
      {isAdmin && pendingJoinRequests.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-amber-900 dark:text-amber-100">
                {pendingJoinRequests.length} Faculty Join Request{pendingJoinRequests.length > 1 ? 's' : ''} Awaiting Your Approval
              </div>
              <div className="text-[11px] text-amber-700 dark:text-amber-300">
                Teachers have submitted applications to join {activeSchool.name}. Review their credentials and assign classes.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onNavigateToStaff}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition shadow-2xs cursor-pointer self-start sm:self-auto shrink-0"
          >
            Review &amp; Approve →
          </button>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Enrolled Students</span>
            <Users className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
            {stats.totalStudents}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Across {stats.totalClasses} grade sections</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Class Sections</span>
            <GraduationCap className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
            {stats.totalClasses}
          </div>
          <div className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-0.5">English, Urdu &amp; Sindhi</div>
        </div>

        <div
          onClick={onNavigateToStaff}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Faculty Members</span>
            <UserCheck className="w-4 h-4 text-sky-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums flex items-center justify-between">
            <span>{stats.totalTeachers}</span>
            {isAdmin && pendingJoinRequests.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-white font-bold animate-pulse">
                +{pendingJoinRequests.length} pending
              </span>
            )}
          </div>
          <div className="text-[11px] text-sky-600 dark:text-sky-400 mt-0.5">
            {isAdmin ? 'Manage Staff & Requests →' : 'Assigned Incharges'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Today's Attendance</span>
            <CalendarCheck2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
            {todayAttendanceStats.overallPercentage}%
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>{todayAttendanceStats.totalMarkedClasses} of {classes.length} classes recorded</span>
          </div>
        </div>
      </div>

      {/* Real-Time Attendance Command Center & Breakdown */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Today's Attendance Ledger ({todayDate})
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                Composite Sync
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live status across classes for {isAdmin ? 'all institutional sections' : 'your assigned class sections'}.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigateToAttendance()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer self-start sm:self-auto"
          >
            <CalendarCheck2 className="w-4 h-4" />
            <span>Open Attendance Register</span>
          </button>
        </div>

        {/* Breakdown bar */}
        {todayAttendanceStats.totalStudentsRecorded > 0 && (
          <div className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Attendance Breakdown ({todayAttendanceStats.totalStudentsRecorded} recorded students)
              </span>
              <div className="flex items-center gap-3 text-[11px] font-medium">
                <span className="text-emerald-600 dark:text-emerald-400">
                  Present: {todayAttendanceStats.totalPresent}
                </span>
                <span className="text-sky-600 dark:text-sky-400">
                  Late: {todayAttendanceStats.totalLate}
                </span>
                <span className="text-amber-600 dark:text-amber-400">
                  Leave: {todayAttendanceStats.totalLeave}
                </span>
                <span className="text-rose-600 dark:text-rose-400">
                  Absent: {todayAttendanceStats.totalAbsent}
                </span>
              </div>
            </div>

            <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
              <div
                style={{
                  width: `${(todayAttendanceStats.totalPresent / todayAttendanceStats.totalStudentsRecorded) * 100}%`,
                }}
                className="bg-emerald-500 h-full"
                title={`Present: ${todayAttendanceStats.totalPresent}`}
              />
              <div
                style={{
                  width: `${(todayAttendanceStats.totalLate / todayAttendanceStats.totalStudentsRecorded) * 100}%`,
                }}
                className="bg-sky-500 h-full"
                title={`Late: ${todayAttendanceStats.totalLate}`}
              />
              <div
                style={{
                  width: `${(todayAttendanceStats.totalLeave / todayAttendanceStats.totalStudentsRecorded) * 100}%`,
                }}
                className="bg-amber-400 h-full"
                title={`Leave: ${todayAttendanceStats.totalLeave}`}
              />
              <div
                style={{
                  width: `${(todayAttendanceStats.totalAbsent / todayAttendanceStats.totalStudentsRecorded) * 100}%`,
                }}
                className="bg-rose-500 h-full"
                title={`Absent: ${todayAttendanceStats.totalAbsent}`}
              />
            </div>
          </div>
        )}

        {/* Class-wise Attendance Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
          {filteredClassesForUser.map((cls) => {
            const regKey = `${todayDate}_${cls.id}`;
            const reg = attendanceRegisters[regKey];
            const isMarked = !!reg;

            return (
              <div
                key={cls.id}
                className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-xl flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-700 transition"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      {cls.grade} - {cls.section}
                    </span>
                    {isMarked ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{reg.summary.percentage}% Present</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        <Clock className="w-3 h-3" />
                        <span>Pending</span>
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
                    <div>Medium: <strong className="text-slate-700 dark:text-slate-300">{cls.medium}</strong></div>
                    <div>Incharge: <strong className="text-slate-700 dark:text-slate-300">{cls.classTeacherName}</strong></div>
                  </div>

                  {isMarked && (
                    <div className="mt-2 text-[10px] text-slate-500 flex items-center justify-between">
                      <span>P: {reg.summary.present} · A: {reg.summary.absent} · L: {reg.summary.leave}</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        {reg.summary.percentage}%
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">
                    Roll: {cls.totalStudents || 0} students
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigateToAttendance(cls.id)}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 cursor-pointer"
                  >
                    {isMarked ? 'Review / Edit →' : 'Take Roll Call →'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Core SMS Modules Grid */}
      <div>
        <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
          School Management Modules
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Module 1: Classes & Sections */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Ready (Phase 1)
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Classes &amp; Sections
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Configure grade levels (KG–Class 12), instruction mediums, class teachers, room allocations, and student capacities.
              </p>
            </div>

            <button
              type="button"
              onClick={onNavigateToClasses}
              className="mt-4 inline-flex items-center justify-between w-full px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              <span>Manage Classes ({classes.length})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Module 2: Student Information System */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Ready (Phase 2)
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Student Register (SIS)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                General Register (GR) records, B-Form integration, guardian contact details, class transfers, and student profile management.
              </p>
            </div>

            <button
              type="button"
              onClick={onNavigateToStudents}
              className="mt-4 inline-flex items-center justify-between w-full px-3.5 py-2 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              <span>Manage Students ({stats.totalStudents})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Module 3: Daily Attendance Register */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <CalendarCheck2 className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Ready (Phase 3)
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Daily Attendance Register
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                1-click batch attendance, composite daily documents, A4 printable registers, and live percentage summaries.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigateToAttendance()}
              className="mt-4 inline-flex items-center justify-between w-full px-3.5 py-2 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              <span>Take Roll Call ({todayAttendanceStats.totalMarkedClasses}/{classes.length} Marked)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Module 4: Exams & Results */}
          {onNavigateToExams && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <Award className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    Phase B Live
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Exams &amp; Report Cards
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Admin exam scheduling, subject marks entry for assigned classes, class positions, and printable A4 Report Cards.
                </p>
              </div>

              <button
                type="button"
                onClick={onNavigateToExams}
                className="mt-4 inline-flex items-center justify-between w-full px-3.5 py-2 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                <span>Open Exams &amp; Results</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
