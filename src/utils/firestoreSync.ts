import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type { CustomerNotification, OrderItem } from '../data/services';
import type { ServiceCatalogOverrideItem } from './panelLogic';
import { db, handleFirestoreError, OperationType } from '../firebase';

export const FIRESTORE_ORDER_ID_RE = /^ORD[0-9]{10,16}_[a-zA-Z0-9]{8,32}$/;
const MAX_RECEIPT_CHARS = 320_000;
const MAX_ALERTS_PER_ORDER = 25;
const FIRESTORE_OP_TIMEOUT_MS = 8000;
const FIRESTORE_CREATE_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms = FIRESTORE_OP_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('firestore_timeout'));
    }, ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.message === 'firestore_timeout';
}

export interface FirestoreOrderAlert {
  id: string;
  status: 'pending' | 'successful' | 'payment_failed';
  message: string;
  date: string;
  createdAt: number;
}

export interface FirestoreOrderDoc {
  id: number;
  order_id: string;
  uid: string;
  service: string;
  pack: string;
  price: number;
  amount: number;
  link: string;
  status: 'pending' | 'successful' | 'payment_failed';
  adminMessage: string;
  date: string;
  createdAt: number;
  statusUpdatedAt: number;
  messageUpdatedAt: number;
  hasPaymentScreenshot: boolean;
  hiddenFromAdmin: boolean;
  recentAlerts: FirestoreOrderAlert[];
}

const receiptCache = new Map<string, string>();

export function isValidFirestoreOrderId(orderId: string): boolean {
  return FIRESTORE_ORDER_ID_RE.test(orderId);
}

function clampString(val: string | undefined, maxLen: number): string {
  return (val || '').trim().slice(0, maxLen);
}

function normalizeStatus(raw: string | undefined): 'pending' | 'successful' | 'payment_failed' {
  const s = (raw || '').toLowerCase();
  if (s === 'successful' || s === 'completed') return 'successful';
  if (s === 'payment_failed' || s === 'failed') return 'payment_failed';
  return 'pending';
}

function sanitizeAlertList(raw: unknown): FirestoreOrderAlert[] {
  if (!Array.isArray(raw)) return [];
  const out: FirestoreOrderAlert[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Partial<FirestoreOrderAlert>;
    if (typeof obj.id !== 'string' || !obj.id) continue;
    out.push({
      id: clampString(obj.id, 80),
      status: normalizeStatus(obj.status),
      message: clampString(obj.message, 500),
      date: clampString(obj.date, 64),
      createdAt: typeof obj.createdAt === 'number' && Number.isFinite(obj.createdAt) ? obj.createdAt : Date.now(),
    });
    if (out.length >= MAX_ALERTS_PER_ORDER) break;
  }
  return out;
}

function normalizeImageDataUrl(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.replace(
    /^data:image\/(png|jpeg|jpg|webp);base64,/i,
    (_, ext: string) => `data:image/${ext.toLowerCase()};base64,`,
  );
}

function isValidReceiptDataUrl(url: string): boolean {
  return (
    url.length >= 40 &&
    url.length <= MAX_RECEIPT_CHARS &&
    (url.startsWith('data:image/png;base64,') ||
      url.startsWith('data:image/jpeg;base64,') ||
      url.startsWith('data:image/jpg;base64,') ||
      url.startsWith('data:image/webp;base64,'))
  );
}

function shrinkScreenshotIfNeeded(dataUrl: string): Promise<string> {
  const normalized = normalizeImageDataUrl(dataUrl);
  if (isValidReceiptDataUrl(normalized)) {
    return Promise.resolve(normalized);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onerror = () => resolve(normalized);
    img.onload = () => {
      const maxDim = 720;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.max(1, Math.round(width * ratio));
        height = Math.max(1, Math.round(height * ratio));
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(normalized);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      for (const quality of [0.72, 0.5, 0.35]) {
        const candidate = normalizeImageDataUrl(canvas.toDataURL('image/jpeg', quality));
        if (candidate.length <= MAX_RECEIPT_CHARS) {
          resolve(candidate);
          return;
        }
      }
      // Final smaller dimension pass for extremely dense screenshots
      const smallCanvas = document.createElement('canvas');
      smallCanvas.width = Math.max(1, Math.round(width * 0.65));
      smallCanvas.height = Math.max(1, Math.round(height * 0.65));
      const smallCtx = smallCanvas.getContext('2d');
      if (!smallCtx) {
        resolve(normalizeImageDataUrl(canvas.toDataURL('image/jpeg', 0.35)));
        return;
      }
      smallCtx.drawImage(img, 0, 0, smallCanvas.width, smallCanvas.height);
      resolve(normalizeImageDataUrl(smallCanvas.toDataURL('image/jpeg', 0.45)));
    };
    img.src = normalized;
  });
}

async function fetchUrlAsDataUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) return '';
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) return '';
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

export function firestoreDocToOrderItem(raw: Partial<FirestoreOrderDoc>): OrderItem | null {
  if (!raw || typeof raw.order_id !== 'string' || !raw.order_id) return null;
  const cachedReceipt = receiptCache.get(raw.order_id);
  return {
    id: typeof raw.id === 'number' ? raw.id : 1,
    order_id: raw.order_id,
    uid: typeof raw.uid === 'string' ? raw.uid : 'TRUST-0000',
    service: typeof raw.service === 'string' ? raw.service : 'Order',
    pack: typeof raw.pack === 'string' ? raw.pack : '',
    price: typeof raw.price === 'number' ? raw.price : 1,
    amount: typeof raw.amount === 'number' ? raw.amount : typeof raw.price === 'number' ? raw.price : 1,
    link: typeof raw.link === 'string' ? raw.link : '',
    status: normalizeStatus(raw.status),
    adminMessage: typeof raw.adminMessage === 'string' && raw.adminMessage ? raw.adminMessage : undefined,
    date: typeof raw.date === 'string' ? raw.date : '',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    statusUpdatedAt: typeof raw.statusUpdatedAt === 'number' ? raw.statusUpdatedAt : 0,
    messageUpdatedAt: typeof raw.messageUpdatedAt === 'number' ? raw.messageUpdatedAt : 0,
    hasPaymentScreenshot: Boolean(raw.hasPaymentScreenshot),
    paymentScreenshot: cachedReceipt || undefined,
    screenshotUrl: raw.hasPaymentScreenshot
      ? `/api/admin/orders/${encodeURIComponent(raw.order_id)}/screenshot`
      : undefined,
  };
}

export function firestoreAlertsToNotifications(
  order: Pick<OrderItem, 'order_id' | 'id' | 'uid' | 'service' | 'pack'>,
  alerts: FirestoreOrderAlert[],
): CustomerNotification[] {
  return alerts.map((a) => ({
    id: a.id,
    uid: order.uid || 'TRUST-0000',
    orderId: order.order_id,
    orderNum: order.id,
    service: order.service,
    pack: order.pack,
    status: a.status,
    message: a.message,
    date: a.date,
    createdAt: a.createdAt,
    read: false,
  }));
}

export async function createOrderInFirestore(
  order: OrderItem,
  paymentScreenshot: string,
): Promise<boolean> {
  if (!isValidFirestoreOrderId(order.order_id)) return false;
  const orderPath = `orders/${order.order_id}`;
  try {
    const receiptStr = paymentScreenshot ? await shrinkScreenshotIfNeeded(paymentScreenshot) : '';
    const hasReceipt = isValidReceiptDataUrl(receiptStr);

    const docPayload = {
      id: Math.max(1, Math.floor(order.id || 1)),
      order_id: order.order_id,
      uid: clampString(order.uid, 16),
      service: clampString(order.service, 120) || 'Order',
      pack: clampString(order.pack, 120) || 'Standard',
      price: Math.max(1, Number(order.price) || 1),
      amount: Math.max(1, Number(order.amount ?? order.price) || 1),
      link: clampString(order.link, 500),
      status: 'pending',
      adminMessage: '',
      date: clampString(order.date, 64) || new Date().toISOString(),
      createdAt: typeof order.createdAt === 'number' && order.createdAt > 0 ? order.createdAt : Date.now(),
      statusUpdatedAt: 0,
      messageUpdatedAt: 0,
      hasPaymentScreenshot: hasReceipt,
      hiddenFromAdmin: false,
      recentAlerts: [],
      serverCreatedAt: serverTimestamp(),
      serverUpdatedAt: serverTimestamp(),
    };

    const receiptPayload = hasReceipt
      ? {
          order_id: order.order_id,
          uid: clampString(order.uid, 16),
          paymentScreenshot: receiptStr,
          serverCreatedAt: serverTimestamp(),
        }
      : null;

    if (hasReceipt) {
      receiptCache.set(order.order_id, receiptStr);
    }

    // Commit order + isolated payment receipt atomically in a single batch so Admin phones
    // immediately have the screenshot available the instant onSnapshot delivers the order.
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'orders', order.order_id), docPayload);
      if (receiptPayload) {
        batch.set(doc(db, 'order_receipts', order.order_id), receiptPayload);
      }
      await withTimeout(batch.commit(), FIRESTORE_CREATE_TIMEOUT_MS);
      return true;
    } catch (batchErr) {
      if (isTimeoutError(batchErr)) return false;
      // Fallback: write order doc first, then receipt doc separately so the live order is never lost
      await withTimeout(setDoc(doc(db, 'orders', order.order_id), docPayload), FIRESTORE_CREATE_TIMEOUT_MS);
      if (receiptPayload) {
        try {
          await withTimeout(
            setDoc(doc(db, 'order_receipts', order.order_id), receiptPayload),
            FIRESTORE_CREATE_TIMEOUT_MS,
          );
        } catch {
          // Order itself is safely synced live even if receipt write failed
        }
      }
      return true;
    }
  } catch (error) {
    if (isTimeoutError(error)) return false;
    try {
      handleFirestoreError(error, OperationType.CREATE, orderPath);
    } catch {
      return false;
    }
  }
}

export async function backfillLocalOrdersToFirestore(
  localOrders: OrderItem[],
  existingCloudIds: Set<string>,
  adminToken?: string,
): Promise<void> {
  for (const order of localOrders.slice(0, 40)) {
    if (!isValidFirestoreOrderId(order.order_id)) continue;
    if (existingCloudIds.has(order.order_id)) continue;
    try {
      const orderRef = doc(db, 'orders', order.order_id);
      const existingSnap = await withTimeout(getDoc(orderRef));
      if (existingSnap.exists()) continue;

      let rawReceipt = order.paymentScreenshot || '';
      if (!rawReceipt && order.screenshotUrl) {
        const urlWithToken =
          adminToken && !order.screenshotUrl.includes('adminToken=')
            ? `${order.screenshotUrl}${order.screenshotUrl.includes('?') ? '&' : '?'}adminToken=${encodeURIComponent(adminToken)}`
            : order.screenshotUrl;
        rawReceipt = await fetchUrlAsDataUrl(urlWithToken);
      }

      const receiptStr = rawReceipt ? await shrinkScreenshotIfNeeded(rawReceipt) : '';
      const hasReceipt = isValidReceiptDataUrl(receiptStr);

      const status = normalizeStatus(order.status);
      const batch = writeBatch(db);
      batch.set(orderRef, {
        id: Math.max(1, Math.floor(order.id || 1)),
        order_id: order.order_id,
        uid: clampString(order.uid, 16) || 'TRUST-0000',
        service: clampString(order.service, 120) || 'Order',
        pack: clampString(order.pack, 120) || 'Standard',
        price: Math.max(1, Number(order.price) || 1),
        amount: Math.max(1, Number(order.amount ?? order.price) || 1),
        link: clampString(order.link, 500) || 'https://instagram.com',
        status,
        adminMessage: clampString(order.adminMessage, 500),
        date: clampString(order.date, 64) || new Date().toISOString(),
        createdAt: typeof order.createdAt === 'number' && order.createdAt > 0 ? order.createdAt : Date.now(),
        statusUpdatedAt: typeof order.statusUpdatedAt === 'number' ? order.statusUpdatedAt : 0,
        messageUpdatedAt: typeof order.messageUpdatedAt === 'number' ? order.messageUpdatedAt : 0,
        hasPaymentScreenshot: hasReceipt,
        hiddenFromAdmin: false,
        recentAlerts: [],
        serverCreatedAt: serverTimestamp(),
        serverUpdatedAt: serverTimestamp(),
      });
      if (hasReceipt) {
        receiptCache.set(order.order_id, receiptStr);
        batch.set(doc(db, 'order_receipts', order.order_id), {
          order_id: order.order_id,
          uid: clampString(order.uid, 16) || 'TRUST-0000',
          paymentScreenshot: receiptStr,
          serverCreatedAt: serverTimestamp(),
        });
      }
      await withTimeout(batch.commit(), FIRESTORE_CREATE_TIMEOUT_MS);
    } catch {
      // Skip individual backfill errors without interrupting live sync
    }
  }
}

export function subscribeAdminOrders(
  onSnapshotData: (payload: { orders: OrderItem[]; hiddenIds: string[] }) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(250));
  return onSnapshot(
    q,
    (snap) => {
      const visibleOrders: OrderItem[] = [];
      const hiddenIds: string[] = [];
      snap.forEach((docSnap) => {
        const raw = docSnap.data() as Partial<FirestoreOrderDoc>;
        if (!raw || typeof raw.order_id !== 'string') return;
        if (raw.hiddenFromAdmin) {
          hiddenIds.push(raw.order_id);
          return;
        }
        const item = firestoreDocToOrderItem(raw);
        if (item) visibleOrders.push(item);
      });
      onSnapshotData({ orders: visibleOrders, hiddenIds });
    },
    (error) => {
      if (onError) {
        onError(error);
      } else {
        try {
          handleFirestoreError(error, OperationType.LIST, 'orders');
        } catch {
          // Handled via structured log
        }
      }
    },
  );
}

export async function fetchOrderReceiptFromFirestore(orderId: string): Promise<string | null> {
  if (!isValidFirestoreOrderId(orderId)) return null;
  const cached = receiptCache.get(orderId);
  if (cached) return cached;
  const path = `order_receipts/${orderId}`;
  try {
    const snap = await withTimeout(getDoc(doc(db, 'order_receipts', orderId)));
    if (!snap.exists()) return null;
    const data = snap.data() as { paymentScreenshot?: string };
    if (typeof data.paymentScreenshot === 'string' && data.paymentScreenshot.startsWith('data:image/')) {
      receiptCache.set(orderId, data.paymentScreenshot);
      return data.paymentScreenshot;
    }
    return null;
  } catch (error) {
    if (isTimeoutError(error)) return null;
    try {
      handleFirestoreError(error, OperationType.GET, path);
    } catch {
      return null;
    }
  }
}

export async function syncAdminOrderUpdateToFirestore(params: {
  order: OrderItem;
  status: 'pending' | 'successful' | 'payment_failed';
  adminMessage: string;
  statusUpdatedAt: number;
  messageUpdatedAt: number;
  newAlert: FirestoreOrderAlert;
}): Promise<boolean> {
  const { order, status, adminMessage, statusUpdatedAt, messageUpdatedAt, newAlert } = params;
  if (!isValidFirestoreOrderId(order.order_id)) return false;
  const orderRef = doc(db, 'orders', order.order_id);
  const path = `orders/${order.order_id}`;
  try {
    const existingSnap = await withTimeout(getDoc(orderRef));
    const prevData = existingSnap.exists()
      ? (existingSnap.data() as Partial<FirestoreOrderDoc>)
      : null;
    const prevAlerts = sanitizeAlertList(prevData?.recentAlerts);
    const dedupedAlerts = [
      newAlert,
      ...prevAlerts.filter((a) => a.id !== newAlert.id),
    ].slice(0, MAX_ALERTS_PER_ORDER);

    if (existingSnap.exists()) {
      await withTimeout(
        updateDoc(orderRef, {
          status,
          adminMessage: clampString(adminMessage, 500),
          statusUpdatedAt: Math.max(statusUpdatedAt, Number(prevData?.statusUpdatedAt || 0)),
          messageUpdatedAt: Math.max(messageUpdatedAt, Number(prevData?.messageUpdatedAt || 0)),
          recentAlerts: dedupedAlerts,
          serverUpdatedAt: serverTimestamp(),
        }),
      );
    } else {
      await withTimeout(
        setDoc(orderRef, {
          id: Math.max(1, Math.floor(order.id || 1)),
          order_id: order.order_id,
          uid: clampString(order.uid, 16) || 'TRUST-0000',
          service: clampString(order.service, 120) || 'Order',
          pack: clampString(order.pack, 120) || 'Standard',
          price: Math.max(1, Number(order.price) || 1),
          amount: Math.max(1, Number(order.amount ?? order.price) || 1),
          link: clampString(order.link, 500) || 'https://instagram.com',
          status,
          adminMessage: clampString(adminMessage, 500),
          date: clampString(order.date, 64) || new Date().toISOString(),
          createdAt: typeof order.createdAt === 'number' && order.createdAt > 0 ? order.createdAt : Date.now(),
          statusUpdatedAt,
          messageUpdatedAt,
          hasPaymentScreenshot: Boolean(order.hasPaymentScreenshot || order.paymentScreenshot || order.screenshotUrl),
          hiddenFromAdmin: false,
          recentAlerts: dedupedAlerts,
          serverCreatedAt: serverTimestamp(),
          serverUpdatedAt: serverTimestamp(),
        }),
      );
    }
    return true;
  } catch (error) {
    if (isTimeoutError(error)) return false;
    try {
      handleFirestoreError(error, OperationType.UPDATE, path);
    } catch {
      return false;
    }
  }
}

export async function hideOrderInFirestore(orderId: string): Promise<boolean> {
  if (!isValidFirestoreOrderId(orderId)) return false;
  const orderRef = doc(db, 'orders', orderId);
  const path = `orders/${orderId}`;
  try {
    const snap = await withTimeout(getDoc(orderRef));
    if (!snap.exists()) return true;
    await withTimeout(
      updateDoc(orderRef, {
        hiddenFromAdmin: true,
        serverUpdatedAt: serverTimestamp(),
      }),
    );
    return true;
  } catch (error) {
    if (isTimeoutError(error)) return false;
    try {
      handleFirestoreError(error, OperationType.UPDATE, path);
    } catch {
      return false;
    }
  }
}

export function subscribeCustomerOrderDoc(
  orderId: string,
  onOrderUpdate: (order: OrderItem, alerts: CustomerNotification[]) => void,
): Unsubscribe {
  if (!isValidFirestoreOrderId(orderId)) {
    return () => {};
  }
  const path = `orders/${orderId}`;
  return onSnapshot(
    doc(db, 'orders', orderId),
    (snap) => {
      if (!snap.exists()) return;
      const raw = snap.data() as Partial<FirestoreOrderDoc>;
      const item = firestoreDocToOrderItem(raw);
      if (!item) return;
      const alerts = sanitizeAlertList(raw.recentAlerts);
      const notifs = firestoreAlertsToNotifications(item, alerts);
      onOrderUpdate(item, notifs);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch {
        // Keep customer UI functional via fallback sync
      }
    },
  );
}

export async function saveCatalogInFirestore(
  catalog: Record<string, ServiceCatalogOverrideItem[]> | null,
  updatedAt: number,
): Promise<boolean> {
  const ref = doc(db, 'app_config', 'catalog');
  try {
    await withTimeout(
      setDoc(ref, {
        type: 'catalog',
        catalog: catalog ?? {},
        updatedAt,
        serverUpdatedAt: serverTimestamp(),
      }),
    );
    return true;
  } catch (error) {
    if (isTimeoutError(error)) return false;
    try {
      handleFirestoreError(error, OperationType.WRITE, 'app_config/catalog');
    } catch {
      return false;
    }
  }
}

export async function savePosterInFirestore(
  posterImage: string | null,
  updatedAt: number,
): Promise<boolean> {
  const ref = doc(db, 'app_config', 'poster');
  try {
    const safePoster = posterImage ? await shrinkScreenshotIfNeeded(posterImage) : '';
    await withTimeout(
      setDoc(ref, {
        type: 'poster',
        posterImage: safePoster.slice(0, MAX_RECEIPT_CHARS),
        updatedAt,
        serverUpdatedAt: serverTimestamp(),
      }),
    );
    return true;
  } catch (error) {
    if (isTimeoutError(error)) return false;
    try {
      handleFirestoreError(error, OperationType.WRITE, 'app_config/poster');
    } catch {
      return false;
    }
  }
}

export function subscribeAppConfigInFirestore(callbacks: {
  onCatalog: (catalog: Record<string, ServiceCatalogOverrideItem[]> | null, updatedAt: number) => void;
  onPoster: (posterImage: string | null, updatedAt: number) => void;
}): Unsubscribe {
  const unsubCatalog = onSnapshot(
    doc(db, 'app_config', 'catalog'),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as {
        catalog?: Record<string, ServiceCatalogOverrideItem[]>;
        updatedAt?: number;
      };
      const ts = typeof data.updatedAt === 'number' ? data.updatedAt : 0;
      const cat =
        data.catalog && typeof data.catalog === 'object' && Object.keys(data.catalog).length > 0
          ? data.catalog
          : null;
      callbacks.onCatalog(cat, ts);
    },
    () => {
      // Ignore offline/initial read errors; server fallback remains active
    },
  );

  const unsubPoster = onSnapshot(
    doc(db, 'app_config', 'poster'),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as {
        posterImage?: string;
        updatedAt?: number;
      };
      const ts = typeof data.updatedAt === 'number' ? data.updatedAt : 0;
      const poster =
        typeof data.posterImage === 'string' && data.posterImage.startsWith('data:image/')
          ? data.posterImage
          : null;
      callbacks.onPoster(poster, ts);
    },
    () => {
      // Ignore offline/initial read errors; server fallback remains active
    },
  );

  return () => {
    unsubCatalog();
    unsubPoster();
  };
}
