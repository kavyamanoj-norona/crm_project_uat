import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/ui/action-button";
import { buttonClass } from "@/components/ui/button";
import { ListView } from "@/components/data/list-view";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { formatDate } from "@/lib/dates";
import { formatTat } from "@/lib/tat";
import { listState } from "@/lib/list";
import { AdminPage } from "@/modules/admin/components/admin-page";
import { vendorReplacementReady, vendorReplacementReturnReceived, vendorReplacementTransfer } from "@/modules/inventory/actions/vendor-replacements";
import { INVENTORY_PATHS } from "@/modules/inventory/paths";
import { isPurchaseManager } from "@/modules/inventory/purchase-access";
import { VR_SORTS, listVendorReplacementsPage } from "@/modules/inventory/queries";
import { VR_STATUS_LABELS } from "@/modules/inventory/vendor-replacement-labels";
import { getBranchScope } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Vendor Replacements" };

const TONE = { REQUESTED: "warning", READY: "primary", TRANSFERRED: "indigo", RECEIVED: "success" } as const;

export default async function VendorReplacementsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user, permission } = await requirePageAccess(INVENTORY_PATHS.vendorReplacements);
  // Purchase Manager and admins.
  if (!isPurchaseManager(user)) redirect("/forbidden");
  const sp = await searchParams;
  const list = listState(INVENTORY_PATHS.vendorReplacements, sp, { sorts: VR_SORTS, defaultSort: "requestedAt" });
  const scope = await getBranchScope(user);
  const { rows, total, tabs } = await listVendorReplacementsPage(list, scope.branchId);
  const canEdit = permission.canEdit;

  return (
    <AdminPage
      title="Vendor Replacements"
      group="Inventory"
      subtitle="Defective or not-working items replaced by the vendor under the same USID: no new purchase, no new stock entry. The replacement can go to the branch before the defective item reaches Head Office."
    >
      <ListView
        list={list}
        total={total}
        tabs={tabs}
        tone="blue"
        rows={rows}
        rowKey={(v) => v.id}
        searchPlaceholder="Search by code, USID, item, vendor or case ID"
        empty="No vendor replacements yet. They appear here when a branch returns an item as defective or not working."
        columns={[
          { header: "#", cell: (_, i) => i + 1 },
          { header: "Code", cell: (v) => <span className="text-xs font-medium tabular-nums">{v.code}</span> },
          { header: "Original USID", cell: (v) => <span className="font-medium tabular-nums">{v.unit.usid}</span> },
          {
            header: "Item",
            cell: (v) => (
              <>
                <p className="text-sm font-medium">{v.item.name}</p>
                <p className="text-xs text-text-muted">{v.item.code}</p>
              </>
            ),
          },
          {
            header: "Case ID",
            cell: (v) =>
              v.case ? (
                <Link href={`/service/cases/${v.case.id}`} className="text-sm font-medium text-primary hover:underline">
                  {v.case.jobsheetNo}
                </Link>
              ) : (
                "—"
              ),
          },
          { header: "Branch", cell: (v) => <span className="text-xs text-text-muted">{v.branch.code} — {v.branch.name}</span> },
          {
            header: "Vendor",
            cell: (v) => (
              <>
                <p className="text-sm">{v.vendorName ?? "—"}</p>
                {v.vendorRemarks && <p className="max-w-48 truncate text-xs text-text-muted" title={v.vendorRemarks}>{v.vendorRemarks}</p>}
              </>
            ),
          },
          {
            // The defective unit's own journey to Head Office: separate from the replacement.
            header: "Defective item",
            cell: (v) =>
              v.returnReceivedAt ? (
                <>
                  <Badge tone="navy">Received at HO</Badge>
                  <p className="mt-1 text-xs text-text-muted">{formatDate(v.returnReceivedAt)}</p>
                </>
              ) : (
                <Badge tone="warning">In transit to HO</Badge>
              ),
          },
          { header: "Vendor status", cell: (v) => <Badge tone={TONE[v.status]}>{VR_STATUS_LABELS[v.status]}</Badge> },
          {
            header: "Transfer / receipt",
            cell: (v) => (
              <span className="block text-xs text-text-muted">
                {v.transferredAt ? <>Transferred {formatDate(v.transferredAt)}</> : "Not transferred"}
                {v.receivedAt && <span className="block">Branch received {formatDate(v.receivedAt)}</span>}
              </span>
            ),
          },
          { header: "Requested", sort: "requestedAt", cell: (v) => <span className="text-xs text-text-muted">{formatDate(v.requestedAt)}</span> },
          {
            header: "TAT",
            cell: (v) => (
              <Badge tone="neutral" className="tabular-nums" >
                {formatTat(v.requestedAt, v.receivedAt ?? undefined)}
              </Badge>
            ),
          },
          {
            header: "Actions",
            align: "center",
            cell: (v) =>
              canEdit ? (
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {v.status === "REQUESTED" && (
                    <ActionDialog
                      trigger="Replacement ready"
                      triggerVariant="primary"
                      triggerSize="sm"
                      title="Vendor replacement ready"
                      description={`${v.unit.usid} · ${v.item.name}. The same USID is reused; nothing is purchased or added to stock.`}
                      action={vendorReplacementReady.bind(null, v.id)}
                      submitLabel="Mark as ready"
                    >
                      <Field label="Vendor" htmlFor={`vendor-${v.id}`} hint="Optional.">
                        <Input id={`vendor-${v.id}`} name="vendor" placeholder="Enter vendor name" />
                      </Field>
                      <Field label="Remarks" htmlFor={`vr-remarks-${v.id}`} hint="Optional.">
                        <Textarea id={`vr-remarks-${v.id}`} name="remarks" rows={2} placeholder="Enter remarks" />
                      </Field>
                    </ActionDialog>
                  )}
                  {v.status === "READY" && (
                    <ActionButton
                      action={vendorReplacementTransfer.bind(null, v.id)}
                      label="Transfer to branch"
                      confirmLabel="Transfer"
                      confirm={`Transfer ${v.unit.usid} to ${v.branch.name}${v.case ? ` for ${v.case.jobsheetNo}` : ""}? It does not wait for the defective item to reach Head Office.`}
                      className={buttonClass("success", "sm")}
                    >
                      Transfer
                    </ActionButton>
                  )}
                  {!v.returnReceivedAt && (
                    <ActionButton action={vendorReplacementReturnReceived.bind(null, v.id)} label="Receive defective item" className={buttonClass("secondary", "sm")}>
                      Receive defective
                    </ActionButton>
                  )}
                </div>
              ) : null,
          },
        ]}
      />
    </AdminPage>
  );
}
