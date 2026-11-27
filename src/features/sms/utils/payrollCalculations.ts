import {
  EmployeePayslip,
  PayslipPaymentMethod,
  SalaryEmployeeType,
  SalaryLineItem,
  SalaryStructure,
  SalaryStructureAuditEntry,
  TeacherInfo,
  UserProfile,
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

export interface ApprovedSchoolEmployee {
  employeeId: string;
  employeeUid?: string;
  employeeName: string;
  employeeEmail?: string;
  designation: string;
  employeeType: SalaryEmployeeType;
  cnic?: string;
  phone?: string;
  roleLabel: string;
  source: 'teachers' | 'users' | 'both';
}

export const EMPLOYEE_NOT_FOUND_IN_SCHOOL_ERROR =
  'Employee not found in school records. Please add them to Faculty first.';

/**
 * Builds the canonical list of strictly verified, active employees (teachers + active school staff users)
 * for a specific schoolId. Unverified, pending, rejected, parent, student, or external accounts are excluded.
 */
export function buildApprovedSchoolEmployees(params: {
  schoolId?: string;
  teachers: TeacherInfo[];
  staffUsers?: UserProfile[];
}): ApprovedSchoolEmployee[] {
  const { schoolId, teachers, staffUsers = [] } = params;
  const byKey = new Map<string, ApprovedSchoolEmployee>();
  const emailToKey = new Map<string, string>();
  const uidToKey = new Map<string, string>();

  const registerEmployee = (emp: ApprovedSchoolEmployee) => {
    const cleanUid = (emp.employeeUid || '').trim();
    const cleanEmail = (emp.employeeEmail || '').trim().toLowerCase();
    const existingKey =
      (cleanUid && uidToKey.get(cleanUid)) ||
      (cleanEmail && emailToKey.get(cleanEmail)) ||
      (byKey.has(emp.employeeId) ? emp.employeeId : undefined);

    if (existingKey && byKey.has(existingKey)) {
      const prev = byKey.get(existingKey)!;
      const merged: ApprovedSchoolEmployee = {
        ...prev,
        employeeUid: prev.employeeUid || emp.employeeUid,
        employeeEmail: prev.employeeEmail || emp.employeeEmail,
        cnic: prev.cnic || emp.cnic,
        phone: prev.phone || emp.phone,
        designation: prev.designation || emp.designation,
        source: prev.source !== emp.source ? 'both' : prev.source,
      };
      byKey.set(existingKey, merged);
      if (merged.employeeUid) uidToKey.set(merged.employeeUid, existingKey);
      if (merged.employeeEmail) emailToKey.set(merged.employeeEmail, existingKey);
      return;
    }

    byKey.set(emp.employeeId, emp);
    if (cleanUid) uidToKey.set(cleanUid, emp.employeeId);
    if (cleanEmail) emailToKey.set(cleanEmail, emp.employeeId);
  };

  (teachers || []).forEach((t) => {
    if (!t || !t.id || !t.name?.trim()) return;
    if (t.status && t.status !== 'active') return;
    const cleanEmail = t.email ? t.email.trim().toLowerCase() : undefined;
    registerEmployee({
      employeeId: sanitizePayrollIdSegment(t.id),
      employeeUid: t.id,
      employeeName: t.name.trim(),
      employeeEmail: cleanEmail,
      designation: t.designation?.trim() || 'Faculty Teacher',
      employeeType: 'teaching',
      cnic: t.cnic,
      phone: t.phone,
      roleLabel: 'Approved Faculty',
      source: 'teachers',
    });
  });

  (staffUsers || []).forEach((u) => {
    if (!u || !u.uid || !u.fullName?.trim()) return;
    if (u.status !== 'active') return;
    if (schoolId && u.schoolId && u.schoolId !== schoolId) return;
    if (u.role !== 'teacher' && u.role !== 'admin' && u.role !== 'principal') return;

    const cleanEmail = u.email ? u.email.trim().toLowerCase() : undefined;
    const isLeadership = u.role === 'admin' || u.role === 'principal';
    registerEmployee({
      employeeId: sanitizePayrollIdSegment(u.uid),
      employeeUid: u.uid,
      employeeName: u.fullName.trim(),
      employeeEmail: cleanEmail,
      designation: u.designation?.trim() || (isLeadership ? 'School Admin / Principal' : 'Faculty Teacher'),
      employeeType: isLeadership ? 'teaching' : 'teaching',
      cnic: u.cnic,
      phone: u.phone,
      roleLabel: isLeadership ? 'School Admin' : 'Active Staff',
      source: 'users',
    });
  });

  return Array.from(byKey.values()).sort((a, b) =>
    a.employeeName.localeCompare(b.employeeName)
  );
}

/**
 * Verifies that an incoming SalaryStructure target belongs to a real, active school employee
 * rather than a manually typed or nonexistent person.
 */
export function validateApprovedSalaryEmployee(params: {
  employeeId?: string;
  employeeUid?: string;
  employeeEmail?: string;
  approvedEmployees: ApprovedSchoolEmployee[];
}): { valid: boolean; matchedEmployee?: ApprovedSchoolEmployee; error?: string } {
  const cleanId = params.employeeId ? sanitizePayrollIdSegment(params.employeeId) : '';
  const cleanUid = (params.employeeUid || '').trim();
  const cleanEmail = (params.employeeEmail || '').trim().toLowerCase();

  const matched = params.approvedEmployees.find(
    (emp) =>
      (cleanId && sanitizePayrollIdSegment(emp.employeeId) === cleanId) ||
      (cleanUid && (emp.employeeUid === cleanUid || emp.employeeId === cleanUid)) ||
      (cleanEmail && emp.employeeEmail?.toLowerCase() === cleanEmail)
  );

  if (!matched) {
    return {
      valid: false,
      error: EMPLOYEE_NOT_FOUND_IN_SCHOOL_ERROR,
    };
  }

  return { valid: true, matchedEmployee: matched };
}

export interface FlattenedSalaryAuditLogRow extends SalaryStructureAuditEntry {
  employeeId: string;
  employeeName: string;
  designation: string;
}

/**
 * Extracts chronological add/edit audit history entries across all configured SalaryStructures.
 */
export function buildSalaryStructureAuditFeed(
  structures: SalaryStructure[]
): FlattenedSalaryAuditLogRow[] {
  const rows: FlattenedSalaryAuditLogRow[] = [];

  (structures || []).forEach((s) => {
    if (!s) return;
    if (Array.isArray(s.auditTrail) && s.auditTrail.length > 0) {
      s.auditTrail.forEach((entry) => {
        rows.push({
          ...entry,
          employeeId: s.employeeId,
          employeeName: s.employeeName,
          designation: s.designation,
        });
      });
      return;
    }

    // Legacy fallback if record predates auditTrail array
    const createdTs = typeof s.createdAt === 'string' && s.createdAt ? s.createdAt : '';
    const updatedTs = typeof s.updatedAt === 'string' && s.updatedAt ? s.updatedAt : createdTs;
    const actor = s.updatedByName || s.createdByName || 'School Admin';
    if (createdTs) {
      rows.push({
        id: `audit_${s.employeeId}_created`,
        action: 'created',
        actorUid: s.createdByUid || s.updatedByUid || 'admin',
        actorName: s.createdByName || actor,
        timestamp: createdTs,
        basicSalary: s.basicSalary,
        netSalary: s.netSalary,
        note: 'Salary structure configured',
        employeeId: s.employeeId,
        employeeName: s.employeeName,
        designation: s.designation,
      });
    }
    if (updatedTs && updatedTs !== createdTs) {
      rows.push({
        id: `audit_${s.employeeId}_updated`,
        action: 'updated',
        actorUid: s.updatedByUid || 'admin',
        actorName: actor,
        timestamp: updatedTs,
        basicSalary: s.basicSalary,
        netSalary: s.netSalary,
        note: 'Salary structure updated',
        employeeId: s.employeeId,
        employeeName: s.employeeName,
        designation: s.designation,
      });
    }
  });

  return rows.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
}
