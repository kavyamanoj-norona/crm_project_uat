import { PageHeader } from "@/components/layout/page-header";
import { requirePageAccess } from "@/server/rbac/guard";
import { INVENTORY_PATHS } from "@/modules/inventory/paths";

export const metadata = { title: "Inventory Dashboard" };

export default async function InventoryDashboardPage() {
  await requirePageAccess(INVENTORY_PATHS.dashboard);
  return (
    <>
      <PageHeader title="Inventory Dashboard" breadcrumbs={["Inventory", "Dashboard"]} />
      <p className="text-text-muted">Dashboard coming soon — use Stock &amp; Purchasing to manage stock and requests.</p>
    </>
  );
}
