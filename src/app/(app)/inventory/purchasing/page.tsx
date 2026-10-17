import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton, buttonClass } from "@/components/ui/button";
import { FlashToast } from "@/components/feedback/flash-toast";
import { PageHeader } from "@/components/layout/page-header";
import { ListView } from "@/components/data/list-view";
import { listState } from "@/lib/list";
import { formatTat, tatTone } from "@/lib/tat";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Field, Textarea } from "@/components/ui/field";
import { formatDate as formatFullDate } from "@/lib/dates";
import { EntityForm, type FieldConfig } from "@/modules/admin/components/entity-form";
import { param } from "@/modules/admin/components/admin-page";
import { getBranchScope, listBranchOptions } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";
import { markRequestOrdered, markSpareUnavailable, raisePurchaseRequest } from "@/modules/inventory/actions/purchase";
import { updateReturnStatus } from "@/modules/inventory/actions/returns";
import { allocateUnit, allocateUnits } from "@/modules/inventory/actions/consume";
import { markUnitReceived } from "@/modules/inventory/actions/receive";
import { markReturnReceived } from "@/modules/inventory/actions/unit-returns";
import { vendorReplacementReturnReceived } from "@/modules/inventory/actions/vendor-replacements";
import { VR_STATUS_LABELS } from "@/modules/inventory/vendor-replacement-labels";
import { ActionButton } from "@/components/ui/action-button";
import { INVENTORY_PATHS } from "@/modules/inventory/paths";
import { isPurchaseManager } from "@/modules/inventory/purchase-access";
import { TransferDialog } from "@/modules/inventory/components/transfer-dialog";
import { TransferManyDialog } from "@/modules/inventory/components/transfer-many-dialog";
import { ReplacementTag, RequestDetails, ReturnDetails, UnitDetails, ViewButton } from "@/modules/inventory/components/purchasing-details";
import {
  countOpenItemReturns,
  listAllActiveItems,
  listAvailableUnits,
  listItemReturns,
  listPurchaseRequestsByStage,
  listUnitReturns,
  listVendorReturns,
  consumedUsidsFor,
  listTransferredUnits,
  purchasingCounts,
} from "@/modules/inventory/queries";

export const metadata = { title: "Purchasing" };

type Tone = NonNullable<Parameters<typeof Badge>[0]["tone"]>;

// One colour per status, used the same way on every tab (and in the details modals).
const PR_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "warning" },
  WITH_PM: { label: "Pending", tone: "warning" },
  APPROVED: { label: "Pending", tone: "warning" },
  SPARE_UNAVAILABLE: { label: "Spare not available", tone: "danger" },
  ORDERED: { label: "Ordered", tone: "primary" },
  TRANSFERRED: { label: "Transferred", tone: "indigo" },
  CONSUMED: { label: "Transferred", tone: "indigo" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(d);
}

function personName(u: { firstName: string; lastName?: string | null } | null) {
  if (!u) return null;
  return [u.firstName, u.lastName].filter(Boolean).join(" ");
}

const RETURN_STATUS: Record<string, { label: string; tone: "warning" | "primary" | "danger" | "success" }> = {
  REQUESTED: { label: "Requested", tone: "warning" },
  APPROVED: { label: "Approved", tone: "primary" },
  REJECTED: { label: "Rejected", tone: "danger" },
  COMPLETED: { label: "Completed", tone: "success" },
};

function StatusBadge({ status }: { status: string }) {
  const m = PR_STATUS[status] ?? { label: status, tone: "neutral" as Tone };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

/** Status of a transferred unit: in transit → received → consumed. */
function UnitStatusBadge({ status }: { status: string }) {
  return status === "ALLOCATED" ? (
    <Badge tone="warning">In transit</Badge>
  ) : status === "RECEIVED" ? (
    <Badge tone="navy">Received</Badge>
  ) : (
    <Badge tone="success">Consumed</Badge>
  );
}

/** Turnaround time as a badge: running ones go amber after a day and red after three; closed ones are grey. */
function Tat({ from, to }: { from: Date | null | undefined; to?: Date | null }) {
  return (
    <Badge tone={tatTone(from, to)} className="tabular-nums">
      <span title={to ? "Time taken" : "Time so far, still running"} className="inline-flex items-center gap-1">
        <Clock className="size-3" />
        {formatTat(from, to ?? undefined)}
      </span>
    </Badge>
  );
}

function Photos({ files }: { files: { id: string; url: string; fileName: string }[] }) {
  if (files.length === 0) return <span className="text-text-disabled">—</span>;
  return (
    <div className="flex gap-1">
      {files.slice(0, 3).map((a) => (
        <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element -- uploaded file, size unknown */}
          <img src={a.url} alt={a.fileName} className="size-10 rounded-md border border-border object-cover" />
        </a>
      ))}
      {files.length > 3 && <span className="self-center text-xs text-text-muted">+{files.length - 3}</span>}
    </div>
  );
}

type RequestRow = Awaited<ReturnType<typeof listPurchaseRequestsByStage>>["rows"][number];
type ReturnRow = Awaited<ReturnType<typeof listItemReturns>>["rows"][number];
type UnitRow = Awaited<ReturnType<typeof listTransferredUnits>>["rows"][number];

/** Marks a defective unit that came back from the vendor with the same USID (no new purchase). */
function VendorReplacementBadge() {
  return (
    <Badge tone="violet" className="mt-1">
      Vendor Replacement
    </Badge>
  );
}

const TAB_KEYS = ["", "ordered", "unavailable", "transferred", "returns", "warranty", "consumed"] as const;
type TabKey = (typeof TAB_KEYS)[number];

export default async function PurchasingPage({ searchParams }: PageProps<"/inventory/purchasing">) {
  const { permission, user } = await requirePageAccess(INVENTORY_PATHS.purchasing);
  // The Head Office Purchase Manager (and admins) run the whole flow. Branch users see the same tabs for their
  // own branch only: they confirm receipt of transferred units and mark received units as consumed.
  const isPM = isPurchaseManager(user);
  const isBranchUser = !isPM && user.privilege.isBranchBound && Boolean(user.branchId);
  if (!isPM && !isBranchUser) redirect("/forbidden");
  const sp = await searchParams;
  const list = listState(INVENTORY_PATHS.purchasing, sp, { sorts: ["createdAt"] as const, defaultSort: "createdAt" });
  const action = param(sp, "action");
  const saved = param(sp, "saved");
  const preItemId = param(sp, "itemId");

  // Branch users are always scoped to their own branch; the Purchase Manager follows the header switcher.
  const scope = await getBranchScope(user);
  const canApprove = permission.canApprove;
  const canCreate = permission.canCreate;
  const canEdit = permission.canEdit;

  const requested: TabKey = (TAB_KEYS as readonly string[]).includes(list.tab) ? (list.tab as TabKey) : "";
  // Branches have no Ordered tab: that stage is the Purchase Manager’s.
  const tab: TabKey = isBranchUser && requested === "ordered" ? "" : requested;
  const returnKind = tab === "returns" ? "RETURN" : tab === "warranty" ? "WARRANTY_CLAIM" : null;

  const noRequests = { rows: [] as RequestRow[], total: 0 };
  const noReturns = { rows: [] as ReturnRow[], total: 0 };
  const noUnits = { rows: [] as UnitRow[], total: 0 };
  const vendorReturns = tab === "returns" ? await listVendorReturns(scope.branchId) : [];
  const unitReturns = tab === "returns" ? await listUnitReturns(scope.branchId) : { rows: [], replacementOf: new Map<string, { code: string; status: string; units: { usid: string; status: string }[] }>() };
  const [counts, openReturns, requests, returns, units, allItems, branchOptions, availableUnits] = await Promise.all([
    purchasingCounts(scope.branchId),
    countOpenItemReturns(scope.branchId),
    tab === "" || tab === "ordered" || tab === "unavailable" ? listPurchaseRequestsByStage(list, tab === "ordered" ? "ordered" : tab === "unavailable" ? "unavailable" : "requests", scope.branchId) : Promise.resolve(noRequests),
    returnKind ? listItemReturns(tab === "returns" ? { ...list, page: 1, pageSize: 200 } : list, returnKind, scope.branchId) : Promise.resolve(noReturns),
    tab === "transferred"
      ? listTransferredUnits(list, scope.branchId, ["ALLOCATED"])
      : tab === "consumed"
        ? listTransferredUnits(list, scope.branchId, ["RECEIVED", "CONSUMED"])
        : Promise.resolve(noUnits),
    isPM && tab === "" ? listAllActiveItems() : Promise.resolve([]),
    isPM && tab === "" ? listBranchOptions() : Promise.resolve([]),
    isPM && canEdit && tab === "ordered" ? listAvailableUnits() : Promise.resolve([]),
  ]);
  // Returns tab: parts returned before the case closed (USID returns) and after it closed share one table.
  const closedUsids = tab === "returns" ? await consumedUsidsFor(returns.rows.map((r) => ({ caseId: r.case.id, itemId: r.caseItem.itemId }))) : new Map<string, string>();

  const branchField: FieldConfig[] = scope.branchId
    ? []
    : [{ name: "branchId", label: "Branch", type: "select" as const, required: true, options: branchOptions.map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` })) }];

  const itemOptions = allItems.map((i) => ({ value: i.id, label: `${i.code} — ${i.name}` }));

  const purchaseRequestFields: FieldConfig[] = [
    ...branchField,
    { name: "itemId", label: "Item", type: "select", searchable: true, placeholder: "Select item", required: true, options: itemOptions },
    { name: "notes", label: "Notes", type: "textarea", span: 2, placeholder: "Urgency, specs, or any context…" },
  ];

  const caseLink = (c: { id: string; jobsheetNo: string } | null) =>
    c ? (
      <Link href={`/service/cases/${c.id}`} className="text-sm font-medium text-primary hover:underline">
        {c.jobsheetNo}
      </Link>
    ) : (
      <span className="text-text-disabled">—</span>
    );

  // The request tables share their columns; Requests and Ordered differ in the action and the clock.
  const requestColumns = (stage: "requests" | "ordered") => [
    { header: "#", cell: (_: RequestRow, i: number) => i + 1 },
    {
      header: "Item",
      cell: (pr: RequestRow) => (
        <>
          <p className="font-medium text-sm">{pr.item.name}</p>
          {pr.quantity > 1 && (
            <p className="text-xs text-text-muted">
              Qty <span className="font-semibold text-text">{pr.quantity}</span>
              {pr.consumedQty > 0 && <> · {pr.consumedQty} transferred</>}
            </p>
          )}
          {pr.isReplacement && (
            <div className="mt-1 space-y-0.5">
              <ReplacementTag />
              <p className="max-w-64 truncate text-xs text-text-muted" title={pr.replacementReason ?? undefined}>
                {pr.replacementReason}
              </p>
              <p className="text-[11px] text-text-muted">
                Confirmed by {personName(pr.replacementConfirmedBy) ?? "—"}
                {pr.replacementConfirmedAt && <> · {formatDate(pr.replacementConfirmedAt)}</>}
              </p>
            </div>
          )}
          {pr.stockUnits.map((u) => (
            <p key={u.id} className="text-xs text-text-muted">
              <span className="font-medium text-text">{u.usid}</span> · {u.item.name}
              {u.allocatedCase && <> → {u.allocatedCase.jobsheetNo}</>}
              {u.status === "ALLOCATED" ? <span className="text-warning"> · Awaiting receipt</span> : <span className="text-success"> · Received {u.receivedAt ? formatDate(u.receivedAt) : ""}</span>}
            </p>
          ))}
        </>
      ),
    },
    { header: "Case ID", cell: (pr: RequestRow) => caseLink(pr.case) },
    { header: "Code", cell: (pr: RequestRow) => <span className="text-xs text-text-muted tabular-nums">{pr.code}</span> },
    {
      header: "Branch",
      // The part is for the case's branch, even when another branch (e.g. the chip-level lab at Head Office) raised the request.
      cell: (pr: RequestRow) => {
        const target = pr.case?.branch ?? pr.branch;
        return (
          <span className="text-xs text-text-muted">
            {target.code} — {target.name}
            {target.code !== pr.branch.code && <span className="block text-[11px]">Raised by {pr.branch.code}</span>}
          </span>
        );
      },
    },
    {
      header: "Raised",
      cell: (pr: RequestRow) => (
        <span className="text-xs text-text-muted">{formatDate(pr.createdAt)}</span>
      ),
    },
    ...(stage === "ordered"
      ? [{ header: "Ordered", cell: (pr: RequestRow) => <span className="text-xs text-text-muted">{pr.orderedAt ? formatDate(pr.orderedAt) : "—"}</span> }]
      : []),
    {
      header: "Status",
      cell: (pr: RequestRow) => {
        const isSlaBreached = pr.slaBreachAt && pr.slaBreachAt < new Date();
        return isSlaBreached ? (
          <Badge tone="danger">
            <Clock className="size-3" /> SLA breach
          </Badge>
        ) : (
          <StatusBadge status={pr.status} />
        );
      },
    },
    {
      // Requests: time since raised. Ordered: time since it was ordered.
      header: "TAT",
      cell: (pr: RequestRow) => <Tat from={stage === "ordered" ? (pr.orderedAt ?? pr.createdAt) : pr.createdAt} />,
    },
    {
      header: isBranchUser ? "View" : "Actions",
      align: "center" as const,
      cell: (pr: RequestRow) => (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <ViewButton title={pr.item.name} subtitle={`Purchase request ${pr.code}`}>
            <RequestDetails pr={pr} status={<StatusBadge status={pr.status} />} />
          </ViewButton>
          {isPM && canEdit && stage === "requests" && (
            <>
              <form action={markRequestOrdered.bind(null, pr.id)}>
                <button type="submit" className={buttonClass("primary", "sm")}>Mark as ordered</button>
              </form>
              {pr.status !== "SPARE_UNAVAILABLE" && (
                <ActionDialog
                  trigger="Spare not available"
                  triggerVariant="secondary"
                  triggerSize="sm"
                  title="Spare not available"
                  description={`${pr.item.name} · ${pr.branch.code}. The branch will see this status on the request.`}
                  action={markSpareUnavailable.bind(null, pr.id)}
                  submitLabel="Mark as not available"
                >
                  <Field label="Remarks" htmlFor={`spare-${pr.id}`} hint="Optional, e.g. discontinued or supplier out of stock.">
                    <Textarea id={`spare-${pr.id}`} name="remarks" rows={3} placeholder="Enter remarks" />
                  </Field>
                </ActionDialog>
              )}
            </>
          )}
          {isPM && canEdit && stage === "ordered" && availableUnits.filter((u) => u.itemId === pr.item.id).length < pr.quantity - pr.consumedQty && (
            <Badge tone="neutral">
              {pr.quantity - pr.consumedQty > 1
                ? `Need ${pr.quantity - pr.consumedQty} in stock (${availableUnits.filter((u) => u.itemId === pr.item.id).length} available)`
                : "No stock"}
            </Badge>
          )}
          {isPM && canEdit && stage === "ordered" && pr.quantity - pr.consumedQty > 1 && availableUnits.filter((u) => u.itemId === pr.item.id).length >= pr.quantity - pr.consumedQty && (
            <TransferManyDialog
              requestedItemName={pr.item.name}
              remaining={pr.quantity - pr.consumedQty}
              units={availableUnits.filter((u) => u.itemId === pr.item.id).map((u) => ({
                id: u.id,
                usid: u.usid,
                itemId: u.itemId,
                itemName: u.item.name,
                billNo: u.billItem?.bill.billNo ?? null,
                location: u.branch.code,
              }))}
              action={allocateUnits.bind(null, pr.id)}
            />
          )}
          {isPM && canEdit && stage === "ordered" && pr.quantity - pr.consumedQty <= 1 && availableUnits.some((u) => u.itemId === pr.item.id) && (
            <TransferDialog
              requestedItemId={pr.item.id}
              requestedItemName={pr.item.name}
              // Only USIDs of the requested item can go to this case.
              units={availableUnits.filter((u) => u.itemId === pr.item.id).map((u) => ({
                id: u.id,
                usid: u.usid,
                itemId: u.itemId,
                itemName: u.item.name,
                billNo: u.billItem?.bill.billNo ?? null,
                location: u.branch.code,
              }))}
              action={allocateUnit.bind(null, pr.id)}
            />
          )}
        </div>
      ),
    },
  ];

  const unitCommon = [
    { header: "#", cell: (_: UnitRow, i: number) => i + 1 },
    { header: "USID", cell: (u: UnitRow) => <span className="font-medium tabular-nums">{u.usid}</span> },
    {
      header: "Item",
      cell: (u: UnitRow) => (
        <>
          <p className="text-sm font-medium">{u.item.name}</p>
          <p className="text-xs text-text-muted">{u.item.code}</p>
          {u.vendorReplacements.length > 0 && <VendorReplacementBadge />}
        </>
      ),
    },
    { header: "Case ID", cell: (u: UnitRow) => caseLink(u.allocatedCase) },
    { header: "Photos", cell: (u: UnitRow) => <Photos files={u.attachments} /> },
    ...(isPM
      ? [{ header: "Branch", cell: (u: UnitRow) => <span className="text-xs text-text-muted">{u.allocatedBranch ? `${u.allocatedBranch.code} — ${u.allocatedBranch.name}` : "—"}</span> }]
      : []),
  ];

  // Branches see Requests · Received · Returns · Warranty · Consumed. Only Received has actions (confirm receipt).
  const tabs = [
    { key: "", label: "Requests", count: counts.requests },
    ...(isBranchUser ? [] : [{ key: "ordered", label: "Ordered", count: counts.ordered }]),
    { key: "transferred", label: isBranchUser ? "Received" : "Transferred", count: counts.inTransit },
    { key: "returns", label: "Returns", count: openReturns.returns + counts.unitReturns },
    { key: "warranty", label: "Warranty", count: openReturns.warranty },
    { key: "consumed", label: "Consumed", count: counts.notConsumed },
    { key: "unavailable", label: "Spare not available", count: counts.unavailable },
  ];

  type UnitReturnRow = (typeof unitReturns.rows)[number];
  type VendorReturnRow = (typeof vendorReturns)[number];
  type ReturnsRow = {
    key: string;
    at: Date;
    usid: string | null;
    itemName: string;
    itemCode: string;
    caseRef: { id: string; jobsheetNo: string } | null;
    customer: string | null;
    branch: string | null;
    photos: { id: string; url: string; fileName: string }[];
  } & (
    | { kind: "CASE"; u: UnitReturnRow }
    | { kind: "VENDOR"; v: VendorReturnRow }
    | { kind: "CLOSED"; r: ReturnRow }
  );
  const returnsText = (row: ReturnsRow) => [row.usid, row.itemName, row.itemCode, row.caseRef?.jobsheetNo, row.customer].join(" ").toLowerCase();
  const branchLabel = (b: { code: string; name: string } | null | undefined) => (b ? `${b.code} — ${b.name}` : null);
  const needle = list.q.toLowerCase();
  const unified: ReturnsRow[] =
    tab === "returns"
      ? [
          ...unitReturns.rows.map(
            (u): ReturnsRow => ({ key: `u-${u.id}`, at: u.returnedAt ?? new Date(0), usid: u.usid, itemName: u.item.name, itemCode: u.item.code, caseRef: u.allocatedCase, customer: u.allocatedCase?.customer.name ?? null, branch: branchLabel(u.allocatedBranch), photos: u.attachments, kind: "CASE", u }),
          ),
          ...vendorReturns.map(
            (v): ReturnsRow => ({ key: `v-${v.id}`, at: v.requestedAt, usid: v.unit.usid, itemName: v.item.name, itemCode: v.item.code, caseRef: v.case, customer: v.case?.customer.name ?? null, branch: branchLabel(v.branch), photos: v.unit.attachments, kind: "VENDOR", v }),
          ),
          ...returns.rows.map(
            (r): ReturnsRow => ({ key: `r-${r.id}`, at: r.createdAt, usid: closedUsids.get(`${r.case.id}:${r.caseItem.itemId}`) ?? null, itemName: r.caseItem.name, itemCode: r.caseItem.code, caseRef: r.case, customer: r.case.customer.name, branch: branchLabel(r.case.branch), photos: r.attachments, kind: "CLOSED", r }),
          ),
        ]
          .filter((row) => !needle || returnsText(row).includes(needle))
          .sort((a, b) => b.at.getTime() - a.at.getTime())
      : [];
  const unifiedPage = unified.slice((list.page - 1) * list.pageSize, list.page * list.pageSize);

  return (
    <>
      <FlashToast flag={saved} message="Saved successfully." />
      <PageHeader
        title="Purchasing"
        subtitle={
          isBranchUser
            ? `Requests and items for ${user.branch?.name ?? "your branch"}`
            : scope.branch
              ? `Branch: ${scope.branch.name}`
              : scope.canSwitch
                ? "Select a branch in the header to filter"
                : undefined
        }
        breadcrumbs={["Inventory", "Purchasing"]}
        actions={
          isPM && canCreate && tab === "" && (
            <LinkButton href={`${INVENTORY_PATHS.purchasing}?action=purchase-request`}>
              <Plus className="size-4" /> Raise request
            </LinkButton>
          )
        }
      />

      {/* Inline purchase request form */}
      {action === "purchase-request" && isPM && canCreate && tab === "" && (
        <div className="mb-6 rounded-xl border border-border bg-surface p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Raise purchase request</h2>
            <LinkButton href={INVENTORY_PATHS.purchasing} variant="secondary">Cancel</LinkButton>
          </div>
          <EntityForm
            fields={purchaseRequestFields}
            schema="purchaseRequest"
            action={raisePurchaseRequest}
            initial={preItemId ? { itemId: preItemId } : {}}
            submitLabel="Raise request"
          />
        </div>
      )}

      {/* Requests · Ordered */}
      {(tab === "" || tab === "ordered" || tab === "unavailable") && (
        <ListView
          list={list}
          total={requests.total}
          tabs={tabs}
          tone="blue"
          rows={requests.rows}
          rowKey={(pr) => pr.id}
          searchPlaceholder="Search by item, model, case ID or code"
          empty={
            tab === "ordered"
              ? "Nothing is waiting to be transferred. Mark a request as ordered first."
              : tab === "unavailable"
                ? "No spares are marked as not available."
                : "No purchase requests waiting to be ordered."
          }
          columns={requestColumns(tab === "ordered" ? "ordered" : "requests")}
        />
      )}

      {/* Warranty claims (returns of products from closed cases under warranty) */}
      {returnKind === "WARRANTY_CLAIM" && (
        <ListView
          list={list}
          total={returns.total}
          tabs={tabs}
          tone="blue"
          rows={returns.rows}
          rowKey={(r) => r.id}
          searchPlaceholder="Search by product, case ID or customer"
          empty="No warranty claims yet. They appear here when a product is returned for a fault inside its warranty."
            columns={[
              { header: "#", cell: (_, i) => i + 1 },
              {
                header: "Product",
                cell: (r) => (
                  <>
                    <p className="text-sm font-medium">{r.caseItem.name}</p>
                    <p className="text-xs text-text-muted">{r.caseItem.code}</p>
                  </>
                ),
              },
              {
                header: "Case",
                cell: (r) => (
                  <Link href={`/service/cases/${r.case.id}`} className="text-sm font-medium text-primary hover:underline">
                    {r.case.jobsheetNo}
                  </Link>
                ),
              },
              { header: "Customer", cell: (r) => r.case.customer.name },
              { header: "Branch", cell: (r) => <span className="text-xs text-text-muted">{r.case.branch.code}</span> },
              { header: "Reason", cell: (r) => <p className="max-w-xs whitespace-pre-wrap break-words text-sm">{r.notes}</p> },
              { header: "Photos", cell: (r) => <Photos files={r.attachments} /> },
              ...(returnKind === "WARRANTY_CLAIM"
                ? [
                    {
                      header: "Warranty until",
                      cell: (r: ReturnRow) => formatFullDate(r.warrantyEndsAt),
                    },
                  ]
                : []),
              {
                header: "Raised",
                cell: (r) => (
                  <span className="text-xs text-text-muted">
                    {formatFullDate(r.createdAt)}
                    {r.createdBy && <> · {personName(r.createdBy)}</>}
                  </span>
                ),
              },
              {
                header: "Status",
                cell: (r) => (
                  <>
                    <Badge tone={RETURN_STATUS[r.status]!.tone}>{RETURN_STATUS[r.status]!.label}</Badge>
                    {r.reviewedBy && r.status !== "REQUESTED" && (
                      <p className="mt-1 text-xs text-text-muted">
                        {personName(r.reviewedBy)}
                        {r.reviewedAt && ` · ${formatDate(r.reviewedAt)}`}
                      </p>
                    )}
                  </>
                ),
              },
              {
                // Waiting for a decision: time since raised, still running. Decided: raised → decision.
                header: "TAT",
                cell: (r) => (r.status === "REQUESTED" || !r.reviewedAt ? <Tat from={r.createdAt} /> : <Tat from={r.createdAt} to={r.reviewedAt} />),
              },
              {
                header: isBranchUser ? "View" : "Actions",
                align: "center",
                cell: (r) => (
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    <ViewButton title={r.caseItem.name} subtitle={`Case ${r.case.jobsheetNo}`}>
                      <ReturnDetails r={r} status={<Badge tone={RETURN_STATUS[r.status]!.tone}>{RETURN_STATUS[r.status]!.label}</Badge>} />
                    </ViewButton>
                    {isPM && canApprove && r.status === "REQUESTED" && (
                      <>
                        <form action={updateReturnStatus.bind(null, r.id, "APPROVED")}>
                          <button type="submit" className={buttonClass("success", "sm")}>Approve</button>
                        </form>
                        <form action={updateReturnStatus.bind(null, r.id, "REJECTED")}>
                          <button type="submit" className={buttonClass("danger", "sm")}>Reject</button>
                        </form>
                      </>
                    )}
                    {isPM && canEdit && r.status === "APPROVED" && (
                      <form action={updateReturnStatus.bind(null, r.id, "COMPLETED")}>
                        <button type="submit" className={buttonClass("primary", "sm")}>Mark completed</button>
                      </form>
                    )}
                  </div>
                ),
              },
            ]}
        />
      )}

      {/* Returns: every returned item in one table, before and after the case closed */}
      {tab === "returns" && (
        <ListView
          list={list}
          total={unified.length}
          tabs={tabs}
          tone="blue"
          rows={unifiedPage}
          rowKey={(row) => row.key}
          searchPlaceholder="Search by USID, product, case ID or customer"
          empty="No returns yet. Items returned from a case, before or after it closes, appear here."
          columns={[
            { header: "#", cell: (_, i) => i + 1 },
            { header: "USID", cell: (row) => (row.usid ? <span className="font-medium tabular-nums">{row.usid}</span> : <span className="text-text-disabled">—</span>) },
            {
              header: "Item",
              cell: (row) => (
                <>
                  <p className="text-sm font-medium">{row.itemName}</p>
                  <p className="text-xs text-text-muted">{row.itemCode}</p>
                </>
              ),
            },
            { header: "Case ID", cell: (row) => caseLink(row.caseRef) },
            { header: "Customer", cell: (row) => row.customer ?? "—" },
            { header: "Branch", cell: (row) => <span className="text-xs text-text-muted">{row.branch ?? "—"}</span> },
            {
              // Before the case closed (stock units, vendor replacements) or after it (customer returns).
              header: "Return type",
              cell: (row) => (row.kind === "CLOSED" ? <Badge tone="navy">After case closure</Badge> : <Badge tone="warning">Before case closure</Badge>),
            },
            {
              header: "Reason",
              cell: (row) =>
                row.kind === "CLOSED" ? (
                  <p className="max-w-52 whitespace-pre-wrap break-words text-sm">{row.r.notes}</p>
                ) : row.kind === "VENDOR" ? (
                  <>
                    <span className="flex flex-wrap gap-1">
                      <Badge tone="warning">Defective / Not working</Badge>
                      <VendorReplacementBadge />
                    </span>
                    <p className="mt-1 max-w-52 truncate text-xs text-text-muted" title={row.v.remarks ?? undefined}>{row.v.remarks ?? "—"}</p>
                  </>
                ) : (
                  <>
                    <Badge tone="danger">Courier / Branch damage</Badge>
                    <p className="mt-1 max-w-52 truncate text-xs text-text-muted" title={row.u.returnRemarks ?? undefined}>{row.u.returnRemarks ?? "—"}</p>
                  </>
                ),
            },
            { header: "Photos", cell: (row) => <Photos files={row.photos} /> },
            {
              header: "Raised",
              cell: (row) => (
                <span className="text-xs text-text-muted">
                  {formatFullDate(row.at)}
                  {row.kind === "CLOSED" && row.r.createdBy && <> · {personName(row.r.createdBy)}</>}
                </span>
              ),
            },
            {
              // Return status: the returned item is on its way to Head Office until the Purchase Head confirms receipt.
              header: "Status",
              cell: (row) => {
                if (row.kind === "CLOSED") {
                  const r = row.r;
                  return (
                    <>
                      <Badge tone={RETURN_STATUS[r.status]!.tone}>{RETURN_STATUS[r.status]!.label}</Badge>
                      {r.reviewedBy && r.status !== "REQUESTED" && (
                        <p className="mt-1 text-xs text-text-muted">
                          {personName(r.reviewedBy)}
                          {r.reviewedAt && ` · ${formatDate(r.reviewedAt)}`}
                        </p>
                      )}
                    </>
                  );
                }
                const received = row.kind === "CASE" ? row.u.returnReceivedAt : row.v.returnReceivedAt;
                return received ? (
                  <>
                    <Badge tone="navy">Received at HO</Badge>
                    <p className="mt-1 text-xs text-text-muted">{formatFullDate(received)}</p>
                  </>
                ) : (
                  <Badge tone="warning">In transit to HO</Badge>
                );
              },
            },
            {
              // The replacement and its transfer: tracked on its own, never waiting for the returned item to arrive.
              header: "Replacement",
              cell: (row) => {
                if (row.kind === "CLOSED") return <span className="text-text-disabled">—</span>;
                if (row.kind === "VENDOR") {
                  const v = row.v;
                  return (
                    <>
                      <p className="text-xs">
                        <span className="font-medium">{v.code}</span> · {VR_STATUS_LABELS[v.status]}
                      </p>
                      <p className="text-xs text-text-muted">Same USID reused · no new purchase</p>
                      {v.vendorName && <p className="text-xs text-text-muted">Vendor: {v.vendorName}</p>}
                    </>
                  );
                }
                const rep = row.u.purchaseRequest ? unitReturns.replacementOf.get(row.u.purchaseRequest.id) : undefined;
                const sent = rep?.units[0];
                return rep ? (
                  <>
                    <p className="text-xs">
                      <span className="font-medium">{rep.code}</span> · {PR_STATUS[rep.status]?.label ?? rep.status}
                    </p>
                    {sent ? (
                      <p className="text-xs text-text-muted">
                        <span className="font-medium tabular-nums text-text">{sent.usid}</span> · {sent.status === "ALLOCATED" ? "In transit to branch" : "Received by branch"}
                      </p>
                    ) : (
                      <p className="text-xs text-text-muted">Not transferred yet</p>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-text-muted">No replacement requested</span>
                );
              },
            },
            {
              header: "TAT",
              cell: (row) =>
                row.kind === "CASE" ? (
                  <Tat from={row.u.returnedAt} to={row.u.returnReceivedAt} />
                ) : row.kind === "VENDOR" ? (
                  <Tat from={row.v.requestedAt} to={row.v.returnReceivedAt} />
                ) : row.r.status === "REQUESTED" || !row.r.reviewedAt ? (
                  <Tat from={row.r.createdAt} />
                ) : (
                  <Tat from={row.r.createdAt} to={row.r.reviewedAt} />
                ),
            },
            {
              header: isBranchUser ? "View" : "Actions",
              align: "center",
              cell: (row) => {
                if (row.kind === "CLOSED") {
                  const r = row.r;
                  return (
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      <ViewButton title={r.caseItem.name} subtitle={`Case ${r.case.jobsheetNo}`}>
                        <ReturnDetails r={r} status={<Badge tone={RETURN_STATUS[r.status]!.tone}>{RETURN_STATUS[r.status]!.label}</Badge>} />
                      </ViewButton>
                      {isPM && canApprove && r.status === "REQUESTED" && (
                        <>
                          <form action={updateReturnStatus.bind(null, r.id, "APPROVED")}>
                            <button type="submit" className={buttonClass("success", "sm")}>Approve</button>
                          </form>
                          <form action={updateReturnStatus.bind(null, r.id, "REJECTED")}>
                            <button type="submit" className={buttonClass("danger", "sm")}>Reject</button>
                          </form>
                        </>
                      )}
                      {isPM && canEdit && r.status === "APPROVED" && (
                        <form action={updateReturnStatus.bind(null, r.id, "COMPLETED")}>
                          <button type="submit" className={buttonClass("primary", "sm")}>Mark completed</button>
                        </form>
                      )}
                    </div>
                  );
                }
                const unit = row.kind === "CASE" ? row.u : row.v.unit;
                const received = row.kind === "CASE" ? row.u.returnReceivedAt : row.v.returnReceivedAt;
                const receive = row.kind === "CASE" ? markReturnReceived.bind(null, row.u.id) : vendorReplacementReturnReceived.bind(null, row.v.id);
                return (
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    <ViewButton title={unit.usid} subtitle={unit.item.name}>
                      <UnitDetails u={unit} status={<Badge tone={row.kind === "VENDOR" ? "violet" : "danger"}>{row.kind === "VENDOR" ? "Vendor Replacement" : "Returned (damaged)"}</Badge>} />
                    </ViewButton>
                    {isPM && canEdit && !received && (
                      <ActionButton action={receive} label="Receive returned item" className={buttonClass("success", "sm")}>
                        Receive
                      </ActionButton>
                    )}
                    {isPM && row.kind === "VENDOR" && (
                      <LinkButton href={INVENTORY_PATHS.vendorReplacements} variant="secondary" size="sm">
                        Vendor replacement
                      </LinkButton>
                    )}
                  </div>
                );
              },
            },
          ]}
        />
      )}

      {/* Transferred: every unit sent to a branch case, with its transfer status */}
      {tab === "transferred" && (
        <ListView
          list={list}
          total={units.total}
          tabs={tabs}
          tone="blue"
          rows={units.rows}
          rowKey={(u) => u.id}
          searchPlaceholder="Search by USID, item or case ID"
          empty={isBranchUser ? "Nothing is waiting to be received. Received items move to the Consumed tab." : "No transfers are waiting for receipt. Received items move to the Consumed tab."}
          columns={[
            ...unitCommon,
            {
              header: "Transferred on",
              cell: (u) => (
                <span className="text-xs text-text-muted">
                  {u.allocatedAt ? formatFullDate(u.allocatedAt) : "—"}
                  {u.allocatedBy && <> · {personName(u.allocatedBy)}</>}
                </span>
              ),
            },
            {
              header: isBranchUser ? "Receipt status" : "Transfer status",
              cell: (u) =>
                u.status === "ALLOCATED" ? (
                  <>
                    <UnitStatusBadge status="ALLOCATED" />
                    <p className="mt-1 text-xs text-text-muted">Awaiting receipt</p>
                  </>
                ) : (
                  <>
                    <UnitStatusBadge status={u.status === "CONSUMED" ? "RECEIVED" : u.status} />
                    <p className="mt-1 text-xs text-text-muted">
                      {u.receivedAt && formatFullDate(u.receivedAt)}
                      {u.receivedBy && <> · {personName(u.receivedBy)}</>}
                    </p>
                  </>
                ),
            },
            {
              // Transfer → receipt: running while in transit, fixed once received.
              header: "TAT",
              cell: (u) => (u.status === "ALLOCATED" ? <Tat from={u.allocatedAt} /> : <Tat from={u.allocatedAt} to={u.receivedAt} />),
            },
            {
              header: "Actions",
              align: "center",
              cell: (u) => (
                <div className="flex items-center justify-center gap-1.5">
                  <ViewButton title={u.usid} subtitle={u.item.name}>
                    <UnitDetails u={u} status={<UnitStatusBadge status={u.status} />} />
                  </ViewButton>
                  {isBranchUser && canEdit && u.status === "ALLOCATED" && (
                    <form action={markUnitReceived.bind(null, u.id)}>
                      <button type="submit" className={buttonClass("success", "sm")}>Mark as Received</button>
                    </form>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}

      {/* Consumed: received by the branch, and used (or still waiting to be used) */}
      {tab === "consumed" && (
        <ListView
          list={list}
          total={units.total}
          tabs={tabs}
          tone="blue"
          rows={units.rows}
          rowKey={(u) => u.id}
          searchPlaceholder="Search by USID, item or case ID"
          empty="No received items yet. A unit is consumed when its case is closed."
          columns={[
            ...unitCommon,
            {
              header: "Received on",
              cell: (u) => (
                <span className="text-xs text-text-muted">
                  {u.receivedAt ? formatFullDate(u.receivedAt) : "—"}
                  {u.receivedBy && <> · {personName(u.receivedBy)}</>}
                </span>
              ),
            },
            {
              header: "Status",
              cell: (u) =>
                u.status === "CONSUMED" ? (
                  <>
                    <UnitStatusBadge status="CONSUMED" />
                    <p className="mt-1 text-xs text-text-muted">
                      {u.consumedAt && formatFullDate(u.consumedAt)}
                      {u.consumedBy && <> · {personName(u.consumedBy)}</>}
                    </p>
                  </>
                ) : (
                  <>
                    <UnitStatusBadge status="RECEIVED" />
                    <p className="mt-1 text-xs text-text-muted">Consumed when the case closes</p>
                  </>
                ),
            },
            {
              // Received → consumed: running while it sits unused in the branch.
              header: "TAT",
              cell: (u) => (u.status === "CONSUMED" ? <Tat from={u.receivedAt} to={u.consumedAt} /> : <Tat from={u.receivedAt} />),
            },
            {
              header: isBranchUser ? "View" : "Actions",
              align: "center",
              cell: (u) => (
                <div className="flex items-center justify-center gap-1.5">
                  <ViewButton title={u.usid} subtitle={u.item.name}>
                    <UnitDetails u={u} status={<UnitStatusBadge status={u.status} />} />
                  </ViewButton>
                </div>
              ),
            },
          ]}
        />
      )}
    </>
  );
}
