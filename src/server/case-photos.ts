import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/server/db";
import { PHOTO_REQUIRED_MESSAGE } from "@/lib/photos";

const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_MAX_COUNT = 8;

/** Files posted under `field`, ignoring empty file inputs. */
export function formPhotos(formData: FormData, field = "photos") {
  return formData.getAll(field).filter((f): f is File => f instanceof File && f.size > 0);
}

/** Returns an error message, or null when the photos are acceptable. */
export function photoError(photos: File[]): string | null {
  if (photos.length > PHOTO_MAX_COUNT) return `Up to ${PHOTO_MAX_COUNT} photos`;
  for (const p of photos) {
    if (!PHOTO_TYPES[p.type]) return `${p.name}: use JPG, PNG or WebP`;
    if (p.size > PHOTO_MAX_BYTES) return `${p.name} is larger than 5 MB`;
  }
  return null;
}

/** Photo checks for a form that must have at least one image: the error message, or null when the photos are fine. */
export function requiredPhotoError(photos: File[]): string | null {
  return photos.length === 0 ? PHOTO_REQUIRED_MESSAGE : photoError(photos);
}

/** Stores photos under public/uploads/stock/<folder> and records them as StockAttachments (no case involved). */
export async function saveStockPhotos(
  folder: string,
  photos: File[],
  userId: string,
  opts: { kind: string; prefix: string; stockRequestId?: string; purchaseRequestId?: string; stockUnitId?: string },
) {
  if (photos.length === 0) return;
  const dir = path.join(process.cwd(), "public", "uploads", "stock", folder);
  await mkdir(dir, { recursive: true });
  const rows = await Promise.all(
    photos.map(async (file, i) => {
      const name = `${opts.prefix}-${Date.now()}-${i + 1}.${PHOTO_TYPES[file.type]}`;
      await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
      return {
        kind: opts.kind,
        stockRequestId: opts.stockRequestId ?? null,
        purchaseRequestId: opts.purchaseRequestId ?? null,
        stockUnitId: opts.stockUnitId ?? null,
        url: `/uploads/stock/${folder}/${name}`,
        fileName: file.name,
        sizeBytes: file.size,
        createdById: userId,
      };
    }),
  );
  await db.stockAttachment.createMany({ data: rows });
}

/** Stores photos under public/uploads/cases and links them to the case. TODO: move to S3 (blueprint §13). */
export async function saveCasePhotos(
  caseId: string,
  photos: File[],
  userId: string,
  opts: { kind: string; prefix: string; returnId?: string; purchaseRequestId?: string; stockUnitId?: string },
) {
  if (photos.length === 0) return;
  const dir = path.join(process.cwd(), "public", "uploads", "cases", caseId);
  await mkdir(dir, { recursive: true });
  const rows = await Promise.all(
    photos.map(async (file, i) => {
      const name = `${opts.prefix}-${Date.now()}-${i + 1}.${PHOTO_TYPES[file.type]}`;
      await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
      return {
        caseId,
        kind: opts.kind,
        returnId: opts.returnId ?? null,
        purchaseRequestId: opts.purchaseRequestId ?? null,
        stockUnitId: opts.stockUnitId ?? null,
        url: `/uploads/cases/${caseId}/${name}`,
        fileName: file.name,
        sizeBytes: file.size,
        createdById: userId,
      };
    }),
  );
  await db.caseAttachment.createMany({ data: rows });
}
