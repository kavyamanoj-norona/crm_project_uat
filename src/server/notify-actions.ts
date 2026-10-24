"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/session";

/** Marks the signed-in user's own alert as read, or all of them when no id is given. */
export async function markNotificationsRead(id?: string) {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null, ...(id ? { id } : {}) }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
}

/** Archives (hides) one of the user's alerts. Nothing is deleted. */
export async function archiveNotification(id: string) {
  const user = await requireUser();
  await db.notification.updateMany({ where: { id, userId: user.id }, data: { isDelete: 1, readAt: new Date() } });
  revalidatePath("/", "layout");
}
