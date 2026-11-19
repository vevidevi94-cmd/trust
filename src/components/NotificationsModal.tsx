import React from 'react';
import { Bell, X } from 'lucide-react';
import type { CustomerNotification } from '../data/services';
import { formatIndianDateTime, getOrderStatusBadgeStyle } from '../utils/panelLogic';

interface NotificationsModalProps {
  isOpen: boolean;
  notifications: CustomerNotification[];
  onClose: () => void;
  onViewOrders: () => void;
}

export function NotificationsModal({
  isOpen,
  notifications,
  onClose,
  onViewOrders,
}: NotificationsModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notifications-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-black/60 z-[210] flex items-center justify-center p-4"
    >
      <div className="modal-pop-anim bg-white rounded-[22px] p-5 w-full max-w-[380px] max-h-[80vh] flex flex-col shadow-[0_20px_40px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-between mb-3 shrink-0">
          <h2
            id="notifications-modal-title"
            className="text-[#3a1d6d] font-extrabold text-[18px] flex items-center gap-2"
          >
            <Bell className="w-5 h-5 text-[#7c4dff]" aria-hidden="true" />
            <span>Notifications</span>
          </h2>
          <button
            type="button"
            aria-label="Close notifications"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#666] hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto space-y-2.5 flex-1 pr-0.5" data-testid="notifications-list">
          {notifications.length === 0 ? (
            <div className="text-center text-[#666] text-[14px] py-8">
              Abhi koi notification nahi aaya hai.
            </div>
          ) : (
            notifications.map((item) => {
              const badge = getOrderStatusBadgeStyle(item.status);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={onViewOrders}
                  className="w-full text-left bg-[#f8f5ff] border border-[#e9dffc] rounded-[14px] p-3 cursor-pointer hover:bg-[#f0e8ff] transition-colors"
                >
                  <div className="flex justify-between items-start gap-2">
                    <strong className="text-[13px] text-[#2d1b4e]">
                      Order #{item.orderNum} • {item.service}
                    </strong>
                    <span
                      style={{ backgroundColor: badge.bg, color: badge.color }}
                      className="px-[7px] py-[2px] rounded-[8px] text-[10px] font-extrabold whitespace-nowrap shrink-0"
                    >
                      {badge.label}
                    </span>
                  </div>
                  <div className="text-[12px] font-bold text-[#3a1d6d] mt-1">
                    {item.message}
                  </div>
                  <div className="text-[11px] text-[#666] mt-0.5 tabular-nums">
                    {item.pack} • {item.createdAt ? formatIndianDateTime(item.createdAt) : item.date}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <button
          type="button"
          onClick={onViewOrders}
          className="w-full bg-[#7c4dff] text-white border-0 p-[12px] rounded-[14px] font-extrabold text-[14px] mt-3 shrink-0 cursor-pointer active:scale-[0.98] transition-transform"
        >
          View My Orders
        </button>
      </div>
    </div>
  );
}
