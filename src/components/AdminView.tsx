import React, { useState } from 'react';
import { BellRing, CheckCircle2, LogOut, XCircle } from 'lucide-react';
import type { OrderItem, UtrFundRequest } from '../data/services';
import {
  formatIndianDateTime,
  getOrderStatusBadgeStyle,
  getUtrStatusBadgeStyle,
} from '../utils/panelLogic';

interface AdminViewProps {
  utrRequests: UtrFundRequest[];
  orders: OrderItem[];
  onBack: () => void;
  onLogout: () => void;
  onUtrAction: (params: {
    id: string;
    action: 'approve' | 'wrong_payment';
    note?: string;
  }) => Promise<void>;
  onOrderStatusChange: (orderId: string, status: string) => Promise<void>;
  onTestSound: () => void;
}

export function AdminView({
  utrRequests,
  orders,
  onBack,
  onLogout,
  onUtrAction,
  onOrderStatusChange,
  onTestSound,
}: AdminViewProps) {
  const [tab, setTab] = useState<'utr' | 'orders'>('utr');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  const pendingCount = utrRequests.filter((r) => r.status === 'pending').length;

  const handleAction = async (id: string, action: 'approve' | 'wrong_payment') => {
    setBusyId(id);
    await onUtrAction({
      id,
      action,
      note: notesById[id]?.trim() || undefined,
    });
    setBusyId(null);
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
        className="text-[28px] font-extrabold text-[#3a1d6d] text-center my-[10px] mb-[14px]"
      >
        Admin Panel
      </h1>

      <div className="grid grid-cols-2 gap-2 p-1.5 bg-white rounded-[16px] shadow-[0_4px_12px_rgba(60,20,120,0.08)] mb-4">
        <button
          type="button"
          onClick={() => setTab('utr')}
          className={`py-2.5 px-2 rounded-[12px] text-[12.5px] font-extrabold cursor-pointer transition-colors whitespace-nowrap ${
            tab === 'utr' ? 'bg-[#7c4dff] text-white' : 'text-[#3a1d6d] hover:bg-[#f3edff]'
          }`}
        >
          UTR ({pendingCount} Pending)
        </button>
        <button
          type="button"
          onClick={() => setTab('orders')}
          className={`py-2.5 px-2 rounded-[12px] text-[12.5px] font-extrabold cursor-pointer transition-colors whitespace-nowrap ${
            tab === 'orders' ? 'bg-[#7c4dff] text-white' : 'text-[#3a1d6d] hover:bg-[#f3edff]'
          }`}
        >
          All Orders ({orders.length})
        </button>
      </div>

      {tab === 'utr' && (
        <div className="space-y-3" data-testid="admin-utr-list">
          {utrRequests.length === 0 ? (
            <div className="bg-white rounded-[18px] p-6 text-center text-[#555] text-[14px]">
              Abhi koi UTR payment request nahi aayi hai.
            </div>
          ) : (
            utrRequests.map((req) => {
              const badge = getUtrStatusBadgeStyle(req.status);
              const isBusy = busyId === req.id;
              return (
                <div
                  key={req.id}
                  className="bg-white rounded-[18px] p-[14px] shadow-[0_6px_16px_rgba(60,20,120,0.08)] border-l-4 border-[#7c4dff]"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="text-[13px] font-extrabold text-[#3a1d6d]">
                        {req.uid} • {req.app}
                      </div>
                      <div className="text-[20px] font-extrabold text-[#7c4dff] tabular-nums">
                        ₹{req.amount.toFixed(2)}
                      </div>
                    </div>
                    <span
                      style={{ backgroundColor: badge.bg, color: badge.color }}
                      className="px-[9px] py-[4px] rounded-[10px] text-[11px] font-extrabold whitespace-nowrap shrink-0"
                    >
                      {badge.label}
                    </span>
                  </div>

                  <div className="mt-1.5 bg-[#f8f5ff] border border-[#e9dffc] rounded-[10px] px-3 py-2 text-[13px] font-extrabold text-[#2d1b4e]">
                    UTR: <span className="text-[#7c4dff]">{req.utr}</span>
                  </div>

                  <div className="text-[11px] text-[#666] mt-1.5 tabular-nums">
                    {req.createdAt ? formatIndianDateTime(req.createdAt) : req.date}
                  </div>

                  {req.status === 'pending' ? (
                    <div className="mt-3 space-y-2">
                      <input
                        type="text"
                        value={notesById[req.id] || ''}
                        onChange={(e) =>
                          setNotesById((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                        placeholder="Optional message (e.g. Wrong UTR / Fund Added)"
                        className="w-full px-3 py-2 text-[12px] border border-[#e9dffc] rounded-[10px] outline-none focus:border-[#7c4dff]"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleAction(req.id, 'approve')}
                          className="bg-[#2e7d32] text-white py-2.5 px-2.5 rounded-[12px] text-[12px] font-extrabold inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-60 active:scale-[0.98] whitespace-nowrap"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>Add Fund ✅</span>
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleAction(req.id, 'wrong_payment')}
                          className="bg-[#c62828] text-white py-2.5 px-2.5 rounded-[12px] text-[12px] font-extrabold inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-60 active:scale-[0.98] whitespace-nowrap"
                        >
                          <XCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>Wrong Payment ❌</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    req.adminMessage && (
                      <div className="mt-2 text-[12px] font-semibold text-[#555]">
                        Note: {req.adminMessage}
                      </div>
                    )
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'orders' && (
        <div className="space-y-3" data-testid="admin-orders-list">
          {orders.length === 0 ? (
            <div className="bg-white rounded-[18px] p-6 text-center text-[#555] text-[14px]">
              Abhi koi order nahi aaya hai.
            </div>
          ) : (
            orders.map((order) => {
              const badge = getOrderStatusBadgeStyle(order.status);
              return (
                <div
                  key={order.order_id}
                  className="bg-white rounded-[18px] p-[14px] shadow-[0_6px_16px_rgba(60,20,120,0.08)] border-l-4 border-[#7c4dff]"
                >
                  <div className="flex justify-between items-start gap-2">
                    <strong className="text-[14px] text-[#2d1b4e]">
                      #{order.id} {order.service}
                    </strong>
                    <span
                      style={{ backgroundColor: badge.bg, color: badge.color }}
                      className="px-[8px] py-[3px] rounded-[10px] text-[11px] font-extrabold whitespace-nowrap shrink-0"
                    >
                      {badge.label}
                    </span>
                  </div>

                  <div className="text-[12px] font-bold text-[#3a1d6d] mt-1">
                    User: {order.uid} • {order.pack} • ₹{order.price}
                  </div>
                  <div className="text-[12px] text-[#7c4dff] break-all mt-0.5">
                    {order.link}
                  </div>
                  <div className="mt-1.5 bg-[#f8f5ff] border border-[#e9dffc] rounded-[8px] px-2.5 py-1.5 text-[12px] font-bold text-[#2d1b4e]">
                    UTR: <span className="text-[#7c4dff]">{order.utr || 'No UTR recorded'}</span>
                  </div>
                  <div className="text-[11px] text-[#666] mt-1 tabular-nums">
                    {order.date} | {order.order_id}
                  </div>

                  <div className="mt-2.5 flex items-center gap-2">
                    <label
                      htmlFor={`order-status-${order.order_id}`}
                      className="text-[12px] font-bold text-[#3a1d6d] shrink-0"
                    >
                      Update Status:
                    </label>
                    <select
                      id={`order-status-${order.order_id}`}
                      value={order.status.toLowerCase()}
                      onChange={(e) => onOrderStatusChange(order.order_id, e.target.value)}
                      className="flex-1 px-2.5 py-1.5 text-[12px] font-bold border border-[#e9dffc] rounded-[10px] bg-white text-[#2d1b4e]"
                    >
                      <option value="pending">Pending</option>
                      <option value="in progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="canceled">Canceled</option>
                    </select>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}
