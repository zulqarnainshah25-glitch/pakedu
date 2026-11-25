import {
  ClassFeeStructure,
  ConcessionDiscountType,
  FeeConcessionRule,
  FeePayment,
  Student,
} from '../types';

export interface StudentDiscountCalculation {
  discountAmount: number;
  concessionId?: string;
  concessionTitle?: string;
  discountType?: ConcessionDiscountType;
  discountValue: number;
  percentEffective: number;
}

export interface StudentLedgerRow {
  month: string;
  monthLabel: string;
  grossFee: number;
  discount: number;
  netDue: number;
  paidAmount: number;
  advanceUsed: number;
  advanceGenerated: number;
  pendingBalance: number;
  status: 'paid' | 'partial' | 'unpaid' | 'advance_credit';
  isFutureMonth: boolean;
  receiptNumber?: string;
  paymentDate?: string;
  paymentMethod?: string;
  concessionTitle?: string;
}

export interface StudentFeeLedgerSummary {
  totalDue: number;
  totalPaid: number;
  pendingBalance: number;
  advanceBalance: number;
  activeConcession: StudentDiscountCalculation;
  rows: StudentLedgerRow[];
}

/**
 * Formats a YYYY-MM month key into a human-readable label such as "November 2026".
 */
export function formatMonthLabel(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return monthKey;
  const date = new Date(year, month - 1, 1);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Computes the next YYYY-MM key (e.g. "2026-11" -> "2026-12", "2026-12" -> "2027-01").
 */
export function getNextMonthKey(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (isNaN(year) || isNaN(month)) {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
  }
  const next = new Date(year, month, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Calculates monthly tuition + custom fund totals for a student's class.
 */
export function getExpectedClassMonthlyFee(
  classId: string,
  feeStructures: ClassFeeStructure[],
  fallbackAcademicYear = '2025-2026'
): {
  baseMonthlyTuition: number;
  customChargesAmount: number;
  grossMonthlyFee: number;
  academicYear: string;
  structure?: ClassFeeStructure;
} {
  const structure = feeStructures.find((f) => f.classId === classId || f.id === classId);
  const baseMonthlyTuition = structure ? Number(structure.monthlyTuitionFee) || 0 : 1500;
  const customChargesAmount = (structure?.customCharges || []).reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0
  );
  return {
    baseMonthlyTuition,
    customChargesAmount,
    grossMonthlyFee: baseMonthlyTuition + customChargesAmount,
    academicYear: structure?.academicYear || fallbackAcademicYear,
    structure,
  };
}

/**
 * Automatically calculates a student's permanent concession discount for a given gross fee.
 */
export function calculateStudentDiscount(
  student: Student | undefined | null,
  grossAmount: number,
  concessionRules: FeeConcessionRule[]
): StudentDiscountCalculation {
  if (!student || grossAmount <= 0) {
    return { discountAmount: 0, discountValue: 0, percentEffective: 0 };
  }

  const matchedRule = student.concessionId
    ? concessionRules.find((r) => r.id === student.concessionId)
    : undefined;

  if (matchedRule && matchedRule.isActive === false) {
    return { discountAmount: 0, discountValue: 0, percentEffective: 0 };
  }

  const title = matchedRule?.title || student.concessionTitle;
  const discountType: ConcessionDiscountType | undefined =
    matchedRule?.discountType || student.concessionType;
  const rawValue =
    matchedRule !== undefined
      ? Number(matchedRule.value) || 0
      : Number(student.concessionValue) || 0;

  if (!title || !discountType || rawValue <= 0) {
    return { discountAmount: 0, discountValue: 0, percentEffective: 0 };
  }

  let discountAmount = 0;
  if (discountType === 'percentage') {
    const pct = Math.min(100, Math.max(0, rawValue));
    discountAmount = Math.min(grossAmount, Math.round((grossAmount * pct) / 100));
  } else {
    discountAmount = Math.min(grossAmount, Math.max(0, rawValue));
  }

  const percentEffective = grossAmount > 0 ? Math.round((discountAmount / grossAmount) * 100) : 0;

  return {
    discountAmount,
    concessionId: matchedRule?.id || student.concessionId,
    concessionTitle: title,
    discountType,
    discountValue: rawValue,
    percentEffective,
  };
}

/**
 * Computes the complete Student Profile Fee Ledger: Total Due, Total Paid,
 * Pending Balance (arrears through current month), and Advance Balance (future credit).
 */
export function calculateStudentFeeLedger(
  student: Student,
  feeStructures: ClassFeeStructure[],
  feePayments: FeePayment[],
  concessionRules: FeeConcessionRule[],
  currentMonthKey: string
): StudentFeeLedgerSummary {
  const { grossMonthlyFee } = getExpectedClassMonthlyFee(student.classId, feeStructures);
  const activeConcession = calculateStudentDiscount(student, grossMonthlyFee, concessionRules);
  const expectedNetFee = Math.max(0, grossMonthlyFee - activeConcession.discountAmount);

  const studentPayments = feePayments.filter((p) => p.studentId === student.id);
  const byMonth = new Map<string, FeePayment>();
  studentPayments.forEach((p) => {
    const existing = byMonth.get(p.month);
    if (!existing) {
      byMonth.set(p.month, p);
    } else {
      // Keep the most recent / higher paid record if duplicates exist
      if ((Number(p.paidAmount) || 0) >= (Number(existing.paidAmount) || 0)) {
        byMonth.set(p.month, p);
      }
    }
  });

  // Always include current billing month for active students so unpaid current dues show accurately
  if (student.status === 'active' && !byMonth.has(currentMonthKey)) {
    byMonth.set(currentMonthKey, {
      id: `projected_${student.id}_${currentMonthKey}`,
      schoolId: '',
      studentId: student.id,
      studentName: student.fullName,
      grNumber: student.grNumber,
      classId: student.classId,
      grade: student.grade,
      section: student.section,
      month: currentMonthKey,
      monthLabel: formatMonthLabel(currentMonthKey),
      academicYear: '2025-2026',
      baseAmount: grossMonthlyFee,
      customChargesAmount: 0,
      discount: activeConcession.discountAmount,
      concessionTitle: activeConcession.concessionTitle,
      netAmount: expectedNetFee,
      paidAmount: 0,
      pendingBalance: expectedNetFee,
      status: 'unpaid',
    });
  }

  let totalDue = 0;
  let totalPaid = 0;
  let pendingBalance = 0;
  let advanceBalance = 0;

  const sortedMonths = Array.from(byMonth.keys()).sort((a, b) => b.localeCompare(a));
  const rows: StudentLedgerRow[] = [];

  sortedMonths.forEach((monthKey) => {
    const rec = byMonth.get(monthKey)!;
    const isFutureMonth = monthKey > currentMonthKey;
    const grossFee = (Number(rec.baseAmount) || 0) + (Number(rec.customChargesAmount) || 0);
    const discount = Number(rec.discount) || 0;
    const netDue = Number(rec.netAmount) ?? Math.max(0, grossFee - discount);
    const paidAmount = Number(rec.paidAmount) || 0;
    const advanceUsed = Number(rec.advanceUsed) || 0;
    const advanceGenerated = Number(rec.advanceGenerated) || 0;

    if (isFutureMonth) {
      // Future month pre-funded via advance allocation
      const futureAdvanceHeld = paidAmount;
      totalPaid += futureAdvanceHeld;
      advanceBalance += futureAdvanceHeld;

      rows.push({
        month: monthKey,
        monthLabel: rec.monthLabel || formatMonthLabel(monthKey),
        grossFee,
        discount,
        netDue,
        paidAmount,
        advanceUsed,
        advanceGenerated,
        pendingBalance: Math.max(0, netDue - paidAmount),
        status: 'advance_credit',
        isFutureMonth: true,
        receiptNumber: rec.receiptNumber,
        paymentDate: rec.paymentDate,
        paymentMethod: rec.paymentMethod,
        concessionTitle: rec.concessionTitle,
      });
    } else {
      const monthPending =
        rec.status === 'paid' ? 0 : Math.max(0, netDue - paidAmount);
      totalDue += netDue;
      totalPaid += paidAmount;
      pendingBalance += monthPending;

      const derivedStatus: 'paid' | 'partial' | 'unpaid' =
        paidAmount >= netDue && netDue >= 0 && rec.status === 'paid'
          ? 'paid'
          : paidAmount > 0 && monthPending > 0
          ? 'partial'
          : rec.status === 'paid'
          ? 'paid'
          : 'unpaid';

      rows.push({
        month: monthKey,
        monthLabel: rec.monthLabel || formatMonthLabel(monthKey),
        grossFee,
        discount,
        netDue,
        paidAmount,
        advanceUsed,
        advanceGenerated,
        pendingBalance: monthPending,
        status: derivedStatus,
        isFutureMonth: false,
        receiptNumber: rec.receiptNumber,
        paymentDate: rec.paymentDate,
        paymentMethod: rec.paymentMethod,
        concessionTitle: rec.concessionTitle,
      });
    }
  });

  // Account for any unallocated advance balance stored directly on the student document
  if (advanceBalance === 0 && (Number(student.advanceBalance) || 0) > 0) {
    advanceBalance = Number(student.advanceBalance) || 0;
  }

  return {
    totalDue,
    totalPaid,
    pendingBalance,
    advanceBalance,
    activeConcession,
    rows,
  };
}
