"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/auth/session";
import { logActivity } from "@/server/security/activity";
import { BRANCH_COOKIE } from "./branch-scope";

/** Header branch switcher. `null` = all branches. Refused for branch-bound users. */
export async function setBranchScope(branchId: string | null) {
  const user = await getCurrentUser();
  if (!user || user.privilege.isBranchBound) return;

  const cookieStore = await cookies();
  if (!branchId) {
    cookieStore.delete(BRANCH_COOKIE);
  } else {
    const branch = await db.branch.findFirst({ where: { id: branchId, isActive: true }, select: { id: true } });
    if (!branch) return;
    cookieStore.set(BRANCH_COOKIE, branch.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  await logActivity({ action: "branch.switch", userId: user.id, entity: "Branch", entityId: branchId ?? "all" });
  revalidatePath("/", "layout"); // every page re-reads its data for the new branch
}
