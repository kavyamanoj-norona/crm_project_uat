import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Eye, FileText, History, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { KvList } from "@/components/ui/kv-list";
import { LinkButton } from "@/components/ui/button";
import { StageRail } from "@/components/ui/stage-rail";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/data/data-table";
import { CaseComments } from "@/modules/service/components/case-comments";
import { addCaseComment } from "@/modules/service/actions/comment";
import { listCaseComments, listMentionable } from "@/modules/service/comment-queries";
import { TimelineCard } from "@/components/data/timeline-card";
import type { TimelineItem } from "@/components/data/timeline";
import { personName } from "@/components/data/who-when";
import { formatDate, formatDateTime, formatShortDateTime } from "@/lib/dates";
import { formatPaise, paiseToInput } from "@/lib/money";
import { requirePageAccess } from "@/server/rbac/guard";
import { db } from "@/server/db";
import { SERVICE_PATHS } from "@/modules/service/paths";
import {
  CASE_STATUS_LABELS,
  CASE_STATUS_TONE,
  INTAKE_TYPE_LABELS,
  WARRANTY_LABELS,
  type LabWorkType,
} from "@/modules/service/case-schema";
import { LAB_ADD_ITEM_STATUSES, LAB_QUEUE_STATUSES, canRequestParts, type CaseStatusValue } from "@/modules/service/case-schema";
import { STAGE_ICONS } from "@/modules/service/components/stage-icons";
import { ChipLabActions } from "@/modules/service/components/chip-lab-actions";
import { AddItemDialog } from "@/modules/service/components/add-item-dialog";
import { caseUsids, qcConsumptionBlock } from "@/modules/inventory/case-parts";
import {
  consumeLabItem,
  recordVendorPayment,
  requestPartForLabCase, reorderPartForLabCase, returnPartForLabCase, addItemToLabCase,
  saveLabItems,
  saveLabWorkType,
} from "@/modules/service/actions/chip-lab";
import { VendorPaymentDialog } from "@/modules/service/components/vendor-payment-dialog";
import { LabItemsSection, type LabItemsInitial } from "@/modules/service/components/lab-items-section";
import { LabWorkTypeForm } from "@/modules/service/components/lab-work-type-form";
import { QcChecklistCard } from "@/modules/service/components/qc-checklist-card";
import { saveQcAnswers } from "@/modules/service/actions/qc-response";
import { getQcState, getSavedQcAnswers } from "@/modules/service/qc-response-queries";
import { getLabCaseFull, getLabStockInfo, listLabEngineers, listVendorOptions } from "@/modules/service/chip-lab-queries";
import { listCatalogForPicker } from "@/modules/service/queries";
import { ITEM_TYPE_LABELS, ITEM_TYPE_TONE } from "@/modules/admin/item-schema";

export const metadata = { title: "Lab case" };

/** The ordered stage rail for the chip-level lab view. */
const LAB_FLOW: CaseStatusValue[] = [
  "CHIP_TRANSFER",
  "CHIP_LAB_RECEIVED",
  "CHIP_LAB_DIAGNOSIS",
  "CHIP_LAB_PENDING_APPROVAL",
  "CHIP_LAB_SERVICING",
  "CHIP_LAB_READY_DISPATCH",
  "CHIP_LAB_QUALITY_CHECK",
  "CHIP_BRANCH_RECEIVED",
];

/** Human-readable stage labels used in the lab rail (different from branch-visible labels). */
const LAB_FLOW_LABELS: Record<string, string> = {
  CHIP_TRANSFER: "Incoming",
  CHIP_LAB_RECEIVED: "Received",
  CHIP_LAB_DIAGNOSIS: "Diagnosis",
  CHIP_LAB_PENDING_APPROVAL: "Pending Approval",
  CHIP_LAB_SERVICING: "In Servicing",
  CHIP_LAB_READY_DISPATCH: "Ready to Dispatch",
  CHIP_LAB_QUALITY_CHECK: "Quality Check",
  CHIP_BRANCH_RECEIVED: "Transfer to Branch",
};

export default async function LabCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, permission } = await requirePageAccess(SERVICE_PATHS.lab);

  // Only chip-level coordinators and super-admins may view lab case details.
  if (!user.privilege.isSuperAdmin && user.privilege.code !== "CHIP_COORDINATOR") {
    redirect("/forbidden");
  }

  const { id } = await params;
  const c = await getLabCaseFull(id);
  if (!c) notFound();

  const isDiagnosis = c.status === "CHIP_LAB_DIAGNOSIS";

  const status = c.status as CaseStatusValue;
  const isNonRepairable = status === "NON_REPAIRABLE";
  const isDispatched = status === "CHIP_BRANCH_RECEIVED";
  // The device has left the lab: awaiting the branch's receipt, or already moved on there.
  const leftLab = !LAB_QUEUE_STATUSES.includes(status);
  // Transfer to Branch completes the lab's work in one step, so leaving the lab means the transfer is done.
  const transferDone = leftLab;

  // Billable items stay editable at any active lab stage (not once dispatched back to branch).
  const canEditItems = permission.canEdit && !leftLab;
  // Work type is set only during diagnosis.
  const showWorkTypeForm = isDiagnosis && permission.canEdit;

  const outsource = c.labWorkType === "OUTSOURCE";
  const quoteRequest = await db.caseApprovalRequest.findFirst({
    where: { caseId: c.id, kind: "LAB_QUOTE" },
    orderBy: { requestedAt: "desc" },
    include: { sentBy: { select: { firstName: true, lastName: true } }, reviewedBy: { select: { firstName: true, lastName: true } } },
  });
  const quoteOpen = quoteRequest?.status === "PENDING" || quoteRequest?.status === "SENT";
  const [comments, mentionable] = await Promise.all([listCaseComments(c.id), listMentionable(c.branchId)]);
  const [catalog, engineers, vendors, labStock] = await Promise.all([
    canEditItems ? listCatalogForPicker() : Promise.resolve([]),
    showWorkTypeForm ? listLabEngineers() : Promise.resolve([]),
    showWorkTypeForm ? listVendorOptions() : Promise.resolve([]),
    canEditItems ? getLabStockInfo(c.id, c.branchId) : Promise.resolve({ stock: {}, consumable: {} as Record<string, never[]>, usids: {} as Record<string, string>, vendorReplacement: {} as Record<string, string>, settled: {} as Record<string, string>, received: [] as string[], requested: [] as string[], transferred: [] as string[] }),
  ]);

  // Add-item picker and the Quality Check gate (parts must be consumed or returned first).
  const [addCatalog, qcBlock, usidByItem] = await Promise.all([
    permission.canEdit && LAB_ADD_ITEM_STATUSES.includes(status) ? listCatalogForPicker() : Promise.resolve([] as Awaited<ReturnType<typeof listCatalogForPicker>>),
    status === "CHIP_LAB_READY_DISPATCH" ? qcConsumptionBlock(c.id) : Promise.resolve(null),
    caseUsids(c.id),
  ]);

  // What the customer still owes, and what we still owe the outsource vendor.
  const billed = c.items.reduce((sum, l) => sum + l.lineTotalPaise, 0);
  const advance = c.payments.reduce((sum, p) => sum + p.amountPaise, 0);
  const customerDue = Math.max(0, billed - advance);
  const vendorOwed = c.items.reduce((sum, l) => sum + (l.vendorCostPaise ?? 0) * l.quantity, 0);
  const vendorPaid = c.labVendorPayments.reduce((sum, p) => sum + p.amountPaise, 0);
  const vendorDue = Math.max(0, vendorOwed - vendorPaid);

  const qc = status === "CHIP_LAB_QUALITY_CHECK" ? await getQcState(c.id, status, c.stageChangedAt) : null;
  // After QC, keep the saved answers visible (view only).
  const savedQc = status === "CHIP_LAB_QUALITY_CHECK" ? [] : await getSavedQcAnswers(c.id, "CHIP_LAB_QUALITY_CHECK");

  // When each lab stage was first entered
  const reached = new Map<string, Date>([["CHIP_TRANSFER", c.createdAt]]);
  for (const h of [...c.statusHistory].reverse()) {
    if (h.fromStatus && !reached.has(h.toStatus)) reached.set(h.toStatus, h.at);
  }

  // Customer approval is a stage only when it is needed: the lab's estimate is above the case total (or it already went through approval).
  const pastServicing = ["CHIP_LAB_SERVICING", "CHIP_LAB_READY_DISPATCH", "CHIP_LAB_QUALITY_CHECK", "CHIP_BRANCH_RECEIVED", "NON_REPAIRABLE"].includes(status);
  const needsApproval =
    status === "CHIP_LAB_PENDING_APPROVAL" ||
    Boolean(quoteRequest) ||
    reached.has("CHIP_LAB_PENDING_APPROVAL") ||
    (!pastServicing && (c.estimatedCostPaise ?? 0) > (c.chipBaselinePaise ?? 0));
  const railStages = LAB_FLOW.filter((s) => s !== "CHIP_LAB_PENDING_APPROVAL" || needsApproval);

  // Non-repairable sits outside the rail — show it stopped at In Servicing with a label.
  // Every other status (including Quality Check and the final Transfer to Branch) is on the rail.
  // A finished quality check moves the rail on to Transfer to Branch, ready to be sent.
  const qcDone = status === "CHIP_LAB_QUALITY_CHECK" && qc !== null && qc.rows.length > 0 && qc.complete;
  const railCurrent: CaseStatusValue = isNonRepairable ? "CHIP_LAB_SERVICING" : qcDone ? "CHIP_BRANCH_RECEIVED" : status;
  const stoppedLabel = isNonRepairable ? "Non-Repairable" : undefined;

  // Timeline (newest first — query is ordered by at: "desc")
  const timelineItems: TimelineItem[] = c.statusHistory.map((h) => {
    const Icon = h.fromStatus ? STAGE_ICONS[h.toStatus as CaseStatusValue] : FileText;
    return {
      key: h.id,
      icon: <Icon />,
      title: !h.fromStatus
        ? "Case created"
        : h.fromStatus === h.toStatus
          ? `${LAB_FLOW_LABELS[h.toStatus] ?? CASE_STATUS_LABELS[h.toStatus as CaseStatusValue]} completed`
          : `Moved to ${CASE_STATUS_LABELS[h.toStatus as CaseStatusValue]}`,
      detail: h.note,
      meta: `${formatDateTime(h.at)} · ${personName(h.changedBy) ?? "System"}`,
      tone: h.toStatus === "NON_REPAIRABLE" ? ("danger" as const) : ("default" as const),
    };
  });

  const labItemsInitial: LabItemsInitial = {
    lines: c.items.map((l) => ({
      itemId: l.itemId,
      quantity: String(l.quantity),
      unitPrice: paiseToInput(l.unitPricePaise),
      vendorCost: paiseToInput(l.vendorCostPaise),
      info: {
        id: l.itemId,
        code: l.code,
        name: l.name,
        type: l.type,
        pricePaise: l.listPricePaise,
        minPricePaise: l.minPricePaise,
        maxDiscountPercent: l.listPricePaise > 0
          ? Math.round((1 - l.minPricePaise / l.listPricePaise) * 100)
          : 0,
      },
    })),
  };

  return (
    <>
      <PageHeader
        title={c.jobsheetNo}
        badges={
          <>
            <Badge tone={CASE_STATUS_TONE[status]}>{qcDone ? "Quality Check completed" : CASE_STATUS_LABELS[status]}</Badge>
            {c.chipDeadRisk && (
              <Badge tone="danger" className="bg-danger text-white">
                <TriangleAlert className="size-3.5" /> Dead risk
              </Badge>
            )}
          </>
        }
        subtitle={[
          [c.brand, c.model].filter(Boolean).join(" ") || "—",
          WARRANTY_LABELS[c.warrantyStatus],
          `${c.branch.name} (${c.branch.code})`,
          `Created ${formatDateTime(c.createdAt)}`,
        ].join(" · ")}
        breadcrumbs={["Service", "Chip-Level Lab", c.jobsheetNo]}
        actions={
          <>
            <LinkButton href={SERVICE_PATHS.lab} variant="secondary">
              <ArrowLeft className="size-4" /> Back
            </LinkButton>
            <LinkButton href={`${SERVICE_PATHS.cases}/${c.id}/history`} variant="secondary">
              <History className="size-4" /> History
            </LinkButton>
            <LinkButton href={`${SERVICE_PATHS.cases}/${c.id}`} variant="secondary">
              <Eye className="size-4" /> Branch view
            </LinkButton>
            {permission.canEdit && (
              <ChipLabActions
                caseId={c.id}
                status={status}
                waitingOnBranch={quoteOpen}
                needsApproval={(c.estimatedCostPaise ?? 0) > (c.chipBaselinePaise ?? 0)}
                qcBlock={qcBlock}
                qc={
                  qc && !qc.complete && qc.rows.length > 0
                    ? { jobsheetNo: c.jobsheetNo, items: qc.rows, action: saveQcAnswers.bind(null, c.id) }
                    : undefined
                }
              />
            )}
          </>
        }
      />

      {isNonRepairable && (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3">
          <p className="text-sm font-medium text-danger">Non-Repairable — this device cannot be fixed at the chip level.</p>
          {c.statusHistory.find((h) => h.toStatus === "NON_REPAIRABLE")?.note && (
            <p className="mt-0.5 text-xs text-danger/80">
              Reason: {c.statusHistory.find((h) => h.toStatus === "NON_REPAIRABLE")!.note}
            </p>
          )}
        </div>
      )}

      {c.chipDeadRisk && (status === "CHIP_TRANSFER" || status === "CHIP_LAB_RECEIVED") && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border-2 border-danger bg-danger/10 px-4 py-3">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-danger" />
          <div>
            <p className="text-sm font-bold text-danger">Dead risk</p>
            <p className="text-sm text-danger/90">The branch flagged this device as possibly beyond repair. Check carefully before committing to work.</p>
          </div>
        </div>
      )}

      {quoteRequest && (quoteOpen || (status === "CHIP_LAB_DIAGNOSIS" && quoteRequest.status === "REJECTED")) && (
        <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3">
          <p className="text-sm font-medium text-warning">
            {quoteRequest.status === "PENDING"
              ? `Estimate ${formatPaise(quoteRequest.quoteAmountPaise)} is above the case total — waiting for the branch to send it to the customer.`
              : quoteRequest.status === "SENT"
                ? `Estimate ${formatPaise(quoteRequest.quoteAmountPaise)} sent to the customer — waiting for their answer.`
                : `The customer rejected the estimate of ${formatPaise(quoteRequest.quoteAmountPaise)}. Revise the items or mark the case non-repairable.`}
          </p>
          {quoteRequest.status === "SENT" && quoteRequest.sentAt && (
            <p className="mt-0.5 text-xs text-text-muted">
              Sent by {personName(quoteRequest.sentBy) ?? "—"} · {formatDateTime(quoteRequest.sentAt)}
              {quoteRequest.sendRemarks ? ` · ${quoteRequest.sendRemarks}` : ""}
            </p>
          )}
          {quoteRequest.status === "REJECTED" && quoteRequest.reviewedAt && (
            <p className="mt-0.5 text-xs text-text-muted">
              {personName(quoteRequest.reviewedBy) ?? "—"} · {formatDateTime(quoteRequest.reviewedAt)}
              {quoteRequest.reviewRemarks ? ` · ${quoteRequest.reviewRemarks}` : ""}
            </p>
          )}
        </div>
      )}

      {leftLab && (
        <div className="mb-4 rounded-xl border border-success/30 bg-success/5 px-4 py-3">
          <p className="text-sm font-medium text-success">
            {!isDispatched
              ? `Transferred to the branch — the device is now at ${CASE_STATUS_LABELS[status]}.`
              : "Transferred to the branch — the lab's work on this case is done. Waiting for the branch to confirm receipt."}
          </p>
          {c.labTransferCompletedAt && (
            <p className="mt-0.5 text-xs text-success/80">
              Transferred by {personName(c.labTransferBy) ?? "—"} · {formatDateTime(c.labTransferCompletedAt)}
            </p>
          )}
        </div>
      )}

      {/* Lab stage rail */}
      <div className="mb-6 rounded-xl border border-border bg-surface px-4 py-5 shadow-sm">
        <StageRail
          stages={railStages.map((s) => {
            const Icon = STAGE_ICONS[s];
            return {
              key: s,
              label: LAB_FLOW_LABELS[s] ?? CASE_STATUS_LABELS[s],
              icon: <Icon />,
              caption: reached.has(s) ? formatShortDateTime(reached.get(s)!) : undefined,
            };
          })}
          current={railCurrent}
          currentLabel={qcDone ? "Ready to transfer" : undefined}
          stoppedLabel={stoppedLabel}
          complete={transferDone}
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1.65fr_1fr]">
        <div className="space-y-6">
          {/* Work type — mandatory before moving to Pending Approval */}
          {isDiagnosis && permission.canEdit && (
            <Card title="Work type">
              <p className="mb-4 text-sm text-text-muted">
                Select how this case is being handled. This is required before submitting the case.
              </p>
              <LabWorkTypeForm
                caseId={c.id}
                initial={{
                  workType: (c.labWorkType as LabWorkType | null) ?? null,
                  engineerId: c.labEngineerId,
                  vendorId: c.labVendorId,
                }}
                engineers={engineers}
                vendors={vendors}
                action={saveLabWorkType.bind(null, c.id)}
              />
            </Card>
          )}

          {/* Saved work type (read-only after diagnosis) */}
          {!isDiagnosis && c.labWorkType && (
            <Card title="Work type">
              <KvList
                items={[
                  ["Type", c.labWorkType === "INHOUSE" ? "Inhouse" : "Outsource"],
                  ...(c.labWorkType === "INHOUSE" && c.labEngineer
                    ? [["Engineer", personName(c.labEngineer) ?? "—"] as [string, string]]
                    : []),
                  ...(c.labWorkType === "OUTSOURCE" && c.labVendor
                    ? [["Vendor", c.labVendor.name] as [string, string]]
                    : []),
                ]}
              />
            </Card>
          )}

          {/* QC checklist — must be completed before Transfer to Branch */}
          {qc && (
            <QcChecklistCard
              jobsheetNo={c.jobsheetNo}
              rows={qc.rows}
              action={saveQcAnswers.bind(null, c.id)}
              canEdit={permission.canEdit}
              lab
            />
          )}

          {/* Billable items — inline editor at any active lab stage */}
          <Card
            title="Billable items"
            actions={
              <div className="flex flex-wrap items-center justify-end gap-2">
                {c.chipMaxEstimatePaise !== null && (
                  <div className="rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-sm">
                    <span className="text-text-muted">Max estimate </span>
                    <span className="font-bold tabular-nums">{formatPaise(c.chipMaxEstimatePaise)}</span>
                  </div>
                )}
                {permission.canEdit && LAB_ADD_ITEM_STATUSES.includes(status) && (
                  <AddItemDialog
                    options={addCatalog.filter((i) => !c.items.some((l) => l.itemId === i.id)).map((i) => ({ value: i.id, label: `${i.code} — ${i.name}` }))}
                    action={addItemToLabCase.bind(null, c.id)}
                    backToDiagnosis={status !== "CHIP_LAB_DIAGNOSIS"}
                    backLabel="Lab Diagnosis"
                  />
                )}
              </div>
            }
          >
            {canEditItems ? (
              <LabItemsSection
                action={saveLabItems.bind(null, c.id)}
                catalog={catalog}
                initial={labItemsInitial}
                outsource={outsource}
                stockInfo={{
                  ...labStock,
                  caseItemIds: Object.fromEntries(c.items.map((l) => [l.itemId, l.id])),
                }}
                canRequest={canRequestParts(status)}
                requestAction={requestPartForLabCase}
                reorderAction={reorderPartForLabCase}
                returnAction={returnPartForLabCase}
                consumeAction={consumeLabItem}
                jobsheetNo={c.jobsheetNo}
              />
            ) : (
              <>
                <DataTable
                  rows={c.items}
                  rowKey={(l) => l.id}
                  empty="No billable items recorded yet."
                  columns={[
                    {
                      header: "Item",
                      cell: (l) => (
                        <span className="flex items-center gap-2 font-medium">
                          {l.name}
                          <Badge tone={ITEM_TYPE_TONE[l.type]}>{ITEM_TYPE_LABELS[l.type]}</Badge>
                          {usidByItem[l.itemId] && <Badge tone="navy" className="tabular-nums">{usidByItem[l.itemId]}</Badge>}
                        </span>
                      ),
                    },
                    { header: "Code", cell: (l) => <span className="text-text-muted">{l.code}</span> },
                    {
                      header: "Billed ₹",
                      align: "right",
                      cell: (l) => <span className="font-semibold">{formatPaise(l.unitPricePaise, { symbol: false })}</span>,
                    },
                    ...(outsource
                      ? [
                          {
                            header: "Vendor ₹",
                            align: "right" as const,
                            cell: (l: (typeof c.items)[number]) => formatPaise(l.vendorCostPaise, { symbol: false }),
                          },
                        ]
                      : []),
                    {
                      header: "Total ₹",
                      align: "right",
                      cell: (l) => <span className="font-semibold">{formatPaise(l.lineTotalPaise, { symbol: false })}</span>,
                    },
                  ]}
                />
                {c.estimatedCostPaise !== null && (
                  <p className="mt-4 text-right text-sm">
                    Estimate: <span className="font-bold">{formatPaise(c.estimatedCostPaise)}</span>
                  </p>
                )}
              </>
            )}

            {c.items.length > 0 && (
              <div className="mt-5 grid gap-6 border-t border-border pt-5 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[1px] text-text-muted">From customer</p>
                  <p className="mt-1 text-sm text-text-muted">
                    Billed {formatPaise(billed)} − Advance {formatPaise(advance)}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-2xl font-semibold tabular-nums text-brand-navy dark:text-text">
                    Due {formatPaise(customerDue)}
                    {customerDue === 0 && <Badge tone="success">Settled</Badge>}
                  </p>
                </div>

                {outsource && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[1px] text-text-muted">
                      To vendor{c.labVendor ? ` — ${c.labVendor.name}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-text-muted">
                      Vendor charges {formatPaise(vendorOwed)} − Paid {formatPaise(vendorPaid)}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-semibold tabular-nums text-brand-navy dark:text-text">
                      Due {formatPaise(vendorDue)}
                      {vendorOwed > 0 && vendorDue === 0 && <Badge tone="success">Paid</Badge>}
                      {vendorDue > 0 && permission.canEdit && (
                        <VendorPaymentDialog
                          jobsheetNo={c.jobsheetNo}
                          dueLabel={formatPaise(vendorDue)}
                          vendorName={c.labVendor?.name ?? "the vendor"}
                          action={recordVendorPayment.bind(null, c.id)}
                        />
                      )}
                    </div>
                    {vendorOwed === 0 && (
                      <p className="mt-1 text-xs text-text-muted">Enter the vendor charge on each item to track what is due.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {outsource && c.labVendorPayments.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[1px] text-text-muted">Vendor payments</p>
                <DataTable
                  rows={c.labVendorPayments}
                  rowKey={(p) => p.id}
                  columns={[
                    { header: "Date", cell: (p) => formatDateTime(p.paidAt) },
                    {
                      header: "Amount ₹",
                      align: "right",
                      cell: (p) => <span className="font-semibold">{formatPaise(p.amountPaise, { symbol: false })}</span>,
                    },
                    { header: "Note", cell: (p) => p.note ?? "—" },
                    { header: "Paid by", cell: (p) => personName(p.paidBy) ?? "—" },
                  ]}
                />
              </div>
            )}
          </Card>

          {/* Outsource history */}
          {c.labOutsources.length > 0 && (
            <Card title="Outsource history">
              <ul className="divide-y divide-border">
                {c.labOutsources.map((o) => (
                  <li key={o.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">{o.vendor.name}</span>
                      <Badge tone={o.actualReturnAt ? "success" : "warning"}>
                        {o.actualReturnAt ? "Returned" : "With vendor"}
                      </Badge>
                    </div>
                    <KvList
                      items={[
                        ["Sent", formatDate(o.sentAt)],
                        ["Expected return", o.expectedReturnAt ? formatDate(o.expectedReturnAt) : null],
                        ["Actual return", o.actualReturnAt ? formatDate(o.actualReturnAt) : null],
                        ["Reference", o.referenceNo],
                        ["Notes", o.notes],
                      ]}
                    />
                    {o.createdBy && (
                      <p className="text-xs text-text-muted">Recorded by {personName(o.createdBy)}</p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Device info */}
          <Card title="Device & intake">
            <div className="grid gap-x-8 gap-y-2.5 md:grid-cols-2">
              <KvList
                items={[
                  ["Product", [c.brand, c.model].filter(Boolean).join(" ") || "—"],
                  ["Serial", c.serialNo],
                  ["Status", WARRANTY_LABELS[c.warrantyStatus]],
                  ["Problem reported", c.problemReported],
                ]}
              />
              <KvList
                items={[
                  ["Origin branch", `${c.branch.name} (${c.branch.code})`],
                  ["Intake type", INTAKE_TYPE_LABELS[c.intakeType]],
                  ["Branch engineer", personName(c.engineer) ?? "Unassigned"],
                  ["Expected delivery", c.expectedDeliveryDate ? formatDate(c.expectedDeliveryDate) : null],
                ]}
              />
            </div>
          </Card>

          {savedQc.length > 0 && <QcChecklistCard jobsheetNo={c.jobsheetNo} rows={savedQc} canEdit={false} />}
        </div>

        <div className="space-y-6">
          <CaseComments currentUserId={user.id} comments={comments} staff={mentionable} action={addCaseComment.bind(null, c.id)} />

          <TimelineCard items={timelineItems} limit={8} />

          <Card title="Customer">
            <KvList
              items={[
                ["Name", c.customer.name],
                ["Phone", c.customer.phone],
                ...(c.account ? [["Account", c.account.name] as [string, string]] : []),
              ]}
            />
          </Card>

          <Card title="Record">
            <KvList
              items={[
                ["In stage since", formatDateTime(c.stageChangedAt)],
                ["Case created", formatDateTime(c.createdAt)],
              ]}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
