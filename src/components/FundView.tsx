import React, { useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import {
  MIN_ADD_FUND,
  UPI_ID,
  UPI_QR_IMAGE_PATH,
  type UtrFundRequest,
} from '../data/services';
import {
  formatIndianDateTime,
  getUtrStatusBadgeStyle,
  validateFundAmount,
  validateUtrInput,
} from '../utils/panelLogic';
import { BhimUpiLogo, GPayLogo, PhonePeLogo } from './BrandIcons';

interface FundViewProps {
  uid: string;
  utrRequests: UtrFundRequest[];
  checkoutAmount: number | null;
  onOpenCheckout: (amount: number) => void;
  onCloseCheckout: () => void;
  onBack: () => void;
  onShowToast: (message: string, isError?: boolean) => void;
  onSubmitUtr: (payload: {
    amount: number;
    utr: string;
    app: string;
  }) => Promise<boolean>;
  onPlaySound: () => void;
}

type UpiApp = 'GPay' | 'PhonePe' | 'BHIM';

export function FundView({
  uid,
  utrRequests,
  checkoutAmount,
  onOpenCheckout,
  onCloseCheckout,
  onBack,
  onShowToast,
  onSubmitUtr,
  onPlaySound,
}: FundViewProps) {
  const [amountRaw, setAmountRaw] = useState('');
  const [selectedApp, setSelectedApp] = useState<UpiApp>('GPay');
  const [utrInput, setUtrInput] = useState('');
  const [submittingUtr, setSubmittingUtr] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [qrImgError, setQrImgError] = useState(false);

  const upiId = UPI_ID;

  const handlePayNow = (e: React.FormEvent) => {
    e.preventDefault();
    onPlaySound();
    const result = validateFundAmount(amountRaw);
    if (!result.ok) {
      onShowToast(result.message, true);
      return;
    }
    onShowToast(`Scanner Ready ₹${result.amount} • Pay & Enter UTR`);
    onOpenCheckout(result.amount);
  };

  const handleCopyUpi = () => {
    onPlaySound();
    navigator.clipboard?.writeText(upiId).catch(() => {});
    setCopiedUpi(true);
    onShowToast(`UPI ID Copied ✅ ${upiId}`);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleUtrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checkoutAmount === null) return;
    onPlaySound();

    const utrCheck = validateUtrInput(utrInput);
    if (!utrCheck.ok) {
      onShowToast(utrCheck.message, true);
      return;
    }

    setSubmittingUtr(true);
    const ok = await onSubmitUtr({
      amount: checkoutAmount,
      utr: utrCheck.utr,
      app: selectedApp,
    });
    setSubmittingUtr(false);

    if (ok) {
      setUtrInput('');
      setAmountRaw('');
      onCloseCheckout();
    }
  };

  return (
    <section aria-labelledby="add-funds-heading">
      <button
        type="button"
        onClick={onBack}
        className="text-[#3a1d6d] font-bold text-[17px] mt-[8px] mb-[6px] inline-flex items-center gap-[6px] cursor-pointer min-h-[40px] focus-visible:outline-2 focus-visible:outline-[#7c4dff]"
      >
        ← Back
      </button>

      <h1
        id="add-funds-heading"
        className="text-[22px] font-extrabold text-[#3a1d6d] text-center my-[14px] mb-[18px]"
      >
        Add Funds
      </h1>

      <form
        noValidate
        onSubmit={handlePayNow}
        className="bg-white rounded-[22px] p-[16px] mt-[12px] shadow-[0_6px_18px_rgba(0,0,0,0.08)] text-center"
      >
        <div className="text-[#2e7d32] font-extrabold text-[15px]">
          All UPI Payment Accepted ✅
        </div>

        <div className="grid grid-cols-3 gap-[10px] my-[12px]">
          {(
            [
              { id: 'GPay', node: <GPayLogo /> },
              { id: 'PhonePe', node: <PhonePeLogo /> },
              { id: 'BHIM', node: <BhimUpiLogo /> },
            ] as const
          ).map((item) => {
            const active = selectedApp === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onPlaySound();
                  setSelectedApp(item.id);
                }}
                aria-pressed={active}
                className={`bg-white rounded-[12px] p-[10px] text-center shadow-[0_2px_8px_rgba(0,0,0,0.06)] cursor-pointer border-2 transition-colors focus-visible:outline-2 focus-visible:outline-[#7c4dff] ${
                  active ? 'border-[#7c4dff] bg-[#f8f5ff]' : 'border-transparent'
                }`}
              >
                {item.node}
                <div className="text-[11px] font-bold mt-[4px] text-[#2d1b4e]">
                  {item.id}
                </div>
              </button>
            );
          })}
        </div>

        <label htmlFor="fund-amt-input" className="sr-only">
          Enter Amount (Min ₹{MIN_ADD_FUND})
        </label>
        <input
          id="fund-amt-input"
          type="number"
          min={MIN_ADD_FUND}
          step="any"
          value={amountRaw}
          onChange={(e) => setAmountRaw(e.target.value)}
          placeholder={`Enter Amount (Min ₹${MIN_ADD_FUND})`}
          className="w-full p-[13px] border-2 border-[#e9dffc] rounded-[12px] outline-none mt-[10px] text-[14px] text-[#2d1b4e] focus:border-[#7c4dff]"
        />

        <div className="text-[14px] font-bold text-[#3a1d6d] mt-[10px]">
          Payment method: Instant UPI ({selectedApp})
        </div>

        <div className="mt-[10px] flex items-center justify-between gap-2 bg-[#f8f5ff] border border-[#e9dffc] rounded-[12px] px-3 py-2 text-[12px]">
          <span className="text-[#555] font-semibold">
            UPI ID: <strong className="text-[#2d1b4e]">{upiId}</strong>
          </span>
          <button
            type="button"
            onClick={handleCopyUpi}
            className="inline-flex items-center gap-1 text-[#7c4dff] font-bold cursor-pointer shrink-0"
          >
            {copiedUpi ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedUpi ? 'Copied' : 'Copy'}
          </button>
        </div>

        <button
          type="submit"
          className="w-full bg-[#7c4dff] text-white border-0 p-[14px] rounded-[14px] font-extrabold text-[15px] mt-[14px] cursor-pointer active:scale-[0.98] transition-transform focus-visible:outline-2 focus-visible:outline-[#3a1d6d]"
        >
          Pay Now
        </button>
      </form>

      {utrRequests.length > 0 && (
        <div className="mt-4">
          <h2 className="text-[16px] font-extrabold text-[#3a1d6d] mb-2 px-1">
            Payment & UTR Status
          </h2>
          <div className="space-y-2.5" data-testid="user-utr-list">
            {utrRequests.map((req) => {
              const badge = getUtrStatusBadgeStyle(req.status);
              return (
                <div
                  key={req.id}
                  className="bg-white rounded-[16px] p-[12px] border-l-4 border-[#7c4dff] shadow-[0_4px_12px_rgba(60,20,120,0.06)]"
                >
                  <div className="flex justify-between items-center gap-2">
                    <strong className="text-[15px] text-[#2d1b4e] tabular-nums">
                      ₹{req.amount.toFixed(2)} ({req.app})
                    </strong>
                    <span
                      style={{ backgroundColor: badge.bg, color: badge.color }}
                      className="px-[8px] py-[3px] rounded-[10px] text-[11px] font-extrabold whitespace-nowrap shrink-0"
                    >
                      {badge.label}
                    </span>
                  </div>
                  <div className="text-[12px] font-bold text-[#7c4dff] mt-1">
                    UTR: {req.utr}
                  </div>
                  {req.adminMessage && (
                    <div
                      className={`text-[12px] font-semibold mt-1 ${
                        req.status === 'wrong_payment'
                          ? 'text-[#c62828]'
                          : 'text-[#2e7d32]'
                      }`}
                    >
                      {req.adminMessage}
                    </div>
                  )}
                  <div className="text-[11px] text-[#666666] mt-0.5 tabular-nums">
                    {req.createdAt ? formatIndianDateTime(req.createdAt) : req.date}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {checkoutAmount !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="upi-checkout-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) onCloseCheckout();
          }}
          className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 overflow-y-auto"
        >
          <form
            noValidate
            onSubmit={handleUtrSubmit}
            className="modal-pop-anim bg-white rounded-[22px] p-5 w-full max-w-[380px] shadow-[0_20px_40px_rgba(0,0,0,0.3)] text-center my-auto"
          >
            <div className="flex justify-between items-center mb-3">
              <h2 id="upi-checkout-title" className="text-[#3a1d6d] font-extrabold text-[18px]">
                Scan & Pay via UPI
              </h2>
              <button
                type="button"
                aria-label="Close payment modal"
                onClick={onCloseCheckout}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#666] hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#f8f5ff] border border-[#e9dffc] rounded-[16px] p-3.5">
              <div className="text-[12px] font-semibold text-[#555]">
                Paying via {selectedApp} • ID: <span className="text-[#7c4dff]">{uid}</span>
              </div>
              <div className="text-[26px] font-extrabold text-[#3a1d6d] my-1 tabular-nums">
                ₹{checkoutAmount.toFixed(2)}
              </div>

              <div className="my-2">
                {!qrImgError ? (
                  <img
                    src={UPI_QR_IMAGE_PATH}
                    alt={`UPI QR Code for ${upiId}`}
                    referrerPolicy="no-referrer"
                    onError={() => setQrImgError(true)}
                    className="w-48 h-48 mx-auto rounded-[16px] object-contain bg-black p-1.5 shadow-sm"
                  />
                ) : (
                  <div className="w-44 h-44 mx-auto rounded-[16px] bg-black text-white flex flex-col items-center justify-center p-4">
                    <span className="text-xs text-[#ffeb3b] font-bold">Scan & Pay via UPI</span>
                    <span className="text-sm font-extrabold mt-1">{upiId}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 bg-white border border-[#e9dffc] rounded-[12px] px-3 py-2 text-[12px]">
                <span className="font-bold text-[#2d1b4e] truncate">{upiId}</span>
                <button
                  type="button"
                  onClick={handleCopyUpi}
                  className="inline-flex items-center gap-1 text-[#7c4dff] font-bold cursor-pointer shrink-0"
                >
                  {copiedUpi ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedUpi ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="mt-3 text-left">
              <label
                htmlFor="utr-number-input"
                className="block text-[13px] font-bold text-[#3a1d6d] mb-1"
              >
                Enter UTR / Reference Number (After Pay)
              </label>
              <input
                id="utr-number-input"
                type="text"
                value={utrInput}
                onChange={(e) => setUtrInput(e.target.value)}
                placeholder="Enter 12-digit UTR Number"
                className="w-full p-[12px] border-2 border-[#e9dffc] rounded-[12px] outline-none text-[14px] text-[#2d1b4e] focus:border-[#7c4dff]"
              />
            </div>

            <button
              type="submit"
              disabled={submittingUtr}
              className="w-full bg-[#2e7d32] text-white border-0 p-[13px] rounded-[14px] font-extrabold text-[14px] mt-3 cursor-pointer active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {submittingUtr ? 'Submitting UTR...' : 'Submit UTR ✅'}
            </button>

            <button
              type="button"
              onClick={onCloseCheckout}
              className="w-full bg-[#f3edff] text-[#3a1d6d] border-0 p-[11px] rounded-[14px] font-bold text-[13px] mt-2 cursor-pointer"
            >
              Cancel Payment
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
