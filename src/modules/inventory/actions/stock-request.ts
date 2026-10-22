"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import type { FormState } from "@/lib/form";
import { FieldError, handleActionError } from "@/server/prisma-errors";
import { requireActionPermission, ForbiddenError } from "@/server/rbac/guard";
import { isEngineer } from "@/server/rbac/roles";
import { logActivity } from "@/server/security/activity";
import { formPhotos, requiredPhotoError, saveStockPhotos } from "@/server/case-photos";
import { INVENTORY_PATHS } from "../paths";
import { MAX_STOCK_REQUEST_QTY } from "../schemas";
import { createStockRequest } from "../stock-request";

const MAX_STOCK_REQUEST_LINES = 30;

/**
 * A branch user asks Head Office for several spare parts / accessories in one request. Needs create rights on Stock Requests
 * and a branch of their own; the lines land on the Purchasing Requests tab like any item-level request.
 */
export async function createStockRequestAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await requireActionPermission(INVENTORY_PATHS.stockRequests, "canCreate");
    // Stock requests are for Front Desk and Branch Managers; engineers never raise them, whatever permissions they hold.
    if (isEngineer(user)) throw new ForbiddenError();
    if (!user.privilege.isBranchBound || !user.branchId) throw new ForbiddenError();

    // At least one image (uploaded or taken with the camera) must come with every request.
    const photos = formPhotos(formData);
    const photoMsg = requiredPhotoError(photos);
    if (photoMsg) throw new FieldError("photos", photoMsg);

    const ids = formData.getAll("itemId").map(String);
    const qtys = formData.getAll("quantity").map(String);
    const notes = String(formData.get("notes") ?? "").trim().slice(0, 500) || null;

    // The same item picked twice is one line with the quantities added.
    const wanted = new Map<string, number>();
    for (const [i, id] of ids.entries()) {
      if (!id) throw new FieldError("lines", "Select an item on every row");
      const q = Number(qtys[i]);
      if (!Number.isInteger(q) || q < 1) throw new FieldError("lines", "Enter a whole quantity of at least 1 for every item");
      wanted.set(id, (wanted.get(id) ?? 0) + q);
    }
    if (wanted.size === 0) throw new FieldError("lines", "Add at least one item");
    if (wanted.size > MAX_STOCK_REQUEST_LINES) throw new FieldError("lines", `A request can have up to ${MAX_STOCK_REQUEST_LINES} items`);
    for (const q of wanted.values()) if (q > MAX_STOCK_REQUEST_QTY) throw new FieldError("lines", `Quantity of one item can't be more than ${MAX_STOCK_REQUEST_QTY}`);

    const items = await db.item.findMany({ where: { id: { in: [...wanted.keys()] }, isActive: true, type: { in: ["PART", "ACCESSORY"] } }, select: { id: true, name: true } });
    if (items.length !== wanted.size) throw new FieldError("lines", "Only active spare parts and accessories can be requested");
    const name = new Map(items.map((i) => [i.id, i.name]));

    const branch = await db.branch.findUniqueOrThrow({ where: { id: user.branchId }, select: { code: true } });
    const lines = [...wanted].map(([itemId, quantity]) => ({ itemId, quantity }));
    const req = await db.$transaction((tx) => createStockRequest(tx, { branchId: user.branchId!, branchCode: branch.code, userId: user.id, notes, lines }));

    await saveStockPhotos(req.id, photos, user.id, { kind: "STOCK_REQUEST_PHOTO", prefix: "request", stockRequestId: req.id });

    await logActivity({
      action: "inventory.stock-request",
      userId: user.id,
      entity: "StockRequest",
      entityId: req.id,
      detail: `${req.code}: ${lines.map((l) => `${l.quantity} × ${name.get(l.itemId)}`).join(", ")}`,
    });
    revalidatePath(INVENTORY_PATHS.stockRequests);
    revalidatePath(INVENTORY_PATHS.purchasing);
    return { ok: true, message: `Request ${req.code} sent to Head Office.` };
  } catch (e) {
    return handleActionError(e, { lines: "Items", photos: "Photos" }, formData);
  }
}
