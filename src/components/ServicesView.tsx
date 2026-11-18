import React from 'react';
import type { ServiceItem } from '../data/services';
import { PlatformIcon } from './BrandIcons';

interface ServicesViewProps {
  categoryTitle: string;
  services: ServiceItem[];
  onBack: () => void;
  onSelectService: (service: ServiceItem) => void;
}

export function ServicesView({
  categoryTitle,
  services,
  onBack,
  onSelectService,
}: ServicesViewProps) {
  return (
    <section aria-labelledby="cat-services-heading">
      <button
        type="button"
        onClick={onBack}
        className="text-[#3a1d6d] font-bold text-[17px] mt-[8px] mb-[6px] inline-flex items-center gap-[6px] cursor-pointer min-h-[40px] focus-visible:outline-2 focus-visible:outline-[#7c4dff]"
      >
        ← Back
      </button>

      <h1
        id="cat-services-heading"
        className="text-[32px] font-extrabold text-[#3a1d6d] text-center my-[12px] mb-[18px] leading-tight"
      >
        {categoryTitle}
      </h1>

      <div className="space-y-[14px]">
        {services.map((service) => (
          <button
            key={service.id}
            type="button"
            onClick={() => onSelectService(service)}
            className="w-full bg-white rounded-[22px] p-[16px] flex justify-between items-center gap-3 shadow-[0_8px_20px_rgba(60,20,120,0.08)] cursor-pointer transition-transform duration-150 active:scale-[0.97] text-left focus-visible:outline-2 focus-visible:outline-[#7c4dff]"
          >
            <div className="flex items-center gap-[12px] min-w-0">
              <PlatformIcon kind={service.icon} size={46} />
              <span className="text-[16px] text-[#2d1b4e] font-bold leading-snug">
                {service.name}
              </span>
            </div>

            {service.isSpecial ? (
              <span className="offer-badge-anim text-white text-[11px] font-extrabold px-[12px] py-[7px] rounded-[20px] whitespace-nowrap tracking-[0.5px] shrink-0">
                ✨ SPECIAL OFFER ✨
              </span>
            ) : (
              <span className="text-[#7c4dff] text-[24px] font-extrabold leading-none shrink-0" aria-hidden="true">
                ›
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
