import "server-only";
import { after } from "next/server";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { db } from "@/server/db";

// Push notifications through Firebase Cloud Messaging. Everything here is a no-op until the FIREBASE_* variables are
// set, and a failed push never throws: it must not undo (or slow down) the case, approval or stock change that caused it.

export type NotificationCategory = "MENTION" | "APPROVAL" | "SERVICE" | "INVENTORY";

export type PushPayload = {
  /** Groups the alert in the bell and on the notifications page. */
  category: NotificationCategory;
  title: string;
  body: string;
  /** Where a click opens. Keep it a path inside the CRM, e.g. /service/cases/<id>. */
  url: string;
  /** Same tag = replaces the earlier notification for the same thing instead of stacking. */
  tag?: string;
};

export const isPushConfigured = () =>
  Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);

function firebase() {
  return (
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Hosts store the multi-line key with literal "\n" sequences.
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    })
  );
}

const DEAD_TOKEN_CODES = ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"];

/** Sends to every registered device of these users. Never throws. */
export async function sendPush(userIds: string[], payload: PushPayload) {
  try {
    if (!isPushConfigured() || userIds.length === 0) return;
    const rows = await db.deviceToken.findMany({
      where: { userId: { in: [...new Set(userIds)] }, user: { isActive: true } },
      select: { id: true, token: true },
    });
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      const res = await getMessaging(firebase()).sendEachForMulticast({
        tokens: batch.map((r) => r.token),
        // Data-only: the service worker draws the notification, so it looks and behaves the same everywhere.
        data: { title: payload.title, body: payload.body, url: payload.url, tag: payload.tag ?? "" },
        webpush: { headers: { Urgency: "high" } },
      });
      // Tokens FCM reports as gone (site data cleared, browser uninstalled) are retired.
      const dead = res.responses.flatMap((r, j) => (!r.success && DEAD_TOKEN_CODES.includes(r.error?.code ?? "") ? [batch[j]!.id] : []));
      if (dead.length) await db.deviceToken.updateMany({ where: { id: { in: dead } }, data: { isDelete: 1 } });
    }
  } catch (e) {
    console.error("[push] send failed", e);
  }
}

export type Audience = {
  /** Specific people. */
  userIds?: (string | null | undefined)[];
  /** Everyone holding one of these privileges (codes such as PURCHASE_MANAGER). */
  privileges?: string[];
  /** With `privileges`: branch-bound staff are limited to this branch; Head Office roles are not. */
  branchId?: string;
  /** The person who did the thing: never notified about their own action. */
  exceptUserId?: string;
};

async function resolve(a: Audience) {
  const ids = (a.userIds ?? []).filter((id): id is string => Boolean(id));
  const or = [
    ...(ids.length ? [{ id: { in: ids } }] : []),
    ...(a.privileges?.length
      ? [{ privilege: { code: { in: a.privileges } }, ...(a.branchId ? { OR: [{ branchId: a.branchId }, { privilege: { isBranchBound: false } }] } : {}) }]
      : []),
  ];
  if (or.length === 0) return [];
  const users = await db.user.findMany({ where: { isActive: true, status: "WORKING", OR: or }, select: { id: true } });
  return users.map((u) => u.id).filter((id) => id !== a.exceptUserId);
}

/**
 * Alerts an audience after the current response has finished, so the action itself is never delayed: one in-app
 * notification each (bell + notifications page), plus a push to their devices when Firebase is configured.
 */
export function notify(audience: Audience, payload: PushPayload) {
  const run = async () => {
    try {
      const ids = await resolve(audience);
      if (ids.length === 0) return;
      await db.notification.createMany({
        data: ids.map((userId) => ({ userId, category: payload.category, title: payload.title, body: payload.body, url: payload.url })),
      });
      await sendPush(ids, payload);
    } catch (e) {
      console.error("[notify] failed", e);
    }
  };
  try {
    after(run);
  } catch {
    void run(); // outside a request (script, test)
  }
}

export const casePath = (caseId: string) => `/service/cases/${caseId}`;
export const labCasePath = (caseId: string) => `/service/lab/${caseId}`;
