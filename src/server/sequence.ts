import "server-only";
import { db, type Tx } from "@/server/db";

/**
 * Next value of the counter `key`, starting at 1. A single
 * INSERT … ON CONFLICT … RETURNING, so two requests can never get the same
 * number. Call it with the transaction client of the save that uses the number:
 * if that save rolls back, so does the increment.
 */
export async function nextSequence(tx: Tx, key: string): Promise<number> {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "number_sequence" ("key", "value", "updatedAt")
    VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE
      SET "value" = "number_sequence"."value" + 1, "updatedAt" = now()
    RETURNING "value"`;
  return Number(rows[0]!.value);
}

/** The value nextSequence() would hand out now — for previews only, never for saving. */
export async function peekSequence(key: string): Promise<number> {
  const row = await db.numberSequence.findUnique({ where: { key }, select: { value: true } });
  return (row?.value ?? 0) + 1;
}

/**
 * Reserves `count` consecutive numbers of the counter `key` in one statement and returns the first.
 * Use it when one save needs many numbers (e.g. a USID per purchased unit).
 */
export async function reserveSequence(tx: Tx, key: string, count: number): Promise<number> {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "number_sequence" ("key", "value", "updatedAt")
    VALUES (${key}, ${count}, now())
    ON CONFLICT ("key") DO UPDATE
      SET "value" = "number_sequence"."value" + ${count}, "updatedAt" = now()
    RETURNING "value"`;
  return Number(rows[0]!.value) - count + 1;
}
