"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { pick, toFieldErrors, type ActionResult, type FormState } from "@/lib/form";
import { QC_CHECKLIST_FIELDS, qcChecklistSchema } from "../qc-checklist-schema";
import { SERVICE_PATHS } from "../paths";

export async function saveQcChecklistItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = formData.get("id")?.toString() || null;
  const parsed = qcChecklistSchema.safeParse(pick(formData, QC_CHECKLIST_FIELDS));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);

  let savedId: string;
  try {
    const user = await requireActionPermission(SERVICE_PATHS.qcChecklist, id ? "canEdit" : "canCreate");
    const { title, description } = parsed.data;
    if (id) {
      const { count } = await db.qcChecklistItem.updateMany({
        where: { id },
        data: { title, description: description ?? null, updatedById: user.id },
      });
      if (count === 0) return { message: "Checklist item not found." };
      savedId = id;
    } else {
      const max = await db.qcChecklistItem.aggregate({ _max: { sortOrder: true } });
      const item = await db.qcChecklistItem.create({
        data: {
          title,
          description: description ?? null,
          sortOrder: (max._max.sortOrder ?? 0) + 10,
          createdById: user.id,
        },
      });
      savedId = item.id;
    }
    await logActivity({
      action: id ? "qc-checklist.update" : "qc-checklist.create",
      userId: user.id,
      entity: "QcChecklistItem",
      entityId: savedId,
      detail: title,
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }

  revalidatePath(SERVICE_PATHS.qcChecklist);
  redirect(`${SERVICE_PATHS.qcChecklist}?saved=${Date.now()}${id ? "" : `&highlight=${savedId}`}`);
}

export async function toggleQcChecklistActive(id: string): Promise<ActionResult> {
  try {
    const user = await requireActionPermission(SERVICE_PATHS.qcChecklist, "canEdit");
    const item = await db.qcChecklistItem.findUnique({ where: { id }, select: { isActive: true, title: true } });
    if (!item) return { ok: false, message: "Checklist item not found." };
    await db.qcChecklistItem.update({
      where: { id },
      data: { isActive: !item.isActive, updatedById: user.id },
    });
    await logActivity({
      action: "qc-checklist.toggle",
      userId: user.id,
      entity: "QcChecklistItem",
      entityId: id,
      detail: `${item.isActive ? "Deactivated" : "Reactivated"}: ${item.title}`,
    });
    revalidatePath(SERVICE_PATHS.qcChecklist);
    return { ok: true, message: item.isActive ? "Checklist item deactivated." : "Checklist item reactivated." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}
