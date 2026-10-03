import { PageHeader } from "@/components/layout/page-header";
import { requirePageAccess } from "@/server/rbac/guard";
import { FINANCE_PATHS } from "@/modules/finance/paths";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage() {
  await requirePageAccess(FINANCE_PATHS.invoices);
  return (
    <>
      <PageHeader title="Invoices" breadcrumbs={["Finance", "Invoices"]} />
      <p className="text-text-muted">Invoice management coming soon.</p>
    </>
  );
}
