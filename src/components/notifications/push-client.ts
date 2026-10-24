"use client";

import { getApps, initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage, type MessagePayload } from "firebase/messaging";

// Browser side of Firebase Cloud Messaging. Components pass the server action in; nothing here imports server code.

/** Cookie that remembers this device's token so signing out can retire it on the server. */
export const PUSH_COOKIE = "lc_push";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

export type RegisterDevice = (token: string, userAgent: string) => Promise<unknown>;
export type PushState = "unconfigured" | "unsupported" | "blocked" | "off" | "on";

const configured = () => Boolean(config.apiKey && config.projectId && config.appId && process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY);

export async function pushState(): Promise<PushState> {
  if (!configured()) return "unconfigured";
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator) || !(await isSupported())) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  return Notification.permission === "granted" ? "on" : "off";
}

function app() {
  return getApps()[0] ?? initializeApp(config);
}

/** Gets (or refreshes) this browser's token and gives it to the server. Needs notification permission already granted. */
export async function syncToken(register: RegisterDevice) {
  const reg = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${new URLSearchParams(config)}`);
  await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(app()), { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY, serviceWorkerRegistration: reg });
  if (!token) return null;
  await register(token, navigator.userAgent);
  try {
    document.cookie = `${PUSH_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* cookies blocked: sign-out simply can't retire this token early */
  }
  return token;
}

/** Asks for permission (must come from a click), then registers this device. */
export async function enablePush(register: RegisterDevice): Promise<PushState> {
  if ((await pushState()) === "unsupported") return "unsupported";
  const result = await Notification.requestPermission();
  if (result !== "granted") return result === "denied" ? "blocked" : "off";
  await syncToken(register);
  return "on";
}

/** Messages that arrive while the CRM is open and focused (the service worker only covers background). */
export function onForegroundMessage(handler: (m: MessagePayload) => void) {
  return onMessage(getMessaging(app()), handler);
}
