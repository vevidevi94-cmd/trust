import React from 'react';
import type { OrderItem, UtrFundRequest } from '../data/services';
import { getOrderStatusBadgeStyle, getUtrStatusBadgeStyle } from '../utils/panelLogic';

interface OrdersViewProps {
  orders: OrderItem[];
  utrRequests: UtrFundRequest[];
}

export function OrdersView({ orders, utrRequests }: OrdersViewProps) {
  const latestUtr = utrRequests[0] ?? null;

  return (
    <section aria-labelledby="my-orders-heading">
      <h1
        id="my-orders-heading"
        className="text-[24px] font-extrabold text-[#3a1d6d] text-center my-[16px] mb-[18px]"
      >
        My Orders
      </h1>

      {latestUtr && (
        <div className="bg-white rounded-[16px] p-[12px] mb-3 shadow-[0_4px_12px_rgba(60,20,120,0.06)] border border-[#e9dffc]">
          <div className="flex justify-between items-center gap-2">
            <span className="text-[12px] font-bold text-[#3a1d6d]">
              Latest Payment • UTR: <span className="text-[#7c4dff]">{latestUtr.utr}</span>
            </span>
            {(() => {
              const badge = getUtrStatusBadgeStyle(latestUtr.status);
              return (
                <span
                  style={{ backgroundColor: badge.bg, color: badge.color }}
                  className="px-[8px] py-[3px] rounded-[10px] text-[10px] font-extrabold whitespace-nowrap shrink-0"
                >
                  {badge.label}
                </span>
              );
            })()}
          </div>
          {latestUtr.adminMessage && (
            <div
              className={`text-[12px] font-semibold mt-1 ${
                latestUtr.status === 'wrong_payment' ? 'text-[#c62828]' : 'text-[#2e7d32]'
              }`}
            >
              {latestUtr.adminMessage}
            </div>
          )}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="text-center text-[#555555] mt-[30px] text-[15px]">
          No Orders Yet
        </div>
      ) : (
        <div className="space-y-[10px]" data-testid="orders-list">
          {orders.map((order) => {
            const badge = getOrderStatusBadgeStyle(order.status);
            return (
              <div
                key={order.order_id}
                className="bg-white rounded-[16px] p-[12px] border-l-4 border-[#7c4dff] shadow-[0_4px_12px_rgba(60,20,120,0.06)]"
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
                <div className="text-[12px] text-[#555555] mt-1 tabular-nums">
                  {order.pack} • ₹{order.price}
                </div>
                <div className="text-[12px] text-[#7c4dff] break-all mt-0.5">
                  {order.link}
                </div>
                {order.utr && (
                  <div className="text-[11px] font-bold text-[#3a1d6d] mt-0.5">
                    UTR: {order.utr}
                  </div>
                )}
                <div className="text-[11px] text-[#666666] mt-0.5 tabular-nums">
                  {order.date} | {order.order_id}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
