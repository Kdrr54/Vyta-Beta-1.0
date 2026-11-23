// Apple Push Notification Service (APNs) & Smart Ring Alert Engine

export interface PushNotificationPayload {
  id: string;
  title: string;
  body: string;
  category: 'battery' | 'sleep' | 'vrc' | 'workout' | 'anomaly';
  timestamp: number;
  read: boolean;
}

const STORAGE_KEY = 'vyta_push_notifications';

const DEFAULT_NOTIFICATIONS: PushNotificationPayload[] = [];

export const getStoredNotifications = (): PushNotificationPayload[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_NOTIFICATIONS;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_NOTIFICATIONS;
  }
};

export const saveNotifications = (notifs: PushNotificationPayload[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs.slice(0, 50)));
  } catch (_) {}
};

function postNativeNotificationMessage(payload: Record<string, unknown>): boolean {
  try {
    const webkit = (window as unknown as {
      webkit?: { messageHandlers?: { vytaNotification?: { postMessage: (msg: unknown) => void } } };
    }).webkit;
    if (webkit?.messageHandlers?.vytaNotification) {
      webkit.messageHandlers.vytaNotification.postMessage(payload);
      return true;
    }
  } catch (_) {}
  return false;
}

export const requestBrowserNotificationPermission = async (): Promise<boolean> => {
  const sentNative = postNativeNotificationMessage({ action: 'requestPermission' });
  if (!('Notification' in window)) return sentNative;
  try {
    const res = await Notification.requestPermission();
    return res === 'granted' || sentNative;
  } catch {
    return sentNative;
  }
};

export const dispatchApplePush = (
  title: string,
  body: string,
  category: PushNotificationPayload['category'] = 'battery'
) => {
  const notifs = getStoredNotifications();
  const newNotif: PushNotificationPayload = {
    id: `notif-${Date.now()}`,
    title,
    body,
    category,
    timestamp: Date.now(),
    read: false,
  };
  saveNotifications([newNotif, ...notifs]);

  // Native iOS UNUserNotificationCenter local alert
  postNativeNotificationMessage({
    action: 'schedule',
    title,
    body,
    category,
  });

  // Web Notification API fallback when running outside native iOS shell
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/assets/ring/ring-gold.png',
        badge: '/assets/ring/ring-gold.png',
      });
    } catch (e) {
      console.warn('Native notification dispatch fallback:', e);
    }
  }
};
