import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/data/data-table";
import { formatDateTime } from "@/lib/dates";
import { AdminPage } from "@/modules/admin/components/admin-page";
import { saveGstRates } from "@/modules/inventory/actions/gst-config";
import { saveUsidConfig } from "@/modules/inventory/actions/usid-config";
import { GstConfigForm } from "@/modules/inventory/components/gst-config-form";
import { UsidConfigForm } from "@/modules/inventory/components/usid-config-form";
import { getGstRates } from "@/modules/inventory/config";
import { INVENTORY_PATHS } from "@/modules/inventory/paths";
import { isPurchaseManager } from "@/modules/inventory/purchase-access";
import { getUsidConfig } from "@/modules/inventory/usid";
import { formatUsid } from "@/modules/inventory/usid-schema";
import { db } from "@/server/db";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Configuration" };

export default async function ConfigurationPage() {
  const { user, permission } = await requirePageAccess(
    INVENTORY_PATHS.configuration,
  );
  // Admin and the Purchase Manager only.
  if (!isPurchaseManager(user)) redirect("/forbidden");

  const [config, gstRates, history] = await Promise.all([
    getUsidConfig(),
    getGstRates(),
    db.userActivityLog.findMany({
      where: {
        action: { in: ["inventory.usid-config", "inventory.gst-config"] },
      },
      orderBy: { at: "desc" },
      take: 20,
      select: {
        id: true,
        at: true,
        action: true,
        detail: true,
        user: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);
  const next = formatUsid(config.prefix, config.width, config.nextNumber);

  return (
    <AdminPage
      title="Configuration"
      group="Inventory"
      subtitle="USID numbering and the GST rates offered on purchase bills"
    >
      <div className="space-y-6">
        {/* Two settings side by side on wide screens, stacked on small ones */}
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Card title="USID numbering">
            <div className="mb-4 flex flex-wrap items-center gap-x-8 gap-y-2 rounded-lg bg-primary-soft px-4 py-3 text-sm">
              <p>
                <span className="text-text-muted">Next USID: </span>
                <span className="font-semibold tabular-nums">{next}</span>
              </p>
              <p className="text-text-muted">
                USIDs are issued automatically, in order, for every unit on a
                saved bill. Existing USIDs never change.
              </p>
            </div>
            {permission.canEdit ? (
              <UsidConfigForm action={saveUsidConfig} current={next} />
            ) : (
              <p className="text-sm text-text-muted">
                You can view the configuration but not change it.
              </p>
            )}
          </Card>

          <Card title="GST rates">
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-primary-soft px-4 py-3 text-sm">
              <span className="text-text-muted">Offered on bill items:</span>
              {gstRates.map((r) => (
                <Badge key={r} tone="primary">
                  {r}%
                </Badge>
              ))}
            </div>
            {permission.canEdit ? (
              <GstConfigForm action={saveGstRates} current={gstRates} />
            ) : (
              <p className="text-sm text-text-muted">
                You can view the configuration but not change it.
              </p>
            )}
          </Card>
        </div>

        <Card title="Change history">
          <DataTable
            rows={history}
            rowKey={(h) => h.id}
            empty="The configuration has not been changed yet."
            columns={[
              { header: "#", cell: (_, i) => i + 1 },
              { header: "When", cell: (h) => formatDateTime(h.at) },
              {
                header: "Changed by",
                cell: (h) =>
                  h.user
                    ? [h.user.firstName, h.user.lastName]
                        .filter(Boolean)
                        .join(" ")
                    : "—",
              },
              {
                header: "Setting",
                cell: (h) => (
                  <Badge tone="navy">
                    {h.action === "inventory.gst-config" ? "GST rates" : "USID"}
                  </Badge>
                ),
              },
              { header: "Change", cell: (h) => h.detail ?? "—" },
            ]}
          />
        </Card>
      </div>
    </AdminPage>
  );
}
