import React from 'react';
import { Bell } from 'lucide-react';

interface HeaderProps {
  unreadCount: number;
  onLogoClick: () => void;
  onBellClick: () => void;
}

export function Header({ unreadCount, onLogoClick, onBellClick }: HeaderProps) {
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
        onClick={onBellClick}
        aria-label={
          unreadCount > 0
            ? `Notifications (${unreadCount} unread)`
            : 'Notifications'
        }
        className="relative bg-[#ffcc00] w-[48px] h-[48px] rounded-full flex items-center justify-center text-black cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.15)] shrink-0 active:scale-95 transition-transform focus-visible:outline-2 focus-visible:outline-[#3a1d6d]"
      >
        <Bell className="w-[22px] h-[22px] stroke-[2.5]" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            data-testid="bell-unread-badge"
            className="absolute -top-[4px] -right-[4px] bg-[#ff0000] text-white text-[11px] font-extrabold min-w-[20px] h-[20px] px-1 rounded-full flex items-center justify-center shadow-sm tabular-nums"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    </header>
  );
}
