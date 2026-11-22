import React, { useState, useMemo } from 'react';
import {
  BookCheck,
  Calendar,
  Landmark,
  Award,
  Clock,
  Printer,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Hourglass,
  TrendingUp,
} from 'lucide-react';
import { SINDH_BPS_CHART_2026 } from '../data/salaryScale2026';
import {
  SERVICE_BOOK_DISCLAIMER,
  COMMUTATION_AGE_FACTORS,
  SINDH_TIME_SCALE_RULES,
  TeacherCadreId,
  addYearsToIsoDate,
  calculateQualifyingService,
  calculatePensionEstimate,
  trackTimeScaleGrades,
  calculateLeaveEncashment,
} from '../utils/serviceBookLogic';
import { triggerPrintDocument } from '../utils/printDocument';

export const ServiceBookCalculatorTool: React.FC = () => {
  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Employee Identity & Pay Sync
  const [employeeName, setEmployeeName] = useState('Ustad Muhammad Yousuf Mallah');
  const [designation, setDesignation] = useState('JEST / HST');
  const [schoolOffice, setSchoolOffice] = useState('GBHS Qasimabad, Hyderabad');
  const [selectedBps, setSelectedBps] = useState<number>(15);
  const [selectedStage, setSelectedStage] = useState<number>(18);
  const [customEmoluments, setCustomEmoluments] = useState<string>('');

  // 1. Qualifying Service Dates
  const [dob, setDob] = useState('1972-04-15');
  const [appointmentDate, setAppointmentDate] = useState('2004-08-10');
  const [retirementDate, setRetirementDate] = useState('2032-04-14');
  const [previousServiceYears, setPreviousServiceYears] = useState<number>(0);
  const [previousServiceMonths, setPreviousServiceMonths] = useState<number>(0);
  const [previousServiceDays, setPreviousServiceDays] = useState<number>(0);
  const [eolDeductionDays, setEolDeductionDays] = useState<number>(0);

  // 2. Pension Commutation Parameters
  const [commutationPercent, setCommutationPercent] = useState<number>(35);
  const [ageNextBirthday, setAgeNextBirthday] = useState<number>(60);

  // 3. Time Scale Grade Tracker
  const [cadreId, setCadreId] = useState<TeacherCadreId>('jest-bs14');
  const [cadreJoinDate, setCadreJoinDate] = useState('2018-09-01');

  // 4. Leave Encashment (Max 365 Days)
  const [earnedLeaveDays, setEarnedLeaveDays] = useState<number>(365);

  // Compute Auto Pensionable Emoluments from BPS + Stage
  const bpsRow =
    SINDH_BPS_CHART_2026.find((r) => r.bps === selectedBps) || SINDH_BPS_CHART_2026[14];
  const autoEmoluments = bpsRow.minBasic2026 + selectedStage * bpsRow.increment2026;
  const effectiveEmoluments =
    customEmoluments.trim() !== '' && !isNaN(Number(customEmoluments))
      ? Math.max(0, Number(customEmoluments))
      : autoEmoluments;

  const handleAutoSuperannuation = () => {
    if (!dob) return;
    const ret60 = addYearsToIsoDate(dob, 60);
    if (ret60) {
      setRetirementDate(ret60);
      setAgeNextBirthday(60);
    }
  };

  // Calculations
  const qualifyingService = useMemo(
    () =>
      calculateQualifyingService({
        appointmentDate,
        retirementDate,
        previousServiceYears,
        previousServiceMonths,
        previousServiceDays,
        eolDeductionDays,
      }),
    [
      appointmentDate,
      retirementDate,
      previousServiceYears,
      previousServiceMonths,
      previousServiceDays,
      eolDeductionDays,
    ]
  );

  const pensionEstimate = useMemo(
    () =>
      calculatePensionEstimate({
        pensionableEmoluments: effectiveEmoluments,
        qualifyingYears: qualifyingService.valid
          ? qualifyingService.qualifyingYearsCapped
          : 0,
        commutationPercent,
        ageNextBirthday,
      }),
    [effectiveEmoluments, qualifyingService, commutationPercent, ageNextBirthday]
  );

  const timeScaleMilestones = useMemo(
    () =>
      trackTimeScaleGrades(cadreId, cadreJoinDate, retirementDate, todayIso),
    [cadreId, cadreJoinDate, retirementDate, todayIso]
  );

  const leaveEncashment = useMemo(
    () =>
      calculateLeaveEncashment({
        reckonableMonthlyPay: effectiveEmoluments,
        earnedLeaveDays,
      }),
    [effectiveEmoluments, earnedLeaveDays]
  );

  const totalRetirementLumpSum =
    pensionEstimate.commutationLumpSum + leaveEncashment.estimatedAmount;

  const formatPKR = (amount: number) =>
    `Rs. ${amount.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;

  const handleReset = () => {
    setEmployeeName('');
    setDesignation('JEST / HST');
    setSchoolOffice('');
    setSelectedBps(14);
    setSelectedStage(10);
    setCustomEmoluments('');
    setPreviousServiceYears(0);
    setPreviousServiceMonths(0);
    setPreviousServiceDays(0);
    setEolDeductionDays(0);
    setCommutationPercent(35);
    setAgeNextBirthday(60);
    setEarnedLeaveDays(365);
  };

  return (
    <div className="space-y-6">
      {/* =================================================================== */}
      {/* INPUT CONFIGURATION PANEL (HIDDEN IN PRINT)                         */}
      {/* =================================================================== */}
      <div className="no-print bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#5b21b6]">
              <BookCheck className="w-4 h-4" />
              <span>Sindh SELD &amp; Finance Rules</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">
              Service Book, Pension, Time Scale &amp; Leave Encashment Calculator
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Compute Qualifying Service (6+ months = 1 year, max 30 yrs), Monthly &amp; Commuted Pension, JEST/HST Time Scale Upgradation dates, and 365-day Leave Encashment.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
            <button
              type="button"
              onClick={triggerPrintDocument}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#5b21b6] hover:bg-[#4c1d95] rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4" />
              Print Service Book Estimate (A4)
            </button>
          </div>
        </div>

        {/* MANDATORY DISCLAIMER NOTE (PROMINENT ON SCREEN) */}
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex items-start gap-3 text-xs text-amber-950">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed font-medium">{SERVICE_BOOK_DISCLAIMER}</p>
        </div>

        {/* Section A: Employee Profile & Pensionable Emoluments */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            1. Employee Details &amp; Pensionable Emoluments (Last Basic Pay)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Teacher / Employee Name
              </label>
              <input
                type="text"
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                placeholder="Enter Full Name as per Service Book"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5b21b6] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                BPS Scale
              </label>
              <select
                value={selectedBps}
                onChange={(e) => {
                  setSelectedBps(Number(e.target.value));
                  setCustomEmoluments('');
                }}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5b21b6] focus:bg-white"
              >
                {SINDH_BPS_CHART_2026.map((row) => (
                  <option key={row.bps} value={row.bps}>
                    BPS-{String(row.bps).padStart(2, '0')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pay Stage (0–30)
              </label>
              <select
                value={selectedStage}
                onChange={(e) => {
                  setSelectedStage(Number(e.target.value));
                  setCustomEmoluments('');
                }}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5b21b6] focus:bg-white"
              >
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i} value={i}>
                    Stage {i}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pensionable Emoluments (PKR)
              </label>
              <input
                type="number"
                min={0}
                value={customEmoluments !== '' ? customEmoluments : autoEmoluments}
                onChange={(e) => setCustomEmoluments(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono font-bold text-[#5b21b6] bg-purple-50/60 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5b21b6] focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Current Designation
              </label>
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g., PST / JEST / HST / Subject Specialist"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5b21b6] focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                School / Office / Taluka
              </label>
              <input
                type="text"
                value={schoolOffice}
                onChange={(e) => setSchoolOffice(e.target.value)}
                placeholder="e.g., GBHS Latifabad, Hyderabad"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5b21b6] focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Section B: Qualifying Service Calculator Inputs */}
        <div className="pt-4 border-t border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              2. Qualifying Service Calculator (Appointment + Previous Service → Retirement Date)
            </h3>
            <button
              type="button"
              onClick={handleAutoSuperannuation}
              className="text-[11px] font-semibold text-[#5b21b6] hover:underline cursor-pointer"
            >
              Auto-set Retirement Date = DOB + 60 Years
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Date of Birth (Optional)
              </label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Date of Appointment (Govt Service)
              </label>
              <input
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Date of Retirement
              </label>
              <input
                type="date"
                value={retirementDate}
                onChange={(e) => setRetirementDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Non-Qualifying EOL (Days)
              </label>
              <input
                type="number"
                min={0}
                value={eolDeductionDays}
                onChange={(e) => setEolDeductionDays(Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Previous Countable Service (Years)
              </label>
              <input
                type="number"
                min={0}
                max={35}
                value={previousServiceYears}
                onChange={(e) =>
                  setPreviousServiceYears(Math.max(0, Number(e.target.value) || 0))
                }
                className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Previous Countable Service (Months)
              </label>
              <input
                type="number"
                min={0}
                max={11}
                value={previousServiceMonths}
                onChange={(e) =>
                  setPreviousServiceMonths(
                    Math.max(0, Math.min(11, Number(e.target.value) || 0))
                  )
                }
                className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Previous Countable Service (Days)
              </label>
              <input
                type="number"
                min={0}
                max={29}
                value={previousServiceDays}
                onChange={(e) =>
                  setPreviousServiceDays(
                    Math.max(0, Math.min(29, Number(e.target.value) || 0))
                  )
                }
                className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {!qualifyingService.valid && (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 font-medium">
              {qualifyingService.error}
            </div>
          )}
        </div>

        {/* Section C: Pension Commutation, Time Scale Cadre & Leave Encashment */}
        <div className="pt-4 border-t border-slate-200 grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Commutation & Leave Encashment Controls */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              3. Pension Commutation (Max 35%) &amp; Leave Encashment (Max 365 Days)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Commuted Portion (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={35}
                  value={commutationPercent}
                  onChange={(e) =>
                    setCommutationPercent(
                      Math.max(0, Math.min(35, Number(e.target.value) || 0))
                    )
                  }
                  className="w-full px-3 py-2 text-sm font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
                />
                <span className="text-[10px] text-slate-400">Max allowed: 35%</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Age Next Birthday
                </label>
                <select
                  value={ageNextBirthday}
                  onChange={(e) => setAgeNextBirthday(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
                >
                  {Object.entries(COMMUTATION_AGE_FACTORS).map(([age, factor]) => (
                    <option key={age} value={Number(age)}>
                      Age {age} (Factor {factor})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Earned Leave Days (Max 365)
                </label>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={earnedLeaveDays}
                  onChange={(e) =>
                    setEarnedLeaveDays(
                      Math.max(0, Math.min(365, Number(e.target.value) || 0))
                    )
                  }
                  className="w-full px-3 py-2 text-sm font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
                />
                <span className="text-[10px] text-slate-400">365 days = 12 months pay</span>
              </div>
            </div>
          </div>

          {/* Time Scale Higher Grade Tracker Controls */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              4. Time Scale Higher Grade Tracker (JEST / HST / PST)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Teacher Cadre / Entry Grade
                </label>
                <select
                  value={cadreId}
                  onChange={(e) => setCadreId(e.target.value as TeacherCadreId)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
                >
                  {SINDH_TIME_SCALE_RULES.map((rule) => (
                    <option key={rule.id} value={rule.id}>
                      {rule.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Date of Joining in Current Cadre
                </label>
                <input
                  type="date"
                  value={cadreJoinDate}
                  onChange={(e) => setCadreJoinDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5b21b6]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* PRINTABLE A4 SERVICE BOOK & RETIREMENT BENEFIT STATEMENT            */}
      {/* =================================================================== */}
      <div className="printable-a4-sheet bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs space-y-6">
        {/* Official Header */}
        <div className="border-b-2 border-[#5b21b6] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#5b21b6]">
              Government of Sindh · School Education &amp; Literacy Department (SELD)
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
              Service Book Summary, Pension &amp; Time Scale Estimate
            </h1>
          </div>
          <div className="text-xs font-mono text-slate-600 sm:text-right">
            <div>
              Employee: <strong className="text-slate-900">{employeeName || 'Govt Servant'}</strong>
            </div>
            <div>
              Cadre: <strong className="text-[#5b21b6]">{designation} · BPS-{selectedBps}</strong>
            </div>
            <div>{schoolOffice}</div>
          </div>
        </div>

        {/* 4 Key Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#5b21b6] text-white rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-200">
                Qualifying Service
              </span>
              <Calendar className="w-4 h-4 text-pink-300" />
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-extrabold font-mono tabular-nums">
                {qualifyingService.qualifyingYearsCapped} Years
              </div>
              <p className="text-[11px] text-purple-200 mt-1">
                Exact: {qualifyingService.totalYears}y {qualifyingService.totalMonths}m{' '}
                {qualifyingService.totalDays}d{' '}
                {qualifyingService.isCappedAt30
                  ? '(Capped at 30)'
                  : qualifyingService.roundedUpBySixMonthRule
                  ? '(≥6m Rounded Up)'
                  : ''}
              </p>
            </div>
          </div>

          <div className="bg-[#00563B] text-white rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-200">
                Net Monthly Pension
              </span>
              <Landmark className="w-4 h-4 text-emerald-200" />
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-extrabold font-mono tabular-nums">
                {formatPKR(pensionEstimate.netMonthlyPension)}
              </div>
              <p className="text-[11px] text-emerald-100 mt-1">
                Gross {formatPKR(pensionEstimate.grossMonthlyPension)} (−
                {pensionEstimate.effectiveCommutationPercent}% Commuted)
              </p>
            </div>
          </div>

          <div className="bg-blue-700 text-white rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-100">
                Commutation Lump Sum
              </span>
              <TrendingUp className="w-4 h-4 text-blue-200" />
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-extrabold font-mono tabular-nums">
                {formatPKR(pensionEstimate.commutationLumpSum)}
              </div>
              <p className="text-[11px] text-blue-100 mt-1">
                Factor {pensionEstimate.commutationFactor} (Age {ageNextBirthday})
              </p>
            </div>
          </div>

          <div className="bg-pink-600 text-white rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-pink-100">
                Leave Encashment ({leaveEncashment.cappedDays}d)
              </span>
              <Award className="w-4 h-4 text-pink-100" />
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-extrabold font-mono tabular-nums">
                {formatPKR(leaveEncashment.estimatedAmount)}
              </div>
              <p className="text-[11px] text-pink-100 mt-1">
                Total Terminal Cash: {formatPKR(totalRetirementLumpSum)}
              </p>
            </div>
          </div>
        </div>

        {/* Detailed Breakdown Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Part I & II: Qualifying Service + Pension Formula Breakdown */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Part I: Qualifying Service &amp; Pension Formula Breakdown
              </h3>
            </div>
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse text-xs">
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="py-2.5 px-4 text-slate-600">Current Spell Duration</td>
                  <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900">
                    {qualifyingService.currentYears}y {qualifyingService.currentMonths}m{' '}
                    {qualifyingService.currentDays}d
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-slate-600">
                    Total Net Service (incl. Previous − EOL)
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900">
                    {qualifyingService.totalYears}y {qualifyingService.totalMonths}m{' '}
                    {qualifyingService.totalDays}d
                  </td>
                </tr>
                <tr className="bg-purple-50/60">
                  <td className="py-2.5 px-4 font-semibold text-[#5b21b6]">
                    Countable Qualifying Years (≥6m = 1 yr, Max 30 yrs)
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-[#5b21b6]">
                    {pensionEstimate.effectiveQualifyingYears} Years
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-slate-600">Pensionable Emoluments</td>
                  <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900">
                    {formatPKR(pensionEstimate.pensionableEmoluments)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-slate-700 font-medium">
                    Gross Monthly Pension = ({pensionEstimate.pensionableEmoluments.toLocaleString()} ×{' '}
                    {pensionEstimate.effectiveQualifyingYears} × 7) / 300
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                    {formatPKR(pensionEstimate.grossMonthlyPension)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-slate-600">
                    Commuted Portion ({pensionEstimate.effectiveCommutationPercent}% of Gross)
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-semibold text-rose-700">
                    −{formatPKR(pensionEstimate.commutedMonthlyPortion)} / mo
                  </td>
                </tr>
                <tr className="bg-emerald-50/70 font-bold text-[#00563B]">
                  <td className="py-3 px-4">Net Monthly Restorable Pension (65%+)</td>
                  <td className="py-3 px-4 text-right font-mono text-sm">
                    {formatPKR(pensionEstimate.netMonthlyPension)} / mo
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-slate-700">
                    Commutation Lump Sum ({formatPKR(pensionEstimate.commutedMonthlyPortion)} × 12 ×{' '}
                    {pensionEstimate.commutationFactor})
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-blue-800">
                    {formatPKR(pensionEstimate.commutationLumpSum)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-slate-700">
                    Leave Encashment ({leaveEncashment.cappedDays} / 365 days ={' '}
                    {leaveEncashment.equivalentMonths} months pay)
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-pink-700">
                    {formatPKR(leaveEncashment.estimatedAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
            </div>
          </div>

          {/* Part II: Time Scale Higher Grade Tracker */}
          <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between">
            <div>
              <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#5b21b6]" />
                  Part II: Time Scale Higher Grade Milestones
                </h3>
                <span className="text-[11px] font-mono text-slate-500">
                  Joined: {cadreJoinDate}
                </span>
              </div>

              <div className="p-4 space-y-3">
                {timeScaleMilestones.map((m, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg border p-3.5 text-xs ${
                      m.status === 'achieved'
                        ? 'bg-emerald-50/70 border-emerald-300'
                        : m.status === 'post-retirement'
                        ? 'bg-slate-50 border-slate-200 opacity-75'
                        : 'bg-purple-50/60 border-purple-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-900 block">{m.title}</span>
                        <span className="text-[11px] text-slate-600 mt-0.5 block">
                          {m.ruleNote}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 inline-flex items-center gap-1 ${
                          m.status === 'achieved'
                            ? 'bg-emerald-600 text-white'
                            : m.status === 'post-retirement'
                            ? 'bg-slate-400 text-white'
                            : 'bg-[#5b21b6] text-white'
                        }`}
                      >
                        {m.status === 'achieved' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Hourglass className="w-3 h-3" />
                        )}
                        {m.remainingLabel}
                      </span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-200/70 flex items-center justify-between font-mono text-[11px]">
                      <span className="text-slate-600">
                        Milestone: <strong>{m.yearsRequired} Years Service</strong> →{' '}
                        <strong className="text-[#5b21b6]">BS-{m.targetBps}</strong>
                      </span>
                      <span className="font-bold text-slate-900">Due Date: {m.dueDate}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Official Legal Disclaimer Inside Printable A4 Sheet */}
            <div className="m-4 mt-0 bg-amber-50 border border-amber-300 rounded-lg p-3 text-[11px] text-amber-950 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{SERVICE_BOOK_DISCLAIMER}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
