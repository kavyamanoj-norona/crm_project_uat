import { notFound } from "next/navigation";
import { ArrowLeft, CircleDot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { KvList } from "@/components/ui/kv-list";
import { LinkButton } from "@/components/ui/button";
import { TimelineCard } from "@/components/data/timeline-card";
import type { TimelineItem } from "@/components/data/timeline";
import { PageHeader } from "@/components/layout/page-header";
import { personName } from "@/components/data/who-when";
import { formatDateTime } from "@/lib/dates";
import { enumLabel } from "@/lib/enum";
import { saveDiagnosis } from "@/modules/service/actions/engineer";
import { saveQcAnswers } from "@/modules/service/actions/qc-response";
import { buildCaseHistory } from "@/modules/service/case-history";
import { CASE_STATUS_LABELS, CASE_STATUS_TONE } from "@/modules/service/case-schema";
import { DiagnosisDialog } from "@/modules/service/components/diagnosis-dialog";
import { QcChecklistCard } from "@/modules/service/components/qc-checklist-card";
import { engineerCaseScope } from "@/modules/service/engineer-access";
import { getEngineerCase } from "@/modules/service/engineer-queries";
import { SERVICE_PATHS } from "@/modules/service/paths";
import { getQcState } from "@/modules/service/qc-response-queries";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Engineer case" };

export default async function EngineerCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { user, permission } = await requirePageAccess(SERVICE_PATHS.engineer);
  const { id } = await params;
  // An engineer only ever reaches their own assigned cases; anything else is a 404, not a 403.
  const c = await getEngineerCase(id, await engineerCaseScope(user));
  if (!c) notFound();

  const inDiagnosis = c.status === "DIAGNOSIS";
  const inQc = c.status === "QUALITY_CHECK";
  const [qc, history] = await Promise.all([inQc ? getQcState(c.id, "QUALITY_CHECK", c.stageChangedAt) : null, buildCaseHistory(c.id, { isAdmin: false })]);

  const timeline: TimelineItem[] = history.map((h) => ({
    key: h.key,
    icon: <CircleDot />,
    title: h.title,
    detail: h.note,
    meta: `${formatDateTime(h.at)} · ${h.by ?? "System"}`,
  }));

  const dx = c.diagnosis;
  const section = (title: string, body: string) => (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{title}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm">{body}</p>
    </div>
  );

  return (
    <>
      <PageHeader
        title={c.jobsheetNo}
        subtitle={`${[c.brand, c.model].filter(Boolean).join(" ")} · ${c.customer.name} · ${c.branch.name}`}
        breadcrumbs={["Service", "Engineer Workspace", c.jobsheetNo]}
        badges={<Badge tone={CASE_STATUS_TONE[c.status]}>{CASE_STATUS_LABELS[c.status]}</Badge>}
        actions={
          <LinkButton href={SERVICE_PATHS.engineer} variant="secondary">
            <ArrowLeft className="size-4" />
            Back
          </LinkButton>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        <div className="min-w-0 space-y-6">
          <Card
            title="Diagnosis"
            actions={
              inDiagnosis && permission.canEdit ? <DiagnosisDialog jobsheetNo={c.jobsheetNo} action={saveDiagnosis.bind(null, c.id)} initial={dx} /> : undefined
            }
          >
            {dx ? (
              <div className="space-y-4">
                {section("Diagnosis details", dx.details)}
                {section("Findings", dx.findings)}
                {section("Recommended repairs", dx.recommendedRepairs)}
                <p className="text-xs text-text-muted">
                  Saved {formatDateTime(dx.updatedAt)} by {personName(dx.savedBy) ?? "—"}
                </p>
              </div>
            ) : (
              <p className="text-sm text-text-muted">
                {inDiagnosis ? "No diagnosis saved yet. Add what you found and the repairs you recommend." : "No diagnosis was recorded for this case."}
              </p>
            )}
            <p className="mt-4 text-xs text-text-muted">The estimate, approval and spare-part requests are handled by the front desk and branch manager.</p>
          </Card>

          {qc && (
            <QcChecklistCard jobsheetNo={c.jobsheetNo} rows={qc.rows} action={saveQcAnswers.bind(null, c.id)} canEdit={permission.canEdit} />
          )}

          <Card title="Estimate lines">
            {c.items.length === 0 ? (
              <p className="text-sm text-text-muted">No items on the estimate yet.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {c.items.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      {l.name} <span className="text-xs text-text-muted">{l.code} · {enumLabel(l.type)}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-text-muted">× {l.quantity}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card title="Case">
            <KvList
              items={[
                ["Jobsheet", c.jobsheetNo],
                ["Customer", c.customer.name],
                ["Device", [c.brand, c.model].filter(Boolean).join(" ")],
                ["Serial / IMEI", c.serialNo],
                ["Warranty", enumLabel(c.warrantyStatus)],
                ["Problem reported", c.problemReported],
                ["Received items", c.receivedItems.map((r) => r.name).join(", ")],
                ["Engineer", personName(c.engineer)],
                ["Received", formatDateTime(c.createdAt)],
              ]}
            />
          </Card>
          <TimelineCard items={timeline} limit={6} />
        </div>
      </div>
    </>
  );
}
