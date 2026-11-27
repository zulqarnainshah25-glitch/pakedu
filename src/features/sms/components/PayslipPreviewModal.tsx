import React, { useEffect, useRef, useState } from 'react';
import { Banknote, CheckCircle2, Download, Loader2, Printer, X } from 'lucide-react';
import { EmployeePayslip, School } from '../types';
import { triggerPrintDocument } from '../../../utils/printDocument';
import { exportA4ElementAsPdf } from '../../../utils/mobilePdfExport';
import { numberToRupeesWords } from '../utils/payrollCalculations';

interface PayslipPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  school: School;
  payslip?: EmployeePayslip | null;
  batchPayslips?: EmployeePayslip[] | null;
}

const SingleA4PayslipSheet: React.FC<{
  payslip: EmployeePayslip;
  school: School;
  pageBreakBefore?: boolean;
}> = ({ payslip, school, pageBreakBefore = false }) => {
  const adjustment = payslip.adjustmentAmount || 0;
  const maxRows = Math.max(
    1 + (payslip.allowances?.length || 0) + (adjustment > 0 ? 1 : 0),
    (payslip.deductions?.length || 0) + (adjustment < 0 ? 1 : 0),
    3
  );

  const earningsRows: Array<{ label: string; amount: number }> = [
    { label: 'Basic Salary', amount: payslip.basicSalary },
    ...(payslip.allowances || []).map((a) => ({ label: a.label, amount: a.amount })),
    ...(adjustment > 0
      ? [{ label: payslip.adjustmentReason || 'Bonus / Additional Allowance', amount: adjustment }]
      : []),
  ];

  const deductionRows: Array<{ label: string; amount: number }> = [
    ...(payslip.deductions || []).map((d) => ({ label: d.label, amount: d.amount })),
    ...(adjustment < 0
      ? [
          {
            label: payslip.adjustmentReason || 'Leave / Advance Deduction Adjustment',
            amount: Math.abs(adjustment),
          },
        ]
      : []),
  ];

  const grossPay = earningsRows.reduce((s, r) => s + r.amount, 0);
  const totalDed = deductionRows.reduce((s, r) => s + r.amount, 0);

  const statusBadge =
    payslip.status === 'paid'
      ? { label: 'PAID / DISBURSED', cls: 'bg-emerald-50 text-emerald-700 border-emerald-300' }
      : payslip.isFinalized || payslip.status === 'finalized'
      ? { label: 'FINALIZED · PENDING PAYMENT', cls: 'bg-amber-50 text-amber-800 border-amber-300' }
      : { label: 'DRAFT PREVIEW', cls: 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]' };

  return (
    <div
      className={`bg-white text-[#1C1917] border-2 border-[#58181D] rounded-lg p-5 sm:p-8 space-y-5 ${
        pageBreakBefore ? 'mt-8 print:mt-0 print:break-before-page' : ''
      }`}
    >
      {/* Institutional Letterhead */}
      <div className="border-b-2 border-[#58181D] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          {school.logoUrl ? (
            <img
              src={school.logoUrl}
              alt={`${school.name} logo`}
              className="w-14 h-14 rounded-xl object-contain border border-[#E7E0D4] bg-white shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-[#58181D] text-white flex items-center justify-center font-black text-xl shrink-0">
              {school.name ? school.name.charAt(0).toUpperCase() : 'S'}
            </div>
          )}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#7F1D1D]">
              Official Monthly Salary Voucher / Payslip
            </div>
            <h2 className="text-base sm:text-lg font-black text-[#1C1917] uppercase tracking-tight">
              {school.name || 'PakEdu Institution'}
            </h2>
            <p className="text-[11px] text-[#57534E]">
              {school.board || 'Sindh SELD'} · SEMIS Code:{' '}
              <span className="font-mono font-bold text-[#1C1917]">{school.semisCode || '—'}</span>
              {school.district ? ` · District ${school.district}` : ''}
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right text-xs space-y-1 shrink-0">
          <div className="font-mono font-bold text-[#1C1917]">
            Slip #: {payslip.payslipNumber}
          </div>
          <div className="text-[#57534E]">
            Pay Period: <strong className="text-[#7F1D1D]">{payslip.monthLabel}</strong>
          </div>
          <span
            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${statusBadge.cls}`}
          >
            {statusBadge.label}
          </span>
        </div>
      </div>

      {/* Employee Details Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#FAF8F5] border border-[#E7E0D4] rounded-xl p-3.5 text-xs">
        <div>
          <span className="text-[10px] text-[#78716C] block">Employee Name</span>
          <strong className="text-[#1C1917] block">{payslip.employeeName}</strong>
        </div>
        <div>
          <span className="text-[10px] text-[#78716C] block">Designation / Cadre</span>
          <strong className="text-[#1C1917] block">{payslip.designation || 'Faculty'}</strong>
        </div>
        <div>
          <span className="text-[10px] text-[#78716C] block">Employee ID / CNIC</span>
          <strong className="text-[#1C1917] font-mono text-[11px] block">
            {payslip.employeeId}
            {payslip.cnic ? ` · ${payslip.cnic}` : ''}
          </strong>
        </div>
        <div>
          <span className="text-[10px] text-[#78716C] block">Bank / Payment Mode</span>
          <strong className="text-[#1C1917] block">
            {payslip.bankName
              ? `${payslip.bankName}${payslip.accountNumber ? ` (${payslip.accountNumber})` : ''}`
              : payslip.paymentMethod || 'Bank Transfer'}
          </strong>
        </div>
      </div>

      {/* Side-by-Side Earnings & Deductions Ledger */}
      <div className="border border-[#D6CCC2] rounded-xl overflow-hidden">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-[#2C1215] text-[#FAF8F5]">
            <tr>
              <th className="py-2.5 px-3 border-r border-[rgba(255,253,249,0.2)] w-[35%]">
                Earnings / Allowances
              </th>
              <th className="py-2.5 px-3 border-r border-[rgba(255,253,249,0.2)] text-right w-[15%]">
                Amount (PKR)
              </th>
              <th className="py-2.5 px-3 border-r border-[rgba(255,253,249,0.2)] w-[35%]">
                Deductions &amp; Recoveries
              </th>
              <th className="py-2.5 px-3 text-right w-[15%]">Amount (PKR)</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxRows }).map((_, idx) => {
              const earn = earningsRows[idx];
              const ded = deductionRows[idx];
              return (
                <tr key={idx} className="border-t border-[#E7E0D4]">
                  <td className="py-2 px-3 border-r border-[#E7E0D4] font-medium text-[#1C1917]">
                    {earn ? earn.label : ''}
                  </td>
                  <td className="py-2 px-3 border-r border-[#E7E0D4] text-right font-mono text-[#1C1917]">
                    {earn ? `Rs. ${earn.amount.toLocaleString()}` : ''}
                  </td>
                  <td className="py-2 px-3 border-r border-[#E7E0D4] font-medium text-[#1C1917]">
                    {ded ? ded.label : ''}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-rose-700">
                    {ded ? `Rs. ${ded.amount.toLocaleString()}` : ''}
                  </td>
                </tr>
              );
            })}

            <tr className="border-t-2 border-[#D6CCC2] bg-[#FAF8F5] font-bold">
              <td className="py-2.5 px-3 border-r border-[#E7E0D4] text-[#1C1917]">
                Gross Earnings (Basic + Allowances)
              </td>
              <td className="py-2.5 px-3 border-r border-[#E7E0D4] text-right font-mono text-emerald-700">
                Rs. {grossPay.toLocaleString()}
              </td>
              <td className="py-2.5 px-3 border-r border-[#E7E0D4] text-[#1C1917]">
                Total Deductions
              </td>
              <td className="py-2.5 px-3 text-right font-mono text-rose-700">
                Rs. {totalDed.toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Net Payable Box */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FEF2F2] border-2 border-[#7F1D1D] rounded-xl p-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#7F1D1D] block">
            Net Salary Payable
          </span>
          <span className="text-xs font-semibold text-[#44403C] italic">
            In Words: {numberToRupeesWords(payslip.netSalary)}
          </span>
        </div>
        <div className="text-left sm:text-right">
          <div className="text-2xl font-black font-mono text-[#7F1D1D]">
            Rs. {payslip.netSalary.toLocaleString()}
          </div>
          <div className="text-[11px] text-[#57534E]">
            {payslip.status === 'paid' && payslip.paymentDate
              ? `Disbursed on ${payslip.paymentDate} via ${payslip.paymentMethod || 'Bank Transfer'}`
              : payslip.notes || 'Net = (Basic + Allowances) - Deductions'}
          </div>
        </div>
      </div>

      {/* Footer & Signatures */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pt-6 text-xs">
        <div className="text-[11px] text-[#57534E] space-y-0.5">
          <div>
            Generated By: <strong>{payslip.generatedByName || 'Accounts & Payroll Office'}</strong>
          </div>
          {payslip.transactionRef && (
            <div className="font-mono text-[10px]">
              Payment Ref: {payslip.transactionRef}
            </div>
          )}
          <div className="text-[10px] text-[#78716C]">
            System-verified PakEdu Payroll Record · {school.name}
          </div>
        </div>

        <div className="flex items-center gap-8 sm:gap-12">
          <div className="text-center">
            <div className="w-28 border-b border-[#C2B7A8] mb-1 h-5" />
            <span className="text-[10px] text-[#57534E]">Employee Signature</span>
          </div>
          <div className="text-center">
            <div className="w-28 border-b border-[#C2B7A8] mb-1 h-5" />
            <span className="text-[10px] text-[#57534E]">Principal / DDO Stamp</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const PayslipPreviewModal: React.FC<PayslipPreviewModalProps> = ({
  isOpen,
  onClose,
  school,
  payslip,
  batchPayslips,
}) => {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [savingPdf, setSavingPdf] = useState(false);
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const slipsToRender: EmployeePayslip[] =
    batchPayslips && batchPayslips.length > 0
      ? batchPayslips
      : payslip
      ? [payslip]
      : [];

  if (slipsToRender.length === 0) return null;

  const isBatch = slipsToRender.length > 1;
  const primary = slipsToRender[0];

  const handleDownloadPdf = async () => {
    if (!sheetRef.current) return;
    setSavingPdf(true);
    setPdfNotice(null);
    try {
      const slug = isBatch
        ? `Payroll-${primary.month}-All-${slipsToRender.length}-Slips.pdf`
        : `Payslip-${primary.month}-${primary.employeeName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')}.pdf`;
      await exportA4ElementAsPdf(sheetRef.current, slug);
      setPdfNotice('Payslip PDF exported / saved successfully.');
    } catch {
      triggerPrintDocument();
    } finally {
      setSavingPdf(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-[#2C1215]/75 backdrop-blur-xs overflow-y-auto print:static print:bg-transparent print:p-0 print:block"
      role="dialog"
      aria-modal="true"
      aria-label={isBatch ? 'Monthly Batch Payslips PDF' : 'Employee Salary Payslip PDF'}
      onClick={onClose}
    >
      <div
        className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-4 max-h-[92dvh] flex flex-col print:max-w-none print:max-h-none print:shadow-none print:rounded-none print:overflow-visible print:block"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Action Bar */}
        <div className="no-print sticky top-0 z-20 px-3 sm:px-5 py-3 bg-[#FAF8F5] dark:bg-[#2C1215] border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#FEE2E2] dark:bg-[#3F1014]/70 text-[#7F1D1D] dark:text-[#FCA5A5] flex items-center justify-center shrink-0">
              <Banknote className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5] truncate">
                {isBatch
                  ? `Monthly Payroll Payslips Batch (${slipsToRender.length} Employees)`
                  : `Salary Payslip · ${primary.employeeName}`}
              </h3>
              <p className="text-[11px] text-[#57534E] dark:text-[#D6CCC2] truncate">
                {primary.monthLabel} · {school.name}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={savingPdf}
              className="min-h-[42px] sm:min-h-[38px] flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-60"
            >
              {savingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{savingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
            </button>

            <button
              type="button"
              onClick={triggerPrintDocument}
              className="min-h-[42px] sm:min-h-[38px] flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#7F1D1D] hover:bg-[#651414] text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print A4</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] sm:min-h-[38px] inline-flex items-center justify-center gap-1 px-3.5 py-2 bg-[#E7E0D4] dark:bg-[#3F1014] hover:bg-[#D6CCC2] dark:hover:bg-[#58181D] text-[#1C1917] dark:text-[#FAF8F5] text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Close</span>
            </button>
          </div>
        </div>

        {pdfNotice && (
          <div className="no-print px-4 py-2 bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{pdfNotice}</span>
          </div>
        )}

        {/* Printable A4 Payslip Container */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-[#F3EFEA] dark:bg-[#160D0E] print:overflow-visible print:p-0 print:bg-white">
          <div
            ref={sheetRef}
            className="printable-a4-sheet mx-auto max-w-[794px] w-full space-y-6"
          >
            {slipsToRender.map((slip, index) => (
              <SingleA4PayslipSheet
                key={slip.id}
                payslip={slip}
                school={school}
                pageBreakBefore={index > 0}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
