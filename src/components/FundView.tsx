import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ImagePlus, Loader2, ShieldCheck, X } from 'lucide-react';
import {
  MIN_ADD_FUND,
  type PaymentFundRequest,
} from '../data/services';
import {
  formatIndianDateTime,
  getPaymentStatusBadgeStyle,
  validateFundAmount,
  validatePaymentScreenshot,
} from '../utils/panelLogic';
import { BhimUpiLogo, GPayLogo, PhonePeLogo } from './BrandIcons';

export interface CheckoutSessionState {
  amount: number;
  qrToken: string;
}

interface FundViewProps {
  uid: string;
  paymentRequests: PaymentFundRequest[];
  checkoutSession: CheckoutSessionState | null;
  onOpenCheckout: (amount: number) => Promise<void>;
  onCloseCheckout: () => void;
  onBack: () => void;
  onShowToast: (message: string, isError?: boolean) => void;
  onSubmitScreenshot: (payload: {
    amount: number;
    screenshot: string;
    app: string;
  }) => Promise<boolean>;
  onPlaySound: () => void;
}

type UpiApp = 'GPay' | 'PhonePe' | 'BHIM';

function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      const rawUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawUrl.startsWith('data:image/')) {
        reject(new Error('Invalid image file'));
        return;
      }

      const img = new Image();
      img.onerror = () => {
        // Fallback to raw data URL if browser cannot re-encode
        resolve(rawUrl);
      };
      img.onload = () => {
        const maxDim = 960;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.8);
        resolve(compressed.length < rawUrl.length ? compressed : rawUrl);
      };
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
  });
}

export function FundView({
  uid,
  paymentRequests,
  checkoutSession,
  onOpenCheckout,
  onCloseCheckout,
  onBack,
  onShowToast,
  onSubmitScreenshot,
  onPlaySound,
}: FundViewProps) {
  const [amountRaw, setAmountRaw] = useState('');
  const [selectedApp, setSelectedApp] = useState<UpiApp>('GPay');
  const [openingCheckout, setOpeningCheckout] = useState(false);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string>('');
  const [screenshotName, setScreenshotName] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState(false);

  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fetchedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!checkoutSession?.qrToken) {
      fetchedTokenRef.current = null;
      return;
    }

    const token = checkoutSession.qrToken;
    if (fetchedTokenRef.current === token) return;
    fetchedTokenRef.current = token;

    let cancelled = false;
    setQrLoading(true);
    setQrError(false);

    fetch(`/api/fund/qr?token=${encodeURIComponent(token)}`, {
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('QR fetch failed');
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          if (cancelled) return;
          const canvas = qrCanvasRef.current;
          if (!canvas) return;

          // Crop top QR square region cleanly so bottom UPI ID caption is not rendered in canvas
          const cropHeight = Math.floor(img.naturalHeight * 0.835);
          const cropWidth = img.naturalWidth;
          canvas.width = cropWidth;
          canvas.height = cropHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, cropWidth, cropHeight);
            ctx.drawImage(img, 0, 0, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
          }
          setQrLoading(false);
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          if (!cancelled) {
            setQrError(true);
            setQrLoading(false);
          }
        };
        img.src = objectUrl;
      })
      .catch(() => {
        if (!cancelled) {
          setQrError(true);
          setQrLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [checkoutSession?.qrToken]);

  const handlePayNow = async (e: React.FormEvent) => {
    e.preventDefault();
    onPlaySound();
    const result = validateFundAmount(amountRaw);
    if (!result.ok) {
      onShowToast(result.message, true);
      return;
    }
    setOpeningCheckout(true);
    setScreenshotDataUrl('');
    setScreenshotName('');
    await onOpenCheckout(result.amount);
    setOpeningCheckout(false);
  };

  const handleScreenshotChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onShowToast('Sirf image screenshot upload karo ❌', true);
      return;
    }
    try {
      const compressed = await compressImageFile(file);
      const check = validatePaymentScreenshot(compressed);
      if (!check.ok) {
        onShowToast(check.message, true);
        return;
      }
      setScreenshotDataUrl(check.screenshot);
      setScreenshotName(file.name);
      onPlaySound();
    } catch {
      onShowToast('Screenshot read failed ❌ Try another image', true);
    }
  };

  const handleScreenshotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutSession) return;
    onPlaySound();

    const check = validatePaymentScreenshot(screenshotDataUrl);
    if (!check.ok) {
      onShowToast(check.message, true);
      return;
    }

    setSubmitting(true);
    const ok = await onSubmitScreenshot({
      amount: checkoutSession.amount,
      screenshot: check.screenshot,
      app: selectedApp,
    });
    setSubmitting(false);

    if (ok) {
      setScreenshotDataUrl('');
      setScreenshotName('');
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

        <div className="mt-[10px] flex items-center justify-center gap-1.5 bg-[#f8f5ff] border border-[#e9dffc] rounded-[12px] px-3 py-2 text-[12px] text-[#3a1d6d] font-semibold">
          <ShieldCheck className="w-4 h-4 text-[#2e7d32] shrink-0" aria-hidden="true" />
          <span>Secure UPI Scanner • Pay & Upload Screenshot</span>
        </div>

        <button
          type="submit"
          disabled={openingCheckout}
          className="w-full bg-[#7c4dff] text-white border-0 p-[14px] rounded-[14px] font-extrabold text-[15px] mt-[14px] cursor-pointer active:scale-[0.98] transition-transform disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[#3a1d6d]"
        >
          {openingCheckout ? 'Opening Scanner...' : 'Pay Now'}
        </button>
      </form>

      {paymentRequests.length > 0 && (
        <div className="mt-4">
          <h2 className="text-[16px] font-extrabold text-[#3a1d6d] mb-2 px-1">
            Payment & Verification Status
          </h2>
          <div className="space-y-2.5" data-testid="user-payment-list">
            {paymentRequests.map((req) => {
              const badge = getPaymentStatusBadgeStyle(req.status);
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
                    Payment Screenshot Submitted ✅
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

      {checkoutSession && (
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
            onSubmit={handleScreenshotSubmit}
            onContextMenu={(e) => e.preventDefault()}
            className="modal-pop-anim bg-white rounded-[22px] p-5 w-full max-w-[380px] shadow-[0_20px_40px_rgba(0,0,0,0.3)] text-center my-auto select-none"
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
                ₹{checkoutSession.amount.toFixed(2)}
              </div>

              <div className="my-2 flex items-center justify-center">
                <div className="relative w-48 h-48 rounded-[16px] bg-black p-2 shadow-sm flex items-center justify-center overflow-hidden">
                  <canvas
                    ref={qrCanvasRef}
                    aria-label="Protected UPI QR Code"
                    draggable={false}
                    className={`w-full h-full object-contain rounded-[10px] pointer-events-none ${
                      qrLoading || qrError ? 'opacity-0' : 'opacity-100'
                    }`}
                  />
                  {qrLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-xs gap-1.5">
                      <Loader2 className="w-6 h-6 animate-spin text-[#ffeb3b]" />
                      <span>Loading Scanner...</span>
                    </div>
                  )}
                  {qrError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-xs p-3">
                      <span className="text-[#ffeb3b] font-bold">Scanner Unavailable</span>
                      <span className="mt-1 opacity-80">Close & tap Pay Now again</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-[11px] font-semibold text-[#555] mt-1">
                Scan QR with PhonePe / GPay / Paytm / BHIM
              </div>
            </div>

            <div className="mt-3 text-left">
              <label
                htmlFor="payment-screenshot-input"
                className="block text-[13px] font-bold text-[#3a1d6d] mb-1.5"
              >
                Upload Payment Screenshot (After Pay)
              </label>

              <label
                htmlFor="payment-screenshot-input"
                className="w-full flex flex-col items-center justify-center gap-1.5 p-3 border-2 border-dashed border-[#7c4dff]/50 bg-[#f8f5ff] rounded-[14px] cursor-pointer hover:bg-[#f0e8ff] transition-colors"
              >
                {screenshotDataUrl ? (
                  <div className="w-full flex items-center gap-3">
                    <img
                      src={screenshotDataUrl}
                      alt="Uploaded payment screenshot preview"
                      className="w-14 h-14 rounded-[10px] object-cover border border-[#e9dffc] shrink-0"
                    />
                    <div className="min-w-0 flex-1 text-left">
                      <div className="text-[12px] font-extrabold text-[#2e7d32] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Screenshot Selected</span>
                      </div>
                      <div className="text-[11px] text-[#555] truncate">
                        {screenshotName || 'payment-screenshot.jpg'}
                      </div>
                      <div className="text-[11px] text-[#7c4dff] font-bold mt-0.5">
                        Tap to change image
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <ImagePlus className="w-6 h-6 text-[#7c4dff]" aria-hidden="true" />
                    <span className="text-[13px] font-bold text-[#3a1d6d]">
                      Select Payment Screenshot
                    </span>
                    <span className="text-[11px] text-[#666]">
                      PNG, JPG or WEBP screenshot
                    </span>
                  </>
                )}
              </label>

              <input
                id="payment-screenshot-input"
                type="file"
                accept="image/*"
                onChange={handleScreenshotChange}
                className="sr-only"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#2e7d32] text-white border-0 p-[13px] rounded-[14px] font-extrabold text-[14px] mt-3 cursor-pointer active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {submitting ? 'Submitting Screenshot...' : 'Submit Payment Screenshot ✅'}
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
