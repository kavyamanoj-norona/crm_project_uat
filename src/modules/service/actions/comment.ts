"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { branchWhere, getBranchScope } from "@/server/branch-scope";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { requireUser } from "@/server/auth/session";
import { logActivity } from "@/server/security/activity";
import { casePath, labCasePath, notify } from "@/server/notify/push";
import type { ActionResult } from "@/lib/form";
import { SERVICE_PATHS } from "../paths";
import { caseMentionWhere } from "../comment-queries";

const MAX_LENGTH = 2000;

/**
 * The case the user may comment on: any case they can open in Cases (within their branch scope), and — for the
 * Chip Level Coordinator, who works from Head Office — any case that has been sent to the chip-level lab.
 * The Purchase Manager is not branch-bound, so Cases already covers every branch for them.
 */
async function findCommentableCase(caseId: string) {
  const select = { id: true, branchId: true, jobsheetNo: true } as const;
  const user = await requireUser();
  try {
    await requireActionPermission(SERVICE_PATHS.cases, "canView");
    const scope = branchWhere(await getBranchScope(user));
    const c = await db.case.findFirst({ where: { id: caseId, ...scope }, select });
    if (c) return { user, c };
  } catch (e) {
    if (!(e instanceof ForbiddenError)) throw e;
  }
  if (user.privilege.code === "CHIP_COORDINATOR") {
    await requireActionPermission(SERVICE_PATHS.lab, "canView");
    const c = await db.case.findFirst({ where: { id: caseId, statusHistory: { some: { toStatus: "CHIP_TRANSFER" } } }, select });
    if (c) return { user, c };
  }
  return null;
}

/**
 * Posts a message (optionally a reply) on a case. Anyone who can open the case may write. Tagged staff must be
 * people who can open it too; each gets an unread mention that shows up in their bell.
 */
export async function addCaseComment(caseId: string, input: { body: string; parentId?: string | null; mentionIds?: string[] }): Promise<ActionResult> {
  const body = String(input?.body ?? "").trim();
  if (!body) return { ok: false, message: "Write a message first." };
  if (body.length > MAX_LENGTH) return { ok: false, message: `Keep the message under ${MAX_LENGTH} characters.` };
  try {
    const found = await findCommentableCase(caseId);
    if (!found) return { ok: false, message: "Case not found." };
    const { user, c } = found;

    let parentId: string | null = null;
    if (input.parentId) {
      const parent = await db.caseComment.findFirst({ where: { id: input.parentId, caseId, isDelete: 0 }, select: { id: true } });
      if (!parent) return { ok: false, message: "The message you are replying to is no longer there." };
      parentId = parent.id;
    }

    const wanted = [...new Set((Array.isArray(input.mentionIds) ? input.mentionIds : []).map(String))].filter((id) => id !== user.id).slice(0, 20);
    const allowed = wanted.length
      ? await db.user.findMany({ where: { AND: [await caseMentionWhere(c.branchId), { id: { in: wanted } }] }, select: { id: true, privilege: { select: { code: true } } } })
      : [];

    await db.caseComment.create({
      data: {
        caseId,
        authorId: user.id,
        parentId,
        body,
        mentions: { create: allowed.map((u) => ({ userId: u.id, caseId })) },
      },
    });
    await logActivity({
      action: "case.comment",
      userId: user.id,
      entity: "Case",
      entityId: caseId,
      detail: `Comment on ${c.jobsheetNo}${parentId ? " (reply)" : ""}${allowed.length ? `, mentioned ${allowed.length}` : ""}`,
    });
    // Mentioned people hear about it even with the CRM closed; the Chip Level Coordinator opens the lab view.
    const preview = body.length > 120 ? `${body.slice(0, 117)}…` : body;
    for (const [ids, url] of [
      [allowed.filter((u) => u.privilege.code !== "CHIP_COORDINATOR"), casePath(caseId)],
      [allowed.filter((u) => u.privilege.code === "CHIP_COORDINATOR"), labCasePath(caseId)],
    ] as const)
      if (ids.length) notify({ userIds: ids.map((u) => u.id) }, { category: "MENTION", title: `${user.name} mentioned you on ${c.jobsheetNo}`, body: preview, url, tag: `mention-${caseId}` });
    revalidatePath(SERVICE_PATHS.cases, "layout");
    return { ok: true, message: "Sent." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}

/** Marks the user's own mentions as read — one, or all when no id is given. */
export async function markMentionsRead(mentionId?: string): Promise<ActionResult> {
  const user = await requireUser();
  await db.caseCommentMention.updateMany({
    where: { userId: user.id, readAt: null, ...(mentionId ? { id: mentionId } : {}) },
    data: { readAt: new Date() },
  });
  revalidatePath("/", "layout");
  return { ok: true, message: "Marked as read." };
}
