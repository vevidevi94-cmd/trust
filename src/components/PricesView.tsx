import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock, ImagePlus, Loader2, X } from 'lucide-react';
import type { OrderItem, PriceTier, ServiceItem } from '../data/services';
import { validatePaymentScreenshot } from '../utils/panelLogic';
import { PlatformIcon } from './BrandIcons';

export interface DirectCheckoutState {
  amount: number;
  serviceName: string;
  pack: string;
  packIndex: number;
  link: string;
  qrToken: string;
}

interface PricesViewProps {
  uid: string;
  service: ServiceItem;
  checkoutState: DirectCheckoutState | null;
  processingOrder: OrderItem | null;
  userToken: string;
  onBack: () => void;
  onRequestCheckout: (params: {
    link: string;
    selectedPrice: PriceTier | null;
    packIndex: number | null;
  }) => Promise<boolean>;
  onCloseCheckout: () => void;
  onConfirmOrder: (params: {
    packIndex: number;
    link: string;
    screenshot: string;
  }) => Promise<boolean>;
  onAcknowledgeProcessing: () => void;
  onShowToast: (message: string, isError?: boolean) => void;
  onPlaySound: () => void;
}

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
      img.onerror = () => resolve(rawUrl);
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

export function PricesView({
  uid,
  service,
  checkoutState,
  processingOrder,
  userToken,
  onBack,
  onRequestCheckout,
  onCloseCheckout,
  onConfirmOrder,
  onAcknowledgeProcessing,
  onShowToast,
  onPlaySound,
}: PricesViewProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [linkInput, setLinkInput] = useState('');
  const [openingQr, setOpeningQr] = useState(false);

  const [screenshotDataUrl, setScreenshotDataUrl] = useState('');
  const [screenshotName, setScreenshotName] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState(false);

  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fetchedTokenRef = useRef<string | null>(null);

  const selectedPrice = selectedIdx !== null ? service.prices[selectedIdx] ?? null : null;

  useEffect(() => {
    if (!checkoutState?.qrToken) {
      fetchedTokenRef.current = null;
      return;
    }

    const token = checkoutState.qrToken;
    if (fetchedTokenRef.current === token) return;
    fetchedTokenRef.current = token;

    let cancelled = false;
    setQrLoading(true);
    setQrError(false);

    const headers: Record<string, string> = {};
    if (userToken) {
      headers['x-user-token'] = userToken;
    }

    fetch(`/api/order/qr?token=${encodeURIComponent(token)}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers,
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

          // Crop QR square cleanly so bottom UPI ID caption is never rendered
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
  }, [checkoutState?.qrToken, userToken]);

  const handleLinkFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOpeningQr(true);
    setScreenshotDataUrl('');
    setScreenshotName('');
    await onRequestCheckout({
      link: linkInput,
      selectedPrice,
      packIndex: selectedIdx,
    });
    setOpeningQr(false);
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

  const handleFinalOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutState) return;
    onPlaySound();

    const check = validatePaymentScreenshot(screenshotDataUrl);
    if (!check.ok) {
      onShowToast(check.message, true);
      return;
    }

    setSubmittingOrder(true);
    const ok = await onConfirmOrder({
      packIndex: checkoutState.packIndex,
      link: checkoutState.link,
      screenshot: check.screenshot,
    });
    setSubmittingOrder(false);

    if (ok) {
      setScreenshotDataUrl('');
      setScreenshotName('');
      setLinkInput('');
    }
  };

  return (
    <section aria-labelledby="service-detail-heading">
      <button
        type="button"
        onClick={onBack}
        className="text-[#3a1d6d] font-bold text-[17px] mt-[8px] mb-[6px] inline-flex items-center gap-[6px] cursor-pointer min-h-[40px] focus-visible:outline-2 focus-visible:outline-[#7c4dff]"
      >
        ← Back
      </button>

      <h1
        id="service-detail-heading"
        className="text-[24px] font-extrabold text-[#3a1d6d] text-center my-[14px] mb-[18px] leading-snug"
      >
        {service.name}
      </h1>

      <div className="space-y-[12px]">
        {service.prices.map((pr, idx) => {
          const isActive = selectedIdx === idx;
          return (
            <button
              key={pr.q}
              type="button"
              onClick={() => setSelectedIdx(idx)}
              aria-pressed={isActive}
              className={`w-full rounded-[18px] px-[16px] py-[14px] flex justify-between items-center shadow-[0_6px_16px_rgba(0,0,0,0.06)] cursor-pointer border-2 transition-colors text-left focus-visible:outline-2 focus-visible:outline-[#7c4dff] ${
                isActive
                  ? 'border-[#7c4dff] bg-[#f3edff]'
                  : 'border-transparent bg-white'
              }`}
            >
              <div className="flex items-center gap-[12px] min-w-0">
                <PlatformIcon kind={service.icon} size={46} />
                <span className="text-[16px] text-[#2d1b4e] font-bold leading-snug">
                  {pr.q}
                </span>
              </div>
              <span className="text-[#7c4dff] font-extrabold text-[16px] tabular-nums shrink-0 ml-2">
                ₹{pr.p}
              </span>
            </button>
          );
        })}
      </div>

      {selectedPrice && (
        <form
          onSubmit={handleLinkFormSubmit}
          className="bg-white rounded-[22px] p-[16px] mt-[12px] shadow-[0_6px_18px_rgba(0,0,0,0.08)]"
        >
          <label
            htmlFor="order-link-input"
            className="block font-bold text-[#3a1d6d] text-[15px]"
          >
            {service.link}
          </label>
          <input
            id="order-link-input"
            type="text"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            placeholder="Enter Link"
            className="w-full p-[13px] border-2 border-[#e9dffc] rounded-[12px] outline-none mt-[10px] text-[14px] text-[#2d1b4e] focus:border-[#7c4dff]"
          />

          <div className="text-[12px] text-[#666666] mt-[8px] leading-[1.5]">
            {service.descLines.map((line, i) =>
              line === '' ? <br key={i} /> : <div key={i}>{line}</div>,
            )}
          </div>

          <div className="flex justify-between items-center mt-[10px] font-extrabold text-[15px]">
            <span>Amount</span>
            <span className="text-[#7c4dff] tabular-nums">₹{selectedPrice.p}</span>
          </div>

          <button
            type="submit"
            disabled={openingQr}
            className="w-full bg-[#7c4dff] text-white border-0 p-[14px] rounded-[14px] font-extrabold text-[15px] mt-[14px] cursor-pointer active:scale-[0.98] transition-transform disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[#3a1d6d]"
          >
            {openingQr ? 'Opening QR Scanner...' : 'Place Order'}
          </button>
        </form>
      )}

      {checkoutState && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="direct-pay-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) onCloseCheckout();
          }}
          className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 overflow-y-auto"
        >
          <form
            noValidate
            onSubmit={handleFinalOrderSubmit}
            onContextMenu={(e) => e.preventDefault()}
            className="modal-pop-anim bg-white rounded-[22px] p-5 w-full max-w-[380px] shadow-[0_20px_40px_rgba(0,0,0,0.3)] text-center my-auto select-none"
          >
            <div className="flex justify-between items-center mb-2.5">
              <h2 id="direct-pay-title" className="text-[#3a1d6d] font-extrabold text-[18px]">
                Scan & Pay to Order
              </h2>
              <button
                type="button"
                aria-label="Close payment scanner"
                onClick={onCloseCheckout}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#666] hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#f8f5ff] border border-[#e9dffc] rounded-[16px] p-3.5">
              <div className="text-[12px] font-bold text-[#3a1d6d] truncate">
                {checkoutState.pack} • ID: <span className="text-[#7c4dff]">{uid}</span>
              </div>
              <div className="text-[26px] font-extrabold text-[#3a1d6d] my-1 tabular-nums">
                ₹{checkoutState.amount.toFixed(2)}
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
                      <span className="mt-1 opacity-80">Close & tap Place Order again</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-[11px] font-semibold text-[#555]">
                Scan QR with PhonePe / GPay / Paytm / BHIM
              </div>
            </div>

            <div className="mt-3 text-left">
              <label
                htmlFor="order-screenshot-input"
                className="block text-[13px] font-bold text-[#3a1d6d] mb-1.5"
              >
                Upload Payment Screenshot (After Pay)
              </label>

              <label
                htmlFor="order-screenshot-input"
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
                id="order-screenshot-input"
                type="file"
                accept="image/*"
                onChange={handleScreenshotChange}
                className="sr-only"
              />
            </div>

            <button
              type="submit"
              disabled={submittingOrder}
              className="w-full bg-[#2e7d32] text-white border-0 p-[13px] rounded-[14px] font-extrabold text-[14px] mt-3 cursor-pointer active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {submittingOrder ? 'Placing Order...' : 'Place Order ✅'}
            </button>

            <button
              type="button"
              onClick={onCloseCheckout}
              className="w-full bg-[#f3edff] text-[#3a1d6d] border-0 p-[11px] rounded-[14px] font-bold text-[13px] mt-2 cursor-pointer"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {processingOrder && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-processing-title"
          className="fixed inset-0 bg-black/65 z-[220] flex items-center justify-center p-4"
        >
          <div className="modal-pop-anim bg-white rounded-[24px] p-6 w-full max-w-[350px] shadow-[0_20px_40px_rgba(0,0,0,0.3)] text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#fff3cd] flex items-center justify-center mb-3">
              <Clock className="w-8 h-8 text-[#856404]" aria-hidden="true" />
            </div>
            <h2
              id="order-processing-title"
              className="text-[22px] font-extrabold text-[#3a1d6d]"
            >
              Order Processing ⏳
            </h2>
            <p className="text-[13px] text-[#555] mt-2 leading-relaxed">
              Aapka Order <strong>#{processingOrder.id}</strong> ({processingOrder.pack} • ₹{processingOrder.price}) receive ho gaya hai. Admin verify karte hi status <strong>My Orders</strong> aur upar <strong>Bell Notification</strong> me dikh jayega.
            </p>
            <button
              type="button"
              onClick={onAcknowledgeProcessing}
              className="w-full bg-[#7c4dff] text-white border-0 p-[13px] rounded-[14px] font-extrabold text-[15px] mt-5 cursor-pointer active:scale-[0.98] transition-transform"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
