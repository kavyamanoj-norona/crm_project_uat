import "server-only";
import { db } from "@/server/db";
import { GST_RATES } from "./billing-schema";

/** The GST % choices for billing items (Inventory → Configuration); the standard slabs until someone sets them. */
export async function getGstRates(): Promise<number[]> {
  const row = await db.inventoryConfig.findUnique({ where: { id: "default" }, select: { gstRates: true } });
  return row && row.gstRates.length > 0 ? row.gstRates : [...GST_RATES];
}
