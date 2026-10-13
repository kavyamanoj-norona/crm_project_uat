import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { pageArgs, type ListState } from "@/lib/list";
import type { FilterTab } from "@/components/data/filter-tabs";

const containsI = (q: string) => ({ contains: q, mode: "insensitive" as const });

export const QC_CHECKLIST_SORTS = ["title", "createdAt"] as const;

export async function listQcChecklistPage(list: ListState) {
  const search: Prisma.QcChecklistItemWhereInput = list.q
    ? { OR: [{ title: containsI(list.q) }, { description: containsI(list.q) }] }
    : {};
  const where = search;

  const [rows, total] = await Promise.all([
    db.qcChecklistItem.findMany({
      where,
      orderBy: { [list.sort]: list.dir },
      ...pageArgs(list),
      select: {
        id: true,
        title: true,
        description: true,
        isActive: true,
        createdAt: true,
      },
    }),
    db.qcChecklistItem.count({ where }),
  ]);

  return { rows, total, tabs: [] as FilterTab[] };
}

export type QcChecklistPageRow = Awaited<ReturnType<typeof listQcChecklistPage>>["rows"][number];
