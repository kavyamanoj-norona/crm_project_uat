import "server-only";
import { db, type Tx } from "@/server/db";
import { DEFAULT_USID_CONFIG, formatUsid } from "./usid-schema";

type Client = Tx | typeof db;

/** The current USID configuration (the default when nobody has set one yet). */
export async function getUsidConfig(client: Client = db) {
  const row = await client.inventoryConfig.findUnique({ where: { id: "default" } });
  return row ?? { id: "default", ...DEFAULT_USID_CONFIG, updatedById: null, updatedAt: null as Date | null };
}

/** The USID the next purchased unit would get, for display only. */
export async function previewNextUsid() {
  const c = await getUsidConfig();
  return formatUsid(c.prefix, c.width, c.nextNumber);
}

/**
 * Issues `count` sequential, unique USIDs inside the caller's transaction. The configuration row is locked, so two
 * bills saved at once never get the same number, and a rolled-back bill hands its numbers back. A number that is
 * already taken by any existing unit is skipped, so an existing USID is never reused or changed.
 */
export async function issueUsids(tx: Tx, count: number): Promise<string[]> {
  if (count <= 0) return [];
  await tx.inventoryConfig.upsert({ where: { id: "default" }, update: {}, create: { id: "default", ...DEFAULT_USID_CONFIG } });
  await tx.$queryRaw`SELECT "id" FROM "inventory_config" WHERE "id" = 'default' FOR UPDATE`;
  const cfg = await tx.inventoryConfig.findUniqueOrThrow({ where: { id: "default" } });

  const out: string[] = [];
  let n = cfg.nextNumber;
  while (out.length < count) {
    const batch = Array.from({ length: count - out.length + 20 }, (_, k) => formatUsid(cfg.prefix, cfg.width, n + k));
    const taken = new Set(
      (await tx.stockUnit.findMany({ where: { usid: { in: batch }, isDelete: { in: [0, 1] } }, select: { usid: true } })).map((u) => u.usid),
    );
    for (const usid of batch) {
      n++;
      if (taken.has(usid)) continue;
      out.push(usid);
      if (out.length === count) break;
    }
  }
  await tx.inventoryConfig.update({ where: { id: "default" }, data: { nextNumber: n } });
  return out;
}
