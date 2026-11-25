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
  CalendarDays,
  FileBadge2,
  Bell,
  Megaphone,
  Eye,
  Lock,
  KeyRound,
  Copy,
  Check,
} from 'lucide-react';
import { useSms } from '../context/SmsContext';

interface SmsDashboardProps {
  onNavigateToClasses: () => void;
  onNavigateToStudents: () => void;
  onNavigateToAttendance: (classId?: string) => void;
  onNavigateToStaff?: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToExams?: () => void;
  onNavigateToTimetable?: () => void;
  onNavigateToHomework?: () => void;
  onNavigateToCertificates?: () => void;
}

export const SmsDashboard: React.FC<SmsDashboardProps> = ({
  onNavigateToClasses,
  onNavigateToStudents,
  onNavigateToAttendance,
  onNavigateToStaff,
  onNavigateToProfile,
  onNavigateToExams,
  onNavigateToTimetable,
  onNavigateToHomework,
  onNavigateToCertificates,
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
    isReadOnlyImpersonation,
    globalNotices,
    unreadNoticesCount,
    markNoticeAsRead,
    students,
    studentPortalLinks,
    generateStudentInviteForStudent,
    generateMissingStudentInvites,
  } = useSms();

  const [dashboardTab, setDashboardTab] = React.useState<'overview' | 'notifications'>('overview');
  const [copiedStudentCodeId, setCopiedStudentCodeId] = React.useState<string | null>(null);
  const [isBulkGeneratingInvites, setIsBulkGeneratingInvites] = React.useState(false);
  const [inviteActionFeedback, setInviteActionFeedback] = React.useState<string | null>(null);
  const isAdmin =
    userRole === 'admin' || userRole === 'principal' || isReadOnlyImpersonation;
  const todayDate = new Date().toISOString().split('T')[0];

  const recentStudentsForInvites = React.useMemo(() => {
    return [...students]
      .sort((a, b) => (b.admissionDate || '').localeCompare(a.admissionDate || ''))
      .slice(0, 8);
  }, [students]);

  const missingStudentInvitesCount = React.useMemo(
    () => students.filter((s) => !s.studentInviteCode && Boolean(s.grNumber)).length,
    [students]
  );

  const handleCopyAdminStudentInvite = async (value: string, rowKey: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedStudentCodeId(rowKey);
      setTimeout(() => setCopiedStudentCodeId(null), 2000);
    } catch {
      setInviteActionFeedback('Unable to copy automatically. Please copy the code directly.');
    }
  };

  const handleGenerateAllMissingInvites = async () => {
    setIsBulkGeneratingInvites(true);
    setInviteActionFeedback(null);
    try {
      const count = await generateMissingStudentInvites();
      setInviteActionFeedback(
        count > 0
          ? `Generated Student Invite Codes for ${count} student(s).`
          : 'All students already have active Student Invite Codes.'
      );
    } finally {
      setIsBulkGeneratingInvites(false);
    }
  };

  const schoolNotices = React.useMemo(() => {
    return globalNotices.filter(
      (n) =>
        n.targetType === 'all' ||
        (activeSchool.id && (n.targetSchoolIds || []).includes(activeSchool.id))
    );
  }, [globalNotices, activeSchool.id]);

  const unreadSchoolNotices = React.useMemo(() => {
    return schoolNotices.filter((n) => !(n.readBySchools || {})[activeSchool.id]);
  }, [schoolNotices, activeSchool.id]);

  const displayStudentsCount = isReadOnlyImpersonation
    ? activeSchool.analytics?.totalStudents ?? stats.totalStudents
    : stats.totalStudents;
  const displayClassesCount = isReadOnlyImpersonation
    ? activeSchool.analytics?.totalClasses ?? stats.totalClasses
    : stats.totalClasses;
  const displayTeachersCount = isReadOnlyImpersonation
    ? activeSchool.analytics?.totalTeachers ?? stats.totalTeachers
    : stats.totalTeachers;
  const displayAttendancePct = isReadOnlyImpersonation
    ? activeSchool.analytics?.todayAttendancePct ?? todayAttendanceStats.overallPercentage
    : todayAttendanceStats.overallPercentage;

  return (
    <div className="space-y-6">
      {/* Strict Read-Only Oversight Notice when Super Admin Inspects */}
      {isReadOnlyImpersonation && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100 p-4 rounded-2xl flex items-center gap-3 shadow-xs">
          <Lock className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="text-xs">
            <strong>You are viewing as School Admin - Read Only.</strong> Individual student records, marks, and edit controls are locked during Super Admin inspection.
          </div>
        </div>
      )}

      {/* Prominent Global Announcements Banner for Unread Notices */}
      {unreadSchoolNotices.length > 0 && dashboardTab === 'overview' && (
        <div className="space-y-2.5">
          {unreadSchoolNotices.slice(0, 2).map((notice) => (
            <div
              key={notice.id}
              className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
                notice.priority === 'high'
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-100'
                  : 'bg-[#FEF2F2] dark:bg-[#3F1014]/40 border-[#FECACA] dark:border-[#7F1D1D]/60 text-[#7F1D1D] dark:text-[#FCA5A5]'
              }`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    notice.priority === 'high'
                      ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300'
                      : 'bg-[#FEE2E2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5]'
                  }`}
                >
                  <Megaphone className="w-4 h-4" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/80 dark:bg-[#211415]/60">
                      {notice.priority} Priority Notice · {notice.date}
                    </span>
                    <span className="font-bold text-xs sm:text-sm">{notice.title}</span>
                  </div>
                  <p className="text-xs opacity-90 leading-relaxed">{notice.message}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!isReadOnlyImpersonation && (
                  <button
                    type="button"
                    onClick={() => markNoticeAsRead(notice.id)}
                    className="min-h-[40px] px-3.5 py-1.5 bg-[#FFFDF9] dark:bg-[#211415] hover:bg-[#F3EFEA] text-[#1C1917] dark:text-[#FAF8F5] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer whitespace-nowrap"
                  >
                    Mark as Read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDashboardTab('notifications')}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#2C1215]/10 hover:bg-[#58181D]/20 text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  All Notices ({schoolNotices.length})
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dashboard Tab Bar: Overview vs Notifications */}
      <div className="flex items-center gap-2 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] pb-2">
        <button
          type="button"
          onClick={() => setDashboardTab('overview')}
          className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
            dashboardTab === 'overview'
              ? 'bg-[#7F1D1D] text-white shadow-xs'
              : 'text-[#57534E] dark:text-[#D6CCC2] hover:bg-[#F3EFEA] dark:hover:bg-[#3F1014]'
          }`}
        >
          <SchoolIcon className="w-4 h-4" />
          <span>Dashboard Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setDashboardTab('notifications')}
          className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
            dashboardTab === 'notifications'
              ? 'bg-[#7F1D1D] text-white shadow-xs'
              : 'text-[#57534E] dark:text-[#D6CCC2] hover:bg-[#F3EFEA] dark:hover:bg-[#3F1014]'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Notifications &amp; Notices</span>
          {unreadNoticesCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
              {unreadNoticesCount}
            </span>
          )}
        </button>
      </div>

      {/* NOTIFICATIONS TAB */}
      {dashboardTab === 'notifications' ? (
        <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] pb-3">
            <div>
              <h2 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5] flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-[#7F1D1D]" />
                <span>Super Admin Announcements &amp; Notices</span>
              </h2>
              <p className="text-xs text-[#57534E]">
                Official circulars addressed to {activeSchool.name}
              </p>
            </div>
            <span className="text-xs font-semibold text-[#57534E]">
              {unreadNoticesCount} Unread
            </span>
          </div>

          {schoolNotices.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#78716C]">
              No announcements addressed to your school yet.
            </div>
          ) : (
            <div className="space-y-3">
              {schoolNotices.map((notice) => {
                const isRead = Boolean((notice.readBySchools || {})[activeSchool.id]);
                return (
                  <div
                    key={notice.id}
                    className={`p-4 rounded-xl border transition ${
                      isRead
                        ? 'bg-[#FAF8F5] dark:bg-[#2C1215]/40 border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]'
                        : 'bg-[#FEF2F2]/50 dark:bg-[#3F1014]/30 border-[#FECACA] dark:border-[#7F1D1D]/60'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              notice.priority === 'high'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                                : notice.priority === 'medium'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                                : 'bg-[#FFF7ED] text-[#C2410C] dark:bg-[#7C2D12]/70 dark:text-[#FDBA74]'
                            }`}
                          >
                            {notice.priority}
                          </span>
                          <span className="text-[11px] font-mono text-[#78716C]">{notice.date}</span>
                          {isRead ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                              Read
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              Unread
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                          {notice.title}
                        </h3>
                        <p className="text-xs text-[#57534E] dark:text-[#E7E0D4] leading-relaxed">
                          {notice.message}
                        </p>
                      </div>

                      {!isRead && !isReadOnlyImpersonation && (
                        <button
                          type="button"
                          onClick={() => markNoticeAsRead(notice.id)}
                          className="min-h-[40px] px-3.5 py-2 bg-[#7F1D1D] hover:bg-[#651414] text-white rounded-xl text-xs font-semibold shrink-0 cursor-pointer"
                        >
                          Mark as Read
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
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
      <div
        className="border border-[rgba(255,253,249,0.14)] text-[#FAF8F5] rounded-2xl p-6 shadow-md relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #58181D 0%, #3F1014 100%)' }}
      >
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-64 h-64 bg-[#C2410C]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#FFFDF9]/10 border border-[#FFFDF9]/20 text-[#FED7AA] text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-[#FED7AA]" />
              <span>School Management System · Phase 3 Operational</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#FAF8F5]">
              {activeSchool.name}
            </h1>
            <p className="text-xs sm:text-sm text-[#E7E0D4] leading-relaxed">
              Command Center for real-time admissions, daily attendance ledgers, faculty allocations, and school analytics.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#D6CCC2] pt-1">
              <span>SEMIS: <strong className="text-[#FAF8F5] font-mono">{activeSchool.semisCode}</strong></span>
              <span>·</span>
              <span>District: <strong className="text-[#FAF8F5]">{activeSchool.district}</strong></span>
              <span>·</span>
              <span>Session: <strong className="text-emerald-300">{activeSchool.activeAcademicYear}</strong></span>
            </div>
          </div>

          {/* Persona Card: Demo Switcher vs Real Verified Profile */}
          <div className="bg-[#2C1215]/80 border border-[rgba(255,253,249,0.14)] rounded-2xl p-3.5 flex flex-col gap-2 shrink-0">
            <div className="text-[11px] font-semibold text-[#E7E0D4] flex items-center justify-between">
              <span>{demoMode ? '🧪 Demo Sandbox Persona:' : '🛡️ Verified Identity:'}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#C2410C]/25 text-[#FED7AA] font-mono">
                {userRole.toUpperCase()}
              </span>
            </div>

            {isReadOnlyImpersonation ? (
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-amber-300" />
                  <span>Super Admin Read-Only Oversight</span>
                </div>
                <div className="text-[10px] text-[#E7E0D4] leading-relaxed">
                  You are viewing institutional KPIs &amp; notices for <strong>{activeSchool.name}</strong>. Editing &amp; student PII are locked.
                </div>
              </div>
            ) : demoMode ? (
              <>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setUserRole('admin')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      isAdmin
                        ? 'bg-[#7F1D1D] text-white shadow-sm'
                        : 'bg-[#4A1C20]/70 text-[#E7E0D4] hover:bg-[#58181D]'
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
                        : 'bg-[#4A1C20]/70 text-[#E7E0D4] hover:bg-[#58181D]'
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
                    className="text-[10px] text-[#78716C] hover:text-white underline cursor-pointer"
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
                <div className="text-[10px] text-[#E7E0D4]">
                  Role: <strong>{isAdmin ? 'School Administrator' : 'Class Teacher'}</strong> · {activeSchool.name}
                </div>
                {!isReadOnlyImpersonation && (
                  <button
                    type="button"
                    onClick={() => setDemoMode(true)}
                    className="mt-1 text-[10px] text-[#FED7AA] hover:text-[#FAF8F5] underline block cursor-pointer"
                  >
                    Enable Demo Mode for Testing →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Admin Alert: Pending Join Requests */}
      {!isReadOnlyImpersonation && isAdmin && pendingJoinRequests.length > 0 && (
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
        <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-[#57534E] dark:text-[#D6CCC2]">
            <span>Enrolled Students</span>
            <Users className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-[#1C1917] dark:text-[#FAF8F5] mt-1 tabular-nums">
            {displayStudentsCount}
          </div>
          <div className="text-[11px] text-[#57534E] mt-0.5">Across {displayClassesCount} grade sections</div>
        </div>

        <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-[#57534E] dark:text-[#D6CCC2]">
            <span>Class Sections</span>
            <GraduationCap className="w-4 h-4 text-[#7F1D1D]" />
          </div>
          <div className="text-2xl font-bold text-[#1C1917] dark:text-[#FAF8F5] mt-1 tabular-nums">
            {displayClassesCount}
          </div>
          <div className="text-[11px] text-[#7F1D1D] dark:text-[#FCA5A5] mt-0.5">English, Urdu &amp; Sindhi</div>
        </div>

        <div
          onClick={!isReadOnlyImpersonation ? onNavigateToStaff : undefined}
          className={`bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 shadow-sm transition ${
            isReadOnlyImpersonation
              ? ''
              : 'hover:border-[#7F1D1D] dark:hover:border-[#C2410C] cursor-pointer group'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-[#57534E] dark:text-[#D6CCC2]">
            <span>Faculty Members</span>
            <UserCheck className="w-4 h-4 text-[#C2410C] group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-[#1C1917] dark:text-[#FAF8F5] mt-1 tabular-nums flex items-center justify-between">
            <span>{displayTeachersCount}</span>
            {!isReadOnlyImpersonation && isAdmin && pendingJoinRequests.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-white font-bold animate-pulse">
                +{pendingJoinRequests.length} pending
              </span>
            )}
          </div>
          <div className="text-[11px] text-[#C2410C] dark:text-[#FDBA74] mt-0.5">
            {isReadOnlyImpersonation
              ? 'Read-Only Oversight Summary'
              : isAdmin
              ? 'Manage Staff & Requests →'
              : 'Assigned Incharges'}
          </div>
        </div>

        <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-[#57534E] dark:text-[#D6CCC2]">
            <span>Today's Attendance</span>
            <CalendarCheck2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
            {displayAttendancePct}%
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>
              {isReadOnlyImpersonation
                ? 'Institutional attendance snapshot'
                : `${todayAttendanceStats.totalMarkedClasses} of ${classes.length} classes recorded`}
            </span>
          </div>
        </div>
      </div>

      {isReadOnlyImpersonation ? (
        <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-amber-200 dark:border-amber-800/60 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                  Read-Only School Admin View ({activeSchool.name})
                </h2>
                <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-0.5">
                  Strict Platform RBAC Isolation is active: individual student registers, class rosters, daily attendance ledgers, marks, and fee collection records are hidden and locked from modification.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDashboardTab('notifications')}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#FEF2F2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5] text-xs font-bold hover:bg-[#FEE2E2] transition cursor-pointer shrink-0"
            >
              View School Notices ({schoolNotices.length})
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#2C1215]/60 border border-[#E7E0D4]/70 dark:border-[rgba(255,253,249,0.14)]">
              <div className="text-[#57534E] dark:text-[#D6CCC2] font-semibold">Institutional Revenue (Aggregate)</div>
              <div className="text-lg font-bold text-[#1C1917] dark:text-[#FAF8F5] mt-1 tabular-nums">
                PKR {(activeSchool.analytics?.totalRevenue ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#2C1215]/60 border border-[#E7E0D4]/70 dark:border-[rgba(255,253,249,0.14)]">
              <div className="text-[#57534E] dark:text-[#D6CCC2] font-semibold">Head / Contact</div>
              <div className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5] mt-1 truncate">
                {activeSchool.primaryAdminName || 'Assigned School Admin'}
              </div>
              <div className="text-[11px] text-[#57534E] truncate">
                {activeSchool.phone || activeSchool.primaryAdminEmail || activeSchool.email || 'Contact on file'}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#2C1215]/60 border border-[#E7E0D4]/70 dark:border-[rgba(255,253,249,0.14)]">
              <div className="text-[#57534E] dark:text-[#D6CCC2] font-semibold">Portal Status</div>
              <div className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5] mt-1 uppercase">
                {activeSchool.status || 'active'} · {activeSchool.district}
              </div>
              <div className="text-[11px] text-[#57534E]">SEMIS {activeSchool.semisCode}</div>
            </div>
          </div>
        </div>
      ) : (
        <>
      {/* Real-Time Attendance Command Center & Breakdown */}
      <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                Today's Attendance Ledger ({todayDate})
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF2F2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5] border border-[#FECACA] dark:border-[#7F1D1D]/60">
                Composite Sync
              </span>
            </div>
            <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-0.5">
              Live status across classes for {isAdmin ? 'all institutional sections' : 'your assigned class sections'}.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigateToAttendance()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#7F1D1D] hover:bg-[#651414] text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer self-start sm:self-auto"
          >
            <CalendarCheck2 className="w-4 h-4" />
            <span>Open Attendance Register</span>
          </button>
        </div>

        {/* Breakdown bar */}
        {todayAttendanceStats.totalStudentsRecorded > 0 && (
          <div className="space-y-2 bg-[#FAF8F5] dark:bg-[#2C1215]/40 p-3.5 rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#44403C] dark:text-[#E7E0D4]">
                Attendance Breakdown ({todayAttendanceStats.totalStudentsRecorded} recorded students)
              </span>
              <div className="flex items-center gap-3 text-[11px] font-medium">
                <span className="text-emerald-600 dark:text-emerald-400">
                  Present: {todayAttendanceStats.totalPresent}
                </span>
                <span className="text-[#C2410C] dark:text-[#FDBA74]">
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

            <div className="h-2.5 w-full bg-[#E7E0D4] dark:bg-[#3F1014] rounded-full overflow-hidden flex">
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
                className="bg-[#C2410C] h-full"
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
                className="p-3.5 bg-[#FAF8F5] dark:bg-[#2C1215]/60 border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-xl flex flex-col justify-between hover:border-[#7F1D1D] dark:hover:border-[#C2410C] transition"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-bold text-xs text-[#1C1917] dark:text-[#FAF8F5]">
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

                  <div className="text-[11px] text-[#57534E] dark:text-[#D6CCC2] space-y-0.5">
                    <div>Medium: <strong className="text-[#44403C] dark:text-[#E7E0D4]">{cls.medium}</strong></div>
                    <div>Incharge: <strong className="text-[#44403C] dark:text-[#E7E0D4]">{cls.classTeacherName}</strong></div>
                  </div>

                  {isMarked && (
                    <div className="mt-2 text-[10px] text-[#57534E] flex items-center justify-between">
                      <span>P: {reg.summary.present} · A: {reg.summary.absent} · L: {reg.summary.leave}</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        {reg.summary.percentage}%
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-2.5 border-t border-[#E7E0D4]/60 dark:border-[rgba(255,253,249,0.14)] flex items-center justify-between">
                  <span className="text-[10px] text-[#78716C]">
                    Roll: {cls.totalStudents || 0} students
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigateToAttendance(cls.id)}
                    className="text-xs font-semibold text-[#7F1D1D] dark:text-[#FCA5A5] hover:text-[#651414] dark:hover:text-[#FED7AA] cursor-pointer"
                  >
                    {isMarked ? 'Review / Edit →' : 'Take Roll Call →'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Admin Student Invite Codes Panel (Newly Admitted & Active Students) */}
      {isAdmin && !isReadOnlyImpersonation && (
        <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5] flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#C2410C] dark:text-[#FDBA74]" />
                <span>Student Portal Invite Codes (Email-Free GR / ID Signup)</span>
              </h2>
              <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-0.5">
                Auto-generated on admission. Share the Student ID / GR# and Invite Code so students can create accounts without an email address.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {missingStudentInvitesCount > 0 && (
                <button
                  type="button"
                  onClick={handleGenerateAllMissingInvites}
                  disabled={isBulkGeneratingInvites}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#C2410C] hover:bg-[#9A3412] text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-60"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>
                    {isBulkGeneratingInvites
                      ? 'Generating...'
                      : `Generate Missing Codes (${missingStudentInvitesCount})`}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={onNavigateToStudents}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F3EFEA] dark:bg-[#2C1215] hover:bg-[#E7E0D4] dark:hover:bg-[#4A1C20] text-[#44403C] dark:text-[#FAF8F5] text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                <span>Open Student Register</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {inviteActionFeedback && (
            <div className="px-3 py-2 rounded-xl bg-[#FFF7ED] dark:bg-[#7C2D12]/40 border border-[#FED7AA] dark:border-[#C2410C]/50 text-xs text-[#C2410C] dark:text-[#FDBA74]">
              {inviteActionFeedback}
            </div>
          )}

          {recentStudentsForInvites.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-[#2C1215]/50 border border-dashed border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-xs text-[#57534E] dark:text-[#D6CCC2]">
              No students admitted yet. Newly admitted students automatically receive a Student Invite Code here.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {recentStudentsForInvites.map((stu) => {
                const link = studentPortalLinks[stu.id];
                const code = stu.studentInviteCode || link?.inviteCode || '';
                const isLinked = Boolean(stu.studentUid || link?.status === 'linked');
                const inviteUrl = code
                  ? `${typeof window !== 'undefined' ? window.location.origin : ''}/?student_invite=${encodeURIComponent(
                      code
                    )}&school=${encodeURIComponent(activeSchool.id)}&gr=${encodeURIComponent(
                      stu.grNumber
                    )}`
                  : '';

                return (
                  <div
                    key={stu.id}
                    className="p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#2C1215]/60 border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] flex flex-col justify-between gap-2.5"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#1C1917] dark:text-[#FAF8F5] truncate">
                            {stu.fullName}
                          </div>
                          <div className="text-[11px] text-[#57534E] dark:text-[#D6CCC2]">
                            {stu.grade} - {stu.section}
                          </div>
                        </div>
                        {isLinked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 shrink-0">
                            <CheckCircle2 className="w-3 h-3" />
                            Linked
                          </span>
                        ) : code ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 shrink-0">
                            Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E7E0D4] dark:bg-[#3F1014] text-[#57534E] dark:text-[#E7E0D4] shrink-0">
                            Pending
                          </span>
                        )}
                      </div>

                      <div className="mt-2 space-y-1 text-[11px] text-[#57534E] dark:text-[#E7E0D4]">
                        <div>
                          GR#: <span className="font-mono font-bold text-[#1C1917] dark:text-[#FAF8F5]">{stu.grNumber}</span>
                        </div>
                        <div className="text-[10px] text-[#57534E] dark:text-[#D6CCC2] truncate">
                          ID: <span className="font-mono">{stu.id}</span>
                        </div>
                      </div>
                    </div>

                    {code ? (
                      <div className="pt-2 border-t border-[#E7E0D4]/70 dark:border-[rgba(255,253,249,0.14)] space-y-1.5">
                        <div className="flex items-center justify-between gap-1 bg-[#FFFDF9] dark:bg-[#211415] px-2.5 py-1.5 rounded-lg border border-[#FED7AA] dark:border-[#C2410C]/50">
                          <span className="font-mono text-[11px] font-bold text-[#C2410C] dark:text-[#FDBA74] truncate">
                            {code}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyAdminStudentInvite(code, `code_${stu.id}`)}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#C2410C] dark:text-[#FDBA74] hover:underline cursor-pointer shrink-0"
                            title="Copy Invite Code"
                          >
                            {copiedStudentCodeId === `code_${stu.id}` ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-500" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Code</span>
                              </>
                            )}
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCopyAdminStudentInvite(inviteUrl, `url_${stu.id}`)}
                          className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-[#F3EFEA] dark:bg-[#3F1014]/70 hover:bg-[#E7E0D4] dark:hover:bg-[#4A1C20] text-[#44403C] dark:text-[#FAF8F5] text-[11px] font-semibold transition cursor-pointer"
                        >
                          {copiedStudentCodeId === `url_${stu.id}` ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span>Copied Signup Link</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy Student Link</span>
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await generateStudentInviteForStudent(stu.id);
                          if (res?.inviteCode) {
                            setInviteActionFeedback(
                              `Created Student Invite Code ${res.inviteCode} for ${stu.fullName} (${stu.grNumber}).`
                            );
                          }
                        }}
                        className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#C2410C] hover:bg-[#9A3412] text-white text-[11px] font-semibold transition cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Create Invite Code</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Core SMS Modules Grid */}
      <div>
        <h2 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5] mb-3">
          School Management Modules
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Module 1: Classes & Sections */}
          <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5] flex items-center justify-center">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Ready (Phase 1)
                </span>
              </div>
              <h3 className="text-base font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                Classes &amp; Sections
              </h3>
              <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-1 leading-relaxed">
                Configure grade levels (KG–Class 12), instruction mediums, class teachers, room allocations, and student capacities.
              </p>
            </div>

            <button
              type="button"
              onClick={onNavigateToClasses}
              className="mt-4 inline-flex items-center justify-between w-full px-3.5 py-2 bg-[#FEF2F2] dark:bg-[#3F1014]/60 hover:bg-[#FEE2E2] dark:hover:bg-[#58181D]/60 text-[#7F1D1D] dark:text-[#FCA5A5] text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              <span>Manage Classes ({classes.length})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Module 2: Student Information System */}
          <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFF7ED] dark:bg-[#7C2D12]/60 text-[#C2410C] dark:text-[#FDBA74] flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Ready (Phase 2)
                </span>
              </div>
              <h3 className="text-base font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                Student Register (SIS)
              </h3>
              <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-1 leading-relaxed">
                General Register (GR) records, B-Form integration, guardian contact details, class transfers, and student profile management.
              </p>
            </div>

            <button
              type="button"
              onClick={onNavigateToStudents}
              className="mt-4 inline-flex items-center justify-between w-full px-3.5 py-2 bg-[#FFF7ED] dark:bg-[#7C2D12]/60 hover:bg-[#FFEDD5] dark:hover:bg-[#9A3412]/40 text-[#C2410C] dark:text-[#FDBA74] text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              <span>Manage Students ({stats.totalStudents})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Module 3: Daily Attendance Register */}
          <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <CalendarCheck2 className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Ready (Phase 3)
                </span>
              </div>
              <h3 className="text-base font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                Daily Attendance Register
              </h3>
              <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-1 leading-relaxed">
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
            <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5] flex items-center justify-center">
                    <Award className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FEF2F2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5] border border-[#FECACA] dark:border-[#7F1D1D]/60">
                    Phase B Live
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                  Exams &amp; Report Cards
                </h3>
                <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-1 leading-relaxed">
                  Admin exam scheduling, subject marks entry for assigned classes, class positions, and printable A4 Report Cards.
                </p>
              </div>

              <button
                type="button"
                onClick={onNavigateToExams}
                className="mt-4 inline-flex items-center justify-between w-full min-h-[40px] px-3.5 py-2 bg-[#FEF2F2] dark:bg-[#3F1014]/60 hover:bg-[#FEE2E2] dark:hover:bg-[#58181D]/60 text-[#7F1D1D] dark:text-[#FCA5A5] text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                <span>Open Exams &amp; Results</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Module 5: Timetable */}
          {onNavigateToTimetable && (
            <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FFF7ED] dark:bg-[#7C2D12]/60 text-[#C2410C] dark:text-[#FDBA74] flex items-center justify-center">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FFF7ED] dark:bg-[#7C2D12]/60 text-[#C2410C] dark:text-[#FDBA74] border border-[#FED7AA] dark:border-[#C2410C]/50">
                    Phase D
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                  Class Timetable
                </h3>
                <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-1 leading-relaxed">
                  Period-wise class schedules by day, assigned faculty, rooms &amp; responsive mobile view.
                </p>
              </div>
              <button
                type="button"
                onClick={onNavigateToTimetable}
                className="mt-4 inline-flex items-center justify-between w-full min-h-[40px] px-3.5 py-2 bg-[#FFF7ED] dark:bg-[#7C2D12]/60 hover:bg-[#FFEDD5] dark:hover:bg-[#9A3412]/40 text-[#C2410C] dark:text-[#FDBA74] text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                <span>View Timetable</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Module 6: Daily Homework */}
          {onNavigateToHomework && (
            <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Phase D
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                  Homework &amp; Diary
                </h3>
                <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-1 leading-relaxed">
                  Post subject homework with instructions and submission dates synced for parents.
                </p>
              </div>
              <button
                type="button"
                onClick={onNavigateToHomework}
                className="mt-4 inline-flex items-center justify-between w-full min-h-[40px] px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                <span>Open Homework Diary</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Module 7: Certificates (Admin Only) */}
          {isAdmin && onNavigateToCertificates && (
            <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <FileBadge2 className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    Admin · Phase D
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                  Certificates (TC &amp; Character)
                </h3>
                <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-1 leading-relaxed">
                  Issue School Leaving / Transfer Certificates (TC) and Character Certificates in A4 PDF.
                </p>
              </div>
              <button
                type="button"
                onClick={onNavigateToCertificates}
                className="mt-4 inline-flex items-center justify-between w-full min-h-[40px] px-3.5 py-2 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                <span>Issue Certificates</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
        </>
      )}
        </>
      )}
    </div>
  );
};
