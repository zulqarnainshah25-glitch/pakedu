import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldAlert,
  Building,
  Users,
  GraduationCap,
  Search,
  CheckCircle2,
  PlusCircle,
  Copy,
  Check,
  Eye,
  Ban,
  RefreshCw,
  Sparkles,
  Info,
  Clock,
  XCircle,
  Bell,
  Megaphone,
  Trash2,
  TrendingUp,
  Banknote,
  Send,
} from 'lucide-react';
import { useSms } from '../context/SmsContext';
import {
  School,
  SchoolRegistrationRequest,
  NoticePriority,
  NoticeAudience,
} from '../types';

export type SuperAdminTab = 'analytics' | 'directory' | 'pending_requests' | 'notices';

interface SuperAdminDashboardProps {
  onNavigateToSchool: (schoolId: string) => void;
  onOpenRegisterSchool: () => void;
  onOpenPayroll?: () => void;
  activeTab?: SuperAdminTab;
  onTabChange?: (tab: SuperAdminTab) => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  onNavigateToSchool,
  onOpenRegisterSchool,
  onOpenPayroll,
  activeTab: controlledTab,
  onTabChange,
}) => {
  const {
    registeredSchools,
    toggleSchoolStatus,
    impersonateSchool,
    registerNewSchool,
    demoMode,
    schoolRegistrationRequests,
    pendingSchoolRegistrationRequests,
    approveSchoolRegistration,
    rejectSchoolRegistration,
    globalNotices,
    publishGlobalNotice,
    deleteGlobalNotice,
  } = useSms();

  const [internalTab, setInternalTab] = useState<SuperAdminTab>(controlledTab || 'analytics');
  const activeTab = controlledTab ?? internalTab;

  const setActiveTab = (tab: SuperAdminTab) => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };

  useEffect(() => {
    if (controlledTab) {
      setInternalTab(controlledTab);
    }
  }, [controlledTab]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [copiedSemis, setCopiedSemis] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Notice Board Composer State
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [noticePriority, setNoticePriority] = useState<NoticePriority>('high');
  const [noticeDate, setNoticeDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [noticeTargetType, setNoticeTargetType] = useState<NoticeAudience>('all');
  const [selectedNoticeSchoolIds, setSelectedNoticeSchoolIds] = useState<string[]>([]);
  const [isPublishingNotice, setIsPublishingNotice] = useState(false);
  const [noticeError, setNoticeError] = useState<string | null>(null);

  // Filtered schools
  const filteredSchools = useMemo(() => {
    return registeredSchools.filter((school) => {
      const matchesSearch =
        school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        school.semisCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        school.district.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (school.primaryAdminName &&
          school.primaryAdminName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (school.primaryAdminEmail &&
          school.primaryAdminEmail.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = statusFilter === 'all' ? true : school.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [registeredSchools, searchTerm, statusFilter]);

  // Platform-Wide Aggregated Analytics (strictly zero PII queries)
  const totalSchools = registeredSchools.length;
  const activeSchoolsCount = registeredSchools.filter((s) => s.status === 'active').length;
  const pendingSchoolsCount = registeredSchools.filter(
    (s) => s.status === 'pending_approval'
  ).length;
  const suspendedSchoolsCount = registeredSchools.filter((s) => s.status === 'suspended').length;

  const platformAnalytics = useMemo(() => {
    return registeredSchools.reduce(
      (acc, school) => {
        const stats = school.analytics;
        return {
          totalStudents: acc.totalStudents + (stats?.totalStudents || 0),
          totalTeachers: acc.totalTeachers + (stats?.totalTeachers || 0),
          totalClasses: acc.totalClasses + (stats?.totalClasses || 0),
          totalRevenue: acc.totalRevenue + (stats?.totalRevenue || 0),
        };
      },
      { totalStudents: 0, totalTeachers: 0, totalClasses: 0, totalRevenue: 0 }
    );
  }, [registeredSchools]);

  const districtBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { district: string; schools: number; active: number; students: number; revenue: number }
    >();
    registeredSchools.forEach((s) => {
      const key = (s.district || 'Unassigned').trim();
      const prev = map.get(key) || {
        district: key,
        schools: 0,
        active: 0,
        students: 0,
        revenue: 0,
      };
      prev.schools += 1;
      if (s.status !== 'suspended') prev.active += 1;
      prev.students += s.analytics?.totalStudents || 0;
      prev.revenue += s.analytics?.totalRevenue || 0;
      map.set(key, prev);
    });
    return Array.from(map.values()).sort((a, b) => b.schools - a.schools);
  }, [registeredSchools]);

  const handleCopySemis = (semis: string) => {
    navigator.clipboard.writeText(semis);
    setCopiedSemis(semis);
    setTimeout(() => setCopiedSemis(null), 2000);
  };

  const handleToggleStatus = (school: School) => {
    const isCurrentlySuspended = school.status === 'suspended';
    const nextStatusText = isCurrentlySuspended ? 'reactivated' : 'suspended';
    toggleSchoolStatus(
      school.id,
      isCurrentlySuspended ? undefined : 'Administrative Compliance Audit'
    );
    setStatusNotice(`School "${school.name}" has been ${nextStatusText}.`);
    setTimeout(() => setStatusNotice(null), 4000);
  };

  const handleViewAsSchoolAdmin = (schoolId: string) => {
    impersonateSchool(schoolId);
    onNavigateToSchool(schoolId);
  };

  const handleApproveSchoolRequest = (req: SchoolRegistrationRequest) => {
    approveSchoolRegistration(req.id);
    setStatusNotice(
      `School "${req.schoolName}" (SEMIS: ${req.semisCode}) has been officially APPROVED and activated!`
    );
    setTimeout(() => setStatusNotice(null), 5000);
  };

  const handleRejectSchoolRequest = (req: SchoolRegistrationRequest) => {
    rejectSchoolRegistration(req.id, 'SELD Administrative Clearance Requirements Not Satisfied');
    setStatusNotice(`Registration request for "${req.schoolName}" has been rejected.`);
    setTimeout(() => setStatusNotice(null), 5000);
  };

  const handleToggleNoticeSchool = (schoolId: string) => {
    setSelectedNoticeSchoolIds((prev) =>
      prev.includes(schoolId) ? prev.filter((id) => id !== schoolId) : [...prev, schoolId]
    );
  };

  const handlePublishNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    setNoticeError(null);
    if (!noticeTitle.trim()) {
      setNoticeError('Announcement Title is required.');
      return;
    }
    if (!noticeMessage.trim()) {
      setNoticeError('Announcement Message is required.');
      return;
    }
    if (noticeTargetType === 'specific' && selectedNoticeSchoolIds.length === 0) {
      setNoticeError('Select at least one specific school or switch audience to All Schools.');
      return;
    }

    setIsPublishingNotice(true);
    try {
      const ok = await publishGlobalNotice({
        title: noticeTitle.trim(),
        message: noticeMessage.trim(),
        priority: noticePriority,
        date: noticeDate || new Date().toISOString().split('T')[0],
        targetType: noticeTargetType,
        targetSchoolIds: noticeTargetType === 'all' ? [] : selectedNoticeSchoolIds,
      });
      if (ok) {
        setNoticeTitle('');
        setNoticeMessage('');
        setSelectedNoticeSchoolIds([]);
        setStatusNotice(
          noticeTargetType === 'all'
            ? 'Global announcement published to All Schools.'
            : `Announcement published to ${selectedNoticeSchoolIds.length} selected school(s).`
        );
        setTimeout(() => setStatusNotice(null), 5000);
      } else {
        setNoticeError('Unable to publish notice. Check connection and try again.');
      }
    } finally {
      setIsPublishingNotice(false);
    }
  };

  const handleSeedDemoSchool = () => {
    const randomId = Math.floor(1000 + Math.random() * 9000);
    const semis = `40${Math.floor(1000000 + Math.random() * 9000000)}`;
    registerNewSchool(
      {
        name: `Govt. Model Girls Higher Secondary School Sukkur #${randomId}`,
        semisCode: semis,
        board: 'Sindh STBB',
        district: 'Sukkur',
        taluka: 'Sukkur City',
        activeAcademicYear: '2025-2026',
        phone: '+92 71 9310123',
        email: `principal.sukkur${randomId}@seld.gos.pk`,
        address: 'Minara Road, Sukkur, Sindh',
        status: 'active',
        primaryAdminType: 'principal',
        primaryAdminName: `Madam Shazia Baloch #${randomId}`,
        primaryAdminEmail: `shazia.baloch${randomId}@seld.gos.pk`,
        analytics: {
          totalStudents: 240,
          totalClasses: 8,
          totalTeachers: 12,
          totalRevenue: 185000,
          todayAttendancePct: 92,
        },
      },
      {
        fullName: `Madam Shazia Baloch #${randomId}`,
        email: `shazia.baloch${randomId}@seld.gos.pk`,
        designation: 'Principal / Senior Subject Specialist',
        primaryAdminType: 'principal',
      }
    );
    setStatusNotice(`Demo School seeded successfully into the Multi-Tenant Network! (SEMIS: ${semis})`);
    setTimeout(() => setStatusNotice(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Super Admin Root Header */}
      <div
        className="border border-[rgba(255,253,249,0.14)] rounded-3xl p-5 sm:p-8 text-[#FAF8F5] relative overflow-hidden shadow-xl"
        style={{ background: 'linear-gradient(135deg, #58181D 0%, #3F1014 100%)' }}
      >
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-72 h-72 bg-[#C2410C]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C2410C]/25 border border-[#FED7AA]/30 text-[#FED7AA] text-[11px] font-bold uppercase tracking-wider">
                <ShieldAlert className="w-3.5 h-3.5" />
                Root Super Admin Console
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#FFFDF9]/10 border border-[#FFFDF9]/20 text-[#E7E0D4] text-xs font-mono font-semibold">
                Strict Platform Oversight Mode
              </span>
            </div>
            <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-[#FAF8F5]">
              Portal Super Administrator
            </h1>
            <p className="text-xs sm:text-sm text-[#E7E0D4] max-w-2xl leading-relaxed">
              Platform-wide governance across registered schools, institutional approvals, aggregated analytics, and global announcements. Student PII &amp; school-level editing remain strictly isolated per school.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {demoMode && (
              <button
                type="button"
                onClick={handleSeedDemoSchool}
                className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2C1215] hover:bg-[#3F1014] text-[#FAF8F5] border border-[rgba(255,253,249,0.2)] text-xs font-semibold transition cursor-pointer shadow-xs"
              >
                <Sparkles className="w-4 h-4 text-[#FED7AA]" />
                <span>Seed Demo School</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('notices')}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C2410C] hover:bg-[#9A3412] text-[#FFFDF9] text-xs font-bold shadow-md transition cursor-pointer"
            >
              <Megaphone className="w-4 h-4" />
              <span>Compose Notice</span>
            </button>
            {onOpenPayroll && (
              <button
                type="button"
                onClick={onOpenPayroll}
                className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#7F1D1D] hover:bg-[#651414] text-[#FFFDF9] border border-[#FED7AA]/30 text-xs font-bold shadow-md transition cursor-pointer"
              >
                <Banknote className="w-4 h-4 text-[#FED7AA]" />
                <span>Salary &amp; Payroll</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenRegisterSchool}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFFDF9]/10 hover:bg-[#FFFDF9]/20 text-[#FFFDF9] border border-[#FFFDF9]/30 text-xs font-semibold shadow-md transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Register School</span>
            </button>
          </div>
        </div>
      </div>

      {/* Status Notice Toast */}
      {statusNotice && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2 shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* Platform KPI Analytics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#57534E] dark:text-[#D6CCC2] uppercase tracking-wider">
              Total Schools
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#FEF2F2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5] flex items-center justify-center">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#1C1917] dark:text-[#FAF8F5] tabular-nums">
            {totalSchools}
          </div>
          <div className="text-[11px] text-[#57534E] dark:text-[#D6CCC2] mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              {activeSchoolsCount} Active
            </span>
            <span>·</span>
            <span>{pendingSchoolsCount} Pending</span>
            {suspendedSchoolsCount > 0 && (
              <>
                <span>·</span>
                <span className="text-rose-600 dark:text-rose-400 font-semibold">
                  {suspendedSchoolsCount} Suspended
                </span>
              </>
            )}
          </div>
        </div>

        <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#57534E] dark:text-[#D6CCC2] uppercase tracking-wider">
              Platform Students
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#FFF7ED] dark:bg-[#7C2D12]/60 text-[#C2410C] dark:text-[#FDBA74] flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#1C1917] dark:text-[#FAF8F5] tabular-nums">
            {platformAnalytics.totalStudents.toLocaleString()}
          </div>
          <div className="text-[11px] text-[#57534E] dark:text-[#D6CCC2] mt-1">
            Aggregated across {totalSchools} institutions
          </div>
        </div>

        <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#57534E] dark:text-[#D6CCC2] uppercase tracking-wider">
              Platform Revenue
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            Rs. {platformAnalytics.totalRevenue.toLocaleString()}
          </div>
          <div className="text-[11px] text-[#57534E] dark:text-[#D6CCC2] mt-1">
            Reported monthly fee collections
          </div>
        </div>

        <div
          onClick={() => setActiveTab('pending_requests')}
          className={`bg-[#FFFDF9] dark:bg-[#211415] border rounded-2xl p-4 sm:p-5 shadow-xs cursor-pointer transition ${
            pendingSchoolRegistrationRequests.length > 0
              ? 'border-amber-300 dark:border-amber-700/80 bg-amber-50/30 dark:bg-amber-950/20'
              : 'border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#57534E] dark:text-[#D6CCC2] uppercase tracking-wider">
              Approvals Queue
            </span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                pendingSchoolRegistrationRequests.length > 0
                  ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-300 animate-pulse'
                  : 'bg-[#F3EFEA] dark:bg-[#2C1215] text-[#57534E]'
              }`}
            >
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#1C1917] dark:text-[#FAF8F5] tabular-nums">
            {pendingSchoolRegistrationRequests.length}
          </div>
          <div className="text-[11px] text-[#57534E] dark:text-[#D6CCC2] mt-1">
            {pendingSchoolRegistrationRequests.length > 0
              ? 'Schools awaiting clearance'
              : 'All school requests cleared'}
          </div>
        </div>
      </div>

      {/* Super Admin Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`min-h-[42px] flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            activeTab === 'analytics'
              ? 'bg-[#7F1D1D] text-white shadow-xs'
              : 'text-[#57534E] dark:text-[#D6CCC2] hover:bg-[#F3EFEA] dark:hover:bg-[#3F1014]'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Platform Overview (Analytics)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('directory')}
          className={`min-h-[42px] flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            activeTab === 'directory'
              ? 'bg-[#7F1D1D] text-white shadow-xs'
              : 'text-[#57534E] dark:text-[#D6CCC2] hover:bg-[#F3EFEA] dark:hover:bg-[#3F1014]'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Schools Fleet ({totalSchools})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pending_requests')}
          className={`min-h-[42px] flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            activeTab === 'pending_requests'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-[#57534E] dark:text-[#D6CCC2] hover:bg-[#F3EFEA] dark:hover:bg-[#3F1014]'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>School Approvals</span>
          {pendingSchoolRegistrationRequests.length > 0 && (
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-400 text-[#1C1917]">
              {pendingSchoolRegistrationRequests.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notices')}
          className={`min-h-[42px] flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            activeTab === 'notices'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-[#57534E] dark:text-[#D6CCC2] hover:bg-[#F3EFEA] dark:hover:bg-[#3F1014]'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Notice Board ({globalNotices.length})</span>
        </button>
      </div>

      {/* VIEW 0: PLATFORM ANALYTICS OVERVIEW */}
      {activeTab === 'analytics' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-5 shadow-xs space-y-2">
              <div className="text-xs font-bold text-[#57534E] uppercase tracking-wider">
                Platform Faculty &amp; Classes
              </div>
              <div className="text-xl font-extrabold text-[#1C1917] dark:text-[#FAF8F5] flex items-baseline gap-2">
                <span>{platformAnalytics.totalTeachers.toLocaleString()}</span>
                <span className="text-xs font-medium text-[#57534E]">Faculty across</span>
                <span className="text-[#7F1D1D] dark:text-[#FCA5A5]">
                  {platformAnalytics.totalClasses.toLocaleString()} sections
                </span>
              </div>
              <p className="text-[11px] text-[#57534E]">
                Summary counters synced per institution without exposing student or staff PII.
              </p>
            </div>

            <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-5 shadow-xs space-y-2">
              <div className="text-xs font-bold text-[#57534E] uppercase tracking-wider">
                Broadcast Announcements
              </div>
              <div className="text-xl font-extrabold text-[#1C1917] dark:text-[#FAF8F5]">
                {globalNotices.length} Active Notice{globalNotices.length === 1 ? '' : 's'}
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('notices')}
                className="text-xs font-bold text-[#7F1D1D] dark:text-[#FCA5A5] hover:underline cursor-pointer"
              >
                Open Notice Board &amp; Compose →
              </button>
            </div>

            <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-5 shadow-xs space-y-2">
              <div className="text-xs font-bold text-[#57534E] uppercase tracking-wider">
                Fleet Governance Actions
              </div>
              <div className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                {pendingSchoolRegistrationRequests.length} Pending Approvals
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('directory')}
                  className="text-xs font-bold text-[#7F1D1D] dark:text-[#FCA5A5] hover:underline cursor-pointer"
                >
                  Browse Schools Fleet →
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('pending_requests')}
                  className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                >
                  Review Queue →
                </button>
              </div>
            </div>
          </div>

          <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                District-Wise Aggregated Oversight
              </h2>
              <span className="text-[11px] text-[#78716C]">Read-only aggregated totals</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[560px] w-full text-xs text-left">
                <thead className="bg-[#FAF8F5] dark:bg-[#2C1215]/70 text-[11px] uppercase text-[#57534E]">
                  <tr>
                    <th className="py-3 px-4">District</th>
                    <th className="py-3 px-4 text-right">Schools</th>
                    <th className="py-3 px-4 text-right">Active</th>
                    <th className="py-3 px-4 text-right">Reported Students</th>
                    <th className="py-3 px-4 text-right">Reported Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E0D4] dark:divide-[rgba(255,253,249,0.10)]">
                  {districtBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[#78716C]">
                        No registered schools in directory yet.
                      </td>
                    </tr>
                  ) : (
                    districtBreakdown.map((row) => (
                      <tr key={row.district}>
                        <td className="py-3 px-4 font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                          {row.district}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">{row.schools}</td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-600">
                          {row.active}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {row.students.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                          Rs. {row.revenue.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 1: GLOBAL NOTICE BOARD / ANNOUNCEMENTS (SUPER ADMIN ONLY) */}
      {activeTab === 'notices' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Composer */}
          <div className="lg:col-span-5 bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] pb-3">
              <Megaphone className="w-5 h-5 text-rose-600" />
              <div>
                <h2 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                  Publish Global Announcement
                </h2>
                <p className="text-[11px] text-[#78716C]">
                  Broadcast notices to All Schools or specific institutions
                </p>
              </div>
            </div>

            {noticeError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300">
                {noticeError}
              </div>
            )}

            <form onSubmit={handlePublishNotice} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                  Notice Title *
                </label>
                <input
                  type="text"
                  value={noticeTitle}
                  onChange={(e) => setNoticeTitle(e.target.value)}
                  placeholder="e.g., Examination Schedule Update 2026"
                  className="w-full min-h-[44px] px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Priority *
                  </label>
                  <select
                    value={noticePriority}
                    onChange={(e) => setNoticePriority(e.target.value as NoticePriority)}
                    className="w-full min-h-[44px] px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs font-semibold text-[#1C1917] dark:text-[#FAF8F5] cursor-pointer"
                  >
                    <option value="high">High Priority (Urgent)</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority (Info)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Notice Date *
                  </label>
                  <input
                    type="date"
                    value={noticeDate}
                    onChange={(e) => setNoticeDate(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                  Target Audience *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNoticeTargetType('all')}
                    className={`min-h-[42px] px-3 py-2 rounded-xl border-2 text-xs font-bold cursor-pointer transition ${
                      noticeTargetType === 'all'
                        ? 'border-[#7F1D1D] bg-[#FEF2F2] dark:bg-[#3F1014]/50 text-[#7F1D1D] dark:text-[#FCA5A5]'
                        : 'border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-[#57534E] dark:text-[#D6CCC2]'
                    }`}
                  >
                    All Schools ({registeredSchools.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setNoticeTargetType('specific')}
                    className={`min-h-[42px] px-3 py-2 rounded-xl border-2 text-xs font-bold cursor-pointer transition ${
                      noticeTargetType === 'specific'
                        ? 'border-[#7F1D1D] bg-[#FEF2F2] dark:bg-[#3F1014]/50 text-[#7F1D1D] dark:text-[#FCA5A5]'
                        : 'border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-[#57534E] dark:text-[#D6CCC2]'
                    }`}
                  >
                    Specific Schools
                  </button>
                </div>
              </div>

              {noticeTargetType === 'specific' && (
                <div className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#2C1215]/70 border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] space-y-2 max-h-44 overflow-y-auto">
                  <div className="text-[11px] font-bold text-[#57534E] dark:text-[#E7E0D4]">
                    Select Target Institutions ({selectedNoticeSchoolIds.length} selected):
                  </div>
                  {registeredSchools.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#FFFDF9] dark:hover:bg-[#211415] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedNoticeSchoolIds.includes(s.id)}
                        onChange={() => handleToggleNoticeSchool(s.id)}
                        className="rounded text-[#7F1D1D]"
                      />
                      <span className="font-semibold text-[#1C1917] dark:text-[#FAF8F5] truncate">
                        {s.name}
                      </span>
                      <span className="ml-auto font-mono text-[10px] text-[#78716C]">
                        {s.semisCode}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                  Announcement Message *
                </label>
                <textarea
                  rows={4}
                  value={noticeMessage}
                  onChange={(e) => setNoticeMessage(e.target.value)}
                  placeholder="Write official notice details for school administrators..."
                  className="w-full px-3 py-2.5 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5]"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isPublishingNotice}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#7F1D1D] hover:bg-[#651414] text-white font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-60"
              >
                <Send className="w-4 h-4" />
                <span>{isPublishingNotice ? 'Publishing...' : 'Publish Announcement'}</span>
              </button>
            </form>
          </div>

          {/* Published Notices Feed */}
          <div className="lg:col-span-7 bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] pb-3">
              <h2 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                Published Announcements History ({globalNotices.length})
              </h2>
            </div>

            {globalNotices.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#78716C]">
                No notices published yet. Compose your first announcement using the panel on the left.
              </div>
            ) : (
              <div className="space-y-3">
                {globalNotices.map((notice) => {
                  const readCount = Object.values(notice.readBySchools || {}).filter(Boolean).length;
                  return (
                    <div
                      key={notice.id}
                      className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-[#2C1215]/60 border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                notice.priority === 'high'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                                  : notice.priority === 'medium'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                                  : 'bg-[#FFF7ED] text-[#C2410C] dark:bg-[#7C2D12]/70 dark:text-[#FDBA74]'
                              }`}
                            >
                              {notice.priority} Priority
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FEF2F2] dark:bg-[#3F1014]/70 text-[#7F1D1D] dark:text-[#FCA5A5]">
                              {notice.targetType === 'all'
                                ? 'All Schools'
                                : `${(notice.targetSchoolIds || []).length} Specific School(s)`}
                            </span>
                            <span className="text-[11px] font-mono text-[#78716C]">
                              {notice.date}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                            {notice.title}
                          </h3>
                        </div>

                        <button
                          type="button"
                          onClick={() => deleteGlobalNotice(notice.id)}
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer shrink-0"
                          title="Delete notice"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <p className="text-xs text-[#57534E] dark:text-[#E7E0D4] leading-relaxed">
                        {notice.message}
                      </p>

                      <div className="text-[11px] text-[#57534E] pt-1 flex items-center justify-between">
                        <span>
                          Marked Read by: <strong>{readCount}</strong> School Admin(s)
                        </span>
                        <span className="text-[10px] text-[#78716C]">By {notice.createdByName}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: PENDING REGISTRATIONS */}
      {activeTab === 'pending_requests' && (
        <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5] flex items-center gap-2">
                <span>Institutional Registration Approvals</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  Super Admin Authorization
                </span>
              </h2>
              <p className="text-xs text-[#57534E] dark:text-[#D6CCC2]">
                Review applicant schools, verify SEMIS codes, and approve or reject institutional access.
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {schoolRegistrationRequests.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#F3EFEA] dark:bg-[#2C1215] text-[#78716C] flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                </div>
                <h3 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                  No Pending Registration Requests
                </h3>
                <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] max-w-sm mx-auto">
                  All submitted school registration applications have been reviewed.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {schoolRegistrationRequests.map((req) => {
                  const isPending = req.status === 'pending';
                  const isApproved = req.status === 'approved';
                  const isRejected = req.status === 'rejected';

                  return (
                    <div
                      key={req.id}
                      className={`p-5 rounded-2xl border transition-all ${
                        isPending
                          ? 'border-amber-300 dark:border-amber-700/80 bg-amber-50/20 dark:bg-amber-950/20 shadow-xs'
                          : isApproved
                          ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/10 dark:bg-emerald-950/10'
                          : 'border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] opacity-60'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm text-[#1C1917] dark:text-[#FAF8F5]">
                              {req.schoolName}
                            </span>
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#FEF2F2] dark:bg-[#3F1014]/80 text-[#7F1D1D] dark:text-[#FCA5A5] border border-[#FECACA] dark:border-[#7F1D1D]/60">
                              SEMIS {req.semisCode}
                            </span>
                            {isPending && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                                Pending Approval
                              </span>
                            )}
                            {isApproved && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                                Approved &amp; Active
                              </span>
                            )}
                            {isRejected && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300">
                                Rejected
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs text-[#57534E] dark:text-[#E7E0D4]">
                            <div>
                              <span className="text-[#57534E] text-[11px] block">Location:</span>
                              <span className="font-medium text-[#1C1917] dark:text-[#FAF8F5]">
                                {req.district}, {req.taluka}
                              </span>
                            </div>
                            <div>
                              <span className="text-[#57534E] text-[11px] block">Administrator:</span>
                              <span className="font-semibold text-[#1C1917] dark:text-[#FAF8F5]">
                                {req.adminName}
                              </span>
                            </div>
                            <div>
                              <span className="text-[#57534E] text-[11px] block">Email:</span>
                              <span className="font-mono text-[11px] text-[#1C1917] dark:text-[#FAF8F5] block truncate">
                                {req.adminEmail}
                              </span>
                            </div>
                          </div>
                        </div>

                        {isPending && (
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleApproveSchoolRequest(req)}
                              className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Approve &amp; Activate</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectSchoolRequest(req)}
                              className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-semibold transition cursor-pointer"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>Reject</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: REGISTERED SCHOOLS FLEET */}
      {activeTab === 'directory' && (
        <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#78716C]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by School Name, SEMIS, District, or Admin..."
                className="w-full min-h-[42px] pl-10 pr-4 py-2 text-xs rounded-xl bg-[#FAF8F5] dark:bg-[#2C1215]/80 border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden focus:ring-2 focus:ring-[#7F1D1D]"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="min-h-[42px] px-3 py-2 text-xs rounded-xl bg-[#FAF8F5] dark:bg-[#2C1215]/80 border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden focus:ring-2 focus:ring-[#7F1D1D]"
            >
              <option value="all">All Statuses ({totalSchools})</option>
              <option value="active">Active Only ({activeSchoolsCount})</option>
              <option value="suspended">Suspended Only ({suspendedSchoolsCount})</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[780px] w-full text-left text-xs">
              <thead className="bg-[#FAF8F5] dark:bg-[#2C1215]/60 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-[#57534E] dark:text-[#D6CCC2] font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">School &amp; SEMIS</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Primary Administrator</th>
                  <th className="py-3 px-4">Summary Stats</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Super Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E0D4] dark:divide-[rgba(255,253,249,0.10)]">
                {filteredSchools.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#78716C]">
                      No schools match your search query.
                    </td>
                  </tr>
                ) : (
                  filteredSchools.map((school) => {
                    const isSuspended = school.status === 'suspended';
                    return (
                      <tr
                        key={school.id}
                        className={`hover:bg-[#FAF8F5]/70 dark:hover:bg-[#3F1014]/40 transition-colors ${
                          isSuspended ? 'bg-rose-50/20 dark:bg-rose-950/10' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-[#1C1917] dark:text-[#FAF8F5] max-w-xs truncate">
                            {school.name}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                            <span className="font-mono text-[#7F1D1D] dark:text-[#FCA5A5] font-bold">
                              SEMIS {school.semisCode}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopySemis(school.semisCode)}
                              className="p-0.5 text-[#78716C] hover:text-[#57534E] dark:hover:text-[#FAF8F5] rounded cursor-pointer"
                              title="Copy SEMIS Code"
                            >
                              {copiedSemis === school.semisCode ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-[#57534E] dark:text-[#E7E0D4]">
                          <div className="font-medium text-[#1C1917] dark:text-[#FAF8F5]">
                            {school.district}
                          </div>
                          <div className="text-[11px] text-[#57534E] dark:text-[#D6CCC2]">
                            {school.taluka}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-[#1C1917] dark:text-[#FAF8F5]">
                            {school.primaryAdminName || 'Headmaster'}
                          </div>
                          <div className="text-[11px] text-[#57534E] dark:text-[#D6CCC2] truncate max-w-[180px]">
                            {school.primaryAdminEmail || school.email || 'N/A'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-[11px] text-[#57534E] dark:text-[#E7E0D4] font-mono">
                          <div>{school.analytics?.totalStudents || 0} Students</div>
                          <div className="text-emerald-600 dark:text-emerald-400">
                            Rs. {(school.analytics?.totalRevenue || 0).toLocaleString()}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {isSuspended ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                              <Ban className="w-3 h-3" />
                              Suspended
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              Active
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleViewAsSchoolAdmin(school.id)}
                              className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FEF2F2] dark:bg-[#3F1014]/60 hover:bg-[#FEE2E2] dark:hover:bg-[#58181D]/60 text-[#7F1D1D] dark:text-[#FCA5A5] border border-[#FECACA] dark:border-[#7F1D1D]/60 font-semibold text-xs cursor-pointer transition whitespace-nowrap"
                              title="Open read-only dashboard view as School Admin"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View as School Admin</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleStatus(school)}
                              className={`min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border text-xs font-semibold cursor-pointer transition ${
                                isSuspended
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100'
                                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 hover:bg-rose-100'
                              }`}
                              title={isSuspended ? 'Activate School' : 'Suspend School'}
                            >
                              {isSuspended ? (
                                <RefreshCw className="w-3.5 h-3.5" />
                              ) : (
                                <Ban className="w-3.5 h-3.5" />
                              )}
                            </button>
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
      )}

      {/* Governance Info Footer */}
      <div className="p-5 rounded-2xl bg-[#2C1215] border border-[rgba(255,253,249,0.14)] text-[#E7E0D4] space-y-2 text-xs">
        <div className="flex items-center gap-2 font-bold text-white text-sm">
          <Info className="w-4 h-4 text-[#FED7AA]" />
          <span>Strict Platform Oversight Policy</span>
        </div>
        <p className="text-[#78716C] leading-relaxed">
          Super Admin oversight is restricted to school registration governance, aggregated metrics, and global notices. Clicking <strong className="text-[#FED7AA]">View as School Admin</strong> opens a strictly <strong className="text-amber-300">Read-Only</strong> school dashboard inspection session without student PII queries or write permissions.
        </p>
      </div>
    </div>
  );
};
