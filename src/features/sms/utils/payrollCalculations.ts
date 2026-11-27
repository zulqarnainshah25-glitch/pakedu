import {
  EmployeePayslip,
  PayslipPaymentMethod,
  SalaryLineItem,
  SalaryStructure,
  TeacherInfo,
} from '../types';
import { formatMonthLabel } from './feeCalculations';

export const DEFAULT_ALLOWANCE_ITEMS: Array<{ label: string; amount: number }> = [
  { label: 'House Rent', amount: 0 },
  { label: 'Medical Allowance', amount: 0 },
  { label: 'Transport Allowance', amount: 0 },
];

export const DEFAULT_DEDUCTION_ITEMS: Array<{ label: string; amount: number }> = [
  { label: 'Income Tax', amount: 0 },
  { label: 'Provident Fund', amount: 0 },
  { label: 'Loan Recovery', amount: 0 },
];

export function sanitizePayrollIdSegment(value: string): string {
  const cleaned = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  return cleaned || 'emp_unknown';
}

export function buildPayrollMonthKey(year: number, monthNumber: number): string {
  const safeYear = Number.isFinite(year) ? Math.max(2000, Math.min(2100, Math.floor(year))) : new Date().getFullYear();
  const safeMonth = Number.isFinite(monthNumber) ? Math.max(1, Math.min(12, Math.floor(monthNumber))) : 1;
  return `${safeYear}-${String(safeMonth).padStart(2, '0')}`;
}

export function parsePayrollMonthKey(monthKey: string): { year: number; monthNumber: number; monthLabel: string } {
  const parts = String(monthKey || '').split('-');
  const rawYear = parseInt(parts[0], 10);
  const rawMonth = parseInt(parts[1], 10);
  const year = Number.isFinite(rawYear) && rawYear >= 2000 ? rawYear : new Date().getFullYear();
  const monthNumber = Number.isFinite(rawMonth) && rawMonth >= 1 && rawMonth <= 12 ? rawMonth : 1;
  const normalized = buildPayrollMonthKey(year, monthNumber);
  return {
    year,
    monthNumber,
    monthLabel: formatMonthLabel(normalized),
  };
}

export function buildPayslipDocId(monthKey: string, employeeId: string): string {
  const { year, monthNumber } = parsePayrollMonthKey(monthKey);
  const normalizedMonth = buildPayrollMonthKey(year, monthNumber);
  return `${normalizedMonth}__${sanitizePayrollIdSegment(employeeId)}`;
}

export function buildPayslipNumber(monthKey: string, employeeId: string): string {
  const { year, monthNumber } = parsePayrollMonthKey(monthKey);
  const ym = `${year}${String(monthNumber).padStart(2, '0')}`;
  const empTag = sanitizePayrollIdSegment(employeeId).toUpperCase().replace(/_/g, '').slice(-6) || 'EMP';
  return `PAY-${ym}-${empTag}`;
}

export function normalizeSalaryLineItems(
  items: SalaryLineItem[] | undefined | null
): SalaryLineItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, idx) => ({
      id: sanitizePayrollIdSegment(item?.id || `item_${idx + 1}`),
      label: String(item?.label || '').trim() || `Item ${idx + 1}`,
      amount:
        typeof item?.amount === 'number' && Number.isFinite(item.amount)
          ? Math.max(0, Math.round(item.amount))
          : 0,
    }));
}

export interface SalaryTotalsResult {
  basicSalary: number;
  allowances: SalaryLineItem[];
  deductions: SalaryLineItem[];
  totalAllowances: number;
  grossSalary: number;
  totalDeductions: number;
  adjustmentAmount: number;
  netSalary: number;
}

/**
 * Computes institutional salary totals deterministically:
 * Net Salary = max(0, (Basic Salary + Sum(Allowances)) - Sum(Deductions) + AdjustmentAmount)
 */
export function calculateSalaryTotals(params: {
  basicSalary: number;
  allowances?: SalaryLineItem[];
  deductions?: SalaryLineItem[];
  adjustmentAmount?: number;
}): SalaryTotalsResult {
  const safeBasic =
    typeof params.basicSalary === 'number' && Number.isFinite(params.basicSalary)
      ? Math.max(0, Math.round(params.basicSalary))
      : 0;
  const cleanAllowances = normalizeSalaryLineItems(params.allowances);
  const cleanDeductions = normalizeSalaryLineItems(params.deductions);
  const totalAllowances = cleanAllowances.reduce((sum, item) => sum + item.amount, 0);
  const totalDeductions = cleanDeductions.reduce((sum, item) => sum + item.amount, 0);
  const safeAdjustment =
    typeof params.adjustmentAmount === 'number' && Number.isFinite(params.adjustmentAmount)
      ? Math.round(params.adjustmentAmount)
      : 0;

  const bonusAddition = safeAdjustment > 0 ? safeAdjustment : 0;
  const extraDeduction = safeAdjustment < 0 ? Math.abs(safeAdjustment) : 0;
  const grossSalary = safeBasic + totalAllowances + bonusAddition;
  const netSalary = Math.max(0, safeBasic + totalAllowances - totalDeductions + safeAdjustment);

  return {
    basicSalary: safeBasic,
    allowances: cleanAllowances,
    deductions: cleanDeductions,
    totalAllowances,
    grossSalary: extraDeduction > 0 ? safeBasic + totalAllowances : grossSalary,
    totalDeductions,
    adjustmentAmount: safeAdjustment,
    netSalary,
  };
}

export function createDefaultSalaryStructure(
  schoolId: string,
  teacher: Pick<TeacherInfo, 'id' | 'name' | 'designation' | 'email' | 'phone' | 'cnic'>
): SalaryStructure {
  const empId = sanitizePayrollIdSegment(teacher.id);
  const allowances: SalaryLineItem[] = DEFAULT_ALLOWANCE_ITEMS.map((item, idx) => ({
    id: `alw_${idx + 1}`,
    label: item.label,
    amount: item.amount,
  }));
  const deductions: SalaryLineItem[] = DEFAULT_DEDUCTION_ITEMS.map((item, idx) => ({
    id: `ded_${idx + 1}`,
    label: item.label,
    amount: item.amount,
  }));
  const totals = calculateSalaryTotals({
    basicSalary: 0,
    allowances,
    deductions,
  });

  return {
    id: empId,
    schoolId,
    employeeId: empId,
    employeeUid: teacher.id,
    employeeName: teacher.name,
    employeeEmail: teacher.email ? teacher.email.trim().toLowerCase() : undefined,
    designation: teacher.designation || 'Teacher',
    employeeType: 'teaching',
    cnic: teacher.cnic,
    phone: teacher.phone,
    basicSalary: totals.basicSalary,
    allowances: totals.allowances,
    deductions: totals.deductions,
    totalAllowances: totals.totalAllowances,
    grossSalary: totals.grossSalary,
    totalDeductions: totals.totalDeductions,
    netSalary: totals.netSalary,
  };
}

export function buildPayslipFromStructure(
  structure: SalaryStructure,
  params: {
    schoolId: string;
    month: string;
    existingPayslip?: EmployeePayslip | null;
    defaultPaymentMethod?: PayslipPaymentMethod;
    generatedByUid?: string;
    generatedByName?: string;
  }
): EmployeePayslip {
  const { year, monthNumber, monthLabel } = parsePayrollMonthKey(params.month);
  const normalizedMonth = buildPayrollMonthKey(year, monthNumber);
  const existing = params.existingPayslip;

  const totals = calculateSalaryTotals({
    basicSalary: existing ? existing.basicSalary : structure.basicSalary,
    allowances: existing ? existing.allowances : structure.allowances,
    deductions: existing ? existing.deductions : structure.deductions,
    adjustmentAmount: existing?.adjustmentAmount || 0,
  });

  return {
    id: existing?.id || buildPayslipDocId(normalizedMonth, structure.employeeId),
    payslipNumber:
      existing?.payslipNumber || buildPayslipNumber(normalizedMonth, structure.employeeId),
    schoolId: params.schoolId,
    month: normalizedMonth,
    monthLabel,
    year,
    monthNumber,
    employeeId: structure.employeeId,
    employeeUid: structure.employeeUid || structure.employeeId,
    employeeName: structure.employeeName,
    employeeEmail: structure.employeeEmail
      ? structure.employeeEmail.trim().toLowerCase()
      : existing?.employeeEmail,
    designation: structure.designation,
    employeeType: structure.employeeType || 'teaching',
    bpsGrade: structure.bpsGrade,
    cnic: structure.cnic,
    phone: structure.phone,
    bankName: structure.bankName,
    bankAccountTitle: structure.bankAccountTitle,
    accountNumber: structure.accountNumber,
    basicSalary: totals.basicSalary,
    allowances: totals.allowances,
    deductions: totals.deductions,
    totalAllowances: totals.totalAllowances,
    grossSalary: totals.grossSalary,
    totalDeductions: totals.totalDeductions,
    adjustmentAmount: totals.adjustmentAmount,
    adjustmentReason: existing?.adjustmentReason || '',
    netSalary: totals.netSalary,
    status: existing?.status || 'draft',
    isFinalized: Boolean(existing?.isFinalized || existing?.status === 'paid' || existing?.status === 'finalized'),
    finalizedAt: existing?.finalizedAt,
    paymentDate: existing?.paymentDate,
    paymentMethod: existing?.paymentMethod || params.defaultPaymentMethod || 'Bank Transfer',
    transactionRef: existing?.transactionRef,
    notes: existing?.notes || '',
    generatedByUid: existing?.generatedByUid || params.generatedByUid,
    generatedByName: existing?.generatedByName || params.generatedByName,
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
}

export interface MonthlyPayrollTrackerCell {
  month: string;
  monthNumber: number;
  monthShort: string;
  monthLabel: string;
  trackerState: 'paid' | 'pending' | 'draft' | 'unpaid';
  payslip: EmployeePayslip | null;
}

const MONTH_SHORTS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function buildEmployeeYearlyPayrollTracker(
  employeeId: string,
  year: number,
  payslips: EmployeePayslip[]
): MonthlyPayrollTrackerCell[] {
  const safeId = sanitizePayrollIdSegment(employeeId);
  return MONTH_SHORTS.map((monthShort, index) => {
    const monthNumber = index + 1;
    const month = buildPayrollMonthKey(year, monthNumber);
    const monthLabel = formatMonthLabel(month);
    const matched =
      payslips.find(
        (p) =>
          p.month === month &&
          (sanitizePayrollIdSegment(p.employeeId) === safeId || p.employeeId === employeeId)
      ) || null;

    let trackerState: MonthlyPayrollTrackerCell['trackerState'] = 'unpaid';
    if (matched) {
      if (matched.status === 'paid') trackerState = 'paid';
      else if (matched.status === 'finalized' || matched.isFinalized) trackerState = 'pending';
      else trackerState = 'draft';
    }

    return {
      month,
      monthNumber,
      monthShort,
      monthLabel,
      trackerState,
      payslip: matched,
    };
  });
}

export function doesPayslipBelongToUser(
  payslip: EmployeePayslip,
  params: { uid?: string | null; email?: string | null; teacherId?: string | null }
): boolean {
  const uid = (params.uid || '').trim();
  const teacherId = (params.teacherId || '').trim();
  const email = (params.email || '').trim().toLowerCase();

  if (uid && (payslip.employeeUid === uid || payslip.employeeId === uid)) {
    return true;
  }
  if (teacherId && (payslip.employeeId === teacherId || payslip.employeeUid === teacherId)) {
    return true;
  }
  if (email && (payslip.employeeEmail || '').trim().toLowerCase() === email) {
    return true;
  }
  return false;
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigitsToWords(n: number): string {
  if (n < 20) return ONES[n];
  const ten = Math.floor(n / 10);
  const rem = n % 10;
  return rem > 0 ? `${TENS[ten]}-${ONES[rem]}` : TENS[ten];
}

function threeDigitsToWords(n: number): string {
  const h = Math.floor(n / 100);
  const rem = n % 100;
  if (h === 0) return twoDigitsToWords(rem);
  return rem > 0 ? `${ONES[h]} Hundred ${twoDigitsToWords(rem)}` : `${ONES[h]} Hundred`;
}

export function numberToRupeesWords(amount: number): string {
  const n = Math.max(0, Math.round(Number.isFinite(amount) ? amount : 0));
  if (n === 0) return 'Zero Rupees Only';

  const parts: string[] = [];
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1_000);
  const hundreds = n % 1_000;

  if (millions > 0) parts.push(`${threeDigitsToWords(millions)} Million`);
  if (thousands > 0) parts.push(`${threeDigitsToWords(thousands)} Thousand`);
  if (hundreds > 0) parts.push(threeDigitsToWords(hundreds));

  return `Rupees ${parts.join(' ')} Only`;
}
