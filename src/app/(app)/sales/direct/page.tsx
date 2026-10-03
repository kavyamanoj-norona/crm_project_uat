import { PageHeader } from "@/components/layout/page-header";
import { requirePageAccess } from "@/server/rbac/guard";
import { SALES_PATHS } from "@/modules/sales/paths";

export const metadata = { title: "Direct Sales" };

export default async function DirectSalesPage() {
  await requirePageAccess(SALES_PATHS.direct);
  return (
    <>
      <PageHeader title="Direct Sales" breadcrumbs={["Sales", "Direct Sales"]} />
      <p className="text-text-muted">Direct sales management coming soon.</p>
    </>
  );
}
