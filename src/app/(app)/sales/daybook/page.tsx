import { PageHeader } from "@/components/layout/page-header";
import { requirePageAccess } from "@/server/rbac/guard";
import { SALES_PATHS } from "@/modules/sales/paths";

export const metadata = { title: "Daybook & Expenses" };

export default async function DaybookPage() {
  await requirePageAccess(SALES_PATHS.daybook);
  return (
    <>
      <PageHeader title="Daybook & Expenses" breadcrumbs={["Sales", "Daybook & Expenses"]} />
      <p className="text-text-muted">Daily cash book and expense tracking coming soon.</p>
    </>
  );
}
