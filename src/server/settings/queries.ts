import "server-only";
import { db } from "@/server/db";

/**
 * Returns the 30 most recent login/logout events for the given user.
 * Used on the Security settings page to show session history.
 */
export async function getSessionHistory(userId: string) {
  return db.userActivityLog.findMany({
    where: { userId, action: { in: ["login.success", "logout"] } },
    orderBy: { at: "desc" },
    take: 30,
    select: { id: true, at: true, ip: true, userAgent: true, action: true },
  });
}

/**
 * Returns up to 50 activity log entries for the given user, filtered by tab.
 *
 * tab = "" | "all"       → all actions
 * tab = "service"        → actions starting with "case." or "customer."
 * tab = "inventory"      → actions starting with "stock.", "purchase.", or "transfer."
 * tab = "settings"       → actions starting with "user."
 */
export async function getNotificationLogs(userId: string, tab = "") {
  type WhereClause =
    | { userId: string; action: { startsWith: string } }
    | { userId: string; OR: Array<{ action: { startsWith: string } }> }
    | { userId: string };

  let where: WhereClause;

  if (tab === "service") {
    where = {
      userId,
      OR: [
        { action: { startsWith: "case." } },
        { action: { startsWith: "customer." } },
      ],
    };
  } else if (tab === "inventory") {
    where = {
      userId,
      OR: [
        { action: { startsWith: "stock." } },
        { action: { startsWith: "purchase." } },
        { action: { startsWith: "transfer." } },
      ],
    };
  } else if (tab === "settings") {
    where = { userId, action: { startsWith: "user." } };
  } else {
    // "" or "all" — return everything
    where = { userId };
  }

  return db.userActivityLog.findMany({
    where,
    orderBy: { at: "desc" },
    take: 50,
    select: {
      id: true,
      at: true,
      ip: true,
      userAgent: true,
      action: true,
      entity: true,
      entityId: true,
      detail: true,
    },
  });
}
