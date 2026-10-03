import { PageHeader } from "@/components/layout/page-header";
import { requirePageAccess } from "@/server/rbac/guard";
import { SALES_PATHS } from "@/modules/sales/paths";

export const metadata = { title: "Sales Dashboard" };

export default async function SalesDashboardPage() {
  await requirePageAccess(SALES_PATHS.dashboard);
  return (
    <>
      <PageHeader title="Sales Dashboard" breadcrumbs={["Sales", "Dashboard"]} />
      <p className="text-text-muted">Sales overview coming soon.</p>
    </>
  );
}
