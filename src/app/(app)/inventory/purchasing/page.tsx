import { Clock, Package2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { FlashToast } from "@/components/feedback/flash-toast";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/data/data-table";
import { FilterTabs } from "@/components/data/filter-tabs";
import { listState } from "@/lib/list";
import { EntityForm, type FieldConfig } from "@/modules/admin/components/entity-form";
import { param } from "@/modules/admin/components/admin-page";
import { getBranchScope, listBranchOptions } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";
import { raisePurchaseRequest, receiveStock, updatePurchaseRequestStatus } from "@/modules/inventory/actions/purchase";
import { INVENTORY_PATHS } from "@/modules/inventory/paths";
import { listActivePurchaseRequests, listAllActiveItems, listReceivedRequests } from "@/modules/inventory/queries";

export const metadata = { title: "Purchasing" };

const PR_LABELS: Record<string, string> = {
  PENDING: "Pending",
  WITH_PM: "With PM",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(d);
}

function personName(u: { firstName: string; lastName?: string | null } | null) {
  if (!u) return null;
  return [u.firstName, u.lastName].filter(Boolean).join(" ");
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "APPROVED" ? "bg-info/10 text-info" :
    status === "REJECTED" ? "bg-danger/10 text-danger" :
    status === "WITH_PM" ? "bg-success/10 text-success" :
    "bg-surface-muted text-text-muted";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {PR_LABELS[status] ?? status}
    </span>
  );
}


export default async function PurchasingPage({ searchParams }: PageProps<"/inventory/purchasing">) {
  // Permission check uses stock path until the seed adds a dedicated purchasing menu item
  const { permission, user } = await requirePageAccess(INVENTORY_PATHS.stock);
  const sp = await searchParams;
  const list = listState(INVENTORY_PATHS.purchasing, sp, { sorts: ["createdAt"] as const, defaultSort: "createdAt" });
  const action = param(sp, "action");
  const saved = param(sp, "saved");
  const preItemId = param(sp, "itemId");

  const scope = await getBranchScope(user);
  const canApprove = permission.canApprove;
  const canCreate = permission.canCreate;

  const [activeRequests, receivedRequests, allItems, branchOptions] = await Promise.all([
    listActivePurchaseRequests(scope.branchId),
    listReceivedRequests(scope.branchId),
    listAllActiveItems(),
    listBranchOptions(),
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

  const isRequests = list.tab !== "received";

  return (
    <>
      <FlashToast flag={saved} message="Saved successfully." />
      <PageHeader
        title="Purchasing"
        subtitle={scope.branch ? `Branch: ${scope.branch.name}` : scope.canSwitch ? "Select a branch in the header to filter" : undefined}
        breadcrumbs={["Inventory", "Purchasing"]}
        actions={
          canCreate && isRequests && (
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
          tabs={[
            { key: "", label: "Requests", count: activeRequests.length },
            { key: "received", label: "Received" },
          ]}
        />
      </div>

      {/* Inline purchase request form */}
      {action === "purchase-request" && canCreate && isRequests && (
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
                    {pr.case && <p className="text-xs text-text-muted">{pr.case.jobsheetNo}</p>}
                  </>
                ),
              },
              {
                header: "Code",
                cell: (pr) => <span className="text-xs text-text-muted tabular-nums">{pr.code}</span>,
              },
              { header: "Qty", align: "center", cell: (pr) => pr.quantity },
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
                    <StatusBadge status={pr.status} />
                  );
                },
              },
              {
                header: "Actions",
                align: "right",
                cell: (pr) => (
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {canApprove && pr.status === "PENDING" && (
                      <>
                        <form action={updatePurchaseRequestStatus.bind(null, pr.id, "APPROVED")}>
                          <button type="submit" className="rounded-lg bg-success px-3 py-1 text-xs font-medium text-white hover:opacity-90">Approve</button>
                        </form>
                        <form action={updatePurchaseRequestStatus.bind(null, pr.id, "WITH_PM")}>
                          <button type="submit" className="rounded-lg border border-border px-3 py-1 text-xs font-medium hover:bg-surface-muted">To PM</button>
                        </form>
                        <form action={updatePurchaseRequestStatus.bind(null, pr.id, "REJECTED")}>
                          <button type="submit" className="rounded-lg border border-danger/30 px-3 py-1 text-xs font-medium text-danger hover:bg-danger/5">Reject</button>
                        </form>
                      </>
                    )}
                    {canApprove && pr.status === "WITH_PM" && (
                      <>
                        <form action={updatePurchaseRequestStatus.bind(null, pr.id, "APPROVED")}>
                          <button type="submit" className="rounded-lg bg-success px-3 py-1 text-xs font-medium text-white hover:opacity-90">Approve</button>
                        </form>
                        <form action={updatePurchaseRequestStatus.bind(null, pr.id, "REJECTED")}>
                          <button type="submit" className="rounded-lg border border-danger/30 px-3 py-1 text-xs font-medium text-danger hover:bg-danger/5">Reject</button>
                        </form>
                      </>
                    )}
                    {pr.status === "APPROVED" && (
                      <form action={receiveStock.bind(null, pr.id)}>
                        <button type="submit" className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-white hover:opacity-90">Mark received</button>
                      </form>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* Received tab */}
      {!isRequests && (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <DataTable
            rows={receivedRequests}
            rowKey={(r) => r.id}
            bordered={false}
            empty="No received items yet. Items appear here when purchase requests are marked received."
            columns={[
              { header: "#", cell: (_, i) => i + 1 },
              {
                header: "Item",
                cell: (r) => <span className="font-medium text-sm">{r.item.name}</span>,
              },
              {
                header: "Code",
                cell: (r) => <span className="text-xs text-text-muted tabular-nums">{r.code}</span>,
              },
              { header: "Qty", align: "center", cell: (r) => r.quantity },
              {
                header: "Branch",
                cell: (r) => <span className="text-xs text-text-muted">{r.branch.code} — {r.branch.name}</span>,
              },
              {
                header: "Date",
                cell: (r) => (
                  <span className="text-xs text-text-muted">
                    {formatDate(r.createdAt)}
                    {r.requestedBy && <> · {personName(r.requestedBy)}</>}
                  </span>
                ),
              },
            ]}
          />
        </div>
      )}

      {!isRequests && receivedRequests.length > 0 && (
        <div className="mt-3 flex items-center gap-2 px-1">
          <Package2 className="size-3.5 text-text-muted" />
          <p className="text-xs text-text-muted">
            Received items automatically update branch stock when marked received.
          </p>
        </div>
      )}
    </>
  );
}
