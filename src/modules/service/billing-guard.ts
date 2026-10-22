import { db } from "@/server/db";
import { formatPaise } from "@/lib/money";

/** A case that has been to the chip-level lab: its parts and lab work are priced by the lab, the branch only prices the service charge. */
export async function cameFromChipLab(caseId: string) {
  return (await db.caseStatusHistory.count({ where: { caseId, toStatus: "CHIP_TRANSFER" } })) > 0;
}

/**
 * Why a case's bill can't move on yet, or null when it is sound: every active line is billed at or above
 * its minimum selling price, each line total is price × quantity, and the case estimate equals the sum of the lines.
 */
export async function billingBlockReason(caseId: string): Promise<string | null> {
  const [lines, c] = await Promise.all([
    db.caseItem.findMany({
      where: { caseId, removedAt: null },
      select: { name: true, quantity: true, minPricePaise: true, unitPricePaise: true, lineTotalPaise: true },
    }),
    db.case.findUnique({ where: { id: caseId }, select: { estimatedCostPaise: true } }),
  ]);
  for (const l of lines) {
    if (l.unitPricePaise < l.minPricePaise)
      return `${l.name}: billed amount is below the minimum selling price (${formatPaise(l.minPricePaise)}). Correct it in the Billed ₹ column first.`;
  }
  const total = lines.reduce((sum, l) => sum + l.lineTotalPaise, 0);
  const mismatch = lines.some((l) => l.lineTotalPaise !== l.unitPricePaise * l.quantity) || (lines.length > 0 && c?.estimatedCostPaise !== total);
  return mismatch ? "The bill total is out of date. Save the billed amounts again before moving on." : null;
}
