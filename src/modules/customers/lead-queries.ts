import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { pageArgs, type ListState } from "@/lib/list";
import type { FilterTab } from "@/components/data/filter-tabs";
import { leadWhere, type BranchScope } from "@/server/branch-scope";

// A lead is a customer-table row that has a leadCode. It stays kind LEAD until
// converted; after that it is a customer that remembers where it came from.

const contains = (q: string) => ({ contains: q, mode: "insensitive" as const });
const who = { select: { firstName: true, lastName: true } } as const;

export const LEAD_SORTS = ["createdAt", "code", "name", "phone", "updatedAt"] as const;

const TAB_WHERE: Record<string, Prisma.CustomerWhereInput> = {
  "": { kind: "LEAD", isActive: true }, // open
  converted: { kind: "CUSTOMER" },
  closed: { kind: "LEAD", isActive: false },
  all: {},
};

export async function listLeads(list: ListState, scope: BranchScope) {
  const digits = list.q.replace(/\D/g, "");
  const textSearch: Prisma.CustomerWhereInput = list.q
    ? {
        OR: [
          { name: contains(list.q) },
          { code: contains(list.q) },
          { leadCode: contains(list.q) },
          { email: contains(list.q) },
          { purpose: contains(list.q) },
          ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
        ],
      }
    : {};
  const search: Prisma.CustomerWhereInput = { AND: [{ leadCode: { not: null } }, leadWhere(scope), textSearch] };
  const tab = TAB_WHERE[list.tab] ? list.tab : "";
  const where: Prisma.CustomerWhereInput = { AND: [search, TAB_WHERE[tab]!] };

  const count = (key: string) => db.customer.count({ where: { AND: [search, TAB_WHERE[key]!] } });
  const [rows, total, open, converted, closed, all] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: [{ [list.sort]: list.dir }, { createdAt: "desc" }],
      include: {
        createdBy: who,
        updatedBy: who,
        convertedBy: who,
        branch: { select: { code: true, name: true } },
      },
      ...pageArgs(list),
    }),
    db.customer.count({ where }),
    count(""),
    count("converted"),
    count("closed"),
    count("all"),
  ]);
  const tabs: FilterTab[] = [
    { key: "", label: "Open", count: open },
    { key: "converted", label: "Converted", count: converted },
    { key: "closed", label: "Closed", count: closed },
    { key: "all", label: "All", count: all },
  ];
  return { rows, total, tabs };
}

/** One open or closed lead in the branch scope (null once converted or out of scope). */
export const getLead = (id: string, scope: BranchScope) =>
  db.customer.findFirst({ where: { AND: [{ id, kind: "LEAD" }, leadWhere(scope)] } });

// ─── Conversion report ────────────────────────────────────────────────────────

export type LeadMonthRow = {
  /** "2026-10" */
  month: string;
  total: number;
  converted: number;
  /** Leads still open from that month. */
  open: number;
  /** Conversions made in this month (whatever month the lead arrived). */
  convertedInMonth: number;
  /** converted / total, 0–100, one decimal. */
  rate: number;
};

export type LeadSourceRow = { source: string | null; total: number; converted: number; rate: number };

const rate = (converted: number, total: number) => (total === 0 ? 0 : Math.round((converted / total) * 1000) / 10);

/**
 * Monthly cohorts (IST): per month, how many leads arrived, how many of those
 * have been converted so far, and the conversion rate. Branch users see their
 * branch's leads plus unassigned ones.
 */
export async function getLeadReport(scope: BranchScope) {
  const branchCond = scope.branchId
    ? Prisma.sql`AND ("branchId" = ${scope.branchId} OR "branchId" IS NULL)`
    : Prisma.empty;

  const [cohorts, conversions, sources] = await Promise.all([
    db.$queryRaw<{ month: string; total: bigint; converted: bigint; open: bigint }[]>(Prisma.sql`
      SELECT to_char("createdAt" AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM') AS month,
             count(*) AS total,
             count("convertedAt") AS converted,
             count(*) FILTER (WHERE kind = 'LEAD' AND "isActive") AS open
      FROM customer
      WHERE "leadCode" IS NOT NULL ${branchCond}
      GROUP BY 1 ORDER BY 1 DESC`),
    db.$queryRaw<{ month: string; n: bigint }[]>(Prisma.sql`
      SELECT to_char("convertedAt" AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM') AS month, count(*) AS n
      FROM customer
      WHERE "leadCode" IS NOT NULL AND "convertedAt" IS NOT NULL ${branchCond}
      GROUP BY 1`),
    db.$queryRaw<{ source: string | null; total: bigint; converted: bigint }[]>(Prisma.sql`
      SELECT source::text AS source, count(*) AS total, count("convertedAt") AS converted
      FROM customer
      WHERE "leadCode" IS NOT NULL ${branchCond}
      GROUP BY 1 ORDER BY 2 DESC`),
  ]);

  const convertedBy = new Map(conversions.map((c) => [c.month, Number(c.n)]));
  const months: LeadMonthRow[] = cohorts.map((c) => ({
    month: c.month,
    total: Number(c.total),
    converted: Number(c.converted),
    open: Number(c.open),
    convertedInMonth: convertedBy.get(c.month) ?? 0,
    rate: rate(Number(c.converted), Number(c.total)),
  }));
  // A month with conversions but no new leads still belongs in the table.
  for (const [month, n] of convertedBy) {
    if (!months.some((m) => m.month === month)) {
      months.push({ month, total: 0, converted: 0, open: 0, convertedInMonth: n, rate: 0 });
    }
  }
  months.sort((a, b) => b.month.localeCompare(a.month));

  const total = months.reduce((s, m) => s + m.total, 0);
  const converted = months.reduce((s, m) => s + m.converted, 0);
  const open = months.reduce((s, m) => s + m.open, 0);
  const bySource: LeadSourceRow[] = sources.map((s) => ({
    source: s.source,
    total: Number(s.total),
    converted: Number(s.converted),
    rate: rate(Number(s.converted), Number(s.total)),
  }));

  return { months, bySource, totals: { total, converted, open, rate: rate(converted, total) } };
}
