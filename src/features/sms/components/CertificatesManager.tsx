import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Download,
  Eye,
  FileBadge2,
  Loader2,
  Printer,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { useSms } from '../context/SmsContext';
import { CertificateType, StudentCertificate } from '../types';
import { triggerPrintDocument } from '../../../utils/printDocument';
import { exportA4ElementAsPdf } from '../../../utils/mobilePdfExport';

export const CertificatesManager: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const {
    students,
    certificates,
    saveCertificate,
    deleteCertificate,
    canManageCertificates,
    activeSchool,
    currentUserProfile,
  } = useSms();

  const [certType, setCertType] = useState<CertificateType>('transfer');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id || '');
  const [leavingDate, setLeavingDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [conduct, setConduct] = useState<string>('Very Good');
  const [reasonForLeaving, setReasonForLeaving] = useState<string>(
    'Promotion to next institution / Parent transfer'
  );
  const [duesCleared, setDuesCleared] = useState<boolean>(true);
  const [remarks, setRemarks] = useState<string>(
    'Bears good moral character and observed discipline throughout attendance.'
  );
  const [historySearch, setHistorySearch] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const [previewCert, setPreviewCert] = useState<StudentCertificate | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);
  const certSheetRef = useRef<HTMLDivElement | null>(null);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) || null,
    [students, selectedStudentId]
  );

  const filteredCertificates = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return certificates
      .filter((c) => {
        if (!q) return true;
        return (
          c.studentName.toLowerCase().includes(q) ||
          c.grNumber.toLowerCase().includes(q) ||
          c.certificateNumber.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || ''));
  }, [certificates, historySearch]);

  if (!canManageCertificates) {
    return (
      <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-8 text-center space-y-3">
        <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-base font-bold text-[#1C1917] dark:text-[#FAF8F5]">
          Administrator Access Required
        </h2>
        <p className="text-xs text-[#57534E] max-w-md mx-auto">
          Issuing official Transfer Certificates (TC) and Character Certificates is restricted to verified School Administrators and Principals.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] px-4 py-2 bg-[#7F1D1D] text-white text-xs font-semibold rounded-xl cursor-pointer"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const handleIssueCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!selectedStudent) {
      setFormError('Please select a student from the General Register first.');
      return;
    }

    setIsGenerating(true);
    try {
      const prefix = certType === 'transfer' ? 'TC' : 'CC';
      const seq = String(certificates.length + 1).padStart(3, '0');
      const year = new Date().getFullYear();
      const certificateNumber = `${prefix}-${year}-${seq}`;
      const id = `cert_${prefix.toLowerCase()}_${Date.now().toString(36)}`;
      const issueDate = new Date().toISOString().split('T')[0];

      const record: Omit<StudentCertificate, 'schoolId'> = {
        id,
        certificateNumber,
        type: certType,
        studentId: selectedStudent.id,
        studentName: selectedStudent.fullName,
        fatherName: selectedStudent.fatherName,
        grNumber: selectedStudent.grNumber,
        classId: selectedStudent.classId,
        grade: selectedStudent.grade,
        section: selectedStudent.section,
        dob: selectedStudent.dob,
        admissionDate: selectedStudent.admissionDate,
        leavingDate: certType === 'transfer' ? leavingDate : undefined,
        conduct,
        reasonForLeaving: certType === 'transfer' ? reasonForLeaving.trim() : undefined,
        duesCleared,
        remarks: remarks.trim() || undefined,
        issuedByUid: currentUserProfile?.uid || 'admin',
        issuedByName:
          currentUserProfile?.fullName || activeSchool.primaryAdminName || 'Principal',
        issueDate,
      };

      const ok = await saveCertificate(record);
      if (ok) {
        setPreviewCert({ ...record, schoolId: activeSchool.id });
        setPdfNotice(null);
      } else {
        setFormError('Failed to save certificate record. Please retry.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMobilePdfExport = async () => {
    if (!certSheetRef.current || !previewCert) return;
    setIsExportingPdf(true);
    setPdfNotice(null);
    try {
      const slug = previewCert.grNumber.replace(/[^a-zA-Z0-9_-]/g, '-');
      await exportA4ElementAsPdf(
        certSheetRef.current,
        `${previewCert.certificateNumber}-${slug}.pdf`
      );
      setPdfNotice('Certificate A4 PDF saved / ready to share.');
    } catch {
      triggerPrintDocument();
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Banner */}
      <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#FAF8F5] hover:bg-[#F3EFEA] dark:hover:bg-[#3F1014] rounded-xl transition cursor-pointer shrink-0"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                  Official Certificates (TC &amp; Character)
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FEF2F2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5] border border-[#FECACA] dark:border-[#7F1D1D]/60">
                  Admin Only · A4 Print
                </span>
              </div>
              <p className="text-xs text-[#57534E] dark:text-[#D6CCC2] mt-0.5">
                {activeSchool.name} · Issue Transfer Certificates (SLC) and Character Certificates with Mobile PDF Export
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Generator Card */}
      <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setCertType('transfer')}
            className={`min-h-[44px] px-4 py-2.5 rounded-xl border-2 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
              certType === 'transfer'
                ? 'border-[#7F1D1D] bg-[#FEF2F2] dark:bg-[#3F1014]/50 text-[#7F1D1D] dark:text-[#FCA5A5]'
                : 'border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-[#57534E] dark:text-[#D6CCC2]'
            }`}
          >
            <FileBadge2 className="w-4 h-4" />
            <span>Transfer Certificate (TC / School Leaving)</span>
          </button>

          <button
            type="button"
            onClick={() => setCertType('character')}
            className={`min-h-[44px] px-4 py-2.5 rounded-xl border-2 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
              certType === 'character'
                ? 'border-[#7F1D1D] bg-[#FEF2F2] dark:bg-[#3F1014]/50 text-[#7F1D1D] dark:text-[#FCA5A5]'
                : 'border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] text-[#57534E] dark:text-[#D6CCC2]'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Character Certificate</span>
          </button>
        </div>

        {formError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300">
            {formError}
          </div>
        )}

        <form onSubmit={handleIssueCertificate} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                Select Student (GR Register) *
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs font-semibold text-[#1C1917] dark:text-[#FAF8F5] cursor-pointer"
                required
              >
                <option value="">-- Choose Student --</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.grNumber} — {s.fullName} ({s.grade} {s.section})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                Conduct / Character Assessment *
              </label>
              <select
                value={conduct}
                onChange={(e) => setConduct(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs font-semibold text-[#1C1917] dark:text-[#FAF8F5] cursor-pointer"
              >
                <option value="Excellent">Excellent</option>
                <option value="Very Good">Very Good</option>
                <option value="Good">Good</option>
                <option value="Satisfactory">Satisfactory</option>
              </select>
            </div>

            {certType === 'transfer' ? (
              <div>
                <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                  Date of Leaving *
                </label>
                <input
                  type="date"
                  value={leavingDate}
                  onChange={(e) => setLeavingDate(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5]"
                  required
                />
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                  Dues Status
                </label>
                <select
                  value={duesCleared ? 'cleared' : 'pending'}
                  onChange={(e) => setDuesCleared(e.target.value === 'cleared')}
                  className="w-full min-h-[44px] px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs font-semibold text-[#1C1917] dark:text-[#FAF8F5]"
                >
                  <option value="cleared">All School Dues Cleared</option>
                  <option value="pending">Pending Verification</option>
                </select>
              </div>
            )}
          </div>

          {certType === 'transfer' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                  Reason for Leaving
                </label>
                <input
                  type="text"
                  value={reasonForLeaving}
                  onChange={(e) => setReasonForLeaving(e.target.value)}
                  placeholder="e.g., Promotion to higher class / Guardian relocation"
                  className="w-full min-h-[44px] px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
                  Fee &amp; Library Clearance
                </label>
                <select
                  value={duesCleared ? 'cleared' : 'pending'}
                  onChange={(e) => setDuesCleared(e.target.value === 'cleared')}
                  className="w-full min-h-[44px] px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs font-semibold text-[#1C1917] dark:text-[#FAF8F5]"
                >
                  <option value="cleared">All Fee &amp; Library Dues Cleared</option>
                  <option value="pending">Pending Dues</option>
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
              Principal&apos;s Remarks / Certificate Note
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5]"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)]">
            {selectedStudent ? (
              <div className="text-[11px] text-[#57534E]">
                Selected: <strong className="text-[#1C1917] dark:text-[#FAF8F5]">{selectedStudent.fullName}</strong> · S/D/O {selectedStudent.fatherName} · GR <span className="font-mono">{selectedStudent.grNumber}</span>
              </div>
            ) : (
              <div className="text-[11px] text-[#78716C]">No student selected</div>
            )}

            <button
              type="submit"
              disabled={isGenerating || !selectedStudent}
              className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#7F1D1D] hover:bg-[#651414] text-white font-semibold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>
                {isGenerating
                  ? 'Issuing Certificate...'
                  : `Issue & Preview ${certType === 'transfer' ? 'Transfer Certificate' : 'Character Certificate'}`}
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* Issued Certificates Registry */}
      <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 sm:px-5 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5]">
            Issued Certificates Register ({filteredCertificates.length})
          </h2>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Search serial, student, GR#..."
              className="w-full min-h-[40px] pl-9 pr-3 py-1.5 bg-[#FAF8F5] dark:bg-[#2C1215] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-xl text-xs text-[#1C1917] dark:text-[#FAF8F5]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[680px] w-full text-xs text-left">
            <thead className="bg-[#FAF8F5] dark:bg-[#2C1215]/80 text-[11px] uppercase text-[#57534E]">
              <tr>
                <th className="py-3 px-4">Serial No</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Student &amp; GR</th>
                <th className="py-3 px-4">Class</th>
                <th className="py-3 px-4">Issue Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E0D4] dark:divide-[rgba(255,253,249,0.10)]">
              {filteredCertificates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#78716C]">
                    No certificates issued yet. Use the form above to generate an official A4 certificate.
                  </td>
                </tr>
              ) : (
                filteredCertificates.map((cert) => (
                  <tr key={cert.id} className="hover:bg-[#FAF8F5]/70 dark:hover:bg-[#3F1014]/40">
                    <td className="py-3 px-4 font-mono font-bold text-[#7F1D1D] dark:text-[#FCA5A5]">
                      {cert.certificateNumber}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          cert.type === 'transfer'
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                            : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {cert.type === 'transfer' ? 'Transfer (TC)' : 'Character'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                        {cert.studentName}
                      </div>
                      <div className="text-[11px] text-[#57534E] font-mono">{cert.grNumber}</div>
                    </td>
                    <td className="py-3 px-4">
                      {cert.grade} {cert.section ? `- ${cert.section}` : ''}
                    </td>
                    <td className="py-3 px-4 font-mono">{cert.issueDate}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewCert(cert);
                            setPdfNotice(null);
                          }}
                          className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1 bg-[#FEF2F2] dark:bg-[#3F1014]/60 text-[#7F1D1D] dark:text-[#FCA5A5] rounded-lg font-semibold cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Print / PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCertificate(cert.id)}
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                          title="Delete record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable A4 Certificate Modal (Mobile PDF + Desktop Print) */}
      {previewCert && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#2C1215]/75 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-4 max-h-[94dvh] flex flex-col">
            <div className="no-print sticky top-0 z-20 px-3 sm:px-5 py-3 bg-[#FAF8F5] dark:bg-[#2C1215]/95 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileBadge2 className="w-5 h-5 text-[#7F1D1D] shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-[#1C1917] dark:text-[#FAF8F5] truncate">
                    {previewCert.type === 'transfer'
                      ? 'Transfer Certificate (School Leaving Certificate)'
                      : 'Official Character Certificate'}
                  </h3>
                  <p className="text-[11px] text-[#57534E] font-mono truncate">
                    Serial: {previewCert.certificateNumber} · {previewCert.studentName}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleMobilePdfExport}
                  disabled={isExportingPdf}
                  className="min-h-[44px] sm:min-h-[38px] flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer disabled:opacity-60"
                >
                  {isExportingPdf ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>{isExportingPdf ? 'Saving PDF...' : 'Save / Share PDF'}</span>
                </button>
                <button
                  type="button"
                  onClick={triggerPrintDocument}
                  className="min-h-[44px] sm:min-h-[38px] flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#7F1D1D] hover:bg-[#651414] text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print A4</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewCert(null)}
                  className="min-h-[44px] sm:min-h-[38px] inline-flex items-center justify-center gap-1 px-3.5 py-2 bg-[#E7E0D4] dark:bg-[#3F1014] text-[#1C1917] dark:text-[#FAF8F5] text-xs font-semibold rounded-xl cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>Close</span>
                </button>
              </div>
            </div>

            {pdfNotice && (
              <div className="no-print px-4 py-2 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{pdfNotice}</span>
              </div>
            )}

            <div className="flex-1 overflow-auto p-3 sm:p-6 bg-[#F3EFEA] dark:bg-[#160D0E]">
              <div
                ref={certSheetRef}
                className="printable-a4-sheet bg-white text-[#1C1917] border-4 border-double border-[#58181D] shadow-lg mx-auto max-w-[794px] w-full p-6 sm:p-10 space-y-6"
              >
                {/* School Header */}
                <div className="border-b-2 border-[#58181D] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {activeSchool.logoUrl ? (
                      <img
                        src={activeSchool.logoUrl}
                        alt={activeSchool.name}
                        className="w-16 h-16 rounded-xl object-contain border border-[#E7E0D4] bg-white shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-[#58181D] text-white flex items-center justify-center font-black text-2xl shrink-0">
                        {activeSchool.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#7F1D1D]">
                        {activeSchool.board || 'School Education & Literacy Department'}
                      </div>
                      <h1 className="text-lg sm:text-xl font-black text-[#1C1917] uppercase">
                        {activeSchool.name}
                      </h1>
                      <p className="text-xs text-[#57534E]">
                        District {activeSchool.district || 'Sindh'} · SEMIS:{' '}
                        <span className="font-mono font-bold">
                          {activeSchool.semisCode || '—'}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right text-xs space-y-1 shrink-0">
                    <div className="font-mono font-bold text-[#7F1D1D]">
                      Certificate No: {previewCert.certificateNumber}
                    </div>
                    <div className="text-[#57534E]">Issue Date: {previewCert.issueDate}</div>
                    <div className="font-mono text-[11px] text-[#44403C]">
                      GR No: <strong>{previewCert.grNumber}</strong>
                    </div>
                  </div>
                </div>

                {/* Title */}
                <div className="text-center py-2">
                  <h2 className="inline-block px-6 py-2 border-2 border-[#58181D] bg-[#FEF2F2] text-sm sm:text-base font-black uppercase tracking-widest text-[#7F1D1D]">
                    {previewCert.type === 'transfer'
                      ? 'Transfer / School Leaving Certificate (TC)'
                      : 'Character Certificate'}
                  </h2>
                </div>

                {/* Body */}
                <p className="text-xs sm:text-sm text-[#1C1917] leading-relaxed text-justify">
                  It is certified that{' '}
                  <strong className="uppercase">{previewCert.studentName}</strong> son/daughter of{' '}
                  <strong className="uppercase">{previewCert.fatherName}</strong>, General Register No.{' '}
                  <strong className="font-mono">{previewCert.grNumber}</strong>, has been a bonafide student of this institution in{' '}
                  <strong>
                    {previewCert.grade}
                    {previewCert.section ? ` (${previewCert.section})` : ''}
                  </strong>
                  {previewCert.type === 'transfer'
                    ? ` and leaves this institution in good standing as per details recorded below.`
                    : ` and maintains an ${previewCert.conduct.toLowerCase()} record of conduct and character.`}
                </p>

                {/* Formal Particulars */}
                <div className="border border-[#D6CCC2] rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left border-collapse">
                    <tbody>
                      <tr className="border-b border-[#E7E0D4] bg-slate-50">
                        <th className="py-2 px-3 font-bold text-[#44403C] w-2/5 border-r border-[#E7E0D4]">
                          Student Full Name
                        </th>
                        <td className="py-2 px-3 font-bold text-[#1C1917]">
                          {previewCert.studentName}
                        </td>
                      </tr>
                      <tr className="border-b border-[#E7E0D4]">
                        <th className="py-2 px-3 font-bold text-[#44403C] border-r border-[#E7E0D4]">
                          Father&apos;s Name
                        </th>
                        <td className="py-2 px-3 text-[#1C1917]">{previewCert.fatherName}</td>
                      </tr>
                      <tr className="border-b border-[#E7E0D4] bg-slate-50">
                        <th className="py-2 px-3 font-bold text-[#44403C] border-r border-[#E7E0D4]">
                          General Register (GR) No.
                        </th>
                        <td className="py-2 px-3 font-mono font-bold text-[#1C1917]">
                          {previewCert.grNumber}
                        </td>
                      </tr>
                      <tr className="border-b border-[#E7E0D4]">
                        <th className="py-2 px-3 font-bold text-[#44403C] border-r border-[#E7E0D4]">
                          Date of Birth
                        </th>
                        <td className="py-2 px-3 font-mono text-[#1C1917]">
                          {previewCert.dob || 'As per GR Record'}
                        </td>
                      </tr>
                      <tr className="border-b border-[#E7E0D4] bg-slate-50">
                        <th className="py-2 px-3 font-bold text-[#44403C] border-r border-[#E7E0D4]">
                          Date of Admission
                        </th>
                        <td className="py-2 px-3 font-mono text-[#1C1917]">
                          {previewCert.admissionDate || 'As per GR Record'}
                        </td>
                      </tr>
                      <tr className="border-b border-[#E7E0D4]">
                        <th className="py-2 px-3 font-bold text-[#44403C] border-r border-[#E7E0D4]">
                          Class Last Attended
                        </th>
                        <td className="py-2 px-3 font-semibold text-[#1C1917]">
                          {previewCert.grade}
                          {previewCert.section ? ` - ${previewCert.section}` : ''}
                        </td>
                      </tr>
                      {previewCert.type === 'transfer' && (
                        <>
                          <tr className="border-b border-[#E7E0D4] bg-slate-50">
                            <th className="py-2 px-3 font-bold text-[#44403C] border-r border-[#E7E0D4]">
                              Date of Leaving School
                            </th>
                            <td className="py-2 px-3 font-mono text-[#1C1917]">
                              {previewCert.leavingDate || previewCert.issueDate}
                            </td>
                          </tr>
                          <tr className="border-b border-[#E7E0D4]">
                            <th className="py-2 px-3 font-bold text-[#44403C] border-r border-[#E7E0D4]">
                              Reason for Leaving
                            </th>
                            <td className="py-2 px-3 text-[#1C1917]">
                              {previewCert.reasonForLeaving || 'Parent Request'}
                            </td>
                          </tr>
                        </>
                      )}
                      <tr className="border-b border-[#E7E0D4] bg-slate-50">
                        <th className="py-2 px-3 font-bold text-[#44403C] border-r border-[#E7E0D4]">
                          Moral Conduct &amp; Discipline
                        </th>
                        <td className="py-2 px-3 font-bold text-[#7F1D1D]">
                          {previewCert.conduct}
                        </td>
                      </tr>
                      <tr>
                        <th className="py-2 px-3 font-bold text-[#44403C] border-r border-[#E7E0D4]">
                          School Dues Clearance
                        </th>
                        <td className="py-2 px-3 font-semibold text-emerald-800">
                          {previewCert.duesCleared
                            ? 'All School Fees & Dues Cleared'
                            : 'Subject to Clearance'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {previewCert.remarks && (
                  <p className="text-xs text-[#44403C] italic border-l-4 border-[#58181D] pl-3 py-1 bg-[#FAF8F5]">
                    &ldquo;{previewCert.remarks}&rdquo;
                  </p>
                )}

                {/* Signatures */}
                <div className="pt-12 grid grid-cols-2 gap-8 text-xs text-[#1C1917]">
                  <div className="space-y-1">
                    <div className="border-b border-[#1C1917] w-3/4 h-7" />
                    <div className="font-bold">Class Incharge / Clerk</div>
                    <div className="text-[11px] text-[#57534E]">Prepared &amp; Verified By</div>
                  </div>
                  <div className="space-y-1 text-right flex flex-col items-end">
                    <div className="border-b border-[#1C1917] w-3/4 h-7" />
                    <div className="font-bold">
                      {previewCert.issuedByName || 'Principal / Head Administrator'}
                    </div>
                    <div className="text-[11px] text-[#57534E]">
                      Principal Signature &amp; Official Seal
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
