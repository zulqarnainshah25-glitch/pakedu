import React, { useState, useMemo, useEffect } from 'react';
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
  Download,
  FileSpreadsheet,
  BarChart3,
  RefreshCw,
  Tag,
  Percent,
  Wallet,
  FileCheck2,
  Edit2,
} from 'lucide-react';
import { useSms } from '../context/SmsContext';
import {
  ClassFeeStructure,
  ConcessionDiscountType,
  CustomFeeCharge,
  FeeConcessionRule,
  FeePayment,
  PaymentMethod,
  PaymentStatus,
  School,
  Student,
} from '../types';
import {
  fetchStudentsFromFirestore,
  fetchFeeStructuresFromFirestore,
  fetchFeePaymentsFromFirestore,
  fetchFeeConcessionsFromFirestore,
} from '../services/smsFirestoreService';
import {
  calculateStudentDiscount,
  formatMonthLabel,
  getExpectedClassMonthlyFee,
  getNextMonthKey,
} from '../utils/feeCalculations';
import { triggerPrintDocument } from '../../../utils/printDocument';

export type FeeTabId = 'structure' | 'collect' | 'bulk' | 'concessions' | 'defaulters' | 'reports';

interface FeeManagementProps {
  onBack?: () => void;
  initialTab?: FeeTabId;
  initialStudentId?: string;
  initialClassId?: string;
}

interface SchoolFeeDataset {
  school: School;
  students: Student[];
  feeStructures: ClassFeeStructure[];
  feePayments: FeePayment[];
  feeConcessions: FeeConcessionRule[];
}

function escapeCsvCell(value: string | number | undefined | null): string {
  const str = value === undefined || value === null ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

interface PrintPreviewModalShellProps {
  title: string;
  printLabel: string;
  onPrint: () => void;
  onClose: () => void;
  accent?: 'emerald' | 'indigo';
  children: React.ReactNode;
}

const PrintPreviewModalShell: React.FC<PrintPreviewModalShellProps> = ({
  title,
  printLabel,
  onPrint,
  onClose,
  accent = 'emerald',
  children,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const iconColor = accent === 'indigo' ? 'text-[#7F1D1D]' : 'text-emerald-600';
  const printBtnClass =
    accent === 'indigo'
      ? 'bg-[#7F1D1D] hover:bg-[#651414] text-white'
      : 'bg-emerald-600 hover:bg-emerald-500 text-white';

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-6 print:static print:bg-transparent print:p-0 print:block"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] bg-[#FFFDF9] text-[#1C1917] rounded-2xl shadow-2xl flex flex-col overflow-hidden print:max-w-none print:max-h-none print:shadow-none print:rounded-none print:overflow-visible print:block"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header Controls (Hidden only when printing) */}
        <div className="print:hidden shrink-0 flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-[#E7E0D4] bg-[#FFFDF9]">
          <div className="flex items-center gap-2.5 min-w-0">
            <Printer className={`w-5 h-5 shrink-0 ${iconColor}`} />
            <h3 className="text-base font-bold text-[#1C1917] truncate">{title}</h3>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onPrint}
              className={`px-4 py-2 ${printBtnClass} font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer`}
            >
              <Printer className="w-4 h-4" />
              <span>{printLabel}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="px-3.5 py-2 bg-[#F3EFEA] hover:bg-[#E7E0D4] text-[#44403C] font-semibold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Close</span>
            </button>
          </div>
        </div>

        {/* Scrollable A4 Printable Area */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-6 print:overflow-visible print:p-0">
          {children}
        </div>

        {/* Sticky Bottom Action Bar */}
        <div className="print:hidden shrink-0 flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 border-t border-[#E7E0D4] bg-[#FAF8F5]">
          <span className="text-[11px] text-[#57534E]">
            A4 Print &amp; PDF Ready · Press Esc or Close to return
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#FFFDF9] hover:bg-[#F3EFEA] border border-[#D6CCC2] text-[#44403C] font-semibold text-xs rounded-xl transition cursor-pointer"
            >
              Close / Cancel
            </button>
            <button
              type="button"
              onClick={onPrint}
              className={`px-4 py-2 ${printBtnClass} font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer`}
            >
              <Printer className="w-4 h-4" />
              <span>{printLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const FeeManagement: React.FC<FeeManagementProps> = ({
  onBack,
  initialTab = 'structure',
  initialStudentId,
  initialClassId,
}) => {
  const {
    activeSchool,
    setActiveSchool,
    registeredSchools,
    classes,
    loadingClasses,
    refreshActiveSchoolClasses,
    students,
    feeStructures,
    feePayments,
    feeConcessions,
    saveClassFeeStructure,
    deleteClassFeeStructure,
    recordFeePayment,
    recordBulkFeePayments,
    saveFeeConcessionRule,
    deleteFeeConcessionRule,
    applyStudentConcession,
    updateStudent,
    canManageFeeStructure,
    canCollectFee,
    canAdmitStudents,
    currentUserProfile,
    userRole,
    isSuperAdmin,
    demoMode,
    isOnline,
  } = useSms();

  const canAccessReports = isSuperAdmin || canManageFeeStructure || canAdmitStudents;
  const canAccessModule = canCollectFee || canAccessReports;

  // Active Tab state: If user cannot manage structure, default to 'collect'
  const [activeTab, setActiveTab] = useState<FeeTabId>(() => {
    if (initialTab === 'structure' && !canManageFeeStructure && canCollectFee) {
      return 'collect';
    }
    if (initialTab === 'concessions' && !canManageFeeStructure) {
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

  // Keep local editing state synced if activeSchool, classes, or feeStructures updates from Firestore
  useEffect(() => {
    const next: Record<string, ClassFeeStructure> = {};
    classes.forEach((c) => {
      const remote = feeStructures.find((f) => f.classId === c.id);
      if (remote) {
        next[c.id] = { ...remote, customCharges: [...(remote.customCharges || [])] };
      } else {
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
    setEditingStructures(next);
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

  // Ensure collectionClassId automatically syncs when classes load or selected school changes
  useEffect(() => {
    if (classes.length > 0) {
      const stillValid = classes.some((c) => c.id === collectionClassId);
      if (!collectionClassId || !stillValid) {
        setCollectionClassId(classes[0].id);
        setCollectionStudentId('');
      }
    } else {
      setCollectionClassId('');
      setCollectionStudentId('');
    }
  }, [classes, activeSchool.id]);

  // Ensure classes are fetched when activeSchool changes or Super Admin opens Fee Management
  useEffect(() => {
    if (activeSchool?.id) {
      refreshActiveSchoolClasses(activeSchool.id);
    }
  }, [activeSchool?.id]);

  const handleSuperAdminSchoolSelect = async (schoolId: string) => {
    const selected = registeredSchools.find((s) => s.id === schoolId);
    if (!selected) return;
    setActiveSchool(selected);
    setCollectionClassId('');
    setCollectionStudentId('');
    setDefaulterClassFilter('ALL');
    setReportClassFilter('ALL');
    if (isSuperAdmin && reportSchoolScope !== 'ALL') {
      setReportSchoolScope(selected.id);
    }
    await refreshActiveSchoolClasses(selected.id);
  };
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [amountReceivedInput, setAmountReceivedInput] = useState<number>(0);
  const [allocateSurplusToNextMonth, setAllocateSurplusToNextMonth] = useState<boolean>(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [activeVoucherForPrint, setActiveVoucherForPrint] = useState<FeePayment | null>(null);
  const [collectionFeedback, setCollectionFeedback] = useState<string | null>(null);

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

  // Calculate Base, Custom Charges, Permanent Concession, Net Payable
  const baseMonthlyTuition = activeClassFeeStructure?.monthlyTuitionFee || 0;
  const customChargesSum = useMemo(() => {
    return (activeClassFeeStructure?.customCharges || []).reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0
    );
  }, [activeClassFeeStructure]);
  const grossMonthlyFee = baseMonthlyTuition + customChargesSum;

  const studentPermanentDiscount = useMemo(() => {
    return calculateStudentDiscount(selectedStudent, grossMonthlyFee, feeConcessions);
  }, [selectedStudent, grossMonthlyFee, feeConcessions]);

  // Check if student already has a payment record for this month
  const existingPaymentForStudent = useMemo(() => {
    if (!collectionStudentId) return undefined;
    return feePayments.find(
      (p) => p.studentId === collectionStudentId && p.month === selectedMonth
    );
  }, [feePayments, collectionStudentId, selectedMonth]);

  // Sync discount amount whenever student, month, or permanent concession changes
  useEffect(() => {
    if (!selectedStudent) {
      setDiscountAmount(0);
      return;
    }
    if (existingPaymentForStudent && existingPaymentForStudent.discount !== undefined) {
      setDiscountAmount(Number(existingPaymentForStudent.discount) || 0);
    } else {
      setDiscountAmount(studentPermanentDiscount.discountAmount);
    }
  }, [
    selectedStudent?.id,
    selectedMonth,
    studentPermanentDiscount.discountAmount,
    existingPaymentForStudent?.id,
  ]);

  const netPayable = Math.max(0, grossMonthlyFee - (Number(discountAmount) || 0));
  const alreadyPaidThisMonth = Number(existingPaymentForStudent?.paidAmount) || 0;
  const remainingDueThisMonth = Math.max(0, netPayable - alreadyPaidThisMonth);

  const nextMonthKey = useMemo(() => getNextMonthKey(selectedMonth), [selectedMonth]);
  const nextMonthLabel = useMemo(() => formatMonthLabel(nextMonthKey), [nextMonthKey]);

  // Sync Exact Amount Received input default to remaining due when student/month/discount changes
  useEffect(() => {
    if (!selectedStudent) {
      setAmountReceivedInput(0);
      return;
    }
    setAmountReceivedInput(remainingDueThisMonth);
  }, [selectedStudent?.id, selectedMonth, remainingDueThisMonth]);

  const numericReceivedNow = Math.max(0, Number(amountReceivedInput) || 0);
  const surplusAmount = Math.max(0, numericReceivedNow - remainingDueThisMonth);
  const projectedPendingAfterPayment = Math.max(0, remainingDueThisMonth - numericReceivedNow);

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
    if (numericReceivedNow <= 0 && netPayable > 0 && remainingDueThisMonth > 0) {
      alert('Please enter the Exact Amount Received (greater than Rs. 0).');
      return;
    }

    setIsProcessingPayment(true);
    setCollectionFeedback(null);
    try {
      const nowIso = new Date().toISOString();
      const receiptNo =
        existingPaymentForStudent?.receiptNumber && alreadyPaidThisMonth === 0
          ? existingPaymentForStudent.receiptNumber
          : existingPaymentForStudent?.status === 'paid' && numericReceivedNow === 0
          ? existingPaymentForStudent.receiptNumber || generateReceiptNumber()
          : generateReceiptNumber();

      const totalCollectedAttempt = alreadyPaidThisMonth + numericReceivedNow;
      const excessOverMonthNet = Math.max(0, totalCollectedAttempt - netPayable);

      const appliedToCurrentMonth =
        excessOverMonthNet > 0 && allocateSurplusToNextMonth
          ? netPayable
          : excessOverMonthNet > 0
          ? netPayable
          : Math.min(netPayable, totalCollectedAttempt);

      const pendingAfterPayment = Math.max(0, netPayable - appliedToCurrentMonth);
      const nextStatus: PaymentStatus =
        pendingAfterPayment === 0
          ? 'paid'
          : appliedToCurrentMonth > 0
          ? 'partial'
          : 'unpaid';

      const prevInstallments = existingPaymentForStudent?.installments || [];
      const trimmedNote = paymentNotes.trim();
      const newInstallments =
        numericReceivedNow > 0
          ? [
              ...prevInstallments,
              {
                amount: numericReceivedNow,
                date: nowIso,
                method: paymentMethod || 'Cash',
                receiptNumber: receiptNo,
                recordedByName: currentUserProfile?.fullName || 'School Admin',
                ...(trimmedNote ? { note: trimmedNote } : {}),
              },
            ]
          : prevInstallments;

      const defaultNote =
        nextStatus === 'partial'
          ? `Partial payment received (Remaining Pending: Rs. ${pendingAfterPayment.toLocaleString()})`
          : excessOverMonthNet > 0 && allocateSurplusToNextMonth
          ? `Paid in full + Rs. ${excessOverMonthNet.toLocaleString()} Advance allocated to ${nextMonthLabel}`
          : excessOverMonthNet > 0
          ? `Paid in full + Rs. ${excessOverMonthNet.toLocaleString()} Advance balance credited`
          : 'Paid in full on time';

      const resolvedConcessionId = studentPermanentDiscount.concessionId || existingPaymentForStudent?.concessionId;
      const resolvedConcessionTitle = studentPermanentDiscount.concessionTitle || existingPaymentForStudent?.concessionTitle;
      const resolvedConcessionPercent = studentPermanentDiscount.percentEffective || existingPaymentForStudent?.concessionPercent;
      const resolvedNextMonth =
        excessOverMonthNet > 0 && allocateSurplusToNextMonth
          ? nextMonthKey
          : existingPaymentForStudent?.allocatedNextMonth;

      const paymentRecord: FeePayment = {
        id:
          existingPaymentForStudent?.id ||
          `pay_${selectedStudent.id}_${selectedMonth}_${Date.now().toString(36)}`,
        schoolId: activeSchool.id,
        studentId: selectedStudent.id,
        studentName: selectedStudent.fullName,
        grNumber: selectedStudent.grNumber,
        classId: selectedStudent.classId,
        grade: selectedStudent.grade,
        section: selectedStudent.section || 'General',
        month: selectedMonth,
        monthLabel: currentMonthLabel,
        academicYear: activeSchool.activeAcademicYear || '2025-2026',
        baseAmount: baseMonthlyTuition,
        customChargesAmount: customChargesSum,
        discount: Number(discountAmount) || 0,
        ...(resolvedConcessionId ? { concessionId: resolvedConcessionId } : {}),
        ...(resolvedConcessionTitle ? { concessionTitle: resolvedConcessionTitle } : {}),
        ...(resolvedConcessionPercent !== undefined ? { concessionPercent: resolvedConcessionPercent } : {}),
        netAmount: netPayable,
        paidAmount: appliedToCurrentMonth,
        pendingBalance: pendingAfterPayment,
        advanceUsed: existingPaymentForStudent?.advanceUsed || 0,
        advanceGenerated:
          (existingPaymentForStudent?.advanceGenerated || 0) + excessOverMonthNet,
        ...(resolvedNextMonth ? { allocatedNextMonth: resolvedNextMonth } : {}),
        installments: newInstallments,
        status: nextStatus,
        paymentDate: nowIso,
        paymentMethod: paymentMethod || 'Cash',
        receiptNumber: receiptNo || generateReceiptNumber(),
        notes: trimmedNote || defaultNote,
        recordedByUid: currentUserProfile?.uid || 'admin_user',
        recordedByName: currentUserProfile?.fullName || 'School Admin',
        createdAt: existingPaymentForStudent?.createdAt || nowIso,
      };

      await recordFeePayment(paymentRecord);

      // Handle Excess / Overpayment -> Allocate to Next Month (Advance) or Student Advance Balance
      if (excessOverMonthNet > 0) {
        if (allocateSurplusToNextMonth) {
          const nextExpected = getExpectedClassMonthlyFee(
            selectedStudent.classId,
            feeStructures,
            activeSchool.activeAcademicYear || '2025-2026'
          );
          const nextDiscount = calculateStudentDiscount(
            selectedStudent,
            nextExpected.grossMonthlyFee,
            feeConcessions
          );
          const nextNetAmount = Math.max(
            0,
            nextExpected.grossMonthlyFee - nextDiscount.discountAmount
          );
          const existingNext = feePayments.find(
            (p) => p.studentId === selectedStudent.id && p.month === nextMonthKey
          );
          const nextPaidTotal = (Number(existingNext?.paidAmount) || 0) + excessOverMonthNet;
          const nextAdvanceTotal = (Number(existingNext?.advanceUsed) || 0) + excessOverMonthNet;
          const nextPending = Math.max(0, nextNetAmount - nextPaidTotal);
          const nextMonthStatus: PaymentStatus =
            nextPending === 0 ? 'paid' : 'partial';

          const nextMonthRecord: FeePayment = {
            id:
              existingNext?.id ||
              `pay_adv_${selectedStudent.id}_${nextMonthKey}_${Date.now().toString(36)}`,
            schoolId: activeSchool.id,
            studentId: selectedStudent.id,
            studentName: selectedStudent.fullName,
            grNumber: selectedStudent.grNumber,
            classId: selectedStudent.classId,
            grade: selectedStudent.grade,
            section: selectedStudent.section,
            month: nextMonthKey,
            monthLabel: nextMonthLabel,
            academicYear: nextExpected.academicYear,
            baseAmount: nextExpected.baseMonthlyTuition,
            customChargesAmount: nextExpected.customChargesAmount,
            discount: nextDiscount.discountAmount,
            concessionId: nextDiscount.concessionId,
            concessionTitle: nextDiscount.concessionTitle,
            concessionPercent: nextDiscount.percentEffective,
            netAmount: nextNetAmount,
            paidAmount: nextPaidTotal,
            pendingBalance: nextPending,
            advanceUsed: nextAdvanceTotal,
            advanceGenerated: existingNext?.advanceGenerated || 0,
            status: nextMonthStatus,
            paymentDate: nowIso,
            paymentMethod,
            receiptNumber: `${receiptNo}-ADV`,
            notes: `Advance Rs. ${excessOverMonthNet.toLocaleString()} allocated from ${currentMonthLabel}`,
            recordedByUid: currentUserProfile?.uid || 'admin_user',
            recordedByName: currentUserProfile?.fullName || 'School Admin',
            createdAt: existingNext?.createdAt || nowIso,
          };

          await recordFeePayment(nextMonthRecord);
          updateStudent(selectedStudent.id, {
            advanceBalance: (Number(selectedStudent.advanceBalance) || 0) + excessOverMonthNet,
          });
          setCollectionFeedback(
            `Recorded Rs. ${numericReceivedNow.toLocaleString()}: ${currentMonthLabel} marked Paid, and Rs. ${excessOverMonthNet.toLocaleString()} allocated to ${nextMonthLabel} as Advance.${
              !isOnline ? ' (Saved locally in offline queue — will sync when online)' : ''
            }`
          );
        } else {
          updateStudent(selectedStudent.id, {
            advanceBalance: (Number(selectedStudent.advanceBalance) || 0) + excessOverMonthNet,
          });
          setCollectionFeedback(
            `Recorded Rs. ${numericReceivedNow.toLocaleString()}: ${currentMonthLabel} marked Paid, and Rs. ${excessOverMonthNet.toLocaleString()} added to Student's Advance Balance.${
              !isOnline ? ' (Saved locally in offline queue — will sync when online)' : ''
            }`
          );
        }
      } else if (nextStatus === 'partial') {
        setCollectionFeedback(
          `Partial payment of Rs. ${numericReceivedNow.toLocaleString()} recorded. Remaining Pending Balance for ${currentMonthLabel}: Rs. ${pendingAfterPayment.toLocaleString()}.${
            !isOnline ? ' (Saved locally in offline queue — will sync when online)' : ''
          }`
        );
      } else {
        if ((existingPaymentForStudent?.advanceUsed || 0) > 0 && (selectedStudent.advanceBalance || 0) > 0) {
          const consumed = Number(existingPaymentForStudent?.advanceUsed) || 0;
          updateStudent(selectedStudent.id, {
            advanceBalance: Math.max(0, (Number(selectedStudent.advanceBalance) || 0) - consumed),
          });
        }
        setCollectionFeedback(
          `Full fee payment cleared for ${selectedStudent.fullName} (${currentMonthLabel}).${
            !isOnline ? ' (Saved locally in offline queue — will sync when online)' : ''
          }`
        );
      }

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
      concessionTitle: studentPermanentDiscount.concessionTitle,
      concessionPercent: studentPermanentDiscount.percentEffective,
      netAmount: netPayable,
      paidAmount: existingPaymentForStudent?.paidAmount || 0,
      pendingBalance:
        existingPaymentForStudent?.status === 'paid'
          ? 0
          : Math.max(0, netPayable - (existingPaymentForStudent?.paidAmount || 0)),
      advanceUsed: existingPaymentForStudent?.advanceUsed || 0,
      advanceGenerated: existingPaymentForStudent?.advanceGenerated || 0,
      allocatedNextMonth: existingPaymentForStudent?.allocatedNextMonth,
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
  // TAB 3: BULK VOUCHER GENERATION STATE
  // =========================================================================
  const [bulkClassId, setBulkClassId] = useState<string>(
    initialClassId || (classes.length > 0 ? classes[0].id : '')
  );
  const [bulkMonth, setBulkMonth] = useState<string>(selectedMonth);
  const [bulkDueDate, setBulkDueDate] = useState<string>(() => {
    const now = new Date();
    const tenth = new Date(now.getFullYear(), now.getMonth(), 10);
    return tenth.toISOString().split('T')[0];
  });
  const [bulkVoucherNote, setBulkVoucherNote] = useState<string>(
    'Payable at designated Sindh Bank / School Counter before due date.'
  );
  const [bulkBatchForPrint, setBulkBatchForPrint] = useState<FeePayment[] | null>(null);
  const [isSavingBulk, setIsSavingBulk] = useState<boolean>(false);
  const [bulkSaveNotice, setBulkSaveNotice] = useState<string | null>(null);

  useEffect(() => {
    if (classes.length > 0) {
      const stillValid = classes.some((c) => c.id === bulkClassId);
      if (!bulkClassId || !stillValid) {
        setBulkClassId(classes[0].id);
      }
    } else {
      setBulkClassId('');
    }
  }, [classes, activeSchool.id]);

  const bulkMonthLabel = useMemo(() => formatMonthLabel(bulkMonth), [bulkMonth]);

  const generatedBulkVouchers = useMemo<FeePayment[]>(() => {
    if (!bulkClassId) return [];
    const targetStudents = students.filter(
      (s) => s.classId === bulkClassId && s.status === 'active'
    );
    if (targetStudents.length === 0) return [];

    const expected = getExpectedClassMonthlyFee(
      bulkClassId,
      feeStructures,
      activeSchool.activeAcademicYear || '2025-2026'
    );

    return targetStudents.map((stu, idx) => {
      const existing = feePayments.find(
        (p) => p.studentId === stu.id && p.month === bulkMonth
      );
      const disc = calculateStudentDiscount(
        stu,
        expected.grossMonthlyFee,
        feeConcessions
      );
      const effectiveDiscount =
        existing && existing.discount !== undefined
          ? Number(existing.discount) || 0
          : disc.discountAmount;
      const net = Math.max(0, expected.grossMonthlyFee - effectiveDiscount);
      const paid = existing ? Number(existing.paidAmount) || 0 : 0;
      const pending = existing?.status === 'paid' ? 0 : Math.max(0, net - paid);

      const resolvedConcessionId = disc.concessionId || existing?.concessionId;
      const resolvedConcessionTitle = disc.concessionTitle || existing?.concessionTitle;
      const resolvedConcessionPercent = disc.percentEffective || existing?.concessionPercent;

      return {
        id: existing?.id || `vchr_${stu.id}_${bulkMonth}`,
        schoolId: activeSchool.id,
        studentId: stu.id,
        studentName: stu.fullName,
        grNumber: stu.grNumber,
        classId: stu.classId,
        grade: stu.grade,
        section: stu.section || 'General',
        month: bulkMonth,
        monthLabel: bulkMonthLabel,
        academicYear: expected.academicYear,
        baseAmount: expected.baseMonthlyTuition,
        customChargesAmount: expected.customChargesAmount,
        discount: effectiveDiscount,
        ...(resolvedConcessionId ? { concessionId: resolvedConcessionId } : {}),
        ...(resolvedConcessionTitle ? { concessionTitle: resolvedConcessionTitle } : {}),
        ...(resolvedConcessionPercent !== undefined ? { concessionPercent: resolvedConcessionPercent } : {}),
        netAmount: net,
        paidAmount: paid,
        pendingBalance: pending,
        advanceUsed: existing?.advanceUsed || 0,
        installments: existing?.installments || [],
        status: existing?.status || 'unpaid',
        paymentDate: existing?.paymentDate || '',
        paymentMethod: existing?.paymentMethod || 'Cash',
        receiptNumber:
          existing?.receiptNumber ||
          `VCHR-${bulkMonth.replace('-', '')}-${String(idx + 1).padStart(3, '0')}`,
        notes: existing?.notes || bulkVoucherNote || '',
        recordedByName: currentUserProfile?.fullName || 'Accounts Office',
      };
    });
  }, [
    bulkClassId,
    bulkMonth,
    bulkMonthLabel,
    bulkVoucherNote,
    students,
    feeStructures,
    feePayments,
    feeConcessions,
    activeSchool.id,
    activeSchool.activeAcademicYear,
    currentUserProfile?.fullName,
  ]);

  const bulkSummary = useMemo(() => {
    return generatedBulkVouchers.reduce(
      (acc, v) => {
        acc.totalGross += (Number(v.baseAmount) || 0) + (Number(v.customChargesAmount) || 0);
        acc.totalDiscount += Number(v.discount) || 0;
        acc.totalNet += Number(v.netAmount) || 0;
        acc.totalPaid += Number(v.paidAmount) || 0;
        acc.totalPending += Number(v.pendingBalance) || 0;
        if ((Number(v.discount) || 0) > 0) acc.discountedCount += 1;
        return acc;
      },
      {
        totalGross: 0,
        totalDiscount: 0,
        totalNet: 0,
        totalPaid: 0,
        totalPending: 0,
        discountedCount: 0,
      }
    );
  }, [generatedBulkVouchers]);

  const handleSaveUnpaidBulkVouchers = async () => {
    const unpaidOnly = generatedBulkVouchers.filter(
      (v) =>
        !feePayments.some(
          (p) => p.studentId === v.studentId && p.month === v.month && (p.status === 'paid' || p.status === 'partial')
        )
    );
    if (unpaidOnly.length === 0) {
      setBulkSaveNotice('All students in this batch already have saved vouchers or paid records.');
      setTimeout(() => setBulkSaveNotice(null), 4000);
      return;
    }
    setIsSavingBulk(true);
    try {
      await recordBulkFeePayments(unpaidOnly);
      setBulkSaveNotice(
        isOnline
          ? `Saved ${unpaidOnly.length} generated voucher(s) for ${bulkMonthLabel} to cloud register.`
          : `Offline mode: Saved ${unpaidOnly.length} voucher(s) for ${bulkMonthLabel} locally (queued to sync when online).`
      );
      setTimeout(() => setBulkSaveNotice(null), 4000);
    } finally {
      setIsSavingBulk(false);
    }
  };

  const handlePrintAllBulkVouchers = () => {
    if (generatedBulkVouchers.length === 0) {
      alert('No enrolled active students found in the selected class to generate vouchers.');
      return;
    }
    setBulkBatchForPrint(generatedBulkVouchers);
  };

  // =========================================================================
  // TAB 4: CONCESSIONS & DISCOUNTS STATE (Admin Only)
  // =========================================================================
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleTitle, setRuleTitle] = useState<string>('');
  const [ruleType, setRuleType] = useState<ConcessionDiscountType>('percentage');
  const [ruleValue, setRuleValue] = useState<number>(50);
  const [ruleDescription, setRuleDescription] = useState<string>('');
  const [isSavingRule, setIsSavingRule] = useState<boolean>(false);
  const [assignClassFilter, setAssignClassFilter] = useState<string>('ALL');
  const [assignStudentId, setAssignStudentId] = useState<string>('');
  const [assignRuleId, setAssignRuleId] = useState<string>('');
  const [concessionNotice, setConcessionNotice] = useState<string | null>(null);

  const handleSaveConcessionForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleTitle.trim() || ruleValue <= 0) return;
    if (ruleType === 'percentage' && ruleValue > 100) {
      alert('Percentage discount cannot exceed 100%.');
      return;
    }
    setIsSavingRule(true);
    try {
      const ruleId =
        editingRuleId ||
        `conc_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
      await saveFeeConcessionRule({
        id: ruleId,
        title: ruleTitle.trim(),
        discountType: ruleType,
        value: Number(ruleValue) || 0,
        description: ruleDescription.trim() || undefined,
        isActive: true,
      });
      setConcessionNotice(
        `Discount rule "${ruleTitle.trim()}" (${
          ruleType === 'percentage' ? `${ruleValue}%` : `Rs. ${ruleValue}`
        }) saved!`
      );
      setEditingRuleId(null);
      setRuleTitle('');
      setRuleType('percentage');
      setRuleValue(50);
      setRuleDescription('');
      setTimeout(() => setConcessionNotice(null), 4000);
    } finally {
      setIsSavingRule(false);
    }
  };

  const handleAddPresetConcession = async (
    title: string,
    discountType: ConcessionDiscountType,
    value: number,
    description: string
  ) => {
    const duplicate = feeConcessions.find(
      (r) => r.title.toLowerCase() === title.toLowerCase()
    );
    if (duplicate) {
      setConcessionNotice(`Rule "${title}" already exists.`);
      setTimeout(() => setConcessionNotice(null), 3000);
      return;
    }
    const id = `conc_${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString(36)}`;
    await saveFeeConcessionRule({
      id,
      title,
      discountType,
      value,
      description,
      isActive: true,
    });
    setConcessionNotice(`Added "${title} (${value}${discountType === 'percentage' ? '%' : ' PKR'})"!`);
    setTimeout(() => setConcessionNotice(null), 3000);
  };

  const handleAssignConcessionToStudent = async () => {
    if (!assignStudentId) return;
    const rule = assignRuleId
      ? feeConcessions.find((r) => r.id === assignRuleId) || null
      : null;
    await applyStudentConcession(assignStudentId, rule);
    const stu = students.find((s) => s.id === assignStudentId);
    setConcessionNotice(
      rule
        ? `Permanently applied "${rule.title}" to ${stu?.fullName || 'student'}.`
        : `Removed fee concession for ${stu?.fullName || 'student'}.`
    );
    setTimeout(() => setConcessionNotice(null), 4000);
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

    // Calculate total collected across all or filtered (includes paid + partial cash received!)
    paymentsInMonth.forEach((p) => {
      if (defaulterClassFilter === 'ALL' || p.classId === defaulterClassFilter) {
        if (p.status === 'paid' || p.status === 'partial') {
          totalCollected += Number(p.paidAmount) || 0;
        }
      }
    });

    // Check every active student for this month (accounting for permanent concessions and partial payments)
    activeStudentsForAnalytics.forEach((s) => {
      if (!paidStudentIds.has(s.id)) {
        const partialRec = paymentsInMonth.find((p) => p.studentId === s.id);
        const struct =
          feeStructures.find((f) => f.classId === s.classId) ||
          editingStructures[s.classId];
        const chargesTotal = (struct?.customCharges || []).reduce(
          (sum, c) => sum + (Number(c.amount) || 0),
          0
        );
        const gross = (struct?.monthlyTuitionFee || 1500) + chargesTotal;
        const disc = calculateStudentDiscount(s, gross, feeConcessions);
        const netExpected = partialRec
          ? Number(partialRec.netAmount) || Math.max(0, gross - disc.discountAmount)
          : Math.max(0, gross - disc.discountAmount);
        const paidAlready = partialRec ? Number(partialRec.paidAmount) || 0 : 0;
        const expected = Math.max(0, netExpected - paidAlready);

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

  // =========================================================================
  // TAB 6: REPORTS & EXPORTS (Daily, Monthly, Defaulters, Discounts, Partial)
  // =========================================================================
  const [reportType, setReportType] = useState<'daily' | 'monthly' | 'defaulters' | 'discounts' | 'partial'>('daily');
  const [reportDate, setReportDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [reportMonth, setReportMonth] = useState<string>(selectedMonth);
  const [reportClassFilter, setReportClassFilter] = useState<string>('ALL');
  const [reportSchoolScope, setReportSchoolScope] = useState<string>(() =>
    isSuperAdmin ? 'ALL' : activeSchool.id
  );
  const [aggregatedDatasets, setAggregatedDatasets] = useState<SchoolFeeDataset[]>([]);
  const [loadingReports, setLoadingReports] = useState<boolean>(false);
  const [showReportPrintModal, setShowReportPrintModal] = useState<boolean>(false);

  // Sync reportMonth when global month changes unless customized
  useEffect(() => {
    setReportMonth(selectedMonth);
  }, [selectedMonth]);

  // Keep non-super-admin scope strictly locked to activeSchool
  useEffect(() => {
    if (!isSuperAdmin) {
      setReportSchoolScope(activeSchool.id);
    }
  }, [isSuperAdmin, activeSchool.id]);

  // Fetch multi-school fee datasets for Super Admin aggregated reports
  const loadAggregatedReportsData = async () => {
    if (!isSuperAdmin) return;
    const schoolsList = registeredSchools.length > 0 ? registeredSchools : [activeSchool];
    setLoadingReports(true);
    try {
      if (demoMode) {
        const mockDatasets: SchoolFeeDataset[] = schoolsList.map((sch) => ({
          school: sch,
          students: sch.id === activeSchool.id ? students : students.filter((s) => (s as any).schoolId === sch.id),
          feeStructures:
            sch.id === activeSchool.id
              ? feeStructures
              : feeStructures.filter((f) => f.schoolId === sch.id),
          feePayments:
            sch.id === activeSchool.id
              ? feePayments
              : feePayments.filter((p) => p.schoolId === sch.id),
          feeConcessions:
            sch.id === activeSchool.id
              ? feeConcessions
              : feeConcessions.filter((c) => c.schoolId === sch.id),
        }));
        setAggregatedDatasets(mockDatasets);
        return;
      }

      const settled = await Promise.all(
        schoolsList.map(async (sch): Promise<SchoolFeeDataset> => {
          if (sch.id === activeSchool.id) {
            return {
              school: sch,
              students,
              feeStructures,
              feePayments,
              feeConcessions,
            };
          }
          const [schStudents, schStructures, schPayments, schConcessions] = await Promise.all([
            fetchStudentsFromFirestore(sch.id).catch(() => []),
            fetchFeeStructuresFromFirestore(sch.id).catch(() => []),
            fetchFeePaymentsFromFirestore(sch.id).catch(() => []),
            fetchFeeConcessionsFromFirestore(sch.id).catch(() => []),
          ]);
          return {
            school: sch,
            students: schStudents,
            feeStructures: schStructures,
            feePayments: schPayments,
            feeConcessions: schConcessions,
          };
        })
      );
      setAggregatedDatasets(settled);
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reports' && isSuperAdmin) {
      loadAggregatedReportsData();
    }
  }, [activeTab, isSuperAdmin, registeredSchools.length, activeSchool.id, feePayments.length, students.length, feeConcessions.length]);

  const reportMonthLabel = useMemo(() => {
    const found = monthOptions.find((m) => m.val === reportMonth);
    if (found) return found.label;
    const [y, m] = reportMonth.split('-');
    const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }, [reportMonth, monthOptions]);

  // Compute Filtered & Aggregated Report Rows
  const reportData = useMemo(() => {
    let targetDatasets: SchoolFeeDataset[] = [];

    if (isSuperAdmin && reportSchoolScope === 'ALL') {
      if (aggregatedDatasets.length > 0) {
        targetDatasets = aggregatedDatasets.map((ds) =>
          ds.school.id === activeSchool.id
            ? { school: activeSchool, students, feeStructures, feePayments, feeConcessions }
            : ds
        );
      } else {
        targetDatasets = [{ school: activeSchool, students, feeStructures, feePayments, feeConcessions }];
      }
    } else if (isSuperAdmin && reportSchoolScope !== activeSchool.id) {
      const found = aggregatedDatasets.find((ds) => ds.school.id === reportSchoolScope);
      targetDatasets = found
        ? [found]
        : [{ school: activeSchool, students, feeStructures, feePayments, feeConcessions }];
    } else {
      targetDatasets = [{ school: activeSchool, students, feeStructures, feePayments, feeConcessions }];
    }

    const isAggregatedMultiSchool = isSuperAdmin && reportSchoolScope === 'ALL' && targetDatasets.length > 1;
    const applyClassFilter = !isAggregatedMultiSchool && reportClassFilter !== 'ALL';

    const dailyPayments: Array<FeePayment & { schoolName: string; semisCode: string }> = [];
    const monthlyPayments: Array<FeePayment & { schoolName: string; semisCode: string }> = [];
    const defaulterRows: Array<{
      schoolId: string;
      schoolName: string;
      semisCode: string;
      student: Student;
      expectedFee: number;
      paidAlready: number;
    }> = [];
    const discountRows: Array<{
      schoolId: string;
      schoolName: string;
      semisCode: string;
      student: Student;
      concessionTitle: string;
      grossFee: number;
      discountAmount: number;
      netFee: number;
      paymentStatus: string;
    }> = [];
    const discountRuleMap = new Map<
      string,
      { title: string; studentsCount: number; totalMonthlyDiscount: number }
    >();
    const partialPaymentRows: Array<FeePayment & { schoolName: string; semisCode: string; remainingDue: number; studentAdvanceBalance: number }> = [];

    const schoolSummaries: Array<{
      schoolId: string;
      schoolName: string;
      semisCode: string;
      district: string;
      activeStudentsCount: number;
      paidCount: number;
      defaultersCount: number;
      dailyCollected: number;
      monthlyCollected: number;
      totalPending: number;
      totalDiscountGranted: number;
      partialCount: number;
      collectionRate: number;
    }> = [];

    let totalDailyCollected = 0;
    let totalMonthlyCollected = 0;
    let totalPending = 0;
    let totalPaidCount = 0;
    let totalDefaultersCount = 0;
    let totalActiveStudents = 0;
    let totalDiscountsGranted = 0;
    let totalPartialPending = 0;
    let totalPartialCollected = 0;
    let totalAdvanceHeld = 0;

    const methodTotals: Record<string, number> = {};

    targetDatasets.forEach((ds) => {
      const schName = ds.school.name || 'School';
      const schSemis = ds.school.semisCode || '';
      const schDistrict = ds.school.district || '';

      // Daily payments (both full and partial cash received on date)
      let schDailyCollected = 0;
      ds.feePayments.forEach((p) => {
        if (p.status !== 'paid' && p.status !== 'partial') return;
        if (applyClassFilter && p.classId !== reportClassFilter) return;
        const payDay = (p.paymentDate || p.createdAt || '').slice(0, 10);
        if (payDay === reportDate) {
          const amt = Number(p.paidAmount) || 0;
          schDailyCollected += amt;
          totalDailyCollected += amt;
          const m = p.paymentMethod || 'Cash';
          methodTotals[m] = (methodTotals[m] || 0) + amt;
          dailyPayments.push({ ...p, schoolName: schName, semisCode: schSemis });
        }
      });

      // Monthly payments (includes paid & partial cash collected in reportMonth)
      let schMonthlyCollected = 0;
      let schDiscountsGranted = 0;
      let schPartialCount = 0;
      const paidStudentIdsForMonth = new Set<string>();
      const paymentByStudentMonth = new Map<string, FeePayment>();

      ds.feePayments.forEach((p) => {
        if (p.month !== reportMonth) return;
        if (applyClassFilter && p.classId !== reportClassFilter) return;
        paymentByStudentMonth.set(p.studentId, p);

        if (p.status === 'paid' || p.status === 'partial') {
          const amt = Number(p.paidAmount) || 0;
          schMonthlyCollected += amt;
          totalMonthlyCollected += amt;
          if (p.status === 'paid') {
            paidStudentIdsForMonth.add(p.studentId);
          }
          monthlyPayments.push({ ...p, schoolName: schName, semisCode: schSemis });
        }

        if (p.status === 'partial' || (Number(p.pendingBalance) || 0) > 0) {
          const remainingDue = Math.max(0, (Number(p.netAmount) || 0) - (Number(p.paidAmount) || 0));
          const stuObj = ds.students.find((s) => s.id === p.studentId);
          const stuAdv = Number(stuObj?.advanceBalance) || 0;
          schPartialCount += 1;
          totalPartialPending += remainingDue;
          totalPartialCollected += Number(p.paidAmount) || 0;
          partialPaymentRows.push({
            ...p,
            schoolName: schName,
            semisCode: schSemis,
            remainingDue,
            studentAdvanceBalance: stuAdv,
          });
        }
      });

      const schActiveStudents = ds.students.filter((s) => {
        if (s.status !== 'active') return false;
        if (applyClassFilter && s.classId !== reportClassFilter) return false;
        return true;
      });

      let schPending = 0;
      let schDefaultersCount = 0;
      schActiveStudents.forEach((s) => {
        totalAdvanceHeld += Number(s.advanceBalance) || 0;

        const expected = getExpectedClassMonthlyFee(s.classId, ds.feeStructures);
        const disc = calculateStudentDiscount(s, expected.grossMonthlyFee, ds.feeConcessions || []);
        const rec = paymentByStudentMonth.get(s.id);
        const appliedDiscount = rec ? Number(rec.discount) || 0 : disc.discountAmount;
        const concessionTitle = rec?.concessionTitle || disc.concessionTitle || (appliedDiscount > 0 ? 'Custom Discount' : '');

        if (appliedDiscount > 0) {
          schDiscountsGranted += appliedDiscount;
          totalDiscountsGranted += appliedDiscount;
          discountRows.push({
            schoolId: ds.school.id,
            schoolName: schName,
            semisCode: schSemis,
            student: s,
            concessionTitle,
            grossFee: expected.grossMonthlyFee,
            discountAmount: appliedDiscount,
            netFee: Math.max(0, expected.grossMonthlyFee - appliedDiscount),
            paymentStatus: rec?.status || 'unpaid',
          });
          const key = concessionTitle || 'Custom Discount';
          const prevRule = discountRuleMap.get(key) || { title: key, studentsCount: 0, totalMonthlyDiscount: 0 };
          prevRule.studentsCount += 1;
          prevRule.totalMonthlyDiscount += appliedDiscount;
          discountRuleMap.set(key, prevRule);
        }

        if (!paidStudentIdsForMonth.has(s.id)) {
          const netExpected = rec
            ? Number(rec.netAmount) ?? Math.max(0, expected.grossMonthlyFee - appliedDiscount)
            : Math.max(0, expected.grossMonthlyFee - appliedDiscount);
          const paidAlready = rec ? Number(rec.paidAmount) || 0 : 0;
          const remaining = Math.max(0, netExpected - paidAlready);
          schPending += remaining;
          schDefaultersCount += 1;
          defaulterRows.push({
            schoolId: ds.school.id,
            schoolName: schName,
            semisCode: schSemis,
            student: s,
            expectedFee: remaining,
            paidAlready,
          });
        }
      });

      const schPaidCount = paidStudentIdsForMonth.size;
      const schTotalCount = schActiveStudents.length;
      const schRate = schTotalCount > 0 ? Math.round((schPaidCount / schTotalCount) * 100) : 0;

      totalPending += schPending;
      totalPaidCount += schPaidCount;
      totalDefaultersCount += schDefaultersCount;
      totalActiveStudents += schTotalCount;

      schoolSummaries.push({
        schoolId: ds.school.id,
        schoolName: schName,
        semisCode: schSemis,
        district: schDistrict,
        activeStudentsCount: schTotalCount,
        paidCount: schPaidCount,
        defaultersCount: schDefaultersCount,
        dailyCollected: schDailyCollected,
        monthlyCollected: schMonthlyCollected,
        totalPending: schPending,
        totalDiscountGranted: schDiscountsGranted,
        partialCount: schPartialCount,
        collectionRate: schRate,
      });
    });

    const overallCollectionRate =
      totalActiveStudents > 0 ? Math.round((totalPaidCount / totalActiveStudents) * 100) : 0;

    return {
      isAggregatedMultiSchool,
      targetDatasets,
      dailyPayments,
      monthlyPayments,
      defaulterRows,
      discountRows,
      discountRuleSummary: Array.from(discountRuleMap.values()),
      partialPaymentRows,
      schoolSummaries,
      totals: {
        totalDailyCollected,
        totalMonthlyCollected,
        totalPending,
        totalPaidCount,
        totalDefaultersCount,
        totalActiveStudents,
        overallCollectionRate,
        totalDiscountsGranted,
        totalPartialPending,
        totalPartialCollected,
        totalAdvanceHeld,
        methodTotals,
      },
    };
  }, [
    isSuperAdmin,
    reportSchoolScope,
    aggregatedDatasets,
    activeSchool,
    students,
    feeStructures,
    feePayments,
    feeConcessions,
    reportClassFilter,
    reportDate,
    reportMonth,
  ]);

  const reportScopeLabel = useMemo(() => {
    if (isSuperAdmin && reportSchoolScope === 'ALL') {
      return `All Registered Schools (${reportData.targetDatasets.length} Schools Aggregated)`;
    }
    const targetSchool =
      registeredSchools.find((s) => s.id === reportSchoolScope) || activeSchool;
    return `${targetSchool.name} (SEMIS: ${targetSchool.semisCode || 'N/A'})`;
  }, [isSuperAdmin, reportSchoolScope, registeredSchools, activeSchool, reportData.targetDatasets.length]);

  // Export Excel (CSV) handler
  const handleExportReportCsv = () => {
    const lines: string[][] = [];
    const generatedAt = new Date().toLocaleString('en-GB');

    if (reportType === 'daily') {
      lines.push(['PakEdu Financial Report - Daily Fee Collection Report']);
      lines.push(['Scope', reportScopeLabel]);
      lines.push(['Collection Date', reportDate]);
      lines.push(['Generated On', generatedAt]);
      lines.push(['Total Collected (PKR)', String(reportData.totals.totalDailyCollected)]);
      lines.push(['Total Pending for Month (PKR)', String(reportData.totals.totalPending)]);
      lines.push([]);
      lines.push([
        'Receipt No',
        'Payment Date',
        'School',
        'SEMIS',
        'GR Number',
        'Student Name',
        'Class & Section',
        'Fee Month',
        'Status',
        'Payment Method',
        'Discount (PKR)',
        'Amount Paid (PKR)',
        'Collected By',
      ]);
      reportData.dailyPayments.forEach((p) => {
        lines.push([
          p.receiptNumber || 'RCPT',
          p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-GB') : reportDate,
          p.schoolName,
          p.semisCode,
          p.grNumber,
          p.studentName,
          `${p.grade} - ${p.section || 'General'}`,
          p.monthLabel,
          p.status,
          p.paymentMethod || 'Cash',
          String(p.discount || 0),
          String(p.paidAmount || 0),
          p.recordedByName || 'Accounts',
        ]);
      });
      lines.push([]);
      lines.push(['TOTAL COLLECTED (PKR)', '', '', '', '', '', '', '', '', '', '', String(reportData.totals.totalDailyCollected), '']);
    } else if (reportType === 'monthly') {
      lines.push(['PakEdu Financial Report - Monthly Fee Collection Report']);
      lines.push(['Scope', reportScopeLabel]);
      lines.push(['Billing Month', reportMonthLabel]);
      lines.push(['Generated On', generatedAt]);
      lines.push(['Total Collected (PKR)', String(reportData.totals.totalMonthlyCollected)]);
      lines.push(['Total Pending (PKR)', String(reportData.totals.totalPending)]);
      lines.push([]);
      if (isSuperAdmin && reportSchoolScope === 'ALL') {
        lines.push(['--- SCHOOL-WISE AGGREGATE SUMMARY ---']);
        lines.push([
          'School Name',
          'SEMIS Code',
          'District',
          'Active Students',
          'Paid Students',
          'Pending Students',
          'Total Collected (PKR)',
          'Total Pending (PKR)',
          'Collection Rate (%)',
        ]);
        reportData.schoolSummaries.forEach((s) => {
          lines.push([
            s.schoolName,
            s.semisCode,
            s.district,
            String(s.activeStudentsCount),
            String(s.paidCount),
            String(s.defaultersCount),
            String(s.monthlyCollected),
            String(s.totalPending),
            `${s.collectionRate}%`,
          ]);
        });
        lines.push([]);
      }
      lines.push([
        'Receipt No',
        'Payment Date',
        'School',
        'SEMIS',
        'GR Number',
        'Student Name',
        'Class & Section',
        'Status',
        'Payment Method',
        'Discount (PKR)',
        'Amount Paid (PKR)',
      ]);
      reportData.monthlyPayments.forEach((p) => {
        lines.push([
          p.receiptNumber || 'RCPT',
          p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-GB') : 'N/A',
          p.schoolName,
          p.semisCode,
          p.grNumber,
          p.studentName,
          `${p.grade} - ${p.section || 'General'}`,
          p.status,
          p.paymentMethod || 'Cash',
          String(p.discount || 0),
          String(p.paidAmount || 0),
        ]);
      });
      lines.push([]);
      lines.push(['TOTAL COLLECTED (PKR)', '', '', '', '', '', '', '', '', '', String(reportData.totals.totalMonthlyCollected)]);
      lines.push(['TOTAL PENDING (PKR)', '', '', '', '', '', '', '', '', '', String(reportData.totals.totalPending)]);
    } else if (reportType === 'discounts') {
      lines.push(['PakEdu Financial Report - Discount & Concessions Summary']);
      lines.push(['Scope', reportScopeLabel]);
      lines.push(['Billing Month', reportMonthLabel]);
      lines.push(['Generated On', generatedAt]);
      lines.push(['Total Discounted Students', String(reportData.discountRows.length)]);
      lines.push(['Total Monthly Discounts Granted (PKR)', String(reportData.totals.totalDiscountsGranted)]);
      lines.push([]);
      lines.push([
        'School',
        'SEMIS',
        'GR Number',
        'Student Name',
        'Class & Section',
        'Concession Rule',
        'Gross Fee (PKR)',
        'Discount Amount (PKR)',
        'Net Payable (PKR)',
        'Payment Status',
      ]);
      reportData.discountRows.forEach((row) => {
        lines.push([
          row.schoolName,
          row.semisCode,
          row.student.grNumber,
          row.student.fullName,
          `${row.student.grade} - ${row.student.section || 'General'}`,
          row.concessionTitle,
          String(row.grossFee),
          String(row.discountAmount),
          String(row.netFee),
          row.paymentStatus,
        ]);
      });
      lines.push([]);
      lines.push(['TOTAL CONCESSIONS GRANTED (PKR)', '', '', '', '', '', '', String(reportData.totals.totalDiscountsGranted), '', '']);
    } else if (reportType === 'partial') {
      lines.push(['PakEdu Financial Report - Partial Payments & Pending Balance Report']);
      lines.push(['Scope', reportScopeLabel]);
      lines.push(['Billing Month', reportMonthLabel]);
      lines.push(['Generated On', generatedAt]);
      lines.push(['Partial Payment Records', String(reportData.partialPaymentRows.length)]);
      lines.push(['Total Paid So Far (PKR)', String(reportData.totals.totalPartialCollected)]);
      lines.push(['Total Remaining Pending Balance (PKR)', String(reportData.totals.totalPartialPending)]);
      lines.push([]);
      lines.push([
        'Receipt No',
        'School',
        'SEMIS',
        'GR Number',
        'Student Name',
        'Class & Section',
        'Month',
        'Net Fee (PKR)',
        'Paid So Far (PKR)',
        'Remaining Pending Balance (PKR)',
        'Student Advance Credit (PKR)',
        'Payment Date',
      ]);
      reportData.partialPaymentRows.forEach((p) => {
        lines.push([
          p.receiptNumber || 'RCPT',
          p.schoolName,
          p.semisCode,
          p.grNumber,
          p.studentName,
          `${p.grade} - ${p.section || 'General'}`,
          p.monthLabel,
          String(p.netAmount || 0),
          String(p.paidAmount || 0),
          String(p.remainingDue || 0),
          String(p.studentAdvanceBalance || 0),
          p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-GB') : 'N/A',
        ]);
      });
      lines.push([]);
      lines.push(['TOTAL REMAINING PENDING BALANCE (PKR)', '', '', '', '', '', '', '', String(reportData.totals.totalPartialCollected), String(reportData.totals.totalPartialPending), '', '']);
    } else {
      lines.push(['PakEdu Financial Report - Fee Defaulters List']);
      lines.push(['Scope', reportScopeLabel]);
      lines.push(['Billing Month', reportMonthLabel]);
      lines.push(['Generated On', generatedAt]);
      lines.push(['Total Defaulters', String(reportData.totals.totalDefaultersCount)]);
      lines.push(['Total Pending Dues (PKR)', String(reportData.totals.totalPending)]);
      lines.push([]);
      lines.push([
        'School',
        'SEMIS',
        'GR Number',
        'Student Name',
        "Father's Name",
        'Class & Section',
        'Guardian Phone',
        'Billing Month',
        'Paid Already (PKR)',
        'Pending Due (PKR)',
        'Status',
      ]);
      reportData.defaulterRows.forEach((row) => {
        lines.push([
          row.schoolName,
          row.semisCode,
          row.student.grNumber,
          row.student.fullName,
          row.student.fatherName,
          `${row.student.grade} - ${row.student.section || 'General'}`,
          row.student.guardianPhone || 'N/A',
          reportMonthLabel,
          String(row.paidAlready),
          String(row.expectedFee),
          row.paidAlready > 0 ? 'Partial' : 'Unpaid',
        ]);
      });
      lines.push([]);
      lines.push(['TOTAL PENDING DUES (PKR)', '', '', '', '', '', '', '', '', String(reportData.totals.totalPending), '']);
    }

    const csvContent = '\uFEFF' + lines.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const suffix = reportType === 'daily' ? reportDate : reportMonth;
    link.href = url;
    link.download = `PakEdu_${reportType}_fee_report_${suffix}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export PDF handler (opens A4 report view and invokes native print/save PDF)
  const handleExportReportPdf = () => {
    setShowReportPrintModal(true);
    setTimeout(() => {
      triggerPrintDocument();
    }, 150);
  };

  if (!canAccessModule) {
    return (
      <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-10 text-center space-y-3 shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-[#1C1917] dark:text-[#FAF8F5]">
          Fee Management Access Restricted
        </h2>
        <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] max-w-md mx-auto">
          This module is restricted to the Portal Super Admin, School Administrators / Principals, and designated Admission Incharges.
        </p>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mt-2 px-4 py-2 bg-[#7F1D1D] hover:bg-[#651414] text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Return to Dashboard
          </button>
        )}
      </div>
    );
  }

  const isPrintModalOpen = Boolean(activeVoucherForPrint || showReportPrintModal || bulkBatchForPrint);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200">
      <div className={isPrintModalOpen ? 'no-print space-y-6' : 'space-y-6'}>
      {/* Top Banner / Breadcrumb & Header */}
      <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                  Fee Management &amp; Accounts
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {activeSchool.name || 'School Accounts'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F3EFEA] dark:bg-[#2C1215] text-[#57534E] dark:text-[#E7E0D4]">
                  SEMIS: {activeSchool.semisCode || 'N/A'}
                </span>
              </div>
              <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-1">
                Dynamic class fee structures, monthly fee collection, printable bank vouchers, financial reports, and fee defaulters tracking.
              </p>
            </div>
          </div>

          {/* Month Selector & Role Badge */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <div className="flex items-center gap-2 bg-[#FAF8F5] dark:bg-[#2C1215]/80 px-3 py-1.5 rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
              <Calendar className="w-4 h-4 text-[#57534E] shrink-0" />
              <label htmlFor="sms-fee-month-selector" className="sr-only">Billing Month</label>
              <select
                id="sms-fee-month-selector"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-bold text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden cursor-pointer"
              >
                {monthOptions.map((opt) => (
                  <option key={opt.val} value={opt.val} className="dark:bg-[#211415]">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {isSuperAdmin ? (
              <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                Super Admin (Global)
              </span>
            ) : canManageFeeStructure ? (
              <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-[#FEF2F2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5] border border-[#FECACA] dark:border-[#7F1D1D]/60">
                School Admin (Full Access)
              </span>
            ) : (
              <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                Admission Incharge (Collection)
              </span>
            )}
          </div>
        </div>

        {/* Super Admin School Switcher Bar */}
        {isSuperAdmin && (
          <div className="mt-4 p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#2C1215]/70 border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <Building className="w-4 h-4 text-rose-500 shrink-0" />
              <div>
                <span className="font-bold text-[#1C1917] dark:text-[#FAF8F5] block">
                  Super Admin Active School Context
                </span>
                <span className="text-[11px] text-[#57534E] dark:text-[#D6CCC2]">
                  Select any registered school to load its classes, students, fee structures, and vouchers.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label htmlFor="superadmin-fee-school-selector" className="sr-only">
                Select School
              </label>
              <select
                id="superadmin-fee-school-selector"
                value={activeSchool.id}
                onChange={(e) => handleSuperAdminSchoolSelect(e.target.value)}
                className="flex-1 sm:w-80 bg-[#FFFDF9] dark:bg-[#211415] border border-[#D6CCC2] dark:border-[rgba(255,253,249,0.22)] rounded-xl px-3 py-2 text-xs font-bold text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 cursor-pointer"
              >
                {registeredSchools.length === 0 ? (
                  <option value={activeSchool.id}>
                    {activeSchool.name || 'No Registered Schools Found'}
                  </option>
                ) : (
                  registeredSchools.map((sch) => (
                    <option key={sch.id} value={sch.id}>
                      {sch.name} — SEMIS: {sch.semisCode || 'N/A'}
                    </option>
                  ))
                )}
              </select>

              <button
                type="button"
                onClick={() => refreshActiveSchoolClasses(activeSchool.id)}
                disabled={loadingClasses}
                title="Reload Classes & Fee Data"
                className="px-3 py-2 bg-[#FFFDF9] dark:bg-[#211415] hover:bg-[#F3EFEA] dark:hover:bg-[#3F1014] border border-[#D6CCC2] dark:border-[rgba(255,253,249,0.22)] rounded-xl text-xs font-semibold text-[#44403C] dark:text-[#FAF8F5] flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingClasses ? 'animate-spin' : ''}`} />
                <span className="hidden md:inline">{loadingClasses ? 'Loading...' : `${classes.length} Classes`}</span>
              </button>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] overflow-x-auto no-scrollbar">
          {/* Fee Structure Tab: Visible to Admin; Read-only notice for Admission Incharge */}
          <button
            type="button"
            onClick={() => setActiveTab('structure')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === 'structure'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-[#57534E] dark:text-[#D6CCC2] hover:bg-[#F3EFEA] dark:hover:bg-[#3F1014]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>1. Fee Structure</span>
            {!canManageFeeStructure && (
              <span className="px-1.5 py-0.2 text-[9px] bg-[#E7E0D4] dark:bg-[#3F1014] text-[#57534E] dark:text-[#E7E0D4] rounded font-normal">
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
                : 'text-[#57534E] dark:text-[#D6CCC2] hover:bg-[#F3EFEA] dark:hover:bg-[#3F1014]'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>2. Collect Fee &amp; Vouchers</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bulk')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === 'bulk'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-[#57534E] dark:text-[#D6CCC2] hover:bg-[#F3EFEA] dark:hover:bg-[#3F1014]'
            }`}
          >
            <FileCheck2 className="w-4 h-4" />
            <span>3. Bulk Generate</span>
          </button>

          {(canManageFeeStructure || isSuperAdmin) && (
            <button
              type="button"
              onClick={() => setActiveTab('concessions')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                activeTab === 'concessions'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'text-[#57534E] dark:text-[#D6CCC2] hover:bg-[#F3EFEA] dark:hover:bg-[#3F1014]'
              }`}
            >
              <Tag className="w-4 h-4" />
              <span>4. Concessions</span>
              {feeConcessions.length > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] bg-amber-500 text-white rounded-full font-bold">
                  {feeConcessions.length}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('defaulters')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === 'defaulters'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-[#57534E] dark:text-[#D6CCC2] hover:bg-[#F3EFEA] dark:hover:bg-[#3F1014]'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>5. Defaulters</span>
            {kpiStats.defaultersCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] bg-red-500 text-white rounded-full font-bold">
                {kpiStats.defaultersCount}
              </span>
            )}
          </button>

          {canAccessReports && (
            <button
              type="button"
              onClick={() => setActiveTab('reports')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                activeTab === 'reports'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'text-[#57534E] dark:text-[#D6CCC2] hover:bg-[#F3EFEA] dark:hover:bg-[#3F1014]'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>6. Reports</span>
            </button>
          )}
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
          <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-[#1C1917] dark:text-[#FAF8F5] flex items-center gap-2">
                  <span>Class-Wise Fee Matrix</span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    Fully Variable &amp; Editable
                  </span>
                </h2>
                <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-1">
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
          <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F5] dark:bg-[#2C1215]/60 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-[#57534E] dark:text-[#E7E0D4] font-bold uppercase text-[11px] tracking-wider">
                    <th className="py-3.5 px-4">Class &amp; Section</th>
                    <th className="py-3.5 px-4">Monthly Tuition (PKR)</th>
                    <th className="py-3.5 px-4">Admission Fee (PKR)</th>
                    <th className="py-3.5 px-4">Exam Fee (PKR)</th>
                    <th className="py-3.5 px-4">Custom Charges &amp; Funds</th>
                    <th className="py-3.5 px-4">Total Monthly Due</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E0D4] dark:divide-[rgba(255,253,249,0.10)] text-[#44403C] dark:text-[#E7E0D4]">
                  {classes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 px-4 text-center text-xs text-[#57534E] dark:text-[#D6CCC2]">
                        {loadingClasses
                          ? `Loading classes for ${activeSchool.name}...`
                          : `No classes found for ${activeSchool.name}. Please add classes in Classes & Sections first.`}
                      </td>
                    </tr>
                  ) : (
                  classes.map((cls) => {
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
                        className="hover:bg-[#FAF8F5]/60 dark:hover:bg-[#3F1014]/40 transition-colors"
                      >
                        {/* Class Info */}
                        <td className="py-4 px-4 font-semibold text-[#1C1917] dark:text-[#FAF8F5]">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <div>
                              <div className="font-bold text-sm">{cls.grade}</div>
                              <div className="text-[11px] text-[#57534E] dark:text-[#D6CCC2] font-normal">
                                {cls.section || 'General'} · {cls.medium}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Monthly Tuition */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl px-2.5 py-1.5 w-32">
                            <span className="text-[#78716C] font-semibold text-xs">Rs.</span>
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
                              className="w-full bg-transparent font-bold text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden text-xs disabled:opacity-60"
                            />
                          </div>
                        </td>

                        {/* Admission Fee */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl px-2.5 py-1.5 w-28">
                            <span className="text-[#78716C] font-semibold text-xs">Rs.</span>
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
                              className="w-full bg-transparent font-medium text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden text-xs disabled:opacity-60"
                            />
                          </div>
                        </td>

                        {/* Exam Fee */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl px-2.5 py-1.5 w-28">
                            <span className="text-[#78716C] font-semibold text-xs">Rs.</span>
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
                              className="w-full bg-transparent font-medium text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden text-xs disabled:opacity-60"
                            />
                          </div>
                        </td>

                        {/* Custom Charges & Funds */}
                        <td className="py-4 px-4 max-w-xs">
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {(struct.customCharges || []).map((chg) => (
                              <span
                                key={chg.id}
                                className="inline-flex items-center gap-1 bg-[#FEF2F2] dark:bg-[#3F1014]/60 border border-[#FECACA] dark:border-[#7F1D1D]/60 text-[#7F1D1D] dark:text-[#FCA5A5] text-[10px] font-bold px-2 py-0.5 rounded-lg"
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
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-[#F3EFEA] hover:bg-[#E7E0D4] dark:bg-[#2C1215] dark:hover:bg-[#4A1C20] text-[#44403C] dark:text-[#E7E0D4] rounded-lg transition border border-dashed border-[#D6CCC2] dark:border-[rgba(255,253,249,0.22)] cursor-pointer"
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
                              className="px-3 py-1.5 bg-[#F3EFEA] hover:bg-emerald-600 hover:text-white dark:bg-[#2C1215] dark:hover:bg-emerald-600 text-[#44403C] dark:text-[#FAF8F5] rounded-lg text-xs font-bold transition flex items-center gap-1.5 ml-auto cursor-pointer disabled:opacity-50"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>{savingClassId === cls.id ? 'Saving...' : 'Save'}</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                  )}
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
            <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] pb-4">
                <div>
                  <h2 className="text-base font-bold text-[#1C1917] dark:text-[#FAF8F5] flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <span>Fee Collection &amp; Voucher Generator</span>
                  </h2>
                  <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-0.5">
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
                  <label htmlFor="sms-fee-class-selector" className="block text-xs font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1.5">
                    1. Select Class
                  </label>
                  <select
                    id="sms-fee-class-selector"
                    value={collectionClassId}
                    disabled={loadingClasses}
                    onChange={(e) => {
                      setCollectionClassId(e.target.value);
                      setCollectionStudentId('');
                    }}
                    className="w-full bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 cursor-pointer disabled:opacity-60"
                  >
                    <option value="">
                      {loadingClasses
                        ? 'Loading classes...'
                        : classes.length === 0
                        ? '-- No Classes Found in Selected School --'
                        : `-- Choose Class (${classes.length} available) --`}
                    </option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.grade} - {c.section || 'General'} ({c.medium})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="sms-fee-student-selector" className="block text-xs font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1.5">
                    2. Select Student
                  </label>
                  <select
                    id="sms-fee-student-selector"
                    value={collectionStudentId}
                    onChange={(e) => setCollectionStudentId(e.target.value)}
                    className="w-full bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
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
                <div className="bg-[#FAF8F5] dark:bg-[#2C1215]/60 rounded-xl p-4 border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#1C1917] dark:text-[#FAF8F5] pb-2 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
                    <span>Fee Component Breakdown</span>
                    <div className="flex items-center gap-2">
                      {(Number(selectedStudent.advanceBalance) || 0) > 0 && (
                        <span className="px-2 py-0.5 rounded bg-[#FFF7ED] dark:bg-[#7C2D12]/70 text-[#C2410C] dark:text-[#FDBA74] text-[10px]">
                          Student Advance Credit: Rs. {(selectedStudent.advanceBalance || 0).toLocaleString()}
                        </span>
                      )}
                      <span className="text-emerald-600 dark:text-emerald-400">
                        Year: {activeClassFeeStructure.academicYear}
                      </span>
                    </div>
                  </div>

                  {/* Permanent Student Concession Assignment / Badge */}
                  {canManageFeeStructure ? (
                    <div className="p-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5" />
                        <span>Permanent Student Concession (Admin):</span>
                      </span>
                      <select
                        value={selectedStudent.concessionId || ''}
                        onChange={(e) => {
                          const rule = feeConcessions.find((r) => r.id === e.target.value) || null;
                          applyStudentConcession(selectedStudent.id, rule);
                        }}
                        className="px-2.5 py-1.5 bg-[#FFFDF9] dark:bg-[#211415] border border-amber-300 dark:border-amber-700 rounded-lg text-xs font-semibold text-[#1C1917] dark:text-[#FAF8F5] cursor-pointer"
                      >
                        <option value="">No Permanent Discount</option>
                        {feeConcessions
                          .filter((r) => r.isActive !== false)
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.title} ({r.discountType === 'fixed' ? `Rs.${r.value}` : `${r.value}%`})
                            </option>
                          ))}
                      </select>
                    </div>
                  ) : studentPermanentDiscount.concessionTitle ? (
                    <div className="p-2 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" />
                      <span>
                        Applied Permanent Concession: {studentPermanentDiscount.concessionTitle} (
                        {studentPermanentDiscount.discountType === 'fixed'
                          ? `Rs. ${studentPermanentDiscount.discountValue}`
                          : `${studentPermanentDiscount.discountValue}%`}
                        )
                      </span>
                    </div>
                  ) : null}

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between text-[#57534E] dark:text-[#D6CCC2]">
                      <span>Monthly Tuition Fee:</span>
                      <span className="font-semibold text-[#1C1917] dark:text-[#FAF8F5]">
                        Rs. {baseMonthlyTuition.toLocaleString()}
                      </span>
                    </div>

                    {(activeClassFeeStructure.customCharges || []).map((chg) => (
                      <div
                        key={chg.id}
                        className="flex items-center justify-between text-[#57534E] dark:text-[#D6CCC2]"
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#7F1D1D]"></span>
                          <span>{chg.title}:</span>
                        </span>
                        <span className="font-semibold text-[#1C1917] dark:text-[#FAF8F5]">
                          Rs. {Number(chg.amount).toLocaleString()}
                        </span>
                      </div>
                    ))}

                    <div className="flex items-center justify-between pt-2 border-t border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] font-semibold text-[#1C1917] dark:text-[#FAF8F5]">
                      <span>Gross Monthly Base:</span>
                      <span>Rs. {grossMonthlyFee.toLocaleString()}</span>
                    </div>

                    {/* Concession / Discount Adjustment */}
                    <div className="flex items-center justify-between pt-2 text-xs">
                      <span className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>
                          Discount / Concession
                          {studentPermanentDiscount.concessionTitle
                            ? ` (${studentPermanentDiscount.concessionTitle})`
                            : ''}
                          :
                        </span>
                      </span>
                      <div className="flex items-center gap-1 bg-[#FFFDF9] dark:bg-[#211415] border border-amber-300 dark:border-amber-700 rounded-lg px-2 py-1 w-32">
                        <span className="text-[#78716C] text-xs">Rs.</span>
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
                    <div className="flex items-center justify-between pt-2 border-t border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-xs font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                      <span>Net Monthly Payable Fee:</span>
                      <span>Rs. {netPayable.toLocaleString()}</span>
                    </div>

                    {alreadyPaidThisMonth > 0 && (
                      <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        <span>
                          Already Paid for {currentMonthLabel}
                          {existingPaymentForStudent?.advanceUsed
                            ? ` (incl. Rs. ${existingPaymentForStudent.advanceUsed.toLocaleString()} Advance)`
                            : ''}
                          :
                        </span>
                        <span>- Rs. {alreadyPaidThisMonth.toLocaleString()}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-sm font-bold text-emerald-700 dark:text-emerald-400">
                      <span>Remaining Balance Due ({currentMonthLabel}):</span>
                      <span className="text-base">Rs. {remainingDueThisMonth.toLocaleString()}</span>
                    </div>

                    {/* Exact Amount Received (Partial & Advance Fee Tracking) */}
                    <div className="mt-2 p-3 bg-[#FFFDF9] dark:bg-[#211415] border-2 border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <label htmlFor="sms-exact-amount-received" className="text-xs font-bold text-[#1C1917] dark:text-[#FAF8F5] flex items-center gap-1.5">
                            <Wallet className="w-4 h-4 text-emerald-600" />
                            <span>Exact Amount Received (PKR):</span>
                          </label>
                          <p className="text-[10px] text-[#57534E]">
                            Enter less than due for Partial payment, or more for Next Month Advance.
                          </p>
                        </div>
                        <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 rounded-xl px-3 py-1.5 w-full sm:w-40">
                          <span className="text-emerald-700 dark:text-emerald-400 font-bold text-xs">Rs.</span>
                          <input
                            id="sms-exact-amount-received"
                            type="number"
                            min="0"
                            value={amountReceivedInput}
                            onChange={(e) => setAmountReceivedInput(Math.max(0, parseInt(e.target.value, 10) || 0))}
                            className="w-full bg-transparent font-black text-emerald-800 dark:text-emerald-300 focus:outline-hidden text-sm font-mono"
                          />
                        </div>
                      </div>

                      {/* Real-time Partial / Advance Indicator */}
                      {remainingDueThisMonth > 0 && numericReceivedNow < remainingDueThisMonth && (
                        <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 font-semibold flex items-center justify-between">
                          <span>Status: Partial Payment</span>
                          <span className="font-mono font-bold">
                            Pending Balance: Rs. {projectedPendingAfterPayment.toLocaleString()}
                          </span>
                        </div>
                      )}

                      {surplusAmount > 0 && (
                        <div className="p-2.5 rounded-lg bg-[#FFF7ED] dark:bg-[#7C2D12]/40 border border-[#FED7AA] dark:border-[#C2410C]/50 text-[11px] text-[#C2410C] dark:text-[#FDBA74] space-y-1.5">
                          <div className="flex items-center justify-between font-bold">
                            <span>Overpayment Surplus Detected:</span>
                            <span className="font-mono text-[#C2410C] dark:text-[#FDBA74]">
                              + Rs. {surplusAmount.toLocaleString()}
                            </span>
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer font-medium">
                            <input
                              type="checkbox"
                              checked={allocateSurplusToNextMonth}
                              onChange={(e) => setAllocateSurplusToNextMonth(e.target.checked)}
                              className="rounded border-[#FED7AA] text-[#C2410C] focus:ring-[#C2410C]"
                            />
                            <span>
                              Allocate Rs. {surplusAmount.toLocaleString()} as Advance to{' '}
                              <strong>{nextMonthLabel}</strong>
                            </span>
                          </label>
                        </div>
                      )}

                      {remainingDueThisMonth > 0 && numericReceivedNow === remainingDueThisMonth && (
                        <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold flex items-center justify-between">
                          <span>Status: Full Settlement</span>
                          <span className="font-mono">Remaining Balance: Rs. 0</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-[#FAF8F5] dark:bg-[#2C1215]/40 rounded-xl border border-dashed border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-xs text-[#57534E]">
                  <UserCheck className="w-8 h-8 mx-auto text-[#78716C] mb-2 opacity-60" />
                  <p className="font-semibold">No student selected</p>
                  <p className="text-[11px] text-[#78716C] mt-0.5">
                    Select a class and student above to calculate monthly fees and generate voucher.
                  </p>
                </div>
              )}

              {collectionFeedback && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{collectionFeedback}</span>
                </div>
              )}

              {/* Payment Method & Notes */}
              {selectedStudent && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label htmlFor="sms-payment-method-selector" className="block text-xs font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1.5">
                      Payment Mode
                    </label>
                    <select
                      id="sms-payment-method-selector"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl px-3.5 py-2 text-xs font-semibold text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden"
                    >
                      <option value="Cash">Cash Counter</option>
                      <option value="EasyPaisa">EasyPaisa</option>
                      <option value="JazzCash">JazzCash</option>
                      <option value="Bank Transfer">Bank Transfer (HBL / NBP / Sindh Bank)</option>
                      <option value="Cheque">Bank Pay Order / Cheque</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="sms-fee-notes-input" className="block text-xs font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1.5">
                      Remarks / Notes (Optional)
                    </label>
                    <input
                      id="sms-fee-notes-input"
                      type="text"
                      placeholder="e.g. Paid in full by father"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      className="w-full bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl px-3.5 py-2 text-xs font-medium text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden"
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
                    className="w-full sm:w-1/2 flex items-center justify-center gap-2 px-4 py-3 bg-[#F3EFEA] hover:bg-[#E7E0D4] dark:bg-[#2C1215] dark:hover:bg-[#4A1C20] text-[#1C1917] dark:text-[#FAF8F5] font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-[#57534E] dark:text-[#D6CCC2]" />
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
                        : remainingDueThisMonth > 0 && numericReceivedNow < remainingDueThisMonth
                        ? 'Record Partial Payment & Print'
                        : surplusAmount > 0
                        ? 'Record Payment + Advance & Print'
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
            <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
                <h3 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  <span>Recent Fee Transactions</span>
                </h3>
                <span className="text-[11px] font-semibold text-[#57534E]">
                  {feePayments.length} recorded
                </span>
              </div>

              {feePayments.length === 0 ? (
                <div className="py-10 text-center text-xs text-[#78716C]">
                  No payment vouchers recorded yet.
                </div>
              ) : (
                <div className="divide-y divide-[#E7E0D4] dark:divide-[rgba(255,253,249,0.10)] max-h-[500px] overflow-y-auto no-scrollbar">
                  {feePayments.slice(0, 12).map((pay) => (
                    <div
                      key={pay.id}
                      className="py-3 flex items-center justify-between text-xs hover:bg-[#FAF8F5] dark:hover:bg-[#3F1014]/40 px-2 rounded-xl transition"
                    >
                      <div>
                        <div className="font-bold text-[#1C1917] dark:text-[#FAF8F5] flex items-center gap-1.5">
                          <span>{pay.studentName}</span>
                          <span className="text-[10px] text-[#78716C]">({pay.grNumber})</span>
                        </div>
                        <div className="text-[11px] text-[#57534E] dark:text-[#D6CCC2] mt-0.5">
                          {pay.monthLabel} · {pay.paymentMethod || 'Cash'} · {pay.receiptNumber || 'RCPT'}
                        </div>
                        {(pay.pendingBalance || 0) > 0 && pay.status === 'partial' && (
                          <div className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            Pending: Rs. {(pay.pendingBalance || 0).toLocaleString()}
                          </div>
                        )}
                        {(pay.advanceGenerated || 0) > 0 && (
                          <div className="text-[10px] font-semibold text-[#C2410C] dark:text-[#FDBA74]">
                            +Rs. {(pay.advanceGenerated || 0).toLocaleString()} Advance ({pay.allocatedNextMonth})
                          </div>
                        )}
                      </div>

                      <div className="text-right flex items-center gap-3">
                        <div>
                          <div className="font-bold text-emerald-600 dark:text-emerald-400">
                            Rs. {pay.paidAmount.toLocaleString()}
                          </div>
                          <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                            pay.status === 'paid'
                              ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                              : pay.status === 'partial'
                              ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                              : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300'
                          }`}>
                            {pay.status}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setActiveVoucherForPrint(pay)}
                          title="Print Receipt"
                          className="p-1.5 bg-[#F3EFEA] hover:bg-emerald-100 dark:bg-[#2C1215] dark:hover:bg-emerald-950 text-[#57534E] hover:text-emerald-700 dark:text-[#E7E0D4] rounded-lg transition cursor-pointer"
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
      {/* TAB 3: BULK FEE VOUCHER GENERATION */}
      {/* =================================================================== */}
      {activeTab === 'bulk' && (
        <div className="space-y-6">
          <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] pb-4">
              <div>
                <h2 className="text-base font-bold text-[#1C1917] dark:text-[#FAF8F5] flex items-center gap-2">
                  <FileCheck2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span>Bulk Class Fee Voucher Generator</span>
                </h2>
                <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-0.5">
                  Select a Class &amp; Section and Billing Month to generate fee vouchers for all enrolled students simultaneously with permanent concessions applied.
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleSaveUnpaidBulkVouchers}
                  disabled={isSavingBulk || generatedBulkVouchers.length === 0}
                  className="px-4 py-2 bg-[#F3EFEA] hover:bg-[#E7E0D4] dark:bg-[#2C1215] dark:hover:bg-[#4A1C20] text-[#1C1917] dark:text-[#FAF8F5] rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingBulk ? 'Saving...' : 'Save Batch to Register'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintAllBulkVouchers}
                  disabled={generatedBulkVouchers.length === 0}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print All Vouchers ({generatedBulkVouchers.length})</span>
                </button>
              </div>
            </div>

            {bulkSaveNotice && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{bulkSaveNotice}</span>
              </div>
            )}

            {/* Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label htmlFor="bulk-class-select" className="block text-xs font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1.5">
                  1. Select Class &amp; Section
                </label>
                <select
                  id="bulk-class-select"
                  value={bulkClassId}
                  disabled={loadingClasses}
                  onChange={(e) => setBulkClassId(e.target.value)}
                  className="w-full bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#1C1917] dark:text-[#FAF8F5] cursor-pointer"
                >
                  <option value="">
                    {loadingClasses
                      ? 'Loading classes...'
                      : classes.length === 0
                      ? '-- No Classes Configured --'
                      : '-- Choose Class --'}
                  </option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.grade} - {c.section || 'General'} ({c.medium})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="bulk-month-select" className="block text-xs font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1.5">
                  2. Billing Month
                </label>
                <select
                  id="bulk-month-select"
                  value={bulkMonth}
                  onChange={(e) => setBulkMonth(e.target.value)}
                  className="w-full bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#1C1917] dark:text-[#FAF8F5] cursor-pointer"
                >
                  {monthOptions.map((opt) => (
                    <option key={opt.val} value={opt.val}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="bulk-due-date" className="block text-xs font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1.5">
                  3. Challan Due Date
                </label>
                <input
                  id="bulk-due-date"
                  type="date"
                  value={bulkDueDate}
                  onChange={(e) => setBulkDueDate(e.target.value)}
                  className="w-full bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#1C1917] dark:text-[#FAF8F5]"
                />
              </div>

              <div>
                <label htmlFor="bulk-voucher-note" className="block text-xs font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1.5">
                  4. Voucher Notice
                </label>
                <input
                  id="bulk-voucher-note"
                  type="text"
                  value={bulkVoucherNote}
                  onChange={(e) => setBulkVoucherNote(e.target.value)}
                  className="w-full bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl px-3.5 py-2.5 text-xs font-medium text-[#1C1917] dark:text-[#FAF8F5]"
                />
              </div>
            </div>

            {/* Batch KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#2C1215]/70 border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
                <span className="text-[10px] font-bold uppercase text-[#57534E] block">Vouchers Ready</span>
                <strong className="text-lg font-bold text-[#1C1917] dark:text-[#FAF8F5]">{generatedBulkVouchers.length} Students</strong>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#2C1215]/70 border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
                <span className="text-[10px] font-bold uppercase text-[#57534E] block">Gross Batch Amount</span>
                <strong className="text-lg font-bold text-[#1C1917] dark:text-[#FAF8F5] font-mono">Rs. {bulkSummary.totalGross.toLocaleString()}</strong>
              </div>
              <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60">
                <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400 block">Concessions ({bulkSummary.discountedCount})</span>
                <strong className="text-lg font-bold text-amber-700 dark:text-amber-300 font-mono">- Rs. {bulkSummary.totalDiscount.toLocaleString()}</strong>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
                <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 block">Total Net Payable</span>
                <strong className="text-lg font-bold text-emerald-700 dark:text-emerald-300 font-mono">Rs. {bulkSummary.totalNet.toLocaleString()}</strong>
              </div>
            </div>
          </div>

          {/* Generated Vouchers Table */}
          <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-2xl overflow-hidden shadow-xs">
            {generatedBulkVouchers.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#57534E]">
                <FileCheck2 className="w-9 h-9 mx-auto text-[#E7E0D4] dark:text-[#A8A29E] mb-2" />
                <p className="font-bold text-sm text-[#44403C] dark:text-[#E7E0D4]">No Active Students in Selected Class</p>
                <p className="text-[#78716C] mt-1">Select a class with active enrolled students to generate batch vouchers.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#FAF8F5] dark:bg-[#2C1215]/60 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-[#57534E] dark:text-[#E7E0D4] font-bold uppercase text-[10px]">
                      <th className="py-3 px-4">Voucher #</th>
                      <th className="py-3 px-4">GR No</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Gross Fee</th>
                      <th className="py-3 px-4">Applied Concession</th>
                      <th className="py-3 px-4">Net Payable</th>
                      <th className="py-3 px-4">Paid / Balance</th>
                      <th className="py-3 px-4 text-right">Preview</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E0D4] dark:divide-[rgba(255,253,249,0.10)]">
                    {generatedBulkVouchers.map((v) => (
                      <tr key={v.id} className="hover:bg-[#FAF8F5]/60 dark:hover:bg-[#3F1014]/40">
                        <td className="py-3 px-4 font-mono font-bold text-[#7F1D1D] dark:text-[#FCA5A5]">{v.receiptNumber}</td>
                        <td className="py-3 px-4 font-mono font-bold">{v.grNumber}</td>
                        <td className="py-3 px-4 font-bold text-[#1C1917] dark:text-[#FAF8F5]">{v.studentName}</td>
                        <td className="py-3 px-4 font-mono">Rs. {(v.baseAmount + v.customChargesAmount).toLocaleString()}</td>
                        <td className="py-3 px-4">
                          {v.discount > 0 ? (
                            <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold text-[10px] border border-amber-200 dark:border-amber-800">
                              {v.concessionTitle ? `${v.concessionTitle}: ` : ''}-Rs. {v.discount.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-[#78716C]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          Rs. {v.netAmount.toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          {v.status === 'paid' ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-bold uppercase text-[10px]">
                              Paid
                            </span>
                          ) : v.status === 'partial' ? (
                            <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 font-bold text-[10px]">
                              Partial (Due Rs. {(v.pendingBalance || 0).toLocaleString()})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 font-bold uppercase text-[10px]">
                              Unpaid (Due Rs. {(v.pendingBalance ?? v.netAmount).toLocaleString()})
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setActiveVoucherForPrint(v)}
                            className="px-2.5 py-1 bg-[#F3EFEA] hover:bg-emerald-100 dark:bg-[#2C1215] dark:hover:bg-emerald-950 text-[#44403C] dark:text-[#FAF8F5] rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3 h-3" />
                            <span>View</span>
                          </button>
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

      {/* =================================================================== */}
      {/* TAB 4: FEE DISCOUNTS & CONCESSIONS (ADMIN ONLY) */}
      {/* =================================================================== */}
      {activeTab === 'concessions' && (canManageFeeStructure || isSuperAdmin) && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 5 Cols: Create / Edit Rule + Quick Presets */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-6 shadow-xs space-y-4">
                <div className="border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] pb-3">
                  <h2 className="text-base font-bold text-[#1C1917] dark:text-[#FAF8F5] flex items-center gap-2">
                    <Tag className="w-5 h-5 text-amber-500" />
                    <span>{editingRuleId ? 'Edit Fee Concession Rule' : 'Create Fee Discount Rule'}</span>
                  </h2>
                  <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-0.5">
                    Define institutional scholarship and fee concession categories for students.
                  </p>
                </div>

                {/* Quick 1-Click Standard Presets */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C] block">
                    Quick SELD Presets
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAddPresetConcession('Orphan Discount', 'percentage', 50, '50% fee concession for orphan students')}
                      className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-bold cursor-pointer"
                    >
                      + Orphan Discount (50%)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddPresetConcession('Staff Child', 'percentage', 100, '100% tuition waiver for school staff children')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold cursor-pointer"
                    >
                      + Staff Child (100%)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddPresetConcession('Merit Scholarship', 'percentage', 25, '25% academic merit scholarship')}
                      className="px-2.5 py-1 rounded-lg bg-[#FEF2F2] hover:bg-[#FEE2E2] dark:bg-[#3F1014]/50 text-[#7F1D1D] dark:text-[#FCA5A5] border border-[#FECACA] dark:border-[#7F1D1D]/60 text-[11px] font-bold cursor-pointer"
                    >
                      + Merit Scholarship (25%)
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSaveConcessionForm} className="space-y-3 pt-2 border-t border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
                  <div>
                    <label className="block text-xs font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                      Discount Rule Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Orphan Discount or Sibling Waiver"
                      value={ruleTitle}
                      onChange={(e) => setRuleTitle(e.target.value)}
                      className="w-full px-3.5 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs font-semibold text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                        Discount Type
                      </label>
                      <select
                        value={ruleType}
                        onChange={(e) => setRuleType(e.target.value as ConcessionDiscountType)}
                        className="w-full px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs font-semibold text-[#1C1917] dark:text-[#FAF8F5]"
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed Amount (PKR)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                        {ruleType === 'percentage' ? 'Percentage (%)' : 'Amount (PKR)'}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={ruleType === 'percentage' ? 100 : undefined}
                        required
                        value={ruleValue}
                        onChange={(e) => setRuleValue(parseInt(e.target.value, 10) || 0)}
                        className="w-full px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs font-bold text-[#1C1917] dark:text-[#FAF8F5] font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                      Policy Description (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Applicable upon Principal verification"
                      value={ruleDescription}
                      onChange={(e) => setRuleDescription(e.target.value)}
                      className="w-full px-3.5 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5]"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    {editingRuleId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRuleId(null);
                          setRuleTitle('');
                          setRuleValue(50);
                          setRuleDescription('');
                        }}
                        className="px-4 py-2 bg-[#F3EFEA] dark:bg-[#2C1215] text-[#44403C] dark:text-[#E7E0D4] rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={isSavingRule || !ruleTitle.trim() || ruleValue <= 0}
                      className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                    >
                      {isSavingRule ? 'Saving Rule...' : editingRuleId ? 'Update Discount Rule' : 'Save Discount Rule'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Assign Concession Permanently to a Student */}
              <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-6 shadow-xs space-y-4">
                <div className="border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] pb-3">
                  <h3 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5] flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#7F1D1D]" />
                    <span>Assign Permanent Discount to Student</span>
                  </h3>
                  <p className="text-[11px] text-[#57534E] mt-0.5">
                    Select a student and link a concession rule permanently to auto-calculate future vouchers.
                  </p>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">Filter by Class</label>
                    <select
                      value={assignClassFilter}
                      onChange={(e) => {
                        setAssignClassFilter(e.target.value);
                        setAssignStudentId('');
                      }}
                      className="w-full px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl font-semibold"
                    >
                      <option value="ALL">All Classes ({classes.length})</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.grade} - {c.section}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">Select Student</label>
                    <select
                      value={assignStudentId}
                      onChange={(e) => {
                        setAssignStudentId(e.target.value);
                        const stu = students.find((s) => s.id === e.target.value);
                        setAssignRuleId(stu?.concessionId || '');
                      }}
                      className="w-full px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl font-semibold"
                    >
                      <option value="">-- Choose Enrolled Student --</option>
                      {students
                        .filter((s) => s.status === 'active' && (assignClassFilter === 'ALL' || s.classId === assignClassFilter))
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.grNumber} · {s.fullName} ({s.grade})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">Discount Rule</label>
                    <select
                      value={assignRuleId}
                      onChange={(e) => setAssignRuleId(e.target.value)}
                      className="w-full px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl font-semibold"
                    >
                      <option value="">-- No Discount (Remove Concession) --</option>
                      {feeConcessions
                        .filter((r) => r.isActive !== false)
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.title} ({r.discountType === 'fixed' ? `Rs.${r.value}` : `${r.value}%`})
                          </option>
                        ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleAssignConcessionToStudent}
                    disabled={!assignStudentId}
                    className="w-full py-2.5 bg-[#7F1D1D] hover:bg-[#651414] text-white font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    Apply Permanent Concession
                  </button>
                </div>
              </div>
            </div>

            {/* Right 7 Cols: Existing Concession Rules & Assigned Students */}
            <div className="lg:col-span-7 space-y-6">
              {concessionNotice && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{concessionNotice}</span>
                </div>
              )}

              <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-2xl overflow-hidden shadow-xs">
                <div className="px-5 py-4 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5] flex items-center gap-2">
                    <Percent className="w-4 h-4 text-emerald-600" />
                    <span>Configured Discount Rules ({feeConcessions.length})</span>
                  </h3>
                </div>

                {feeConcessions.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#57534E]">
                    <Tag className="w-9 h-9 mx-auto text-[#E7E0D4] dark:text-[#A8A29E] mb-2" />
                    <p className="font-bold text-sm text-[#44403C] dark:text-[#E7E0D4]">No Concession Rules Created Yet</p>
                    <p className="text-[#78716C] mt-1">Use the presets or create a custom discount rule on the left.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#E7E0D4] dark:divide-[rgba(255,253,249,0.10)]">
                    {feeConcessions.map((rule) => {
                      const assignedCount = students.filter((s) => s.concessionId === rule.id).length;
                      return (
                        <div key={rule.id} className="p-4 flex items-center justify-between gap-4 hover:bg-[#FAF8F5]/50 dark:hover:bg-[#3F1014]/30">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-[#1C1917] dark:text-[#FAF8F5]">{rule.title}</span>
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-mono">
                                {rule.discountType === 'fixed' ? `Rs. ${rule.value} OFF` : `${rule.value}% OFF`}
                              </span>
                              <span className="text-[10px] font-semibold text-[#7F1D1D] dark:text-[#FCA5A5] bg-[#FEF2F2] dark:bg-[#3F1014]/60 px-2 py-0.5 rounded">
                                {assignedCount} student{assignedCount !== 1 ? 's' : ''}
                              </span>
                            </div>
                            {rule.description && (
                              <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-1">{rule.description}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRuleId(rule.id);
                                setRuleTitle(rule.title);
                                setRuleType(rule.discountType);
                                setRuleValue(rule.value);
                                setRuleDescription(rule.description || '');
                              }}
                              className="p-2 text-[#78716C] hover:text-[#651414] hover:bg-[#F3EFEA] dark:hover:bg-[#3F1014] rounded-lg transition cursor-pointer"
                              title="Edit Rule"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteFeeConcessionRule(rule.id)}
                              className="p-2 text-[#78716C] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                              title="Delete Rule"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* List of Students Currently Receiving Permanent Concessions */}
              <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-2xl overflow-hidden shadow-xs">
                <div className="px-5 py-3.5 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#44403C] dark:text-[#FAF8F5]">
                    Students With Active Permanent Concessions
                  </h3>
                  <span className="text-[11px] font-semibold text-amber-600">
                    {students.filter((s) => s.concessionTitle && (s.concessionValue || 0) > 0).length} enrolled
                  </span>
                </div>
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#FAF8F5] dark:bg-[#2C1215]/60 text-[#57534E] font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-4">GR No</th>
                        <th className="py-2.5 px-4">Student Name</th>
                        <th className="py-2.5 px-4">Class</th>
                        <th className="py-2.5 px-4">Concession Rule</th>
                        <th className="py-2.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7E0D4] dark:divide-[rgba(255,253,249,0.10)]">
                      {students.filter((s) => s.concessionTitle && (s.concessionValue || 0) > 0).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-xs text-[#78716C]">
                            No students currently have permanent fee concessions assigned.
                          </td>
                        </tr>
                      ) : (
                        students
                          .filter((s) => s.concessionTitle && (s.concessionValue || 0) > 0)
                          .map((stu) => (
                            <tr key={stu.id} className="hover:bg-[#FAF8F5]/50 dark:hover:bg-[#3F1014]/40">
                              <td className="py-2.5 px-4 font-mono font-bold">{stu.grNumber}</td>
                              <td className="py-2.5 px-4 font-bold text-[#1C1917] dark:text-[#FAF8F5]">{stu.fullName}</td>
                              <td className="py-2.5 px-4">{stu.grade} - {stu.section}</td>
                              <td className="py-2.5 px-4">
                                <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 font-bold text-[10px]">
                                  {stu.concessionTitle} ({stu.concessionType === 'fixed' ? `Rs.${stu.concessionValue}` : `${stu.concessionValue}%`})
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => applyStudentConcession(stu.id, null)}
                                  className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
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
            <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#57534E] dark:text-[#D6CCC2] uppercase tracking-wider">
                  Total Collected
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-xl font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                Rs. {kpiStats.totalCollected.toLocaleString()}
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
                {kpiStats.paidCount} students cleared
              </div>
            </div>

            {/* KPI 2: Total Pending Due */}
            <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#57534E] dark:text-[#D6CCC2] uppercase tracking-wider">
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
            <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#57534E] dark:text-[#D6CCC2] uppercase tracking-wider">
                  Collection Rate
                </span>
                <div className="w-8 h-8 rounded-xl bg-[#FEF2F2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5] flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-xl font-bold text-[#7F1D1D] dark:text-[#FCA5A5]">
                {kpiStats.collectionRate}%
              </div>
              <div className="text-[11px] text-[#57534E] dark:text-[#D6CCC2] mt-0.5 font-medium">
                {currentMonthLabel}
              </div>
            </div>

            {/* KPI 4: Active Enrollment */}
            <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#57534E] dark:text-[#D6CCC2] uppercase tracking-wider">
                  Enrolled Students
                </span>
                <div className="w-8 h-8 rounded-xl bg-[#FFF7ED] dark:bg-[#7C2D12]/60 text-[#C2410C] dark:text-[#FDBA74] flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-xl font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                {kpiStats.totalStudentsCount}
              </div>
              <div className="text-[11px] text-[#57534E] dark:text-[#D6CCC2] mt-0.5 font-medium">
                Active SIS Records
              </div>
            </div>
          </div>

          {/* Filter Bar & Sub-Tabs (Defaulters vs Paid) */}
          <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setDefaulterViewMode('defaulters')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  defaulterViewMode === 'defaulters'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-[#F3EFEA] dark:bg-[#2C1215] text-[#57534E] dark:text-[#E7E0D4]'
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
                    : 'bg-[#F3EFEA] dark:bg-[#2C1215] text-[#57534E] dark:text-[#E7E0D4]'
                }`}
              >
                Paid Roster ({paidList.length})
              </button>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              {/* Class Filter */}
              <div className="flex items-center gap-1.5 bg-[#FAF8F5] dark:bg-[#2C1215] px-3 py-1.5 rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] w-full sm:w-auto">
                <Filter className="w-3.5 h-3.5 text-[#78716C] shrink-0" />
                <label htmlFor="sms-fee-defaulter-class-filter" className="sr-only">Filter by Class</label>
                <select
                  id="sms-fee-defaulter-class-filter"
                  value={defaulterClassFilter}
                  onChange={(e) => setDefaulterClassFilter(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-[#44403C] dark:text-[#E7E0D4] focus:outline-hidden cursor-pointer"
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
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#78716C]" />
                <input
                  type="text"
                  placeholder="Search GR or Name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Table: Defaulters View */}
          {defaulterViewMode === 'defaulters' && (
            <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-2xl overflow-hidden shadow-xs">
              {defaultersList.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#57534E]">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="font-bold text-sm text-[#1C1917] dark:text-[#FAF8F5]">
                    No Fee Defaulters!
                  </p>
                  <p className="text-[#78716C] mt-1">
                    All students in the selected class have paid their dues for {currentMonthLabel}.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#FAF8F5] dark:bg-[#2C1215]/60 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-[#57534E] dark:text-[#E7E0D4] font-bold uppercase text-[11px] tracking-wider">
                        <th className="py-3 px-4">GR Number</th>
                        <th className="py-3 px-4">Student &amp; Parent</th>
                        <th className="py-3 px-4">Class &amp; Section</th>
                        <th className="py-3 px-4">Guardian Contact</th>
                        <th className="py-3 px-4">Pending Due (PKR)</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Quick Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7E0D4] dark:divide-[rgba(255,253,249,0.10)] text-[#44403C] dark:text-[#E7E0D4]">
                      {defaultersList.map(({ student, expectedFee }) => {
                        const partialRec = paymentsInMonth.find(
                          (p) => p.studentId === student.id && p.status === 'partial'
                        );
                        return (
                        <tr
                          key={student.id}
                          className="hover:bg-[#FAF8F5]/60 dark:hover:bg-[#3F1014]/40 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-mono font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                            {student.grNumber}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                              {student.fullName}
                            </div>
                            <div className="text-[11px] text-[#78716C]">
                              s/o {student.fatherName}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-semibold">
                            {student.grade} - {student.section || 'General'}
                          </td>
                          <td className="py-3.5 px-4 text-[#57534E]">
                            {student.guardianPhone || 'N/A'}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-red-600 dark:text-red-400">
                            Rs. {expectedFee.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4">
                            {partialRec ? (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                Partial (Paid Rs. {(partialRec.paidAmount || 0).toLocaleString()})
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                                Unpaid ({currentMonthLabel})
                              </span>
                            )}
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
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Table: Paid Roster View */}
          {defaulterViewMode === 'paid' && (
            <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-2xl overflow-hidden shadow-xs">
              {paidList.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#57534E]">
                  <AlertCircle className="w-10 h-10 text-[#78716C] mx-auto mb-2 opacity-60" />
                  <p className="font-bold text-sm text-[#1C1917] dark:text-[#FAF8F5]">
                    No Paid Records for {currentMonthLabel}
                  </p>
                  <p className="text-[#78716C] mt-1">
                    Collect fees using the "Collect Fee &amp; Vouchers" tab.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#FAF8F5] dark:bg-[#2C1215]/60 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-[#57534E] dark:text-[#E7E0D4] font-bold uppercase text-[11px] tracking-wider">
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
                    <tbody className="divide-y divide-[#E7E0D4] dark:divide-[rgba(255,253,249,0.10)] text-[#44403C] dark:text-[#E7E0D4]">
                      {paidList.map((pay) => (
                        <tr
                          key={pay.id}
                          className="hover:bg-[#FAF8F5]/60 dark:hover:bg-[#3F1014]/40 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-mono font-bold text-[#7F1D1D] dark:text-[#FCA5A5]">
                            {pay.receiptNumber || 'RCPT'}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                            {pay.grNumber}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                            {pay.studentName}
                          </td>
                          <td className="py-3.5 px-4 font-semibold">
                            {pay.grade} - {pay.section || 'General'}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                            Rs. {pay.paidAmount.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-[#57534E] dark:text-[#E7E0D4]">
                            {pay.paymentMethod || 'Cash'}
                          </td>
                          <td className="py-3.5 px-4 text-[#78716C]">
                            {pay.paymentDate
                              ? new Date(pay.paymentDate).toLocaleDateString('en-GB')
                              : 'N/A'}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => setActiveVoucherForPrint(pay)}
                              className="px-2.5 py-1.5 bg-[#F3EFEA] hover:bg-emerald-100 dark:bg-[#2C1215] dark:hover:bg-emerald-950 text-[#44403C] dark:text-[#E7E0D4] rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer"
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
      {/* TAB 4: FINANCIAL REPORTS & EXPORTS (Daily, Monthly, Defaulters) */}
      {/* =================================================================== */}
      {activeTab === 'reports' && canAccessReports && (
        <div className="space-y-6">
          {/* Controls & Export Bar */}
          <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] pb-4">
              <div>
                <h2 className="text-base font-bold text-[#1C1917] dark:text-[#FAF8F5] flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span>Financial Collection &amp; Defaulters Reports</span>
                </h2>
                <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-0.5">
                  {isSuperAdmin
                    ? 'View aggregated metrics across all schools or filter by an individual school.'
                    : `Filtered strictly for ${activeSchool.name} (SEMIS: ${activeSchool.semisCode || 'N/A'}).`}
                </p>
              </div>

              {/* Export Buttons */}
              <div className="flex items-center gap-2.5 flex-wrap">
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={loadAggregatedReportsData}
                    disabled={loadingReports}
                    className="px-3 py-2 bg-[#F3EFEA] hover:bg-[#E7E0D4] dark:bg-[#2C1215] dark:hover:bg-[#4A1C20] text-[#44403C] dark:text-[#FAF8F5] rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingReports ? 'animate-spin' : ''}`} />
                    <span>{loadingReports ? 'Syncing...' : 'Refresh All Schools'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleExportReportCsv}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Export Excel (CSV)</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportReportPdf}
                  className="px-4 py-2 bg-[#7F1D1D] hover:bg-[#651414] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Export / Print PDF</span>
                </button>
              </div>
            </div>

            {/* Report Type Sub-Tabs + Filters */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              {/* Report Type Switcher */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setReportType('daily')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    reportType === 'daily'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-[#F3EFEA] dark:bg-[#2C1215] text-[#57534E] dark:text-[#E7E0D4] hover:bg-[#E7E0D4] dark:hover:bg-[#4A1C20]'
                  }`}
                >
                  Daily Collection
                </button>
                <button
                  type="button"
                  onClick={() => setReportType('monthly')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    reportType === 'monthly'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-[#F3EFEA] dark:bg-[#2C1215] text-[#57534E] dark:text-[#E7E0D4] hover:bg-[#E7E0D4] dark:hover:bg-[#4A1C20]'
                  }`}
                >
                  Monthly Collection
                </button>
                <button
                  type="button"
                  onClick={() => setReportType('defaulters')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    reportType === 'defaulters'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-[#F3EFEA] dark:bg-[#2C1215] text-[#57534E] dark:text-[#E7E0D4] hover:bg-[#E7E0D4] dark:hover:bg-[#4A1C20]'
                  }`}
                >
                  Defaulters List
                </button>
                <button
                  type="button"
                  onClick={() => setReportType('discounts')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    reportType === 'discounts'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-[#F3EFEA] dark:bg-[#2C1215] text-[#57534E] dark:text-[#E7E0D4] hover:bg-[#E7E0D4] dark:hover:bg-[#4A1C20]'
                  }`}
                >
                  Discount Summary
                </button>
                <button
                  type="button"
                  onClick={() => setReportType('partial')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    reportType === 'partial'
                      ? 'bg-[#7F1D1D] text-white shadow-xs'
                      : 'bg-[#F3EFEA] dark:bg-[#2C1215] text-[#57534E] dark:text-[#E7E0D4] hover:bg-[#E7E0D4] dark:hover:bg-[#4A1C20]'
                  }`}
                >
                  Partial Payments Report
                </button>
              </div>

              {/* Filter Controls */}
              <div className="flex items-center gap-2.5 flex-wrap">
                {isSuperAdmin && (
                  <div className="flex items-center gap-1.5 bg-[#FAF8F5] dark:bg-[#2C1215] px-3 py-1.5 rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
                    <Building className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <label htmlFor="report-school-scope" className="sr-only">School Scope</label>
                    <select
                      id="report-school-scope"
                      value={reportSchoolScope}
                      onChange={(e) => {
                        setReportSchoolScope(e.target.value);
                        setReportClassFilter('ALL');
                      }}
                      className="bg-transparent text-xs font-bold text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden cursor-pointer max-w-[220px]"
                    >
                      <option value="ALL">All Schools (Aggregated)</option>
                      {(registeredSchools.length > 0 ? registeredSchools : [activeSchool]).map((sch) => (
                        <option key={sch.id} value={sch.id}>
                          {sch.name} ({sch.semisCode || 'N/A'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {reportType === 'daily' ? (
                  <div className="flex items-center gap-1.5 bg-[#FAF8F5] dark:bg-[#2C1215] px-3 py-1.5 rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
                    <Calendar className="w-3.5 h-3.5 text-[#78716C] shrink-0" />
                    <label htmlFor="report-date-picker" className="sr-only">Select Date</label>
                    <input
                      id="report-date-picker"
                      type="date"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                      className="bg-transparent text-xs font-bold text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden cursor-pointer"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 bg-[#FAF8F5] dark:bg-[#2C1215] px-3 py-1.5 rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
                    <Calendar className="w-3.5 h-3.5 text-[#78716C] shrink-0" />
                    <label htmlFor="report-month-picker" className="sr-only">Select Month</label>
                    <select
                      id="report-month-picker"
                      value={reportMonth}
                      onChange={(e) => setReportMonth(e.target.value)}
                      className="bg-transparent text-xs font-bold text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden cursor-pointer"
                    >
                      {monthOptions.map((opt) => (
                        <option key={opt.val} value={opt.val} className="dark:bg-[#211415]">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Class filter (when viewing a single active school) */}
                {(!isSuperAdmin || reportSchoolScope === activeSchool.id) && (
                  <div className="flex items-center gap-1.5 bg-[#FAF8F5] dark:bg-[#2C1215] px-3 py-1.5 rounded-xl border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
                    <Filter className="w-3.5 h-3.5 text-[#78716C] shrink-0" />
                    <label htmlFor="report-class-filter" className="sr-only">Filter by Class</label>
                    <select
                      id="report-class-filter"
                      value={reportClassFilter}
                      onChange={(e) => setReportClassFilter(e.target.value)}
                      className="bg-transparent text-xs font-semibold text-[#44403C] dark:text-[#E7E0D4] focus:outline-hidden cursor-pointer"
                    >
                      <option value="ALL">All Classes ({classes.length})</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.grade} - {c.section || 'General'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Summary KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-bold text-[#57534E] dark:text-[#D6CCC2] uppercase tracking-wider">
                {reportType === 'daily' ? `Collected (${reportDate})` : `Total Collected (${reportMonthLabel})`}
              </div>
              <div className="mt-2 text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                Rs.{' '}
                {(reportType === 'daily'
                  ? reportData.totals.totalDailyCollected
                  : reportData.totals.totalMonthlyCollected
                ).toLocaleString()}
              </div>
              <div className="text-[11px] text-[#57534E] mt-0.5">
                {reportType === 'daily'
                  ? `${reportData.dailyPayments.length} receipt(s) on date`
                  : `${reportData.totals.totalPaidCount} student(s) paid`}
              </div>
            </div>

            <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-bold text-[#57534E] dark:text-[#D6CCC2] uppercase tracking-wider">
                Total Pending ({reportMonthLabel})
              </div>
              <div className="mt-2 text-xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                Rs. {reportData.totals.totalPending.toLocaleString()}
              </div>
              <div className="text-[11px] text-rose-500 mt-0.5">
                {reportData.totals.totalDefaultersCount} unpaid student(s)
              </div>
            </div>

            <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-bold text-[#57534E] dark:text-[#D6CCC2] uppercase tracking-wider">
                {reportType === 'discounts'
                  ? `Discounts Granted (${reportMonthLabel})`
                  : reportType === 'partial'
                  ? 'Partial Pending Balances'
                  : 'Collection Rate'}
              </div>
              <div className="mt-2 text-xl font-bold text-[#7F1D1D] dark:text-[#FCA5A5] tabular-nums">
                {reportType === 'discounts'
                  ? `Rs. ${reportData.totals.totalDiscountsGranted.toLocaleString()}`
                  : reportType === 'partial'
                  ? `Rs. ${reportData.totals.totalPartialPending.toLocaleString()}`
                  : `${reportData.totals.overallCollectionRate}%`}
              </div>
              <div className="text-[11px] text-[#57534E] mt-0.5">
                {reportType === 'discounts'
                  ? `${reportData.discountRows.length} discounted student(s)`
                  : reportType === 'partial'
                  ? `${reportData.partialPaymentRows.length} partial entry(s)`
                  : `Out of ${reportData.totals.totalActiveStudents} active students`}
              </div>
            </div>

            <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-bold text-[#57534E] dark:text-[#D6CCC2] uppercase tracking-wider">
                Report Scope
              </div>
              <div className="mt-2 text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5] truncate" title={reportScopeLabel}>
                {isSuperAdmin && reportSchoolScope === 'ALL'
                  ? `${reportData.targetDatasets.length} Registered Schools`
                  : activeSchool.name}
              </div>
              <div className="text-[11px] text-[#57534E] mt-1">
                {isSuperAdmin && reportSchoolScope === 'ALL' ? 'Super Admin Aggregated' : `SEMIS: ${activeSchool.semisCode || 'N/A'}`}
              </div>
            </div>
          </div>

          {/* Super Admin School-by-School Aggregated Summary Table */}
          {isSuperAdmin && reportSchoolScope === 'ALL' && reportData.schoolSummaries.length > 0 && (
            <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-2xl overflow-hidden shadow-xs">
              <div className="px-5 py-3.5 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#44403C] dark:text-[#FAF8F5]">
                  School-Wise Aggregated Financial Breakdown ({reportType === 'daily' ? reportDate : reportMonthLabel})
                </h3>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  {reportData.schoolSummaries.length} Schools
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#FAF8F5] dark:bg-[#2C1215]/60 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-[#57534E] dark:text-[#E7E0D4] font-bold uppercase text-[10px]">
                      <th className="py-3 px-4">School &amp; SEMIS</th>
                      <th className="py-3 px-4">District</th>
                      <th className="py-3 px-4">Active Students</th>
                      <th className="py-3 px-4">Paid</th>
                      <th className="py-3 px-4">Pending</th>
                      <th className="py-3 px-4 text-right">
                        {reportType === 'daily' ? 'Daily Collected' : 'Monthly Collected'}
                      </th>
                      <th className="py-3 px-4 text-right">Total Pending</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E0D4] dark:divide-[rgba(255,253,249,0.10)]">
                    {reportData.schoolSummaries.map((s) => (
                      <tr key={s.schoolId} className="hover:bg-[#FAF8F5]/60 dark:hover:bg-[#3F1014]/40">
                        <td className="py-3 px-4">
                          <div className="font-bold text-[#1C1917] dark:text-[#FAF8F5]">{s.schoolName}</div>
                          <div className="text-[10px] font-mono text-[#78716C]">SEMIS: {s.semisCode || 'N/A'}</div>
                        </td>
                        <td className="py-3 px-4 text-[#57534E] dark:text-[#E7E0D4]">{s.district || 'Sindh'}</td>
                        <td className="py-3 px-4 font-semibold">{s.activeStudentsCount}</td>
                        <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">{s.paidCount}</td>
                        <td className="py-3 px-4 text-rose-600 dark:text-rose-400 font-bold">{s.defaultersCount}</td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          Rs. {(reportType === 'daily' ? s.dailyCollected : s.monthlyCollected).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-rose-600 dark:text-rose-400">
                          Rs. {s.totalPending.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Detailed Report Table */}
          <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4]/80 dark:border-[rgba(255,253,249,0.14)] rounded-2xl overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                {reportType === 'daily'
                  ? `Daily Fee Collection Ledger — ${reportDate}`
                  : reportType === 'monthly'
                  ? `Monthly Fee Collection Ledger — ${reportMonthLabel}`
                  : reportType === 'discounts'
                  ? `Discount & Concessions Summary — ${reportMonthLabel}`
                  : reportType === 'partial'
                  ? `Partial Payments & Pending Balance Report — ${reportMonthLabel}`
                  : `Fee Defaulters List — ${reportMonthLabel}`}
              </h3>
              <span className="text-[11px] font-semibold text-[#57534E]">
                {reportType === 'daily'
                  ? `${reportData.dailyPayments.length} record(s)`
                  : reportType === 'monthly'
                  ? `${reportData.monthlyPayments.length} record(s)`
                  : reportType === 'discounts'
                  ? `${reportData.discountRows.length} discounted student(s)`
                  : reportType === 'partial'
                  ? `${reportData.partialPaymentRows.length} partial payment(s)`
                  : `${reportData.defaulterRows.length} student(s)`}
              </span>
            </div>

            {/* 1. Daily Fee Collection Table */}
            {reportType === 'daily' && (
              reportData.dailyPayments.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#57534E]">
                  <Receipt className="w-9 h-9 mx-auto text-[#E7E0D4] dark:text-[#A8A29E] mb-2" />
                  <p className="font-bold text-sm text-[#44403C] dark:text-[#E7E0D4]">
                    No collections recorded on {reportDate}
                  </p>
                  <p className="text-[#78716C] mt-1">
                    Select another date above or record payments in "2. Collect Fee &amp; Vouchers".
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#FAF8F5] dark:bg-[#2C1215]/60 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-[#57534E] dark:text-[#E7E0D4] font-bold uppercase text-[10px]">
                        <th className="py-3 px-4">Receipt No</th>
                        {isSuperAdmin && <th className="py-3 px-4">School</th>}
                        <th className="py-3 px-4">GR No</th>
                        <th className="py-3 px-4">Student Name</th>
                        <th className="py-3 px-4">Class</th>
                        <th className="py-3 px-4">Fee Month</th>
                        <th className="py-3 px-4">Method</th>
                        <th className="py-3 px-4 text-right">Amount Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7E0D4] dark:divide-[rgba(255,253,249,0.10)]">
                      {reportData.dailyPayments.map((p) => (
                        <tr key={p.id} className="hover:bg-[#FAF8F5]/60 dark:hover:bg-[#3F1014]/40">
                          <td className="py-3 px-4 font-mono font-bold text-[#7F1D1D] dark:text-[#FCA5A5]">
                            {p.receiptNumber || 'RCPT'}
                          </td>
                          {isSuperAdmin && (
                            <td className="py-3 px-4 text-[#57534E] dark:text-[#E7E0D4] max-w-[180px] truncate">
                              {p.schoolName}
                            </td>
                          )}
                          <td className="py-3 px-4 font-mono font-bold">{p.grNumber}</td>
                          <td className="py-3 px-4 font-bold text-[#1C1917] dark:text-[#FAF8F5]">{p.studentName}</td>
                          <td className="py-3 px-4">{p.grade} - {p.section || 'General'}</td>
                          <td className="py-3 px-4">{p.monthLabel}</td>
                          <td className="py-3 px-4">{p.paymentMethod || 'Cash'}</td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            Rs. {Number(p.paidAmount || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* 2. Monthly Fee Collection Table */}
            {reportType === 'monthly' && (
              reportData.monthlyPayments.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#57534E]">
                  <Calendar className="w-9 h-9 mx-auto text-[#E7E0D4] dark:text-[#A8A29E] mb-2" />
                  <p className="font-bold text-sm text-[#44403C] dark:text-[#E7E0D4]">
                    No fee collections found for {reportMonthLabel}
                  </p>
                  <p className="text-[#78716C] mt-1">
                    Try choosing a different billing month or collecting fees in Tab 2.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#FAF8F5] dark:bg-[#2C1215]/60 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-[#57534E] dark:text-[#E7E0D4] font-bold uppercase text-[10px]">
                        <th className="py-3 px-4">Receipt No</th>
                        <th className="py-3 px-4">Date</th>
                        {isSuperAdmin && <th className="py-3 px-4">School</th>}
                        <th className="py-3 px-4">GR No</th>
                        <th className="py-3 px-4">Student Name</th>
                        <th className="py-3 px-4">Class</th>
                        <th className="py-3 px-4">Method</th>
                        <th className="py-3 px-4 text-right">Amount Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7E0D4] dark:divide-[rgba(255,253,249,0.10)]">
                      {reportData.monthlyPayments.map((p) => (
                        <tr key={p.id} className="hover:bg-[#FAF8F5]/60 dark:hover:bg-[#3F1014]/40">
                          <td className="py-3 px-4 font-mono font-bold text-[#7F1D1D] dark:text-[#FCA5A5]">
                            {p.receiptNumber || 'RCPT'}
                          </td>
                          <td className="py-3 px-4 text-[#57534E]">
                            {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-GB') : 'N/A'}
                          </td>
                          {isSuperAdmin && (
                            <td className="py-3 px-4 text-[#57534E] dark:text-[#E7E0D4] max-w-[180px] truncate">
                              {p.schoolName}
                            </td>
                          )}
                          <td className="py-3 px-4 font-mono font-bold">{p.grNumber}</td>
                          <td className="py-3 px-4 font-bold text-[#1C1917] dark:text-[#FAF8F5]">{p.studentName}</td>
                          <td className="py-3 px-4">{p.grade} - {p.section || 'General'}</td>
                          <td className="py-3 px-4">{p.paymentMethod || 'Cash'}</td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            Rs. {Number(p.paidAmount || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* 3. Defaulters List Table */}
            {reportType === 'defaulters' && (
              reportData.defaulterRows.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#57534E]">
                  <CheckCircle2 className="w-9 h-9 mx-auto text-emerald-500 mb-2" />
                  <p className="font-bold text-sm text-[#44403C] dark:text-[#E7E0D4]">
                    Zero Defaulters for {reportMonthLabel}!
                  </p>
                  <p className="text-[#78716C] mt-1">
                    All active students in scope have cleared their dues.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#FAF8F5] dark:bg-[#2C1215]/60 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-[#57534E] dark:text-[#E7E0D4] font-bold uppercase text-[10px]">
                        {isSuperAdmin && <th className="py-3 px-4">School</th>}
                        <th className="py-3 px-4">GR No</th>
                        <th className="py-3 px-4">Student &amp; Father Name</th>
                        <th className="py-3 px-4">Class &amp; Section</th>
                        <th className="py-3 px-4">Guardian Phone</th>
                        <th className="py-3 px-4 text-right">Pending Due (PKR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7E0D4] dark:divide-[rgba(255,253,249,0.10)]">
                      {reportData.defaulterRows.map((row) => (
                        <tr key={`${row.schoolId}_${row.student.id}`} className="hover:bg-[#FAF8F5]/60 dark:hover:bg-[#3F1014]/40">
                          {isSuperAdmin && (
                            <td className="py-3 px-4 text-[#57534E] dark:text-[#E7E0D4] max-w-[180px] truncate">
                              {row.schoolName}
                            </td>
                          )}
                          <td className="py-3 px-4 font-mono font-bold">{row.student.grNumber}</td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-[#1C1917] dark:text-[#FAF8F5]">{row.student.fullName}</div>
                            <div className="text-[10px] text-[#78716C]">s/o {row.student.fatherName}</div>
                          </td>
                          <td className="py-3 px-4">{row.student.grade} - {row.student.section || 'General'}</td>
                          <td className="py-3 px-4 font-mono text-[#57534E]">{row.student.guardianPhone || 'N/A'}</td>
                          <td className="py-3 px-4 text-right font-bold text-rose-600 dark:text-rose-400">
                            Rs. {row.expectedFee.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* 4. Discount Summary Report Table */}
            {reportType === 'discounts' && (
              <div className="space-y-4">
                {reportData.discountRuleSummary.length > 0 && (
                  <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border-b border-amber-100 dark:border-amber-900/40 flex flex-wrap gap-2.5">
                    {reportData.discountRuleSummary.map((ruleStat) => (
                      <div
                        key={ruleStat.title}
                        className="px-3 py-2 rounded-xl bg-[#FFFDF9] dark:bg-[#211415] border border-amber-200 dark:border-amber-800 text-xs"
                      >
                        <div className="font-bold text-[#1C1917] dark:text-[#FAF8F5]">{ruleStat.title}</div>
                        <div className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
                          {ruleStat.studentsCount} student(s) · Rs. {ruleStat.totalMonthlyDiscount.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {reportData.discountRows.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#57534E]">
                    <Tag className="w-9 h-9 mx-auto text-[#E7E0D4] dark:text-[#A8A29E] mb-2" />
                    <p className="font-bold text-sm text-[#44403C] dark:text-[#E7E0D4]">
                      No Discounts Recorded for {reportMonthLabel}
                    </p>
                    <p className="text-[#78716C] mt-1">
                      Create discount rules in "4. Concessions" and assign them to students.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#FAF8F5] dark:bg-[#2C1215]/60 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-[#57534E] dark:text-[#E7E0D4] font-bold uppercase text-[10px]">
                          {isSuperAdmin && <th className="py-3 px-4">School</th>}
                          <th className="py-3 px-4">GR No</th>
                          <th className="py-3 px-4">Student Name</th>
                          <th className="py-3 px-4">Class</th>
                          <th className="py-3 px-4">Concession Category</th>
                          <th className="py-3 px-4 text-right">Gross Fee</th>
                          <th className="py-3 px-4 text-right">Discount</th>
                          <th className="py-3 px-4 text-right">Net Payable</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E7E0D4] dark:divide-[rgba(255,253,249,0.10)]">
                        {reportData.discountRows.map((row) => (
                          <tr key={`${row.schoolId}_${row.student.id}`} className="hover:bg-[#FAF8F5]/60 dark:hover:bg-[#3F1014]/40">
                            {isSuperAdmin && (
                              <td className="py-3 px-4 text-[#57534E] dark:text-[#E7E0D4] max-w-[180px] truncate">{row.schoolName}</td>
                            )}
                            <td className="py-3 px-4 font-mono font-bold">{row.student.grNumber}</td>
                            <td className="py-3 px-4 font-bold text-[#1C1917] dark:text-[#FAF8F5]">{row.student.fullName}</td>
                            <td className="py-3 px-4">{row.student.grade} - {row.student.section || 'General'}</td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 font-bold text-[10px]">
                                {row.concessionTitle}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono">Rs. {row.grossFee.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                              - Rs. {row.discountAmount.toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              Rs. {row.netFee.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 5. Partial Payments Report Table */}
            {reportType === 'partial' && (
              reportData.partialPaymentRows.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#57534E]">
                  <Wallet className="w-9 h-9 mx-auto text-[#E7E0D4] dark:text-[#A8A29E] mb-2" />
                  <p className="font-bold text-sm text-[#44403C] dark:text-[#E7E0D4]">
                    No Partial Payments in {reportMonthLabel}
                  </p>
                  <p className="text-[#78716C] mt-1">
                    When partial amounts are received in Fee Collection, they appear here with remaining balances.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#FAF8F5] dark:bg-[#2C1215]/60 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-[#57534E] dark:text-[#E7E0D4] font-bold uppercase text-[10px]">
                        <th className="py-3 px-4">Receipt No</th>
                        {isSuperAdmin && <th className="py-3 px-4">School</th>}
                        <th className="py-3 px-4">GR No</th>
                        <th className="py-3 px-4">Student Name</th>
                        <th className="py-3 px-4">Class</th>
                        <th className="py-3 px-4 text-right">Net Due</th>
                        <th className="py-3 px-4 text-right">Paid So Far</th>
                        <th className="py-3 px-4 text-right">Pending Balance</th>
                        <th className="py-3 px-4 text-right">Advance Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7E0D4] dark:divide-[rgba(255,253,249,0.10)]">
                      {reportData.partialPaymentRows.map((p) => (
                        <tr key={p.id} className="hover:bg-[#FAF8F5]/60 dark:hover:bg-[#3F1014]/40">
                          <td className="py-3 px-4 font-mono font-bold text-[#7F1D1D] dark:text-[#FCA5A5]">{p.receiptNumber || 'RCPT'}</td>
                          {isSuperAdmin && (
                            <td className="py-3 px-4 text-[#57534E] dark:text-[#E7E0D4] max-w-[180px] truncate">{p.schoolName}</td>
                          )}
                          <td className="py-3 px-4 font-mono font-bold">{p.grNumber}</td>
                          <td className="py-3 px-4 font-bold text-[#1C1917] dark:text-[#FAF8F5]">{p.studentName}</td>
                          <td className="py-3 px-4">{p.grade} - {p.section || 'General'}</td>
                          <td className="py-3 px-4 text-right font-mono">Rs. {Number(p.netAmount || 0).toLocaleString()}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            Rs. {Number(p.paidAmount || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                            Rs. {p.remainingDue.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-[#C2410C] dark:text-[#FDBA74]">
                            Rs. {p.studentAdvanceBalance.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </div>
      )}
      </div>

      {/* =================================================================== */}
      {/* MODAL: ADD CUSTOM FEE CHARGE */}
      {/* =================================================================== */}
      {customChargeModalClassId && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 sm:p-6 w-full max-w-md max-h-[90dvh] overflow-y-auto shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] pb-3">
              <h3 className="text-base font-bold text-[#1C1917] dark:text-[#FAF8F5] flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600" />
                <span>Add Custom Fee / Fund</span>
              </h3>
              <button
                type="button"
                onClick={() => setCustomChargeModalClassId(null)}
                className="p-1 hover:bg-[#F3EFEA] dark:hover:bg-[#3F1014] rounded-lg transition"
              >
                <X className="w-4 h-4 text-[#78716C]" />
              </button>
            </div>

            <p className="text-xs text-[#57534E] dark:text-[#D6CCC2]">
              Add a specialized charge for{' '}
              <strong>
                {classes.find((c) => c.id === customChargeModalClassId)?.grade}
              </strong>{' '}
              (e.g., Computer Lab, Sports Fund, Board Registration, Library Fund).
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                  Charge Title / Fund Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Science Lab Fund"
                  value={newChargeTitle}
                  onChange={(e) => setNewChargeTitle(e.target.value)}
                  className="w-full bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl px-3.5 py-2 text-xs text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                  Amount (PKR)
                </label>
                <input
                  type="number"
                  min="10"
                  value={newChargeAmount}
                  onChange={(e) => setNewChargeAmount(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl px-3.5 py-2 text-xs text-[#1C1917] dark:text-[#FAF8F5] focus:outline-hidden font-bold"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
              <button
                type="button"
                onClick={() => setCustomChargeModalClassId(null)}
                className="px-4 py-2 text-xs font-semibold text-[#57534E] dark:text-[#D6CCC2] hover:bg-[#F3EFEA] dark:hover:bg-[#3F1014] rounded-xl transition"
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
        <PrintPreviewModalShell
          title="Official Fee Voucher / Payment Receipt Preview"
          printLabel="Print Voucher / Save as PDF"
          onPrint={triggerPrintDocument}
          onClose={() => setActiveVoucherForPrint(null)}
          accent="emerald"
        >
            {/* Printable A4 Container: 2 Identical Copies (School Copy & Student Copy) */}
            <div className="printable-a4-sheet bg-white text-[#1C1917] p-6 border border-[#E7E0D4] rounded-xl space-y-8">
              {[
                { title: 'BANK / SCHOOL COUNTER COPY', copyTag: 'School Record' },
                { title: 'STUDENT / PARENT COPY', copyTag: 'Student Record' },
              ].map((copy, idx) => (
                <div
                  key={idx}
                  className={`p-5 border-2 border-dashed border-[#D6CCC2] rounded-xl ${
                    idx > 0 ? 'mt-6 pt-6 border-t-2 border-[#C2B7A8]' : ''
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between border-b-2 border-[#1C1917] pb-3">
                    <div>
                      <div className="text-[10px] font-bold tracking-widest text-emerald-800 uppercase">
                        GOVERNMENT OF SINDH · SCHOOL EDUCATION &amp; LITERACY DEPARTMENT
                      </div>
                      <h2 className="text-lg font-black text-[#1C1917] uppercase">
                        {activeSchool.name || 'Govt. High School'}
                      </h2>
                      <div className="text-xs text-[#57534E] font-medium">
                        SEMIS Code: {activeSchool.semisCode || '403020101'} · District: {activeSchool.district || 'Latifabad, Hyderabad'}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-[#2C1215] text-white inline-block">
                        {copy.title}
                      </div>
                      <div className="text-xs font-mono font-bold text-emerald-700 mt-1">
                        Receipt #: {activeVoucherForPrint.receiptNumber || 'RCPT-2026-001'}
                      </div>
                      <div className="text-[10px] text-[#57534E]">
                        Date: {activeVoucherForPrint.paymentDate ? new Date(activeVoucherForPrint.paymentDate).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')}
                      </div>
                    </div>
                  </div>

                  {/* Student Details Grid */}
                  <div className="grid grid-cols-4 gap-2 my-3 text-xs bg-slate-50 p-3 rounded-lg border border-[#E7E0D4]">
                    <div>
                      <span className="text-[#57534E] text-[10px] block">Student Name:</span>
                      <strong className="text-[#1C1917]">{activeVoucherForPrint.studentName}</strong>
                    </div>
                    <div>
                      <span className="text-[#57534E] text-[10px] block">GR / Roll No:</span>
                      <strong className="text-[#1C1917] font-mono">{activeVoucherForPrint.grNumber}</strong>
                    </div>
                    <div>
                      <span className="text-[#57534E] text-[10px] block">Class &amp; Section:</span>
                      <strong className="text-[#1C1917]">{activeVoucherForPrint.grade} - {activeVoucherForPrint.section || 'General'}</strong>
                    </div>
                    <div>
                      <span className="text-[#57534E] text-[10px] block">Fee Billing Month:</span>
                      <strong className="text-emerald-700">{activeVoucherForPrint.monthLabel}</strong>
                    </div>
                  </div>

                  {/* Fee Breakdown Table */}
                  <table className="w-full text-left text-xs border border-[#D6CCC2] my-3">
                    <thead className="bg-slate-100 font-bold text-[#1C1917]">
                      <tr>
                        <th className="py-1.5 px-3 border border-[#D6CCC2]">#</th>
                        <th className="py-1.5 px-3 border border-[#D6CCC2]">Fee Particulars</th>
                        <th className="py-1.5 px-3 border border-[#D6CCC2] text-right">Amount (PKR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-1.5 px-3 border border-[#D6CCC2]">1</td>
                        <td className="py-1.5 px-3 border border-[#D6CCC2]">Monthly Tuition Fee</td>
                        <td className="py-1.5 px-3 border border-[#D6CCC2] text-right font-mono">
                          {activeVoucherForPrint.baseAmount.toLocaleString()}
                        </td>
                      </tr>
                      {activeVoucherForPrint.customChargesAmount > 0 && (
                        <tr>
                          <td className="py-1.5 px-3 border border-[#D6CCC2]">2</td>
                          <td className="py-1.5 px-3 border border-[#D6CCC2]">Special Funds &amp; Lab Charges</td>
                          <td className="py-1.5 px-3 border border-[#D6CCC2] text-right font-mono">
                            {activeVoucherForPrint.customChargesAmount.toLocaleString()}
                          </td>
                        </tr>
                      )}
                      {activeVoucherForPrint.discount > 0 && (
                        <tr className="text-amber-800 bg-amber-50/50">
                          <td className="py-1.5 px-3 border border-[#D6CCC2]">3</td>
                          <td className="py-1.5 px-3 border border-[#D6CCC2]">
                            Less: {activeVoucherForPrint.concessionTitle || 'Scholarship / Fee Concession'}
                          </td>
                          <td className="py-1.5 px-3 border border-[#D6CCC2] text-right font-mono">
                            - {activeVoucherForPrint.discount.toLocaleString()}
                          </td>
                        </tr>
                      )}
                      <tr className="bg-slate-100 font-bold text-[#1C1917]">
                        <td colSpan={2} className="py-2 px-3 border border-[#D6CCC2] text-right">
                          Total Net Payable:
                        </td>
                        <td className="py-2 px-3 border border-[#D6CCC2] text-right font-mono text-sm text-emerald-800">
                          Rs. {activeVoucherForPrint.netAmount.toLocaleString()}
                        </td>
                      </tr>
                      {activeVoucherForPrint.paidAmount > 0 && (
                        <tr className="bg-emerald-50/50 text-emerald-900">
                          <td colSpan={2} className="py-1.5 px-3 border border-[#D6CCC2] text-right font-semibold">
                            Amount Paid / Settled:
                          </td>
                          <td className="py-1.5 px-3 border border-[#D6CCC2] text-right font-mono font-bold">
                            Rs. {activeVoucherForPrint.paidAmount.toLocaleString()}
                          </td>
                        </tr>
                      )}
                      {(activeVoucherForPrint.pendingBalance || 0) > 0 && (
                        <tr className="bg-rose-50/60 text-rose-800">
                          <td colSpan={2} className="py-1.5 px-3 border border-[#D6CCC2] text-right font-bold">
                            Remaining Pending Balance:
                          </td>
                          <td className="py-1.5 px-3 border border-[#D6CCC2] text-right font-mono font-bold">
                            Rs. {(activeVoucherForPrint.pendingBalance || 0).toLocaleString()}
                          </td>
                        </tr>
                      )}
                      {(activeVoucherForPrint.advanceGenerated || 0) > 0 && (
                        <tr className="bg-[#FFF7ED]/70 text-[#C2410C]">
                          <td colSpan={2} className="py-1.5 px-3 border border-[#D6CCC2] text-right font-bold">
                            Advance Allocated ({activeVoucherForPrint.allocatedNextMonth || 'Next Month'}):
                          </td>
                          <td className="py-1.5 px-3 border border-[#D6CCC2] text-right font-mono font-bold">
                            + Rs. {(activeVoucherForPrint.advanceGenerated || 0).toLocaleString()}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Footer & Stamps */}
                  <div className="flex items-end justify-between pt-4 mt-2 text-xs">
                    <div>
                      <div className="text-[10px] text-[#57534E]">
                        Payment Status: <strong className="text-emerald-700 uppercase">{activeVoucherForPrint.status}</strong>
                        {activeVoucherForPrint.paymentMethod && ` via ${activeVoucherForPrint.paymentMethod}`}
                      </div>
                      <div className="text-[10px] text-[#78716C] mt-0.5">
                        Cashier: {activeVoucherForPrint.recordedByName || 'Fee Counter Official'}
                      </div>
                    </div>

                    <div className="flex items-center gap-12">
                      <div className="text-center">
                        <div className="w-28 border-b border-[#C2B7A8] mb-1"></div>
                        <span className="text-[10px] text-[#57534E]">Cashier Stamp / Sign</span>
                      </div>
                      <div className="text-center">
                        <div className="w-28 border-b border-[#C2B7A8] mb-1"></div>
                        <span className="text-[10px] text-[#57534E]">Principal Signature</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
        </PrintPreviewModalShell>
      )}

      {/* =================================================================== */}
      {/* PRINTABLE BULK BATCH VOUCHERS MODAL (.printable-a4-sheet) */}
      {/* =================================================================== */}
      {bulkBatchForPrint && (
        <PrintPreviewModalShell
          title={`Bulk Class Fee Vouchers Batch (${bulkBatchForPrint.length} Vouchers — ${bulkMonthLabel})`}
          printLabel={`Print All (${bulkBatchForPrint.length} Vouchers)`}
          onPrint={triggerPrintDocument}
          onClose={() => setBulkBatchForPrint(null)}
          accent="emerald"
        >
            <div className="printable-a4-sheet bg-white text-[#1C1917] p-4 rounded-xl space-y-6">
              {bulkBatchForPrint.map((voucher, idx) => (
                <div
                  key={voucher.id}
                  className={`p-4 border-2 border-dashed border-[#C2B7A8] rounded-xl print-break-inside-avoid ${
                    idx % 2 === 1 && idx < bulkBatchForPrint.length - 1 ? 'print-page-break-after' : ''
                  }`}
                >
                  <div className="flex items-start justify-between border-b-2 border-[#1C1917] pb-2">
                    <div>
                      <div className="text-[9px] font-bold tracking-widest text-emerald-800 uppercase">
                        GOVERNMENT OF SINDH · SCHOOL EDUCATION &amp; LITERACY DEPARTMENT
                      </div>
                      <h2 className="text-base font-black text-[#1C1917] uppercase">
                        {activeSchool.name || 'Govt. High School'}
                      </h2>
                      <div className="text-[11px] text-[#57534E] font-medium">
                        SEMIS Code: {activeSchool.semisCode || 'N/A'} · Due Date: {bulkDueDate}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-[#2C1215] text-white inline-block">
                        MONTHLY FEE VOUCHER
                      </div>
                      <div className="text-[11px] font-mono font-bold text-emerald-700 mt-0.5">
                        Voucher #: {voucher.receiptNumber}
                      </div>
                      <div className="text-[10px] text-[#57534E]">
                        Billing Month: <strong>{voucher.monthLabel}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 my-2.5 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-[#E7E0D4]">
                    <div>
                      <span className="text-[#57534E] text-[9px] block">Student Name:</span>
                      <strong className="text-[#1C1917]">{voucher.studentName}</strong>
                    </div>
                    <div>
                      <span className="text-[#57534E] text-[9px] block">GR Number:</span>
                      <strong className="text-[#1C1917] font-mono">{voucher.grNumber}</strong>
                    </div>
                    <div>
                      <span className="text-[#57534E] text-[9px] block">Class &amp; Section:</span>
                      <strong className="text-[#1C1917]">{voucher.grade} - {voucher.section || 'General'}</strong>
                    </div>
                    <div>
                      <span className="text-[#57534E] text-[9px] block">Status:</span>
                      <strong className="uppercase text-emerald-700">{voucher.status}</strong>
                    </div>
                  </div>

                  <table className="w-full text-left text-[11px] border border-[#D6CCC2] border-collapse my-2">
                    <thead className="bg-slate-100 font-bold text-[#1C1917]">
                      <tr>
                        <th className="py-1 px-2.5 border border-[#D6CCC2]">Fee Particulars</th>
                        <th className="py-1 px-2.5 border border-[#D6CCC2] text-right">Amount (PKR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-1 px-2.5 border border-[#D6CCC2]">Monthly Tuition &amp; Class Charges</td>
                        <td className="py-1 px-2.5 border border-[#D6CCC2] text-right font-mono">
                          {(voucher.baseAmount + voucher.customChargesAmount).toLocaleString()}
                        </td>
                      </tr>
                      {voucher.discount > 0 && (
                        <tr className="text-amber-800 bg-amber-50/40">
                          <td className="py-1 px-2.5 border border-[#D6CCC2]">
                            Less: {voucher.concessionTitle || 'Concession / Scholarship'}
                          </td>
                          <td className="py-1 px-2.5 border border-[#D6CCC2] text-right font-mono">
                            - {voucher.discount.toLocaleString()}
                          </td>
                        </tr>
                      )}
                      {voucher.paidAmount > 0 && (
                        <tr className="text-emerald-800">
                          <td className="py-1 px-2.5 border border-[#D6CCC2]">Less: Already Paid / Advance Credit</td>
                          <td className="py-1 px-2.5 border border-[#D6CCC2] text-right font-mono">
                            - {voucher.paidAmount.toLocaleString()}
                          </td>
                        </tr>
                      )}
                      <tr className="bg-slate-100 font-bold text-[#1C1917]">
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2] text-right">Net Payable Balance:</td>
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2] text-right font-mono text-xs text-emerald-800">
                          Rs. {(voucher.pendingBalance ?? voucher.netAmount).toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="flex items-end justify-between pt-2 text-[10px] text-[#57534E]">
                    <span>{voucher.notes || bulkVoucherNote}</span>
                    <div className="flex items-center gap-8">
                      <div className="text-center">
                        <div className="w-24 border-b border-[#C2B7A8] mb-0.5"></div>
                        <span>Bank / Cashier Sign</span>
                      </div>
                      <div className="text-center">
                        <div className="w-24 border-b border-[#C2B7A8] mb-0.5"></div>
                        <span>Principal Sign</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
        </PrintPreviewModalShell>
      )}

      {/* =================================================================== */}
      {/* PRINTABLE A4 REPORT PDF MODAL (.printable-a4-sheet) */}
      {/* =================================================================== */}
      {showReportPrintModal && (
        <PrintPreviewModalShell
          title="Official Financial Report — A4 PDF Preview"
          printLabel="Print / Save as PDF (A4)"
          onPrint={triggerPrintDocument}
          onClose={() => setShowReportPrintModal(false)}
          accent="indigo"
        >
            <div className="printable-a4-sheet bg-white text-[#1C1917] p-6 border border-[#E7E0D4] rounded-xl space-y-5">
              {/* Official Letterhead */}
              <div className="flex items-start justify-between border-b-2 border-[#1C1917] pb-3">
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-emerald-800 uppercase">
                    GOVERNMENT OF SINDH · SCHOOL EDUCATION &amp; LITERACY DEPARTMENT
                  </div>
                  <h2 className="text-lg font-black text-[#1C1917] uppercase">
                    {reportType === 'daily'
                      ? 'Daily Fee Collection Report'
                      : reportType === 'monthly'
                      ? 'Monthly Fee Collection Report'
                      : reportType === 'discounts'
                      ? 'Discount & Concessions Summary Report'
                      : reportType === 'partial'
                      ? 'Partial Payments & Pending Balance Report'
                      : 'Monthly Fee Defaulters List'}
                  </h2>
                  <div className="text-xs text-[#57534E] font-medium">
                    Scope: {reportScopeLabel}
                  </div>
                </div>
                <div className="text-right text-xs">
                  <div className="font-bold text-[#1C1917]">
                    {reportType === 'daily' ? `Date: ${reportDate}` : `Month: ${reportMonthLabel}`}
                  </div>
                  <div className="text-[10px] text-[#57534E]">
                    Generated: {new Date().toLocaleString('en-GB')}
                  </div>
                </div>
              </div>

              {/* Totals Summary Box */}
              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-[#D6CCC2] text-xs">
                <div>
                  <span className="text-[10px] text-[#57534E] block uppercase font-bold">Total Collected</span>
                  <strong className="text-sm text-emerald-800 font-mono">
                    Rs.{' '}
                    {(reportType === 'daily'
                      ? reportData.totals.totalDailyCollected
                      : reportType === 'partial'
                      ? reportData.totals.totalPartialCollected
                      : reportData.totals.totalMonthlyCollected
                    ).toLocaleString()}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-[#57534E] block uppercase font-bold">
                    {reportType === 'discounts' ? 'Total Discounts Granted' : 'Total Pending Balance'}
                  </span>
                  <strong className="text-sm text-rose-700 font-mono">
                    Rs.{' '}
                    {(reportType === 'discounts'
                      ? reportData.totals.totalDiscountsGranted
                      : reportType === 'partial'
                      ? reportData.totals.totalPartialPending
                      : reportData.totals.totalPending
                    ).toLocaleString()}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-[#57534E] block uppercase font-bold">Collection Rate</span>
                  <strong className="text-sm text-[#1C1917] font-mono">
                    {reportData.totals.overallCollectionRate}% ({reportData.totals.totalPaidCount}/{reportData.totals.totalActiveStudents})
                  </strong>
                </div>
              </div>

              {/* A4 Report Table */}
              {reportType === 'daily' && (
                <table className="w-full text-left text-[11px] border border-[#D6CCC2] border-collapse">
                  <thead className="bg-slate-100 font-bold text-[#1C1917]">
                    <tr>
                      <th className="py-1.5 px-2.5 border border-[#D6CCC2]">Receipt</th>
                      {isSuperAdmin && <th className="py-1.5 px-2.5 border border-[#D6CCC2]">School</th>}
                      <th className="py-1.5 px-2.5 border border-[#D6CCC2]">GR No</th>
                      <th className="py-1.5 px-2.5 border border-[#D6CCC2]">Student Name</th>
                      <th className="py-1.5 px-2.5 border border-[#D6CCC2]">Class</th>
                      <th className="py-1.5 px-2.5 border border-[#D6CCC2]">Method</th>
                      <th className="py-1.5 px-2.5 border border-[#D6CCC2] text-right">Paid (PKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.dailyPayments.map((p) => (
                      <tr key={p.id}>
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2] font-mono">{p.receiptNumber || 'RCPT'}</td>
                        {isSuperAdmin && <td className="py-1.5 px-2.5 border border-[#D6CCC2]">{p.schoolName}</td>}
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2] font-mono">{p.grNumber}</td>
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2] font-semibold">{p.studentName}</td>
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2]">{p.grade} - {p.section || 'General'}</td>
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2]">{p.paymentMethod || 'Cash'}</td>
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2] text-right font-mono font-bold">
                          {Number(p.paidAmount || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {reportType === 'monthly' && (
                <table className="w-full text-left text-[11px] border border-[#D6CCC2] border-collapse">
                  <thead className="bg-slate-100 font-bold text-[#1C1917]">
                    <tr>
                      <th className="py-1.5 px-2.5 border border-[#D6CCC2]">Receipt</th>
                      <th className="py-1.5 px-2.5 border border-[#D6CCC2]">Date</th>
                      {isSuperAdmin && <th className="py-1.5 px-2.5 border border-[#D6CCC2]">School</th>}
                      <th className="py-1.5 px-2.5 border border-[#D6CCC2]">GR No</th>
                      <th className="py-1.5 px-2.5 border border-[#D6CCC2]">Student Name</th>
                      <th className="py-1.5 px-2.5 border border-[#D6CCC2]">Class</th>
                      <th className="py-1.5 px-2.5 border border-[#D6CCC2] text-right">Paid (PKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.monthlyPayments.map((p) => (
                      <tr key={p.id}>
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2] font-mono">{p.receiptNumber || 'RCPT'}</td>
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2]">
                          {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-GB') : 'N/A'}
                        </td>
                        {isSuperAdmin && <td className="py-1.5 px-2.5 border border-[#D6CCC2]">{p.schoolName}</td>}
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2] font-mono">{p.grNumber}</td>
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2] font-semibold">{p.studentName}</td>
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2]">{p.grade} - {p.section || 'General'}</td>
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2] text-right font-mono font-bold">
                          {Number(p.paidAmount || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {reportType === 'defaulters' && (
                <table className="w-full text-left text-[11px] border border-[#D6CCC2] border-collapse">
                  <thead className="bg-slate-100 font-bold text-[#1C1917]">
                    <tr>
                      {isSuperAdmin && <th className="py-1.5 px-2.5 border border-[#D6CCC2]">School</th>}
                      <th className="py-1.5 px-2.5 border border-[#D6CCC2]">GR No</th>
                      <th className="py-1.5 px-2.5 border border-[#D6CCC2]">Student &amp; Father Name</th>
                      <th className="py-1.5 px-2.5 border border-[#D6CCC2]">Class</th>
                      <th className="py-1.5 px-2.5 border border-[#D6CCC2]">Guardian Phone</th>
                      <th className="py-1.5 px-2.5 border border-[#D6CCC2] text-right">Due (PKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.defaulterRows.map((row) => (
                      <tr key={`${row.schoolId}_${row.student.id}`}>
                        {isSuperAdmin && <td className="py-1.5 px-2.5 border border-[#D6CCC2]">{row.schoolName}</td>}
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2] font-mono">{row.student.grNumber}</td>
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2] font-semibold">
                          {row.student.fullName} s/o {row.student.fatherName}
                        </td>
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2]">
                          {row.student.grade} - {row.student.section || 'General'}
                        </td>
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2] font-mono">
                          {row.student.guardianPhone || 'N/A'}
                        </td>
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2] text-right font-mono font-bold text-rose-700">
                          {row.expectedFee.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {reportType === 'discounts' && (
                <table className="w-full text-left text-[11px] border border-[#D6CCC2] border-collapse">
                  <thead className="bg-slate-100 font-bold text-[#1C1917]">
                    <tr>
                      {isSuperAdmin && <th className="py-1.5 px-2.5 border border-[#D6CCC2]">School</th>}
                      <th className="py-1.5 px-2.5 border border-[#D6CCC2]">GR No</th>
                      <th className="py-1.5 px-2.5 border border-[#D6CCC2]">Student Name</th>
                      <th className="py-1.5 px-2.5 border border-[#D6CCC2]">Class</th>
                      <th className="py-1.5 px-2.5 border border-[#D6CCC2]">Concession Rule</th>
                      <th className="py-1.5 px-2.5 border border-[#D6CCC2] text-right">Discount (PKR)</th>
                      <th className="py-1.5 px-2.5 border border-[#D6CCC2] text-right">Net Payable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.discountRows.map((row) => (
                      <tr key={`${row.schoolId}_${row.student.id}`}>
                        {isSuperAdmin && <td className="py-1.5 px-2.5 border border-[#D6CCC2]">{row.schoolName}</td>}
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2] font-mono">{row.student.grNumber}</td>
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2] font-semibold">{row.student.fullName}</td>
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2]">{row.student.grade} - {row.student.section || 'General'}</td>
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2] font-semibold">{row.concessionTitle}</td>
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2] text-right font-mono font-bold text-amber-700">
                          -{row.discountAmount.toLocaleString()}
                        </td>
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2] text-right font-mono font-bold">
                          {row.netFee.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {reportType === 'partial' && (
                <table className="w-full text-left text-[11px] border border-[#D6CCC2] border-collapse">
                  <thead className="bg-slate-100 font-bold text-[#1C1917]">
                    <tr>
                      <th className="py-1.5 px-2.5 border border-[#D6CCC2]">Receipt</th>
                      {isSuperAdmin && <th className="py-1.5 px-2.5 border border-[#D6CCC2]">School</th>}
                      <th className="py-1.5 px-2.5 border border-[#D6CCC2]">GR No</th>
                      <th className="py-1.5 px-2.5 border border-[#D6CCC2]">Student Name</th>
                      <th className="py-1.5 px-2.5 border border-[#D6CCC2]">Class</th>
                      <th className="py-1.5 px-2.5 border border-[#D6CCC2] text-right">Net Due</th>
                      <th className="py-1.5 px-2.5 border border-[#D6CCC2] text-right">Paid</th>
                      <th className="py-1.5 px-2.5 border border-[#D6CCC2] text-right">Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.partialPaymentRows.map((p) => (
                      <tr key={p.id}>
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2] font-mono">{p.receiptNumber || 'RCPT'}</td>
                        {isSuperAdmin && <td className="py-1.5 px-2.5 border border-[#D6CCC2]">{p.schoolName}</td>}
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2] font-mono">{p.grNumber}</td>
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2] font-semibold">{p.studentName}</td>
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2]">{p.grade} - {p.section || 'General'}</td>
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2] text-right font-mono">{Number(p.netAmount || 0).toLocaleString()}</td>
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2] text-right font-mono text-emerald-700 font-bold">{Number(p.paidAmount || 0).toLocaleString()}</td>
                        <td className="py-1.5 px-2.5 border border-[#D6CCC2] text-right font-mono text-rose-700 font-bold">{p.remainingDue.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Signatures Footer */}
              <div className="flex items-end justify-between pt-8 text-xs">
                <div className="text-[10px] text-[#57534E]">
                  Prepared by: {currentUserProfile?.fullName || 'Accounts Office'}
                </div>
                <div className="flex items-center gap-12">
                  <div className="text-center">
                    <div className="w-28 border-b border-[#C2B7A8] mb-1"></div>
                    <span className="text-[10px] text-[#57534E]">Accounts / Cashier</span>
                  </div>
                  <div className="text-center">
                    <div className="w-28 border-b border-[#C2B7A8] mb-1"></div>
                    <span className="text-[10px] text-[#57534E]">Principal / DDO Sign</span>
                  </div>
                </div>
              </div>
            </div>
        </PrintPreviewModalShell>
      )}
    </div>
  );
};
