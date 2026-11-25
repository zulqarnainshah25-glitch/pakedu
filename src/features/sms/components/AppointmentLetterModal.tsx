import React, { useRef, useState } from 'react';
import { Award, Download, Printer, X, Loader2, CheckCircle2 } from 'lucide-react';
import { School } from '../types';
import { triggerPrintDocument } from '../../../utils/printDocument';
import { exportA4ElementAsPdf } from '../../../utils/mobilePdfExport';

interface AppointmentLetterModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacherName: string;
  fatherName?: string;
  designation: string;
  cnic?: string;
  email?: string;
  phone?: string;
  joiningDate?: string;
  assignedClassesLabel: string;
  school: School;
}

export const AppointmentLetterModal: React.FC<AppointmentLetterModalProps> = ({
  isOpen,
  onClose,
  teacherName,
  fatherName,
  designation,
  cnic,
  email,
  phone,
  joiningDate,
  assignedClassesLabel,
  school,
}) => {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [savingPdf, setSavingPdf] = useState(false);
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const issueDate = new Date().toLocaleDateString('en-PK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const refNo = `APT-${school.semisCode || 'SELD'}-${new Date().getFullYear()}-${teacherName
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 4) || 'STF'}`;

  const handleMobilePdfExport = async () => {
    if (!sheetRef.current) return;
    setSavingPdf(true);
    setPdfNotice(null);
    try {
      const slug = teacherName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'teacher';
      await exportA4ElementAsPdf(sheetRef.current, `Appointment-Letter-${slug}.pdf`);
      setPdfNotice('PDF saved / opened in share sheet.');
    } catch {
      // Fallback to browser print on environments rejecting share/canvas
      triggerPrintDocument();
    } finally {
      setSavingPdf(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Job Offer and Appointment Letter Preview"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-4 max-h-[94dvh] flex flex-col">
        {/* Sticky Mobile-Friendly Action Toolbar (Hidden when printing) */}
        <div className="no-print sticky top-0 z-20 px-3 sm:px-5 py-3 bg-slate-50 dark:bg-slate-800/95 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                Official Appointment / Job Offer Letter
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                A4 Print &amp; Mobile PDF Ready · {teacherName}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleMobilePdfExport}
              disabled={savingPdf}
              className="min-h-[44px] sm:min-h-[38px] flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-60"
            >
              {savingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{savingPdf ? 'Saving PDF...' : 'Save / Share PDF'}</span>
            </button>

            <button
              type="button"
              onClick={triggerPrintDocument}
              className="min-h-[44px] sm:min-h-[38px] flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print A4</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] sm:min-h-[38px] inline-flex items-center justify-center gap-1 px-3.5 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-xs font-semibold rounded-xl transition cursor-pointer"
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

        {/* Scrollable Container Holding A4 Document */}
        <div className="flex-1 overflow-auto p-3 sm:p-6 bg-slate-100 dark:bg-slate-950">
          <div
            ref={sheetRef}
            className="printable-a4-sheet bg-white text-slate-900 border border-slate-300 shadow-lg mx-auto max-w-[794px] w-full p-6 sm:p-10 space-y-6"
          >
            {/* Official School Letterhead */}
            <div className="border-b-2 border-indigo-950 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {school.logoUrl ? (
                  <img
                    src={school.logoUrl}
                    alt={`${school.name} logo`}
                    className="w-16 h-16 rounded-xl object-contain border border-slate-200 bg-white shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-indigo-950 text-white flex items-center justify-center font-black text-2xl shrink-0">
                    {school.name.charAt(0)}
                  </div>
                )}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-800">
                    Office of the Principal / School Management
                  </div>
                  <h1 className="text-lg sm:text-xl font-black text-slate-950 uppercase tracking-tight">
                    {school.name}
                  </h1>
                  <p className="text-xs text-slate-600">
                    {school.board || 'Sindh SELD'} · District {school.district || 'Sindh'}{' '}
                    {school.taluka ? `· Taluka ${school.taluka}` : ''}
                  </p>
                  <p className="text-[11px] font-mono font-semibold text-slate-700 mt-0.5">
                    SEMIS Code: {school.semisCode || '—'}{' '}
                    {school.phone ? `· Tel: ${school.phone}` : ''}
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right text-xs space-y-0.5 shrink-0">
                <div className="font-mono font-bold text-slate-900">Ref: {refNo}</div>
                <div className="text-slate-600">Date: {issueDate}</div>
                <div className="inline-block px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-[10px] font-bold text-indigo-900 uppercase">
                  Session {school.activeAcademicYear || '2025-2026'}
                </div>
              </div>
            </div>

            {/* Letter Title */}
            <div className="text-center py-1">
              <h2 className="inline-block px-5 py-1.5 border-y-2 border-slate-900 text-sm sm:text-base font-extrabold uppercase tracking-widest text-slate-950">
                Appointment &amp; Job Offer Letter
              </h2>
            </div>

            {/* Recipient Block */}
            <div className="text-xs sm:text-sm space-y-1 leading-relaxed text-slate-800">
              <p>
                <strong>To:</strong> {teacherName}
              </p>
              {fatherName && (
                <p>
                  <strong>Father&apos;s Name (S/D/O):</strong> {fatherName}
                </p>
              )}
              <p>
                <strong>CNIC No:</strong>{' '}
                <span className="font-mono">{cnic || 'On Institutional Record'}</span>
              </p>
              <p>
                <strong>Subject:</strong>{' '}
                <span className="underline font-bold">
                  Offer of Appointment as {designation} at {school.name}
                </span>
              </p>
            </div>

            {/* Particulars Table */}
            <div className="border border-slate-300 rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left border-collapse">
                <tbody>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="py-2 px-3 font-bold text-slate-700 w-1/3 border-r border-slate-200">
                      Faculty Name
                    </th>
                    <td className="py-2 px-3 font-semibold text-slate-950">{teacherName}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <th className="py-2 px-3 font-bold text-slate-700 border-r border-slate-200">
                      Father&apos;s Name
                    </th>
                    <td className="py-2 px-3 text-slate-900">{fatherName || '—'}</td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="py-2 px-3 font-bold text-slate-700 border-r border-slate-200">
                      CNIC Number
                    </th>
                    <td className="py-2 px-3 font-mono text-slate-900">{cnic || '—'}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <th className="py-2 px-3 font-bold text-slate-700 border-r border-slate-200">
                      Designation / Post
                    </th>
                    <td className="py-2 px-3 font-bold text-indigo-950">{designation}</td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="py-2 px-3 font-bold text-slate-700 border-r border-slate-200">
                      Date of Joining
                    </th>
                    <td className="py-2 px-3 font-mono font-semibold text-slate-900">
                      {joiningDate || issueDate}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <th className="py-2 px-3 font-bold text-slate-700 border-r border-slate-200">
                      Assigned Class(es)
                    </th>
                    <td className="py-2 px-3 font-semibold text-slate-900">
                      {assignedClassesLabel || 'General Teaching & Co-Curricular Duties'}
                    </td>
                  </tr>
                  <tr>
                    <th className="py-2 px-3 font-bold text-slate-700 border-r border-slate-200">
                      Official Contact &amp; Email
                    </th>
                    <td className="py-2 px-3 text-slate-900">
                      {phone || '—'} · {email || '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Body & Terms */}
            <div className="text-xs sm:text-[13px] text-slate-800 space-y-3 leading-relaxed">
              <p>
                Dear <strong>{teacherName}</strong>,
              </p>
              <p>
                Following the verification of your academic and professional credentials by the school administration, we are pleased to offer you formal appointment as <strong>{designation}</strong> at <strong>{school.name}</strong> (SEMIS: <span className="font-mono">{school.semisCode || '—'}</span>), effective from <strong>{joiningDate || issueDate}</strong>.
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                  Standard Terms &amp; Conditions of Appointment
                </h3>
                <ol className="list-decimal list-inside space-y-1 text-xs text-slate-700">
                  <li>
                    <strong>Academic &amp; Classroom Duties:</strong> Conduct daily lessons, maintain syllabus diaries, mark student attendance registers accurately, and evaluate examinations/homework for the assigned section(s).
                  </li>
                  <li>
                    <strong>Attendance &amp; Punctuality:</strong> Strict adherence to institutional timings and working days in accordance with School Education &amp; Literacy Department / School Administration policy.
                  </li>
                  <li>
                    <strong>Conduct &amp; Safeguarding:</strong> Maintain high professional ethics, student safeguarding standards, and confidentiality of institutional and student records inside the PakEdu ERP.
                  </li>
                  <li>
                    <strong>Leave &amp; Notice Period:</strong> Leave applications must be submitted in advance per SELD/school rules; separation requires 30 days&apos; prior written notice.
                  </li>
                  <li>
                    <strong>Verification:</strong> This appointment remains subject to continued compliance with institutional regulations and authentic credential verification.
                  </li>
                </ol>
              </div>

              <p>
                Please sign below to acknowledge acceptance of this appointment offer and retain a copy for your service portfolio.
              </p>
            </div>

            {/* Signature Lines */}
            <div className="pt-10 grid grid-cols-2 gap-8 text-xs text-slate-800">
              <div className="space-y-1">
                <div className="border-b border-slate-900 w-4/5 h-8" />
                <div className="font-bold">{teacherName}</div>
                <div className="text-[11px] text-slate-500">
                  Appointed Faculty Signature &amp; Date
                </div>
              </div>

              <div className="space-y-1 text-right flex flex-col items-end">
                <div className="border-b border-slate-900 w-4/5 h-8" />
                <div className="font-bold">
                  {school.primaryAdminName || 'Principal / Head Administrator'}
                </div>
                <div className="text-[11px] text-slate-500">
                  Principal / Admin Signature &amp; School Stamp
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
