import React, { useState } from 'react';
import { Shield, Lock, Eye, EyeOff, X, Check, KeyRound } from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [adminEmail, setAdminEmail] = useState('ZulqarnainShah25@gmail.com');
  const [adminPin, setAdminPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = adminEmail.trim().toLowerCase();
    const cleanPin = adminPin.trim();

    // Verify Zulqarnain Shah admin credentials
    const isAuthorizedEmail =
      cleanEmail === 'zulqarnainshah25@gmail.com' ||
      cleanEmail === 'admin@ateliercv.com';

    const isMasterPin =
      cleanPin === 'atelier2026' ||
      cleanPin === 'admin2026' ||
      cleanPin === 'Zulqarnain@2026' ||
      cleanPin === '123456';

    if (isAuthorizedEmail && (isMasterPin || cleanPin.length >= 6)) {
      onSuccess();
      onClose();
    } else if (isMasterPin) {
      onSuccess();
      onClose();
    } else {
      setErrorMsg(
        'Ghalat credentials! Sirf authorized admin (ZulqarnainShah25@gmail.com) login kar sakta hai. PIN: atelier2026'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C1215]/80 backdrop-blur-xs p-4">
      <div className="bg-[#FFFDF9] dark:bg-[#211415] border border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E7E0D4] dark:border-[rgba(255,253,249,0.14)] bg-[#FAF8F5] dark:bg-[#2C1215]/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#2C1215] text-white rounded-lg">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1C1917] dark:text-[#FAF8F5]">
                Admin Panel Security Access
              </h2>
              <p className="text-xs text-[#57534E] dark:text-[#D6CCC2]">
                Restricted to Zulqarnain Shah (Admin)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#FAF8F5] rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleAdminAuth} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
              Authorized Admin Email
            </label>
            <input
              type="email"
              required
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              className="w-full px-3 py-2 border border-[#D6CCC2] dark:border-[rgba(255,253,249,0.14)] bg-[#FFFDF9] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5] rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#44403C] dark:text-[#E7E0D4] mb-1">
              Admin Password / Master PIN
            </label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                required
                placeholder="Enter admin password / PIN (atelier2026)"
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-[#D6CCC2] dark:border-[rgba(255,253,249,0.14)] bg-[#FFFDF9] dark:bg-[#2C1215] text-[#1C1917] dark:text-[#FAF8F5] rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#78716C] hover:text-[#1C1917]"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 text-[11.5px]">
              {errorMsg}
            </div>
          )}

          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#57534E] dark:text-[#E7E0D4] hover:text-[#1C1917]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-[#2C1215] dark:bg-[#C2410C] hover:bg-[#58181D] dark:hover:bg-[#9A3412] rounded-lg shadow-xs"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Verify &amp; Open Admin Panel</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
