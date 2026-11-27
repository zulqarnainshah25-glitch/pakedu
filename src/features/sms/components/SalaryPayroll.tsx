import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Building,
  Calculator,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Edit2,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  History,
  Lock,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Unlock,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useSms } from '../context/SmsContext';
import {
  EmployeePayslip,
  PayrollSettings,
  PayslipPaymentMethod,
  SalaryEmployeeType,
  SalaryLineItem,
  SalaryStructure,
  School,
  TeacherInfo,
} from '../types';
import {
  buildEmployeeYearlyPayrollTracker,
  buildPayrollMonthKey,
  buildPayslipFromStructure,
  calculateSalaryTotals,
  createDefaultSalaryStructure,
  sanitizePayrollIdSegment,
} from '../utils/payrollCalculations';
import { calculateSindhSalary2026 } from '../../../data/salaryScale2026';
import { formatMonthLabel } from '../utils/feeCalculations';
import { saveFileUniversal } from '../../cv-builder/lib/mobileFileSaver';
import { PayslipPreviewModal } from './PayslipPreviewModal';

type PayrollTabId = 'structures' | 'payroll' | 'history';

interface UnifiedEmployeeRow {
  employeeId: string;
  employeeUid?: string;
  employeeName: string;
  employeeEmail?: string;
  designation: string;
  employeeType: SalaryEmployeeType;
  cnic?: string;
  phone?: string;
  structure: SalaryStructure | null;
}

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const PAYMENT_METHODS: PayslipPaymentMethod[] = [
  'Bank Transfer',
  'Cash',
  'Cheque',
  'EasyPaisa',
  'JazzCash',
];

function escapeCsvCell(value: unknown): string {
  const str = value === undefined || value === null ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const SalaryPayroll: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const {
    activeSchool,
    registeredSchools,
    teachers,
    salaryStructures,
    payslips,
    payrollSettings,
    canAccessSalaryPayroll,
    isSuperAdmin,
    demoMode,
    currentUserProfile,
    saveSalaryStructure,
    deleteSalaryStructure,
    savePayslip,
    saveBulkPayslips,
    deletePayslip,
    updatePayrollSettings,
    loadSchoolPayrollData,
  } = useSms();

  const [activeTab, setActiveTab] = useState<PayrollTabId>('structures');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Super Admin School Switcher
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(() => {
    if (activeSchool?.id) return activeSchool.id;
    return registeredSchools[0]?.id || '';
  });
  const [superAdminTeachers, setSuperAdminTeachers] = useState<TeacherInfo[]>([]);
  const [loadingSchoolPayroll, setLoadingSchoolPayroll] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) {
      if (activeSchool?.id && selectedSchoolId !== activeSchool.id) {
        setSelectedSchoolId(activeSchool.id);
      }
      return;
    }
    if (!selectedSchoolId && registeredSchools.length > 0) {
      setSelectedSchoolId(activeSchool?.id || registeredSchools[0].id);
    }
  }, [isSuperAdmin, activeSchool?.id, registeredSchools, selectedSchoolId]);

  const targetSchool: School = useMemo(() => {
    if (!isSuperAdmin) return activeSchool;
    return (
      registeredSchools.find((s) => s.id === selectedSchoolId) ||
      activeSchool ||
      registeredSchools[0]
    );
  }, [isSuperAdmin, selectedSchoolId, registeredSchools, activeSchool]);

  const targetSchoolId = targetSchool?.id || '';

  useEffect(() => {
    if (!isSuperAdmin || !targetSchoolId || !canAccessSalaryPayroll) return;
    let cancelled = false;
    setLoadingSchoolPayroll(true);
    loadSchoolPayrollData(targetSchoolId)
      .then((res) => {
        if (!cancelled) {
          setSuperAdminTeachers(res.teachers || []);
        }
      })
      .catch((err) => {
        console.warn('[SalaryPayroll] Super Admin school load error:', err);
      })
      .finally(() => {
        if (!cancelled) setLoadingSchoolPayroll(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, targetSchoolId, canAccessSalaryPayroll]);

  const scopedTeachers = useMemo(() => {
    if (isSuperAdmin) return superAdminTeachers;
    return teachers;
  }, [isSuperAdmin, superAdminTeachers, teachers]);

  const scopedStructures = useMemo(
    () => salaryStructures.filter((s) => !targetSchoolId || s.schoolId === targetSchoolId),
    [salaryStructures, targetSchoolId]
  );

  const scopedPayslips = useMemo(
    () => payslips.filter((p) => !targetSchoolId || p.schoolId === targetSchoolId),
    [payslips, targetSchoolId]
  );

  const scopedSettings: PayrollSettings = useMemo(() => {
    if (payrollSettings.schoolId === targetSchoolId) return payrollSettings;
    return {
      ...payrollSettings,
      id: 'config',
      schoolId: targetSchoolId,
    };
  }, [payrollSettings, targetSchoolId]);

  // Unified Employees Roster (Teachers + any non-teaching staff in salaryStructures)
  const unifiedEmployees = useMemo<UnifiedEmployeeRow[]>(() => {
    const byId = new Map<string, UnifiedEmployeeRow>();

    scopedTeachers.forEach((t) => {
      const cleanId = sanitizePayrollIdSegment(t.id);
      const matchedStruct =
        scopedStructures.find(
          (s) =>
            sanitizePayrollIdSegment(s.employeeId) === cleanId ||
            s.employeeId === t.id ||
            (t.email && s.employeeEmail?.toLowerCase() === t.email.trim().toLowerCase())
        ) || null;

      byId.set(cleanId, {
        employeeId: matchedStruct?.employeeId || cleanId,
        employeeUid: matchedStruct?.employeeUid || t.id,
        employeeName: matchedStruct?.employeeName || t.name,
        employeeEmail: matchedStruct?.employeeEmail || t.email,
        designation: matchedStruct?.designation || t.designation || 'Teacher',
        employeeType: matchedStruct?.employeeType || 'teaching',
        cnic: matchedStruct?.cnic || t.cnic,
        phone: matchedStruct?.phone || t.phone,
        structure: matchedStruct,
      });
    });

    scopedStructures.forEach((s) => {
      const cleanId = sanitizePayrollIdSegment(s.employeeId || s.id);
      if (!byId.has(cleanId)) {
        byId.set(cleanId, {
          employeeId: cleanId,
          employeeUid: s.employeeUid,
          employeeName: s.employeeName,
          employeeEmail: s.employeeEmail,
          designation: s.designation || 'School Staff',
          employeeType: s.employeeType || 'non_teaching',
          cnic: s.cnic,
          phone: s.phone,
          structure: s,
        });
      }
    });

    return Array.from(byId.values()).sort((a, b) =>
      a.employeeName.localeCompare(b.employeeName)
    );
  }, [scopedTeachers, scopedStructures]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4500);
  };

  // ===========================================================================
  // TAB 1 STATE: Salary Structure Setup
  // ===========================================================================
  const [structSearch, setStructSearch] = useState('');
  const [structTypeFilter, setStructTypeFilter] = useState<'all' | SalaryEmployeeType>('all');
  const [editingStructure, setEditingStructure] = useState<SalaryStructure | null>(null);
  const [isNewStaffMode, setIsNewStaffMode] = useState(false);
  const [bpsAutofillGrade, setBpsAutofillGrade] = useState<number>(14);
  const [bpsAutofillStage, setBpsAutofillStage] = useState<number>(0);
  const [savingStructure, setSavingStructure] = useState(false);

  const filteredEmployees = useMemo(() => {
    const q = structSearch.trim().toLowerCase();
    return unifiedEmployees.filter((emp) => {
      const matchesType =
        structTypeFilter === 'all' || emp.employeeType === structTypeFilter;
      const matchesQuery =
        !q ||
        emp.employeeName.toLowerCase().includes(q) ||
        emp.designation.toLowerCase().includes(q) ||
        emp.employeeId.toLowerCase().includes(q) ||
        (emp.employeeEmail && emp.employeeEmail.toLowerCase().includes(q));
      return matchesType && matchesQuery;
    });
  }, [unifiedEmployees, structSearch, structTypeFilter]);

  const openEditStructureModal = (emp: UnifiedEmployeeRow) => {
    setIsNewStaffMode(false);
    if (emp.structure) {
      setEditingStructure({
        ...emp.structure,
        allowances: (emp.structure.allowances || []).map((a) => ({ ...a })),
        deductions: (emp.structure.deductions || []).map((d) => ({ ...d })),
      });
    } else {
      const starter = createDefaultSalaryStructure(targetSchoolId, {
        id: emp.employeeId,
        name: emp.employeeName,
        designation: emp.designation,
        email: emp.employeeEmail || '',
        phone: emp.phone,
        cnic: emp.cnic,
      });
      starter.employeeUid = emp.employeeUid;
      setEditingStructure(starter);
    }
  };

  const openNewStaffStructureModal = () => {
    setIsNewStaffMode(true);
    const staffId = `staff_${Date.now().toString(36)}`;
    const starter = createDefaultSalaryStructure(targetSchoolId, {
      id: staffId,
      name: '',
      designation: 'Office Clerk / Support Staff',
      email: '',
    });
    starter.employeeUid = undefined;
    starter.employeeType = 'non_teaching';
    setEditingStructure(starter);
  };

  const updateStructureField = <K extends keyof SalaryStructure>(
    field: K,
    value: SalaryStructure[K]
  ) => {
    setEditingStructure((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [field]: value };
      const totals = calculateSalaryTotals({
        basicSalary: next.basicSalary,
        allowances: next.allowances,
        deductions: next.deductions,
      });
      return {
        ...next,
        basicSalary: totals.basicSalary,
        totalAllowances: totals.totalAllowances,
        grossSalary: totals.grossSalary,
        totalDeductions: totals.totalDeductions,
        netSalary: totals.netSalary,
      };
    });
  };

  const updateStructureLineItem = (
    kind: 'allowances' | 'deductions',
    itemId: string,
    patch: Partial<SalaryLineItem>
  ) => {
    setEditingStructure((prev) => {
      if (!prev) return prev;
      const list = (prev[kind] || []).map((item) =>
        item.id === itemId
          ? {
              ...item,
              ...patch,
              amount:
                patch.amount !== undefined
                  ? Math.max(0, Math.round(Number(patch.amount) || 0))
                  : item.amount,
            }
          : item
      );
      const next = { ...prev, [kind]: list };
      const totals = calculateSalaryTotals({
        basicSalary: next.basicSalary,
        allowances: next.allowances,
        deductions: next.deductions,
      });
      return {
        ...next,
        totalAllowances: totals.totalAllowances,
        grossSalary: totals.grossSalary,
        totalDeductions: totals.totalDeductions,
        netSalary: totals.netSalary,
      };
    });
  };

  const addStructureLineItem = (kind: 'allowances' | 'deductions') => {
    setEditingStructure((prev) => {
      if (!prev) return prev;
      const prefix = kind === 'allowances' ? 'alw' : 'ded';
      const newItem: SalaryLineItem = {
        id: `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
        label: kind === 'allowances' ? 'Special Allowance' : 'Other Deduction',
        amount: 0,
      };
      const next = { ...prev, [kind]: [...(prev[kind] || []), newItem] };
      return next;
    });
  };

  const removeStructureLineItem = (kind: 'allowances' | 'deductions', itemId: string) => {
    setEditingStructure((prev) => {
      if (!prev) return prev;
      const list = (prev[kind] || []).filter((item) => item.id !== itemId);
      const next = { ...prev, [kind]: list };
      const totals = calculateSalaryTotals({
        basicSalary: next.basicSalary,
        allowances: next.allowances,
        deductions: next.deductions,
      });
      return {
        ...next,
        totalAllowances: totals.totalAllowances,
        grossSalary: totals.grossSalary,
        totalDeductions: totals.totalDeductions,
        netSalary: totals.netSalary,
      };
    });
  };

  const handleApplyBps2026Autofill = () => {
    if (!editingStructure) return;
    const calc = calculateSindhSalary2026(bpsAutofillGrade, bpsAutofillStage);
    const allowances: SalaryLineItem[] = [
      { id: 'alw_hra', label: 'House Rent', amount: calc.houseRent },
      { id: 'alw_med', label: 'Medical Allowance', amount: calc.medical },
      { id: 'alw_trp', label: 'Transport Allowance', amount: calc.conveyance2026 },
      {
        id: 'alw_adhoc',
        label: 'Adhoc Relief Allowances (2023/24/26)',
        amount: calc.adhoc2023 + calc.adhoc2024 + calc.adhoc2026 + calc.differential2026,
      },
    ];
    const deductions: SalaryLineItem[] = [
      { id: 'ded_tax', label: 'Income Tax', amount: calc.incomeTax },
      { id: 'ded_gpf', label: 'Provident Fund', amount: calc.gpFund },
      {
        id: 'ded_bfgi',
        label: 'Benevolent Fund & Group Insurance',
        amount: calc.benevolentFund + calc.groupInsurance,
      },
    ];
    const totals = calculateSalaryTotals({
      basicSalary: calc.revisedBasic2026,
      allowances,
      deductions,
    });
    setEditingStructure((prev) =>
      prev
        ? {
            ...prev,
            bpsGrade: calc.bpsRow.bps,
            basicSalary: totals.basicSalary,
            allowances: totals.allowances,
            deductions: totals.deductions,
            totalAllowances: totals.totalAllowances,
            grossSalary: totals.grossSalary,
            totalDeductions: totals.totalDeductions,
            netSalary: totals.netSalary,
          }
        : prev
    );
  };

  const handleSaveStructureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStructure || !targetSchoolId) return;
    if (!editingStructure.employeeName.trim()) {
      showToast('Employee Full Name is required.', 'error');
      return;
    }
    setSavingStructure(true);
    try {
      const totals = calculateSalaryTotals({
        basicSalary: editingStructure.basicSalary,
        allowances: editingStructure.allowances,
        deductions: editingStructure.deductions,
      });
      const cleanRecord: Omit<SalaryStructure, 'schoolId'> = {
        ...editingStructure,
        employeeName: editingStructure.employeeName.trim(),
        designation: editingStructure.designation.trim() || 'Staff Member',
        employeeEmail: editingStructure.employeeEmail?.trim().toLowerCase() || undefined,
        basicSalary: totals.basicSalary,
        allowances: totals.allowances,
        deductions: totals.deductions,
        totalAllowances: totals.totalAllowances,
        grossSalary: totals.grossSalary,
        totalDeductions: totals.totalDeductions,
        netSalary: totals.netSalary,
      };
      const ok = await saveSalaryStructure(cleanRecord, targetSchoolId);
      if (ok) {
        showToast(
          `Salary structure for ${cleanRecord.employeeName} saved (Net Pay: Rs. ${cleanRecord.netSalary.toLocaleString()}).`
        );
        setEditingStructure(null);
      }
    } finally {
      setSavingStructure(false);
    }
  };

  // ===========================================================================
  // TAB 2 STATE: Monthly Payroll Generation
  // ===========================================================================
  const nowDate = useMemo(() => new Date(), []);
  const [payrollMonthNum, setPayrollMonthNum] = useState<number>(nowDate.getMonth() + 1);
  const [payrollYear, setPayrollYear] = useState<number>(nowDate.getFullYear());
  const selectedPayrollMonthKey = useMemo(
    () => buildPayrollMonthKey(payrollYear, payrollMonthNum),
    [payrollYear, payrollMonthNum]
  );
  const selectedPayrollMonthLabel = useMemo(
    () => formatMonthLabel(selectedPayrollMonthKey),
    [selectedPayrollMonthKey]
  );

  const [disbursementMethod, setDisbursementMethod] = useState<PayslipPaymentMethod>(
    scopedSettings.defaultPaymentMethod || 'Bank Transfer'
  );
  const [disbursementDate, setDisbursementDate] = useState<string>(
    nowDate.toISOString().split('T')[0]
  );
  const [payrollBusy, setPayrollBusy] = useState(false);

  // Adjust Individual Payslip Before Finalizing Modal
  const [adjustingPayslip, setAdjustingPayslip] = useState<EmployeePayslip | null>(null);
  const [previewPayslip, setPreviewPayslip] = useState<EmployeePayslip | null>(null);
  const [batchPreviewPayslips, setBatchPreviewPayslips] = useState<EmployeePayslip[] | null>(null);

  const monthPayslips = useMemo(
    () =>
      scopedPayslips
        .filter((p) => p.month === selectedPayrollMonthKey)
        .sort((a, b) => a.employeeName.localeCompare(b.employeeName)),
    [scopedPayslips, selectedPayrollMonthKey]
  );

  const payrollSummary = useMemo(() => {
    let grossTotal = 0;
    let deductionTotal = 0;
    let netTotal = 0;
    let paidCount = 0;
    let finalizedPendingCount = 0;
    let draftCount = 0;

    monthPayslips.forEach((p) => {
      grossTotal += p.grossSalary || 0;
      deductionTotal += p.totalDeductions || 0;
      netTotal += p.netSalary || 0;
      if (p.status === 'paid') paidCount += 1;
      else if (p.status === 'finalized' || p.isFinalized) finalizedPendingCount += 1;
      else draftCount += 1;
    });

    return {
      grossTotal,
      deductionTotal,
      netTotal,
      paidCount,
      finalizedPendingCount,
      draftCount,
    };
  }, [monthPayslips]);

  const ungeneratedConfiguredStructures = useMemo(() => {
    const existingEmpIds = new Set(
      monthPayslips.map((p) => sanitizePayrollIdSegment(p.employeeId))
    );
    return scopedStructures.filter(
      (s) => !existingEmpIds.has(sanitizePayrollIdSegment(s.employeeId))
    );
  }, [scopedStructures, monthPayslips]);

  const handleGenerateMonthlyPayroll = async () => {
    if (!targetSchoolId) return;
    if (scopedStructures.length === 0) {
      showToast('Please configure at least one employee salary structure first.', 'error');
      setActiveTab('structures');
      return;
    }
    if (ungeneratedConfiguredStructures.length === 0) {
      showToast(`Payroll for ${selectedPayrollMonthLabel} already includes all configured staff.`);
      return;
    }

    setPayrollBusy(true);
    try {
      const toCreate = ungeneratedConfiguredStructures.map((structure) =>
        buildPayslipFromStructure(structure, {
          schoolId: targetSchoolId,
          month: selectedPayrollMonthKey,
          defaultPaymentMethod: disbursementMethod,
          generatedByUid: currentUserProfile?.uid,
          generatedByName: currentUserProfile?.fullName || (isSuperAdmin ? 'Super Admin' : 'School Admin'),
        })
      );
      const ok = await saveBulkPayslips(toCreate, targetSchoolId);
      if (ok) {
        showToast(
          `Generated ${toCreate.length} draft payslip(s) for ${selectedPayrollMonthLabel}. Review or adjust salaries before finalizing.`
        );
      }
    } finally {
      setPayrollBusy(false);
    }
  };

  const handleFinalizeAllDrafts = async () => {
    const drafts = monthPayslips.filter((p) => !p.isFinalized && p.status === 'draft');
    if (drafts.length === 0) {
      showToast('No draft payslips remaining to finalize for this month.');
      return;
    }
    setPayrollBusy(true);
    try {
      const finalizedAt = new Date().toISOString();
      const updated = drafts.map((p) => ({
        ...p,
        status: 'finalized' as const,
        isFinalized: true,
        finalizedAt,
      }));
      const ok = await saveBulkPayslips(updated, targetSchoolId);
      if (ok) {
        showToast(
          `Finalized ${updated.length} payslip(s) for ${selectedPayrollMonthLabel}.`
        );
      }
    } finally {
      setPayrollBusy(false);
    }
  };

  const handleMarkAllPaid = async () => {
    const unpaid = monthPayslips.filter((p) => p.status !== 'paid');
    if (unpaid.length === 0) {
      showToast('All payslips for this month are already marked as Paid.');
      return;
    }
    setPayrollBusy(true);
    try {
      const nowIso = new Date().toISOString();
      const updated = unpaid.map((p, index) => ({
        ...p,
        status: 'paid' as const,
        isFinalized: true,
        finalizedAt: p.finalizedAt || nowIso,
        paymentDate: disbursementDate || nowIso.split('T')[0],
        paymentMethod: disbursementMethod,
        transactionRef: p.transactionRef || `${p.payslipNumber}-TX${index + 1}`,
      }));
      const ok = await saveBulkPayslips(updated, targetSchoolId);
      if (ok) {
        showToast(
          `Marked ${updated.length} salary payment(s) as PAID for ${selectedPayrollMonthLabel}.`
        );
      }
    } finally {
      setPayrollBusy(false);
    }
  };

  const handleFinalizeSingle = async (slip: EmployeePayslip) => {
    setPayrollBusy(true);
    try {
      const ok = await savePayslip(
        {
          ...slip,
          status: 'finalized',
          isFinalized: true,
          finalizedAt: new Date().toISOString(),
        },
        targetSchoolId
      );
      if (ok) showToast(`Finalized payslip for ${slip.employeeName}.`);
    } finally {
      setPayrollBusy(false);
    }
  };

  const handleReopenToDraft = async (slip: EmployeePayslip) => {
    setPayrollBusy(true);
    try {
      const ok = await savePayslip(
        {
          ...slip,
          status: 'draft',
          isFinalized: false,
          finalizedAt: undefined,
          paymentDate: undefined,
          transactionRef: undefined,
        },
        targetSchoolId
      );
      if (ok) showToast(`Reopened ${slip.employeeName}'s payslip for pre-finalization edits.`);
    } finally {
      setPayrollBusy(false);
    }
  };

  const handleMarkSinglePaid = async (slip: EmployeePayslip) => {
    setPayrollBusy(true);
    try {
      const ok = await savePayslip(
        {
          ...slip,
          status: 'paid',
          isFinalized: true,
          finalizedAt: slip.finalizedAt || new Date().toISOString(),
          paymentDate: disbursementDate || new Date().toISOString().split('T')[0],
          paymentMethod: disbursementMethod,
          transactionRef: slip.transactionRef || `${slip.payslipNumber}-PD`,
        },
        targetSchoolId
      );
      if (ok) showToast(`Salary marked Paid for ${slip.employeeName} (${slip.monthLabel}).`);
    } finally {
      setPayrollBusy(false);
    }
  };

  // Adjustment modal handlers
  const updateAdjustingLineItem = (
    kind: 'allowances' | 'deductions',
    itemId: string,
    patch: Partial<SalaryLineItem>
  ) => {
    setAdjustingPayslip((prev) => {
      if (!prev) return prev;
      const list = (prev[kind] || []).map((item) =>
        item.id === itemId
          ? {
              ...item,
              ...patch,
              amount:
                patch.amount !== undefined
                  ? Math.max(0, Math.round(Number(patch.amount) || 0))
                  : item.amount,
            }
          : item
      );
      const next = { ...prev, [kind]: list };
      const totals = calculateSalaryTotals({
        basicSalary: next.basicSalary,
        allowances: next.allowances,
        deductions: next.deductions,
        adjustmentAmount: next.adjustmentAmount,
      });
      return {
        ...next,
        totalAllowances: totals.totalAllowances,
        grossSalary: totals.grossSalary,
        totalDeductions: totals.totalDeductions,
        netSalary: totals.netSalary,
      };
    });
  };

  const updateAdjustingScalar = (patch: {
    basicSalary?: number;
    adjustmentAmount?: number;
    adjustmentReason?: string;
    notes?: string;
  }) => {
    setAdjustingPayslip((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      const totals = calculateSalaryTotals({
        basicSalary: next.basicSalary,
        allowances: next.allowances,
        deductions: next.deductions,
        adjustmentAmount: next.adjustmentAmount,
      });
      return {
        ...next,
        basicSalary: totals.basicSalary,
        totalAllowances: totals.totalAllowances,
        grossSalary: totals.grossSalary,
        totalDeductions: totals.totalDeductions,
        adjustmentAmount: totals.adjustmentAmount,
        netSalary: totals.netSalary,
      };
    });
  };

  const handleSaveAdjustedPayslip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingPayslip || !targetSchoolId) return;
    setPayrollBusy(true);
    try {
      const ok = await savePayslip(adjustingPayslip, targetSchoolId);
      if (ok) {
        showToast(
          `Adjusted ${adjustingPayslip.employeeName}'s ${adjustingPayslip.monthLabel} salary to Rs. ${adjustingPayslip.netSalary.toLocaleString()}.`
        );
        setAdjustingPayslip(null);
      }
    } finally {
      setPayrollBusy(false);
    }
  };

  // ===========================================================================
  // TAB 3 STATE: Salary History & Month Tracker
  // ===========================================================================
  const [historyEmployeeId, setHistoryEmployeeId] = useState<string>('all');
  const [historyYear, setHistoryYear] = useState<number>(nowDate.getFullYear());
  const [historyStatusFilter, setHistoryStatusFilter] = useState<
    'all' | 'paid' | 'finalized' | 'draft'
  >('all');
  const [historySearch, setHistorySearch] = useState('');

  const filteredHistoryPayslips = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return scopedPayslips
      .filter((p) => {
        if (historyEmployeeId !== 'all') {
          if (sanitizePayrollIdSegment(p.employeeId) !== sanitizePayrollIdSegment(historyEmployeeId)) {
            return false;
          }
        }
        if (p.year !== historyYear) return false;
        if (historyStatusFilter !== 'all' && p.status !== historyStatusFilter) return false;
        if (
          q &&
          !p.employeeName.toLowerCase().includes(q) &&
          !p.payslipNumber.toLowerCase().includes(q) &&
          !(p.designation || '').toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => (b.month || '').localeCompare(a.month || ''));
  }, [scopedPayslips, historyEmployeeId, historyYear, historyStatusFilter, historySearch]);

  const historyTotals = useMemo(() => {
    return filteredHistoryPayslips.reduce(
      (acc, p) => {
        if (p.status === 'paid') {
          acc.paidAmount += p.netSalary || 0;
          acc.paidCount += 1;
        } else {
          acc.pendingAmount += p.netSalary || 0;
          acc.pendingCount += 1;
        }
        return acc;
      },
      { paidAmount: 0, pendingAmount: 0, paidCount: 0, pendingCount: 0 }
    );
  }, [filteredHistoryPayslips]);

  const selectedHistoryEmployee = useMemo(
    () =>
      historyEmployeeId === 'all'
        ? null
        : unifiedEmployees.find(
            (e) => sanitizePayrollIdSegment(e.employeeId) === sanitizePayrollIdSegment(historyEmployeeId)
          ) || null,
    [historyEmployeeId, unifiedEmployees]
  );

  const selectedEmployeeYearlyTracker = useMemo(() => {
    if (!selectedHistoryEmployee) return [];
    return buildEmployeeYearlyPayrollTracker(
      selectedHistoryEmployee.employeeId,
      historyYear,
      scopedPayslips
    );
  }, [selectedHistoryEmployee, historyYear, scopedPayslips]);

  const handleExportHistoryCsv = async () => {
    const headers = [
      'Payslip #',
      'Month',
      'Employee Name',
      'Employee ID',
      'Designation',
      'Basic Salary',
      'Allowances',
      'Deductions',
      'Adjustment',
      'Net Salary',
      'Status',
      'Payment Date',
      'Payment Method',
    ];
    const rows = filteredHistoryPayslips.map((p) =>
      [
        p.payslipNumber,
        p.monthLabel,
        p.employeeName,
        p.employeeId,
        p.designation,
        p.basicSalary,
        p.totalAllowances,
        p.totalDeductions,
        p.adjustmentAmount,
        p.netSalary,
        p.status.toUpperCase(),
        p.paymentDate || '',
        p.paymentMethod || '',
      ]
        .map(escapeCsvCell)
        .join(',')
    );
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    await saveFileUniversal(
      blob,
      `Salary-History-${historyYear}-${sanitizePayrollIdSegment(targetSchool?.semisCode || 'school')}.csv`,
      'text/csv'
    );
    showToast('Salary history CSV exported.');
  };

  // ===========================================================================
  // STRICT RBAC GUARD VIEW
  // ===========================================================================
  if (!canAccessSalaryPayroll) {
    return (
      <div className="max-w-xl mx-auto my-8 bg-[#FFFDF9] dark:bg-[#211415] border border-rose-200 dark:border-rose-800 rounded-2xl p-6 text-center space-y-4 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-[#1C1917] dark:text-[#FAF8F5]">
            Access Restricted — Salary &amp; Payroll
          </h2>
          <p className="text-xs text-[#57534E] dark:text-[#D6CCC2]">
            Salary structures, monthly payroll generation, and staff salary ledgers are accessible only to School Administrators and Super Administrators. Teachers can view their own payslips under &ldquo;My Profile&rdquo; when enabled.
          </p>
        </div>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 bg-[#7F1D1D] hover:bg-[#651414] text-white text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </button>
        )}
      </div>
    );
  }

  const configuredCount = unifiedEmployees.filter((e) => Boolean(e.structure)).length;
  const totalBaseNetPayroll = scopedStructures.reduce((sum, s) => sum + (s.netSalary || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-2 text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#FAF8F5] hover:bg-[#F3EFEA] dark:hover:bg-[#3F1014] rounded-xl transition cursor-pointer shrink-0"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                  Salary &amp; Payroll Management (تنخواہ و پے رول)
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FEF2F2] dark:bg-[#3F1014]/70 text-[#7F1D1D] dark:text-[#FCA5A5] border border-[#FECACA] dark:border-[#7F1D1D]/60">
                  {isSuperAdmin ? 'Super Admin & School Payroll' : 'Admin Finance'}
                </span>
              </div>
              <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-0.5 truncate">
                {targetSchool?.name || 'Select School'} · SEMIS{' '}
                <span className="font-mono font-semibold">{targetSchool?.semisCode || '—'}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Teacher Payslip Self-Service Toggle */}
            <button
              type="button"
              onClick={async () => {
                const nextEnabled = !scopedSettings.teacherPayslipAccessEnabled;
                const ok = await updatePayrollSettings(
                  { teacherPayslipAccessEnabled: nextEnabled },
                  targetSchoolId
                );
                if (ok) {
                  showToast(
                    nextEnabled
                      ? 'Teacher Self-Service Payslips ENABLED (Teachers can now view their own finalized payslips).'
                      : 'Teacher Self-Service Payslips DISABLED (Hidden from teacher profiles).'
                  );
                }
              }}
              className={`min-h-[42px] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                scopedSettings.teacherPayslipAccessEnabled
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                  : 'bg-[#FAF8F5] dark:bg-[#2C1215] text-[#57534E] dark:text-[#D6CCC2] border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]'
              }`}
              title="Control whether active teachers can view & download their own finalized payslips in My Profile"
            >
              {scopedSettings.teacherPayslipAccessEnabled ? (
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <Lock className="w-4 h-4 text-[#78716C] shrink-0" />
              )}
              <span>
                Teacher Payslip View:{' '}
                {scopedSettings.teacherPayslipAccessEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </button>

            {isSuperAdmin && registeredSchools.length > 0 && (
              <div className="flex items-center gap-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl px-3 py-1.5 min-h-[42px]">
                <Building className="w-4 h-4 text-[#7F1D1D] dark:text-[#FCA5A5] shrink-0" />
                <select
                  aria-label="Select School for Payroll"
                  value={targetSchoolId}
                  onChange={(e) => setSelectedSchoolId(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden max-w-[220px] cursor-pointer"
                >
                  {registeredSchools.map((s) => (
                    <option key={s.id} value={s.id} className="bg-[#FFFDF9] text-[#1C1917]">
                      {s.name} ({s.semisCode})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#2C1215]/60 border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
            <span className="text-[11px] font-semibold text-[#57534E] dark:text-[#D6CCC2] block">
              Staff Structures Configured
            </span>
            <div className="text-lg sm:text-xl font-extrabold text-[#1C1917] dark:text-[#FAF8F5] mt-0.5 tabular-nums">
              {configuredCount} / {unifiedEmployees.length}
            </div>
            <span className="text-[10px] text-[#78716C]">Teaching &amp; Support Staff</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#2C1215]/60 border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
            <span className="text-[11px] font-semibold text-[#57534E] dark:text-[#D6CCC2] block">
              Base Monthly Net Payroll
            </span>
            <div className="text-lg sm:text-xl font-extrabold text-[#7F1D1D] dark:text-[#FCA5A5] mt-0.5 font-mono tabular-nums">
              Rs. {totalBaseNetPayroll.toLocaleString()}
            </div>
            <span className="text-[10px] text-[#78716C]">Standard configured monthly cycle</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#2C1215]/60 border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
            <span className="text-[11px] font-semibold text-[#57534E] dark:text-[#D6CCC2] block">
              {selectedPayrollMonthLabel} Net Total
            </span>
            <div className="text-lg sm:text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono tabular-nums">
              Rs. {payrollSummary.netTotal.toLocaleString()}
            </div>
            <span className="text-[10px] text-[#78716C]">
              {monthPayslips.length} payslip(s) generated
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#2C1215]/60 border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
            <span className="text-[11px] font-semibold text-[#57534E] dark:text-[#D6CCC2] block">
              Disbursement Status ({selectedPayrollMonthLabel})
            </span>
            <div className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5] mt-1 flex flex-wrap gap-2">
              <span className="text-emerald-600 dark:text-emerald-400">
                {payrollSummary.paidCount} Paid
              </span>
              <span className="text-amber-600 dark:text-amber-400">
                {payrollSummary.finalizedPendingCount} Pending
              </span>
              <span className="text-[#C2410C] dark:text-[#FDBA74]">
                {payrollSummary.draftCount} Draft
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`px-4 py-3 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-3 shadow-xs ${
            toast.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{toast.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Module Card with Tabs */}
      <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl overflow-hidden shadow-sm">
        <div className="flex border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('structures')}
            className={`min-h-[46px] py-3 px-4 sm:px-6 text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'structures'
                ? 'border-b-2 border-[#7F1D1D] text-[#7F1D1D] dark:text-[#FCA5A5] bg-[#FEF2F2]/50 dark:bg-[#3F1014]/30'
                : 'text-[#57534E] dark:text-[#D6CCC2] hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>1. Salary Structures ({configuredCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payroll')}
            className={`min-h-[46px] py-3 px-4 sm:px-6 text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'payroll'
                ? 'border-b-2 border-[#7F1D1D] text-[#7F1D1D] dark:text-[#FCA5A5] bg-[#FEF2F2]/50 dark:bg-[#3F1014]/30'
                : 'text-[#57534E] dark:text-[#D6CCC2] hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>2. Monthly Payroll &amp; Payslips ({selectedPayrollMonthLabel})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`min-h-[46px] py-3 px-4 sm:px-6 text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'history'
                ? 'border-b-2 border-[#7F1D1D] text-[#7F1D1D] dark:text-[#FCA5A5] bg-[#FEF2F2]/50 dark:bg-[#3F1014]/30'
                : 'text-[#57534E] dark:text-[#D6CCC2] hover:text-[#1C1917] dark:hover:text-[#FAF8F5]'
            }`}
          >
            <History className="w-4 h-4" />
            <span>3. Salary History &amp; Month Tracker</span>
          </button>
        </div>

        {loadingSchoolPayroll && (
          <div className="p-4 bg-[#FAF8F5] dark:bg-[#2C1215]/40 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-xs text-[#57534E] flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#7F1D1D]" />
            <span>Loading payroll records for {targetSchool?.name}...</span>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 1: SALARY STRUCTURE SETUP                                     */}
        {/* ================================================================= */}
        {activeTab === 'structures' && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="w-4 h-4 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={structSearch}
                    onChange={(e) => setStructSearch(e.target.value)}
                    placeholder="Search teacher or staff by name, designation..."
                    className="w-full min-h-[42px] pl-9 pr-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5]"
                  />
                </div>

                <select
                  value={structTypeFilter}
                  onChange={(e) => setStructTypeFilter(e.target.value as any)}
                  className="min-h-[42px] px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs font-semibold text-[#1C1917] dark:text-[#FAF8F5]"
                >
                  <option value="all">All Staff ({unifiedEmployees.length})</option>
                  <option value="teaching">Teaching Faculty</option>
                  <option value="non_teaching">Non-Teaching Staff</option>
                </select>
              </div>

              <button
                type="button"
                onClick={openNewStaffStructureModal}
                className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#7F1D1D] hover:bg-[#651414] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add Staff / Non-Teaching Employee</span>
              </button>
            </div>

            {filteredEmployees.length === 0 ? (
              <div className="py-12 text-center bg-[#FAF8F5] dark:bg-[#2C1215]/40 rounded-2xl border border-dashed border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] space-y-2">
                <Users className="w-8 h-8 text-[#78716C] mx-auto opacity-60" />
                <p className="text-xs font-semibold text-[#44403C] dark:text-[#E7E0D4]">
                  No employees found matching your filter.
                </p>
                <p className="text-[11px] text-[#78716C] max-w-md mx-auto">
                  Approve faculty under Faculty &amp; Requests or click &ldquo;Add Staff / Non-Teaching Employee&rdquo; to define a pay structure directly.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl">
                <table className="min-w-[760px] w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] dark:bg-[#2C1215]/70 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-[10px] uppercase tracking-wider text-[#57534E] dark:text-[#D6CCC2]">
                    <tr>
                      <th className="py-3 px-4">Employee &amp; Designation</th>
                      <th className="py-3 px-3">Type</th>
                      <th className="py-3 px-3 text-right">Basic Salary</th>
                      <th className="py-3 px-3 text-right">Allowances</th>
                      <th className="py-3 px-3 text-right">Deductions</th>
                      <th className="py-3 px-3 text-right">Net Salary</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E0D4] dark:divide-[rgba(255,253,249,0.10)]">
                    {filteredEmployees.map((emp) => {
                      const s = emp.structure;
                      return (
                        <tr
                          key={emp.employeeId}
                          className="hover:bg-[#FAF8F5]/70 dark:hover:bg-[#3F1014]/30 transition"
                        >
                          <td className="py-3 px-4">
                            <div className="font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                              {emp.employeeName}
                            </div>
                            <div className="text-[11px] text-[#57534E] dark:text-[#D6CCC2]">
                              {emp.designation}
                              {emp.employeeEmail ? ` · ${emp.employeeEmail}` : ''}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                emp.employeeType === 'non_teaching'
                                  ? 'bg-[#FFF7ED] text-[#C2410C] dark:bg-[#7C2D12]/60 dark:text-[#FDBA74]'
                                  : 'bg-[#FEF2F2] text-[#7F1D1D] dark:bg-[#3F1014]/60 dark:text-[#FCA5A5]'
                              }`}
                            >
                              {emp.employeeType === 'non_teaching' ? 'Non-Teaching' : 'Faculty'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-[#1C1917] dark:text-[#FAF8F5]">
                            {s ? `Rs. ${s.basicSalary.toLocaleString()}` : '—'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-emerald-700 dark:text-emerald-400">
                            {s ? `+ Rs. ${s.totalAllowances.toLocaleString()}` : '—'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-rose-700 dark:text-rose-400">
                            {s ? `- Rs. ${s.totalDeductions.toLocaleString()}` : '—'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-extrabold text-[#7F1D1D] dark:text-[#FCA5A5]">
                            {s ? `Rs. ${s.netSalary.toLocaleString()}` : (
                              <span className="text-[10px] font-sans font-semibold text-amber-600">
                                Not Configured
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditStructureModal(emp)}
                                className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7F1D1D] hover:bg-[#651414] text-white text-[11px] font-semibold transition cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span>{s ? 'Edit Pay' : 'Setup Salary'}</span>
                              </button>
                              {s && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const ok = await deleteSalaryStructure(s.employeeId, targetSchoolId);
                                    if (ok) {
                                      showToast(`Removed salary structure for ${s.employeeName}.`);
                                    }
                                  }}
                                  className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                                  title="Delete salary structure"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: MONTHLY PAYROLL GENERATION                                 */}
        {/* ================================================================= */}
        {activeTab === 'payroll' && (
          <div className="p-4 sm:p-5 space-y-5">
            {/* Period & Batch Actions Bar */}
            <div className="p-4 rounded-2xl bg-[#FAF8F5] dark:bg-[#2C1215]/60 border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] flex flex-col xl:flex-row xl:items-end justify-between gap-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
                <div>
                  <label className="block text-[11px] font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Payroll Month
                  </label>
                  <select
                    value={payrollMonthNum}
                    onChange={(e) => setPayrollMonthNum(Number(e.target.value))}
                    className="w-full min-h-[42px] px-3 py-2 bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs font-semibold text-[#1C1917] dark:text-[#FAF8F5]"
                  >
                    {MONTH_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Year
                  </label>
                  <select
                    value={payrollYear}
                    onChange={(e) => setPayrollYear(Number(e.target.value))}
                    className="w-full min-h-[42px] px-3 py-2 bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs font-semibold text-[#1C1917] dark:text-[#FAF8F5]"
                  >
                    {[2024, 2025, 2026, 2027, 2028].map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Payment Method
                  </label>
                  <select
                    value={disbursementMethod}
                    onChange={(e) => setDisbursementMethod(e.target.value as PayslipPaymentMethod)}
                    className="w-full min-h-[42px] px-3 py-2 bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs font-semibold text-[#1C1917] dark:text-[#FAF8F5]"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Disbursement Date
                  </label>
                  <input
                    type="date"
                    value={disbursementDate}
                    onChange={(e) => setDisbursementDate(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleGenerateMonthlyPayroll}
                  disabled={payrollBusy}
                  className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 bg-[#7F1D1D] hover:bg-[#651414] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-60"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {ungeneratedConfiguredStructures.length > 0
                      ? `Generate Payroll (${ungeneratedConfiguredStructures.length})`
                      : 'Sync Month Payroll'}
                  </span>
                </button>

                {payrollSummary.draftCount > 0 && (
                  <button
                    type="button"
                    onClick={handleFinalizeAllDrafts}
                    disabled={payrollBusy}
                    className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#C2410C] hover:bg-[#9A3412] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-60"
                  >
                    <FileCheck2 className="w-4 h-4" />
                    <span>Finalize Drafts ({payrollSummary.draftCount})</span>
                  </button>
                )}

                {monthPayslips.length > 0 && payrollSummary.paidCount < monthPayslips.length && (
                  <button
                    type="button"
                    onClick={handleMarkAllPaid}
                    disabled={payrollBusy}
                    className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-60"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Mark All Paid</span>
                  </button>
                )}

                {monthPayslips.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setBatchPreviewPayslips(monthPayslips)}
                    className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#FFFDF9] dark:bg-[#211415] hover:bg-[#F3EFEA] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-[#1C1917] dark:text-[#FAF8F5] text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-[#7F1D1D]" />
                    <span>All Payslips PDF ({monthPayslips.length})</span>
                  </button>
                )}
              </div>
            </div>

            {monthPayslips.length === 0 ? (
              <div className="py-12 text-center bg-[#FAF8F5] dark:bg-[#2C1215]/40 rounded-2xl border border-dashed border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] space-y-3">
                <Banknote className="w-9 h-9 text-[#7F1D1D] mx-auto opacity-60" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                    No Payroll Generated for {selectedPayrollMonthLabel}
                  </p>
                  <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] max-w-md mx-auto">
                    {scopedStructures.length > 0
                      ? `${scopedStructures.length} employee salary structure(s) are ready. Click "Generate Payroll" to auto-calculate Net Salaries = (Basic + Allowances) - Deductions.`
                      : 'Configure employee salary structures under Tab 1 first, then generate payroll for any month.'}
                  </p>
                </div>
                {scopedStructures.length > 0 && (
                  <button
                    type="button"
                    onClick={handleGenerateMonthlyPayroll}
                    className="min-h-[42px] inline-flex items-center gap-2 px-5 py-2.5 bg-[#7F1D1D] hover:bg-[#651414] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Generate {selectedPayrollMonthLabel} Payroll Now</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl">
                <table className="min-w-[880px] w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] dark:bg-[#2C1215]/70 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-[10px] uppercase tracking-wider text-[#57534E] dark:text-[#D6CCC2]">
                    <tr>
                      <th className="py-3 px-4">Employee &amp; Slip #</th>
                      <th className="py-3 px-3 text-right">Basic Pay</th>
                      <th className="py-3 px-3 text-right">Allowances</th>
                      <th className="py-3 px-3 text-right">Deductions</th>
                      <th className="py-3 px-3 text-right">Adjustment</th>
                      <th className="py-3 px-3 text-right">Net Payable</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E0D4] dark:divide-[rgba(255,253,249,0.10)]">
                    {monthPayslips.map((slip) => (
                      <tr
                        key={slip.id}
                        className="hover:bg-[#FAF8F5]/70 dark:hover:bg-[#3F1014]/30 transition"
                      >
                        <td className="py-3 px-4">
                          <div className="font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                            {slip.employeeName}
                          </div>
                          <div className="text-[11px] text-[#57534E] dark:text-[#D6CCC2]">
                            {slip.designation} ·{' '}
                            <span className="font-mono text-[#7F1D1D] dark:text-[#FCA5A5]">
                              {slip.payslipNumber}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono">
                          Rs. {slip.basicSalary.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-emerald-700 dark:text-emerald-400">
                          + {slip.totalAllowances.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-rose-700 dark:text-rose-400">
                          - {slip.totalDeductions.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right font-mono">
                          {slip.adjustmentAmount === 0 ? (
                            <span className="text-[#78716C]">0</span>
                          ) : (
                            <span
                              className={
                                slip.adjustmentAmount > 0
                                  ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                                  : 'text-rose-700 dark:text-rose-400 font-semibold'
                              }
                              title={slip.adjustmentReason || 'Manual Adjustment'}
                            >
                              {slip.adjustmentAmount > 0
                                ? `+ ${slip.adjustmentAmount.toLocaleString()}`
                                : `- ${Math.abs(slip.adjustmentAmount).toLocaleString()}`}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-extrabold text-[#1C1917] dark:text-[#FAF8F5]">
                          Rs. {slip.netSalary.toLocaleString()}
                        </td>
                        <td className="py-3 px-3">
                          {slip.status === 'paid' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              Paid
                            </span>
                          ) : slip.isFinalized || slip.status === 'finalized' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              <Clock className="w-3 h-3" />
                              Pending Pay
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF7ED] dark:bg-[#7C2D12]/60 text-[#C2410C] dark:text-[#FDBA74] border border-[#FED7AA]">
                              Draft
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!slip.isFinalized && slip.status === 'draft' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setAdjustingPayslip({
                                      ...slip,
                                      allowances: (slip.allowances || []).map((a) => ({ ...a })),
                                      deductions: (slip.deductions || []).map((d) => ({ ...d })),
                                    })
                                  }
                                  className="min-h-[34px] px-2.5 py-1 rounded-lg bg-[#F3EFEA] dark:bg-[#2C1215] hover:bg-[#E7E0D4] text-[#44403C] dark:text-[#FAF8F5] text-[11px] font-semibold cursor-pointer"
                                >
                                  Adjust
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleFinalizeSingle(slip)}
                                  className="min-h-[34px] px-2.5 py-1 rounded-lg bg-[#C2410C] hover:bg-[#9A3412] text-white text-[11px] font-semibold cursor-pointer"
                                >
                                  Finalize
                                </button>
                              </>
                            ) : slip.status !== 'paid' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleReopenToDraft(slip)}
                                  className="min-h-[34px] p-1.5 rounded-lg bg-[#F3EFEA] dark:bg-[#2C1215] text-[#57534E] hover:text-[#1C1917] cursor-pointer"
                                  title="Unlock draft to adjust before payment"
                                >
                                  <Unlock className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMarkSinglePaid(slip)}
                                  className="min-h-[34px] px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer"
                                >
                                  Mark Paid
                                </button>
                              </>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => setPreviewPayslip(slip)}
                              className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#7F1D1D] hover:bg-[#651414] text-white text-[11px] font-semibold cursor-pointer"
                              title="View / Download PDF Payslip"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Payslip PDF</span>
                            </button>

                            {slip.status === 'draft' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  const ok = await deletePayslip(slip.id, targetSchoolId);
                                  if (ok) showToast(`Removed draft payslip for ${slip.employeeName}.`);
                                }}
                                className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                                title="Delete draft"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: SALARY HISTORY & MONTHLY PAID/PENDING TRACKER              */}
        {/* ================================================================= */}
        {activeTab === 'history' && (
          <div className="p-4 sm:p-5 space-y-5">
            {/* Filter Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                  Employee Filter
                </label>
                <select
                  value={historyEmployeeId}
                  onChange={(e) => setHistoryEmployeeId(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs font-semibold text-[#1C1917] dark:text-[#FAF8F5]"
                >
                  <option value="all">All Employees ({unifiedEmployees.length})</option>
                  {unifiedEmployees.map((emp) => (
                    <option key={emp.employeeId} value={emp.employeeId}>
                      {emp.employeeName} ({emp.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                  Tracker Year
                </label>
                <select
                  value={historyYear}
                  onChange={(e) => setHistoryYear(Number(e.target.value))}
                  className="w-full min-h-[42px] px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs font-semibold text-[#1C1917] dark:text-[#FAF8F5]"
                >
                  {[2024, 2025, 2026, 2027, 2028].map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                  Payment Status
                </label>
                <select
                  value={historyStatusFilter}
                  onChange={(e) => setHistoryStatusFilter(e.target.value as any)}
                  className="w-full min-h-[42px] px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs font-semibold text-[#1C1917] dark:text-[#FAF8F5]"
                >
                  <option value="all">All Statuses</option>
                  <option value="paid">Paid Only</option>
                  <option value="finalized">Finalized · Pending Payment</option>
                  <option value="draft">Drafts Only</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                  Quick Search
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Slip # or employee..."
                    className="w-full min-h-[42px] pl-9 pr-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5]"
                  />
                </div>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleExportHistoryCsv}
                  disabled={filteredHistoryPayslips.length === 0}
                  className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-[#F3EFEA] dark:bg-[#2C1215] hover:bg-[#E7E0D4] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-[#1C1917] dark:text-[#FAF8F5] text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-4 h-4 text-[#7F1D1D]" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Yearly KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
                <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 block">
                  Total Paid ({historyYear})
                </span>
                <div className="text-lg font-extrabold font-mono text-emerald-700 dark:text-emerald-300">
                  Rs. {historyTotals.paidAmount.toLocaleString()}
                </div>
                <span className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80">
                  {historyTotals.paidCount} Paid Voucher(s)
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60">
                <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 block">
                  Pending / Unsettled ({historyYear})
                </span>
                <div className="text-lg font-extrabold font-mono text-amber-700 dark:text-amber-300">
                  Rs. {historyTotals.pendingAmount.toLocaleString()}
                </div>
                <span className="text-[10px] text-amber-700/80 dark:text-amber-300/80">
                  {historyTotals.pendingCount} Pending/Draft Item(s)
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#2C1215]/60 border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] col-span-2 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-[#57534E] dark:text-[#D6CCC2] block">
                    12-Month Payment Audit Legend ({historyYear})
                  </span>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px]">
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Paid
                    </span>
                    <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Pending Payment
                    </span>
                    <span className="inline-flex items-center gap-1 text-[#C2410C] dark:text-[#FDBA74] font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#C2410C]" /> Draft
                    </span>
                    <span className="inline-flex items-center gap-1 text-[#78716C]">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#D6CCC2]" /> Pending Generation
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 12-MONTH TRACKER: Single Employee Card Grid OR All-Staff Matrix */}
            {selectedHistoryEmployee ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#57534E] dark:text-[#D6CCC2]">
                    {selectedHistoryEmployee.employeeName} — {historyYear} Monthly Status
                  </h3>
                  <button
                    type="button"
                    onClick={() => setHistoryEmployeeId('all')}
                    className="text-xs font-bold text-[#7F1D1D] dark:text-[#FCA5A5] hover:underline cursor-pointer"
                  >
                    Show All Staff Matrix →
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                  {selectedEmployeeYearlyTracker.map((cell) => (
                    <div
                      key={cell.month}
                      className={`p-3 rounded-xl border space-y-1.5 ${
                        cell.trackerState === 'paid'
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                          : cell.trackerState === 'pending'
                          ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                          : cell.trackerState === 'draft'
                          ? 'bg-[#FFF7ED] dark:bg-[#7C2D12]/30 border-[#FED7AA]'
                          : 'bg-[#FAF8F5] dark:bg-[#2C1215]/40 border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                          {cell.monthShort} {historyYear}
                        </span>
                        <span
                          className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                            cell.trackerState === 'paid'
                              ? 'bg-emerald-600 text-white'
                              : cell.trackerState === 'pending'
                              ? 'bg-amber-500 text-white'
                              : cell.trackerState === 'draft'
                              ? 'bg-[#C2410C] text-white'
                              : 'bg-[#E7E0D4] text-[#57534E]'
                          }`}
                        >
                          {cell.trackerState === 'paid'
                            ? 'Paid'
                            : cell.trackerState === 'pending'
                            ? 'Pending'
                            : cell.trackerState === 'draft'
                            ? 'Draft'
                            : 'Unpaid'}
                        </span>
                      </div>

                      {cell.payslip ? (
                        <>
                          <div className="font-mono text-xs font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                            Rs. {cell.payslip.netSalary.toLocaleString()}
                          </div>
                          <div className="flex items-center gap-1 pt-0.5">
                            <button
                              type="button"
                              onClick={() => setPreviewPayslip(cell.payslip)}
                              className="text-[10px] font-bold text-[#7F1D1D] dark:text-[#FCA5A5] hover:underline cursor-pointer"
                            >
                              View PDF
                            </button>
                            {cell.payslip.status !== 'paid' && (
                              <button
                                type="button"
                                onClick={() => handleMarkSinglePaid(cell.payslip!)}
                                className="ml-auto text-[10px] font-bold text-emerald-700 hover:underline cursor-pointer"
                              >
                                Mark Paid
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setPayrollMonthNum(cell.monthNumber);
                            setPayrollYear(historyYear);
                            setActiveTab('payroll');
                          }}
                          className="text-[10px] font-semibold text-[#7F1D1D] dark:text-[#FCA5A5] hover:underline cursor-pointer block pt-1"
                        >
                          Process Payroll →
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              unifiedEmployees.length > 0 && (
                <div className="overflow-x-auto border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl">
                  <table className="min-w-[820px] w-full text-left text-[11px]">
                    <thead className="bg-[#FAF8F5] dark:bg-[#2C1215]/70 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] uppercase text-[#57534E] dark:text-[#D6CCC2]">
                      <tr>
                        <th className="py-2.5 px-3">Employee ({historyYear} Tracker)</th>
                        {MONTH_OPTIONS.map((m) => (
                          <th key={m.value} className="py-2.5 px-1.5 text-center">
                            {m.label.slice(0, 3)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7E0D4] dark:divide-[rgba(255,253,249,0.10)]">
                      {unifiedEmployees.map((emp) => {
                        const rowTracker = buildEmployeeYearlyPayrollTracker(
                          emp.employeeId,
                          historyYear,
                          scopedPayslips
                        );
                        return (
                          <tr key={emp.employeeId} className="hover:bg-[#FAF8F5]/60 dark:hover:bg-[#3F1014]/25">
                            <td className="py-2 px-3 font-semibold text-[#1C1917] dark:text-[#FAF8F5]">
                              <button
                                type="button"
                                onClick={() => setHistoryEmployeeId(emp.employeeId)}
                                className="hover:underline text-left cursor-pointer"
                              >
                                {emp.employeeName}
                              </button>
                            </td>
                            {rowTracker.map((cell) => (
                              <td key={cell.month} className="py-2 px-1 text-center">
                                {cell.trackerState === 'paid' ? (
                                  <button
                                    type="button"
                                    onClick={() => cell.payslip && setPreviewPayslip(cell.payslip)}
                                    className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] cursor-pointer"
                                    title={`Paid Rs. ${cell.payslip?.netSalary.toLocaleString()} (${cell.payslip?.paymentDate || ''})`}
                                  >
                                    Paid
                                  </button>
                                ) : cell.trackerState === 'pending' ? (
                                  <button
                                    type="button"
                                    onClick={() => cell.payslip && setPreviewPayslip(cell.payslip)}
                                    className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 font-bold text-[10px] cursor-pointer"
                                    title={`Finalized, awaiting payment (Rs. ${cell.payslip?.netSalary.toLocaleString()})`}
                                  >
                                    Pend
                                  </button>
                                ) : cell.trackerState === 'draft' ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPayrollMonthNum(cell.monthNumber);
                                      setPayrollYear(historyYear);
                                      setActiveTab('payroll');
                                    }}
                                    className="px-1.5 py-0.5 rounded bg-[#FFEDD5] text-[#C2410C] font-bold text-[10px] cursor-pointer"
                                    title="Draft payroll — click to review"
                                  >
                                    Draft
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPayrollMonthNum(cell.monthNumber);
                                      setPayrollYear(historyYear);
                                      setActiveTab('payroll');
                                    }}
                                    className="text-[#78716C] hover:text-[#7F1D1D] text-[10px] cursor-pointer"
                                    title={`No payroll for ${cell.monthLabel} — click to generate`}
                                  >
                                    —
                                  </button>
                                )}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* Historical Ledger Table */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#57534E] dark:text-[#D6CCC2]">
                Salary Payment Ledger ({filteredHistoryPayslips.length} Record{filteredHistoryPayslips.length === 1 ? '' : 's'})
              </h3>
              {filteredHistoryPayslips.length === 0 ? (
                <div className="py-10 text-center bg-[#FAF8F5] dark:bg-[#2C1215]/40 rounded-xl border border-dashed border-[#E7E0D4] text-xs text-[#78716C]">
                  No salary payment records match the selected year, employee, or status filters.
                </div>
              ) : (
                <div className="overflow-x-auto border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl">
                  <table className="min-w-[800px] w-full text-left text-xs">
                    <thead className="bg-[#FAF8F5] dark:bg-[#2C1215]/70 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-[10px] uppercase text-[#57534E] dark:text-[#D6CCC2]">
                      <tr>
                        <th className="py-2.5 px-3">Month</th>
                        <th className="py-2.5 px-3">Employee</th>
                        <th className="py-2.5 px-3">Slip #</th>
                        <th className="py-2.5 px-3 text-right">Net Pay</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Payment Details</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7E0D4] dark:divide-[rgba(255,253,249,0.10)]">
                      {filteredHistoryPayslips.map((p) => (
                        <tr key={p.id} className="hover:bg-[#FAF8F5]/60 dark:hover:bg-[#3F1014]/25">
                          <td className="py-2.5 px-3 font-semibold">{p.monthLabel}</td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                              {p.employeeName}
                            </div>
                            <div className="text-[10px] text-[#78716C]">{p.designation}</div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px]">{p.payslipNumber}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-[#7F1D1D] dark:text-[#FCA5A5]">
                            Rs. {p.netSalary.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3">
                            {p.status === 'paid' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Paid
                              </span>
                            ) : p.isFinalized ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                Pending Pay
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF7ED] text-[#C2410C] border border-[#FED7AA]">
                                Draft
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-[#57534E] dark:text-[#D6CCC2]">
                            {p.status === 'paid'
                              ? `${p.paymentDate || 'Paid'} · ${p.paymentMethod || 'Bank Transfer'}`
                              : 'Awaiting Disbursement'}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {p.status !== 'paid' && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkSinglePaid(p)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer"
                                >
                                  Mark Paid
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setPreviewPayslip(p)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#7F1D1D] hover:bg-[#651414] text-white text-[11px] font-semibold cursor-pointer"
                              >
                                <Download className="w-3 h-3" />
                                <span>PDF</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* MODAL: SALARY STRUCTURE EDITOR                                      */}
      {/* =================================================================== */}
      {editingStructure && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#2C1215]/70 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Configure Salary Structure"
        >
          <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl w-full max-w-2xl max-h-[90dvh] overflow-y-auto shadow-2xl p-4 sm:p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
              <div>
                <h3 className="text-base font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                  {isNewStaffMode ? 'Add Staff Member Salary Structure' : `Salary Structure · ${editingStructure.employeeName}`}
                </h3>
                <p className="text-[11px] text-[#57534E] dark:text-[#D6CCC2]">
                  Firestore Path: schools/{targetSchoolId}/salaryStructures/{editingStructure.employeeId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingStructure(null)}
                className="p-1.5 text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#FAF8F5] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStructureSubmit} className="space-y-4 text-xs">
              {/* Employee Identity Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Employee Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingStructure.employeeName}
                    onChange={(e) => updateStructureField('employeeName', e.target.value)}
                    placeholder="e.g., Mr. Sajid Hussain"
                    className="w-full min-h-[40px] px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Designation / Role *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingStructure.designation}
                    onChange={(e) => updateStructureField('designation', e.target.value)}
                    placeholder="e.g., HST Science (BPS-16) / Clerk"
                    className="w-full min-h-[40px] px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Staff Category
                  </label>
                  <select
                    value={editingStructure.employeeType}
                    onChange={(e) =>
                      updateStructureField('employeeType', e.target.value as SalaryEmployeeType)
                    }
                    className="w-full min-h-[40px] px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs"
                  >
                    <option value="teaching">Teaching Faculty</option>
                    <option value="non_teaching">Non-Teaching / Admin Support Staff</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Employee Email (for Teacher Payslip View)
                  </label>
                  <input
                    type="email"
                    value={editingStructure.employeeEmail || ''}
                    onChange={(e) => updateStructureField('employeeEmail', e.target.value)}
                    placeholder="teacher@seld.gos.pk"
                    className="w-full min-h-[40px] px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* Optional Sindh BPS 2026 Quick Autofill */}
              <div className="p-3 rounded-xl bg-[#FFF7ED] dark:bg-[#7C2D12]/30 border border-[#FED7AA] dark:border-[#C2410C]/40 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] text-[#9A3412] dark:text-[#FDBA74] font-semibold">
                  Sindh BPS 2026 Quick Preset:
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={bpsAutofillGrade}
                    onChange={(e) => setBpsAutofillGrade(Number(e.target.value))}
                    className="px-2.5 py-1.5 rounded-lg bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] text-xs font-semibold"
                  >
                    {Array.from({ length: 22 }, (_, i) => i + 1).map((bps) => (
                      <option key={bps} value={bps}>
                        BPS-{String(bps).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={bpsAutofillStage}
                    onChange={(e) => setBpsAutofillStage(Number(e.target.value) || 0)}
                    className="w-20 px-2.5 py-1.5 rounded-lg bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] text-xs font-mono"
                    title="Increment Stage (0..30)"
                  />
                  <button
                    type="button"
                    onClick={handleApplyBps2026Autofill}
                    className="px-3 py-1.5 rounded-lg bg-[#C2410C] hover:bg-[#9A3412] text-white text-xs font-bold cursor-pointer"
                  >
                    Auto-Fill Scale
                  </button>
                </div>
              </div>

              {/* Basic Salary */}
              <div className="p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#2C1215]/60 border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
                <label className="block text-[11px] font-bold text-[#7F1D1D] dark:text-[#FCA5A5] uppercase tracking-wider mb-1.5">
                  Basic Monthly Salary (PKR) *
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={editingStructure.basicSalary}
                  onChange={(e) => updateStructureField('basicSalary', Math.max(0, Number(e.target.value) || 0))}
                  className="w-full min-h-[44px] px-3.5 py-2 bg-[#FFFDF9] dark:bg-[#211415] border border-[#D6CCC2] rounded-xl text-sm font-mono font-bold text-[#1C1917] dark:text-[#FAF8F5]"
                />
              </div>

              {/* Allowances & Deductions Side by Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Allowances */}
                <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                      Allowances (House Rent, Medical, Transport...)
                    </span>
                    <button
                      type="button"
                      onClick={() => addStructureLineItem('allowances')}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </div>
                  {(editingStructure.allowances || []).map((alw) => (
                    <div key={alw.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={alw.label}
                        onChange={(e) =>
                          updateStructureLineItem('allowances', alw.id, { label: e.target.value })
                        }
                        placeholder="Allowance label"
                        className="flex-1 min-w-0 px-2.5 py-1.5 bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] rounded-lg text-xs"
                      />
                      <input
                        type="number"
                        min={0}
                        value={alw.amount}
                        onChange={(e) =>
                          updateStructureLineItem('allowances', alw.id, {
                            amount: Number(e.target.value) || 0,
                          })
                        }
                        className="w-24 px-2.5 py-1.5 bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] rounded-lg text-xs font-mono text-right"
                      />
                      <button
                        type="button"
                        onClick={() => removeStructureLineItem('allowances', alw.id)}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Deductions */}
                <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50/30 dark:bg-rose-950/20 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                      Deductions (Tax, Provident Fund, Loan...)
                    </span>
                    <button
                      type="button"
                      onClick={() => addStructureLineItem('deductions')}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-bold cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </div>
                  {(editingStructure.deductions || []).map((ded) => (
                    <div key={ded.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={ded.label}
                        onChange={(e) =>
                          updateStructureLineItem('deductions', ded.id, { label: e.target.value })
                        }
                        placeholder="Deduction label"
                        className="flex-1 min-w-0 px-2.5 py-1.5 bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] rounded-lg text-xs"
                      />
                      <input
                        type="number"
                        min={0}
                        value={ded.amount}
                        onChange={(e) =>
                          updateStructureLineItem('deductions', ded.id, {
                            amount: Number(e.target.value) || 0,
                          })
                        }
                        className="w-24 px-2.5 py-1.5 bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] rounded-lg text-xs font-mono text-right"
                      />
                      <button
                        type="button"
                        onClick={() => removeStructureLineItem('deductions', ded.id)}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Optional Bank & CNIC Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    CNIC Number
                  </label>
                  <input
                    type="text"
                    value={editingStructure.cnic || ''}
                    onChange={(e) => updateStructureField('cnic', e.target.value)}
                    placeholder="41303-1234567-1"
                    className="w-full px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={editingStructure.bankName || ''}
                    onChange={(e) => updateStructureField('bankName', e.target.value)}
                    placeholder="e.g., NBP / Sindh Bank / HBL"
                    className="w-full px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Account / IBAN
                  </label>
                  <input
                    type="text"
                    value={editingStructure.accountNumber || ''}
                    onChange={(e) => updateStructureField('accountNumber', e.target.value)}
                    placeholder="PK00..."
                    className="w-full px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              {/* Net Calculation Footer Box */}
              <div className="p-4 rounded-xl bg-[#2C1215] text-[#FAF8F5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap gap-4 text-xs">
                  <div>
                    <span className="text-[#D6CCC2] text-[10px] block">Basic + Allowances</span>
                    <strong className="font-mono text-emerald-300">
                      Rs. {editingStructure.grossSalary.toLocaleString()}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#D6CCC2] text-[10px] block">Total Deductions</span>
                    <strong className="font-mono text-rose-300">
                      - Rs. {editingStructure.totalDeductions.toLocaleString()}
                    </strong>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-[#FED7AA] text-[10px] font-bold uppercase block">
                    Net Salary = (Basic + Allowances) - Deductions
                  </span>
                  <span className="text-xl font-black font-mono text-white">
                    Rs. {editingStructure.netSalary.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStructure(null)}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[#F3EFEA] text-[#44403C] text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingStructure}
                  className="min-h-[42px] inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#7F1D1D] hover:bg-[#651414] text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingStructure ? 'Saving...' : 'Save Salary Structure'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: ADJUST INDIVIDUAL PAYSLIP BEFORE FINALIZING                  */}
      {/* =================================================================== */}
      {adjustingPayslip && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#2C1215]/70 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Adjust Monthly Salary Before Finalizing"
        >
          <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl w-full max-w-xl max-h-[90dvh] overflow-y-auto shadow-2xl p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                  Adjust Salary · {adjustingPayslip.employeeName}
                </h3>
                <p className="text-[11px] text-[#57534E] dark:text-[#D6CCC2]">
                  {adjustingPayslip.monthLabel} · Edit draft amounts before finalizing
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustingPayslip(null)}
                className="p-1.5 text-[#78716C] hover:text-[#1C1917] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustedPayslip} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Basic Salary (This Month)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={adjustingPayslip.basicSalary}
                    onChange={(e) =>
                      updateAdjustingScalar({
                        basicSalary: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-full px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] rounded-xl font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                    Bonus (+) / Leave Cut (-) Adjustment
                  </label>
                  <input
                    type="number"
                    value={adjustingPayslip.adjustmentAmount}
                    onChange={(e) =>
                      updateAdjustingScalar({
                        adjustmentAmount: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                  Adjustment Reason / Payslip Remarks
                </label>
                <input
                  type="text"
                  value={adjustingPayslip.adjustmentReason || ''}
                  onChange={(e) =>
                    updateAdjustingScalar({ adjustmentReason: e.target.value })
                  }
                  placeholder="e.g., Extra exam invigilation allowance / 2 days unpaid leave cut"
                  className="w-full px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] rounded-xl text-xs"
                />
              </div>

              {(adjustingPayslip.allowances || []).length > 0 && (
                <div className="space-y-2 p-3 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50">
                  <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                    Monthly Allowances Override
                  </div>
                  {(adjustingPayslip.allowances || []).map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-2">
                      <span className="text-[#1C1917] dark:text-[#FAF8F5]">{a.label}</span>
                      <input
                        type="number"
                        min={0}
                        value={a.amount}
                        onChange={(e) =>
                          updateAdjustingLineItem('allowances', a.id, {
                            amount: Number(e.target.value) || 0,
                          })
                        }
                        className="w-28 px-2.5 py-1 bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] rounded-lg font-mono text-right"
                      />
                    </div>
                  ))}
                </div>
              )}

              {(adjustingPayslip.deductions || []).length > 0 && (
                <div className="space-y-2 p-3 rounded-xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/50">
                  <div className="text-[11px] font-bold text-rose-700 dark:text-rose-300 uppercase">
                    Monthly Deductions Override
                  </div>
                  {(adjustingPayslip.deductions || []).map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-2">
                      <span className="text-[#1C1917] dark:text-[#FAF8F5]">{d.label}</span>
                      <input
                        type="number"
                        min={0}
                        value={d.amount}
                        onChange={(e) =>
                          updateAdjustingLineItem('deductions', d.id, {
                            amount: Number(e.target.value) || 0,
                          })
                        }
                        className="w-28 px-2.5 py-1 bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] rounded-lg font-mono text-right"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-[#2C1215] text-white flex items-center justify-between">
                <span className="text-xs font-bold text-[#FED7AA]">Adjusted Net Salary:</span>
                <span className="text-lg font-black font-mono">
                  Rs. {adjustingPayslip.netSalary.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustingPayslip(null)}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#F3EFEA] text-[#44403C] text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={payrollBusy}
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#7F1D1D] hover:bg-[#651414] text-white text-xs font-bold cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Draft Adjustment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Single or Batch A4 PDF Payslip Modal */}
      <PayslipPreviewModal
        isOpen={Boolean(previewPayslip || batchPreviewPayslips)}
        onClose={() => {
          setPreviewPayslip(null);
          setBatchPreviewPayslips(null);
        }}
        school={targetSchool}
        payslip={previewPayslip}
        batchPayslips={batchPreviewPayslips}
      />
    </div>
  );
};
