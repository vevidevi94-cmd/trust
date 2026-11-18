import React from 'react';
import { formatBalance } from '../utils/panelLogic';

interface HeaderProps {
  balance: number;
  onLogoClick: () => void;
  onWalletClick: () => void;
}

export function Header({ balance, onLogoClick, onWalletClick }: HeaderProps) {
  return (
    <header className="flex justify-between items-center px-[14px] pt-[14px] pb-[8px] sticky top-0 z-20 bg-[#d8c7f5]">
      <button
        type="button"
        onClick={onLogoClick}
        className="bg-black text-[#ffeb3b] px-[18px] py-[11px] rounded-[14px] font-extrabold text-[17px] flex items-center gap-[6px] shadow-[0_4px_12px_rgba(0,0,0,0.25)] cursor-pointer whitespace-nowrap shrink-0 active:scale-95 transition-transform focus-visible:outline-2 focus-visible:outline-[#3a1d6d]"
      >
        <span>TrustedPanel 👑</span>
      </button>

      <button
        type="button"
        onClick={onWalletClick}
        aria-label={`Wallet balance ₹ ${formatBalance(balance)}, click to add funds`}
        className="bg-[#ffcc00] px-[18px] py-[11px] rounded-[30px] font-extrabold text-[16px] text-black cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.15)] tabular-nums whitespace-nowrap shrink-0 active:scale-95 transition-transform focus-visible:outline-2 focus-visible:outline-[#3a1d6d]"
      >
        ₹ <span data-testid="wallet-balance">{formatBalance(balance)}</span>
      </button>
    </header>
  );
}
