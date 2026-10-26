// Apple Push Notification Service (APNs) & Smart Ring Alert Engine

export interface PushNotificationPayload {
  id: string;
  title: string;
  body: string;
  category: 'battery' | 'sleep' | 'vrc' | 'workout';
  timestamp: number;
  read: boolean;
}

const STORAGE_KEY = 'vyta_push_notifications';

const DEFAULT_NOTIFICATIONS: PushNotificationPayload[] = [
  {
    id: 'notif-1',
    title: '🔋 Bague Vyta One',
    body: 'Charge terminée à 100%. Autonomie estimée : 7 jours.',
    category: 'battery',
    timestamp: Date.now() - 1000 * 60 * 45, // 45m ago
    read: false,
  },
  {
    id: 'notif-2',
    title: '🌙 Fenêtre de Sommeil Optimale',
    body: 'Votre rythme circadien indique une fenêtre idéale d\'endormissement à 23h15.',
    category: 'sleep',
    timestamp: Date.now() - 1000 * 60 * 180,
    read: true,
  },
  {
    id: 'notif-3',
    title: '⚡ Récupération Remarquable',
    body: 'VRC nocturne à 62 ms (+8%). Votre potentiel physique est au sommet aujourd\'hui.',
    category: 'vrc',
    timestamp: Date.now() - 1000 * 60 * 420,
    read: true,
  },
];

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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs));
};

export const requestBrowserNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) return false;
  try {
    const res = await Notification.requestPermission();
    return res === 'granted';
  } catch {
    return false;
  }
};

export const dispatchApplePush = (title: string, body: string, category: PushNotificationPayload['category'] = 'battery') => {
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

  // If browser permission is granted, display real system notification
  if ('Notification' in window && Notification.permission === 'granted') {
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

  // Dispatch custom window event for in-app banner
  window.dispatchEvent(new CustomEvent('vyta-inapp-notification', { detail: newNotif }));
};
