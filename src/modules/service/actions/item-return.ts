"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { branchWhere, getBranchScope } from "@/server/branch-scope";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { formPhotos, photoError, saveCasePhotos } from "@/server/case-photos";
import { pick, toFieldErrors, type FormState } from "@/lib/form";
import { formatDate } from "@/lib/dates";
import { itemReturnSchema } from "../case-schema";
import { getWarrantyCover } from "../warranty";
import { SERVICE_PATHS } from "../paths";

/** Return of a part/accessory line on a closed case: notes are mandatory, photos optional. */
export async function requestItemReturn(caseItemId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = itemReturnSchema.safeParse(pick(formData, ["returnType", "notes"]));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);

  const photos = formPhotos(formData);
  const badPhoto = photoError(photos);
  if (badPhoto) return { message: `${badPhoto}.` };

  try {
    const user = await requireActionPermission(SERVICE_PATHS.cases, "canEdit");
    const scope = branchWhere(await getBranchScope(user));
    const line = await db.caseItem.findFirst({
      where: { id: caseItemId, removedAt: null, isDelete: 0, case: { ...scope } },
      select: { id: true, caseId: true, itemId: true, name: true, type: true, case: { select: { status: true } } },
    });
    if (!line) return { message: "Item not found." };
    if (line.case.status !== "CLOSED") return { message: "Items can only be returned on closed cases." };
    if (line.type !== "PART" && line.type !== "ACCESSORY") return { message: "Only parts and accessories can be returned." };

    // Warranty claims only count inside the warranty: case closed + the item's warranty days.
    let warrantyEndsAt: Date | null = null;
    if (parsed.data.returnType === "WARRANTY_CLAIM") {
      const cover = (await getWarrantyCover(line.caseId, [line.itemId])).get(line.itemId);
      if (!cover?.days) return { message: "This item has no warranty. Choose Return instead.", fieldErrors: { returnType: ["This item has no warranty"] } };
      if (!cover.covered)
        return {
          message: `The warranty ended on ${formatDate(cover.endsAt)}. Choose Return instead.`,
          fieldErrors: { returnType: ["The warranty has ended"] },
        };
      warrantyEndsAt = cover.endsAt;
    }

    const open = await db.caseItemReturn.findFirst({
      where: { caseItemId, status: { in: ["REQUESTED", "APPROVED"] }, isDelete: 0 },
      select: { id: true },
    });
    if (open) return { message: "A return is already open for this item." };

    const ret = await db.caseItemReturn.create({
      data: { caseId: line.caseId, caseItemId, returnType: parsed.data.returnType, warrantyEndsAt, notes: parsed.data.notes, createdById: user.id },
      select: { id: true },
    });

    await saveCasePhotos(line.caseId, photos, user.id, { kind: "RETURN_PHOTO", prefix: "return", returnId: ret.id });

    await logActivity({
      action: "case.item_return",
      userId: user.id,
      entity: "Case",
      entityId: line.caseId,
      detail: `${parsed.data.returnType === "WARRANTY_CLAIM" ? "Warranty claim" : "Return"} requested for ${line.name}`,
    });
    revalidatePath(SERVICE_PATHS.cases, "layout");
    return { ok: true, message: "Return requested." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
}
