import { Suspense } from "react";
import { requirePageAccess } from "@/server/rbac/guard";
import { SALES_PATHS } from "@/modules/sales/paths";
import { listSalesTargets, listActiveBranches, type SalesTargetRow } from "@/server/sales/target-queries";
import { deleteSalesTarget } from "@/server/sales/target-actions";
import { PageHeader } from "@/components/layout/page-header";
import { CreateTargetForm } from "./create-target-form";
import { TargetTableClient } from "./target-table-client";

export const metadata = { title: "Sales Targets" };

type PageProps = { searchParams: Promise<Record<string, string>> };

export default async function SalesTargetPage({ searchParams }: PageProps) {
  const { permission } = await requirePageAccess(SALES_PATHS.target);
  const sp = await searchParams;

  const [targets, branches] = await Promise.all([
    listSalesTargets(),
    listActiveBranches(),
  ]);

  return (
    <div>
      <PageHeader
        title="Sales Targets"
        breadcrumbs={["Sales", "Manage", "Sales Targets"]}
      />

      {/* Create form */}
      {permission.canCreate && (
        <div className="mb-6">
          <CreateTargetForm branches={branches} />
        </div>
      )}

      {/* Table with client-side filters */}
      <Suspense>
        <TargetTableClient
          targets={targets}
          branches={branches}
          canDelete={permission.canDelete}
          deleteAction={deleteSalesTarget}
          searchParams={sp}
        />
      </Suspense>
    </div>
  );
}
