import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { confirmBill, scanBill } from "@/modules/inventory/actions/billing";
import { getGstRates } from "@/modules/inventory/config";
import { previewNextUsid } from "@/modules/inventory/usid";
import { listBillableItems, listSuppliers, listWarranties } from "@/modules/inventory/billing-queries";
import { BillEntry } from "@/modules/inventory/components/bill-entry";
import { INVENTORY_PATHS } from "@/modules/inventory/paths";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "New bill" };

export default async function NewBillPage() {
  const { permission } = await requirePageAccess(INVENTORY_PATHS.billing);
  if (!permission.canCreate) redirect("/forbidden");

  const [catalog, suppliers, nextUsid, gstRates, warranties] = await Promise.all([listBillableItems(), listSuppliers(), previewNextUsid(), getGstRates(), listWarranties()]);

  return (
    <>
      <PageHeader
        title="New Purchase Bill"
        breadcrumbs={["Inventory", "Billing", "New bill"]}
        actions={
          <LinkButton href={INVENTORY_PATHS.billing} variant="secondary">
            <ArrowLeft className="size-4" /> Back to list
          </LinkButton>
        }
      />
      <BillEntry
        scanAction={scanBill}
        nextUsid={nextUsid}
        gstRates={gstRates}
        warranties={warranties}
        confirmAction={confirmBill}
        catalog={catalog}
        suppliers={suppliers}
      />
    </>
  );
}
