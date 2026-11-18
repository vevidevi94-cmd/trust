import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ADMIN_PASSWORD,
  CATEGORIES,
  SERVICE_CATALOG,
  type CategoryKey,
  type OrderItem,
  type PriceTier,
  type ServiceItem,
  type SupportMessage,
  type UtrFundRequest,
} from './data/services';
import {
  applyOrderDeduction,
  createOrderRecord,
  detectNewPendingUtrIds,
  formatBalance,
  generateUserId,
  parseHashPage,
  validateOrderPlacement,
  verifyAdminPassword,
  type ActivePage,
} from './utils/panelLogic';
import {
  playClickSound,
  playIphoneNotification3Sec,
  stopIphoneNotification,
  unlockAudioContext,
} from './utils/sound';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { HomeView } from './components/HomeView';
import { ServicesView } from './components/ServicesView';
import { PricesView } from './components/PricesView';
import { OrdersView } from './components/OrdersView';
import { FundView } from './components/FundView';
import { MenuView } from './components/MenuView';
import { AdminView } from './components/AdminView';
import { SupportModal } from './components/SupportModal';

type ModalKind = 'support' | 'checkout' | 'admin-login' | null;

interface NavHistoryState {
  page: ActivePage;
  cat: CategoryKey;
  serviceId: string | null;
  modal: ModalKind;
  checkoutAmt?: number | null;
}

function getInitialUid(): string {
  try {
    const saved = localStorage.getItem('tp_uid');
    if (saved && saved !== 'TRUST-0000') return saved;
    const created = generateUserId();
    localStorage.setItem('tp_uid', created);
    return created;
  } catch {
    return generateUserId();
  }
}

function getInitialBalance(): number {
  try {
    const raw = parseFloat(localStorage.getItem('tp_bal') || '0');
    return Number.isFinite(raw) ? raw : 0;
  } catch {
    return 0;
  }
}

function getInitialOrders(): OrderItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem('tp_orders') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getInitialCounter(): number {
  try {
    const parsed = parseInt(localStorage.getItem('tp_cnt') || '1', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  } catch {
    return 1;
  }
}

function getInitialSupportMessages(): SupportMessage[] {
  try {
    const parsed = JSON.parse(localStorage.getItem('tp_support_msgs') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getInitialAdminAuth(): boolean {
  try {
    return localStorage.getItem('tp_admin_pass') === ADMIN_PASSWORD;
  } catch {
    return false;
  }
}

function findServiceById(cat: CategoryKey, serviceId: string | null): ServiceItem | null {
  if (!serviceId) return null;
  return SERVICE_CATALOG[cat]?.find((s) => s.id === serviceId) ?? null;
}

export default function App() {
  const [uid] = useState<string>(getInitialUid);
  const [balance, setBalance] = useState<number>(getInitialBalance);
  const [orders, setOrders] = useState<OrderItem[]>(getInitialOrders);
  const [utrRequests, setUtrRequests] = useState<UtrFundRequest[]>([]);
  const [counter, setCounter] = useState<number>(getInitialCounter);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>(
    getInitialSupportMessages,
  );

  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(getInitialAdminAuth);
  const [adminUtrRequests, setAdminUtrRequests] = useState<UtrFundRequest[]>([]);
  const [adminOrders, setAdminOrders] = useState<OrderItem[]>([]);

  const [activePage, setActivePage] = useState<ActivePage>(() => {
    const parsed = parseHashPage(window.location.hash);
    if (parsed === 'admin' && !getInitialAdminAuth()) return 'menu';
    return parsed;
  });
  const [currentCategory, setCurrentCategory] = useState<CategoryKey>('instagram');
  const [currentService, setCurrentService] = useState<ServiceItem | null>(null);

  const [supportOpen, setSupportOpen] = useState(false);
  const [checkoutAmount, setCheckoutAmount] = useState<number | null>(null);
  const [adminLoginOpen, setAdminLoginOpen] = useState(false);

  const [toastState, setToastState] = useState<{
    visible: boolean;
    message: string;
    isError: boolean;
  }>({
    visible: false,
    message: '',
    isError: false,
  });

  const toastTimerRef = useRef<number | null>(null);
  const prevUtrStatusRef = useRef<Map<string, string>>(new Map());
  const knownAdminPendingIdsRef = useRef<Set<string> | null>(null);
  const historyDepthRef = useRef<number>(0);

  const showToast = useCallback((message: string, isError = false) => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToastState({ visible: true, message, isError });
    toastTimerRef.current = window.setTimeout(() => {
      setToastState((prev) => ({ ...prev, visible: false }));
    }, 4000);
  }, []);

  // Persist user-local caches
  useEffect(() => {
    try {
      localStorage.setItem('tp_bal', String(balance));
      localStorage.setItem('tp_orders', JSON.stringify(orders));
      localStorage.setItem('tp_cnt', String(counter));
      localStorage.setItem('tp_support_msgs', JSON.stringify(supportMessages));
    } catch {
      // Ignore storage quota errors
    }
  }, [balance, orders, counter, supportMessages]);

  // Initialize history state cleanly on mount so phone Back moves exactly 1 step per press
  useEffect(() => {
    const initialPage = parseHashPage(window.location.hash);
    const resolvedPage: ActivePage =
      initialPage === 'admin' && !getInitialAdminAuth() ? 'menu' : initialPage;
    const initialState: NavHistoryState = {
      page: resolvedPage,
      cat: 'instagram',
      serviceId: null,
      modal: null,
      checkoutAmt: null,
    };
    try {
      window.history.replaceState(initialState, '', `#${resolvedPage}`);
    } catch {
      // Ignore history errors
    }
  }, []);

  // Listen to hardware / browser Back button — restores exact 1-step-prior state
  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      historyDepthRef.current = Math.max(0, historyDepthRef.current - 1);
      const st = event.state as NavHistoryState | null;

      if (st && st.page) {
        const targetPage: ActivePage =
          st.page === 'admin' && !isAdminLoggedIn ? 'menu' : st.page;
        setCurrentCategory(st.cat || 'instagram');
        setCurrentService(findServiceById(st.cat || 'instagram', st.serviceId));
        setActivePage(targetPage);
        setSupportOpen(st.modal === 'support');
        setAdminLoginOpen(st.modal === 'admin-login');
        setCheckoutAmount(st.modal === 'checkout' ? (st.checkoutAmt ?? null) : null);
        return;
      }

      // Fallback when browser pops without custom state
      setSupportOpen(false);
      setAdminLoginOpen(false);
      setCheckoutAmount(null);
      const hashPage = parseHashPage(window.location.hash);
      setActivePage(hashPage === 'admin' && !isAdminLoggedIn ? 'menu' : hashPage);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [isAdminLoggedIn]);

  const pushNavState = useCallback(
    (next: NavHistoryState, hashOverride?: string) => {
      setActivePage(next.page);
      setCurrentCategory(next.cat);
      setCurrentService(findServiceById(next.cat, next.serviceId));
      setSupportOpen(next.modal === 'support');
      setAdminLoginOpen(next.modal === 'admin-login');
      setCheckoutAmount(next.modal === 'checkout' ? (next.checkoutAmt ?? null) : null);

      const hash = hashOverride ?? next.page;
      historyDepthRef.current += 1;
      try {
        window.history.pushState(next, '', `#${hash}`);
      } catch {
        // Ignore history pushState errors
      }
    },
    [],
  );

  const goBackOneStep = useCallback(
    (fallbackPage: ActivePage) => {
      playClickSound();
      if (historyDepthRef.current > 0) {
        window.history.back();
        return;
      }
      pushNavState(
        {
          page: fallbackPage,
          cat: currentCategory,
          serviceId: null,
          modal: null,
          checkoutAmt: null,
        },
        fallbackPage,
      );
    },
    [currentCategory, pushNavState],
  );

  // Sync user's live balance, UTR statuses, and order statuses from server
  const syncUserState = useCallback(async () => {
    try {
      const res = await fetch(`/api/user-state/${encodeURIComponent(uid)}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        ok?: boolean;
        balance?: number;
        utrRequests?: UtrFundRequest[];
        orders?: OrderItem[];
      };
      if (!data.ok) return;

      if (typeof data.balance === 'number') {
        setBalance(data.balance);
      }

      if (Array.isArray(data.utrRequests)) {
        // Detect transitions from pending -> approved or wrong_payment
        for (const req of data.utrRequests) {
          const prev = prevUtrStatusRef.current.get(req.id);
          if (prev === 'pending' && req.status === 'approved') {
            showToast(`₹${req.amount.toFixed(2)} Fund Added to Wallet ✅`);
          } else if (prev === 'pending' && req.status === 'wrong_payment') {
            showToast(req.adminMessage || 'Wrong Payment / Invalid UTR ❌', true);
          }
          prevUtrStatusRef.current.set(req.id, req.status);
        }
        setUtrRequests(data.utrRequests);
      }

      if (Array.isArray(data.orders) && data.orders.length > 0) {
        setOrders(data.orders);
      }
    } catch {
      // Ignore transient network errors during poll
    }
  }, [showToast, uid]);

  useEffect(() => {
    void syncUserState();
    const timer = window.setInterval(() => {
      void syncUserState();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [syncUserState]);

  // Sync Admin overview + trigger 3-second iPhone notification when a new UTR arrives in Admin mode
  const syncAdminOverview = useCallback(
    async (isInitialPoll = false) => {
      if (!isAdminLoggedIn) return;
      try {
        const res = await fetch('/api/admin/overview', {
          headers: { 'x-admin-pass': ADMIN_PASSWORD },
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok?: boolean;
          utrRequests?: UtrFundRequest[];
          orders?: OrderItem[];
        };
        if (!data.ok) return;

        const incomingUtrs = Array.isArray(data.utrRequests) ? data.utrRequests : [];
        const incomingOrders = Array.isArray(data.orders) ? data.orders : [];

        if (knownAdminPendingIdsRef.current === null || isInitialPoll) {
          knownAdminPendingIdsRef.current = new Set(
            incomingUtrs.filter((r) => r.status === 'pending').map((r) => r.id),
          );
        } else {
          const newIds = detectNewPendingUtrIds(knownAdminPendingIdsRef.current, incomingUtrs);
          if (newIds.length > 0) {
            for (const id of newIds) {
              knownAdminPendingIdsRef.current.add(id);
            }
            const newest = incomingUtrs.find((r) => r.id === newIds[0]);
            playIphoneNotification3Sec();
            showToast(
              newest
                ? `🔔 New UTR ₹${newest.amount.toFixed(0)} from ${newest.uid}`
                : '🔔 New UTR Payment Request Received!',
            );
          }
        }

        setAdminUtrRequests(incomingUtrs);
        setAdminOrders(incomingOrders);
      } catch {
        // Ignore transient poll errors
      }
    },
    [isAdminLoggedIn, showToast],
  );

  useEffect(() => {
    if (!isAdminLoggedIn) {
      knownAdminPendingIdsRef.current = null;
      return;
    }
    void syncAdminOverview(true);
    const timer = window.setInterval(() => {
      void syncAdminOverview(false);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [isAdminLoggedIn, syncAdminOverview]);

  // Navigation handlers
  const handleGoHome = useCallback(() => {
    playClickSound();
    pushNavState({
      page: 'home',
      cat: currentCategory,
      serviceId: null,
      modal: null,
      checkoutAmt: null,
    });
  }, [currentCategory, pushNavState]);

  const handleSelectCategory = useCallback(
    (cat: CategoryKey) => {
      playClickSound();
      pushNavState({
        page: 'services',
        cat,
        serviceId: null,
        modal: null,
        checkoutAmt: null,
      });
    },
    [pushNavState],
  );

  const handleSelectService = useCallback(
    (service: ServiceItem) => {
      playClickSound();
      pushNavState({
        page: 'prices',
        cat: currentCategory,
        serviceId: service.id,
        modal: null,
        checkoutAmt: null,
      });
    },
    [currentCategory, pushNavState],
  );

  const handlePosterClick = useCallback(() => {
    playClickSound();
    const reelsOffer = SERVICE_CATALOG.instagram[1];
    pushNavState({
      page: 'prices',
      cat: 'instagram',
      serviceId: reelsOffer.id,
      modal: null,
      checkoutAmt: null,
    });
  }, [pushNavState]);

  const handleGoOrders = useCallback(() => {
    playClickSound();
    pushNavState({
      page: 'orders',
      cat: currentCategory,
      serviceId: null,
      modal: null,
      checkoutAmt: null,
    });
  }, [currentCategory, pushNavState]);

  const handleGoFund = useCallback(() => {
    playClickSound();
    pushNavState({
      page: 'fund',
      cat: currentCategory,
      serviceId: null,
      modal: null,
      checkoutAmt: null,
    });
  }, [currentCategory, pushNavState]);

  const handleGoMenu = useCallback(() => {
    playClickSound();
    pushNavState({
      page: 'menu',
      cat: currentCategory,
      serviceId: null,
      modal: null,
      checkoutAmt: null,
    });
  }, [currentCategory, pushNavState]);

  // Modals as 1-step history entries so phone Back closes the modal cleanly
  const handleOpenSupport = useCallback(() => {
    playClickSound();
    pushNavState(
      {
        page: activePage,
        cat: currentCategory,
        serviceId: currentService?.id ?? null,
        modal: 'support',
        checkoutAmt: null,
      },
      activePage,
    );
  }, [activePage, currentCategory, currentService?.id, pushNavState]);

  const handleCloseSupport = useCallback(() => {
    if (historyDepthRef.current > 0) {
      window.history.back();
    } else {
      setSupportOpen(false);
    }
  }, []);

  const handleOpenCheckout = useCallback(
    (amount: number) => {
      pushNavState(
        {
          page: 'fund',
          cat: currentCategory,
          serviceId: null,
          modal: 'checkout',
          checkoutAmt: amount,
        },
        'fund',
      );
    },
    [currentCategory, pushNavState],
  );

  const handleCloseCheckout = useCallback(() => {
    if (historyDepthRef.current > 0) {
      window.history.back();
    } else {
      setCheckoutAmount(null);
    }
  }, []);

  const handleOpenAdminLogin = useCallback(() => {
    playClickSound();
    unlockAudioContext();
    pushNavState(
      {
        page: 'menu',
        cat: currentCategory,
        serviceId: null,
        modal: 'admin-login',
        checkoutAmt: null,
      },
      'menu',
    );
  }, [currentCategory, pushNavState]);

  const handleCloseAdminLogin = useCallback(() => {
    if (historyDepthRef.current > 0) {
      window.history.back();
    } else {
      setAdminLoginOpen(false);
    }
  }, []);

  const handleSubmitAdminLogin = useCallback(
    async (password: string): Promise<boolean> => {
      unlockAudioContext();
      playClickSound();
      if (!verifyAdminPassword(password)) {
        showToast('Wrong Password ❌', true);
        return false;
      }

      try {
        await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
      } catch {
        // Local password verification already succeeded
      }

      try {
        localStorage.setItem('tp_admin_pass', ADMIN_PASSWORD);
      } catch {
        // Ignore storage errors
      }

      setIsAdminLoggedIn(true);
      setAdminLoginOpen(false);
      showToast('Admin Mode Activated ✅');
      pushNavState({
        page: 'admin',
        cat: currentCategory,
        serviceId: null,
        modal: null,
        checkoutAmt: null,
      });
      return true;
    },
    [currentCategory, pushNavState, showToast],
  );

  const handleOpenAdminPanel = useCallback(() => {
    playClickSound();
    unlockAudioContext();
    pushNavState({
      page: 'admin',
      cat: currentCategory,
      serviceId: null,
      modal: null,
      checkoutAmt: null,
    });
  }, [currentCategory, pushNavState]);

  const handleAdminLogout = useCallback(() => {
    playClickSound();
    stopIphoneNotification();
    try {
      localStorage.removeItem('tp_admin_pass');
    } catch {
      // Ignore storage errors
    }
    setIsAdminLoggedIn(false);
    setAdminUtrRequests([]);
    setAdminOrders([]);
    showToast('Admin Logged Out');
    pushNavState({
      page: 'menu',
      cat: currentCategory,
      serviceId: null,
      modal: null,
      checkoutAmt: null,
    });
  }, [currentCategory, pushNavState, showToast]);

  const handleSubmitUtr = useCallback(
    async ({ amount, utr, app }: { amount: number; utr: string; app: string }): Promise<boolean> => {
      try {
        const res = await fetch('/api/utr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid, amount, utr, app }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          request?: UtrFundRequest;
          message?: string;
        };
        if (!res.ok || !data.ok || !data.request) {
          showToast(data.message || 'UTR Submit Failed ❌', true);
          return false;
        }
        prevUtrStatusRef.current.set(data.request.id, data.request.status);
        setUtrRequests((prev) => [data.request!, ...prev]);
        showToast('UTR Submitted ✅ Admin verify krke fund add kr dega');
        return true;
      } catch {
        showToast('Network Error ❌ Try Again', true);
        return false;
      }
    },
    [showToast, uid],
  );

  const handleAdminUtrAction = useCallback(
    async ({
      id,
      action,
      note,
    }: {
      id: string;
      action: 'approve' | 'wrong_payment';
      note?: string;
    }) => {
      playClickSound();
      try {
        const res = await fetch('/api/admin/utr-action', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-pass': ADMIN_PASSWORD,
          },
          body: JSON.stringify({ id, action, note }),
        });
        const data = (await res.json()) as { ok?: boolean; message?: string };
        if (!res.ok || !data.ok) {
          showToast(data.message || 'Action failed ❌', true);
          return;
        }
        showToast(
          action === 'approve' ? 'Fund Added to User Wallet ✅' : 'Marked Wrong Payment ❌',
          action !== 'approve',
        );
        await syncAdminOverview(false);
        await syncUserState();
      } catch {
        showToast('Network Error ❌', true);
      }
    },
    [showToast, syncAdminOverview, syncUserState],
  );

  const handleAdminOrderStatus = useCallback(
    async (orderId: string, status: string) => {
      playClickSound();
      try {
        const res = await fetch('/api/admin/order-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-pass': ADMIN_PASSWORD,
          },
          body: JSON.stringify({ order_id: orderId, status }),
        });
        if (res.ok) {
          showToast(`Order Status Updated: ${status.toUpperCase()}`);
          await syncAdminOverview(false);
          await syncUserState();
        }
      } catch {
        showToast('Failed to update status ❌', true);
      }
    },
    [showToast, syncAdminOverview, syncUserState],
  );

  const handlePlaceOrder = useCallback(
    async ({
      link,
      selectedPrice,
    }: {
      link: string;
      selectedPrice: PriceTier | null;
    }): Promise<boolean> => {
      playClickSound();
      if (!currentService) return false;

      const validation = validateOrderPlacement({
        link,
        linkPrompt: currentService.link,
        category: currentCategory,
        serviceId: currentService.id,
        selectedPrice,
        balance,
      });

      if (!validation.ok) {
        showToast(validation.message, true);
        if (validation.reason === 'low_balance') {
          handleGoFund();
        }
        return false;
      }

      if (!selectedPrice) return false;

      const latestUtr =
        utrRequests.find((r) => r.status === 'approved')?.utr ?? utrRequests[0]?.utr;
      const newOrder = createOrderRecord({
        counter,
        serviceName: currentService.name,
        pack: selectedPrice.q,
        price: selectedPrice.p,
        link,
        uid,
        utr: latestUtr,
      });

      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order: newOrder,
            category: currentCategory,
            serviceId: currentService.id,
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          order?: OrderItem;
          balance?: number;
          reason?: string;
          message?: string;
        };

        if (!res.ok || !data.ok) {
          showToast(data.message || 'Low Balance ❌ Please Add Funds', true);
          if (typeof data.balance === 'number') setBalance(data.balance);
          if (data.reason !== 'invalid_link') {
            handleGoFund();
          }
          return false;
        }

        setBalance(
          typeof data.balance === 'number'
            ? data.balance
            : applyOrderDeduction(balance, selectedPrice.p),
        );
        setCounter((prev) => prev + 1);
        setOrders((prev) => [data.order ?? newOrder, ...prev]);

        showToast(`Order Successful ✅ ID #${newOrder.id}`);
        handleGoOrders();
        return true;
      } catch {
        showToast('Network Error ❌ Try Again', true);
        return false;
      }
    },
    [
      balance,
      counter,
      currentCategory,
      currentService,
      handleGoFund,
      handleGoOrders,
      showToast,
      uid,
      utrRequests,
    ],
  );

  const handleCopyUid = useCallback(() => {
    playClickSound();
    navigator.clipboard?.writeText(uid).catch(() => {});
    showToast(`User ID Copied ✅ ${uid}`);
  }, [showToast, uid]);

  const handleSendSupportMessage = useCallback(
    ({ issue, message, image }: { issue: string; message: string; image: string | null }) => {
      const now = Date.now();
      const userMsg: SupportMessage = {
        id: `msg-${now}`,
        from: 'You',
        issue,
        message,
        image,
        time: now,
      };
      setSupportMessages((prev) => [...prev, userMsg]);

      window.setTimeout(() => {
        setSupportMessages((prev) => [
          ...prev,
          {
            id: `reply-${Date.now()}`,
            from: 'Admin',
            message: `Ticket received for ${issue} (${uid}). Team will respond shortly on Telegram @Iamkillerb.`,
            time: Date.now(),
          },
        ]);
      }, 700);
    },
    [uid],
  );

  const currentCatMeta =
    CATEGORIES.find((c) => c.key === currentCategory) ?? CATEGORIES[0];

  return (
    <div className="min-h-screen bg-[#d8c7f5] pb-[120px]">
      <div
        role="status"
        aria-live="polite"
        onClick={() => setToastState((prev) => ({ ...prev, visible: false }))}
        style={{ backgroundColor: toastState.isError ? '#c62828' : '#111111' }}
        className={`fixed top-[18px] left-1/2 -translate-x-1/2 text-white px-[22px] py-[12px] rounded-[30px] z-[300] font-semibold text-[14px] min-w-[260px] max-w-[90vw] text-center shadow-lg transition-transform duration-300 cursor-pointer ${
          toastState.visible ? 'translate-y-0' : '-translate-y-[150px] pointer-events-none'
        }`}
      >
        {toastState.message}
      </div>

      <Header
        balance={balance}
        onLogoClick={handleGoHome}
        onWalletClick={handleGoFund}
      />

      <main className="max-w-[460px] mx-auto px-[14px]">
        {activePage === 'home' && (
          <HomeView
            onSelectCategory={handleSelectCategory}
            onPosterClick={handlePosterClick}
          />
        )}

        {activePage === 'services' && (
          <ServicesView
            categoryTitle={currentCatMeta.title}
            services={SERVICE_CATALOG[currentCategory]}
            onBack={() => goBackOneStep('home')}
            onSelectService={handleSelectService}
          />
        )}

        {activePage === 'prices' && currentService && (
          <PricesView
            key={currentService.id}
            service={currentService}
            onBack={() => goBackOneStep('services')}
            onPlaceOrder={handlePlaceOrder}
          />
        )}

        {activePage === 'orders' && (
          <OrdersView orders={orders} utrRequests={utrRequests} />
        )}

        {activePage === 'fund' && (
          <FundView
            uid={uid}
            utrRequests={utrRequests}
            checkoutAmount={checkoutAmount}
            onOpenCheckout={handleOpenCheckout}
            onCloseCheckout={handleCloseCheckout}
            onBack={() => goBackOneStep('home')}
            onShowToast={showToast}
            onSubmitUtr={handleSubmitUtr}
            onPlaySound={playClickSound}
          />
        )}

        {activePage === 'menu' && (
          <MenuView
            uid={uid}
            isAdminLoggedIn={isAdminLoggedIn}
            adminLoginOpen={adminLoginOpen}
            onOpenAdminLogin={handleOpenAdminLogin}
            onCloseAdminLogin={handleCloseAdminLogin}
            onSubmitAdminLogin={handleSubmitAdminLogin}
            onOpenAdminPanel={handleOpenAdminPanel}
            onCopyUid={handleCopyUid}
            onSupportClick={handleOpenSupport}
            onGoOrders={handleGoOrders}
            onGoFund={handleGoFund}
          />
        )}

        {activePage === 'admin' && isAdminLoggedIn && (
          <AdminView
            utrRequests={adminUtrRequests}
            orders={adminOrders}
            onBack={() => goBackOneStep('menu')}
            onLogout={handleAdminLogout}
            onUtrAction={handleAdminUtrAction}
            onOrderStatusChange={handleAdminOrderStatus}
            onTestSound={() => {
              unlockAudioContext();
              playIphoneNotification3Sec();
              showToast('🔔 3s iPhone Notification Alert Played');
            }}
          />
        )}
      </main>

      <SupportModal
        isOpen={supportOpen}
        uid={uid}
        messages={supportMessages}
        onClose={handleCloseSupport}
        onSendMessage={handleSendSupportMessage}
        onShowToast={showToast}
        onPlaySound={playClickSound}
      />

      <BottomNav
        activePage={activePage}
        onGoOrders={handleGoOrders}
        onGoCreate={handleGoHome}
        onGoMenu={handleGoMenu}
        onSupportClick={handleOpenSupport}
      />
    </div>
  );
}
