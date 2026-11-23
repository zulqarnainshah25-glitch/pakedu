import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  Building,
  Users,
  GraduationCap,
  Search,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  PlusCircle,
  Copy,
  Check,
  Eye,
  Ban,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Info,
  Clock,
  XCircle,
  Mail,
  Phone,
  UserCheck,
} from 'lucide-react';
import { useSms } from '../context/SmsContext';
import { School, SchoolStatus, PrimaryAdminType, SchoolRegistrationRequest } from '../types';

interface SuperAdminDashboardProps {
  onNavigateToSchool: (schoolId: string) => void;
  onOpenRegisterSchool: () => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  onNavigateToSchool,
  onOpenRegisterSchool,
}) => {
  const {
    registeredSchools,
    toggleSchoolStatus,
    impersonateSchool,
    students,
    teachers,
    classes,
    registerNewSchool,
    demoMode,
    schoolRegistrationRequests,
    pendingSchoolRegistrationRequests,
    approveSchoolRegistration,
    rejectSchoolRegistration,
  } = useSms();

  const [activeTab, setActiveTab] = useState<'directory' | 'pending_requests'>('directory');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [copiedSemis, setCopiedSemis] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Filtered schools
  const filteredSchools = useMemo(() => {
    return registeredSchools.filter((school) => {
      const matchesSearch =
        school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        school.semisCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        school.district.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (school.primaryAdminName && school.primaryAdminName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (school.primaryAdminEmail && school.primaryAdminEmail.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus =
        statusFilter === 'all' ? true : school.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [registeredSchools, searchTerm, statusFilter]);

  // Aggregate Metrics
  const totalSchools = registeredSchools.length;
  const activeSchoolsCount = registeredSchools.filter((s) => s.status !== 'suspended').length;
  const suspendedSchoolsCount = registeredSchools.filter((s) => s.status === 'suspended').length;
  const totalStudentsEst = students.length * totalSchools; // Mesh aggregate approximation
  const totalFacultyEst = teachers.length * totalSchools;

  const handleCopySemis = (semis: string) => {
    navigator.clipboard.writeText(semis);
    setCopiedSemis(semis);
    setTimeout(() => setCopiedSemis(null), 2000);
  };

  const handleToggleStatus = (school: School) => {
    const isCurrentlySuspended = school.status === 'suspended';
    const nextStatusText = isCurrentlySuspended ? 'reactivated' : 'suspended';
    toggleSchoolStatus(school.id, isCurrentlySuspended ? undefined : 'Administrative Compliance Audit');
    setStatusNotice(`School "${school.name}" has been ${nextStatusText}.`);
    setTimeout(() => setStatusNotice(null), 4000);
  };

  const handleImpersonate = (schoolId: string) => {
    impersonateSchool(schoolId);
    onNavigateToSchool(schoolId);
  };

  const handleApproveSchoolRequest = (req: SchoolRegistrationRequest) => {
    approveSchoolRegistration(req.id);
    setStatusNotice(`School "${req.schoolName}" (SEMIS: ${req.semisCode}) has been officially APPROVED and activated!`);
    setTimeout(() => setStatusNotice(null), 5000);
  };

  const handleRejectSchoolRequest = (req: SchoolRegistrationRequest) => {
    rejectSchoolRegistration(req.id, 'SELD Administrative Clearance Requirements Not Satisfied');
    setStatusNotice(`Registration request for "${req.schoolName}" has been rejected.`);
    setTimeout(() => setStatusNotice(null), 5000);
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
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 border border-slate-800 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-72 h-72 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] font-bold uppercase tracking-wider">
                <ShieldAlert className="w-3.5 h-3.5" />
                Root Super Admin Console
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-mono font-semibold">
                SELD Sindh Multi-Tenant Fleet
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Portal Super Administrator
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Global oversight across all registered schools, SEMIS directories, administrative assignments, and compliance statuses.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {demoMode && (
              <button
                type="button"
                onClick={handleSeedDemoSchool}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer shadow-xs"
                title="Add a sample Sindh school to test multi-tenancy"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Seed Demo School</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenRegisterSchool}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Register New School</span>
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

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Schools */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Schools
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {totalSchools}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{activeSchoolsCount} Active</span>
            <span>·</span>
            <span className={suspendedSchoolsCount > 0 ? 'text-rose-600 dark:text-rose-400 font-semibold' : ''}>
              {suspendedSchoolsCount} Suspended
            </span>
          </div>
        </div>

        {/* Total Faculty */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Faculty &amp; Staff
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {totalFacultyEst}+
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Across {totalSchools} Registered Institutions
          </div>
        </div>

        {/* Total Enrolled Students */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Admissions
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {totalStudentsEst}+
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Official GR Student Records
          </div>
        </div>

        {/* Pending School Registration Approvals */}
        <div
          onClick={() => setActiveTab('pending_requests')}
          className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-xs cursor-pointer transition ${
            pendingSchoolRegistrationRequests.length > 0
              ? 'border-amber-300 dark:border-amber-700/80 bg-amber-50/30 dark:bg-amber-950/20'
              : 'border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Pending Approvals
            </span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              pendingSchoolRegistrationRequests.length > 0
                ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-300 animate-pulse'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}>
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {pendingSchoolRegistrationRequests.length}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {pendingSchoolRegistrationRequests.length > 0
              ? 'Institutional clearances pending review'
              : 'All requests processed & cleared'}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('directory')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'directory'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Registered Schools Fleet</span>
          <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
            activeTab === 'directory' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
          }`}>
            {totalSchools}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pending_requests')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'pending_requests'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Pending School Registrations</span>
          {pendingSchoolRegistrationRequests.length > 0 ? (
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-400 text-slate-950 animate-pulse">
              {pendingSchoolRegistrationRequests.length} Action Required
            </span>
          ) : (
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
              activeTab === 'pending_requests' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}>
              0
            </span>
          )}
        </button>
      </div>

      {/* VIEW 1: PENDING REGISTRATIONS */}
      {activeTab === 'pending_requests' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Institutional Registration Approvals</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  Super Admin Authorization
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Review applicant schools, verify SEMIS codes, and approve or reject institutional access.
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {schoolRegistrationRequests.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  No Pending Registration Requests
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  All submitted school registration applications have been reviewed. When a school admin registers, their request will appear here for clearance.
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
                          : 'border-slate-200 dark:border-slate-800 opacity-60'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">
                              {req.schoolName}
                            </span>
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              SEMIS {req.semisCode}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {req.board} · {req.activeAcademicYear}
                            </span>
                            {isPending && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 animate-pulse">
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

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                            <div>
                              <span className="text-slate-500 text-[11px] block">Location:</span>
                              <span className="font-medium text-slate-900 dark:text-white">
                                {req.district}, {req.taluka}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 text-[11px] block">Applicant Administrator:</span>
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {req.adminName}
                              </span>
                              <span className="text-[11px] text-slate-500 block">
                                {req.adminDesignation || 'Principal'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 text-[11px] block">Contact Details:</span>
                              <span className="font-mono text-[11px] text-slate-800 dark:text-slate-200 block truncate">
                                {req.adminEmail}
                              </span>
                              {req.adminPhone && (
                                <span className="font-mono text-[11px] text-slate-500 block">
                                  {req.adminPhone}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-[11px] text-slate-400 flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Submitted: {new Date(req.requestedAt).toLocaleString()}</span>
                            {req.reviewedAt && (
                              <>
                                <span>·</span>
                                <span>Reviewed: {new Date(req.reviewedAt).toLocaleString()}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Actions for Pending Requests */}
                        {isPending && (
                          <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0">
                            <button
                              type="button"
                              onClick={() => handleApproveSchoolRequest(req)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>✓ Approve &amp; Activate School</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectSchoolRequest(req)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-semibold transition cursor-pointer"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>✕ Reject</span>
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

      {/* VIEW 2: REGISTERED SCHOOLS FLEET */}
      {activeTab === 'directory' && (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Filter Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by School Name, SEMIS, District, or Administrator..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Statuses ({totalSchools})</option>
              <option value="active">Active Only ({activeSchoolsCount})</option>
              <option value="suspended">Suspended Only ({suspendedSchoolsCount})</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">School &amp; SEMIS</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Primary Administrator</th>
                <th className="py-3 px-4">Curriculum / Year</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Super Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredSchools.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No schools match your search query.
                  </td>
                </tr>
              ) : (
                filteredSchools.map((school) => {
                  const isSuspended = school.status === 'suspended';
                  return (
                    <tr
                      key={school.id}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                        isSuspended ? 'bg-rose-50/20 dark:bg-rose-950/10' : ''
                      }`}
                    >
                      {/* School Name & SEMIS */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white max-w-xs truncate" title={school.name}>
                          {school.name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                          <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                            SEMIS {school.semisCode}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopySemis(school.semisCode)}
                            className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded cursor-pointer"
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

                      {/* Location */}
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {school.district}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Taluka: {school.taluka}
                        </div>
                      </td>

                      {/* Primary Administrator */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {school.primaryAdminName || 'Headmaster'}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                          {school.primaryAdminEmail || school.email || 'N/A'}
                        </div>
                        <div className="mt-0.5">
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                            school.primaryAdminType === 'principal'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300'
                              : school.primaryAdminType === 'teacher_admin'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300'
                          }`}>
                            {school.primaryAdminType === 'principal'
                              ? 'Principal'
                              : school.primaryAdminType === 'teacher_admin'
                              ? 'Teacher Admin'
                              : 'Delegated'}
                          </span>
                        </div>
                      </td>

                      {/* Curriculum / Year */}
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        <div className="font-medium">{school.board}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {school.activeAcademicYear}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isSuspended ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            <Ban className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                            Suspended
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            Active
                          </span>
                        )}
                        {school.suspendedReason && (
                          <div className="text-[10px] text-rose-500 mt-1 max-w-[140px] truncate" title={school.suspendedReason}>
                            {school.suspendedReason}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleImpersonate(school.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-semibold text-xs cursor-pointer transition"
                            title="Inspect this school's records as an Administrator"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleStatus(school)}
                            className={`p-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition ${
                              isSuspended
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100'
                                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 hover:bg-rose-100'
                            }`}
                            title={isSuspended ? 'Reactivate School' : 'Suspend School Access'}
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

      {/* Super Admin Governance & Firebase Documentation */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 space-y-3 text-xs">
        <div className="flex items-center gap-2 font-bold text-white text-sm">
          <Info className="w-4 h-4 text-indigo-400" />
          <span>Root Super Admin Governance &amp; Firebase Setup Guide</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-400 leading-relaxed">
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 space-y-1.5">
            <p className="font-semibold text-slate-200">1. Cryptographic Claims Governance</p>
            <p>
              Super Administrator privileges are strictly governed via verified Firebase custom claims (<code className="text-pink-400 font-bold">superAdmin: true</code>) provisioned server-side using the admin CLI script. No hardcoded emails are trusted.
            </p>
          </div>
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 space-y-1.5">
            <p className="font-semibold text-slate-200">2. Impersonation &amp; Multi-Tenant Isolation</p>
            <p>
              Clicking <strong className="text-indigo-300">Inspect</strong> switches the active context to that specific school's classes, students, and attendance roster. An amber banner remains visible at the top to exit impersonation at any time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
