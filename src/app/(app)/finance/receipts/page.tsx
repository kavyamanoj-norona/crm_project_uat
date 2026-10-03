import { PageHeader } from "@/components/layout/page-header";
import { requirePageAccess } from "@/server/rbac/guard";
import { FINANCE_PATHS } from "@/modules/finance/paths";

export const metadata = { title: "Receipts" };

export default async function ReceiptsPage() {
  await requirePageAccess(FINANCE_PATHS.receipts);
  return (
    <>
      <PageHeader title="Receipts" breadcrumbs={["Finance", "Receipts"]} />
      <p className="text-text-muted">Payment receipts coming soon.</p>
    </>
  );
}
