/**
 * Sindh Education & Finance Department Service Book Calculation Engine
 * Covers:
 * 1. Qualifying Service Calculator (Y/M/D + previous service, >= 6 months rounded up, max 30 years)
 * 2. Pension Estimator ((Emoluments * QualifyingYears * 7) / 300, max 35% commutation, commutation lump sum, net monthly pension)
 * 3. Time Scale Higher Grade Tracker (JEST, HST, PST, Subject Specialist, HM)
 * 4. Leave Encashment Estimator (Up to 365 days LPR encashment)
 */

export const SERVICE_BOOK_DISCLAIMER =
  'This is an estimation tool for personal planning. It is not an official legal document. Final benefits depend on verified Service Book entries and Sindh Finance Department rules.';

export interface QualifyingServiceInput {
  appointmentDate: string; // YYYY-MM-DD
  retirementDate: string; // YYYY-MM-DD
  previousServiceYears?: number;
  previousServiceMonths?: number;
  previousServiceDays?: number;
  eolDeductionDays?: number; // Non-qualifying Extra Ordinary Leave days
}

export interface QualifyingServiceResult {
  valid: boolean;
  error?: string;
  currentYears: number;
  currentMonths: number;
  currentDays: number;
  totalYears: number;
  totalMonths: number;
  totalDays: number;
  roundedUpBySixMonthRule: boolean;
  rawRoundedYears: number;
  qualifyingYearsCapped: number; // Maximum 30 years
  isCappedAt30: boolean;
}

/**
 * Standard Civil Services Commutation Table (Pakistan / Sindh Finance Rules)
 * Key = Age Next Birthday (years)
 */
export const COMMUTATION_AGE_FACTORS: Record<number, number> = {
  35: 22.8511,
  36: 22.4633,
  37: 22.0715,
  38: 21.6758,
  39: 21.2762,
  40: 20.8729,
  41: 20.4660,
  42: 20.0556,
  43: 19.6419,
  44: 19.2251,
  45: 18.8054,
  46: 18.3829,
  47: 17.9579,
  48: 17.5306,
  49: 17.1013,
  50: 16.7004,
  51: 16.2752,
  52: 15.8464,
  53: 15.4143,
  54: 14.9793,
  55: 14.5416,
  56: 14.1011,
  57: 13.6584,
  58: 13.2141,
  59: 12.7689,
  60: 12.3719,
  61: 11.9737,
  62: 11.5748,
};

export function getCommutationFactorForAge(ageNextBirthday: number): number {
  const safeAge = Number.isFinite(ageNextBirthday)
    ? Math.max(35, Math.min(62, Math.round(ageNextBirthday)))
    : 60;
  return COMMUTATION_AGE_FACTORS[safeAge] ?? 12.3719;
}

function parseIsoDateStrict(dateStr: string): { year: number; month: number; day: number } | null {
  if (typeof dateStr !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function daysInMonthUtc(year: number, month1Based: number): number {
  return new Date(Date.UTC(year, month1Based, 0)).getUTCDate();
}

export function addYearsToIsoDate(dateStr: string, yearsToAdd: number): string {
  const parsed = parseIsoDateStrict(dateStr);
  if (!parsed) return '';
  const targetYear = parsed.year + yearsToAdd;
  const maxDay = daysInMonthUtc(targetYear, parsed.month);
  const targetDay = Math.min(parsed.day, maxDay);
  return `${String(targetYear).padStart(4, '0')}-${String(parsed.month).padStart(
    2,
    '0'
  )}-${String(targetDay).padStart(2, '0')}`;
}

export function calculateCalendarYMD(
  startIso: string,
  endIso: string
): { years: number; months: number; days: number } | null {
  const start = parseIsoDateStrict(startIso);
  const end = parseIsoDateStrict(endIso);
  if (!start || !end) return null;

  const startMs = Date.UTC(start.year, start.month - 1, start.day);
  const endMs = Date.UTC(end.year, end.month - 1, end.day);
  if (endMs < startMs) return null;

  let years = end.year - start.year;
  let months = end.month - start.month;
  let days = end.day - start.day;

  if (days < 0) {
    months -= 1;
    const prevMonth = end.month === 1 ? 12 : end.month - 1;
    const prevMonthYear = end.month === 1 ? end.year - 1 : end.year;
    days += daysInMonthUtc(prevMonthYear, prevMonth);
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return { years, months, days };
}

/**
 * 1. Qualifying Service Calculator:
 * Rule: 6 months or more counts as 1 full year; maximum qualifying service is capped at 30 years.
 */
export function calculateQualifyingService(
  input: QualifyingServiceInput
): QualifyingServiceResult {
  const baseDiff = calculateCalendarYMD(input.appointmentDate, input.retirementDate);
  if (!baseDiff) {
    return {
      valid: false,
      error:
        'Please enter valid Appointment and Retirement dates (Retirement Date must be on or after Appointment Date).',
      currentYears: 0,
      currentMonths: 0,
      currentDays: 0,
      totalYears: 0,
      totalMonths: 0,
      totalDays: 0,
      roundedUpBySixMonthRule: false,
      rawRoundedYears: 0,
      qualifyingYearsCapped: 0,
      isCappedAt30: false,
    };
  }

  const prevY = Math.max(0, Math.floor(Number(input.previousServiceYears) || 0));
  const prevM = Math.max(0, Math.floor(Number(input.previousServiceMonths) || 0));
  const prevD = Math.max(0, Math.floor(Number(input.previousServiceDays) || 0));
  const eolDays = Math.max(0, Math.floor(Number(input.eolDeductionDays) || 0));

  // Normalize total days -> months -> years (using standard 30 days = 1 month, 12 months = 1 year for service aggregation)
  const netDaysNumeric =
    (baseDiff.years + prevY) * 360 +
    (baseDiff.months + prevM) * 30 +
    (baseDiff.days + prevD) -
    eolDays;

  const safeNetDays = Math.max(0, netDaysNumeric);
  const totalYears = Math.floor(safeNetDays / 360);
  const remAfterYears = safeNetDays % 360;
  const totalMonths = Math.floor(remAfterYears / 30);
  const totalDays = remAfterYears % 30;

  // Rule: >= 6 months counts as a full year
  const roundedUpBySixMonthRule = totalMonths >= 6;
  const rawRoundedYears = roundedUpBySixMonthRule ? totalYears + 1 : totalYears;
  const isCappedAt30 = rawRoundedYears > 30;
  const qualifyingYearsCapped = Math.min(30, rawRoundedYears);

  return {
    valid: true,
    currentYears: baseDiff.years,
    currentMonths: baseDiff.months,
    currentDays: baseDiff.days,
    totalYears,
    totalMonths,
    totalDays,
    roundedUpBySixMonthRule,
    rawRoundedYears,
    qualifyingYearsCapped,
    isCappedAt30,
  };
}

export interface PensionEstimateInput {
  pensionableEmoluments: number;
  qualifyingYears: number;
  commutationPercent: number; // max 35%
  ageNextBirthday: number;
}

export interface PensionEstimateResult {
  pensionableEmoluments: number;
  effectiveQualifyingYears: number;
  effectiveCommutationPercent: number;
  commutationFactor: number;
  grossMonthlyPension: number;
  commutedMonthlyPortion: number;
  commutationLumpSum: number;
  netMonthlyPension: number;
}

/**
 * 2. Pension Estimator:
 * Formula: Gross Pension = (Pensionable Emoluments * Qualifying Years [max 30] * 7) / 300
 * Max 35% Commuted Portion -> Lump Sum = Commuted Portion * 12 * Factor
 * Net Monthly Pension = Gross Pension - Commuted Portion
 */
export function calculatePensionEstimate(
  input: PensionEstimateInput
): PensionEstimateResult {
  const safeEmoluments = Math.max(
    0,
    Number.isFinite(input.pensionableEmoluments) ? input.pensionableEmoluments : 0
  );
  const effectiveQualifyingYears = Math.max(
    0,
    Math.min(30, Math.floor(Number.isFinite(input.qualifyingYears) ? input.qualifyingYears : 0))
  );
  const effectiveCommutationPercent = Math.max(
    0,
    Math.min(35, Number.isFinite(input.commutationPercent) ? input.commutationPercent : 35)
  );
  const commutationFactor = getCommutationFactorForAge(input.ageNextBirthday);

  const grossMonthlyPension = Math.round(
    (safeEmoluments * effectiveQualifyingYears * 7) / 300
  );
  const commutedMonthlyPortion = Math.round(
    grossMonthlyPension * (effectiveCommutationPercent / 100)
  );
  const commutationLumpSum = Math.round(
    commutedMonthlyPortion * 12 * commutationFactor
  );
  const netMonthlyPension = Math.max(0, grossMonthlyPension - commutedMonthlyPortion);

  return {
    pensionableEmoluments: safeEmoluments,
    effectiveQualifyingYears,
    effectiveCommutationPercent,
    commutationFactor,
    grossMonthlyPension,
    commutedMonthlyPortion,
    commutationLumpSum,
    netMonthlyPension,
  };
}

export type TeacherCadreId =
  | 'jest-bs14'
  | 'hst-bs15'
  | 'hst-bs16'
  | 'pst-bs09'
  | 'pst-bs14'
  | 'ss-bs17';

export interface TimeScaleRule {
  id: TeacherCadreId;
  label: string;
  initialBps: number;
  milestones: {
    yearsRequired: number;
    targetBps: number;
    title: string;
    ruleNote: string;
  }[];
}

export const SINDH_TIME_SCALE_RULES: TimeScaleRule[] = [
  {
    id: 'jest-bs14',
    label: 'JEST — Junior Elementary School Teacher (BS-14)',
    initialBps: 14,
    milestones: [
      {
        yearsRequired: 9,
        targetBps: 15,
        title: '1st Time Scale Upgradation (BS-14 → BS-15)',
        ruleNote: 'Due upon completion of 9 years regular satisfactory service in BS-14.',
      },
      {
        yearsRequired: 14,
        targetBps: 16,
        title: '2nd Time Scale Upgradation (BS-15 → BS-16)',
        ruleNote: 'Due upon completion of 14 years regular satisfactory service.',
      },
    ],
  },
  {
    id: 'hst-bs15',
    label: 'HST / SST — High School Teacher (BS-15 Entry)',
    initialBps: 15,
    milestones: [
      {
        yearsRequired: 9,
        targetBps: 17,
        title: '1st Time Scale Upgradation (BS-15 → BS-17)',
        ruleNote: 'Due after 9 years regular service under Sindh SELD Time Scale Policy.',
      },
      {
        yearsRequired: 14,
        targetBps: 18,
        title: '2nd Time Scale Upgradation (BS-17 → BS-18)',
        ruleNote: 'Due after 14 years regular service subject to DPC/ACR clearance.',
      },
    ],
  },
  {
    id: 'hst-bs16',
    label: 'HST / SST — High School Teacher (BS-16 Upgraded)',
    initialBps: 16,
    milestones: [
      {
        yearsRequired: 9,
        targetBps: 17,
        title: '1st Time Scale Upgradation (BS-16 → BS-17)',
        ruleNote: 'Due upon completing 9 years regular service in BS-16.',
      },
      {
        yearsRequired: 14,
        targetBps: 18,
        title: '2nd Time Scale Upgradation (BS-17 → BS-18)',
        ruleNote: 'Due upon completing 14 years regular service.',
      },
    ],
  },
  {
    id: 'pst-bs09',
    label: 'PST — Primary School Teacher (BS-09 Legacy)',
    initialBps: 9,
    milestones: [
      {
        yearsRequired: 9,
        targetBps: 14,
        title: '1st Time Scale / Upgradation (BS-09 → BS-14)',
        ruleNote: 'Due upon completing 9 years satisfactory service (or 2012 upgradation).',
      },
      {
        yearsRequired: 14,
        targetBps: 15,
        title: '2nd Time Scale Upgradation (BS-14 → BS-15)',
        ruleNote: 'Due upon completing 14 years regular satisfactory service.',
      },
    ],
  },
  {
    id: 'pst-bs14',
    label: 'PST — Primary School Teacher (BS-14)',
    initialBps: 14,
    milestones: [
      {
        yearsRequired: 9,
        targetBps: 15,
        title: '1st Time Scale Upgradation (BS-14 → BS-15)',
        ruleNote: 'Due after 9 years regular service in BS-14.',
      },
      {
        yearsRequired: 14,
        targetBps: 16,
        title: '2nd Time Scale Upgradation (BS-15 → BS-16)',
        ruleNote: 'Due after 14 years regular service.',
      },
    ],
  },
  {
    id: 'ss-bs17',
    label: 'Subject Specialist / Headmaster (BS-17)',
    initialBps: 17,
    milestones: [
      {
        yearsRequired: 9,
        targetBps: 18,
        title: '1st Time Scale / Selection Grade (BS-17 → BS-18)',
        ruleNote: 'Due upon completion of 9 years regular gazetted service.',
      },
      {
        yearsRequired: 14,
        targetBps: 19,
        title: '2nd Time Scale Upgradation (BS-18 → BS-19)',
        ruleNote: 'Due upon completion of 14 years regular gazetted service.',
      },
    ],
  },
];

export interface TimeScaleMilestoneStatus {
  yearsRequired: number;
  targetBps: number;
  title: string;
  ruleNote: string;
  dueDate: string;
  status: 'achieved' | 'upcoming' | 'post-retirement';
  remainingLabel: string;
}

export function trackTimeScaleGrades(
  cadreId: TeacherCadreId,
  cadreAppointmentDate: string,
  retirementDate: string,
  referenceTodayIso: string
): TimeScaleMilestoneStatus[] {
  const rule =
    SINDH_TIME_SCALE_RULES.find((r) => r.id === cadreId) || SINDH_TIME_SCALE_RULES[0];
  const parsedAppt = parseIsoDateStrict(cadreAppointmentDate);
  if (!parsedAppt) return [];

  const parsedRet = parseIsoDateStrict(retirementDate);

  return rule.milestones.map((m) => {
    const dueDate = addYearsToIsoDate(cadreAppointmentDate, m.yearsRequired);
    const parsedDue = parseIsoDateStrict(dueDate);
    if (!parsedDue) {
      return {
        ...m,
        dueDate: '—',
        status: 'upcoming',
        remainingLabel: 'Invalid Date',
      };
    }

    if (parsedRet) {
      const retMs = Date.UTC(parsedRet.year, parsedRet.month - 1, parsedRet.day);
      const dueMs = Date.UTC(parsedDue.year, parsedDue.month - 1, parsedDue.day);
      if (dueMs > retMs) {
        return {
          ...m,
          dueDate,
          status: 'post-retirement',
          remainingLabel: 'After Retirement Date',
        };
      }
    }

    const diffFromToday = calculateCalendarYMD(referenceTodayIso, dueDate);
    if (!diffFromToday) {
      return {
        ...m,
        dueDate,
        status: 'achieved',
        remainingLabel: 'Eligible / Achieved',
      };
    }

    if (
      diffFromToday.years === 0 &&
      diffFromToday.months === 0 &&
      diffFromToday.days === 0
    ) {
      return {
        ...m,
        dueDate,
        status: 'achieved',
        remainingLabel: 'Due Today!',
      };
    }

    return {
      ...m,
      dueDate,
      status: 'upcoming',
      remainingLabel: `In ${diffFromToday.years}y ${diffFromToday.months}m ${diffFromToday.days}d`,
    };
  });
}

export interface LeaveEncashmentInput {
  reckonableMonthlyPay: number;
  earnedLeaveDays: number; // Capped at 365 days on retirement
}

export interface LeaveEncashmentResult {
  reckonableMonthlyPay: number;
  cappedDays: number;
  equivalentMonths: number;
  estimatedAmount: number;
}

/**
 * 4. Leave Encashment Estimator (365 Days LPR Rule):
 * On retirement, up to 365 days of unutilized leave on full pay can be encashed.
 * For full 365 days = 12 months of reckonable pay.
 */
export function calculateLeaveEncashment(
  input: LeaveEncashmentInput
): LeaveEncashmentResult {
  const safePay = Math.max(
    0,
    Number.isFinite(input.reckonableMonthlyPay) ? input.reckonableMonthlyPay : 0
  );
  const cappedDays = Math.max(
    0,
    Math.min(365, Math.floor(Number.isFinite(input.earnedLeaveDays) ? input.earnedLeaveDays : 365))
  );
  const equivalentMonths = Number(((cappedDays / 365) * 12).toFixed(2));
  const estimatedAmount = Math.round((cappedDays / 365) * 12 * safePay);

  return {
    reckonableMonthlyPay: safePay,
    cappedDays,
    equivalentMonths,
    estimatedAmount,
  };
}
