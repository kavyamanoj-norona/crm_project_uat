import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { FieldError } from "@/server/prisma-errors";

const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

/** The file picked in a form's "image" input, or null when none was chosen. */
export function pickedImage(formData: FormData) {
  const image = formData.get("image");
  return image instanceof File && image.size > 0 ? image : null;
}

/** Saves an uploaded photo under public/uploads/users and returns its URL. TODO: move to S3 (blueprint §13). */
export async function saveUserImage(file: File, userId: string) {
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new FieldError("image", "Use a JPG, PNG or WebP image");
  if (file.size > IMAGE_MAX_BYTES) throw new FieldError("image", "Image must be 2 MB or smaller");
  const dir = path.join(process.cwd(), "public", "uploads", "users");
  await mkdir(dir, { recursive: true });
  const name = `${userId}-${Date.now()}.${ext}`;
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return `/uploads/users/${name}`;
}
