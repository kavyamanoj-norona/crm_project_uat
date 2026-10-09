import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { pageArgs, type ListState } from "@/lib/list";
import type { FilterTab } from "@/components/data/filter-tabs";

const containsI = (q: string) => ({ contains: q, mode: "insensitive" as const });

const activeWhere = (tab: string) =>
  tab === "active" ? { isActive: true } : tab === "inactive" ? { isActive: false } : {};

export const QC_CHECKLIST_SORTS = ["title", "createdAt"] as const;

export async function listQcChecklistPage(list: ListState) {
  const search: Prisma.QcChecklistItemWhereInput = list.q
    ? { OR: [{ title: containsI(list.q) }, { description: containsI(list.q) }] }
    : {};
  const where = { ...search, ...activeWhere(list.tab) };

  const count = (w: { isActive?: boolean }) => db.qcChecklistItem.count({ where: { ...search, ...w } });
  const [rows, total, all, active] = await Promise.all([
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
    count({}),
    count({ isActive: true }),
  ]);

  const tabs: FilterTab[] = [
    { key: "", label: "All", count: all },
    { key: "active", label: "Active", count: active },
    { key: "inactive", label: "Inactive", count: all - active },
  ];
  return { rows, total, tabs };
}

export type QcChecklistPageRow = Awaited<ReturnType<typeof listQcChecklistPage>>["rows"][number];
