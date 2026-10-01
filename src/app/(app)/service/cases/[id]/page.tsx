import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, FileText, Image as ImageIcon, IndianRupee, MessageCircle, Pencil, Send } from "lucide-react";
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
import { cancelCase, changeCaseStage, moveCaseToNextStage, revealDevicePassword, saveEstimate, submitDiagnosis } from "@/modules/service/actions/case";
import { sendWhatsAppTemplate } from "@/modules/service/actions/whatsapp";
import { quoteWhatsAppLink } from "@/server/notify/customer";
import { WA_TEMPLATE_MAP } from "@/server/notify/whatsapp-templates";
import { SendWhatsAppButton } from "@/modules/service/components/send-whatsapp-button";
import { db } from "@/server/db";
import { EstimateDialog } from "@/modules/service/components/estimate-dialog";
import { ITEM_TYPE_LABELS, ITEM_TYPE_TONE } from "@/modules/admin/item-schema";
import { StageActions } from "@/modules/service/components/stage-actions";
import { STAGE_ICONS } from "@/modules/service/components/stage-icons";
import {
  CASE_FLOW,
  CASE_KIND_LABELS,
  CASE_STATUS_LABELS,
  CASE_STATUS_TONE,
  ESTIMATE_EDITABLE,
  INTAKE_TYPE_LABELS,
  PAYMENT_MODE_LABELS,
  WARRANTY_LABELS,
  isOpenStatus,
  nextStage,
} from "@/modules/service/case-schema";
import { SERVICE_PATHS } from "@/modules/service/paths";
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

  const paid = c.payments.reduce((sum, p) => sum + p.amountPaise, 0);
  const subtotal = c.estimatedCostPaise;
  const due = subtotal === null ? null : Math.max(0, subtotal - paid);
  const device = [c.brand, c.model].filter(Boolean).join(" ");
  const next = nextStage(c.status);
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
  const estimateMode = !permission.canEdit ? null : c.status === "INTAKE" ? "start" : ESTIMATE_EDITABLE.includes(c.status) ? "edit" : null;
  const [catalog, staff] = estimateMode ? await Promise.all([listCatalogForPicker(), listBranchStaff(c.branchId)]) : [[], []];
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
        badges={<Badge tone={CASE_STATUS_TONE[c.status]}>{CASE_STATUS_LABELS[c.status]}</Badge>}
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
            {permission.canEdit && isOpenStatus(c.status) && (
              <StageActions
                jobsheetNo={c.jobsheetNo}
                status={c.status}
                next={next}
                moveNext={moveCaseToNextStage.bind(null, c.id)}
                changeStage={changeCaseStage.bind(null, c.id)}
                cancel={cancelCase.bind(null, c.id)}
                primary={
                  estimateMode === "start"
                    ? estimate
                    : c.status === "DIAGNOSIS" && c.estimatedCostPaise && permission.canEdit
                      ? (
                          <ActionButton
                            action={submitDiagnosis.bind(null, c.id)}
                            label="Send quote to customer"
                            className={buttonClass("navy")}
                          >
                            <Send className="size-4" /> Send quote to customer
                          </ActionButton>
                        )
                      : undefined
                }
              />
            )}
          </>
        }
      />

      <div className="mb-6 rounded-xl border border-border bg-surface px-4 py-5 shadow-sm">
        <StageRail
          stages={CASE_FLOW.map((s) => {
            const Icon = STAGE_ICONS[s];
            return { key: s, label: CASE_STATUS_LABELS[s], icon: <Icon />, caption: reached.has(s) ? formatShortDateTime(reached.get(s)) : undefined };
          })}
          current={cancelledFrom ?? c.status}
          stoppedLabel={c.status === "CANCELLED" ? "Cancelled" : undefined}
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1.65fr_1fr]">
        <div className="space-y-6">
          <Card
            title="Billable items"
            actions={
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-muted">Minimum selling price enforced per item</span>
                {estimateMode === "edit" && estimate}
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
                    </span>
                  ),
                },
                { header: "Code", cell: (l) => <span className="text-text-muted">{l.code}</span> },
                { header: "Qty", align: "center", cell: (l) => l.quantity },
                { header: "Min ₹", align: "right", cell: (l) => formatPaise(l.minPricePaise, { symbol: false }) },
                { header: "Billed ₹", align: "right", cell: (l) => <span className="font-semibold">{formatPaise(l.unitPricePaise, { symbol: false })}</span> },
                { header: "Total ₹", align: "right", cell: (l) => <span className="font-semibold">{formatPaise(l.lineTotalPaise, { symbol: false })}</span> },
                {
                  header: "Status",
                  cell: (l) => {
                    const off = discountPercent(l.listPricePaise, l.unitPricePaise);
                    return off > 0 ? <Badge tone="warning">{off}% discount</Badge> : <Badge tone="success">OK</Badge>;
                  },
                },
              ]}
            />
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
                  ["Engineer", personName(c.engineer) ?? "Unassigned"],
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
        </div>
      </div>
    </>
  );
}
