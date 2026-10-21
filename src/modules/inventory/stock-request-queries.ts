import "server-only";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { pageArgs, type ListState } from "@/lib/list";

export const STOCK_REQUEST_SORTS = ["createdAt", "code"] as const;

const who = { select: { firstName: true, lastName: true } } as const;

/** The branch's stock requests, newest first. `scope` is the branch scope: a branch user only ever sees their own. */
export async function listStockRequests(list: ListState, scope: { branchId?: string }) {
  const q = list.q;
  const where: Prisma.StockRequestWhereInput = {
    isDelete: 0,
    ...scope,
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" } },
            { lines: { some: { OR: [{ code: { contains: q, mode: "insensitive" } }, { item: { name: { contains: q, mode: "insensitive" } } }] } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.stockRequest.findMany({
      where,
      orderBy: [{ [list.sort]: list.dir }, { createdAt: "desc" }],
      include: {
        branch: { select: { code: true, name: true } },
        requestedBy: who,
        lines: { orderBy: { createdAt: "asc" }, select: { id: true, status: true, quantity: true, item: { select: { name: true, code: true } } } },
      },
      ...pageArgs(list),
    }),
    db.stockRequest.count({ where }),
  ]);
  return { rows, total };
}

/** One request with each line's progress and the units Head Office has transferred against it. */
export function getStockRequest(id: string, scope: { branchId?: string }) {
  return db.stockRequest.findFirst({
    where: { id, isDelete: 0, ...scope },
    include: {
      branch: { select: { code: true, name: true } },
      requestedBy: who,
      lines: {
        orderBy: { createdAt: "asc" },
        include: {
          item: { select: { name: true, code: true } },
          stockUnits: { select: { id: true, usid: true, status: true, allocatedAt: true, receivedAt: true }, orderBy: { allocatedAt: "asc" } },
        },
      },
    },
  });
}
