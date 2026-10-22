import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, FileText, History, Image as ImageIcon, IndianRupee, MessageCircle, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/ui/action-button";
import { buttonClass, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { KvList } from "@/components/ui/kv-list";
import { SecretReveal } from "@/components/ui/secret-reveal";
import { StageRail } from "@/components/ui/stage-rail";
import { personName } from "@/components/data/who-when";
import { DataTable } from "@/components/data/data-table";
import { TimelineCard } from "@/components/data/timeline-card";
import type { TimelineItem } from "@/components/data/timeline";
import { PageHeader } from "@/components/layout/page-header";
import { FlashToast } from "@/components/feedback/flash-toast";
import { formatDate, formatDateTime, formatShortDateTime, toDateInput } from "@/lib/dates";
import { discountPercent } from "@/lib/pricing";
import { enumLabel } from "@/lib/enum";
import { formatPaise, paiseToInput } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { param } from "@/modules/admin/components/admin-page";
import { CUSTOMER_PATHS } from "@/modules/customers/paths";
import { LEAD_SOURCE_LABELS } from "@/modules/customers/schemas";
import { closeCaseWithBill } from "@/modules/service/actions/close-case";
import { closeBlockReason, closingAccessories, closingBill } from "@/modules/service/case-billing";
import { CloseCaseDialog } from "@/modules/service/components/close-case-dialog";
import { addItemToCase, assignEngineer, cancelCase, changeCaseStage, moveCaseToNextStage, receiveFromChipLab, revealDevicePassword, saveEstimate, saveCaseFeedback, sendBackToChipLab, submitDiagnosis, transferToChipLab } from "@/modules/service/actions/case";
import { consumePartForCase, returnPartForCase } from "@/modules/inventory/actions/case-parts";
import { caseUsids, consumableUnits, qcConsumptionBlock } from "@/modules/inventory/case-parts";
import { openVendorReplacementsForCase } from "@/modules/inventory/queries";
import { VR_STATUS_LABELS } from "@/modules/inventory/vendor-replacement-labels";
import { ConsumeUsidDialog } from "@/modules/service/components/consume-usid-dialog";
import { AddItemDialog } from "@/modules/service/components/add-item-dialog";
import { ReturnPartDialog } from "@/modules/service/components/return-part-dialog";
import { requestPartForCase } from "@/modules/inventory/actions/purchase";
import { sendWhatsAppTemplate } from "@/modules/service/actions/whatsapp";
import { quoteWhatsAppLink } from "@/server/notify/customer";
import { WA_TEMPLATE_MAP } from "@/server/notify/whatsapp-templates";
import { SendWhatsAppButton } from "@/modules/service/components/send-whatsapp-button";
import { db } from "@/server/db";
import { AssignEngineerDialog } from "@/modules/service/components/assign-engineer-dialog";
import { EstimateDialog } from "@/modules/service/components/estimate-dialog";
import { BilledAmountCell } from "@/modules/service/components/billed-amount-cell";
import { BillingSaveBar } from "@/modules/service/components/billing-save-bar";
import { saveBilledAmounts } from "@/modules/service/actions/billing";
import { FeedbackDialog } from "@/modules/service/components/feedback-dialog";
import { ITEM_TYPE_LABELS, ITEM_TYPE_TONE } from "@/modules/admin/item-schema";
import { PartRequestDialog } from "@/modules/service/components/part-request-dialog";
import { ItemReturnDialog } from "@/modules/service/components/item-return-dialog";
import { getWarrantyCover, type WarrantyCover } from "@/modules/service/warranty";
import { requestItemReturn } from "@/modules/service/actions/item-return";
import { StageActions } from "@/modules/service/components/stage-actions";
import { QuotePreviewDialog } from "@/modules/service/components/quote-preview-dialog";
import { STAGE_ICONS } from "@/modules/service/components/stage-icons";
import { ChipBranchActions } from "@/modules/service/components/chip-branch-actions";
import { QcChecklistCard } from "@/modules/service/components/qc-checklist-card";
import { QcChecklistDialog } from "@/modules/service/components/qc-checklist-panel";
import { saveQcAnswers } from "@/modules/service/actions/qc-response";
import { getQcState } from "@/modules/service/qc-response-queries";
import {
  CASE_FLOW,
  CHIP_BRANCH_FLOW,
  LAB_INTERNAL_STATUSES,
  branchChipRailStatus,
  CASE_KIND_LABELS,
  CASE_STATUS_LABELS,
  CASE_STATUS_TONE,
  CUSTOMER_BEHAVIOUR_LABELS,
  CUSTOMER_BEHAVIOUR_TONE,
  CUSTOMER_BEHAVIOURS,
  BILLING_EDIT_STATUSES,
  ESTIMATE_EDITABLE,
  canRequestParts,
  ADD_ITEM_STATUSES,
  type CaseStatusValue,
  INTAKE_TYPE_LABELS,
  isChipLabStatus,
  isOpenStatus,
  nextStage,
  PAYMENT_MODE_LABELS,
  WARRANTY_LABELS,
} from "@/modules/service/case-schema";
import { SERVICE_PATHS } from "@/modules/service/paths";
import { ReorderDialog } from "@/modules/service/components/reorder-dialog";
import { reorderPartForCase } from "@/modules/inventory/actions/purchase";
import { getCase, getCaseExtras, listBranchStaff, listCatalogForPicker, type CaseDetails } from "@/modules/service/queries";
import { branchWhere, getBranchScope } from "@/server/branch-scope";
import { getMenuPermission, requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Case details" };


type Event = TimelineItem & { at: Date };

/** Stage moves, payments and photos, newest first. */
function timeline(c: CaseDetails): TimelineItem[] {
  const icon = (Icon: React.ComponentType) => <Icon />;
  const events: Event[] = c.statusHistory.map((h) => ({
    key: h.id,
    at: h.at,
    icon: icon(!h.fromStatus ? FileText : STAGE_ICONS[h.toStatus]),
    title: !h.fromStatus
      ? "Case created"
      : h.fromStatus === h.toStatus
        ? `${CASE_STATUS_LABELS[h.toStatus]} completed`
      : h.toStatus === "CANCELLED"
        ? "Cancelled"
        : h.fromStatus === "INTAKE" && h.toStatus === "DIAGNOSIS"
          ? "Diagnosis started"
          : `Moved to ${CASE_STATUS_LABELS[h.toStatus]}`,
    detail: !h.fromStatus ? `${INTAKE_TYPE_LABELS[c.intakeType].toLowerCase()}, ${personName(h.changedBy) ?? "system"}` : h.note,
    meta: `${formatDateTime(h.at)} · ${personName(h.changedBy) ?? "System"}`,
    tone: h.toStatus === "CANCELLED" ? "danger" : "default",
  }));
  for (const p of c.payments) {
    events.push({
      key: p.id,
      at: p.createdAt,
      icon: icon(IndianRupee),
      title: `${enumLabel(p.kind)} received`,
      detail: `${formatPaise(p.amountPaise)} · ${PAYMENT_MODE_LABELS[p.mode]}`,
      meta: `${formatDateTime(p.createdAt)} · ${personName(p.receivedBy) ?? "System"}`,
    });
  }
  if (c.attachments.length > 0) {
    const first = c.attachments[0]!;
    events.push({
      key: "photos",
      at: first.createdAt,
      icon: icon(ImageIcon),
      title: "Intake photos added",
      detail: `${c.attachments.length} ${c.attachments.length === 1 ? "photo" : "photos"}`,
      meta: `${formatDateTime(first.createdAt)} · ${personName(first.createdBy) ?? "System"}`,
    });
  }
  // Same instant: "Case created" goes last (oldest), so payments/photos show above it.
  const last = (e: Event) => (e.title === "Case created" ? 1 : 0);
  return events.sort((a, b) => b.at.getTime() - a.at.getTime() || last(a) - last(b));
}

/** When each stage was last entered (Intake = case created). */
function reachedAt(c: CaseDetails) {
  const at = new Map<string, Date>([["INTAKE", c.createdAt]]);
  // history is newest first, so the first hit per stage is the latest entry
  for (const h of c.statusHistory) if (h.fromStatus && !at.has(h.toStatus)) at.set(h.toStatus, h.at);
  return at;
}

export default async function CaseDetailsPage({ params, searchParams }: PageProps<"/service/cases/[id]">) {
  const { user, permission } = await requirePageAccess(SERVICE_PATHS.cases);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const scope = branchWhere(await getBranchScope(user));
  const [c, customers] = await Promise.all([getCase(id, scope), getMenuPermission(user, CUSTOMER_PATHS.database)]);
  // Outside the header branch → 404, so other branches' cases don't leak.
  if (!c) notFound();
  const [extras, waMessages] = await Promise.all([
    getCaseExtras(c.customer.id, scope),
    db.whatsAppMessage.findMany({
      where: { caseId: c.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, templateName: true, status: true, error: true, createdAt: true,
        createdBy: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);
  const reached = reachedAt(c);
  const qc = c.status === "QUALITY_CHECK" ? await getQcState(c.id, "QUALITY_CHECK", c.stageChangedAt) : null;

  const paid = c.payments.reduce((sum, p) => sum + p.amountPaise, 0);
  const subtotal = c.estimatedCostPaise;
  const due = subtotal === null ? null : Math.max(0, subtotal - paid);
  const device = [c.brand, c.model].filter(Boolean).join(" ");
  const next = nextStage(c.status);
  const isInChipTrack = isChipLabStatus(c.status);
  // true if the case currently has chip-level lab history (used to show "Send Back" at QUALITY_CHECK)
  const hasChipHistory = c.statusHistory.some((h) => h.toStatus === "CHIP_TRANSFER");
  const isChipCase = isInChipTrack || hasChipHistory;
  // Quality Check runs in one popup (checklist → next stage / send back) whenever checklist items exist.
  const qcInModal = permission.canEdit && c.status === "QUALITY_CHECK" && Boolean(qc && qc.rows.length > 0);
  const isLabInternal = LAB_INTERNAL_STATUSES.includes(c.status);
  const cancelledFrom = c.status === "CANCELLED" ? c.statusHistory.find((h) => h.toStatus === "CANCELLED")?.fromStatus : null;
  const portalCode = c.jobsheetNo.split("-").pop();
  const half = extras.gstPercent / 2;

  // WhatsApp link shown when the quote is pending customer decision
  const waLink = c.status === "PENDING_APPROVAL" && c.estimatedCostPaise
    ? quoteWhatsAppLink({
        customerName: c.customer.name,
        customerPhone: c.customer.phone,
        jobsheetNo: c.jobsheetNo,
        device,
        estimatePaise: c.estimatedCostPaise,
        branchName: c.branch.name,
      })
    : null;

  const sendWhatsApp = sendWhatsAppTemplate.bind(null, c.id);

  // Start diagnosis (at Intake) / Edit items (Diagnosis, Pending approval)
  const estimateMode = !permission.canEdit ? null : c.status === "INTAKE" ? "start" : ESTIMATE_EDITABLE.includes(c.status) && !isChipCase ? "edit" : null;
  // Billed-amount editing outside the full "Edit items" dialog; a case from the chip-level lab only gets its service charge.
  const canEditBilling = permission.canEdit && BILLING_EDIT_STATUSES.includes(c.status) && c.items.length > 0;
  const labPriced = hasChipHistory || isInChipTrack;
  const canAssignEngineer = permission.canEdit && isOpenStatus(c.status);
  const [catalog, staff] = await Promise.all([
    estimateMode ? listCatalogForPicker() : Promise.resolve([] as Awaited<ReturnType<typeof listCatalogForPicker>>),
    canAssignEngineer ? listBranchStaff(c.branchId) : Promise.resolve([] as { value: string; label: string }[]),
  ]);
  // Stock + active purchase-request lookup for billable items (PART + ACCESSORY only)
  const physicalItemIds = c.items
    .filter((l) => l.type === "PART" || l.type === "ACCESSORY")
    .map((l) => l.itemId);
  const [stockItems, activePRs] = physicalItemIds.length > 0
    ? await Promise.all([
        db.stockItem.findMany({
          where: { branchId: c.branchId, itemId: { in: physicalItemIds } },
          select: { itemId: true, quantity: true },
        }),
        db.purchaseRequest.findMany({
          where: { caseId: c.id, itemId: { in: physicalItemIds }, status: { notIn: ["FULFILLED", "REJECTED"] } },
          // oldest first, so the latest request for an item decides what its row shows
          orderBy: { createdAt: "asc" },
          select: { itemId: true, status: true },
        }),
      ])
    : [[], []];
  const isClosed = c.status === "CLOSED";
  // What happened to each part on this case (used / returned) and which ones have a received unit waiting to be used.
  const closing = c.status === "READY_FOR_DELIVERY";
  const [usages, receivedForCase, qcBlock, addCatalog, unitsByItem, usidByItem, vendorByItem, closingData, closingAccessoryList, closeBlock] = await Promise.all([
    db.caseItemUsage.findMany({ where: { caseId: c.id }, select: { itemId: true, kind: true } }),
    db.stockUnit.findMany({ where: { allocatedCaseId: c.id, status: "RECEIVED" }, select: { itemId: true } }),
    next === "QUALITY_CHECK" ? qcConsumptionBlock(c.id) : Promise.resolve(null),
    permission.canEdit && ADD_ITEM_STATUSES.includes(c.status) ? listCatalogForPicker() : Promise.resolve([] as Awaited<ReturnType<typeof listCatalogForPicker>>),
    consumableUnits(c.id, c.branchId, physicalItemIds),
    caseUsids(c.id),
    openVendorReplacementsForCase(c.id),
    closing ? closingBill(c.id) : Promise.resolve(null),
    closing ? closingAccessories(c.branchId) : Promise.resolve([]),
    closing ? closeBlockReason(c.id, c.status) : Promise.resolve(null),
  ]);
  // Parts sent back before the case closed: reason, remarks and the photos taken, each set tied to its item and USID.
  const returnedParts = await db.caseItemUsage.findMany({
    where: { caseId: c.id, kind: { in: ["RETURNED_UNUSED", "RETURNED_DEFECTIVE"] } },
    orderBy: { at: "desc" },
    select: {
      id: true,
      reason: true,
      remarks: true,
      at: true,
      user: { select: { firstName: true, lastName: true } },
      stockUnit: {
        select: {
          usid: true,
          item: { select: { name: true, code: true } },
          attachments: { where: { kind: "RETURN_PHOTO", caseId: c.id }, select: { id: true, url: true, fileName: true } },
        },
      },
    },
  });
  const settledParts = new Map(usages.filter((u) => u.kind === "CONSUMED" || u.kind === "RETURNED_UNUSED").map((u) => [u.itemId, u.kind]));
  const receivedItemIds = new Set(receivedForCase.map((u) => u.itemId));
  // Open returns on a closed case, so a line already returned shows its status instead of the button.
  const openReturns = isClosed
    ? await db.caseItemReturn.findMany({
        where: { caseId: c.id, isDelete: 0, status: { in: ["REQUESTED", "APPROVED"] } },
        select: { caseItemId: true, status: true },
      })
    : [];
  const cover = isClosed
    ? await getWarrantyCover(c.id, c.items.map((l) => l.itemId))
    : new Map<string, WarrantyCover>();
  const warrantyFor = (itemId: string) => {
    const w = cover.get(itemId);
    if (!w?.days) return { covered: false, hint: "No warranty on this item" };
    return w.covered
      ? { covered: true, hint: `Under warranty until ${formatDate(w.endsAt)}` }
      : { covered: false, hint: `Warranty ended on ${formatDate(w.endsAt)}` };
  };
  // Stock units (by USID) the Purchase Manager allocated to this case, for traceability.
  const allocations = await db.stockUnit.findMany({
    where: { allocatedCaseId: c.id },
    orderBy: { allocatedAt: "desc" },
    select: {
      id: true,
      usid: true,
      allocatedAt: true,
      status: true,
      receivedAt: true,
      receivedBy: { select: { firstName: true, lastName: true } },
      item: { select: { name: true, code: true } },
      billItem: { select: { bill: { select: { id: true, billNo: true } } } },
      purchaseRequest: { select: { item: { select: { name: true } } } },
      allocatedBy: { select: { firstName: true, lastName: true } },
      attachments: { select: { id: true, url: true, fileName: true }, orderBy: { createdAt: "asc" } },
    },
  });
  const returnStatus = new Map(openReturns.map((r) => [r.caseItemId, r.status]));
  // Units received for cases are held until their case closes, so they are not free stock to consume.
  const heldUnits = physicalItemIds.length
    ? await db.stockUnit.groupBy({ by: ["itemId"], where: { branchId: c.branchId, itemId: { in: physicalItemIds }, status: "RECEIVED" }, _count: { _all: true } })
    : [];
  const heldMap = new Map(heldUnits.map((h) => [h.itemId, h._count._all]));
  const stockMap = new Map(stockItems.map((s) => [s.itemId, Math.max(0, s.quantity - (heldMap.get(s.itemId) ?? 0))]));
  // Items that already have an active (non-fulfilled, non-rejected) PR on this case
  const requestedItemIds = new Set(activePRs.map((pr) => pr.itemId));
  const requestStage = new Map(activePRs.map((pr) => [pr.itemId, pr.status === "SPARE_UNAVAILABLE" ? "Spare not available" : pr.status === "ORDERED" ? "Ordered" : pr.status === "TRANSFERRED" || pr.status === "CONSUMED" ? "Transferred" : "Requested"]));

  const estimate = estimateMode && (
    <EstimateDialog
      mode={estimateMode}
      trigger={
        estimateMode === "start" ? (
          <>
            Start diagnosis <ArrowRight className="size-4" />
          </>
        ) : (
          <>
            <Pencil className="size-4" /> Edit items
          </>
        )
      }
      triggerVariant={estimateMode === "start" ? "navy" : "secondary"}
      jobsheetNo={c.jobsheetNo}
      action={saveEstimate.bind(null, c.id, estimateMode)}
      catalog={catalog}
      staff={staff}
      initial={{
        engineerId: c.engineerId ?? "",
        expectedDeliveryDate: toDateInput(c.expectedDeliveryDate),
        gstInvoiceRequired: c.gstInvoiceRequired,
        lines: c.items.map((l) => ({
          itemId: l.itemId,
          quantity: String(l.quantity),
          unitPrice: paiseToInput(l.unitPricePaise),
          info: {
            id: l.itemId,
            code: l.code,
            name: l.name,
            unit: "",
            pricePaise: l.listPricePaise,
            minPricePaise: l.minPricePaise,
            maxDiscountPercent: discountPercent(l.listPricePaise, l.minPricePaise),
          },
        })),
      }}
    />
  );

  return (
    <>
      <FlashToast flag={param(sp, "saved")} message={`Case ${c.jobsheetNo} saved.`} />
      <FlashToast
        flag={param(sp, "photos")}
        param="photos"
        type="warning"
        message="The case was saved, but the photos could not be stored. Please add them again."
      />
      <PageHeader
        title={c.jobsheetNo}
        badges={
          <Badge tone={isLabInternal ? "violet" : CASE_STATUS_TONE[c.status]}>
            {isLabInternal ? "With Chip-Level Lab" : CASE_STATUS_LABELS[c.status]}
          </Badge>
        }
        subtitle={[
          CASE_KIND_LABELS[c.warrantyStatus],
          INTAKE_TYPE_LABELS[c.intakeType],
          `${c.branch.name} (${c.branch.code})`,
          `Created ${formatDateTime(c.createdAt)} by ${personName(c.createdBy) ?? "System"}`,
          `Portal fallback code ${portalCode}`,
        ].join(" · ")}
        breadcrumbs={["Service", "Cases", c.jobsheetNo]}
        actions={
          <>
            <LinkButton href={SERVICE_PATHS.cases} variant="secondary">
              <ArrowLeft className="size-4" /> Back
            </LinkButton>
            <LinkButton href={`${SERVICE_PATHS.cases}/${c.id}/history`} variant="secondary">
              <History className="size-4" /> History
            </LinkButton>
            {waLink && (
              <LinkButton href={waLink} variant="secondary" target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-4" /> WhatsApp customer
              </LinkButton>
            )}
            {permission.canEdit && c.customer.phone && (
              <SendWhatsAppButton
                customerName={c.customer.name}
                customerPhone={formatPhone(c.customer.phone)}
                action={sendWhatsApp}
              />
            )}
            {permission.canEdit && (
              <ChipBranchActions
                status={c.status}
                hasChipHistory={hasChipHistory}
                qcInModal={qcInModal}
                transferToChipLab={transferToChipLab.bind(null, c.id)}
                sendBackToChipLab={sendBackToChipLab.bind(null, c.id)}
              />
            )}
            {permission.canEdit && isOpenStatus(c.status) && !isLabInternal && (
              <StageActions
                jobsheetNo={c.jobsheetNo}
                status={c.status}
                next={next}
                moveNext={moveCaseToNextStage.bind(null, c.id)}
                qcBlock={qcBlock}
                changeStage={changeCaseStage.bind(null, c.id)}
                cancel={cancelCase.bind(null, c.id)}
                primary={
                  next === "CLOSED" && permission.canEdit && closingData
                    ? closeBlock
                      ? (
                          <span className="inline-flex flex-col items-start gap-0.5">
                            <button type="button" disabled title={closeBlock} className={buttonClass("navy") + " cursor-not-allowed opacity-50"}>
                              Move to Closed <ArrowRight className="size-4" />
                            </button>
                            <span className="max-w-xs text-[11px] text-text-muted">{closeBlock}</span>
                          </span>
                        )
                      : (
                          <CloseCaseDialog
                            jobsheetNo={c.jobsheetNo}
                            customerName={closingData.customerName}
                            gstInclusive={closingData.gstInclusive}
                            lines={closingData.lines}
                            advancePaise={closingData.advancePaise}
                            accessories={closingAccessoryList}
                            action={closeCaseWithBill.bind(null, c.id)}
                          />
                        )
                    : estimateMode === "start"
                    ? estimate
                    : qcInModal && next && qc
                      ? (
                          <QcChecklistDialog
                            trigger={
                              <>
                                Move to {CASE_STATUS_LABELS[next]} <ArrowRight className="size-4" />
                              </>
                            }
                            triggerVariant="navy"
                            jobsheetNo={c.jobsheetNo}
                            items={qc.rows}
                            action={saveQcAnswers.bind(null, c.id)}
                            next={{
                              label: CASE_STATUS_LABELS[next],
                              move: moveCaseToNextStage.bind(null, c.id),
                              sendBack: sendBackToChipLab.bind(null, c.id),
                              cameFromLab: hasChipHistory,
                            }}
                          />
                        )
                    : c.status === "CHIP_BRANCH_RECEIVED" && permission.canEdit
                      ? (
                          <ActionButton
                            action={receiveFromChipLab.bind(null, c.id)}
                            label="Receive from lab"
                            className={buttonClass("navy")}
                          >
                            <span className="inline-flex items-center gap-2">
                              Receive from Lab <ArrowRight className="size-4" />
                            </span>
                          </ActionButton>
                        )
                      : c.status === "DIAGNOSIS" && c.estimatedCostPaise && permission.canEdit
                        ? (
                            <QuotePreviewDialog
                              caseId={c.id}
                              jobsheetNo={c.jobsheetNo}
                              branchName={c.branch.name}
                              device={device}
                              lines={c.items.map((l) => ({ name: l.name, quantity: l.quantity, totalPaise: l.unitPricePaise * l.quantity }))}
                              totalPaise={c.estimatedCostPaise}
                              gstInclusive={extras.gstInclusive}
                              send={submitDiagnosis.bind(null, c.id)}
                            />
                          )
                        : undefined
                }
              />
            )}
          </>
        }
      />

      {isChipCase && (
        <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 dark:border-violet-800 dark:bg-violet-950/30">
          <div>
            <p className="text-sm font-medium text-violet-800 dark:text-violet-300">
              {isLabInternal
                ? "Device is currently with the chip-level repair lab"
                : c.status === "CHIP_BRANCH_RECEIVED"
                  ? "Device received from chip-level lab — confirm receipt to continue"
                  : "Chip-Level Lab Track"}
            </p>
            <p className="text-xs text-violet-600 dark:text-violet-400 mt-0.5">
              {isLabInternal
                ? ""
                : "Cases sent to chip-level lab for board-level repair."}
            </p>
          </div>
        </div>
      )}

      <div className="mb-6 rounded-xl border border-border bg-surface px-4 py-5 shadow-sm">
        <StageRail
          stages={(isChipCase ? CHIP_BRANCH_FLOW : CASE_FLOW).map((s) => {
            const Icon = STAGE_ICONS[s];
            return { key: s, label: CASE_STATUS_LABELS[s], icon: <Icon />, caption: reached.has(s) ? formatShortDateTime(reached.get(s)) : undefined };
          })}
          current={cancelledFrom ?? (isChipCase ? branchChipRailStatus(c.status) : c.status)}
          stoppedLabel={c.status === "CANCELLED" ? "Cancelled" : undefined}
          complete={c.status === "CLOSED"}
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1.65fr_1fr]">
        <div className="space-y-6">
          {qc && (
            <QcChecklistCard
              jobsheetNo={c.jobsheetNo}
              rows={qc.rows}
              action={saveQcAnswers.bind(null, c.id)}
              canEdit={permission.canEdit}
            />
          )}

          <Card
            title="Billable items"
            actions={
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-muted">Minimum selling price enforced per item</span>
                {estimateMode === "edit" && estimate}
                {permission.canEdit && ADD_ITEM_STATUSES.includes(c.status) && estimateMode !== "edit" && (
                  <AddItemDialog
                    options={addCatalog.filter((i) => !c.items.some((l) => l.itemId === i.id)).map((i) => ({ value: i.id, label: `${i.code} — ${i.name}` }))}
                    action={addItemToCase.bind(null, c.id)}
                    backToDiagnosis={c.status !== "DIAGNOSIS"}
                    backLabel="Diagnosis"
                  />
                )}
              </div>
            }
          >
            <DataTable
              rows={c.items}
              rowKey={(l) => l.id}
              empty={c.status === "INTAKE" ? "Items are added when diagnosis starts." : "No billable items on this case."}
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
                { header: "Min ₹", align: "right", cell: (l) => formatPaise(l.minPricePaise, { symbol: false }) },
                {
                  header: "Billed ₹",
                  align: "right",
                  cell: (l) =>
                    canEditBilling && (!labPriced || l.type === "SERVICE") ? (
                      <BilledAmountCell
                        key={`${l.id}-${l.unitPricePaise}`}
                        caseId={c.id}
                        itemId={l.id}
                        value={paiseToInput(l.unitPricePaise)}
                        minPricePaise={l.minPricePaise}
                      />
                    ) : (
                      <span className="font-semibold">{formatPaise(l.unitPricePaise, { symbol: false })}</span>
                    ),
                },
                { header: "Total ₹", align: "right", cell: (l) => <span className="font-semibold">{formatPaise(l.lineTotalPaise, { symbol: false })}</span> },
                // {
                //   header: "Status",
                //   cell: (l) => {
                //     const off = discountPercent(l.listPricePaise, l.unitPricePaise);
                //     return off > 0 ? <Badge tone="warning">{off}% discount</Badge> : <Badge tone="success">OK</Badge>;
                //   },
                // },
                {
                  header: "Action",
                  align: "center",
                  cell: (l) => {
                    if (l.type !== "PART" && l.type !== "ACCESSORY") return null;
                    if (isClosed) {
                      const rs = returnStatus.get(l.id);
                      if (rs) {
                        return (
                          <span className="inline-flex items-center rounded-lg border border-border bg-surface-muted px-3 py-1 text-xs font-medium text-text-muted">
                            {rs === "APPROVED" ? "Return approved" : "Return requested"}
                          </span>
                        );
                      }
                      return permission.canEdit ? (
                        <ItemReturnDialog itemName={l.name} warranty={warrantyFor(l.itemId)} action={requestItemReturn.bind(null, l.id)} />
                      ) : null;
                    }
                    // Used on this case, or returned unused: nothing more to do for this part.
                    const done = settledParts.get(l.itemId);
                    if (done) {
                      return <Badge tone={done === "CONSUMED" ? "success" : "neutral"}>{done === "CONSUMED" ? "Consumed" : "Returned"}</Badge>;
                    }
                    const qty = stockMap.get(l.itemId) ?? 0;
                    const received = receivedItemIds.has(l.itemId);
                    const options = unitsByItem[l.itemId] ?? [];
                    if (options.length > 0 || qty > 0) {
                      // Consuming starts only after the customer has approved the estimate.
                      if (!canRequestParts(c.status as CaseStatusValue)) return <span className="text-xs text-text-muted">After approval</span>;
                      return (
                        <span className="inline-flex items-center gap-2">
                          <ConsumeUsidDialog
                            itemName={l.name}
                            jobsheetNo={c.jobsheetNo}
                            options={options}
                            allowStock={qty > 0}
                            action={consumePartForCase.bind(null, l.id)}
                          />
                          {received && permission.canEdit && <ReturnPartDialog itemName={l.name} action={returnPartForCase.bind(null, l.id)} />}
                        </span>
                      );
                    }
                    // A defective unit is being replaced by the vendor under the same USID.
                    const vendor = vendorByItem[l.itemId];
                    if (vendor) {
                      return <Badge tone="violet">Vendor replacement · {VR_STATUS_LABELS[vendor as keyof typeof VR_STATUS_LABELS]}</Badge>;
                    }
                    if (requestedItemIds.has(l.itemId)) {
                      const stage = requestStage.get(l.itemId) ?? "Requested";
                      return (
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-flex items-center rounded-lg border border-border bg-surface-muted px-3 py-1 text-xs font-medium text-text-muted">
                            {stage}
                          </span>
                          {/* A unit was already transferred: if it is faulty the item can be ordered again, with a reason. */}
                          {stage === "Transferred" && canRequestParts(c.status as CaseStatusValue) && (
                            <ReorderDialog itemName={l.name} action={reorderPartForCase.bind(null, l.id)} />
                          )}
                        </span>
                      );
                    }
                    if (!canRequestParts(c.status as CaseStatusValue)) return <span className="text-xs text-text-muted">After approval</span>;
                    return <PartRequestDialog itemName={l.name} action={requestPartForCase.bind(null, l.id)} />;
                  },
                },
              ]}
            />
            {canEditBilling && (
              <BillingSaveBar
                caseId={c.id}
                minByItem={Object.fromEntries(c.items.filter((l) => !labPriced || l.type === "SERVICE").map((l) => [l.id, l.minPricePaise]))}
                action={saveBilledAmounts.bind(null, c.id)}
              />
            )}
            <div className="mt-5 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-sm text-text-muted">
                  Subtotal {formatPaise(subtotal ?? 0)} − Advance {formatPaise(paid)}
                </p>
                <p className="mt-1 text-2xl font-semibold text-brand-navy tabular-nums dark:text-text">
                  Due {due === null ? "—" : formatPaise(due)}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  GST {extras.gstPercent}% {extras.gstInclusive ? "inclusive" : "exclusive"} (CGST {half} + SGST {half})
                  {c.gstInvoiceRequired && " · GST invoice required"}
                </p>
              </div>
              <KvList
                items={[
                  [
                    "Engineer",
                    <span key="engineer" className="flex items-center gap-2">
                      {personName(c.engineer) ?? "Unassigned"}
                      {canAssignEngineer && (
                        <AssignEngineerDialog
                          jobsheetNo={c.jobsheetNo}
                          currentEngineerId={c.engineerId ?? ""}
                          action={assignEngineer.bind(null, c.id)}
                          staff={staff}
                          trigger={<Pencil className="size-3" />}
                          triggerVariant="ghost"
                          triggerClassName="h-6 w-6 p-0 text-text-muted hover:text-text"
                        />
                      )}
                    </span>,
                  ],
                  ["Expected", c.expectedDeliveryDate && formatDate(c.expectedDeliveryDate)],
                  [
                    "Payments",
                    c.payments.length
                      ? c.payments.map((p) => `${formatPaise(p.amountPaise)} ${PAYMENT_MODE_LABELS[p.mode]}`).join(", ")
                      : null,
                  ],
                ]}
              />
            </div>
          </Card>

          {allocations.length > 0 && (
            <Card title="Consumed stock">
              <DataTable
                rows={allocations}
                rowKey={(a) => a.id}
                columns={[
                  { header: "USID", cell: (a) => <span className="text-xs font-medium tabular-nums">{a.usid}</span> },
                  {
                    header: "Item used",
                    cell: (a) => (
                      <>
                        <p className="font-medium">{a.item.name}</p>
                        {a.purchaseRequest && a.purchaseRequest.item.name !== a.item.name && (
                          <p className="text-xs text-text-muted">requested as {a.purchaseRequest?.item.name}</p>
                        )}
                      </>
                    ),
                  },
                  { header: "Bill", cell: (a) => a.billItem?.bill.billNo ?? "Stock" },
                  {
                    header: "Photos",
                    cell: (a) =>
                  a.attachments.length === 0 ? (
                      <span className="text-text-disabled">—</span>
                    ) : (
                      <div className="flex gap-1">
                        {a.attachments.slice(0, 3).map((a) => (
                          <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element -- uploaded file, size unknown */}
                            <img src={a.url} alt={a.fileName} className="size-10 rounded-md border border-border object-cover" />
                          </a>
                        ))}
                        {a.attachments.length > 3 && <span className="self-center text-xs text-text-muted">+{a.attachments.length - 3}</span>}
                      </div>
                    ),
                  },
                  { header: "Allocated", cell: (a) => formatDateTime(a.allocatedAt) },
                  { header: "By", cell: (a) => personName(a.allocatedBy) ?? "—" },
                  {
                    header: "Receipt",
                    cell: (a) =>
                      a.status === "RECEIVED" || a.status === "CONSUMED" ? (
                        <>
                          <Badge tone="success">{a.status === "CONSUMED" ? "Consumed" : "Received"}</Badge>
                          <p className="mt-1 text-xs text-text-muted">
                            {formatDateTime(a.receivedAt)}
                            {a.receivedBy && ` · ${personName(a.receivedBy)}`}
                          </p>
                        </>
                      ) : (
                        <Badge tone="warning">Awaiting receipt</Badge>
                      ),
                  },
                ]}
              />
            </Card>
          )}

          {returnedParts.length > 0 && (
            <Card title="Returned parts">
              <DataTable
                rows={returnedParts}
                rowKey={(r) => r.id}
                columns={[
                  {
                    header: "Item / USID",
                    cell: (r) => (
                      <>
                        <p className="font-medium">{r.stockUnit?.item.name ?? "—"}</p>
                        <p className="text-xs text-text-muted">
                          Case {c.jobsheetNo} · USID <span className="font-semibold tabular-nums text-text">{r.stockUnit?.usid ?? "—"}</span>
                        </p>
                      </>
                    ),
                  },
                  { header: "Reason", cell: (r) => r.reason ?? "—" },
                  { header: "Remarks", cell: (r) => <p className="max-w-60 whitespace-pre-wrap break-words text-sm">{r.remarks ?? "—"}</p> },
                  {
                    header: "Photos",
                    cell: (r) =>
                      !r.stockUnit || r.stockUnit.attachments.length === 0 ? (
                        <span className="text-text-disabled">—</span>
                      ) : (
                        <div className="flex gap-1">
                          {r.stockUnit.attachments.map((p) => (
                            <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element -- uploaded file, size unknown */}
                              <img src={p.url} alt={p.fileName} className="size-10 rounded-md border border-border object-cover" />
                            </a>
                          ))}
                        </div>
                      ),
                  },
                  {
                    header: "Returned",
                    cell: (r) => (
                      <span className="text-xs text-text-muted">
                        {formatDateTime(r.at)}
                        {r.user && ` · ${personName(r.user)}`}
                      </span>
                    ),
                  },
                ]}
              />
            </Card>
          )}

          <Card title="Device & intake">
            <div className="grid gap-x-8 gap-y-2.5 md:grid-cols-2">
              <KvList
                items={[
                  ["Product", `${enumLabel(c.productType)} · ${device}`],
                  ["Serial", c.serialNo],
                  ["Status", WARRANTY_LABELS[c.warrantyStatus]],
                  ["Problem", c.problemReported],
                ]}
              />
              <KvList
                items={[
                  ["Password", c.devicePasswordEnc ? <SecretReveal reveal={revealDevicePassword.bind(null, c.id)} /> : null],
                  [
                    "Received",
                    c.receivedItems.length
                      ? c.receivedItems
                          .map((r) => `${r.name} (${[r.referenceNo && `ref ${r.referenceNo}`, enumLabel(r.condition).toLowerCase()].filter(Boolean).join(", ")})`)
                          .join(" · ")
                      : "Nothing",
                  ],
                  ["Photos", `${c.attachments.length} intake ${c.attachments.length === 1 ? "photo" : "photos"}`],
                  ["Source", LEAD_SOURCE_LABELS[c.source]],
                  ...(c.siteAddress
                    ? ([
                        [
                          c.intakeType === "PICKUP" ? "Pickup at" : "Site",
                          <>
                            {c.siteAddress}
                            {c.siteLatitude !== null && c.siteLongitude !== null && (
                              <a
                                href={`https://www.google.com/maps?q=${c.siteLatitude},${c.siteLongitude}`}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-2 text-xs text-primary hover:underline"
                              >
                                Open map
                              </a>
                            )}
                          </>,
                        ],
                      ] as [string, React.ReactNode][])
                    : []),
                ]}
              />
            </div>
            {c.attachments.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-2">
                {c.attachments.map((a) => (
                  <li key={a.id}>
                    <a href={a.url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- uploaded file, size unknown */}
                      <img src={a.url} alt={a.fileName} className="size-20 rounded-lg border border-border object-cover" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <TimelineCard items={timeline(c)} limit={5} />

          <Card title="Customer">
            <KvList
              items={[
                [
                  "Name",
                  <>
                    {customers.canView ? (
                      <Link href={`${CUSTOMER_PATHS.database}/${c.customer.id}`} className="font-medium text-primary hover:underline">
                        {c.customer.name}
                      </Link>
                    ) : (
                      c.customer.name
                    )}
                    {c.customer.type === "BUSINESS" && (
                      <Badge tone="navy" className="ml-2">
                        B2B
                      </Badge>
                    )}
                  </>,
                ],
                ["Phone", `${formatPhone(c.customer.phone)} (key)`],
                ["Alt phone", c.customer.altPhone && formatPhone(c.customer.altPhone)],
                ["Email", c.customer.email],
                ["Visits", `${c.customer.visitCount} · paid ${formatPaise(extras.lifetimePaise)}${scope.branchId ? ` at ${c.branch.code}` : ""}`],
                ...(c.account ? ([["Account", c.account.name]] as [string, React.ReactNode][]) : []),
              ]}
            />
          </Card>

          <Card title="Record">
            <KvList
              items={[
                ["Created", `${formatDateTime(c.createdAt)} · ${personName(c.createdBy) ?? "System"}`],
                ["Last updated", `${formatDateTime(c.updatedAt)} · ${personName(c.updatedBy) ?? "System"}`],
                ["In stage since", formatDateTime(c.stageChangedAt)],
              ]}
            />
          </Card>

          {waMessages.length > 0 && (
            <Card title="WhatsApp messages">
              <ul className="divide-y divide-border">
                {waMessages.map((m) => {
                  const tpl = WA_TEMPLATE_MAP.get(m.templateName);
                  const statusTone =
                    m.status === "SENT" ? "success" : m.status === "FAILED" ? "danger" : "neutral";
                  return (
                    <li key={m.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{tpl?.label ?? m.templateName}</p>
                        <p className="text-text-muted text-xs mt-0.5">
                          {formatDateTime(m.createdAt)}
                          {m.createdBy && ` · ${[m.createdBy.firstName, m.createdBy.lastName].filter(Boolean).join(" ")}`}
                        </p>
                        {m.error && <p className="text-danger text-xs mt-0.5 truncate">{m.error}</p>}
                      </div>
                      <Badge tone={statusTone} className="shrink-0">{m.status}</Badge>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {(c.status === "CLOSED" || c.status === "CANCELLED") && (
            <Card
              title="Feedback"
              actions={
                permission.canEdit && (
                  <FeedbackDialog
                    action={saveCaseFeedback.bind(null, c.id)}
                    initial={c.feedback}
                  />
                )
              }
            >
              {c.feedback ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <svg
                          key={n}
                          className={`size-5 ${n <= c.feedback!.rating ? "text-yellow-400" : "text-border"}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                          aria-hidden
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="font-semibold text-sm">{c.feedback.rating}/5</span>
                    <Badge tone={CUSTOMER_BEHAVIOUR_TONE[c.feedback.customerBehaviour] as Parameters<typeof Badge>[0]["tone"]}>
                      {CUSTOMER_BEHAVIOUR_LABELS[c.feedback.customerBehaviour]}
                    </Badge>
                  </div>
                  {c.feedback.comment && (
                    <p className="text-sm text-text-muted whitespace-pre-wrap">{c.feedback.comment}</p>
                  )}
                  <p className="text-xs text-text-muted">
                    Recorded {formatDateTime(c.feedback.createdAt)}
                    {c.feedback.createdBy && ` · ${[c.feedback.createdBy.firstName, c.feedback.createdBy.lastName].filter(Boolean).join(" ")}`}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-text-muted">No feedback recorded yet.</p>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
