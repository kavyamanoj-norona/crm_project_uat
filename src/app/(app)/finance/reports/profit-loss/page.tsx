import { PageHeader } from "@/components/layout/page-header";
import { requirePageAccess } from "@/server/rbac/guard";
import { FINANCE_PATHS } from "@/modules/finance/paths";

export const metadata = { title: "Profit & Loss" };

export default async function ProfitLossPage() {
  await requirePageAccess(FINANCE_PATHS.reportsProfitLoss);
  return (
    <>
      <PageHeader title="Profit & Loss" breadcrumbs={["Finance", "Reports", "Profit & Loss"]} />
      <p className="text-text-muted">Profit and loss statement coming soon.</p>
    </>
  );
}
