import Link from "next/link";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ListView } from "@/components/data/list-view";
import { PageHeader } from "@/components/layout/page-header";
import { personName } from "@/components/data/who-when";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import { INTAKE_TYPE_LABELS } from "@/modules/service/case-schema";
import { TELECALLER_PATHS } from "@/modules/telecaller/paths";
import { BRANCH_CALL_SORTS, listBranchCallLeads } from "@/modules/telecaller/queries";
import { CALL_OUTCOME_LABELS, LEAD_STATUS_LABELS, LEAD_STATUS_TONE, type CallOutcomeValue, type LeadStatusValue } from "@/modules/telecaller/status";
import { listState } from "@/lib/list";
import { getBranchScope } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Branch Call List" };

export default async function BranchCallListPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user } = await requirePageAccess(TELECALLER_PATHS.branchCalls);
  const scope = await getBranchScope(user);
  const sp = await searchParams;
  const list = listState(TELECALLER_PATHS.branchCalls, sp, { sorts: BRANCH_CALL_SORTS, defaultSort: "followUp", defaultDir: "asc" });
  const { rows, total, tabs } = await listBranchCallLeads(list, scope);

  return (
    <>
      <PageHeader
        title={`Branch call list${scope.branch ? ` — ${scope.branch.name}` : " — all branches"}`}
        subtitle="Leads and follow-up calls Head Office telecallers have assigned to the branch"
        breadcrumbs={["Telecaller", "Branch Call List"]}
      />
      <ListView
        list={list}
        total={total}
        tabs={tabs}
        rows={rows}
        rowKey={(l) => l.id}
        searchPlaceholder="Search by name, mobile, lead ID or issue"
        empty="No leads have been assigned to the branch yet."
        columns={[
          { header: "#", cell: (_, i) => (list.page - 1) * list.pageSize + i + 1 },
          {
            header: "Follow-up",
            sort: "followUp",
            cell: (l) => {
              const at = l.leadProfile?.nextFollowUpAt;
              if (!at) return <span className="text-text-muted">—</span>;
              const late = at.getTime() < Date.now();
              return (
                <span className="flex flex-col leading-tight">
                  <span className={`whitespace-nowrap ${late ? "font-semibold text-danger" : ""}`}>{formatDateTime(at)}</span>
                  {late && <Badge tone="danger" className="mt-1 w-fit">Overdue</Badge>}
                </span>
              );
            },
          },
          {
            header: "Customer",
            sort: "name",
            cell: (l) => (
              <Link href={`${TELECALLER_PATHS.branchCalls}/${l.id}`} className="flex flex-col leading-tight">
                <span className="font-semibold text-brand-navy hover:text-primary dark:text-text">{l.name}</span>
                <span className="text-xs text-text-muted">{l.leadCode}</span>
              </Link>
            ),
          },
          { header: "Mobile", cell: (l) => formatPhone(l.phone) },
          { header: "Reported issue", cell: (l) => <span className="block max-w-64 truncate" title={l.purpose ?? undefined}>{l.purpose ?? "—"}</span> },
          ...(scope.branchId ? [] : [{ header: "Branch", cell: (l: (typeof rows)[number]) => l.branch?.code ?? "—" }]),
          { header: "Appointment", cell: (l) => <span className="whitespace-nowrap">{l.leadProfile?.appointmentAt ? formatDateTime(l.leadProfile.appointmentAt) : "—"}</span> },
          { header: "Service mode", cell: (l) => (l.leadProfile?.serviceMode ? INTAKE_TYPE_LABELS[l.leadProfile.serviceMode] : "—") },
          {
            header: "Status",
            cell: (l) => {
              const s = (l.leadProfile?.status ?? "NEW") as LeadStatusValue;
              return <Badge tone={LEAD_STATUS_TONE[s]}>{LEAD_STATUS_LABELS[s]}</Badge>;
            },
          },
          {
            header: "Last call",
            cell: (l) => {
              const c = l.leadCalls[0];
              if (!c) return <span className="text-text-muted">No calls yet</span>;
              return (
                <span className="flex max-w-56 flex-col whitespace-normal leading-tight">
                  <span>
                    {CALL_OUTCOME_LABELS[c.outcome as CallOutcomeValue]} <span className="text-xs text-text-muted">· {c.side === "BRANCH" ? "Branch" : "Telecaller"}</span>
                  </span>
                  {c.remarks && <span className="line-clamp-2 text-xs text-text-muted">{c.remarks}</span>}
                  <span className="text-[11px] text-text-muted">
                    {formatDate(c.calledAt)} · {personName(c.calledBy) ?? "—"}
                  </span>
                </span>
              );
            },
          },
          { header: "Telecaller", cell: (l) => personName(l.leadProfile?.assignedTelecaller) ?? "—" },
          {
            header: "Action",
            align: "center",
            cell: (l) => (
              <Link href={`${TELECALLER_PATHS.branchCalls}/${l.id}`} aria-label={`Open ${l.name}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10">
                <Eye className="size-3.5" />
                Open
              </Link>
            ),
          },
        ]}
      />
    </>
  );
}
