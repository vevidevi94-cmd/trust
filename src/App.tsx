import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CATEGORIES,
  SERVICE_CATALOG,
  type CategoryKey,
  type CustomerNotification,
  type OrderItem,
  type PriceTier,
  type ServiceItem,
  type SupportMessage,
} from './data/services';
import {
  countUnreadNotifications,
  detectNewOrderIds,
  mergeAdminOrders,
  mergeLiveCatalog,
  parseHashPage,
  validateDirectOrderInput,
  type ActivePage,
  type AdminStatusOverride,
  type ServiceCatalogOverrideItem,
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
import { PricesView, type DirectCheckoutState } from './components/PricesView';
import { OrdersView } from './components/OrdersView';
import { MenuView } from './components/MenuView';
import { AdminView } from './components/AdminView';
import { SupportModal } from './components/SupportModal';
import { NotificationsModal } from './components/NotificationsModal';

type ModalKind = 'support' | 'notifications' | 'checkout' | 'admin-login' | null;

interface NavHistoryState {
  page: ActivePage;
  cat: CategoryKey;
  serviceId: string | null;
  modal: ModalKind;
}

const STORAGE_USER_TOKEN_KEY = 'tp_user_session_v2';
const STORAGE_ORDERS_CACHE_KEY = 'tp_orders_cache_v2';
const STORAGE_NOTIFS_CACHE_KEY = 'tp_notifs_cache_v2';
const STORAGE_ADMIN_ORDERS_CACHE_KEY = 'tp_admin_orders_cache_v2';
const STORAGE_ADMIN_DELETED_IDS_KEY = 'tp_admin_deleted_ids_v2';
const STORAGE_ADMIN_STATUS_OVERRIDES_KEY = 'tp_admin_status_overrides_v1';
const STORAGE_LIVE_CATALOG_KEY = 'tp_live_catalog_v1';
const STORAGE_LIVE_POSTER_KEY = 'tp_live_poster_v1';
const LIVE_CHANNEL_NAME = 'trustedpanel_live_sync_v1';

function readSavedUserToken(): string {
  try {
    return localStorage.getItem(STORAGE_USER_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

function readCachedOrders(): OrderItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_ORDERS_CACHE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readCachedNotifications(): CustomerNotification[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_NOTIFS_CACHE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readCachedAdminOrders(): OrderItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_ADMIN_ORDERS_CACHE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readAdminDeletedIds(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_ADMIN_DELETED_IDS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function saveAdminDeletedIds(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_ADMIN_DELETED_IDS_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage errors
  }
}

function readAdminStatusOverrides(): Record<string, AdminStatusOverride> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_ADMIN_STATUS_OVERRIDES_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, AdminStatusOverride>)
      : {};
  } catch {
    return {};
  }
}

function saveAdminStatusOverrides(overrides: Record<string, AdminStatusOverride>): void {
  try {
    localStorage.setItem(STORAGE_ADMIN_STATUS_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch {
    // Ignore storage errors
  }
}

function saveCachedAdminOrders(orders: OrderItem[]): void {
  try {
    localStorage.setItem(STORAGE_ADMIN_ORDERS_CACHE_KEY, JSON.stringify(orders));
    return;
  } catch {
    // If large base64 screenshots exceed localStorage quota, keep ALL order records
    // and only drop oldest screenshots so no order is ever lost
  }
  try {
    const compact = orders.map((o, idx) =>
      idx < 10 ? o : { ...o, paymentScreenshot: undefined },
    );
    localStorage.setItem(STORAGE_ADMIN_ORDERS_CACHE_KEY, JSON.stringify(compact));
    return;
  } catch {
    // Fallback: strip screenshots while preserving every single order record permanently
  }
  try {
    const minimal = orders.map((o) => ({ ...o, paymentScreenshot: undefined }));
    localStorage.setItem(STORAGE_ADMIN_ORDERS_CACHE_KEY, JSON.stringify(minimal));
  } catch {
    // Ignore final storage failure
  }
}

function readCachedCatalog(): Record<CategoryKey, ServiceItem[]> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_LIVE_CATALOG_KEY) || 'null');
    if (parsed && typeof parsed === 'object') {
      return mergeLiveCatalog(SERVICE_CATALOG, parsed as Record<string, ServiceCatalogOverrideItem[]>);
    }
  } catch {
    // Fallback to default catalog
  }
  return mergeLiveCatalog(SERVICE_CATALOG, null);
}

function readCachedPoster(): string | null {
  try {
    return localStorage.getItem(STORAGE_LIVE_POSTER_KEY) || null;
  } catch {
    return null;
  }
}

function broadcastLiveSignal(
  type: 'new_order' | 'order_updated' | 'order_deleted' | 'catalog_updated',
): void {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(LIVE_CHANNEL_NAME);
      ch.postMessage({ type, ts: Date.now() });
      ch.close();
    }
  } catch {
    // Ignore unsupported environments
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

export default function App() {
  const [uid, setUid] = useState<string>('TRUST-...');
  const [userToken, setUserToken] = useState<string>(readSavedUserToken);
  const [liveCatalog, setLiveCatalog] = useState<Record<CategoryKey, ServiceItem[]>>(readCachedCatalog);
  const [livePoster, setLivePoster] = useState<string | null>(readCachedPoster);
  const [orders, setOrders] = useState<OrderItem[]>(readCachedOrders);
  const [notifications, setNotifications] = useState<CustomerNotification[]>(readCachedNotifications);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>(
    getInitialSupportMessages,
  );

  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);
  const [adminOrders, setAdminOrders] = useState<OrderItem[]>([]);

  const [activePage, setActivePage] = useState<ActivePage>(() => {
    const parsed = parseHashPage(window.location.hash);
    return parsed === 'admin' ? 'menu' : parsed;
  });
  const [currentCategory, setCurrentCategory] = useState<CategoryKey>('instagram');
  const [currentServiceId, setCurrentServiceId] = useState<string | null>(null);
  const currentService = currentServiceId
    ? liveCatalog[currentCategory]?.find((s) => s.id === currentServiceId) ?? null
    : null;

  const [supportOpen, setSupportOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [checkoutState, setCheckoutState] = useState<DirectCheckoutState | null>(null);
  const [processingOrder, setProcessingOrder] = useState<OrderItem | null>(null);
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
  const knownAdminOrderIdsRef = useRef<Set<string> | null>(null);
  const knownCustomerNotifIdsRef = useRef<Set<string> | null>(null);
  const historyDepthRef = useRef<number>(0);
  const initialHashPageRef = useRef<ActivePage>(parseHashPage(window.location.hash));
  const adminSyncSeqRef = useRef<number>(0);

  const showToast = useCallback((message: string, isError = false) => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToastState({ visible: true, message, isError });
    toastTimerRef.current = window.setTimeout(() => {
      setToastState((prev) => ({ ...prev, visible: false }));
    }, 4000);
  }, []);

  // Persist customer's own orders, notifications, and support messages locally so reopening browser remembers them
  useEffect(() => {
    try {
      localStorage.setItem('tp_support_msgs', JSON.stringify(supportMessages));
      localStorage.setItem(STORAGE_ORDERS_CACHE_KEY, JSON.stringify(orders));
      localStorage.setItem(STORAGE_NOTIFS_CACHE_KEY, JSON.stringify(notifications));
    } catch {
      // Ignore storage quota errors
    }
  }, [supportMessages, orders, notifications]);

  // Verify admin HttpOnly cookie session on mount
  useEffect(() => {
    fetch('/api/admin/session', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ok?: boolean; authenticated?: boolean } | null) => {
        if (data?.ok && data.authenticated) {
          setIsAdminLoggedIn(true);
          if (initialHashPageRef.current === 'admin') {
            setActivePage('admin');
            try {
              window.history.replaceState(
                { page: 'admin', cat: 'instagram', serviceId: null, modal: null },
                '',
                '#admin',
              );
            } catch {
              // Ignore history errors
            }
          }
        }
      })
      .catch(() => {});
  }, []);

  // Initialize history state cleanly on mount so phone Back moves exactly 1 step per press
  useEffect(() => {
    const initialPage = initialHashPageRef.current;
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
        setCurrentServiceId(st.serviceId || null);
        setActivePage(targetPage);
        setSupportOpen(st.modal === 'support');
        setNotificationsOpen(st.modal === 'notifications');
        setAdminLoginOpen(st.modal === 'admin-login');
        if (st.modal !== 'checkout') {
          setCheckoutState(null);
        }
        return;
      }

      setSupportOpen(false);
      setNotificationsOpen(false);
      setAdminLoginOpen(false);
      setCheckoutState(null);
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
      setCurrentServiceId(next.serviceId || null);
      setSupportOpen(next.modal === 'support');
      setNotificationsOpen(next.modal === 'notifications');
      setAdminLoginOpen(next.modal === 'admin-login');
      if (next.modal !== 'checkout') {
        setCheckoutState(null);
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

  // Helper to attach persistent HMAC user token header in case cookies are blocked in WebViews
  const getUserHeaders = useCallback(
    (extra?: Record<string, string>): Record<string, string> => {
      const headers: Record<string, string> = { ...(extra ?? {}) };
      if (userToken) {
        headers['x-user-token'] = userToken;
      }
      return headers;
    },
    [userToken],
  );

  // Sync customer's live orders and Bell notifications from server
  const syncUserState = useCallback(
    async (isInitialPoll = false) => {
      try {
        const res = await fetch('/api/user-state', {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: getUserHeaders(),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok?: boolean;
          uid?: string;
          sessionToken?: string;
          orders?: OrderItem[];
          notifications?: CustomerNotification[];
        };
        if (!data.ok) return;

        if (data.uid) {
          setUid(data.uid);
        }
        if (data.sessionToken && data.sessionToken !== userToken) {
          setUserToken(data.sessionToken);
          try {
            localStorage.setItem(STORAGE_USER_TOKEN_KEY, data.sessionToken);
          } catch {
            // Ignore storage errors
          }
        }

        if (Array.isArray(data.orders)) {
          // Merge server orders with local cache so orders persist even across serverless cold restarts
          setOrders((prev) => {
            if (data.orders!.length === 0 && prev.length > 0) {
              return prev;
            }
            const byId = new Map<string, OrderItem>();
            for (const o of data.orders!) {
              byId.set(o.order_id, o);
            }
            for (const cached of prev) {
              if (!byId.has(cached.order_id) && (!data.uid || cached.uid === data.uid)) {
                byId.set(cached.order_id, cached);
              }
            }
            return Array.from(byId.values()).sort(
              (a, b) => (b.createdAt || 0) - (a.createdAt || 0) || b.id - a.id,
            );
          });
        }

        if (Array.isArray(data.notifications)) {
          if (knownCustomerNotifIdsRef.current === null || isInitialPoll) {
            knownCustomerNotifIdsRef.current = new Set(data.notifications.map((n) => n.id));
          } else {
            const fresh = data.notifications.filter(
              (n) => !n.read && !knownCustomerNotifIdsRef.current!.has(n.id),
            );
            if (fresh.length > 0) {
              for (const n of fresh) {
                knownCustomerNotifIdsRef.current.add(n.id);
              }
              const latest = fresh[0];
              showToast(
                `🔔 ${latest.message}`,
                latest.status.toLowerCase() === 'payment_failed',
              );
            }
          }

          setNotifications((prev) => {
            if (data.notifications!.length === 0 && prev.length > 0) {
              return prev;
            }
            return data.notifications!;
          });
        }
      } catch {
        // Ignore transient network errors during poll
      }
    },
    [getUserHeaders, showToast, userToken],
  );

  useEffect(() => {
    void syncUserState(true);
    const timer = window.setInterval(() => {
      void syncUserState(false);
    }, 1200);
    return () => window.clearInterval(timer);
  }, [syncUserState]);

  // Sync live Admin-edited services, prices & Home poster
  const syncLiveCatalog = useCallback(async () => {
    try {
      const res = await fetch('/api/catalog', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        ok?: boolean;
        catalog?: Record<string, ServiceCatalogOverrideItem[]>;
        posterImage?: string | null;
      };
      if (!data.ok) return;

      if (data.catalog) {
        const merged = mergeLiveCatalog(SERVICE_CATALOG, data.catalog);
        setLiveCatalog(merged);
        try {
          localStorage.setItem(STORAGE_LIVE_CATALOG_KEY, JSON.stringify(data.catalog));
        } catch {
          // Ignore storage quota errors
        }
      }
      if (data.posterImage !== undefined) {
        const nextPoster = typeof data.posterImage === 'string' && data.posterImage ? data.posterImage : null;
        setLivePoster(nextPoster);
        try {
          if (nextPoster) {
            localStorage.setItem(STORAGE_LIVE_POSTER_KEY, nextPoster);
          } else {
            localStorage.removeItem(STORAGE_LIVE_POSTER_KEY);
          }
        } catch {
          // Ignore storage quota errors
        }
      }
    } catch {
      // Ignore transient network errors
    }
  }, []);

  useEffect(() => {
    void syncLiveCatalog();
    const timer = window.setInterval(() => {
      void syncLiveCatalog();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [syncLiveCatalog]);

  // Real-time SSE stream for instant Customer Bell notifications & live catalog/poster updates
  useEffect(() => {
    if (typeof EventSource === 'undefined' || !userToken) return;
    const url = `/api/user/events?token=${encodeURIComponent(userToken)}`;
    const es = new EventSource(url);
    const onNotification = () => {
      void syncUserState(false);
    };
    const onCatalogUpdate = () => {
      void syncLiveCatalog();
    };
    es.addEventListener('notification', onNotification);
    es.addEventListener('catalog_updated', onCatalogUpdate);
    return () => {
      es.removeEventListener('notification', onNotification);
      es.removeEventListener('catalog_updated', onCatalogUpdate);
      es.close();
    };
  }, [syncLiveCatalog, syncUserState, userToken]);

  // Sync Admin live orders + trigger 3-second iPhone notification immediately when a new order arrives
  const syncAdminOverview = useCallback(
    async (isInitialPoll = false) => {
      if (!isAdminLoggedIn) return;
      const reqSeq = ++adminSyncSeqRef.current;
      try {
        const res = await fetch('/api/admin/overview', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (reqSeq !== adminSyncSeqRef.current) return;
        if (res.status === 401) {
          setIsAdminLoggedIn(false);
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok?: boolean;
          orders?: OrderItem[];
        };
        if (reqSeq !== adminSyncSeqRef.current || !data.ok) return;

        const incomingOrders = Array.isArray(data.orders) ? data.orders : [];
        const deletedIds = new Set(readAdminDeletedIds());
        const statusOverrides = readAdminStatusOverrides();
        const merged = mergeAdminOrders({
          serverOrders: incomingOrders,
          cachedOrders: readCachedAdminOrders(),
          deletedIds,
          statusOverrides,
        });

        if (knownAdminOrderIdsRef.current === null || isInitialPoll) {
          knownAdminOrderIdsRef.current = new Set(merged.map((o) => o.order_id));
        } else {
          const newIds = detectNewOrderIds(knownAdminOrderIdsRef.current, merged);
          if (newIds.length > 0) {
            for (const id of newIds) {
              knownAdminOrderIdsRef.current.add(id);
            }
            const newest = merged.find((o) => o.order_id === newIds[0]);
            playIphoneNotification3Sec();
            showToast(
              newest
                ? `🔔 New Order #${newest.id} (₹${newest.price}) • ${newest.service}`
                : '🔔 New Live Order Received!',
            );
          }
        }

        saveCachedAdminOrders(merged);
        setAdminOrders(merged);
      } catch {
        // Keep cached orders visible during transient network hiccups
      }
    },
    [isAdminLoggedIn, showToast],
  );

  // Instant Admin hydration, SSE live push, and fast 1s fallback polling
  useEffect(() => {
    if (!isAdminLoggedIn) {
      knownAdminOrderIdsRef.current = null;
      return;
    }

    // Immediately show permanently saved Admin orders before network response completes
    const deletedIds = new Set(readAdminDeletedIds());
    const initialCached = mergeAdminOrders({
      serverOrders: [],
      cachedOrders: readCachedAdminOrders(),
      deletedIds,
      statusOverrides: readAdminStatusOverrides(),
    });
    if (initialCached.length > 0) {
      setAdminOrders(initialCached);
    }

    void syncAdminOverview(true);
    const timer = window.setInterval(() => {
      void syncAdminOverview(false);
    }, 1000);

    let es: EventSource | null = null;
    if (typeof EventSource !== 'undefined') {
      es = new EventSource('/api/admin/events');
      const onLiveChange = () => {
        void syncAdminOverview(false);
      };
      const onCatalogChange = () => {
        void syncLiveCatalog();
      };
      es.addEventListener('new_order', onLiveChange);
      es.addEventListener('order_updated', onLiveChange);
      es.addEventListener('order_deleted', onLiveChange);
      es.addEventListener('catalog_updated', onCatalogChange);
    }

    return () => {
      window.clearInterval(timer);
      if (es) es.close();
    };
  }, [isAdminLoggedIn, syncAdminOverview, syncLiveCatalog]);

  // Cross-tab instant sync via BroadcastChannel (<10ms latency between customer & admin tabs)
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(LIVE_CHANNEL_NAME);
    ch.onmessage = (event: MessageEvent<{ type?: string }>) => {
      const type = event.data?.type;
      if (type === 'catalog_updated') {
        void syncLiveCatalog();
        return;
      }
      if (type === 'new_order' || type === 'order_updated' || type === 'order_deleted') {
        if (isAdminLoggedIn) {
          void syncAdminOverview(false);
        }
        if (type === 'order_updated') {
          void syncUserState(false);
        }
      }
    };
    return () => ch.close();
  }, [isAdminLoggedIn, syncAdminOverview, syncLiveCatalog, syncUserState]);

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
    const reelsOffer =
      liveCatalog.instagram.find((s) => s.id === 'ig-reels-1rs') ?? liveCatalog.instagram[1];
    pushNavState({
      page: 'prices',
      cat: 'instagram',
      serviceId: reelsOffer.id,
      modal: null,
    });
  }, [liveCatalog.instagram, pushNavState]);

  const handleGoOrders = useCallback(() => {
    playClickSound();
    pushNavState({
      page: 'orders',
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

  const handleOpenNotifications = useCallback(() => {
    playClickSound();
    pushNavState(
      {
        page: activePage,
        cat: currentCategory,
        serviceId: currentService?.id ?? null,
        modal: 'notifications',
      },
      activePage,
    );

    // Mark notifications as read so red badge clears immediately
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    fetch('/api/notifications/read', {
      method: 'POST',
      credentials: 'same-origin',
      headers: getUserHeaders(),
    }).catch(() => {});
  }, [activePage, currentCategory, currentService?.id, getUserHeaders, pushNavState]);

  const handleCloseNotifications = useCallback(() => {
    if (historyDepthRef.current > 0) {
      window.history.back();
    } else {
      setNotificationsOpen(false);
    }
  }, []);

  // Direct Order Step 1: Validate link -> Request single-use QR scanner modal
  const handleRequestDirectCheckout = useCallback(
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

      const validation = validateDirectOrderInput({
        link,
        linkPrompt: currentService.link,
        category: currentCategory,
        serviceId: currentService.id,
        selectedPrice,
      });

      if (!validation.ok) {
        showToast(validation.message, true);
        return false;
      }

      if (!selectedPrice || packIndex === null) return false;

      try {
        const res = await fetch('/api/order/checkout', {
          method: 'POST',
          credentials: 'same-origin',
          headers: getUserHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            category: currentCategory,
            serviceId: currentService.id,
            packIndex,
            link: link.trim(),
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          amount?: number;
          serviceName?: string;
          pack?: string;
          qrToken?: string;
          message?: string;
        };

        if (!res.ok || !data.ok || !data.qrToken || typeof data.amount !== 'number') {
          showToast(data.message || 'Unable to open QR scanner ❌', true);
          return false;
        }

        setCheckoutState({
          amount: data.amount,
          serviceName: data.serviceName || currentService.name,
          pack: data.pack || selectedPrice.q,
          packIndex,
          link: link.trim(),
          qrToken: data.qrToken,
        });
        pushNavState(
          {
            page: 'prices',
            cat: currentCategory,
            serviceId: currentService.id,
            modal: 'checkout',
          },
          'prices',
        );
        return true;
      } catch {
        showToast('Network Error ❌ Try Again', true);
        return false;
      }
    },
    [currentCategory, currentService, getUserHeaders, pushNavState, showToast],
  );

  const handleCloseCheckout = useCallback(() => {
    setCheckoutState(null);
    if (historyDepthRef.current > 0) {
      window.history.back();
    }
  }, []);

  // Direct Order Step 2: Submit payment screenshot & place order -> show Order Processing modal
  const handleConfirmDirectOrder = useCallback(
    async ({
      packIndex,
      link,
      screenshot,
    }: {
      packIndex: number;
      link: string;
      screenshot: string;
    }): Promise<boolean> => {
      if (!currentService) return false;
      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          credentials: 'same-origin',
          headers: getUserHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            category: currentCategory,
            serviceId: currentService.id,
            packIndex,
            link,
            screenshot,
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          order?: OrderItem;
          message?: string;
        };

        if (!res.ok || !data.ok || !data.order) {
          showToast(data.message || 'Order Failed ❌ Try Again', true);
          return false;
        }

        setOrders((prev) => [data.order!, ...prev]);
        setCheckoutState(null);
        setProcessingOrder(data.order);
        broadcastLiveSignal('new_order');
        return true;
      } catch {
        showToast('Network Error ❌ Try Again', true);
        return false;
      }
    },
    [currentCategory, currentService, getUserHeaders, showToast],
  );

  // Direct Order Step 3: Click OK on "Order Processing" -> return straight to Home
  const handleAcknowledgeProcessing = useCallback(() => {
    playClickSound();
    setProcessingOrder(null);
    pushNavState(
      {
        page: 'home',
        cat: currentCategory,
        serviceId: null,
        modal: null,
      },
      'home',
    );
  }, [currentCategory, pushNavState]);

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
      // Ignore logout error
    }
    setIsAdminLoggedIn(false);
    setAdminOrders([]);
    showToast('Admin Logged Out');
    pushNavState({
      page: 'menu',
      cat: currentCategory,
      serviceId: null,
      modal: null,
    });
  }, [currentCategory, pushNavState, showToast]);

  const handleAdminOrderStatus = useCallback(
    async ({
      orderId,
      status,
      note,
    }: {
      orderId: string;
      status: 'successful' | 'pending' | 'payment_failed';
      note?: string;
    }) => {
      playClickSound();
      const updatedAt = Date.now();
      // Invalidate any in-flight poll response that started before Admin's click
      adminSyncSeqRef.current += 1;

      // Lock Admin's explicit status choice immediately in persistent storage so it never reverts
      const nextOverrides = {
        ...readAdminStatusOverrides(),
        [orderId]: { status, adminMessage: note, updatedAt },
      };
      saveAdminStatusOverrides(nextOverrides);
      setAdminOrders((prev) => {
        const next = prev.map((o) =>
          o.order_id === orderId
            ? { ...o, status, adminMessage: note || o.adminMessage, statusUpdatedAt: updatedAt }
            : o,
        );
        saveCachedAdminOrders(next);
        return next;
      });

      try {
        const res = await fetch('/api/admin/order-status', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: orderId, status, note }),
        });
        if (!res.ok && res.status !== 404) {
          showToast('Failed to update order status ❌', true);
          return;
        }

        const label =
          status === 'successful'
            ? 'Order Marked Successful ✅'
            : status === 'payment_failed'
              ? 'Order Marked Payment Failed ❌'
              : 'Order Marked In Progress ⏳';
        showToast(label, status === 'payment_failed');
        broadcastLiveSignal('order_updated');
        await syncAdminOverview(false);
        await syncUserState(false);
      } catch {
        showToast('Network Error ❌', true);
      }
    },
    [showToast, syncAdminOverview, syncUserState],
  );

  const handleAdminDeleteOrder = useCallback(
    async (orderId: string) => {
      playClickSound();
      adminSyncSeqRef.current += 1;
      try {
        const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
          method: 'DELETE',
          credentials: 'same-origin',
        });
        if (!res.ok) {
          showToast('Delete failed ❌', true);
          return;
        }
        const nextDeleted = Array.from(new Set([...readAdminDeletedIds(), orderId]));
        saveAdminDeletedIds(nextDeleted);
        const overrides = readAdminStatusOverrides();
        if (orderId in overrides) {
          delete overrides[orderId];
          saveAdminStatusOverrides(overrides);
        }
        setAdminOrders((prev) => {
          const next = prev.filter((o) => o.order_id !== orderId);
          saveCachedAdminOrders(next);
          return next;
        });
        broadcastLiveSignal('order_deleted');
        showToast('Order Notification Deleted 🗑️');
      } catch {
        showToast('Network Error ❌', true);
      }
    },
    [showToast],
  );

  const handleAdminSendMessage = useCallback(
    async ({ orderId, message }: { orderId: string; message: string }): Promise<boolean> => {
      playClickSound();
      try {
        const res = await fetch('/api/admin/order-message', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: orderId, message }),
        });
        const data = (await res.json()) as { ok?: boolean; message?: string };
        if (!res.ok || !data.ok) {
          showToast(data.message || 'Message send failed ❌', true);
          return false;
        }
        const overrides = readAdminStatusOverrides();
        if (overrides[orderId]) {
          overrides[orderId] = { ...overrides[orderId], adminMessage: message };
          saveAdminStatusOverrides(overrides);
        }
        setAdminOrders((prev) => {
          const next = prev.map((o) =>
            o.order_id === orderId ? { ...o, adminMessage: message } : o,
          );
          saveCachedAdminOrders(next);
          return next;
        });
        showToast('Message Sent to Customer ✅');
        broadcastLiveSignal('order_updated');
        await syncAdminOverview(false);
        await syncUserState(false);
        return true;
      } catch {
        showToast('Network Error ❌', true);
        return false;
      }
    },
    [showToast, syncAdminOverview, syncUserState],
  );

  const handleAdminSaveCatalog = useCallback(
    async (nextCatalog: Record<CategoryKey, ServiceItem[]>): Promise<boolean> => {
      playClickSound();
      const payload: Record<string, ServiceCatalogOverrideItem[]> = {};
      for (const catKey of Object.keys(nextCatalog) as CategoryKey[]) {
        payload[catKey] = nextCatalog[catKey].map((svc) => ({
          id: svc.id,
          name: svc.name,
          prices: svc.prices,
        }));
      }
      try {
        const res = await fetch('/api/admin/catalog', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ catalog: payload }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          catalog?: Record<string, ServiceCatalogOverrideItem[]>;
          message?: string;
        };
        if (!res.ok || !data.ok) {
          showToast(data.message || 'Save failed ❌', true);
          return false;
        }
        if (data.catalog) {
          const merged = mergeLiveCatalog(SERVICE_CATALOG, data.catalog);
          setLiveCatalog(merged);
          try {
            localStorage.setItem(STORAGE_LIVE_CATALOG_KEY, JSON.stringify(data.catalog));
          } catch {
            // Ignore storage errors
          }
        }
        broadcastLiveSignal('catalog_updated');
        showToast('Prices & Service Live Updated ✅');
        return true;
      } catch {
        showToast('Network Error ❌', true);
        return false;
      }
    },
    [showToast],
  );

  const handleAdminResetCatalog = useCallback(async (): Promise<boolean> => {
    playClickSound();
    try {
      const res = await fetch('/api/admin/catalog', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        catalog?: Record<string, ServiceCatalogOverrideItem[]>;
      };
      if (!res.ok || !data.ok) {
        showToast('Reset failed ❌', true);
        return false;
      }
      setLiveCatalog(mergeLiveCatalog(SERVICE_CATALOG, data.catalog ?? null));
      try {
        localStorage.removeItem(STORAGE_LIVE_CATALOG_KEY);
      } catch {
        // Ignore storage errors
      }
      broadcastLiveSignal('catalog_updated');
      showToast('All Services Reset to Default ✅');
      return true;
    } catch {
      showToast('Network Error ❌', true);
      return false;
    }
  }, [showToast]);

  const handleAdminSavePoster = useCallback(
    async (posterDataUrl: string | null): Promise<boolean> => {
      playClickSound();
      try {
        const res = await fetch('/api/admin/poster', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(posterDataUrl ? { posterImage: posterDataUrl } : { reset: true }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          posterImage?: string | null;
          message?: string;
        };
        if (!res.ok || !data.ok) {
          showToast(data.message || 'Poster update failed ❌', true);
          return false;
        }
        const nextPoster = typeof data.posterImage === 'string' ? data.posterImage : null;
        setLivePoster(nextPoster);
        try {
          if (nextPoster) {
            localStorage.setItem(STORAGE_LIVE_POSTER_KEY, nextPoster);
          } else {
            localStorage.removeItem(STORAGE_LIVE_POSTER_KEY);
          }
        } catch {
          // Ignore storage errors
        }
        broadcastLiveSignal('catalog_updated');
        showToast(nextPoster ? 'Home Poster Live Updated ✅' : 'Default Poster Restored ✅');
        return true;
      } catch {
        showToast('Network Error ❌', true);
        return false;
      }
    },
    [showToast],
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
  const unreadNotifCount = countUnreadNotifications(notifications);

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
        unreadCount={unreadNotifCount}
        onLogoClick={handleGoHome}
        onBellClick={handleOpenNotifications}
      />

      <main className="max-w-[460px] mx-auto px-[14px]">
        {activePage === 'home' && (
          <HomeView
            posterImage={livePoster}
            onSelectCategory={handleSelectCategory}
            onPosterClick={handlePosterClick}
          />
        )}

        {activePage === 'services' && (
          <ServicesView
            categoryTitle={currentCatMeta.title}
            services={liveCatalog[currentCategory]}
            onBack={() => goBackOneStep('home')}
            onSelectService={handleSelectService}
          />
        )}

        {activePage === 'prices' && currentService && (
          <PricesView
            key={currentService.id}
            uid={uid}
            service={currentService}
            checkoutState={checkoutState}
            processingOrder={processingOrder}
            userToken={userToken}
            onBack={() => goBackOneStep('services')}
            onRequestCheckout={handleRequestDirectCheckout}
            onCloseCheckout={handleCloseCheckout}
            onConfirmOrder={handleConfirmDirectOrder}
            onAcknowledgeProcessing={handleAcknowledgeProcessing}
            onShowToast={showToast}
            onPlaySound={playClickSound}
          />
        )}

        {activePage === 'orders' && <OrdersView orders={orders} />}

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
          />
        )}

        {activePage === 'admin' && isAdminLoggedIn && (
          <AdminView
            orders={adminOrders}
            catalog={liveCatalog}
            posterImage={livePoster}
            onBack={() => goBackOneStep('menu')}
            onLogout={handleAdminLogout}
            onOrderStatusChange={handleAdminOrderStatus}
            onSendOrderMessage={handleAdminSendMessage}
            onDeleteOrder={handleAdminDeleteOrder}
            onSaveCatalog={handleAdminSaveCatalog}
            onResetCatalog={handleAdminResetCatalog}
            onSavePoster={handleAdminSavePoster}
            onShowToast={showToast}
            onTestSound={() => {
              unlockAudioContext();
              playIphoneNotification3Sec();
              showToast('🔔 3s iPhone Notification Alert Played');
            }}
          />
        )}
      </main>

      <NotificationsModal
        isOpen={notificationsOpen}
        notifications={notifications}
        onClose={handleCloseNotifications}
        onViewOrders={() => {
          setNotificationsOpen(false);
          handleGoOrders();
        }}
      />

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
