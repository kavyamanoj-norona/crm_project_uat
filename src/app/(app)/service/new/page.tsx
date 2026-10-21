import { PageHeader } from "@/components/layout/page-header";
import { createCase, lookupCustomer } from "@/modules/service/actions/intake";
import { IntakeForm } from "@/modules/service/components/intake-form";
import { SERVICE_PATHS } from "@/modules/service/paths";
import { intakeOptions } from "@/modules/service/queries";
import { getBranchScope } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";
import { isOnsitePickup } from "@/server/rbac/roles";

export const metadata = { title: "New Case" };

export default async function NewCasePage({ searchParams }: PageProps<"/service/new">) {
  const { user, permission } = await requirePageAccess(SERVICE_PATHS.newCase);
  const scope = await getBranchScope(user);
  const onsite = isOnsitePickup(user);
  const options = await intakeOptions(scope, onsite);
  const sp = await searchParams;
  const created = typeof sp.created === "string" ? sp.created : null;

  const blocked = !permission.canCreate
    ? "Your privilege can view this screen but not create cases."
    : options.branches.length === 0
      ? scope.branch
        ? `${scope.branch.name} doesn't take walk-ins. Pick a counter branch in the header.`
        : "Add an active, non-virtual branch in Master Settings → Company first."
      : null;

  return (
    <>
      <PageHeader
        title="New case"
        subtitle="Phone first — a repeat customer's details fill in automatically."
        breadcrumbs={["Service", "New Case (Intake)"]}
      />
      {created && (
        <p role="status" className="mb-4 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-text">
          Case <span className="font-semibold">{created}</span> created{typeof sp.branch === "string" ? ` and assigned to ${sp.branch}` : ""}.
          {sp.photos === "failed" && " The photos could not be saved; add them from the case later."}
        </p>
      )}
      {blocked ? (
        <p className="rounded-xl border border-border bg-surface p-6 text-sm text-text-muted">{blocked}</p>
      ) : (
        <IntakeForm action={createCase} lookup={lookupCustomer} options={options} onsite={onsite} />
      )}
    </>
  );
}
