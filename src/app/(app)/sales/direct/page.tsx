import { PageHeader } from "@/components/layout/page-header";
import { requirePageAccess } from "@/server/rbac/guard";
import { getBranchScope } from "@/server/branch-scope";
import { SALES_PATHS } from "@/modules/sales/paths";
import { listAccessoryStock, listRefurbStock, listBuybacks } from "@/server/sales/queries";
import { sellAccessory, recordBuyback, addRefurbItem, sellRefurbItem } from "@/server/sales/actions";
import { AccessoriesPanel } from "./accessories-panel";
import { RefurbPanel } from "./refurb-panel";
import { BuybackPanel } from "./buyback-panel";

export const metadata = { title: "Direct Sales" };

export default async function DirectSalesPage() {
  const { user } = await requirePageAccess(SALES_PATHS.direct);
  const scope = await getBranchScope(user);

  const [accessories, refurb, buybacks] = await Promise.all([
    listAccessoryStock(scope),
    listRefurbStock(scope),
    listBuybacks(scope),
  ]);

  return (
    <>
      <PageHeader title="Direct Sales" breadcrumbs={["Sales", "Direct Sales"]} />
      <div className="grid gap-4 lg:grid-cols-3">
        <AccessoriesPanel rows={accessories} sellAction={sellAccessory} />
        <RefurbPanel rows={refurb} sellAction={sellRefurbItem} addAction={addRefurbItem} />
        <BuybackPanel rows={buybacks} recordAction={recordBuyback} />
      </div>
    </>
  );
}
