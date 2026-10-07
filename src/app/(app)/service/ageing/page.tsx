import Link from "next/link";
import { Activity, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { ListView } from "@/components/data/list-view";
import { StatCard } from "@/components/data/stat-card";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { formatDateTime } from "@/lib/dates";
import { listState, pageArgs } from "@/lib/list";
import { CASE_STATUS_LABELS, CASE_STATUS_TONE } from "@/modules/service/case-schema";
import type { CaseStatusValue } from "@/modules/service/case-schema";
import { SERVICE_PATHS } from "@/modules/service/paths";
import { listAgeingCases } from "@/modules/service/tat-queries";
import type { TatStatus } from "@/modules/service/tat-queries";
import { AgeingFilterBar } from "@/modules/service/components/ageing-filter-bar";
import { getBranchScope } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";
import type { CaseStatus } from "@/generated/prisma/client";

export const metadata = { title: "Ageing Analysis" };

const AGEING_SORTS = ["jobsheetNo", "stageChangedAt", "elapsed"] as const;

function fmtMin(m: number): string {
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
}

const TAT_LABEL: Record<TatStatus, string> = {
  WITHIN: "Within TAT",
  APPROACHING: "Approaching",
  OVERDUE: "Overdue",
  NO_CONFIG: "No Config",
};
const TAT_TONE: Record<TatStatus, "success" | "warning" | "danger" | "neutral"> = {
  WITHIN: "success",
  APPROACHING: "warning",
  OVERDUE: "danger",
  NO_CONFIG: "neutral",
};

export default async function AgeingPage({ searchParams }: PageProps<"/service/ageing">) {
  const { user } = await requirePageAccess(SERVICE_PATHS.ageing);
  const sp = await searchParams;
  const scope = await getBranchScope(user);

  const list = listState(SERVICE_PATHS.ageing, sp, {
    sorts: AGEING_SORTS,
    defaultSort: "stageChangedAt",
    defaultDir: "asc",
    defaultPageSize: 25,
  });

  const status = param(sp, "status") ?? "";
  const tatStatus = param(sp, "tatStatus") ?? "";

  const [filteredRows, allRows] = await Promise.all([
    listAgeingCases({
      q: list.q || undefined,
      status: (status as CaseStatus) || undefined,
      tatStatus: (tatStatus as TatStatus) || undefined,
      branchId: scope.branchId ?? undefined,
    }),
    listAgeingCases({ branchId: scope.branchId ?? undefined }),
  ]);

  // Sort in memory — TAT status is computed, not stored
  const dir = list.dir === "asc" ? 1 : -1;
  const sorted = [...filteredRows].sort((a, b) => {
    if (list.sort === "jobsheetNo") return dir * a.jobsheetNo.localeCompare(b.jobsheetNo);
    if (list.sort === "elapsed") return dir * (a.elapsedMinutes - b.elapsedMinutes);
    return dir * (a.stageChangedAt.getTime() - b.stageChangedAt.getTime());
  });

  const total = sorted.length;
  const { skip, take } = pageArgs(list);
  const rows = sorted.slice(skip, skip + take);

  const within = allRows.filter((r) => r.tatStatus === "WITHIN").length;
  const approaching = allRows.filter((r) => r.tatStatus === "APPROACHING").length;
  const overdue = allRows.filter((r) => r.tatStatus === "OVERDUE").length;

  return (
    <AdminPage
      title="Ageing Analysis"
      group="Service"
      subtitle={
        scope.branch
          ? `Active cases for ${scope.branch.name}`
          : "Active cases across all branches"
      }
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Active" value={allRows.length} icon={<Activity />} iconTone="navy" />
        <StatCard label="Within TAT" value={within} icon={<CheckCircle2 />} iconTone="success" />
        <StatCard label="Approaching" value={approaching} icon={<Clock />} iconTone="warning" />
        <StatCard label="Overdue" value={overdue} icon={<AlertTriangle />} iconTone="danger" alert={overdue > 0} />
      </div>

      <ListView
        list={list}
        total={total}
        rows={rows}
        rowKey={(r) => r.id}
        searchPlaceholder="Search jobsheet or customer…"
        empty="No active cases match the current filters."
        toolbar={<AgeingFilterBar list={list} activeStatus={status} activeTatStatus={tatStatus} />}
        columns={[
          { header: "#", cell: (_, i) => skip + i + 1 },
          {
            header: "Jobsheet",
            sort: "jobsheetNo",
            cell: (r) => (
              <Link
                href={`${SERVICE_PATHS.cases}/${r.id}`}
                className="font-semibold text-brand-navy hover:text-primary dark:text-text"
              >
                {r.jobsheetNo}
              </Link>
            ),
          },
          {
            header: "Customer",
            cell: (r) => <span className="font-medium">{r.customerName}</span>,
          },
          {
            header: "Stage",
            cell: (r) => (
              <Badge tone={CASE_STATUS_TONE[r.status as CaseStatusValue]}>
                {CASE_STATUS_LABELS[r.status as CaseStatusValue]}
              </Badge>
            ),
          },
          {
            header: "Stage since",
            sort: "stageChangedAt",
            cell: (r) => <span className="text-sm text-text-muted">{formatDateTime(r.stageChangedAt)}</span>,
          },
          {
            header: "Target",
            cell: (r) =>
              r.targetMinutes !== null ? (
                <span className="tabular-nums">{fmtMin(r.targetMinutes)}</span>
              ) : (
                <span className="text-text-muted">—</span>
              ),
          },
          {
            header: "Elapsed",
            sort: "elapsed",
            cell: (r) => (
              <span className={`tabular-nums font-medium${r.tatStatus === "OVERDUE" ? " text-danger" : ""}`}>
                {fmtMin(r.elapsedMinutes)}
              </span>
            ),
          },
          {
            header: "Remaining",
            cell: (r) => {
              if (r.remainingMinutes === null) return <span className="text-text-muted">—</span>;
              if (r.remainingMinutes <= 0) return <span className="font-semibold text-danger">Overdue</span>;
              return (
                <span className={`tabular-nums${r.tatStatus === "APPROACHING" ? " text-warning font-medium" : " text-success"}`}>
                  {fmtMin(r.remainingMinutes)}
                </span>
              );
            },
          },
          {
            header: "TAT Status",
            cell: (r) => <Badge tone={TAT_TONE[r.tatStatus]}>{TAT_LABEL[r.tatStatus]}</Badge>,
          },
          {
            header: "Engineer",
            cell: (r) =>
              r.engineerName ? (
                <span>{r.engineerName}</span>
              ) : (
                <span className="text-text-muted">Unassigned</span>
              ),
          },
          ...(scope.branchId
            ? []
            : [{ header: "Branch", cell: (r: (typeof rows)[number]) => <span className="text-sm text-text-muted">{r.branchName}</span> }]),
          {
            header: "Action",
            cell: (r) => (
              <LinkButton href={`${SERVICE_PATHS.cases}/${r.id}`} variant="secondary" size="sm">
                View
              </LinkButton>
            ),
          },
        ]}
      />
    </AdminPage>
  );
}
