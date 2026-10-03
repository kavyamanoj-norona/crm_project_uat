import { PageHeader } from "@/components/layout/page-header";
import { requirePageAccess } from "@/server/rbac/guard";
import { FINANCE_PATHS } from "@/modules/finance/paths";

export const metadata = { title: "Pending Dues" };

export default async function PendingDuesPage() {
  await requirePageAccess(FINANCE_PATHS.pendingDues);
  return (
    <>
      <PageHeader title="Pending Dues" breadcrumbs={["Finance", "Pending Dues"]} />
      <p className="text-text-muted">Outstanding payment tracking coming soon.</p>
    </>
  );
}
