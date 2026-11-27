import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from "firebase/messaging";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "AIzaSyDoIc7psx4NfzVLzMQmG1oB5Iaot_yFsb4",
  authDomain: "cabine-online.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "cabine-online",
  storageBucket: "cabine-online.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "418803291709",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "1:418803291709:web:5073cb18f6388c80587c54",
  measurementId: "G-03LE3X13VB",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

let messagingPromise: Promise<Messaging | null> | null = null;

function getSafeMessaging(): Promise<Messaging | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!messagingPromise) {
    messagingPromise = isSupported()
      .then((supported) => (supported ? getMessaging(app) : null))
      .catch(() => null);
  }
  return messagingPromise;
}

export async function enableCabineAlerts() {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    return false;
  }

  const messaging = await getSafeMessaging();
  if (!messaging) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) return false;

  const token = await getToken(messaging, { vapidKey });
  localStorage.setItem("cabine-online-fcm-token", token);
  return true;
}

export function watchCabineMessages(callback: (payload: Record<string, unknown>) => void) {
  let unsubscribe: (() => void) | undefined;

  void getSafeMessaging().then((messaging) => {
    if (!messaging) return;
    unsubscribe = onMessage(messaging, (payload) => callback(payload?.data ?? {}));
  });

  return () => {
    if (unsubscribe) unsubscribe();
  };
}
