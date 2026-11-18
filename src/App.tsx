import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CATEGORIES,
  SERVICE_CATALOG,
  type CategoryKey,
  type OrderItem,
  type PaymentFundRequest,
  type PriceTier,
  type ServiceItem,
  type SupportMessage,
} from './data/services';
import {
  applyOrderDeduction,
  detectNewPendingPaymentIds,
  parseHashPage,
  validateOrderPlacement,
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
import { FundView, type CheckoutSessionState } from './components/FundView';
import { MenuView } from './components/MenuView';
import { AdminView } from './components/AdminView';
import { SupportModal } from './components/SupportModal';

type ModalKind = 'support' | 'checkout' | 'admin-login' | null;

interface NavHistoryState {
  page: ActivePage;
  cat: CategoryKey;
  serviceId: string | null;
  modal: ModalKind;
}

function getInitialSupportMessages(): SupportMessage[] {
  try {
    const parsed = JSON.parse(localStorage.getItem('tp_support_msgs') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function findServiceById(cat: CategoryKey, serviceId: string | null): ServiceItem | null {
  if (!serviceId) return null;
  return SERVICE_CATALOG[cat]?.find((s) => s.id === serviceId) ?? null;
}

export default function App() {
  const [uid, setUid] = useState<string>('TRUST-...');
  const [balance, setBalance] = useState<number>(0);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<PaymentFundRequest[]>([]);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>(
    getInitialSupportMessages,
  );

  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);
  const [adminPaymentRequests, setAdminPaymentRequests] = useState<PaymentFundRequest[]>([]);
  const [adminOrders, setAdminOrders] = useState<OrderItem[]>([]);

  const [activePage, setActivePage] = useState<ActivePage>(() => {
    const parsed = parseHashPage(window.location.hash);
    return parsed === 'admin' ? 'menu' : parsed;
  });
  const [currentCategory, setCurrentCategory] = useState<CategoryKey>('instagram');
  const [currentService, setCurrentService] = useState<ServiceItem | null>(null);

  const [supportOpen, setSupportOpen] = useState(false);
  const [checkoutSession, setCheckoutSession] = useState<CheckoutSessionState | null>(null);
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
  const prevPaymentStatusRef = useRef<Map<string, string>>(new Map());
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

  // Only persist non-sensitive support chat history locally
  useEffect(() => {
    try {
      localStorage.setItem('tp_support_msgs', JSON.stringify(supportMessages));
    } catch {
      // Ignore storage quota errors
    }
  }, [supportMessages]);

  // Verify admin HttpOnly cookie session on mount (no secret stored in browser storage)
  useEffect(() => {
    fetch('/api/admin/session', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ok?: boolean; authenticated?: boolean } | null) => {
        if (data?.ok && data.authenticated) {
          setIsAdminLoggedIn(true);
          if (parseHashPage(window.location.hash) === 'admin') {
            setActivePage('admin');
          }
        }
      })
      .catch(() => {});
  }, []);

  // Initialize history state cleanly on mount so phone Back moves exactly 1 step per press
  useEffect(() => {
    const initialPage = parseHashPage(window.location.hash);
    const resolvedPage: ActivePage = initialPage === 'admin' ? 'menu' : initialPage;
    const initialState: NavHistoryState = {
      page: resolvedPage,
      cat: 'instagram',
      serviceId: null,
      modal: null,
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
        if (st.modal !== 'checkout') {
          setCheckoutSession(null);
        }
        return;
      }

      setSupportOpen(false);
      setAdminLoginOpen(false);
      setCheckoutSession(null);
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
      if (next.modal !== 'checkout') {
        setCheckoutSession(null);
      }

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
        },
        fallbackPage,
      );
    },
    [currentCategory, pushNavState],
  );

  // Sync user's live authoritative balance, payment statuses, and orders via HttpOnly session cookie
  const syncUserState = useCallback(async () => {
    try {
      const res = await fetch('/api/user-state', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        ok?: boolean;
        uid?: string;
        balance?: number;
        paymentRequests?: PaymentFundRequest[];
        orders?: OrderItem[];
      };
      if (!data.ok) return;

      if (data.uid) {
        setUid(data.uid);
      }
      if (typeof data.balance === 'number') {
        setBalance(data.balance);
      }

      if (Array.isArray(data.paymentRequests)) {
        for (const req of data.paymentRequests) {
          const prev = prevPaymentStatusRef.current.get(req.id);
          if (prev === 'pending' && req.status === 'approved') {
            showToast(`₹${req.amount.toFixed(2)} Fund Added to Wallet ✅`);
          } else if (prev === 'pending' && req.status === 'wrong_payment') {
            showToast(req.adminMessage || 'Wrong Payment / Invalid Screenshot ❌', true);
          }
          prevPaymentStatusRef.current.set(req.id, req.status);
        }
        setPaymentRequests(data.paymentRequests);
      }

      if (Array.isArray(data.orders)) {
        setOrders(data.orders);
      }
    } catch {
      // Ignore transient network errors during poll
    }
  }, [showToast]);

  useEffect(() => {
    void syncUserState();
    const timer = window.setInterval(() => {
      void syncUserState();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [syncUserState]);

  // Sync Admin overview + trigger 3-second iPhone notification when a new Payment Screenshot arrives
  const syncAdminOverview = useCallback(
    async (isInitialPoll = false) => {
      if (!isAdminLoggedIn) return;
      try {
        const res = await fetch('/api/admin/overview', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (res.status === 401) {
          setIsAdminLoggedIn(false);
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok?: boolean;
          paymentRequests?: PaymentFundRequest[];
          orders?: OrderItem[];
        };
        if (!data.ok) return;

        const incomingPayments = Array.isArray(data.paymentRequests) ? data.paymentRequests : [];
        const incomingOrders = Array.isArray(data.orders) ? data.orders : [];

        if (knownAdminPendingIdsRef.current === null || isInitialPoll) {
          knownAdminPendingIdsRef.current = new Set(
            incomingPayments.filter((r) => r.status === 'pending').map((r) => r.id),
          );
        } else {
          const newIds = detectNewPendingPaymentIds(knownAdminPendingIdsRef.current, incomingPayments);
          if (newIds.length > 0) {
            for (const id of newIds) {
              knownAdminPendingIdsRef.current.add(id);
            }
            const newest = incomingPayments.find((r) => r.id === newIds[0]);
            playIphoneNotification3Sec();
            showToast(
              newest
                ? `🔔 New Payment Screenshot ₹${newest.amount.toFixed(0)} from ${newest.uid}`
                : '🔔 New Payment Screenshot Received!',
            );
          }
        }

        setAdminPaymentRequests(incomingPayments);
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
    });
  }, [pushNavState]);

  const handleGoOrders = useCallback(() => {
    playClickSound();
    pushNavState({
      page: 'orders',
      cat: currentCategory,
      serviceId: null,
      modal: null,
    });
  }, [currentCategory, pushNavState]);

  const handleGoFund = useCallback(() => {
    playClickSound();
    pushNavState({
      page: 'fund',
      cat: currentCategory,
      serviceId: null,
      modal: null,
    });
  }, [currentCategory, pushNavState]);

  const handleGoMenu = useCallback(() => {
    playClickSound();
    pushNavState({
      page: 'menu',
      cat: currentCategory,
      serviceId: null,
      modal: null,
    });
  }, [currentCategory, pushNavState]);

  const handleOpenSupport = useCallback(() => {
    playClickSound();
    pushNavState(
      {
        page: activePage,
        cat: currentCategory,
        serviceId: currentService?.id ?? null,
        modal: 'support',
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
    async (amount: number) => {
      try {
        const res = await fetch('/api/fund/checkout', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          amount?: number;
          qrToken?: string;
          message?: string;
        };
        if (!res.ok || !data.ok || !data.qrToken || typeof data.amount !== 'number') {
          showToast(data.message || 'Unable to open scanner ❌', true);
          return;
        }

        showToast(`Scanner Ready ₹${data.amount} • Pay & Upload Screenshot`);
        setCheckoutSession({ amount: data.amount, qrToken: data.qrToken });
        pushNavState(
          {
            page: 'fund',
            cat: currentCategory,
            serviceId: null,
            modal: 'checkout',
          },
          'fund',
        );
      } catch {
        showToast('Network Error ❌ Try Again', true);
      }
    },
    [currentCategory, pushNavState, showToast],
  );

  const handleCloseCheckout = useCallback(() => {
    setCheckoutSession(null);
    if (historyDepthRef.current > 0) {
      window.history.back();
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
      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        const data = (await res.json()) as { ok?: boolean; message?: string };
        if (!res.ok || !data.ok) {
          showToast(data.message || 'Wrong Password ❌', true);
          return false;
        }
      } catch {
        showToast('Network Error ❌', true);
        return false;
      }

      setIsAdminLoggedIn(true);
      setAdminLoginOpen(false);
      showToast('Admin Mode Activated ✅');
      pushNavState({
        page: 'admin',
        cat: currentCategory,
        serviceId: null,
        modal: null,
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
    });
  }, [currentCategory, pushNavState]);

  const handleAdminLogout = useCallback(async () => {
    playClickSound();
    stopIphoneNotification();
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch {
      // Ignore logout network error
    }
    setIsAdminLoggedIn(false);
    setAdminPaymentRequests([]);
    setAdminOrders([]);
    showToast('Admin Logged Out');
    pushNavState({
      page: 'menu',
      cat: currentCategory,
      serviceId: null,
      modal: null,
    });
  }, [currentCategory, pushNavState, showToast]);

  const handleSubmitScreenshot = useCallback(
    async ({
      amount,
      screenshot,
      app,
    }: {
      amount: number;
      screenshot: string;
      app: string;
    }): Promise<boolean> => {
      try {
        const res = await fetch('/api/fund/submit-screenshot', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, screenshot, app }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          request?: PaymentFundRequest;
          message?: string;
        };
        if (!res.ok || !data.ok || !data.request) {
          showToast(data.message || 'Screenshot Submit Failed ❌', true);
          return false;
        }
        prevPaymentStatusRef.current.set(data.request.id, data.request.status);
        setPaymentRequests((prev) => [data.request!, ...prev]);
        showToast('Screenshot Submitted ✅ Admin verify krke fund add kr dega');
        return true;
      } catch {
        showToast('Network Error ❌ Try Again', true);
        return false;
      }
    },
    [showToast],
  );

  const handleAdminPaymentAction = useCallback(
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
        const res = await fetch('/api/admin/payment-action', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
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
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
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
      packIndex,
    }: {
      link: string;
      selectedPrice: PriceTier | null;
      packIndex: number | null;
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

      if (!selectedPrice || packIndex === null) return false;

      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: currentCategory,
            serviceId: currentService.id,
            packIndex,
            link: link.trim(),
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          order?: OrderItem;
          balance?: number;
          reason?: string;
          message?: string;
        };

        if (!res.ok || !data.ok || !data.order) {
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
        setOrders((prev) => [data.order!, ...prev]);

        showToast(`Order Successful ✅ ID #${data.order.id}`);
        handleGoOrders();
        return true;
      } catch {
        showToast('Network Error ❌ Try Again', true);
        return false;
      }
    },
    [
      balance,
      currentCategory,
      currentService,
      handleGoFund,
      handleGoOrders,
      showToast,
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
          <OrdersView orders={orders} paymentRequests={paymentRequests} />
        )}

        {activePage === 'fund' && (
          <FundView
            uid={uid}
            paymentRequests={paymentRequests}
            checkoutSession={checkoutSession}
            onOpenCheckout={handleOpenCheckout}
            onCloseCheckout={handleCloseCheckout}
            onBack={() => goBackOneStep('home')}
            onShowToast={showToast}
            onSubmitScreenshot={handleSubmitScreenshot}
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
            paymentRequests={adminPaymentRequests}
            orders={adminOrders}
            onBack={() => goBackOneStep('menu')}
            onLogout={handleAdminLogout}
            onPaymentAction={handleAdminPaymentAction}
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
