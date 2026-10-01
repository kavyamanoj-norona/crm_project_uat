import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// AES-256-GCM for small secrets stored in the database (device passcodes).
// Stored as "v1.<iv>.<tag>.<ciphertext>" in base64url.

function key() {
  const secret = process.env.DATA_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error("DATA_ENCRYPTION_KEY must be set and at least 32 characters");
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptText(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), data].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function decryptText(stored: string): string {
  const [version, iv, tag, data] = stored.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unknown encrypted value format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
