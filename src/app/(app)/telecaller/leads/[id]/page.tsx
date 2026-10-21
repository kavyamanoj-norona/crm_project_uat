import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { CUSTOMER_PATHS } from "@/modules/customers/paths";
import { recordTelecallerCall } from "@/modules/telecaller/actions";
import { CallDialog } from "@/modules/telecaller/components/call-dialog";
import { LeadDetail } from "@/modules/telecaller/components/lead-detail";
import { getLeadWithCalls, leadScopeWhere, listServicePrices, telecallerOwnWhere } from "@/modules/telecaller/queries";
import { getBranchScope } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";
import { isTelecaller } from "@/server/rbac/roles";

export const metadata = { title: "Lead" };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, permission } = await requirePageAccess(CUSTOMER_PATHS.leads);
  const { id } = await params;
  // Outside the user's branch scope is a 404, not a 403.
  const scopeWhere = leadScopeWhere(await getBranchScope(user));
  const lead = await getLeadWithCalls(id, isTelecaller(user) ? { AND: [scopeWhere, telecallerOwnWhere(user.id)] } : scopeWhere);
  if (!lead) notFound();
  const estimates = await listServicePrices(true);
  const canCall = permission.canEdit && !user.privilege.isBranchBound;

  return (
    <>
      <PageHeader
        title={`${lead.name} · ${lead.leadCode}`}
        subtitle={lead.purpose ?? undefined}
        breadcrumbs={["Telecaller", "Leads", lead.leadCode ?? lead.name]}
        actions={
          <div className="flex flex-wrap gap-2">
            {permission.canEdit && (
              <LinkButton href={`${CUSTOMER_PATHS.leads}?edit=${lead.id}`} variant="secondary">
                <Pencil className="size-4" />
                Edit
              </LinkButton>
            )}
            <LinkButton href={CUSTOMER_PATHS.leads} variant="secondary">
              <ArrowLeft className="size-4" />
              Back
            </LinkButton>
          </div>
        }
      />
      <LeadDetail
        lead={lead}
        estimates={estimates}
        actions={canCall ? <CallDialog title={`Record call — ${lead.name}`} action={recordTelecallerCall.bind(null, lead.id)} /> : undefined}
      />
    </>
  );
}
