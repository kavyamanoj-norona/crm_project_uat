import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/data/data-table";
import { formatDateTime } from "@/lib/dates";
import { requirePageAccess } from "@/server/rbac/guard";
import { branchWhere, getBranchScope } from "@/server/branch-scope";
import { SERVICE_PATHS } from "@/modules/service/paths";
import { CASE_STATUS_LABELS, CASE_STATUS_TONE } from "@/modules/service/case-schema";
import { buildCaseHistory, type HistoryCategory } from "@/modules/service/case-history";
import { HistoryDetailButton } from "@/modules/service/components/history-detail-button";
import { STAGE_ICONS } from "@/modules/service/components/stage-icons";
import { getCase } from "@/modules/service/queries";

export const metadata = { title: "Case history" };

const CATEGORY: Record<HistoryCategory, { label: string; tone: "neutral" | "primary" | "violet" | "indigo" | "warning" | "danger" | "success" }> = {
  stage: { label: "Stage", tone: "neutral" },
  handover: { label: "Handover", tone: "violet" },
  qc: { label: "Quality Check", tone: "indigo" },
  items: { label: "Items", tone: "primary" },
  worktype: { label: "Work type", tone: "warning" },
  outsource: { label: "Outsource", tone: "warning" },
  password: { label: "Security", tone: "danger" },
  action: { label: "Action", tone: "neutral" },
};

export default async function CaseHistoryPage({ params }: PageProps<"/service/cases/[id]/history">) {
  const { user } = await requirePageAccess(SERVICE_PATHS.cases);
  const { id } = await params;
  const scope = branchWhere(await getBranchScope(user));
  const c = await getCase(id, scope);
  if (!c) notFound();

  const isAdmin = user.privilege.isSuperAdmin;
  const hasChipHistory = c.statusHistory.some((h) => h.toStatus === "CHIP_TRANSFER");
  const history = await buildCaseHistory(c.id, { isAdmin });

  return (
    <>
      <PageHeader
        title={`${c.jobsheetNo} — History`}
        subtitle={`Complete audit trail · ${c.branch.name} (${c.branch.code})`}
        breadcrumbs={["Service", "Cases", c.jobsheetNo, "History"]}
        actions={
          <>
            <LinkButton href={`${SERVICE_PATHS.cases}/${c.id}`} variant="secondary">
              <ArrowLeft className="size-4" /> Back to Case
            </LinkButton>
            {hasChipHistory && isAdmin && (
              <LinkButton href={`${SERVICE_PATHS.lab}/${c.id}`} variant="secondary">
                Lab view
              </LinkButton>
            )}
          </>
        }
      />

      <Card title="Activity log" actions={<span className="text-xs text-text-muted">{history.length} events</span>}>
        <DataTable
          rows={history}
          rowKey={(h) => h.key}
          empty="No history recorded."
          columns={[
            { header: "#", cell: (_, i) => <span className="text-text-muted tabular-nums">{i + 1}</span> },
            { header: "When", cell: (h) => <span className="tabular-nums text-sm">{formatDateTime(h.at)}</span> },
            {
              header: "Activity",
              cell: (h) => {
                const Icon = h.stage ? STAGE_ICONS[h.stage] : null;
                return (
                  <div className="space-y-1">
                    <span className="flex items-center gap-2">
                      <Badge tone={CATEGORY[h.category].tone}>{CATEGORY[h.category].label}</Badge>
                      {h.stage && h.category !== "qc" && (
                        <span className="flex items-center gap-1.5">
                          {Icon && <Icon className="size-3.5 shrink-0 text-text-muted" />}
                          <Badge tone={CASE_STATUS_TONE[h.stage]}>{CASE_STATUS_LABELS[h.stage]}</Badge>
                        </span>
                      )}
                    </span>
                    <span className="block text-sm font-medium">{h.title}</span>
                  </div>
                );
              },
            },
            {
              header: "Track",
              cell: (h) =>
                h.track === "Chip Lab" ? <Badge tone="violet">Chip Lab</Badge> : h.track ? <Badge tone="neutral">Branch</Badge> : null,
            },
            { header: "By", cell: (h) => <span className="text-sm">{h.by ?? "System"}</span> },
            {
              header: "Remarks / notes",
              cell: (h) =>
                h.note ? <span className="text-sm text-text-muted">{h.note}</span> : <span className="text-text-disabled">—</span>,
            },
            ...(isAdmin
              ? [
                  {
                    header: "Details",
                    align: "right" as const,
                    cell: (h: (typeof history)[number]) => (
                      <HistoryDetailButton title={h.title} when={formatDateTime(h.at)} detail={h.detail} />
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Card>
    </>
  );
}
