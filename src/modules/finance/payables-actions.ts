"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import type { FormState } from "@/lib/form";
import { FINANCE_PATHS } from "./paths";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
const MAX_BYTES = 5 * 1024 * 1024;

const fail = (field: string, message: string): FormState => ({ message, fieldErrors: { [field]: [message] } });

/** Keep a file (agreement, GST certificate, statement …) against a supplier. Image or PDF, up to 5 MB. */
export async function uploadSupplierDocument(supplierId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const file = fd.getAll("file").find((f): f is File => f instanceof File && f.size > 0);
    const title = String(fd.get("title") ?? "").trim().slice(0, 100);
    if (!file) return fail("file", "Choose a file to upload");
    const ext = TYPES[file.type];
    if (!ext) return fail("file", "Use a JPG, PNG or WebP photo, or a PDF");
    if (file.size > MAX_BYTES) return fail("file", "The file is larger than 5 MB");
    const name = title || file.name.replace(/\.[^.]+$/, "").slice(0, 100) || "Document";

    const user = await requireActionPermission(FINANCE_PATHS.payables, "canEdit");
    const supplier = await db.supplier.findFirst({ where: { id: supplierId, isDelete: 0 }, select: { name: true } });
    if (!supplier) return { message: "Supplier not found." };

    // TODO: move to S3 with the other uploads (blueprint §13).
    const dir = path.join(process.cwd(), "public", "uploads", "supplier-docs", supplierId);
    await mkdir(dir, { recursive: true });
    const stored = `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
    await writeFile(path.join(dir, stored), Buffer.from(await file.arrayBuffer()));

    const doc = await db.supplierDocument.create({ data: { supplierId, title: name, url: `/uploads/supplier-docs/${supplierId}/${stored}`, createdById: user.id } });
    await logActivity({ action: "finance.supplier-document", userId: user.id, entity: "SupplierDocument", entityId: doc.id, detail: `${name} added for ${supplier.name}` });
    revalidatePath("/finance", "layout");
    return { ok: true, message: "Document uploaded." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
}
