import "server-only";
import { db } from "@/server/db";

export type WarrantyCover = {
  /** Warranty length from the catalog, in days (null = no warranty). */
  days: number | null;
  /** End of cover = the day the case was closed + warranty days. */
  endsAt: Date | null;
  /** Still inside the warranty right now. */
  covered: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Warranty cover per catalog item for a closed case. The warranty runs from
 * the moment the case was closed (the device went back to the customer).
 */
export async function getWarrantyCover(caseId: string, itemIds: string[]): Promise<Map<string, WarrantyCover>> {
  const [closed, items] = await Promise.all([
    db.caseStatusHistory.findFirst({ where: { caseId, toStatus: "CLOSED" }, orderBy: { at: "desc" }, select: { at: true } }),
    db.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, warrantyDays: true } }),
  ]);
  const now = Date.now();
  return new Map(
    items.map((i) => {
      const endsAt = closed && i.warrantyDays ? new Date(closed.at.getTime() + i.warrantyDays * DAY_MS) : null;
      return [i.id, { days: i.warrantyDays, endsAt, covered: endsAt !== null && now <= endsAt.getTime() }];
    }),
  );
}
