import "server-only";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";

export type NotificationRow = {
  id: string;
  category: string;
  title: string;
  body: string;
  url: string;
  createdAt: string;
  read: boolean;
};

const toRow = (n: { id: string; category: string; title: string; body: string; url: string; createdAt: Date; readAt: Date | null }): NotificationRow => ({
  id: n.id,
  category: n.category,
  title: n.title,
  body: n.body,
  url: n.url,
  createdAt: n.createdAt.toISOString(),
  read: n.readAt !== null,
});

/** The bell: the newest alerts (read and unread) and how many are still unread. */
export async function getBell(userId: string, take = 30) {
  const [unread, rows] = await Promise.all([
    db.notification.count({ where: { userId, readAt: null } }),
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take }),
  ]);
  return { count: unread, items: rows.map(toRow) };
}

export type InboxFilter = { category?: string; status?: "read" | "unread"; date?: string; take: number };

/** The notifications page: filtered and paged. `date` is yyyy-mm-dd in India time. */
export async function listInbox(userId: string, f: InboxFilter) {
  const where: Prisma.NotificationWhereInput = { userId };
  if (f.category) where.category = f.category;
  if (f.status === "unread") where.readAt = null;
  if (f.status === "read") where.readAt = { not: null };
  if (f.date && /^\d{4}-\d{2}-\d{2}$/.test(f.date)) {
    const start = new Date(`${f.date}T00:00:00+05:30`);
    where.createdAt = { gte: start, lt: new Date(start.getTime() + 24 * 3600 * 1000) };
  }
  const [rows, total, groups] = await Promise.all([
    db.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: f.take }),
    db.notification.count({ where }),
    db.notification.groupBy({ by: ["category"], where: { userId }, _count: { _all: true } }),
  ]);
  return { rows: rows.map(toRow), total, counts: Object.fromEntries(groups.map((g) => [g.category, g._count._all])) as Record<string, number> };
}
