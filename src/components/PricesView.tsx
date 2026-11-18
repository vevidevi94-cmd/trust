import React, { useState } from 'react';
import type { PriceTier, ServiceItem } from '../data/services';
import { PlatformIcon } from './BrandIcons';

interface PricesViewProps {
  service: ServiceItem;
  onBack: () => void;
  onPlaceOrder: (params: { link: string; selectedPrice: PriceTier | null }) => Promise<boolean> | boolean;
}

export function PricesView({ service, onBack, onPlaceOrder }: PricesViewProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [linkInput, setLinkInput] = useState('');

  const selectedPrice = selectedIdx !== null ? service.prices[selectedIdx] ?? null : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const placed = await onPlaceOrder({ link: linkInput, selectedPrice });
    if (placed) {
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
          onSubmit={handleSubmit}
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
            className="w-full bg-[#7c4dff] text-white border-0 p-[14px] rounded-[14px] font-extrabold text-[15px] mt-[14px] cursor-pointer active:scale-[0.98] transition-transform focus-visible:outline-2 focus-visible:outline-[#3a1d6d]"
          >
            Place Order
          </button>
        </form>
      )}
    </section>
  );
}
