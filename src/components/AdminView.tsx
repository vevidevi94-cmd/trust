import React, { useState } from 'react';
import {
  BellRing,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  LogOut,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import type { OrderItem } from '../data/services';
import { formatIndianDateTime, getOrderStatusBadgeStyle } from '../utils/panelLogic';

interface AdminViewProps {
  orders: OrderItem[];
  onBack: () => void;
  onLogout: () => void;
  onOrderStatusChange: (params: {
    orderId: string;
    status: 'successful' | 'pending' | 'payment_failed';
    note?: string;
  }) => Promise<void>;
  onDeleteOrder: (orderId: string) => Promise<void>;
  onTestSound: () => void;
}

export function AdminView({
  orders,
  onBack,
  onLogout,
  onOrderStatusChange,
  onDeleteOrder,
  onTestSound,
}: AdminViewProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const pendingCount = orders.filter((o) => o.status.toLowerCase() === 'pending').length;

  const handleStatusClick = async (
    orderId: string,
    status: 'successful' | 'pending' | 'payment_failed',
  ) => {
    setBusyId(orderId);
    await onOrderStatusChange({
      orderId,
      status,
      note: notesById[orderId]?.trim() || undefined,
    });
    setBusyId(null);
  };

  const handleDeleteClick = async (orderId: string) => {
    setBusyId(orderId);
    await onDeleteOrder(orderId);
    setBusyId(null);
  };

  const handleCopyLink = (orderId: string, link: string) => {
    navigator.clipboard?.writeText(link).catch(() => {});
    setCopiedId(orderId);
    window.setTimeout(() => setCopiedId((prev) => (prev === orderId ? null : prev)), 1800);
  };

  return (
    <section aria-labelledby="admin-panel-heading">
      <div className="flex items-center justify-between mt-[8px] mb-[6px]">
        <button
          type="button"
          onClick={onBack}
          className="text-[#3a1d6d] font-bold text-[17px] inline-flex items-center gap-[6px] cursor-pointer min-h-[40px] focus-visible:outline-2 focus-visible:outline-[#7c4dff]"
        >
          ← Back
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTestSound}
            aria-label="Test 3s iPhone Notification Sound"
            className="bg-white text-[#3a1d6d] px-3 py-2 rounded-[12px] text-[12px] font-bold shadow-sm inline-flex items-center gap-1 cursor-pointer active:scale-95 transition-transform"
          >
            <BellRing className="w-3.5 h-3.5 text-[#7c4dff]" aria-hidden="true" />
            <span>Alert Sound</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="bg-[#c62828] text-white px-3.5 py-2 rounded-[12px] text-[12px] font-extrabold inline-flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95 transition-transform"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      <h1
        id="admin-panel-heading"
        className="text-[28px] font-extrabold text-[#3a1d6d] text-center my-[10px] mb-[6px]"
      >
        Admin Panel
      </h1>

      <div className="text-center text-[12.5px] font-bold text-[#3a1d6d] mb-3">
        Live Orders: {orders.length} ({pendingCount} Pending)
      </div>

      <div className="space-y-3" data-testid="admin-orders-list">
        {orders.length === 0 ? (
          <div className="bg-white rounded-[18px] p-6 text-center text-[#555] text-[14px]">
            Abhi koi live order notification nahi aayi hai.
          </div>
        ) : (
          orders.map((order) => {
            const badge = getOrderStatusBadgeStyle(order.status);
            const isBusy = busyId === order.order_id;
            const isCopied = copiedId === order.order_id;
            const currentStatus = order.status.toLowerCase();
            const isSuccessful = currentStatus === 'successful' || currentStatus === 'completed';
            const isPending = currentStatus === 'pending';
            const isFailed = currentStatus === 'payment_failed' || currentStatus === 'failed';
            return (
              <div
                key={order.order_id}
                className="bg-white rounded-[18px] p-[14px] shadow-[0_6px_16px_rgba(60,20,120,0.08)] border-l-4 border-[#7c4dff]"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <strong className="text-[14px] text-[#2d1b4e] block">
                      #{order.id} {order.service}
                    </strong>
                    <div className="text-[12px] font-bold text-[#3a1d6d] mt-0.5 tabular-nums">
                      {order.uid} • {order.pack} •{' '}
                      <span className="text-[#7c4dff]">₹{order.price}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      style={{ backgroundColor: badge.bg, color: badge.color }}
                      className="px-[8px] py-[3px] rounded-[10px] text-[10.5px] font-extrabold whitespace-nowrap"
                    >
                      {badge.label}
                    </span>
                    <button
                      type="button"
                      disabled={isBusy}
                      aria-label={`Delete Order #${order.id}`}
                      onClick={() => handleDeleteClick(order.order_id)}
                      className="w-7 h-7 rounded-[8px] bg-[#ffebee] text-[#c62828] flex items-center justify-center cursor-pointer hover:bg-[#ffcdd2] disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="mt-2 bg-[#f8f5ff] border border-[#e9dffc] rounded-[10px] px-2.5 py-2 flex items-start justify-between gap-2">
                  <a
                    href={/^https?:\/\//i.test(order.link) ? order.link : `https://${order.link}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] font-bold text-[#7c4dff] break-all underline"
                  >
                    {order.link}
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopyLink(order.order_id, order.link)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#3a1d6d] bg-white border border-[#e9dffc] px-2 py-1 rounded-[8px] cursor-pointer shrink-0"
                  >
                    {isCopied ? <Check className="w-3 h-3 text-[#2e7d32]" /> : <Copy className="w-3 h-3" />}
                    <span>{isCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                {order.paymentScreenshot && (
                  <div className="mt-2 bg-[#f8f5ff] border border-[#e9dffc] rounded-[12px] p-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12px] font-extrabold text-[#3a1d6d]">
                        Payment Screenshot:
                      </span>
                      <button
                        type="button"
                        onClick={() => setPreviewImg(order.paymentScreenshot!)}
                        className="text-[11px] font-bold text-[#7c4dff] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Full</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewImg(order.paymentScreenshot!)}
                      className="w-full block cursor-pointer"
                    >
                      <img
                        src={order.paymentScreenshot}
                        alt={`Payment screenshot for order #${order.id}`}
                        className="w-full max-h-44 object-contain rounded-[8px] bg-white border border-[#e9dffc]"
                      />
                    </button>
                  </div>
                )}

                <div className="text-[11px] text-[#666] mt-1.5 tabular-nums">
                  {order.createdAt ? formatIndianDateTime(order.createdAt) : order.date} | {order.order_id}
                </div>

                <div className="mt-2.5 space-y-2">
                  <input
                    type="text"
                    value={notesById[order.order_id] || ''}
                    onChange={(e) =>
                      setNotesById((prev) => ({ ...prev, [order.order_id]: e.target.value }))
                    }
                    placeholder="Optional message for customer..."
                    className="w-full px-3 py-2 text-[12px] border border-[#e9dffc] rounded-[10px] outline-none focus:border-[#7c4dff]"
                  />

                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      disabled={isBusy}
                      aria-pressed={isSuccessful}
                      onClick={() => handleStatusClick(order.order_id, 'successful')}
                      className={`py-2 px-1.5 rounded-[10px] text-[11px] font-extrabold inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-60 active:scale-[0.98] whitespace-nowrap transition-transform ${
                        isSuccessful
                          ? 'bg-[#2e7d32] text-white ring-2 ring-[#1b5e20] ring-offset-1 shadow-md'
                          : 'bg-[#e8f5e9] text-[#2e7d32] border border-[#a5d6a7] hover:bg-[#c8e6c9]'
                      }`}
                    >
                      {isSuccessful ? (
                        <Check className="w-3.5 h-3.5 shrink-0 stroke-[3.2]" aria-hidden="true" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      )}
                      <span>Successful</span>
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      aria-pressed={isPending}
                      onClick={() => handleStatusClick(order.order_id, 'pending')}
                      className={`py-2 px-1.5 rounded-[10px] text-[11px] font-extrabold inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-60 active:scale-[0.98] whitespace-nowrap transition-transform ${
                        isPending
                          ? 'bg-[#f59e0b] text-white ring-2 ring-[#b45309] ring-offset-1 shadow-md'
                          : 'bg-[#fff8e1] text-[#b45309] border border-[#ffe082] hover:bg-[#ffecb3]'
                      }`}
                    >
                      {isPending ? (
                        <Check className="w-3.5 h-3.5 shrink-0 stroke-[3.2]" aria-hidden="true" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      )}
                      <span>Pending</span>
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      aria-pressed={isFailed}
                      onClick={() => handleStatusClick(order.order_id, 'payment_failed')}
                      className={`py-2 px-1.5 rounded-[10px] text-[11px] font-extrabold inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-60 active:scale-[0.98] whitespace-nowrap transition-transform ${
                        isFailed
                          ? 'bg-[#c62828] text-white ring-2 ring-[#7f1d1d] ring-offset-1 shadow-md'
                          : 'bg-[#ffebee] text-[#c62828] border border-[#ef9a9a] hover:bg-[#ffcdd2]'
                      }`}
                    >
                      {isFailed ? (
                        <Check className="w-3.5 h-3.5 shrink-0 stroke-[3.2]" aria-hidden="true" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      )}
                      <span>Pay Failed</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {previewImg && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Payment Screenshot Full View"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewImg(null);
          }}
          className="fixed inset-0 bg-black/80 z-[250] flex items-center justify-center p-4"
        >
          <div className="relative bg-white rounded-[18px] p-2 max-w-[420px] w-full shadow-2xl">
            <button
              type="button"
              aria-label="Close screenshot preview"
              onClick={() => setPreviewImg(null)}
              className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-black text-white flex items-center justify-center shadow-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImg}
              alt="Full payment screenshot"
              className="w-full max-h-[75vh] object-contain rounded-[12px]"
            />
          </div>
        </div>
      )}
    </section>
  );
}
