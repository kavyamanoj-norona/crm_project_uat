"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { pick, toFieldErrors, type FormState } from "@/lib/form";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { encryptText } from "@/server/crypto";
import { getBranchScope } from "@/server/branch-scope";
import { FieldError, handleActionError } from "@/server/prisma-errors";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import type { CurrentUser } from "@/server/auth/session";
import { CUSTOMER_PATHS } from "@/modules/customers/paths";
import { describeChanges, upsertIntakeCustomer } from "@/modules/customers/service";
import { INTAKE_FIELDS, INTAKE_LABELS, intakeSchema, type CustomerMatch, type IntakeInput } from "../case-schema";
import { nextJobsheetNo } from "../jobsheet";
import { SERVICE_PATHS } from "../paths";

const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_MAX_COUNT = 8;

/** Phone-first lookup on the intake form. Returns null for no match or no permission. */
export async function lookupCustomer(phone: string): Promise<CustomerMatch | null> {
  try {
    await requireActionPermission(SERVICE_PATHS.newCase, "canCreate");
  } catch (e) {
    if (e instanceof ForbiddenError) return null;
    throw e;
  }
  const digits = normalizePhone(phone);
  if (!isValidPhone(digits)) return null;
  return db.customer.findUnique({
    where: { phone: digits },
    select: { id: true, code: true, name: true, email: true, altPhone: true, type: true, visitCount: true, isActive: true },
  });
}

function checkPhotos(photos: File[]) {
  if (photos.length > PHOTO_MAX_COUNT) throw new FieldError("photos", `Up to ${PHOTO_MAX_COUNT} photos`);
  for (const p of photos) {
    if (!PHOTO_TYPES[p.type]) throw new FieldError("photos", `${p.name}: use JPG, PNG or WebP`);
    if (p.size > PHOTO_MAX_BYTES) throw new FieldError("photos", `${p.name} is larger than 5 MB`);
  }
}

/** The picked branch must be a counter inside the user's branch scope. */
async function allowedBranch(user: CurrentUser, branchId: string) {
  const scope = await getBranchScope(user);
  if (scope.branchId && scope.branchId !== branchId) throw new FieldError("branchId", "Pick the branch you are working in");
  const branch = await db.branch.findUnique({ where: { id: branchId }, select: { id: true, code: true, isActive: true, isVirtual: true } });
  if (!branch?.isActive || branch.isVirtual) throw new FieldError("branchId", "Pick an active branch counter");
  return branch;
}

async function checkAccount(data: IntakeInput) {
  if (!data.accountId) return;
  const account = await db.customer.findUnique({ where: { id: data.accountId }, select: { type: true, isActive: true } });
  if (data.accountId && (!account?.isActive || account.type !== "BUSINESS"))
    throw new FieldError("accountId", "Pick an active business account");
}

const isUniqueViolation = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

/** Two counters saving the same new phone at once collide on the unique index; the retry finds the other's row. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= attempts || !isUniqueViolation(e)) throw e;
    }
  }
}

/** Stores intake photos under public/uploads/cases. TODO: move to S3 (blueprint §13). */
async function savePhotos(caseId: string, photos: File[], userId: string) {
  const dir = path.join(process.cwd(), "public", "uploads", "cases", caseId);
  await mkdir(dir, { recursive: true });
  const rows = await Promise.all(
    photos.map(async (file, i) => {
      const name = `intake-${Date.now()}-${i + 1}.${PHOTO_TYPES[file.type]}`;
      await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
      return { caseId, url: `/uploads/cases/${caseId}/${name}`, fileName: file.name, sizeBytes: file.size, createdById: userId };
    }),
  );
  await db.caseAttachment.createMany({ data: rows });
}

export async function createCase(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = intakeSchema.safeParse(pick(formData, INTAKE_FIELDS));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  const data = parsed.data;
  const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);

  let saved: { id: string; jobsheetNo: string };
  let photosFailed = false;
  try {
    const actor = await requireActionPermission(SERVICE_PATHS.newCase, "canCreate");
    checkPhotos(photos);
    const branch = await allowedBranch(actor, data.branchId);
    await checkAccount(data);
    const devicePasswordEnc = data.devicePassword ? encryptText(data.devicePassword) : null;

    const result = await withRetry(() =>
      db.$transaction(async (tx) => {
        const customer = await upsertIntakeCustomer(
          tx,
          { phone: data.phone, name: data.name, email: data.email, altPhone: data.altPhone, source: data.source },
          actor.id,
          branch.id,
        );
        const jobsheetNo = await nextJobsheetNo(tx, branch.code);
        const created = await tx.case.create({
          data: {
            jobsheetNo,
            branchId: branch.id,
            customerId: customer.customer.id,
            accountId: data.accountId,
            intakeType: data.intakeType,
            source: data.source,
            siteAddress: data.intakeType === "WALK_IN" ? null : data.siteAddress,
            siteLatitude: data.intakeType === "ON_SITE" ? data.siteLatitude : null,
            siteLongitude: data.intakeType === "ON_SITE" ? data.siteLongitude : null,
            productType: data.productType,
            brand: data.brand,
            model: data.model,
            serialNo: data.serialNo,
            warrantyStatus: data.warrantyStatus,
            devicePasswordEnc,
            problemReported: data.problemReported,
            createdById: actor.id,
            updatedById: actor.id,
            receivedItems: { create: data.receivedItems.map((item, i) => ({ ...item, sortOrder: i })) },
            statusHistory: { create: { toStatus: "INTAKE", note: "Case created", changedById: actor.id } },
          },
          select: { id: true, jobsheetNo: true },
        });
        if (data.advanceAmount && data.advanceMode) {
          await tx.payment.create({
            data: {
              branchId: branch.id,
              caseId: created.id,
              customerId: customer.customer.id,
              kind: "ADVANCE",
              mode: data.advanceMode,
              amountPaise: data.advanceAmount,
              receivedById: actor.id,
            },
          });
        }
        return { ...created, customer };
      }),
    );
    saved = result;

    // Photos go to disk after the commit; a failure there must not lose the case.
    if (photos.length > 0) {
      try {
        await savePhotos(result.id, photos, actor.id);
      } catch (e) {
        console.error("intake photo upload failed", e);
        photosFailed = true;
      }
    }

    await logActivity({ action: "case.create", userId: actor.id, entity: "Case", entityId: result.id, detail: result.jobsheetNo });
    const c = result.customer;
    if (c.created) {
      await logActivity({ action: "customer.create", userId: actor.id, entity: "Customer", entityId: c.customer.id, detail: `At intake of ${result.jobsheetNo}` });
    } else if (c.changed.length > 0) {
      await logActivity({
        action: "customer.update",
        userId: actor.id,
        entity: "Customer",
        entityId: c.customer.id,
        detail: `${describeChanges(c.changed)} (intake of ${result.jobsheetNo})`,
      });
    }
  } catch (e) {
    return handleActionError(e, INTAKE_LABELS, formData);
  }

  revalidatePath(SERVICE_PATHS.cases, "layout");
  revalidatePath(SERVICE_PATHS.newCase);
  revalidatePath(CUSTOMER_PATHS.database, "layout");
  redirect(`${SERVICE_PATHS.cases}/${saved.id}?saved=${Date.now()}${photosFailed ? "&photos=failed" : ""}`);
}
