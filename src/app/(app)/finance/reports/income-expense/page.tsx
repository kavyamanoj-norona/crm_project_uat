import { PageHeader } from "@/components/layout/page-header";
import { requirePageAccess } from "@/server/rbac/guard";
import { FINANCE_PATHS } from "@/modules/finance/paths";

export const metadata = { title: "Income & Expense" };

export default async function IncomeExpensePage() {
  await requirePageAccess(FINANCE_PATHS.reportsIncomeExpense);
  return (
    <>
      <PageHeader title="Income & Expense" breadcrumbs={["Finance", "Reports", "Income & Expense"]} />
      <p className="text-text-muted">Income and expense report coming soon.</p>
    </>
  );
}
