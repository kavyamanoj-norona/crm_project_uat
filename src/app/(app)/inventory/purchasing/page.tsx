import { Clock, Package2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { FlashToast } from "@/components/feedback/flash-toast";
import { PageHeader } from "@/components/layout/page-header";
import { EntityForm, type FieldConfig } from "@/modules/admin/components/entity-form";
import { param } from "@/modules/admin/components/admin-page";
import { getBranchScope, listBranchOptions } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";
import { raisePurchaseRequest, receiveStock, updatePurchaseRequestStatus } from "@/modules/inventory/actions/purchase";
import { INVENTORY_PATHS } from "@/modules/inventory/paths";
import { listActivePurchaseRequests, listAllActiveItems, listReceivedRequests } from "@/modules/inventory/queries";
import type { ActivePurchaseRequestRow, ReceivedRequestRow } from "@/modules/inventory/queries";

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

function RequestRow({ pr, canApprove }: { pr: ActivePurchaseRequestRow; canApprove: boolean }) {
  const isSlaBreached = pr.slaBreachAt && pr.slaBreachAt < new Date();
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-5 py-3">
        <p className="font-medium text-sm">{pr.item.name}</p>
        {pr.case && <p className="text-xs text-text-muted">{pr.case.jobsheetNo}</p>}
      </td>
      <td className="px-5 py-3 text-xs text-text-muted tabular-nums">{pr.code}</td>
      <td className="px-5 py-3 text-center tabular-nums">{pr.quantity}</td>
      <td className="px-5 py-3 text-xs text-text-muted">
        {formatDate(pr.createdAt)}
        {pr.requestedBy && <> · {personName(pr.requestedBy)}</>}
      </td>
      <td className="px-5 py-3">
        {isSlaBreached ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
            <Clock className="size-3" /> SLA breach
          </span>
        ) : (
          <StatusBadge status={pr.status} />
        )}
      </td>
      <td className="px-5 py-3">
        <div className="flex flex-wrap gap-1.5">
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
      </td>
    </tr>
  );
}

function ReceivedRow({ r }: { r: ReceivedRequestRow }) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-5 py-3 font-medium text-sm">{r.item.name}</td>
      <td className="px-5 py-3 text-xs text-text-muted tabular-nums">{r.code}</td>
      <td className="px-5 py-3 text-center tabular-nums">{r.quantity}</td>
      <td className="px-5 py-3 text-xs text-text-muted">{r.branch.code} — {r.branch.name}</td>
      <td className="px-5 py-3 text-xs text-text-muted">
        {formatDate(r.createdAt)}
        {r.requestedBy && <> · {personName(r.requestedBy)}</>}
      </td>
    </tr>
  );
}

export default async function PurchasingPage({ searchParams }: PageProps<"/inventory/purchasing">) {
  // Permission check uses stock path until the seed adds a dedicated purchasing menu item
  const { permission, user } = await requirePageAccess(INVENTORY_PATHS.stock);
  const sp = await searchParams;
  const tab = param(sp, "tab") ?? "requests";
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
    { name: "quantity", label: "Quantity", type: "number", required: true, placeholder: "1" },
    { name: "notes", label: "Notes", type: "textarea", span: 2, placeholder: "Urgency, specs, or any context…" },
  ];

  const isRequests = tab !== "received";

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
      <div className="mb-6 flex gap-1 border-b border-border">
        <a
          href={INVENTORY_PATHS.purchasing}
          className={`shrink-0 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${isRequests ? "bg-primary text-white" : "text-text-muted hover:text-text"}`}
        >
          Requests
          {activeRequests.length > 0 && (
            <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${isRequests ? "bg-white/20 text-white" : "bg-surface-muted text-text-muted"}`}>
              {activeRequests.length}
            </span>
          )}
        </a>
        <a
          href={`${INVENTORY_PATHS.purchasing}?tab=received`}
          className={`shrink-0 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${!isRequests ? "bg-primary text-white" : "text-text-muted hover:text-text"}`}
        >
          Received
        </a>
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-xs font-semibold text-text">
                <th className="px-5 py-3 text-left border-r border-border">Item</th>
                <th className="px-5 py-3 text-left border-r border-border">Code</th>
                <th className="px-5 py-3 text-center border-r border-border">Qty</th>
                <th className="px-5 py-3 text-left border-r border-border">Raised</th>
                <th className="px-5 py-3 text-left border-r border-border">Status</th>
                <th className="px-5 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeRequests.map((pr) => (
                <RequestRow key={pr.id} pr={pr} canApprove={canApprove} />
              ))}
              {activeRequests.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-text-muted">
                    No active purchase requests.
                    {canCreate && (
                      <> <a href={`${INVENTORY_PATHS.purchasing}?action=purchase-request`} className="text-primary underline">Raise one</a>.</>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Received tab */}
      {!isRequests && (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-xs font-semibold text-text">
                <th className="px-5 py-3 text-left border-r border-border">Item</th>
                <th className="px-5 py-3 text-left border-r border-border">Code</th>
                <th className="px-5 py-3 text-center border-r border-border">Qty</th>
                <th className="px-5 py-3 text-left border-r border-border">Branch</th>
                <th className="px-5 py-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {receivedRequests.map((r) => (
                <ReceivedRow key={r.id} r={r} />
              ))}
              {receivedRequests.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-text-muted">
                    No received items yet. Items appear here when purchase requests are marked received.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
