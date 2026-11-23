import React, { useState, useMemo } from 'react';
import {
  Receipt,
  CreditCard,
  Plus,
  Trash2,
  Save,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  ArrowRight,
  Clock,
  Sparkles,
  X,
  Layers,
  TrendingUp,
  Building,
  UserCheck,
  ShieldAlert,
  HelpCircle,
  FileText,
  DollarSign,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { useSms } from '../context/SmsContext';
import { ClassFeeStructure, CustomFeeCharge, FeePayment, PaymentMethod, Student } from '../types';
import { triggerPrintDocument } from '../../../utils/printDocument';

interface FeeManagementProps {
  onBack?: () => void;
  initialTab?: 'structure' | 'collect' | 'defaulters';
  initialStudentId?: string;
  initialClassId?: string;
}

export const FeeManagement: React.FC<FeeManagementProps> = ({
  onBack,
  initialTab = 'structure',
  initialStudentId,
  initialClassId,
}) => {
  const {
    activeSchool,
    classes,
    students,
    feeStructures,
    feePayments,
    saveClassFeeStructure,
    deleteClassFeeStructure,
    recordFeePayment,
    canManageFeeStructure,
    canCollectFee,
    currentUserProfile,
    userRole,
    isSuperAdmin,
  } = useSms();

  // Active Tab state: If user cannot manage structure, default to 'collect'
  const [activeTab, setActiveTab] = useState<'structure' | 'collect' | 'defaulters'>(() => {
    if (initialTab === 'structure' && !canManageFeeStructure && canCollectFee) {
      return 'collect';
    }
    return initialTab;
  });

  // Current Month State (defaults to current YYYY-MM)
  const currentMonthStr = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);

  const monthOptions = useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = -5; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      list.push({ val, label });
    }
    return list;
  }, []);

  const currentMonthLabel = useMemo(() => {
    const found = monthOptions.find((m) => m.val === selectedMonth);
    if (found) return found.label;
    const [y, m] = selectedMonth.split('-');
    const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }, [selectedMonth, monthOptions]);

  // =========================================================================
  // TAB 1: Fee Structure Setup State
  // =========================================================================
  // Local state map for editable class fee structures: classId -> ClassFeeStructure
  const [editingStructures, setEditingStructures] = useState<Record<string, ClassFeeStructure>>(() => {
    const map: Record<string, ClassFeeStructure> = {};
    classes.forEach((c) => {
      const existing = feeStructures.find((f) => f.classId === c.id);
      map[c.id] = existing
        ? { ...existing, customCharges: [...(existing.customCharges || [])] }
        : {
            id: c.id,
            schoolId: activeSchool.id,
            classId: c.id,
            grade: c.grade,
            monthlyTuitionFee: 1500,
            admissionFee: 2000,
            examFee: 500,
            customCharges: [],
            academicYear: activeSchool.activeAcademicYear || '2025-2026',
          };
    });
    return map;
  });

  // Keep local editing state synced if feeStructures updates from Firestore
  React.useEffect(() => {
    setEditingStructures((prev) => {
      const next = { ...prev };
      classes.forEach((c) => {
        const remote = feeStructures.find((f) => f.classId === c.id);
        if (remote && !next[c.id]) {
          next[c.id] = { ...remote, customCharges: [...(remote.customCharges || [])] };
        } else if (!next[c.id]) {
          next[c.id] = {
            id: c.id,
            schoolId: activeSchool.id,
            classId: c.id,
            grade: c.grade,
            monthlyTuitionFee: 1500,
            admissionFee: 2000,
            examFee: 500,
            customCharges: [],
            academicYear: activeSchool.activeAcademicYear || '2025-2026',
          };
        }
      });
      return next;
    });
  }, [feeStructures, classes, activeSchool.id, activeSchool.activeAcademicYear]);

  const [savingClassId, setSavingClassId] = useState<string | null>(null);
  const [structureSaveSuccess, setStructureSaveSuccess] = useState<string | null>(null);

  // New Custom Charge Modal State
  const [customChargeModalClassId, setCustomChargeModalClassId] = useState<string | null>(null);
  const [newChargeTitle, setNewChargeTitle] = useState('');
  const [newChargeAmount, setNewChargeAmount] = useState<number>(300);

  const handleUpdateStructureField = (
    classId: string,
    field: 'monthlyTuitionFee' | 'admissionFee' | 'examFee',
    value: number
  ) => {
    setEditingStructures((prev) => {
      const target = prev[classId] || {
        id: classId,
        schoolId: activeSchool.id,
        classId,
        grade: classes.find((c) => c.id === classId)?.grade || 'Class',
        monthlyTuitionFee: 0,
        admissionFee: 0,
        examFee: 0,
        customCharges: [],
        academicYear: activeSchool.activeAcademicYear || '2025-2026',
      };
      return {
        ...prev,
        [classId]: {
          ...target,
          [field]: isNaN(value) ? 0 : Math.max(0, value),
        },
      };
    });
  };

  const handleAddCustomCharge = (classId: string) => {
    if (!newChargeTitle.trim() || newChargeAmount <= 0) return;
    const newCharge: CustomFeeCharge = {
      id: `chg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: newChargeTitle.trim(),
      amount: newChargeAmount,
    };
    setEditingStructures((prev) => {
      const target = prev[classId];
      if (!target) return prev;
      return {
        ...prev,
        [classId]: {
          ...target,
          customCharges: [...(target.customCharges || []), newCharge],
        },
      };
    });
    setNewChargeTitle('');
    setNewChargeAmount(300);
    setCustomChargeModalClassId(null);
  };

  const handleRemoveCustomCharge = (classId: string, chargeId: string) => {
    setEditingStructures((prev) => {
      const target = prev[classId];
      if (!target) return prev;
      return {
        ...prev,
        [classId]: {
          ...target,
          customCharges: target.customCharges.filter((c) => c.id !== chargeId),
        },
      };
    });
  };

  const handleSaveClassStructure = async (classId: string) => {
    const item = editingStructures[classId];
    if (!item) return;
    setSavingClassId(classId);
    try {
      await saveClassFeeStructure(item);
      setStructureSaveSuccess(`Fee structure for ${item.grade} saved successfully!`);
      setTimeout(() => setStructureSaveSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to save fee structure:', err);
    } finally {
      setSavingClassId(null);
    }
  };

  const handleSaveAllStructures = async () => {
    setSavingClassId('ALL');
    try {
      for (const cls of classes) {
        const item = editingStructures[cls.id];
        if (item) {
          await saveClassFeeStructure(item);
        }
      }
      setStructureSaveSuccess('All class fee structures saved successfully!');
      setTimeout(() => setStructureSaveSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to save all structures:', err);
    } finally {
      setSavingClassId(null);
    }
  };

  // =========================================================================
  // TAB 2: Fee Collection & Vouchers State
  // =========================================================================
  const [collectionClassId, setCollectionClassId] = useState<string>(
    initialClassId || (classes.length > 0 ? classes[0].id : '')
  );
  const [collectionStudentId, setCollectionStudentId] = useState<string>(initialStudentId || '');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [activeVoucherForPrint, setActiveVoucherForPrint] = useState<FeePayment | null>(null);

  // Filter students for selected collection class
  const classStudents = useMemo(() => {
    return students.filter((s) => s.classId === collectionClassId && s.status === 'active');
  }, [students, collectionClassId]);

  // Selected student object
  const selectedStudent = useMemo(() => {
    return students.find((s) => s.id === collectionStudentId);
  }, [students, collectionStudentId]);

  // Fee structure for selected class
  const activeClassFeeStructure = useMemo(() => {
    return (
      feeStructures.find((f) => f.classId === collectionClassId) ||
      editingStructures[collectionClassId] || {
        id: collectionClassId,
        schoolId: activeSchool.id,
        classId: collectionClassId,
        grade: classes.find((c) => c.id === collectionClassId)?.grade || 'Class',
        monthlyTuitionFee: 1500,
        admissionFee: 0,
        examFee: 0,
        customCharges: [],
        academicYear: activeSchool.activeAcademicYear || '2025-2026',
      }
    );
  }, [feeStructures, editingStructures, collectionClassId, classes, activeSchool]);

  // Calculate Base, Custom Charges, Subtotal, Net Payable
  const baseMonthlyTuition = activeClassFeeStructure?.monthlyTuitionFee || 0;
  const customChargesSum = useMemo(() => {
    return (activeClassFeeStructure?.customCharges || []).reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0
    );
  }, [activeClassFeeStructure]);
  const grossMonthlyFee = baseMonthlyTuition + customChargesSum;
  const netPayable = Math.max(0, grossMonthlyFee - (Number(discountAmount) || 0));

  // Check if student already has a payment record for this month
  const existingPaymentForStudent = useMemo(() => {
    if (!collectionStudentId) return undefined;
    return feePayments.find(
      (p) => p.studentId === collectionStudentId && p.month === selectedMonth
    );
  }, [feePayments, collectionStudentId, selectedMonth]);

  // Generate Receipt Number: RCPT-YYYY-XXXX
  const generateReceiptNumber = () => {
    const year = new Date().getFullYear();
    const count = feePayments.length + 1;
    return `RCPT-${year}-${String(count).padStart(4, '0')}`;
  };

  const handleMarkAsPaid = async () => {
    if (!selectedStudent) {
      alert('Please select a student first.');
      return;
    }

    setIsProcessingPayment(true);
    try {
      const receiptNo = existingPaymentForStudent?.receiptNumber || generateReceiptNumber();
      const paymentRecord: FeePayment = {
        id: existingPaymentForStudent?.id || `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        schoolId: activeSchool.id,
        studentId: selectedStudent.id,
        studentName: selectedStudent.fullName,
        grNumber: selectedStudent.grNumber,
        classId: selectedStudent.classId,
        grade: selectedStudent.grade,
        section: selectedStudent.section,
        month: selectedMonth,
        monthLabel: currentMonthLabel,
        academicYear: activeSchool.activeAcademicYear || '2025-2026',
        baseAmount: baseMonthlyTuition,
        customChargesAmount: customChargesSum,
        discount: Number(discountAmount) || 0,
        netAmount: netPayable,
        paidAmount: netPayable,
        status: 'paid',
        paymentDate: new Date().toISOString(),
        paymentMethod,
        receiptNumber: receiptNo,
        notes: paymentNotes || 'Paid in full on time',
        recordedByUid: currentUserProfile?.uid || 'admin_user',
        recordedByName: currentUserProfile?.fullName || 'School Admin',
        createdAt: existingPaymentForStudent?.createdAt || new Date().toISOString(),
      };

      await recordFeePayment(paymentRecord);
      setActiveVoucherForPrint(paymentRecord);
      setPaymentNotes('');
    } catch (err) {
      console.error('Failed to record fee payment:', err);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleGenerateVoucherPreview = () => {
    if (!selectedStudent) {
      alert('Please select a student to preview voucher.');
      return;
    }

    const tempVoucher: FeePayment = {
      id: existingPaymentForStudent?.id || `vchr_temp_${Date.now()}`,
      schoolId: activeSchool.id,
      studentId: selectedStudent.id,
      studentName: selectedStudent.fullName,
      grNumber: selectedStudent.grNumber,
      classId: selectedStudent.classId,
      grade: selectedStudent.grade,
      section: selectedStudent.section,
      month: selectedMonth,
      monthLabel: currentMonthLabel,
      academicYear: activeSchool.activeAcademicYear || '2025-2026',
      baseAmount: baseMonthlyTuition,
      customChargesAmount: customChargesSum,
      discount: Number(discountAmount) || 0,
      netAmount: netPayable,
      paidAmount: existingPaymentForStudent?.paidAmount || 0,
      status: existingPaymentForStudent?.status || 'unpaid',
      paymentDate: existingPaymentForStudent?.paymentDate,
      paymentMethod: existingPaymentForStudent?.paymentMethod || paymentMethod,
      receiptNumber: existingPaymentForStudent?.receiptNumber || `VCHR-${new Date().getFullYear()}-001`,
      notes: paymentNotes || existingPaymentForStudent?.notes || 'Monthly Tuition Voucher',
      recordedByName: currentUserProfile?.fullName || 'Fee Counter',
    };

    setActiveVoucherForPrint(tempVoucher);
  };

  // =========================================================================
  // TAB 3: Defaulters & Summary Analytics
  // =========================================================================
  const [defaulterClassFilter, setDefaulterClassFilter] = useState<string>('ALL');
  const [defaulterViewMode, setDefaulterViewMode] = useState<'defaulters' | 'paid'>('defaulters');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Active students filtered by class
  const activeStudentsForAnalytics = useMemo(() => {
    return students.filter((s) => {
      if (s.status !== 'active') return false;
      if (defaulterClassFilter !== 'ALL' && s.classId !== defaulterClassFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          s.fullName.toLowerCase().includes(q) ||
          s.grNumber.toLowerCase().includes(q) ||
          s.fatherName?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [students, defaulterClassFilter, searchQuery]);

  // Payments in selected month
  const paymentsInMonth = useMemo(() => {
    return feePayments.filter((p) => p.month === selectedMonth);
  }, [feePayments, selectedMonth]);

  // Defaulters vs Paid lists
  const { defaultersList, paidList, kpiStats } = useMemo(() => {
    const paidStudentIds = new Set(
      paymentsInMonth.filter((p) => p.status === 'paid').map((p) => p.studentId)
    );

    const paidRecords = paymentsInMonth.filter((p) => {
      if (p.status !== 'paid') return false;
      if (defaulterClassFilter !== 'ALL' && p.classId !== defaulterClassFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return p.studentName.toLowerCase().includes(q) || p.grNumber.toLowerCase().includes(q);
      }
      return true;
    });

    const unpaidStudents: Array<{
      student: Student;
      expectedFee: number;
      structure?: ClassFeeStructure;
    }> = [];

    let totalCollected = 0;
    let totalPending = 0;

    // Calculate total collected across all or filtered
    paymentsInMonth.forEach((p) => {
      if (defaulterClassFilter === 'ALL' || p.classId === defaulterClassFilter) {
        if (p.status === 'paid') {
          totalCollected += Number(p.paidAmount) || 0;
        }
      }
    });

    // Check every active student for this month
    activeStudentsForAnalytics.forEach((s) => {
      if (!paidStudentIds.has(s.id)) {
        const struct =
          feeStructures.find((f) => f.classId === s.classId) ||
          editingStructures[s.classId];
        const chargesTotal = (struct?.customCharges || []).reduce(
          (sum, c) => sum + (Number(c.amount) || 0),
          0
        );
        const expected = (struct?.monthlyTuitionFee || 1500) + chargesTotal;
        totalPending += expected;
        unpaidStudents.push({
          student: s,
          expectedFee: expected,
          structure: struct,
        });
      }
    });

    const totalStudentsCount = activeStudentsForAnalytics.length;
    const collectionRate =
      totalStudentsCount > 0
        ? Math.round((paidRecords.length / totalStudentsCount) * 100)
        : 0;

    return {
      defaultersList: unpaidStudents,
      paidList: paidRecords,
      kpiStats: {
        totalCollected,
        totalPending,
        collectionRate,
        defaultersCount: unpaidStudents.length,
        paidCount: paidRecords.length,
        totalStudentsCount,
      },
    };
  }, [
    activeStudentsForAnalytics,
    paymentsInMonth,
    feeStructures,
    editingStructures,
    defaulterClassFilter,
    searchQuery,
  ]);

  // Quick switch from Defaulter Row to Collect Tab
  const handleQuickCollectForStudent = (student: Student) => {
    setCollectionClassId(student.classId);
    setCollectionStudentId(student.id);
    setActiveTab('collect');
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200">
      {/* Top Banner / Breadcrumb & Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  Fee Management & Accounts
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {activeSchool.name || 'School Accounts'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  SEMIS: {activeSchool.semisCode || '403020101'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Dynamic class fee structures, monthly fee collection, printable bank vouchers, and fee defaulters tracking.
              </p>
            </div>
          </div>

          {/* Month Selector & Role Badge */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
              <label htmlFor="sms-fee-month-selector" className="sr-only">Billing Month</label>
              <select
                id="sms-fee-month-selector"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-hidden cursor-pointer"
              >
                {monthOptions.map((opt) => (
                  <option key={opt.val} value={opt.val} className="dark:bg-slate-900">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {canManageFeeStructure ? (
              <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                School Admin (Full Access)
              </span>
            ) : (
              <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                Admission Incharge (Collection)
              </span>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 overflow-x-auto no-scrollbar">
          {/* Fee Structure Tab: Visible to Admin; Read-only notice for Admission Incharge */}
          <button
            type="button"
            onClick={() => setActiveTab('structure')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === 'structure'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>1. Fee Structure Setup</span>
            {!canManageFeeStructure && (
              <span className="px-1.5 py-0.2 text-[9px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded font-normal">
                Read Only
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('collect')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === 'collect'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>2. Collect Fee &amp; Vouchers</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('defaulters')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === 'defaulters'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>3. Fee Defaulters &amp; Reports</span>
            {kpiStats.defaultersCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] bg-red-500 text-white rounded-full font-bold">
                {kpiStats.defaultersCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {structureSaveSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 px-4 py-3 rounded-xl flex items-center justify-between text-xs font-semibold animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{structureSaveSuccess}</span>
          </div>
          <button
            onClick={() => setStructureSaveSuccess(null)}
            className="text-emerald-600 hover:text-emerald-800 dark:hover:text-emerald-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 1: FEE STRUCTURE SETUP */}
      {/* =================================================================== */}
      {activeTab === 'structure' && (
        <div className="space-y-6">
          {/* Header Card with description & Save All */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Class-Wise Fee Matrix</span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    Fully Variable &amp; Editable
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Configure monthly tuition fees, admission charges, exam fees, and custom funds (e.g., Science Lab, Sports, Red Crescent) for each class.
                </p>
              </div>

              {canManageFeeStructure && (
                <button
                  type="button"
                  onClick={handleSaveAllStructures}
                  disabled={savingClassId === 'ALL'}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingClassId === 'ALL' ? 'Saving All...' : 'Save All Fee Structures'}</span>
                </button>
              )}
            </div>

            {!canManageFeeStructure && (
              <div className="mt-4 p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  <strong>Read-Only Access:</strong> You are logged in with Admission Incharge privileges. Changing class fee structures is restricted to School Administration / Principal.
                </span>
              </div>
            )}
          </div>

          {/* Table / Matrix of Classes */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[11px] tracking-wider">
                    <th className="py-3.5 px-4">Class &amp; Section</th>
                    <th className="py-3.5 px-4">Monthly Tuition (PKR)</th>
                    <th className="py-3.5 px-4">Admission Fee (PKR)</th>
                    <th className="py-3.5 px-4">Exam Fee (PKR)</th>
                    <th className="py-3.5 px-4">Custom Charges &amp; Funds</th>
                    <th className="py-3.5 px-4">Total Monthly Due</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {classes.map((cls) => {
                    const struct = editingStructures[cls.id] || {
                      id: cls.id,
                      schoolId: activeSchool.id,
                      classId: cls.id,
                      grade: cls.grade,
                      monthlyTuitionFee: 1500,
                      admissionFee: 2000,
                      examFee: 500,
                      customCharges: [],
                      academicYear: activeSchool.activeAcademicYear || '2025-2026',
                    };

                    const customTotal = (struct.customCharges || []).reduce(
                      (acc, cur) => acc + (Number(cur.amount) || 0),
                      0
                    );
                    const totalMonthly = (Number(struct.monthlyTuitionFee) || 0) + customTotal;

                    return (
                      <tr
                        key={cls.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Class Info */}
                        <td className="py-4 px-4 font-semibold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <div>
                              <div className="font-bold text-sm">{cls.grade}</div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                                {cls.section || 'General'} · {cls.medium}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Monthly Tuition */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 w-32">
                            <span className="text-slate-400 font-semibold text-xs">Rs.</span>
                            <input
                              type="number"
                              min="0"
                              disabled={!canManageFeeStructure}
                              value={struct.monthlyTuitionFee}
                              onChange={(e) =>
                                handleUpdateStructureField(
                                  cls.id,
                                  'monthlyTuitionFee',
                                  parseInt(e.target.value, 10)
                                )
                              }
                              className="w-full bg-transparent font-bold text-slate-900 dark:text-white focus:outline-hidden text-xs disabled:opacity-60"
                            />
                          </div>
                        </td>

                        {/* Admission Fee */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 w-28">
                            <span className="text-slate-400 font-semibold text-xs">Rs.</span>
                            <input
                              type="number"
                              min="0"
                              disabled={!canManageFeeStructure}
                              value={struct.admissionFee}
                              onChange={(e) =>
                                handleUpdateStructureField(
                                  cls.id,
                                  'admissionFee',
                                  parseInt(e.target.value, 10)
                                )
                              }
                              className="w-full bg-transparent font-medium text-slate-900 dark:text-white focus:outline-hidden text-xs disabled:opacity-60"
                            />
                          </div>
                        </td>

                        {/* Exam Fee */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 w-28">
                            <span className="text-slate-400 font-semibold text-xs">Rs.</span>
                            <input
                              type="number"
                              min="0"
                              disabled={!canManageFeeStructure}
                              value={struct.examFee}
                              onChange={(e) =>
                                handleUpdateStructureField(
                                  cls.id,
                                  'examFee',
                                  parseInt(e.target.value, 10)
                                )
                              }
                              className="w-full bg-transparent font-medium text-slate-900 dark:text-white focus:outline-hidden text-xs disabled:opacity-60"
                            />
                          </div>
                        </td>

                        {/* Custom Charges & Funds */}
                        <td className="py-4 px-4 max-w-xs">
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {(struct.customCharges || []).map((chg) => (
                              <span
                                key={chg.id}
                                className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-lg"
                              >
                                <span>{chg.title}: Rs.{chg.amount}</span>
                                {canManageFeeStructure && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveCustomCharge(cls.id, chg.id)}
                                    className="hover:text-red-500 cursor-pointer ml-0.5"
                                    title="Remove charge"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </span>
                            ))}

                            {canManageFeeStructure && (
                              <button
                                type="button"
                                onClick={() => setCustomChargeModalClassId(cls.id)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition border border-dashed border-slate-300 dark:border-slate-600 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Add Charge</span>
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Total Monthly Due */}
                        <td className="py-4 px-4 font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                          Rs. {totalMonthly.toLocaleString()}
                        </td>

                        {/* Action: Save Single Class */}
                        <td className="py-4 px-4 text-right">
                          {canManageFeeStructure && (
                            <button
                              type="button"
                              onClick={() => handleSaveClassStructure(cls.id)}
                              disabled={savingClassId === cls.id}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-600 hover:text-white dark:bg-slate-800 dark:hover:bg-emerald-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ml-auto cursor-pointer disabled:opacity-50"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>{savingClassId === cls.id ? 'Saving...' : 'Save'}</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: COLLECT FEE & VOUCHERS */}
      {/* =================================================================== */}
      {activeTab === 'collect' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Collection Form (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <span>Fee Collection &amp; Voucher Generator</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Select a student, adjust discount/concession, and issue official payment voucher.
                  </p>
                </div>
                <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {currentMonthLabel}
                </span>
              </div>

              {/* Class & Student Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="sms-fee-class-selector" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    1. Select Class
                  </label>
                  <select
                    id="sms-fee-class-selector"
                    value={collectionClassId}
                    onChange={(e) => {
                      setCollectionClassId(e.target.value);
                      setCollectionStudentId('');
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.grade} - {c.section || 'General'} ({c.medium})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="sms-fee-student-selector" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    2. Select Student
                  </label>
                  <select
                    id="sms-fee-student-selector"
                    value={collectionStudentId}
                    onChange={(e) => setCollectionStudentId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="">-- Choose Student ({classStudents.length} enrolled) --</option>
                    {classStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.grNumber} · {s.fullName} s/d {s.fatherName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fee Breakdown & Calculation Card */}
              {selectedStudent ? (
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 pb-2 border-b border-slate-200 dark:border-slate-700">
                    <span>Fee Component Breakdown</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Academic Year: {activeClassFeeStructure.academicYear}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span>Monthly Tuition Fee:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        Rs. {baseMonthlyTuition.toLocaleString()}
                      </span>
                    </div>

                    {(activeClassFeeStructure.customCharges || []).map((chg) => (
                      <div
                        key={chg.id}
                        className="flex items-center justify-between text-slate-600 dark:text-slate-400"
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                          <span>{chg.title}:</span>
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          Rs. {Number(chg.amount).toLocaleString()}
                        </span>
                      </div>
                    ))}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-200">
                      <span>Gross Monthly Base:</span>
                      <span>Rs. {grossMonthlyFee.toLocaleString()}</span>
                    </div>

                    {/* Concession / Discount Adjustment */}
                    <div className="flex items-center justify-between pt-2 text-xs">
                      <span className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Discount / Scholarship / Concession:</span>
                      </span>
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg px-2 py-1 w-32">
                        <span className="text-slate-400 text-xs">Rs.</span>
                        <input
                          type="number"
                          min="0"
                          max={grossMonthlyFee}
                          value={discountAmount}
                          onChange={(e) => setDiscountAmount(parseInt(e.target.value, 10) || 0)}
                          className="w-full bg-transparent font-bold text-amber-700 dark:text-amber-400 focus:outline-hidden text-xs"
                        />
                      </div>
                    </div>

                    {/* Final Net Due */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                      <span>Total Net Payable Due:</span>
                      <span className="text-base">Rs. {netPayable.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-500">
                  <UserCheck className="w-8 h-8 mx-auto text-slate-400 mb-2 opacity-60" />
                  <p className="font-semibold">No student selected</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Select a class and student above to calculate monthly fees and generate voucher.
                  </p>
                </div>
              )}

              {/* Payment Method & Notes */}
              {selectedStudent && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label htmlFor="sms-payment-method-selector" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Payment Mode
                    </label>
                    <select
                      id="sms-payment-method-selector"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden"
                    >
                      <option value="Cash">Cash Counter</option>
                      <option value="EasyPaisa">EasyPaisa</option>
                      <option value="JazzCash">JazzCash</option>
                      <option value="Bank Transfer">Bank Transfer (HBL / NBP / Sindh Bank)</option>
                      <option value="Cheque">Bank Pay Order / Cheque</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="sms-fee-notes-input" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Remarks / Notes (Optional)
                    </label>
                    <input
                      id="sms-fee-notes-input"
                      type="text"
                      placeholder="e.g. Paid in full by father"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-hidden"
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {selectedStudent && (
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-3">
                  <button
                    type="button"
                    onClick={handleGenerateVoucherPreview}
                    className="w-full sm:w-1/2 flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    <span>Print Fee Voucher / Challan</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleMarkAsPaid}
                    disabled={isProcessingPayment}
                    className="w-full sm:w-1/2 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/20 transition disabled:opacity-50 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isProcessingPayment
                        ? 'Recording...'
                        : existingPaymentForStudent?.status === 'paid'
                        ? 'Update & Reissue Receipt'
                        : 'Mark as Paid & Issue Receipt'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Recent Payments Log (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  <span>Recent Fee Transactions</span>
                </h3>
                <span className="text-[11px] font-semibold text-slate-500">
                  {feePayments.length} recorded
                </span>
              </div>

              {feePayments.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  No payment vouchers recorded yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[500px] overflow-y-auto no-scrollbar">
                  {feePayments.slice(0, 10).map((pay) => (
                    <div
                      key={pay.id}
                      className="py-3 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 px-2 rounded-xl transition"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{pay.studentName}</span>
                          <span className="text-[10px] text-slate-400">({pay.grNumber})</span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {pay.monthLabel} · {pay.paymentMethod || 'Cash'} · {pay.receiptNumber || 'RCPT'}
                        </div>
                      </div>

                      <div className="text-right flex items-center gap-3">
                        <div>
                          <div className="font-bold text-emerald-600 dark:text-emerald-400">
                            Rs. {pay.paidAmount.toLocaleString()}
                          </div>
                          <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                            {pay.status}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setActiveVoucherForPrint(pay)}
                          title="Print Receipt"
                          className="p-1.5 bg-slate-100 hover:bg-emerald-100 dark:bg-slate-800 dark:hover:bg-emerald-950 text-slate-600 hover:text-emerald-700 dark:text-slate-300 rounded-lg transition cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: FEE DEFAULTERS & SUMMARY */}
      {/* =================================================================== */}
      {activeTab === 'defaulters' && (
        <div className="space-y-6">
          {/* Top KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* KPI 1: Total Collected */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Total Collected
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                Rs. {kpiStats.totalCollected.toLocaleString()}
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
                {kpiStats.paidCount} students cleared
              </div>
            </div>

            {/* KPI 2: Total Pending Due */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Pending Dues
                </span>
                <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-xl font-bold text-red-600 dark:text-red-400">
                Rs. {kpiStats.totalPending.toLocaleString()}
              </div>
              <div className="text-[11px] text-red-500 mt-0.5 font-medium">
                {kpiStats.defaultersCount} students pending
              </div>
            </div>

            {/* KPI 3: Collection Rate */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Collection Rate
                </span>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-xl font-bold text-indigo-600 dark:text-indigo-400">
                {kpiStats.collectionRate}%
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                {currentMonthLabel}
              </div>
            </div>

            {/* KPI 4: Active Enrollment */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Enrolled Students
                </span>
                <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                {kpiStats.totalStudentsCount}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                Active SIS Records
              </div>
            </div>
          </div>

          {/* Filter Bar & Sub-Tabs (Defaulters vs Paid) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setDefaulterViewMode('defaulters')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  defaulterViewMode === 'defaulters'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                Defaulters List ({defaultersList.length})
              </button>

              <button
                type="button"
                onClick={() => setDefaulterViewMode('paid')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  defaulterViewMode === 'paid'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                Paid Roster ({paidList.length})
              </button>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              {/* Class Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 w-full sm:w-auto">
                <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <label htmlFor="sms-fee-defaulter-class-filter" className="sr-only">Filter by Class</label>
                <select
                  id="sms-fee-defaulter-class-filter"
                  value={defaulterClassFilter}
                  onChange={(e) => setDefaulterClassFilter(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">All Classes</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.grade} ({c.section || 'General'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search GR or Name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Table: Defaulters View */}
          {defaulterViewMode === 'defaulters' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
              {defaultersList.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-200">
                    No Fee Defaulters!
                  </p>
                  <p className="text-slate-400 mt-1">
                    All students in the selected class have paid their dues for {currentMonthLabel}.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[11px] tracking-wider">
                        <th className="py-3 px-4">GR Number</th>
                        <th className="py-3 px-4">Student &amp; Parent</th>
                        <th className="py-3 px-4">Class &amp; Section</th>
                        <th className="py-3 px-4">Guardian Contact</th>
                        <th className="py-3 px-4">Pending Due (PKR)</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Quick Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                      {defaultersList.map(({ student, expectedFee }) => (
                        <tr
                          key={student.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                            {student.grNumber}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {student.fullName}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              s/o {student.fatherName}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-semibold">
                            {student.grade} - {student.section || 'General'}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500">
                            {student.guardianPhone || 'N/A'}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-red-600 dark:text-red-400">
                            Rs. {expectedFee.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                              Unpaid ({currentMonthLabel})
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleQuickCollectForStudent(student)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 ml-auto cursor-pointer shadow-xs"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>Collect Fee</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Table: Paid Roster View */}
          {defaulterViewMode === 'paid' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
              {paidList.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-2 opacity-60" />
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-200">
                    No Paid Records for {currentMonthLabel}
                  </p>
                  <p className="text-slate-400 mt-1">
                    Collect fees using the "Collect Fee &amp; Vouchers" tab.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[11px] tracking-wider">
                        <th className="py-3 px-4">Receipt No</th>
                        <th className="py-3 px-4">GR Number</th>
                        <th className="py-3 px-4">Student Name</th>
                        <th className="py-3 px-4">Class</th>
                        <th className="py-3 px-4">Amount Paid</th>
                        <th className="py-3 px-4">Payment Method</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4 text-right">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                      {paidList.map((pay) => (
                        <tr
                          key={pay.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {pay.receiptNumber || 'RCPT'}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                            {pay.grNumber}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                            {pay.studentName}
                          </td>
                          <td className="py-3.5 px-4 font-semibold">
                            {pay.grade} - {pay.section || 'General'}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                            Rs. {pay.paidAmount.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                            {pay.paymentMethod || 'Cash'}
                          </td>
                          <td className="py-3.5 px-4 text-slate-400">
                            {pay.paymentDate
                              ? new Date(pay.paymentDate).toLocaleDateString('en-GB')
                              : 'N/A'}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => setActiveVoucherForPrint(pay)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-emerald-100 dark:bg-slate-800 dark:hover:bg-emerald-950 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Voucher</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: ADD CUSTOM FEE CHARGE */}
      {/* =================================================================== */}
      {customChargeModalClassId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600" />
                <span>Add Custom Fee / Fund</span>
              </h3>
              <button
                type="button"
                onClick={() => setCustomChargeModalClassId(null)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Add a specialized charge for{' '}
              <strong>
                {classes.find((c) => c.id === customChargeModalClassId)?.grade}
              </strong>{' '}
              (e.g., Computer Lab, Sports Fund, Board Registration, Library Fund).
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Charge Title / Fund Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Science Lab Fund"
                  value={newChargeTitle}
                  onChange={(e) => setNewChargeTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Amount (PKR)
                </label>
                <input
                  type="number"
                  min="10"
                  value={newChargeAmount}
                  onChange={(e) => setNewChargeAmount(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden font-bold"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCustomChargeModalClassId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleAddCustomCharge(customChargeModalClassId)}
                disabled={!newChargeTitle.trim() || newChargeAmount <= 0}
                className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-xs transition disabled:opacity-50"
              >
                Add Charge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* PRINTABLE VOUCHER MODAL (.printable-a4-sheet) */}
      {/* =================================================================== */}
      {activeVoucherForPrint && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-4xl bg-white text-slate-900 rounded-2xl shadow-2xl p-6 relative">
            {/* Modal Header Controls (Hidden during print) */}
            <div className="no-print flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Official Fee Voucher / Payment Receipt Preview
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={triggerPrintDocument}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Document (A4)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveVoucherForPrint(null)}
                  className="p-2 hover:bg-slate-100 text-slate-500 rounded-xl transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable A4 Container: 2 Identical Copies (School Copy & Student Copy) */}
            <div className="printable-a4-sheet bg-white text-slate-900 p-6 border border-slate-200 rounded-xl space-y-8">
              {[
                { title: 'BANK / SCHOOL COUNTER COPY', copyTag: 'School Record' },
                { title: 'STUDENT / PARENT COPY', copyTag: 'Student Record' },
              ].map((copy, idx) => (
                <div
                  key={idx}
                  className={`p-5 border-2 border-dashed border-slate-300 rounded-xl ${
                    idx > 0 ? 'mt-6 pt-6 border-t-2 border-slate-400' : ''
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between border-b-2 border-slate-800 pb-3">
                    <div>
                      <div className="text-[10px] font-bold tracking-widest text-emerald-800 uppercase">
                        GOVERNMENT OF SINDH · SCHOOL EDUCATION &amp; LITERACY DEPARTMENT
                      </div>
                      <h2 className="text-lg font-black text-slate-900 uppercase">
                        {activeSchool.name || 'Govt. High School'}
                      </h2>
                      <div className="text-xs text-slate-600 font-medium">
                        SEMIS Code: {activeSchool.semisCode || '403020101'} · District: {activeSchool.district || 'Latifabad, Hyderabad'}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-900 text-white inline-block">
                        {copy.title}
                      </div>
                      <div className="text-xs font-mono font-bold text-emerald-700 mt-1">
                        Receipt #: {activeVoucherForPrint.receiptNumber || 'RCPT-2026-001'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Date: {activeVoucherForPrint.paymentDate ? new Date(activeVoucherForPrint.paymentDate).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')}
                      </div>
                    </div>
                  </div>

                  {/* Student Details Grid */}
                  <div className="grid grid-cols-4 gap-2 my-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div>
                      <span className="text-slate-500 text-[10px] block">Student Name:</span>
                      <strong className="text-slate-900">{activeVoucherForPrint.studentName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">GR / Roll No:</span>
                      <strong className="text-slate-900 font-mono">{activeVoucherForPrint.grNumber}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Class &amp; Section:</span>
                      <strong className="text-slate-900">{activeVoucherForPrint.grade} - {activeVoucherForPrint.section || 'General'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Fee Billing Month:</span>
                      <strong className="text-emerald-700">{activeVoucherForPrint.monthLabel}</strong>
                    </div>
                  </div>

                  {/* Fee Breakdown Table */}
                  <table className="w-full text-left text-xs border border-slate-300 my-3">
                    <thead className="bg-slate-100 font-bold text-slate-800">
                      <tr>
                        <th className="py-1.5 px-3 border border-slate-300">#</th>
                        <th className="py-1.5 px-3 border border-slate-300">Fee Particulars</th>
                        <th className="py-1.5 px-3 border border-slate-300 text-right">Amount (PKR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-1.5 px-3 border border-slate-300">1</td>
                        <td className="py-1.5 px-3 border border-slate-300">Monthly Tuition Fee</td>
                        <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                          {activeVoucherForPrint.baseAmount.toLocaleString()}
                        </td>
                      </tr>
                      {activeVoucherForPrint.customChargesAmount > 0 && (
                        <tr>
                          <td className="py-1.5 px-3 border border-slate-300">2</td>
                          <td className="py-1.5 px-3 border border-slate-300">Special Funds &amp; Lab Charges</td>
                          <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                            {activeVoucherForPrint.customChargesAmount.toLocaleString()}
                          </td>
                        </tr>
                      )}
                      {activeVoucherForPrint.discount > 0 && (
                        <tr className="text-amber-800 bg-amber-50/50">
                          <td className="py-1.5 px-3 border border-slate-300">3</td>
                          <td className="py-1.5 px-3 border border-slate-300">Less: Scholarship / Fee Concession</td>
                          <td className="py-1.5 px-3 border border-slate-300 text-right font-mono">
                            - {activeVoucherForPrint.discount.toLocaleString()}
                          </td>
                        </tr>
                      )}
                      <tr className="bg-slate-100 font-bold text-slate-900">
                        <td colSpan={2} className="py-2 px-3 border border-slate-300 text-right">
                          Total Net Payable:
                        </td>
                        <td className="py-2 px-3 border border-slate-300 text-right font-mono text-sm text-emerald-800">
                          Rs. {activeVoucherForPrint.netAmount.toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Footer & Stamps */}
                  <div className="flex items-end justify-between pt-4 mt-2 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-500">
                        Payment Status: <strong className="text-emerald-700 uppercase">{activeVoucherForPrint.status}</strong>
                        {activeVoucherForPrint.paymentMethod && ` via ${activeVoucherForPrint.paymentMethod}`}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Cashier: {activeVoucherForPrint.recordedByName || 'Fee Counter Official'}
                      </div>
                    </div>

                    <div className="flex items-center gap-12">
                      <div className="text-center">
                        <div className="w-28 border-b border-slate-400 mb-1"></div>
                        <span className="text-[10px] text-slate-500">Cashier Stamp / Sign</span>
                      </div>
                      <div className="text-center">
                        <div className="w-28 border-b border-slate-400 mb-1"></div>
                        <span className="text-[10px] text-slate-500">Principal Signature</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
