import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/ui/action-button";
import { DataTable } from "@/components/data/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { formatPaise, paiseToInput } from "@/lib/money";
import { saveServicePrice, toggleServicePrice } from "@/modules/telecaller/actions";
import { ServicePriceDialog } from "@/modules/telecaller/components/config-dialogs";
import { TELECALLER_PATHS } from "@/modules/telecaller/paths";
import { listServicePrices } from "@/modules/telecaller/queries";
import { enumLabel } from "@/lib/enum";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Service Prices" };

export default async function ServicePricesPage() {
  const { permission } = await requirePageAccess(TELECALLER_PATHS.servicePrices);
  const rows = await listServicePrices(false);

  return (
    <>
      <PageHeader
        title="Service price estimates"
        subtitle="Approximate costs by reported issue or repair type, for telecallers to quote on a call"
        breadcrumbs={["Telecaller", "Service Prices"]}
        actions={permission.canCreate ? <ServicePriceDialog action={saveServicePrice.bind(null, null)} /> : undefined}
      />
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        empty="No estimates yet."
        columns={[
          { header: "#", cell: (_, i) => i + 1 },
          { header: "Issue / repair type", cell: (r) => <span className="font-medium">{r.name}</span> },
          { header: "Product", cell: (r) => (r.productType ? enumLabel(r.productType) : "Any") },
          {
            header: "Estimated price",
            align: "right",
            cell: (r) => (
              <span className="whitespace-nowrap font-medium tabular-nums">
                {formatPaise(r.minPaise)} – {formatPaise(r.maxPaise)}
              </span>
            ),
          },
          { header: "Notes", cell: (r) => <span className="block max-w-72 whitespace-normal text-xs text-text-muted">{r.notes ?? "—"}</span> },
          { header: "Status", cell: (r) => <Badge tone={r.isActive ? "success" : "neutral"}>{r.isActive ? "Active" : "Off"}</Badge> },
          ...(permission.canEdit
            ? [
                {
                  header: "Action",
                  cell: (r: (typeof rows)[number]) => (
                    <div className="flex items-center gap-2">
                      <ServicePriceDialog
                        action={saveServicePrice.bind(null, r.id)}
                        initial={{ name: r.name, productType: r.productType ?? "", min: paiseToInput(r.minPaise), max: paiseToInput(r.maxPaise), notes: r.notes ?? "" }}
                      />
                      <ActionButton
                        action={toggleServicePrice.bind(null, r.id)}
                        label={r.isActive ? "Switch off" : "Switch on"}
                        className="rounded-lg px-2 py-1 text-xs font-semibold text-text-muted hover:bg-surface-muted hover:text-text"
                      >
                        {r.isActive ? "Switch off" : "Switch on"}
                      </ActionButton>
                    </div>
                  ),
                },
              ]
            : []),
        ]}
      />
    </>
  );
}
