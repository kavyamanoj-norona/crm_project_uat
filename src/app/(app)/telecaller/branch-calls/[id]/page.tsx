import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { recordBranchCall } from "@/modules/telecaller/actions";
import { CallDialog } from "@/modules/telecaller/components/call-dialog";
import { LeadDetail } from "@/modules/telecaller/components/lead-detail";
import { TELECALLER_PATHS } from "@/modules/telecaller/paths";
import { getLeadWithCalls, listServicePrices } from "@/modules/telecaller/queries";
import { branchWhere, getBranchScope } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Branch call" };

export default async function BranchCallPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, permission } = await requirePageAccess(TELECALLER_PATHS.branchCalls);
  const { id } = await params;
  // Only leads Head Office assigned to the user's branch; anything else is a 404, not a 403.
  const lead = await getLeadWithCalls(id, { ...branchWhere(await getBranchScope(user)), leadProfile: { assignedToBranchAt: { not: null } } });
  if (!lead) notFound();
  const estimates = await listServicePrices(true);
  const canUpdate = permission.canEdit && (user.privilege.isBranchBound || user.privilege.isSuperAdmin);

  return (
    <>
      <PageHeader
        title={`${lead.name} · ${lead.leadCode}`}
        subtitle={lead.purpose ?? undefined}
        breadcrumbs={["Telecaller", "Branch Call List", lead.leadCode ?? lead.name]}
        actions={
          <LinkButton href={TELECALLER_PATHS.branchCalls} variant="secondary">
            <ArrowLeft className="size-4" />
            Back
          </LinkButton>
        }
      />
      <LeadDetail
        lead={lead}
        estimates={estimates}
        actions={canUpdate ? <CallDialog title={`Update call — ${lead.name}`} label="Update outcome" action={recordBranchCall.bind(null, lead.id)} showStatus={false} /> : undefined}
      />
    </>
  );
}
