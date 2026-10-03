import { PageHeader } from "@/components/layout/page-header";
import { requirePageAccess } from "@/server/rbac/guard";
import { FINANCE_PATHS } from "@/modules/finance/paths";

export const metadata = { title: "Ledger" };

export default async function LedgerPage() {
  await requirePageAccess(FINANCE_PATHS.ledger);
  return (
    <>
      <PageHeader title="Ledger" breadcrumbs={["Finance", "Ledger"]} />
      <p className="text-text-muted">Account ledger coming soon.</p>
    </>
  );
}
