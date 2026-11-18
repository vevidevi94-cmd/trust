import React, { useState } from 'react';
import { Copy, Lock, ReceiptText, ShieldCheck, Wallet, X } from 'lucide-react';
import { PlatformIcon } from './BrandIcons';

interface MenuViewProps {
  uid: string;
  isAdminLoggedIn: boolean;
  adminLoginOpen: boolean;
  onOpenAdminLogin: () => void;
  onCloseAdminLogin: () => void;
  onSubmitAdminLogin: (password: string) => Promise<boolean>;
  onOpenAdminPanel: () => void;
  onCopyUid: () => void;
  onSupportClick: () => void;
  onGoOrders: () => void;
  onGoFund: () => void;
}

export function MenuView({
  uid,
  isAdminLoggedIn,
  adminLoginOpen,
  onOpenAdminLogin,
  onCloseAdminLogin,
  onSubmitAdminLogin,
  onOpenAdminPanel,
  onCopyUid,
  onSupportClick,
  onGoOrders,
  onGoFund,
}: MenuViewProps) {
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleAdminCardClick = () => {
    if (isAdminLoggedIn) {
      onOpenAdminPanel();
    } else {
      onOpenAdminLogin();
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    const ok = await onSubmitAdminLogin(password);
    setVerifying(false);
    if (ok) {
      setPassword('');
    }
  };

  return (
    <section aria-labelledby="my-profile-heading">
      <h1
        id="my-profile-heading"
        className="text-[32px] font-extrabold text-[#3a1d6d] text-center my-[16px] mb-[18px]"
      >
        My Profile
      </h1>

      <div className="bg-black rounded-[24px] px-[20px] py-[18px] text-center relative">
        <div className="text-[12px] text-[#ffeb3b]/80 font-medium">Your User ID</div>
        <div
          data-testid="user-id-value"
          className="text-[26px] font-extrabold text-[#ffeb3b] mt-[4px] tabular-nums"
        >
          {uid}
        </div>
        <button
          type="button"
          onClick={onCopyUid}
          aria-label={`Copy User ID ${uid}`}
          className="absolute right-[12px] top-1/2 -translate-y-1/2 bg-[#222222] text-[#ffeb3b] border border-[#333333] w-[38px] h-[38px] rounded-[12px] flex items-center justify-center cursor-pointer active:scale-95 transition-transform focus-visible:outline-2 focus-visible:outline-[#ffeb3b]"
        >
          <Copy className="w-[17px] h-[17px]" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-[16px] space-y-[14px]">
        <button
          type="button"
          onClick={onSupportClick}
          className="w-full bg-white rounded-[22px] p-[16px] flex justify-between items-center shadow-[0_8px_20px_rgba(60,20,120,0.08)] cursor-pointer transition-transform duration-150 active:scale-[0.97] text-left focus-visible:outline-2 focus-visible:outline-[#7c4dff]"
        >
          <div className="flex items-center gap-[12px]">
            <PlatformIcon kind="telegram" size={46} />
            <span className="text-[16px] text-[#2d1b4e] font-bold">Telegram Support</span>
          </div>
          <span className="text-[#7c4dff] text-[24px] font-extrabold leading-none" aria-hidden="true">
            ›
          </span>
        </button>

        <button
          type="button"
          onClick={onGoOrders}
          className="w-full bg-white rounded-[22px] p-[16px] flex justify-between items-center shadow-[0_8px_20px_rgba(60,20,120,0.08)] cursor-pointer transition-transform duration-150 active:scale-[0.97] text-left focus-visible:outline-2 focus-visible:outline-[#7c4dff]"
        >
          <div className="flex items-center gap-[12px]">
            <div className="w-[46px] h-[46px] bg-[#ede7ff] rounded-[12px] flex items-center justify-center shrink-0">
              <ReceiptText className="w-[22px] h-[22px] text-[#7c4dff]" aria-hidden="true" />
            </div>
            <span className="text-[16px] text-[#2d1b4e] font-bold">My Orders</span>
          </div>
          <span className="text-[#7c4dff] text-[24px] font-extrabold leading-none" aria-hidden="true">
            ›
          </span>
        </button>

        <button
          type="button"
          onClick={onGoFund}
          className="w-full bg-white rounded-[22px] p-[16px] flex justify-between items-center shadow-[0_8px_20px_rgba(60,20,120,0.08)] cursor-pointer transition-transform duration-150 active:scale-[0.97] text-left focus-visible:outline-2 focus-visible:outline-[#7c4dff]"
        >
          <div className="flex items-center gap-[12px]">
            <div className="w-[46px] h-[46px] bg-[#fff7e0] rounded-[12px] flex items-center justify-center shrink-0">
              <Wallet className="w-[22px] h-[22px] text-[#ff9800]" aria-hidden="true" />
            </div>
            <span className="text-[16px] text-[#2d1b4e] font-bold">Add Funds</span>
          </div>
          <span className="text-[#7c4dff] text-[24px] font-extrabold leading-none" aria-hidden="true">
            ›
          </span>
        </button>

        <button
          type="button"
          onClick={handleAdminCardClick}
          className="w-full bg-white rounded-[22px] p-[16px] flex justify-between items-center shadow-[0_8px_20px_rgba(60,20,120,0.08)] cursor-pointer transition-transform duration-150 active:scale-[0.97] text-left focus-visible:outline-2 focus-visible:outline-[#7c4dff]"
        >
          <div className="flex items-center gap-[12px]">
            <div className="w-[46px] h-[46px] bg-[#1a1033] rounded-[12px] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-[22px] h-[22px] text-[#ffeb3b]" aria-hidden="true" />
            </div>
            <div>
              <div className="text-[16px] text-[#2d1b4e] font-bold">Admin Panel</div>
              {isAdminLoggedIn && (
                <div className="text-[11px] font-semibold text-[#2e7d32]">Logged In</div>
              )}
            </div>
          </div>
          <span className="text-[#7c4dff] text-[24px] font-extrabold leading-none" aria-hidden="true">
            ›
          </span>
        </button>
      </div>

      {adminLoginOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-login-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) onCloseAdminLogin();
          }}
          className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleLoginSubmit}
            className="modal-pop-anim bg-white rounded-[22px] p-5 w-full max-w-[360px] shadow-[0_20px_40px_rgba(0,0,0,0.3)]"
          >
            <div className="flex justify-between items-center mb-3">
              <h2
                id="admin-login-title"
                className="text-[#3a1d6d] font-extrabold text-[18px] flex items-center gap-2"
              >
                <Lock className="w-5 h-5 text-[#7c4dff]" aria-hidden="true" />
                <span>Admin Login</span>
              </h2>
              <button
                type="button"
                aria-label="Close Admin Login"
                onClick={onCloseAdminLogin}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#888] hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <label
              htmlFor="admin-password-input"
              className="block text-[13px] font-bold text-[#3a1d6d] mb-1"
            >
              Enter Admin Password
            </label>
            <input
              id="admin-password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter Password"
              className="w-full p-[13px] border-2 border-[#e9dffc] rounded-[12px] outline-none text-[14px] text-[#2d1b4e] focus:border-[#7c4dff]"
              autoFocus
            />

            <button
              type="submit"
              disabled={verifying}
              className="w-full bg-[#7c4dff] text-white border-0 p-[13px] rounded-[14px] font-extrabold text-[15px] mt-4 cursor-pointer active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {verifying ? 'Checking...' : 'Open Admin Panel'}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
