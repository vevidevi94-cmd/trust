import React from 'react';
import type { OrderItem } from '../data/services';
import { formatIndianDateTime, getOrderStatusBadgeStyle } from '../utils/panelLogic';

interface OrdersViewProps {
  orders: OrderItem[];
}

export function OrdersView({ orders }: OrdersViewProps) {
  return (
    <section aria-labelledby="my-orders-heading">
      <h1
        id="my-orders-heading"
        className="text-[24px] font-extrabold text-[#3a1d6d] text-center my-[16px] mb-[18px]"
      >
        My Orders
      </h1>

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
                {order.adminMessage && (
                  <div
                    data-testid={`order-admin-msg-${order.order_id}`}
                    className={`text-[12px] font-bold mt-1.5 px-2.5 py-1.5 rounded-[10px] border ${
                      order.status.toLowerCase() === 'payment_failed'
                        ? 'bg-[#ffebee] border-[#ffcdd2] text-[#c62828]'
                        : order.status.toLowerCase() === 'successful'
                          ? 'bg-[#e8f5e9] border-[#c8e6c9] text-[#2e7d32]'
                          : 'bg-[#fff8e1] border-[#ffe082] text-[#856404]'
                    }`}
                  >
                    Admin Message: {order.adminMessage}
                  </div>
                )}
                <div className="text-[11px] text-[#666666] mt-0.5 tabular-nums break-all">
                  {order.createdAt ? formatIndianDateTime(order.createdAt) : order.date} | {order.order_id}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
