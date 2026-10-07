import { redirect } from "next/navigation";
import { AlarmClock, Cpu, Inbox, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/data/stat-card";
import { DataTable } from "@/components/data/data-table";
import type { Column } from "@/components/data/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { personName } from "@/components/data/who-when";
import { formatPaise } from "@/lib/money";
import { db } from "@/server/db";
import { branchWhere, getBranchScope } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";
import { SERVICE_PATHS } from "@/modules/service/paths";
import type { CaseStatusValue } from "@/modules/service/case-schema";

export const metadata = { title: "Chip-Level Lab" };

/** Lab-specific stage labels — the vocabulary the chip team uses, not the generic CRM labels. */
const STAGE_LABEL: Record<CaseStatusValue, string> = {
  INTAKE: "Incoming",
  DIAGNOSIS: "Lab-diagnosed",
  PENDING_APPROVAL: "Branch-quoted",
  AWAITING_STOCK: "Awaiting parts",
  QUALITY_CHECK: "In repair",
  READY_FOR_DELIVERY: "Ready to return",
  CLOSED: "Returned",
  CANCELLED: "Cancelled",
};

const STAGE_TONE = {
  INTAKE: "neutral",
  DIAGNOSIS: "primary",
  PENDING_APPROVAL: "violet",
  AWAITING_STOCK: "warning",
  QUALITY_CHECK: "indigo",
  READY_FOR_DELIVERY: "success",
  CLOSED: "neutral",
  CANCELLED: "danger",
} as const satisfies Record<CaseStatusValue, "primary" | "violet" | "warning" | "indigo" | "success" | "neutral" | "danger">;

const IN_PROGRESS_STATUSES: CaseStatusValue[] = ["DIAGNOSIS", "PENDING_APPROVAL", "AWAITING_STOCK", "QUALITY_CHECK"];
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

async function fetchLabCases(scope: Record<string, unknown>) {
  return db.case.findMany({
    where: {
      ...scope,
      status: { notIn: ["CLOSED", "CANCELLED"] },
      // Only show cases assigned to a chip-level coordinator, or unassigned (incoming queue)
      OR: [
        { engineerId: null },
        { engineer: { privilege: { code: "CHIP_COORDINATOR" } } },
      ],
    },
    orderBy: { stageChangedAt: "asc" }, // oldest first so aging cases rise to the top
    select: {
      id: true,
      jobsheetNo: true,
      brand: true,
      model: true,
      status: true,
      estimatedCostPaise: true,
      stageChangedAt: true,
      customer: { select: { name: true } },
      account: { select: { name: true } },
      engineer: { select: { firstName: true, lastName: true } },
    },
  });
}

type LabCase = Awaited<ReturnType<typeof fetchLabCases>>[number];

export default async function ChipLabPage() {
  const { user } = await requirePageAccess(SERVICE_PATHS.lab);

  // Only CHIP_COORDINATOR may view this page (super-admins are always allowed)
  if (!user.privilege.isSuperAdmin && user.privilege.code !== "CHIP_COORDINATOR") {
    redirect("/forbidden");
  }

  const scope = branchWhere(await getBranchScope(user));
  const cases = await fetchLabCases(scope);

  const now = new Date();

  // ── Stat buckets ──────────────────────────────────────────────────────────
  const incoming = cases.filter((c) => c.status === "INTAKE");
  const inProgress = cases.filter((c) => (IN_PROGRESS_STATUSES as string[]).includes(c.status));
  const readyToReturn = cases.filter((c) => c.status === "READY_FOR_DELIVERY");
  const aging = cases.filter((c) => now.getTime() - c.stageChangedAt.getTime() > THREE_DAYS_MS);

  // Engineer breakdown shown below the "In Progress" value
  const byEngineer = new Map<string, number>();
  for (const c of inProgress) {
    const first = c.engineer?.firstName ?? "Unassigned";
    byEngineer.set(first, (byEngineer.get(first) ?? 0) + 1);
  }
  const engineerNote = [...byEngineer.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, n]) => `${name} ${n}`)
    .join(" · ");

  const hasAging = aging.length > 0;

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns: Column<LabCase>[] = [
    {
      header: "Lab Job",
      cell: (c) => <span className="font-mono text-[13px] font-semibold">{c.jobsheetNo}</span>,
    },
    {
      header: "From",
      cell: (c) => <span className="font-medium">{c.customer.name}</span>,
    },
    {
      header: "Linked Case",
      cell: (c) => (
        <span className="font-mono text-[13px] text-text-muted">{c.account?.name ?? "—"}</span>
      ),
    },
    {
      header: "Path",
      cell: (c) => (
        <Badge tone={STAGE_TONE[c.status as CaseStatusValue]}>
          {STAGE_LABEL[c.status as CaseStatusValue]}
        </Badge>
      ),
    },
    {
      header: "Engineer",
      cell: (c) => personName(c.engineer) ?? <span className="text-text-muted">—</span>,
    },
    {
      header: "Internal ₹",
      align: "right",
      cell: (c) =>
        c.estimatedCostPaise !== null ? (
          <span className="font-semibold tabular-nums">{formatPaise(c.estimatedCostPaise)}</span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      header: "Status",
      cell: (c) => {
        const ageMs = now.getTime() - c.stageChangedAt.getTime();
        const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
        if (ageMs > THREE_DAYS_MS) {
          return <Badge tone="danger">{ageDays}d — {STAGE_LABEL[c.status as CaseStatusValue]}</Badge>;
        }
        return (
          <Badge tone={STAGE_TONE[c.status as CaseStatusValue]}>
            {STAGE_LABEL[c.status as CaseStatusValue]}
          </Badge>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Chip-level lab — head office"
        subtitle="Centralized L3 repairs · modelled as a virtual branch · its customers are the branches"
        breadcrumbs={["Service", "Chip-Level Lab"]}
      />

      <div className="space-y-6">
        {/* KPI tiles */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Incoming Queue"
            value={incoming.length}
            icon={<Inbox />}
            iconTone="navy"
          />
          {/* Ring border highlights the "active" bucket */}
          <div className="rounded-xl ring-1 ring-primary">
            <StatCard
              label="In Progress"
              value={inProgress.length}
              icon={<Cpu />}
              iconTone="primary"
              note={engineerNote ? { text: engineerNote, tone: "muted" } : undefined}
            />
          </div>
          <StatCard
            label="Ready to Return"
            value={readyToReturn.length}
            icon={<RotateCcw />}
            iconTone="success"
          />
          <StatCard
            label="Aging > 3 Days"
            value={aging.length}
            icon={<AlarmClock />}
            alert={hasAging}
            note={hasAging ? { text: "Alert: coordinator + sending BM", tone: "danger" } : undefined}
          />
        </div>

        {/* Open jobs table */}
        <DataTable
          columns={columns}
          rows={cases}
          rowKey={(c) => c.id}
          empty="No open lab jobs at this time."
        />

        {/* P&L footnote */}
        <p className="text-xs text-text-muted">
          Lab P&amp;L: income = internal charges on completed jobs · costs = lab parts (own unit codes) + lab daybook expenses. Lab TAT reported separately from branch TAT.
        </p>
      </div>
    </>
  );
}
