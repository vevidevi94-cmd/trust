import React from 'react';
import { ListChecks, Menu, Plus } from 'lucide-react';
import type { ActivePage } from '../utils/panelLogic';

interface BottomNavProps {
  activePage: ActivePage;
  onGoOrders: () => void;
  onGoCreate: () => void;
  onGoMenu: () => void;
  onSupportClick: () => void;
}

export function BottomNav({
  activePage,
  onGoOrders,
  onGoCreate,
  onGoMenu,
  onSupportClick,
}: BottomNavProps) {
  const isCreateActive =
    activePage === 'home' || activePage === 'services' || activePage === 'prices';

  return (
    <>
      <button
        type="button"
        onClick={onSupportClick}
        aria-label="Open Telegram Support"
        className="fixed bottom-[92px] right-[16px] w-[56px] h-[56px] bg-[#229ED9] rounded-full flex items-center justify-center shadow-[0_8px_20px_rgba(34,158,217,0.5)] z-40 cursor-pointer active:scale-95 transition-transform focus-visible:outline-2 focus-visible:outline-white"
      >
        <svg viewBox="0 0 24 24" className="w-[28px] h-[28px] fill-white" aria-hidden="true">
          <path d="M20.665 3.717l-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l.002.001-.314 4.692c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.785l3.019-14.228c.309-1.239-.473-1.8-1.282-1.434z" />
        </svg>
        <span className="absolute -top-[4px] -right-[2px] bg-[#ff0000] text-white text-[11px] font-extrabold w-[18px] h-[18px] rounded-full flex items-center justify-center">
          1
        </span>
      </button>

      <nav
        aria-label="Main navigation"
        className="fixed bottom-0 left-0 right-0 bg-white flex justify-around items-center pt-[10px] pb-[14px] max-w-[460px] mx-auto rounded-t-[24px] shadow-[0_-5px_25px_rgba(0,0,0,0.1)] z-30"
      >
        <button
          type="button"
          onClick={onGoOrders}
          className={`flex-1 flex flex-col items-center justify-center text-[11px] cursor-pointer min-h-[44px] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[#7c4dff] ${
            activePage === 'orders' ? 'text-[#7c4dff] font-bold' : 'text-[#888888] font-medium'
          }`}
        >
          <ListChecks className="w-[20px] h-[20px] mb-[3px]" aria-hidden="true" />
          <span>My Orders</span>
        </button>

        <button
          type="button"
          onClick={onGoCreate}
          aria-current={isCreateActive ? 'page' : undefined}
          className="flex-none bg-[#7c4dff] text-white px-[28px] py-[10px] rounded-[40px] font-extrabold text-[11px] leading-[1.15] shadow-[0_10px_20px_rgba(124,77,255,0.4)] -mt-[20px] flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform focus-visible:outline-2 focus-visible:outline-[#3a1d6d]"
        >
          <Plus className="w-[15px] h-[15px] stroke-[3]" aria-hidden="true" />
          <span>Create Order</span>
        </button>

        <button
          type="button"
          onClick={onGoMenu}
          className={`flex-1 flex flex-col items-center justify-center text-[11px] cursor-pointer min-h-[44px] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[#7c4dff] ${
            activePage === 'menu' || activePage === 'admin'
              ? 'text-[#7c4dff] font-bold'
              : 'text-[#888888] font-medium'
          }`}
        >
          <Menu className="w-[20px] h-[20px] mb-[3px]" aria-hidden="true" />
          <span>Menu</span>
        </button>
      </nav>
    </>
  );
}
