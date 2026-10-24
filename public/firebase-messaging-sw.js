/* Firebase Cloud Messaging service worker: shows notifications while the CRM tab is closed or in the background.
   The Firebase web config is passed in the registration URL (a service worker cannot read env vars). */
importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js");

const params = new URL(self.location.href).searchParams;
firebase.initializeApp({
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
});
const messaging = firebase.messaging();

// Messages are data-only, so the notification is drawn here and looks the same on every browser.
messaging.onBackgroundMessage((payload) => {
  const { title, body, url, tag } = payload.data || {};
  return self.registration.showNotification(title || "Laptop Clinic CRM", {
    body: body || "",
    tag: tag || undefined,
    icon: "/CRM-logo.png",
    data: { url: url || "/" },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => new URL(w.url).origin === self.location.origin);
      return open ? open.navigate(url).then((w) => w && w.focus()) : self.clients.openWindow(url);
    }),
  );
});
