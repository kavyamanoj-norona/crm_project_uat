import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton, buttonClass } from "@/components/ui/button";
import { FlashToast } from "@/components/feedback/flash-toast";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/data/data-table";
import { FilterTabs } from "@/components/data/filter-tabs";
import { listState } from "@/lib/list";
import { EntityForm, type FieldConfig } from "@/modules/admin/components/entity-form";
import { param } from "@/modules/admin/components/admin-page";
import { getBranchScope, listBranchOptions } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";
import { raisePurchaseRequest, receiveStock } from "@/modules/inventory/actions/purchase";
import { updateReturnStatus } from "@/modules/inventory/actions/returns";
import { formatDate as formatFullDate } from "@/lib/dates";
import { INVENTORY_PATHS } from "@/modules/inventory/paths";
import { allocateUnit } from "@/modules/inventory/actions/consume";
import { markUnitReceived } from "@/modules/inventory/actions/receive";
import { isPurchaseManager } from "@/modules/inventory/purchase-access";
import { ListView } from "@/components/data/list-view";
import { ConsumeDialog } from "@/modules/inventory/components/consume-dialog";
import {
  countOpenItemReturns,
  listActivePurchaseRequests,
  listAllActiveItems,
  listAvailableUnits,
  listItemReturns,
  listBranchUnits,
} from "@/modules/inventory/queries";

export const metadata = { title: "Purchasing" };

const PR_LABELS: Record<string, string> = {
  PENDING: "Pending",
  WITH_PM: "With PM",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CONSUMED: "Consumed",
  PARTIAL: "Partly consumed",
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
  const cls =
    status === "APPROVED" ? "bg-info/10 text-info" :
    status === "REJECTED" ? "bg-danger/10 text-danger" :
    status === "WITH_PM" || status === "CONSUMED" ? "bg-success/10 text-success" :
    status === "PARTIAL" ? "bg-warning/10 text-warning" :
    "bg-surface-muted text-text-muted";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {PR_LABELS[status] ?? status}
    </span>
  );
}


export default async function PurchasingPage({ searchParams }: PageProps<"/inventory/purchasing">) {
  const { permission, user } = await requirePageAccess(INVENTORY_PATHS.purchasing);
  // The Head Office Purchase Manager (and admins) manage requests, returns and allocations;
  // branch users only see what was allocated to their branch and confirm receipt.
  const isPM = isPurchaseManager(user);
  const isBranchUser = !isPM && user.privilege.isBranchBound && Boolean(user.branchId);
  if (!isPM && !isBranchUser) redirect("/forbidden");
  const sp = await searchParams;
  const list = listState(INVENTORY_PATHS.purchasing, sp, { sorts: ["createdAt"] as const, defaultSort: "createdAt" });
  const action = param(sp, "action");
  const saved = param(sp, "saved");
  const preItemId = param(sp, "itemId");

  const scope = await getBranchScope(user);
  const canApprove = permission.canApprove;
  const canCreate = permission.canCreate;

  const tab = list.tab;
  const returnKind = isPM ? (tab === "returns" ? "RETURN" : tab === "warranty" ? "WARRANTY_CLAIM" : null) : null;
  const isRequestsTab = isPM && !returnKind;

  const [activeRequests, allItems, branchOptions, returnRows, openReturns, branchUnits, availableUnits] = await Promise.all([
    isPM ? listActivePurchaseRequests(scope.branchId) : Promise.resolve([]),
    isPM ? listAllActiveItems() : Promise.resolve([]),
    isPM ? listBranchOptions() : Promise.resolve([]),
    returnKind ? listItemReturns(returnKind, scope.branchId) : Promise.resolve([]),
    isPM ? countOpenItemReturns(scope.branchId) : Promise.resolve({ returns: 0, warranty: 0 }),
    // A branch user's list is filtered by their own branch, never by the URL.
    isBranchUser ? listBranchUnits(list, user.branchId!) : Promise.resolve({ rows: [], total: 0, awaiting: 0 }),
    isPM && permission.canEdit && isRequestsTab ? listAvailableUnits() : Promise.resolve([]),
  ]);

  const branchField: FieldConfig[] = scope.branchId
    ? []
    : [{ name: "branchId", label: "Branch", type: "select" as const, required: true, options: branchOptions.map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` })) }];

  const itemOptions = allItems.map((i) => ({ value: i.id, label: `${i.code} — ${i.name}` }));

  const purchaseRequestFields: FieldConfig[] = [
    ...branchField,
    { name: "itemId", label: "Item", type: "select", required: true, options: itemOptions },
    { name: "quantity", label: "Quantity", type: "number", required: true, placeholder: "Enter quantity" },
    { name: "notes", label: "Notes", type: "textarea", span: 2, placeholder: "Urgency, specs, or any context…" },
  ];

  const isRequests = isRequestsTab;

  return (
    <>
      <FlashToast flag={saved} message="Saved successfully." />
      <PageHeader
        title="Purchasing"
        subtitle={
          isBranchUser
            ? `Items allocated to ${user.branch?.name ?? "your branch"}`
            : scope.branch
              ? `Branch: ${scope.branch.name}`
              : scope.canSwitch
                ? "Select a branch in the header to filter"
                : undefined
        }
        breadcrumbs={["Inventory", "Purchasing"]}
        actions={
          isPM && canCreate && isRequests && (
            <LinkButton href={`${INVENTORY_PATHS.purchasing}?action=purchase-request`}>
              <Plus className="size-4" /> Raise request
            </LinkButton>
          )
        }
      />

      {/* Tabs */}
      <div className="mb-6">
        <FilterTabs
          list={list}
          tabs={
            isBranchUser
              ? [{ key: "", label: "Received", count: branchUnits.awaiting }]
              : [
                  { key: "", label: "Requests", count: activeRequests.length },
                  { key: "returns", label: "Returns", count: openReturns.returns },
                  { key: "warranty", label: "Warranty", count: openReturns.warranty },
                ]
          }
        />
      </div>

      {/* Inline purchase request form */}
      {action === "purchase-request" && isPM && canCreate && isRequests && (
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

      {/* Requests tab */}
      {isRequests && (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <DataTable
            rows={activeRequests}
            rowKey={(pr) => pr.id}
            bordered={false}
            empty="No active purchase requests."
            columns={[
              { header: "#", cell: (_, i) => i + 1 },
              {
                header: "Item",
                cell: (pr) => (
                  <>
                    <p className="font-medium text-sm">{pr.item.name}</p>
                    {pr.modelNo && <p className="text-xs text-text-muted">Model: <span className="font-medium text-text">{pr.modelNo}</span></p>}
                    {pr.stockUnits.map((u) => (
                      <p key={u.id} className="text-xs text-text-muted">
                        <span className="font-medium text-text">{u.usid}</span> · {u.item.name}
                        {u.allocatedCase && <> → {u.allocatedCase.jobsheetNo}</>}
                        {u.status === "RECEIVED" ? (
                          <span className="text-success"> · Received {formatDate(u.receivedAt!)}</span>
                        ) : (
                          <span className="text-warning"> · Awaiting receipt</span>
                        )}
                      </p>
                    ))}
                  </>
                ),
              },
              {
                header: "Photos",
                cell: (pr) =>
                  pr.attachments.length === 0 ? (
                    <span className="text-text-disabled">—</span>
                  ) : (
                    <div className="flex gap-1">
                      {pr.attachments.slice(0, 3).map((a) => (
                        <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element -- uploaded file, size unknown */}
                          <img src={a.url} alt={a.fileName} className="size-10 rounded-md border border-border object-cover" />
                        </a>
                      ))}
                      {pr.attachments.length > 3 && <span className="self-center text-xs text-text-muted">+{pr.attachments.length - 3}</span>}
                    </div>
                  ),
              },
              {
                header: "Case ID",
                cell: (pr) =>
                  pr.case ? (
                    <Link href={`/service/cases/${pr.case.id}`} className="text-sm font-medium text-primary hover:underline">
                      {pr.case.jobsheetNo}
                    </Link>
                  ) : (
                    <span className="text-text-disabled">—</span>
                  ),
              },
              {
                header: "Code",
                cell: (pr) => <span className="text-xs text-text-muted tabular-nums">{pr.code}</span>,
              },
              {
                header: "Branch",
                cell: (pr) => (
                  <span className="text-xs text-text-muted">
                    {pr.branch.code} — {pr.branch.name}
                  </span>
                ),
              },
              {
                header: "Raised",
                cell: (pr) => (
                  <span className="text-xs text-text-muted">
                    {formatDate(pr.createdAt)}
                    {pr.requestedBy && <> · {personName(pr.requestedBy)}</>}
                  </span>
                ),
              },
              {
                header: "Status",
                cell: (pr) => {
                  const isSlaBreached = pr.slaBreachAt && pr.slaBreachAt < new Date();
                  return isSlaBreached ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
                      <Clock className="size-3" /> SLA breach
                    </span>
                  ) : (
                    <StatusBadge status={pr.consumedQty > 0 && pr.status !== "CONSUMED" ? "PARTIAL" : pr.status} />
                  );
                },
              },
              {
                header: "Actions",
                align: "right",
                cell: (pr) => (
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {permission.canEdit && ["PENDING", "WITH_PM", "APPROVED"].includes(pr.status) && (
                      <ConsumeDialog
                        requestedItemId={pr.item.id}
                        requestedItemName={pr.item.name}
                        outstanding={pr.quantity - pr.consumedQty}
                        units={availableUnits.map((u) => ({
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
                    {pr.status === "APPROVED" && (
                      <form action={receiveStock.bind(null, pr.id)}>
                        <button type="submit" className={buttonClass("primary", "sm")}>Mark received</button>
                      </form>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* Returns / Warranty tabs */}
      {returnKind && (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <DataTable
            rows={returnRows}
            rowKey={(r) => r.id}
            bordered={false}
            empty={
              returnKind === "RETURN"
                ? "No returns yet. They appear here when a customer returns a product from a closed case."
                : "No warranty claims yet. They appear here when a product is returned for a fault inside its warranty."
            }
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
              {
                header: "Photos",
                cell: (r) =>
                  r.attachments.length === 0 ? (
                    <span className="text-text-disabled">—</span>
                  ) : (
                    <div className="flex gap-1">
                      {r.attachments.slice(0, 3).map((a) => (
                        <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element -- uploaded file, size unknown */}
                          <img src={a.url} alt={a.fileName} className="size-10 rounded-md border border-border object-cover" />
                        </a>
                      ))}
                      {r.attachments.length > 3 && <span className="self-center text-xs text-text-muted">+{r.attachments.length - 3}</span>}
                    </div>
                  ),
              },
              ...(returnKind === "WARRANTY_CLAIM"
                ? [
                    {
                      header: "Warranty until",
                      cell: (r: (typeof returnRows)[number]) => formatFullDate(r.warrantyEndsAt),
                    },
                  ]
                : []),
              {
                header: "Raised",
                cell: (r) => (
                  <span className="text-xs text-text-muted">
                    {formatDate(r.createdAt)}
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
                header: "Actions",
                align: "right",
                cell: (r) => (
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {canApprove && r.status === "REQUESTED" && (
                      <>
                        <form action={updateReturnStatus.bind(null, r.id, "APPROVED")}>
                          <button type="submit" className={buttonClass("success", "sm")}>Approve</button>
                        </form>
                        <form action={updateReturnStatus.bind(null, r.id, "REJECTED")}>
                          <button type="submit" className={buttonClass("danger", "sm")}>Reject</button>
                        </form>
                      </>
                    )}
                    {permission.canEdit && r.status === "APPROVED" && (
                      <form action={updateReturnStatus.bind(null, r.id, "COMPLETED")}>
                        <button type="submit" className={buttonClass("primary", "sm")}>Mark completed</button>
                      </form>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* Received tab (branch users): units allocated to their branch */}
      {isBranchUser && (
        <ListView
          list={list}
          total={branchUnits.total}
          rows={branchUnits.rows}
          rowKey={(u) => u.id}
          searchPlaceholder="Search by USID, item or case ID"
          empty="Nothing has been allocated to your branch yet."
          columns={[
            { header: "#", cell: (_, i) => i + 1 + (list.page - 1) * list.pageSize },
            { header: "USID", cell: (u) => <span className="font-medium tabular-nums">{u.usid}</span> },
            {
              header: "Item",
              cell: (u) => (
                <>
                  <p className="text-sm font-medium">{u.item.name}</p>
                  <p className="text-xs text-text-muted">{u.item.code}</p>
                </>
              ),
            },
            {
              header: "Case ID",
              cell: (u) =>
                u.allocatedCase ? (
                  <Link href={`/service/cases/${u.allocatedCase.id}`} className="text-sm font-medium text-primary hover:underline">
                    {u.allocatedCase.jobsheetNo}
                  </Link>
                ) : (
                  "—"
                ),
            },
            {
              header: "Photos",
              cell: (u) =>
                  u.attachments.length === 0 ? (
                    <span className="text-text-disabled">—</span>
                  ) : (
                    <div className="flex gap-1">
                      {u.attachments.slice(0, 3).map((a) => (
                        <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element -- uploaded file, size unknown */}
                          <img src={a.url} alt={a.fileName} className="size-10 rounded-md border border-border object-cover" />
                        </a>
                      ))}
                      {u.attachments.length > 3 && <span className="self-center text-xs text-text-muted">+{u.attachments.length - 3}</span>}
                    </div>
                  ),
            },
            {
              header: "Allocated on",
              cell: (u) => (
                <span className="text-xs text-text-muted">
                  {u.allocatedAt ? formatFullDate(u.allocatedAt) : "—"}
                  {u.allocatedBy && <> · {personName(u.allocatedBy)}</>}
                </span>
              ),
            },
            {
              header: "Receipt status",
              cell: (u) =>
                u.status === "RECEIVED" ? (
                  <>
                    <Badge tone="success">Received</Badge>
                    <p className="mt-1 text-xs text-text-muted">
                      {u.receivedAt && formatFullDate(u.receivedAt)}
                      {u.receivedBy && <> · {personName(u.receivedBy)}</>}
                    </p>
                  </>
                ) : (
                  <Badge tone="warning">Awaiting receipt</Badge>
                ),
            },
            {
              header: "Actions",
              align: "right",
              cell: (u) =>
                permission.canEdit && u.status === "ALLOCATED" ? (
                  <form action={markUnitReceived.bind(null, u.id)}>
                    <button type="submit" className={buttonClass("success", "sm")}>Mark as Received</button>
                  </form>
                ) : null,
            },
          ]}
        />
      )}
    </>
  );
}
