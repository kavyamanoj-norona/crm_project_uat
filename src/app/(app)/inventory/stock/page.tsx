import { AlertTriangle, ArrowRight, Clock, Package, Plus, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { FlashToast } from "@/components/feedback/flash-toast";
import { PageHeader } from "@/components/layout/page-header";
import { EntityForm, type FieldConfig } from "@/modules/admin/components/entity-form";
import { param } from "@/modules/admin/components/admin-page";
import { formatPaise } from "@/lib/money";
import { minPricePaise } from "@/lib/pricing";
import { branchWhere, getBranchScope, listBranchOptions } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";
import { adjustStock } from "@/modules/inventory/actions/stock";
import { raisePurchaseRequest, updatePurchaseRequestStatus } from "@/modules/inventory/actions/purchase";
import { createTransfer, updateTransferStatus } from "@/modules/inventory/actions/transfer";
import { INVENTORY_PATHS } from "@/modules/inventory/paths";
import { listAllActiveItems, listPhysicalItems, listPurchaseRequests, listStock, listTransfers } from "@/modules/inventory/queries";
import type { PurchaseRequestRow, TransferRow } from "@/modules/inventory/queries";

export const metadata = { title: "Stock & Purchasing" };

const PR_LABELS: Record<string, string> = {
  PENDING: "Pending",
  WITH_PM: "With Purchase Manager",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  FULFILLED: "Fulfilled",
};

const TR_LABELS: Record<string, string> = {
  PENDING_APPROVAL: "Awaiting approval",
  APPROVED: "Approved",
  DISPATCHED: "Dispatched",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
};

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(d);
}

function personName(u: { firstName: string; lastName?: string | null } | null) {
  if (!u) return null;
  return [u.firstName, u.lastName].filter(Boolean).join(" ");
}

// ─── Purchase request card ────────────────────────────────────────────────────

function PurchaseRequestCard({ pr, canApprove }: { pr: PurchaseRequestRow; canApprove: boolean }) {
  const isSlaBreached = pr.slaBreachAt && pr.slaBreachAt < new Date();
  return (
    <div className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-sm">{pr.item.name}</p>
          <p className="mt-0.5 text-xs text-text-muted">
            {pr.code}
            {pr.case && <> · <span className="font-medium">{pr.case.jobsheetNo}</span></>}
            {" · raised "}
            {formatDate(pr.createdAt)}
            {pr.requestedBy && ` by ${personName(pr.requestedBy)}`}
          </p>
          {pr.notes && <p className="mt-1 text-xs text-text-muted italic">{pr.notes}</p>}
        </div>
        <div className="shrink-0">
          {isSlaBreached ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
              <Clock className="size-3" />
              SLA breach
            </span>
          ) : (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              pr.status === "WITH_PM" ? "bg-success/10 text-success" :
              pr.status === "APPROVED" ? "bg-info/10 text-info" :
              pr.status === "REJECTED" ? "bg-danger/10 text-danger" :
              "bg-surface-muted text-text-muted"
            }`}>
              {PR_LABELS[pr.status]}
            </span>
          )}
        </div>
      </div>

      {canApprove && pr.status === "PENDING" && (
        <div className="mt-3 flex gap-2">
          <form action={updatePurchaseRequestStatus.bind(null, pr.id, "APPROVED")}>
            <button type="submit" className="rounded-lg bg-success px-3 py-1 text-xs font-medium text-white hover:opacity-90">
              Approve
            </button>
          </form>
          <form action={updatePurchaseRequestStatus.bind(null, pr.id, "WITH_PM")}>
            <button type="submit" className="rounded-lg border border-border px-3 py-1 text-xs font-medium hover:bg-surface-muted">
              Send to PM
            </button>
          </form>
          <form action={updatePurchaseRequestStatus.bind(null, pr.id, "REJECTED")}>
            <button type="submit" className="rounded-lg border border-danger/30 px-3 py-1 text-xs font-medium text-danger hover:bg-danger/5">
              Reject
            </button>
          </form>
        </div>
      )}
      {canApprove && pr.status === "WITH_PM" && (
        <div className="mt-3 flex gap-2">
          <form action={updatePurchaseRequestStatus.bind(null, pr.id, "APPROVED")}>
            <button type="submit" className="rounded-lg bg-success px-3 py-1 text-xs font-medium text-white hover:opacity-90">
              Approve
            </button>
          </form>
          <form action={updatePurchaseRequestStatus.bind(null, pr.id, "REJECTED")}>
            <button type="submit" className="rounded-lg border border-danger/30 px-3 py-1 text-xs font-medium text-danger hover:bg-danger/5">
              Reject
            </button>
          </form>
        </div>
      )}
      {pr.status === "APPROVED" && (
        <form className="mt-3" action={updatePurchaseRequestStatus.bind(null, pr.id, "FULFILLED")}>
          <button type="submit" className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-white hover:opacity-90">
            Mark fulfilled
          </button>
        </form>
      )}
    </div>
  );
}

// ─── Transfer card ────────────────────────────────────────────────────────────

function TransferCard({ transfer: t, userBranchId, canApprove }: { transfer: TransferRow; userBranchId: string | null; canApprove: boolean }) {
  const isDestination = userBranchId === t.toBranchId;
  const itemCount = t.items.length;
  const itemLabel = itemCount === 1 ? t.items[0]!.item.name : `${itemCount} items`;

  return (
    <div className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-semibold text-sm">
            <span>{t.fromBranch.code}</span>
            <ArrowRight className="size-3 text-text-muted" />
            <span>{t.toBranch.code}</span>
            <span className="font-normal text-text-muted">· {itemLabel}</span>
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            {t.code}
            {t.dispatchedAt && <> · dispatched {formatDate(t.dispatchedAt)}</>}
            {!t.dispatchedAt && t.createdAt && <> · raised {formatDate(t.createdAt)}</>}
            {t.notes && <> · <span className="italic">{t.notes}</span></>}
          </p>
        </div>
        <div className="shrink-0">
          {t.status === "PENDING_APPROVAL" ? (
            <span className="inline-flex items-center rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
              {TR_LABELS[t.status]}
            </span>
          ) : t.status === "RECEIVED" ? (
            <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
              {TR_LABELS[t.status]}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-muted">
              {TR_LABELS[t.status]}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        {canApprove && t.status === "PENDING_APPROVAL" && (
          <>
            <form action={updateTransferStatus.bind(null, t.id, "APPROVED")}>
              <button type="submit" className="rounded-lg bg-success px-3 py-1 text-xs font-medium text-white hover:opacity-90">
                Approve
              </button>
            </form>
            <form action={updateTransferStatus.bind(null, t.id, "CANCELLED")}>
              <button type="submit" className="rounded-lg border border-danger/30 px-3 py-1 text-xs font-medium text-danger hover:bg-danger/5">
                Cancel
              </button>
            </form>
          </>
        )}
        {t.status === "APPROVED" && !isDestination && (
          <form action={updateTransferStatus.bind(null, t.id, "DISPATCHED")}>
            <button type="submit" className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-white hover:opacity-90">
              Mark dispatched
            </button>
          </form>
        )}
        {t.status === "DISPATCHED" && isDestination && (
          <form action={updateTransferStatus.bind(null, t.id, "RECEIVED")}>
            <button type="submit" className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-white hover:opacity-90">
              Mark received
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function StockPage({ searchParams }: PageProps<"/inventory/stock">) {
  const { permission, user } = await requirePageAccess(INVENTORY_PATHS.stock);
  const sp = await searchParams;
  const action = param(sp, "action");
  const saved = param(sp, "saved");

  const scope = await getBranchScope(user);
  const canApprove = permission.canApprove;
  const canCreate = permission.canCreate;
  const canEdit = permission.canEdit;

  const [stock, purchaseRequests, transfers, physicalItems, allItems, branchOptions] = await Promise.all([
    listStock(scope.branchId),
    listPurchaseRequests(scope.branchId),
    listTransfers(scope.branchId),
    listPhysicalItems(),
    listAllActiveItems(),
    listBranchOptions(),
  ]);

  const totalValuePaise = stock.reduce((sum, s) => sum + s.quantity * s.item.pricePaise, 0);

  // Branch selector field (shown when PM has no branch selected)
  const branchField: FieldConfig[] = scope.branchId
    ? []
    : [{ name: "branchId", label: "Branch", type: "select" as const, required: true, options: branchOptions.map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` })) }];

  const itemOptions = allItems.map((i) => ({ value: i.id, label: `${i.code} — ${i.name}` }));
  const physicalItemOptions = physicalItems.map((i) => ({ value: i.id, label: `${i.code} — ${i.name}` }));
  const branchOpts = branchOptions.filter((b) => b.id !== scope.branchId).map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` }));

  const stockAdjustFields: FieldConfig[] = [
    ...branchField,
    { name: "itemId", label: "Item (part / accessory)", type: "select", required: true, options: physicalItemOptions },
    { name: "quantity", label: "Quantity", type: "number", required: true, placeholder: "2" },
    {
      name: "unitCodes",
      label: "Unit codes",
      placeholder: "KB123, KB124 (comma-separated)",
      hint: "Sticker IDs on physical units",
      span: 2,
    },
  ];

  const purchaseRequestFields: FieldConfig[] = [
    ...branchField,
    { name: "itemId", label: "Item", type: "select", required: true, options: itemOptions },
    { name: "quantity", label: "Quantity", type: "number", required: true, placeholder: "1" },
    { name: "notes", label: "Notes", type: "textarea", span: 2, placeholder: "Urgency, specs, or any context…" },
  ];

  const transferFields: FieldConfig[] = [
    ...(scope.branchId ? [] : [{ name: "fromBranchId", label: "From branch", type: "select" as const, required: true, options: branchOptions.map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` })) }]),
    { name: "toBranchId", label: "To branch", type: "select" as const, required: true, options: branchOpts },
    { name: "itemId", label: "Item", type: "select" as const, required: true, options: physicalItemOptions },
    { name: "quantity", label: "Quantity", type: "number", required: true },
    { name: "unitCodes", label: "Unit codes to transfer", placeholder: "KB123, KB124", hint: "Which specific physical units", span: 2 },
    { name: "notes", label: "Notes", type: "textarea", span: 2 },
  ];

  return (
    <>
      <FlashToast flag={saved} message="Saved successfully." />
      <PageHeader
        title="Stock & Purchasing"
        subtitle={scope.branch ? `Branch: ${scope.branch.name}` : scope.canSwitch ? "Select a branch in the header to filter" : undefined}
        breadcrumbs={["Inventory", "Stock & Purchasing"]}
        actions={
          canEdit && (
            <LinkButton href={`${INVENTORY_PATHS.stock}?action=stock-adjust`}>
              <Package className="size-4" /> Adjust stock
            </LinkButton>
          )
        }
      />

      {/* Inline form panel */}
      {action === "stock-adjust" && canEdit && (
        <div className="mb-6 rounded-xl border border-border bg-surface p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Adjust stock</h2>
            <LinkButton href={INVENTORY_PATHS.stock} variant="secondary">Cancel</LinkButton>
          </div>
          <EntityForm fields={stockAdjustFields} schema="stockAdjust" action={adjustStock} submitLabel="Save stock" />
        </div>
      )}

      {action === "purchase-request" && canCreate && (
        <div className="mb-6 rounded-xl border border-border bg-surface p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Raise purchase request</h2>
            <LinkButton href={INVENTORY_PATHS.stock} variant="secondary">Cancel</LinkButton>
          </div>
          <EntityForm fields={purchaseRequestFields} schema="purchaseRequest" action={raisePurchaseRequest} submitLabel="Raise request" />
        </div>
      )}

      {action === "transfer" && canCreate && (
        <div className="mb-6 rounded-xl border border-border bg-surface p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">New stock transfer</h2>
            <LinkButton href={INVENTORY_PATHS.stock} variant="secondary">Cancel</LinkButton>
          </div>
          <EntityForm fields={transferFields} schema="stockTransfer" action={createTransfer} submitLabel="Create transfer" />
        </div>
      )}

      {/* Main 2-column layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Branch inventory table */}
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-text-muted">Branch inventory</p>
                <p className="mt-0.5 font-bold">
                  {scope.branch ? `— ${scope.branch.name}` : scope.canSwitch ? "— all branches" : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-text-muted">value</p>
                <p className="font-semibold tabular-nums">{formatPaise(totalValuePaise)}</p>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-xs font-medium uppercase tracking-wider text-text-muted">
                  <th className="px-6 py-2 text-left">Part</th>
                  <th className="px-6 py-2 text-left">Unit codes</th>
                  <th className="px-6 py-2 text-right">Qty</th>
                  <th className="px-6 py-2 text-right">Min ₹</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stock.map((s) => {
                  const low = s.quantity > 0 && s.quantity <= 2;
                  const out = s.quantity === 0;
                  return (
                    <tr key={s.id}>
                      <td className="px-6 py-3 font-medium">{s.item.name}</td>
                      <td className="px-6 py-3 text-xs text-text-muted">
                        {s.unitCodes.length > 0 ? s.unitCodes.join(", ") : <span className="text-text-disabled">—</span>}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span className="inline-flex items-center justify-end gap-2">
                          {s.quantity}
                          {low && <Badge tone="warning">Low</Badge>}
                          {out && <Badge tone="danger">Out</Badge>}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right font-semibold tabular-nums">
                        {formatPaise(minPricePaise(s.item.pricePaise, s.item.maxDiscountPercent))}
                      </td>
                    </tr>
                  );
                })}
                {stock.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-sm text-text-muted">
                      No stock recorded{scope.branch ? ` for ${scope.branch.name}` : ""} yet.
                      {canEdit && (
                        <> <a href={`${INVENTORY_PATHS.stock}?action=stock-adjust`} className="text-primary underline">Add stock</a>.</>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Purchase requests + Transfers */}
        <div className="space-y-4">
          {/* Purchase requests */}
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-semibold">Purchase requests</h2>
              {canCreate && (
                <LinkButton href={`${INVENTORY_PATHS.stock}?action=purchase-request`}>
                  <Plus className="size-3" /> Raise
                </LinkButton>
              )}
            </div>
            <div className="divide-y divide-border">
              {purchaseRequests.map((pr) => (
                <PurchaseRequestCard key={pr.id} pr={pr} canApprove={canApprove} />
              ))}
              {purchaseRequests.length === 0 && (
                <p className="px-5 py-6 text-sm text-text-muted">No active purchase requests.</p>
              )}
            </div>
          </div>

          {/* Transfers */}
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-semibold">Transfers</h2>
              {canCreate && (
                <LinkButton href={`${INVENTORY_PATHS.stock}?action=transfer`}>
                  <Truck className="size-3" /> New
                </LinkButton>
              )}
            </div>
            <div className="divide-y divide-border">
              {transfers.map((t) => (
                <TransferCard key={t.id} transfer={t} userBranchId={scope.branchId} canApprove={canApprove} />
              ))}
              {transfers.length === 0 && (
                <p className="px-5 py-6 text-sm text-text-muted">No recent transfers.</p>
              )}
            </div>
          </div>

          <p className="px-1 text-xs text-text-muted">
            Stock audit due: physical vs system count, reasoned adjustments, approval-gated.
          </p>
        </div>
      </div>
    </>
  );
}
