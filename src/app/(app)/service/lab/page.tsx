import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, Cpu, Eye, Inbox, PackageCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { StatCard } from "@/components/data/stat-card";
import { ListView } from "@/components/data/list-view";
import { PageHeader } from "@/components/layout/page-header";
import { listState } from "@/lib/list";
import { formatDate } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { requirePageAccess } from "@/server/rbac/guard";
import { SERVICE_PATHS } from "@/modules/service/paths";
import { CASE_STATUS_LABELS, CASE_STATUS_TONE } from "@/modules/service/case-schema";
import type { CaseStatusValue } from "@/modules/service/case-schema";
import { LAB_LIST_SORTS, labStatusCounts, listLabCasesPage } from "@/modules/service/chip-lab-queries";

export const metadata = { title: "Chip-Level Lab" };

export default async function ChipLabPage({ searchParams }: PageProps<"/service/lab">) {
  const { user } = await requirePageAccess(SERVICE_PATHS.lab);

  // Only CHIP_COORDINATOR may view this page (super-admins are always allowed)
  if (!user.privilege.isSuperAdmin && user.privilege.code !== "CHIP_COORDINATOR") {
    redirect("/forbidden");
  }

  const sp = await searchParams;
  const completedTab = sp.tab === "completed";
  const list = listState(SERVICE_PATHS.lab, sp, {
    sorts: LAB_LIST_SORTS,
    defaultSort: "stageChangedAt",
    // in progress: longest waiting first; completed: latest first
    defaultDir: completedTab ? "desc" : "asc",
    defaultPageSize: 25,
  });

  const [{ rows, total, tabs, completedToday }, counts] = await Promise.all([listLabCasesPage(list), labStatusCounts()]);

  // ── KPI counts ────────────────────────────────────────────────────────────────
  const incomingCount = counts["CHIP_TRANSFER"] ?? 0;
  const inProgressCount =
    (counts["CHIP_LAB_RECEIVED"] ?? 0) +
    (counts["CHIP_LAB_DIAGNOSIS"] ?? 0) +
    (counts["CHIP_LAB_PENDING_APPROVAL"] ?? 0) +
    (counts["CHIP_LAB_SERVICING"] ?? 0) +
    (counts["CHIP_LAB_QUALITY_CHECK"] ?? 0);
  const readyCount = counts["CHIP_LAB_READY_DISPATCH"] ?? 0;
  const nonRepairableCount = counts["NON_REPAIRABLE"] ?? 0;

  const dateOf = (r: (typeof rows)[number], status: "CHIP_LAB_RECEIVED" | "CHIP_BRANCH_RECEIVED") =>
    r.statusHistory.find((h) => h.toStatus === status)?.at ?? null;

  return (
    <>
      <PageHeader
        title="Chip-Level Lab"
        subtitle="Centralized L3 repairs · device-level board repair outsourced here from branches"
        breadcrumbs={["Service", "Chip-Level Lab"]}
        actions={
          <LinkButton href={SERVICE_PATHS.vendors} variant="secondary">
            Vendors
          </LinkButton>
        }
      />

      <div className="space-y-6">
        {/* KPI tiles */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Incoming" value={incomingCount} icon={<Inbox />} iconTone="violet" />
          <div className="rounded-xl ring-1 ring-primary">
            <StatCard label="In Progress" value={inProgressCount} icon={<Cpu />} iconTone="primary" />
          </div>
          <StatCard label="Ready to Dispatch" value={readyCount} icon={<PackageCheck />} iconTone="success" />
          <StatCard label="Completed Today" value={completedToday} icon={<CheckCircle2 />} iconTone="success" />
          <StatCard
            label="Non-Repairable"
            value={nonRepairableCount}
            icon={<AlertTriangle />}
            iconTone="danger"
            alert={nonRepairableCount > 0}
          />
        </div>

        <ListView
          list={list}
          total={total}
          tabs={tabs}
          rows={rows}
          rowKey={(c) => c.id}
          searchPlaceholder="Search by job, customer, device or branch"
          empty={completedTab ? "No cases have been transferred to a branch yet." : "No cases currently in the chip-level lab queue."}
          toolbar={
            completedTab ? (
              <Badge tone={completedToday > 0 ? "success" : "neutral"}>
                Completed today: {completedToday}
              </Badge>
            ) : undefined
          }
          columns={[
            { header: "#", cell: (_, i) => (list.page - 1) * list.pageSize + i + 1 },
            {
              header: "Received Date",
              cell: (c) => {
                const at = dateOf(c, "CHIP_LAB_RECEIVED");
                return at ? formatDate(at) : <span className="text-text-muted">Not received</span>;
              },
            },
            {
              header: "Lab Job",
              sort: "jobsheetNo",
              cell: (c) => (
                <a
                  href={`${SERVICE_PATHS.lab}/${c.id}`}
                  className="font-mono text-[13px] font-semibold text-primary hover:underline"
                >
                  {c.jobsheetNo}
                </a>
              ),
            },
            {
              header: "Branch",
              cell: (c) => (
                <span className="text-xs">
                  {c.branch.code} — {c.branch.name}
                </span>
              ),
            },
            {
              header: "Customer",
              cell: (c) => (
                <div>
                  <span className="font-medium">{c.customer.name}</span>
                  {c.account?.name && <div className="text-xs text-text-muted">{c.account.name}</div>}
                </div>
              ),
            },
            {
              header: "Device",
              cell: (c) => {
                const device = [c.brand, c.model].filter(Boolean).join(" ");
                return device || <span className="text-text-muted">—</span>;
              },
            },
            {
              header: "Stage",
              cell: (c) => (
                <Badge tone={CASE_STATUS_TONE[c.status as CaseStatusValue]}>
                  {CASE_STATUS_LABELS[c.status as CaseStatusValue]}
                </Badge>
              ),
            },
            completedTab
              ? {
                  header: "Transferred on",
                  cell: (c) => formatDate(dateOf(c, "CHIP_BRANCH_RECEIVED")),
                }
              : {
                  header: "In stage",
                  sort: "stageChangedAt",
                  cell: (c) => {
                    const days = c.ageDays;
                    if (days > 3) return <Badge tone="danger">{days}d</Badge>;
                    if (days >= 2) return <Badge tone="warning">{days}d</Badge>;
                    return <span className="tabular-nums">{days}d</span>;
                  },
                },
            {
              header: "Outsource",
              cell: (c) => {
                const outsource = c.labOutsources[0];
                if (!outsource) return <span className="text-text-muted">—</span>;
                if (outsource.actualReturnAt === null)
                  return (
                    <div className="text-xs">
                      <span className="font-medium">{outsource.vendor.name}</span>
                      <div className="text-text-muted">pending return</div>
                    </div>
                  );
                return <span className="text-xs text-text-muted">returned</span>;
              },
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
              header: "Action",
              cell: (c) => (
                <div className="flex items-center gap-1.5">
                  <LinkButton href={`${SERVICE_PATHS.lab}/${c.id}`} variant="secondary" size="sm">
                    <Eye className="size-3.5" />
                  </LinkButton>
                </div>
              ),
            },
          ]}
        />

        <p className="text-xs text-text-muted">
          Lab TAT is reported separately from branch TAT. Cases aged &gt;3 days are flagged automatically.
        </p>
      </div>
    </>
  );
}
