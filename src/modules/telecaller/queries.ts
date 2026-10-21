import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { pageArgs, type ListState } from "@/lib/list";
import type { FilterTab } from "@/components/data/filter-tabs";
import { leadWhere, branchWhere, type BranchScope } from "@/server/branch-scope";
import { istDay, todayIst } from "@/modules/finance/daybook-dates";
import { CLOSED_STATUSES, CONVERTED_STATUSES } from "./status";

const who = { select: { firstName: true, lastName: true } } as const;
const contains = (q: string) => ({ contains: q, mode: "insensitive" as const });
const closed = [...CLOSED_STATUSES];

/** First instant of a month ("2026-10") in IST, and of the month after. */
export function monthRange(month: string) {
  const from = istDay(`${month}-01`).from;
  const [y, m] = month.split("-").map(Number) as [number, number];
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { from, to: istDay(`${next}-01`).from };
}
export const currentMonth = () => todayIst().slice(0, 7);
export const isMonth = (v: string | undefined): v is string => !!v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

// ─── Leads list ──────────────────────────────────────────────────────────────

export const TELECALLER_LEAD_SORTS = ["createdAt", "code", "name", "phone", "updatedAt", "followUp"] as const;

/**
 * The Leads screen: every lead with its tracking columns. A telecaller sees the leads assigned to them plus unassigned ones;
 * branch staff see their branch's plus unassigned (leadWhere); Head Office / admin see all.
 */
export async function listTelecallerLeads(list: ListState, scope: BranchScope, telecallerId: string | null) {
  const digits = list.q.replace(/\D/g, "");
  const text: Prisma.CustomerWhereInput = list.q
    ? {
        OR: [
          { name: contains(list.q) },
          { code: contains(list.q) },
          { leadCode: contains(list.q) },
          { email: contains(list.q) },
          { purpose: contains(list.q) },
          { leadProfile: { tokenNo: contains(list.q) } },
          ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
        ],
      }
    : {};
  const mine: Prisma.CustomerWhereInput = telecallerId ? { leadProfile: { OR: [{ assignedTelecallerId: telecallerId }, { assignedTelecallerId: null }] } } : {};
  const base: Prisma.CustomerWhereInput = { AND: [{ leadCode: { not: null } }, leadWhere(scope), mine, text] };

  const now = new Date();
  const TAB: Record<string, Prisma.CustomerWhereInput> = {
    "": { kind: "LEAD", leadProfile: { status: { not: "LOST" } } }, // open
    due: { kind: "LEAD", leadProfile: { nextFollowUpAt: { lte: now }, status: { notIn: closed } } },
    hot: { kind: "LEAD", leadProfile: { status: "HOT" } },
    converted: { kind: "CUSTOMER" },
    lost: { leadProfile: { status: "LOST" } },
    all: {},
  };
  const tab = TAB[list.tab] ? list.tab : "";
  const where: Prisma.CustomerWhereInput = { AND: [base, TAB[tab]!] };
  const orderBy: Prisma.CustomerOrderByWithRelationInput[] =
    list.sort === "followUp"
      ? [{ leadProfile: { nextFollowUpAt: { sort: list.dir, nulls: "last" } } }, { createdAt: "desc" }]
      : [{ [list.sort]: list.dir }, { createdAt: "desc" }];

  const count = (key: string) => db.customer.count({ where: { AND: [base, TAB[key]!] } });
  const [rows, total, open, due, hot, converted, lost, all] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy,
      include: {
        createdBy: who,
        convertedBy: who,
        branch: { select: { code: true, name: true } },
        leadProfile: { include: { salesPerson: who, assignedTelecaller: who } },
      },
      ...pageArgs(list),
    }),
    db.customer.count({ where }),
    count(""),
    count("due"),
    count("hot"),
    count("converted"),
    count("lost"),
    count("all"),
  ]);
  const tabs: FilterTab[] = [
    { key: "", label: "Open", count: open },
    { key: "due", label: "Follow-up due", count: due },
    { key: "hot", label: "Hot", count: hot },
    { key: "converted", label: "Converted", count: converted },
    { key: "lost", label: "Lost", count: lost },
    { key: "all", label: "All", count: all },
  ];
  return { rows, total, tabs };
}

/** A lead (open or converted) with its tracking row and full call history, inside the branch scope. */
export function getLeadWithCalls(id: string, where: Prisma.CustomerWhereInput) {
  return db.customer.findFirst({
    where: { AND: [{ id, leadCode: { not: null } }, where] },
    include: {
      createdBy: who,
      convertedBy: who,
      branch: { select: { id: true, code: true, name: true } },
      leadProfile: { include: { salesPerson: who, assignedTelecaller: who, assignedToBranchBy: who } },
      leadCalls: { orderBy: { calledAt: "desc" }, include: { calledBy: who, branch: { select: { code: true, name: true } } } },
    },
  });
}

/** A telecaller works the leads assigned to them and the unassigned ones; nobody else's. */
export const telecallerOwnWhere = (telecallerId: string): Prisma.CustomerWhereInput => ({
  leadProfile: { OR: [{ assignedTelecallerId: telecallerId }, { assignedTelecallerId: null }] },
});

export const leadScopeWhere = (scope: BranchScope): Prisma.CustomerWhereInput => leadWhere(scope);

// ─── Branch call list ────────────────────────────────────────────────────────

export const BRANCH_CALL_SORTS = ["followUp", "createdAt", "name"] as const;

/** Leads Head Office assigned to the branch(es) in scope, with the last call and the next follow-up. */
export async function listBranchCallLeads(list: ListState, scope: BranchScope) {
  const digits = list.q.replace(/\D/g, "");
  const text: Prisma.CustomerWhereInput = list.q
    ? { OR: [{ name: contains(list.q) }, { leadCode: contains(list.q) }, { purpose: contains(list.q) }, ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : [])] }
    : {};
  const base: Prisma.CustomerWhereInput = {
    AND: [{ leadCode: { not: null }, ...branchWhere(scope), leadProfile: { assignedToBranchAt: { not: null } } }, text],
  };
  const now = new Date();
  const TAB: Record<string, Prisma.CustomerWhereInput> = {
    "": { leadProfile: { status: { notIn: closed } } },
    due: { leadProfile: { nextFollowUpAt: { lte: now }, status: { notIn: closed } } },
    done: { leadProfile: { status: { in: closed } } },
    all: {},
  };
  const tab = TAB[list.tab] ? list.tab : "";
  const where: Prisma.CustomerWhereInput = { AND: [base, TAB[tab]!] };
  const orderBy: Prisma.CustomerOrderByWithRelationInput[] =
    list.sort === "followUp"
      ? [{ leadProfile: { nextFollowUpAt: { sort: list.dir, nulls: "last" } } }, { createdAt: "desc" }]
      : [{ [list.sort]: list.dir }, { createdAt: "desc" }];
  const count = (k: string) => db.customer.count({ where: { AND: [base, TAB[k]!] } });
  const [rows, total, open, due, done, all] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy,
      include: {
        branch: { select: { code: true, name: true } },
        leadProfile: { include: { assignedTelecaller: who } },
        leadCalls: { orderBy: { calledAt: "desc" }, take: 1, include: { calledBy: who } },
      },
      ...pageArgs(list),
    }),
    db.customer.count({ where }),
    count(""),
    count("due"),
    count("done"),
    count("all"),
  ]);
  const tabs: FilterTab[] = [
    { key: "", label: "Open", count: open },
    { key: "due", label: "Due / overdue", count: due },
    { key: "done", label: "Closed", count: done },
    { key: "all", label: "All", count: all },
  ];
  return { rows, total, tabs };
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

/** A telecaller's leads (`telecallerId`), or every lead for Head Office / admin (null). */
const ownedBy = (telecallerId: string | null): Prisma.LeadProfileWhereInput => (telecallerId ? { assignedTelecallerId: telecallerId } : {});

export async function getTelecallerDashboard(telecallerId: string | null, month: string) {
  const { from, to } = monthRange(month);
  const today = todayIst();
  const startToday = istDay(today).from;
  const endToday = istDay(today).to;
  const owned = ownedBy(telecallerId);

  const [byStatus, convertedInMonth, billedInMonth, targets, dueLeads, upcoming] = await Promise.all([
    db.leadProfile.groupBy({ by: ["status"], where: { ...owned, customer: { leadCode: { not: null }, isDelete: 0 } }, _count: { _all: true } }),
    // Credited to the lead's telecaller (or whoever converted it when it never had one).
    db.customer.count({
      where: {
        leadCode: { not: null },
        convertedAt: { gte: from, lt: to },
        ...(telecallerId ? { OR: [{ leadProfile: { assignedTelecallerId: telecallerId } }, { leadProfile: { assignedTelecallerId: null }, convertedById: telecallerId }] } : {}),
      },
    }),
    db.leadProfile.count({ where: { ...owned, status: "BILLED", billingDate: { gte: from, lt: to } } }),
    db.telecallerTarget.findMany({ where: { month, ...(telecallerId ? { userId: telecallerId } : {}) }, select: { conversionsTarget: true, billingsTarget: true } }),
    db.leadProfile.findMany({
      where: { ...owned, status: { notIn: closed }, nextFollowUpAt: { lt: endToday }, customer: { kind: "LEAD", isDelete: 0 } },
      orderBy: { nextFollowUpAt: "asc" },
      take: 100,
      include: {
        customer: { select: { id: true, name: true, phone: true, purpose: true, leadCode: true, branch: { select: { code: true } } } },
        assignedTelecaller: who,
      },
    }),
    db.leadProfile.count({ where: { ...owned, status: { notIn: closed }, nextFollowUpAt: { gte: endToday } } }),
  ]);

  const n = (...s: string[]) => byStatus.filter((r) => s.includes(r.status)).reduce((t, r) => t + r._count._all, 0);
  const total = byStatus.reduce((t, r) => t + r._count._all, 0);
  const converted = n(...CONVERTED_STATUSES);
  const billed = n("BILLED");
  const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 1000) / 10);

  return {
    total,
    hot: n("HOT"),
    lost: n("LOST"),
    billed,
    converted,
    conversionRate: pct(converted, total),
    billingRate: pct(billed, converted),
    month: {
      conversions: convertedInMonth,
      billings: billedInMonth,
      conversionsTarget: targets.reduce((t, r) => t + r.conversionsTarget, 0),
      billingsTarget: targets.reduce((t, r) => t + r.billingsTarget, 0),
    },
    overdue: dueLeads.filter((l) => l.nextFollowUpAt! < startToday),
    dueToday: dueLeads.filter((l) => l.nextFollowUpAt! >= startToday),
    upcoming,
  };
}

// ─── Service prices ──────────────────────────────────────────────────────────

export const listServicePrices = (activeOnly: boolean) =>
  db.servicePriceEstimate.findMany({ where: activeOnly ? { isActive: true } : {}, orderBy: [{ isActive: "desc" }, { name: "asc" }] });

// ─── Incentives ──────────────────────────────────────────────────────────────

export type IncentiveRow = {
  userId: string | null;
  name: string;
  /** Conversions made in the month (leads turned into branch customers). */
  conversions: number;
  billings: number;
  marginPaise: number;
  incentivePaise: number;
};

/**
 * Incentives for a month, computed from the leads themselves so they always match the conversions and billings in the CRM.
 * Every active rule that has started by the event's date applies to it; a margin-percent rule skips billings below its minimum
 * margin or with no margin recorded.
 */
export async function getIncentiveReport(month: string, onlyUserId: string | null) {
  const { from, to } = monthRange(month);
  const owner = onlyUserId ?? undefined;

  const [rules, converts, billed, telecallers] = await Promise.all([
    db.incentiveRule.findMany({ where: { isActive: true, effectiveFrom: { lt: to } }, orderBy: { effectiveFrom: "asc" } }),
    db.customer.findMany({
      where: { leadCode: { not: null }, convertedAt: { gte: from, lt: to } },
      select: { convertedAt: true, convertedById: true, leadProfile: { select: { assignedTelecallerId: true } } },
    }),
    db.leadProfile.findMany({
      where: { status: "BILLED", billingDate: { gte: from, lt: to } },
      select: { assignedTelecallerId: true, marginPaise: true, billingDate: true, customer: { select: { convertedById: true } } },
    }),
    db.user.findMany({ where: { isActive: true, privilege: { code: "TELECALLER" } }, select: { id: true, firstName: true, lastName: true }, orderBy: { firstName: "asc" } }),
  ]);

  const rows = new Map<string | null, IncentiveRow>();
  const names = new Map(telecallers.map((u) => [u.id, [u.firstName, u.lastName].filter(Boolean).join(" ")]));
  const row = (id: string | null) => {
    let r = rows.get(id);
    if (!r) {
      r = { userId: id, name: id ? (names.get(id) ?? "Former telecaller") : "Unassigned", conversions: 0, billings: 0, marginPaise: 0, incentivePaise: 0 };
      rows.set(id, r);
    }
    return r;
  };
  for (const u of telecallers) row(u.id);

  const applies = (r: (typeof rules)[number], at: Date) => r.effectiveFrom.getTime() <= at.getTime();
  for (const c of converts) {
    const id = c.leadProfile?.assignedTelecallerId ?? c.convertedById ?? null;
    if (owner && id !== owner) continue;
    const r = row(id);
    r.conversions += 1;
    for (const rule of rules) if (rule.basis === "PER_CONVERSION" && applies(rule, c.convertedAt!)) r.incentivePaise += rule.amountPaise ?? 0;
  }
  for (const b of billed) {
    const id = b.assignedTelecallerId ?? b.customer.convertedById ?? null;
    if (owner && id !== owner) continue;
    const r = row(id);
    r.billings += 1;
    r.marginPaise += b.marginPaise ?? 0;
    for (const rule of rules) {
      if (!applies(rule, b.billingDate!)) continue;
      if (rule.basis === "PER_BILLING") r.incentivePaise += rule.amountPaise ?? 0;
      if (rule.basis === "MARGIN_PERCENT" && b.marginPaise !== null && b.marginPaise > 0 && b.marginPaise >= (rule.minMarginPaise ?? 0)) {
        r.incentivePaise += Math.round((b.marginPaise * (rule.percentBp ?? 0)) / 10000);
      }
    }
  }

  const list = [...rows.values()].filter((r) => !owner || r.userId === owner).sort((a, b) => b.incentivePaise - a.incentivePaise || a.name.localeCompare(b.name));
  const total = list.reduce(
    (t, r) => ({ conversions: t.conversions + r.conversions, billings: t.billings + r.billings, marginPaise: t.marginPaise + r.marginPaise, incentivePaise: t.incentivePaise + r.incentivePaise }),
    { conversions: 0, billings: 0, marginPaise: 0, incentivePaise: 0 },
  );
  return { rows: list, total, activeRules: rules.length };
}

export const listIncentiveRules = () => db.incentiveRule.findMany({ orderBy: [{ isActive: "desc" }, { effectiveFrom: "desc" }] });

export const listTelecallers = () =>
  db.user.findMany({ where: { isActive: true, privilege: { code: "TELECALLER" } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true } });

export const listTargets = (month: string) =>
  db.telecallerTarget.findMany({ where: { month }, include: { user: who }, orderBy: { user: { firstName: "asc" } } });

/** Active staff for the "sales person" / "telecaller" pickers on the lead form. */
export const listStaffOptions = () =>
  db.user.findMany({ where: { isActive: true, status: "WORKING" }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true } });
