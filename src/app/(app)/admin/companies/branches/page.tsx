import { db } from "@/server/db";
import { ActiveBadge, Badge } from "@/components/ui/badge";
import { ListView } from "@/components/data/list-view";
import { listState } from "@/lib/list";
import { saveBranch } from "@/modules/admin/actions/save";
import { toggleActive } from "@/modules/admin/actions/toggle";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { CompanyTabs } from "@/modules/admin/components/company-tabs";
import { EntityForm, type FieldConfig } from "@/modules/admin/components/entity-form";
import { RowActions } from "@/modules/admin/components/row-actions";
import { ADMIN_PATHS } from "@/modules/admin/paths";
import { BRANCH_SORTS, listBranches } from "@/modules/admin/queries";
import { BRANCH_TYPE_LABELS, branchTypeOptions } from "@/modules/admin/schemas";
import { bpToInput, formatPercent } from "@/lib/percent";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Branches" };

export default async function BranchesPage({ searchParams }: PageProps<"/admin/companies/branches">) {
  const { permission } = await requirePageAccess(ADMIN_PATHS.branches);
  const sp = await searchParams;
  const list = listState(ADMIN_PATHS.branches, sp, { sorts: BRANCH_SORTS, defaultSort: "name", defaultDir: "asc" });
  const editId = param(sp, "edit");
  const [{ rows, total, tabs }, editing, companies] = await Promise.all([
    listBranches(list),
    editId && permission.canEdit ? db.branch.findUnique({ where: { id: editId } }) : null,
    db.company.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const fields: FieldConfig[] = [
    {
      name: "companyId",
      label: "Company",
      type: "select",
      required: true,
      options: companies.map((c) => ({ value: c.id, label: c.name })),
    },
    { name: "code", label: "Branch code", required: true, placeholder: "Enter branch code", hint: "Used in jobsheet numbers" },
    { name: "name", label: "Branch name", required: true, placeholder: "Enter branch name" },
    {
      name: "branchType",
      label: "Branch type",
      type: "select",
      required: true,
      placeholder: "Select branch type",
      options: branchTypeOptions,
    },
    {
      name: "companyShare",
      label: "Company share (%)",
      required: true,
      placeholder: "Enter company share",
      hint: "Share of revenue and settlements kept by the company",
      showWhen: { field: "branchType", value: "FRANCHISE" },
    },
    {
      name: "franchiseShare",
      label: "Franchise owner share (%)",
      required: true,
      placeholder: "Enter franchise owner share",
      hint: "Company and franchise owner shares must add up to 100%",
      showWhen: { field: "branchType", value: "FRANCHISE" },
    },
    { name: "phone", label: "Phone" },
    { name: "address", label: "Address", type: "textarea", span: 2 },
    { name: "isVirtual", label: "Virtual branch (e.g. lab)", type: "switch" },
    { name: "isActive", label: "Active", type: "switch" },
  ];

  return (
    <AdminPage
      title="Company"
      saved={param(sp, "saved")}
      nav={<CompanyTabs active="branches" />}
      form={
        (editing ? permission.canEdit : permission.canCreate)
          ? {
              label: "Add Branch",
              editingTitle: editing?.name,
              cancelHref: ADMIN_PATHS.branches,
              content:
                companies.length === 0 ? (
                  <p className="text-sm text-text-muted">Create a company first.</p>
                ) : (
                  <EntityForm
                    fields={fields}
                    schema="branch" action={saveBranch}
                    id={editing?.id}
                    initial={
                      editing
                        ? {
                            ...editing,
                            companyShare: bpToInput(editing.companyShareBp),
                            franchiseShare: bpToInput(editing.franchiseShareBp),
                          }
                        : { isActive: true, companyId: companies[0]?.id, branchType: "COMPANY_OWNED" }
                    }
                  />
                ),
            }
          : undefined
      }
    >
      <ListView
        list={list}
        total={total}
        tabs={tabs}
        rows={rows}
        rowKey={(r) => r.id}
        highlight={(r) => r.id === editing?.id}
        searchPlaceholder="Search branch or company…"
        columns={[
          { header: "#", cell: (_, i) => i + 1 },
          { header: "Code", sort: "code", cell: (r) => <span className="font-medium">{r.code}</span> },
          {
            header: "Name",
            sort: "name",
            cell: (r) => (
              <span className="flex items-center gap-2">
                {r.name}
                {r.isVirtual && <Badge tone="primary">Virtual</Badge>}
              </span>
            ),
          },
          { header: "Company", sort: "company", cell: (r) => r.company.name },
          {
            header: "Type",
            sort: "branchType",
            cell: (r) => (
              <Badge tone={r.branchType === "FRANCHISE" ? "violet" : "navy"}>{BRANCH_TYPE_LABELS[r.branchType]}</Badge>
            ),
          },
          {
            header: "Company / Franchise share",
            cell: (r) =>
              r.branchType === "FRANCHISE" ? (
                <span className="tabular-nums">
                  {formatPercent(r.companyShareBp)} / {formatPercent(r.franchiseShareBp)}
                </span>
              ) : (
                <span className="text-text-muted">—</span>
              ),
          },
          { header: "Phone", cell: (r) => r.phone ?? "—" },
          { header: "Users", cell: (r) => r._count.users, align: "center" },
          { header: "Status", cell: (r) => <ActiveBadge active={r.isActive} /> },
          {
            header: "Action",
            cell: (r) =>
              permission.canEdit && (
                <RowActions
                  editHref={`${ADMIN_PATHS.branches}?edit=${r.id}`}
                  toggle={toggleActive.bind(null, "branch", r.id)}
                  active={r.isActive}
                />
              ),
          },
        ]}
      />
    </AdminPage>
  );
}
