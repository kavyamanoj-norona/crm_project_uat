import { PageHeader } from "@/components/layout/page-header";
import { requirePageAccess } from "@/server/rbac/guard";
import { FINANCE_PATHS } from "@/modules/finance/paths";

export const metadata = { title: "Credit Notes" };

export default async function CreditNotesPage() {
  await requirePageAccess(FINANCE_PATHS.creditNotes);
  return (
    <>
      <PageHeader title="Credit Notes" breadcrumbs={["Finance", "Credit Notes"]} />
      <p className="text-text-muted">Credit note management coming soon.</p>
    </>
  );
}
