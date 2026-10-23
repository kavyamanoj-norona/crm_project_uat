import "server-only";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { pageArgs, type ListState } from "@/lib/list";
import type { FilterTab } from "@/components/data/filter-tabs";

export const APPROVAL_SORTS = ["requestedAt"] as const;

type Kind = "MANUAL_APPROVAL" | "LAB_QUOTE";

const contains = (q: string) => ({ contains: q, mode: "insensitive" as const });
const TABS = ["APPROVED", "REJECTED", "ALL"] as const;
const OPEN = ["PENDING", "SENT"] as const;

/**
 * The Approval Inbox: manual Head Office approvals (Purchase Manager) and chip-level lab quotes (the originating
 * branch). `kinds` is what this user works on; `branchId` is the header scope (null = all branches). Open requests first.
 */
export async function listApprovalRequests(list: ListState, branchId: string | null, kinds: Kind[]) {
  const where0: Prisma.CaseApprovalRequestWhereInput = {
    kind: { in: kinds },
    ...(branchId ? { branchId } : {}),
    ...(list.q
      ? {
          OR: [
            { case: { jobsheetNo: contains(list.q) } },
            { case: { customer: { name: contains(list.q) } } },
            { case: { branch: { name: contains(list.q) } } },
          ],
        }
      : {}),
  };
  const tab = (TABS as readonly string[]).includes(list.tab) ? list.tab : "OPEN";
  const status: Prisma.CaseApprovalRequestWhereInput =
    tab === "OPEN" ? { status: { in: [...OPEN] } } : tab === "ALL" ? {} : { status: tab as "APPROVED" | "REJECTED" };
  const where: Prisma.CaseApprovalRequestWhereInput = { ...where0, ...status };
  const who = { select: { firstName: true, lastName: true } } as const;
  const [rows, total, groups] = await Promise.all([
    db.caseApprovalRequest.findMany({
      where,
      orderBy: { requestedAt: list.dir },
      ...pageArgs(list),
      include: {
        requestedBy: who,
        reviewedBy: who,
        sentBy: who,
        case: {
          select: {
            id: true,
            jobsheetNo: true,
            status: true,
            estimatedCostPaise: true,
            brand: true,
            model: true,
            customer: { select: { name: true, phone: true } },
            branch: { select: { code: true, name: true } },
          },
        },
      },
    }),
    db.caseApprovalRequest.count({ where }),
    db.caseApprovalRequest.groupBy({ by: ["status"], where: where0, _count: { _all: true } }),
  ]);
  const n = (s: string) => groups.find((g) => g.status === s)?._count._all ?? 0;
  const tabs: FilterTab[] = [
    { key: "", label: "Open", count: n("PENDING") + n("SENT"), isDefault: true },
    { key: "APPROVED", label: "Approved", count: n("APPROVED") },
    { key: "REJECTED", label: "Rejected", count: n("REJECTED") },
    { key: "ALL", label: "All", count: groups.reduce((s, g) => s + g._count._all, 0) },
  ];
  return { rows, total, tabs };
}

/** Open requests this user has to act on: the sidebar badge on the Approval Inbox. */
export function countOpenApprovals(branchId: string | null, kinds: Kind[]) {
  return db.caseApprovalRequest.count({
    where: {
      kind: { in: kinds },
      status: { in: [...OPEN] },
      ...(branchId ? { branchId } : {}),
    },
  });
}
