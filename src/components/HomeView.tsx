import React, { useEffect, useState } from 'react';
import { CATEGORIES, POSTER_IMAGE_PATH, type CategoryKey } from '../data/services';
import { PlatformIcon } from './BrandIcons';

interface HomeViewProps {
  posterImage?: string | null;
  onSelectCategory: (cat: CategoryKey) => void;
  onPosterClick: () => void;
}

export function HomeView({ posterImage, onSelectCategory, onPosterClick }: HomeViewProps) {
  const [posterError, setPosterError] = useState(false);
  const resolvedPoster = posterImage || POSTER_IMAGE_PATH;

  useEffect(() => {
    setPosterError(false);
  }, [resolvedPoster]);

  return (
    <section aria-labelledby="our-services-heading">
      <h1
        id="our-services-heading"
        className="text-[32px] font-extrabold text-[#3a1d6d] text-center my-[16px] mb-[18px] leading-tight"
      >
        Our Services
      </h1>

      <div className="space-y-[14px]">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => onSelectCategory(cat.key)}
            className="w-full bg-white rounded-[22px] p-[16px] flex justify-between items-center shadow-[0_8px_20px_rgba(60,20,120,0.08)] cursor-pointer transition-transform duration-150 active:scale-[0.97] text-left focus-visible:outline-2 focus-visible:outline-[#7c4dff]"
          >
            <div className="flex items-center gap-[12px]">
              <PlatformIcon kind={cat.icon} size={46} />
              <span className="text-[16px] text-[#2d1b4e] font-bold">{cat.label}</span>
            </div>
            <span className="text-[#7c4dff] text-[24px] font-extrabold leading-none" aria-hidden="true">
              ›
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onPosterClick}
        aria-label="Insta Views Offer - 1 Rupee 1K Reels Views"
        className="w-full mt-[18px] mb-[10px] rounded-[22px] overflow-hidden shadow-[0_8px_20px_rgba(0,0,0,0.15)] block cursor-pointer active:scale-[0.98] transition-transform focus-visible:outline-2 focus-visible:outline-[#7c4dff]"
      >
        {!posterError ? (
          <img
            src={resolvedPoster}
            alt="Insta Views Offer"
            referrerPolicy="no-referrer"
            onError={() => setPosterError(true)}
            className="w-full block object-cover"
          />
        ) : (
          <div className="w-full aspect-video bg-gradient-to-br from-[#190830] via-[#2d0c57] to-[#0c0519] text-white p-5 flex flex-col items-center justify-center text-center">
            <div className="text-[#ffeb3b] font-extrabold text-sm tracking-wider">
              TrustedPanel 👑 • FAST • SAFE • RELIABLE
            </div>
            <div className="text-xl font-extrabold mt-2">
              1 RUPYA KA INSTA VIEWS TEST KRLO 💯
            </div>
            <div className="mt-2 bg-[#ffeb3b] text-black font-extrabold text-xs px-3 py-1 rounded-full">
              Just ₹1 for 1K Reels Views
            </div>
          </div>
        )}
      </button>
    </section>
  );
}
