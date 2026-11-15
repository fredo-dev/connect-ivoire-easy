import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "AIzaSyCabineOnlinePlaceholder",
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "cabine-online"}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "cabine-online",
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "cabine-online"}.appspot.com`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "000000000000",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "1:000000000000:web:0000000000000000",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const messaging = getMessaging(app);

export async function enableCabineAlerts() {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) return false;

  const token = await getToken(messaging, { vapidKey });
  localStorage.setItem("cabine-online-fcm-token", token);
  return true;
}

export function watchCabineMessages(callback: (payload: Record<string, unknown>) => void) {
  if (!("serviceWorker" in navigator)) return undefined;
  return onMessage(messaging, (payload) => callback(payload?.data ?? {}));
}
