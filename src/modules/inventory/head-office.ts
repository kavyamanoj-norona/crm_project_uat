import "server-only";
import { db, type Tx } from "@/server/db";

// Purchase bills are a Head Office matter: every bought unit lands in central stock, held by this
// virtual branch. A real branch only gets involved when a USID is allocated to one of its cases.
export const HEAD_OFFICE_CODE = "HO";

/** The Head Office stock location. Created on first use if the seed has not run. */
export async function getHeadOfficeBranch(client: Tx | typeof db = db) {
  const found = await client.branch.findUnique({ where: { code: HEAD_OFFICE_CODE }, select: { id: true, code: true, isActive: true } });
  if (found) return found;
  const company = await client.company.findFirst({ select: { id: true } });
  if (!company) throw new Error("No company is set up, so the Head Office stock location cannot be created.");
  return client.branch.create({
    data: { code: HEAD_OFFICE_CODE, name: "Head Office", isVirtual: true, companyId: company.id },
    select: { id: true, code: true, isActive: true },
  });
}
