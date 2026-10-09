import Link from "next/link";
import { Eye, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ListView } from "@/components/data/list-view";
import { WhoWhen } from "@/components/data/who-when";
import { ActionDialog } from "@/components/forms/action-dialog";
import { listState } from "@/lib/list";
import { formatDate } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { EntityForm, type FieldConfig } from "@/modules/admin/components/entity-form";
import { RowActions } from "@/modules/admin/components/row-actions";
import { convertLeadWithConfirm, saveLead, toggleLeadActive } from "@/modules/customers/lead-actions";
import { LEAD_SORTS, getLead, listLeads } from "@/modules/customers/lead-queries";
import { CUSTOMER_PATHS } from "@/modules/customers/paths";
import { LEAD_SOURCE_LABELS, leadEntrySourceOptions } from "@/modules/customers/schemas";
import { requirePageAccess } from "@/server/rbac/guard";
import { getBranchScope } from "@/server/branch-scope";

export const metadata = { title: "Leads" };

const iconLink =
  "inline-flex size-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted hover:text-text";

// Name, mobile number and purpose are mandatory for a lead.
const LEAD_FIELDS_CONFIG: FieldConfig[] = [
  { name: "name", label: "Name", required: true, placeholder: "Enter name" },
  { name: "phone", label: "Mobile number", required: true, placeholder: "Enter mobile number" },
  { name: "email", label: "Email", type: "email", placeholder: "Enter email" },
  { name: "source", label: "Source", type: "select", placeholder: "Select source", options: leadEntrySourceOptions },
  { name: "purpose", label: "Purpose", type: "textarea", required: true, span: 2, placeholder: "Enter purpose of the enquiry" },
  { name: "notes", label: "Notes", type: "textarea", span: 2, placeholder: "Enter notes" },
];

export default async function LeadsPage({ searchParams }: PageProps<"/customers/leads">) {
  const { user, permission } = await requirePageAccess(CUSTOMER_PATHS.leads);
  const scope = await getBranchScope(user);
  const sp = await searchParams;
  const list = listState(CUSTOMER_PATHS.leads, sp, { sorts: LEAD_SORTS, defaultSort: "createdAt", defaultPageSize: 25 });
  const editId = param(sp, "edit");
  const highlight = param(sp, "highlight") ?? editId;

  const [{ rows, total, tabs }, editing] = await Promise.all([
    listLeads(list, scope),
    editId && permission.canEdit ? getLead(editId, scope) : null,
  ]);

  const initial = editing
    ? {
        name: editing.name,
        phone: editing.phone,
        email: editing.email ?? "",
        source: editing.source ?? "",
        purpose: editing.purpose ?? "",
        notes: editing.notes ?? "",
      }
    : undefined;

  return (
    <AdminPage
      title="Leads"
      group="Customers & Support"
      subtitle={`${tabs[0]?.count ?? 0} open leads · ${scope.branch ? `${scope.branch.name} (${scope.branch.code})` : "all branches"} · website enquiries arrive here automatically`}
      saved={param(sp, "saved")}
      form={
        (editing ? permission.canEdit : permission.canCreate)
          ? {
              label: "Add Lead",
              editingTitle: editing ? `${editing.name} (${editing.code})` : undefined,
              cancelHref: CUSTOMER_PATHS.leads,
              content: (
                <EntityForm
                  fields={LEAD_FIELDS_CONFIG}
                  schema="lead"
                  action={saveLead}
                  initial={initial}
                  id={editing?.id}
                  cancelHref={CUSTOMER_PATHS.leads}
                  submitLabel={editing ? "Update" : "Save lead"}
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
        rowKey={(l) => l.id}
        highlight={(l) => l.id === highlight}
        searchPlaceholder="Search by name, mobile, lead ID or purpose"
        empty="No leads here yet."
        columns={[
          { header: "#", cell: (_, i) => i + 1 },
          { header: "Created", sort: "createdAt", cell: (l) => formatDate(l.createdAt) },
          {
            header: "Lead ID",
            sort: "code",
            cell: (l) => <span className="font-medium">{l.leadCode}</span>,
          },
          {
            header: "Name",
            sort: "name",
            cell: (l) => (
              <span className="flex items-center gap-2 font-medium">
                {l.name}
                {l.kind === "CUSTOMER" && <Badge tone="success">Converted</Badge>}
                {l.kind === "LEAD" && !l.isActive && <Badge>Closed</Badge>}
              </span>
            ),
          },
          { header: "Mobile", sort: "phone", cell: (l) => formatPhone(l.phone) },
          {
            header: "Purpose",
            cell: (l) => <span className="block max-w-64 truncate" title={l.purpose ?? undefined}>{l.purpose ?? "—"}</span>,
          },
          { header: "Email", cell: (l) => l.email ?? "—" },
          { header: "Source", cell: (l) => (l.source ? LEAD_SOURCE_LABELS[l.source] : "—") },
          {
            header: "Branch",
            cell: (l) => (l.branch ? `${l.branch.name} (${l.branch.code})` : <span className="text-text-muted">Unassigned</span>),
          },
          {
            header: "Customer ID",
            cell: (l) =>
              l.kind === "CUSTOMER" ? (
                <Link href={`${CUSTOMER_PATHS.database}/${l.id}`} className="font-medium hover:text-primary">
                  {l.code}
                </Link>
              ) : (
                <span className="text-text-muted">—</span>
              ),
          },
          { header: "Created by", cell: (l) => <WhoWhen by={l.createdBy} at={l.createdAt} /> },
          {
            header: "Converted",
            cell: (l) => (l.convertedAt ? <WhoWhen by={l.convertedBy} at={l.convertedAt} /> : <span className="text-text-muted">—</span>),
          },
          {
            header: "Action",
            cell: (l) =>
              l.kind === "CUSTOMER" ? (
                <Link href={`${CUSTOMER_PATHS.database}/${l.id}`} className={iconLink} aria-label="View customer" title="View customer">
                  <Eye className="size-4" />
                </Link>
              ) : (
                <RowActions
                  editHref={permission.canEdit ? `${CUSTOMER_PATHS.leads}?edit=${l.id}` : undefined}
                  toggle={permission.canEdit ? toggleLeadActive.bind(null, l.id) : undefined}
                  active={l.isActive}
                >
                  {permission.canEdit && l.isActive && (
                    <ActionDialog
                      trigger={
                        <>
                          <UserCheck className="size-4" /> Convert
                        </>
                      }
                      title={`Convert ${l.name} to customer`}
                      description={`${l.leadCode} becomes a customer on the same record. Nothing is duplicated and the Lead ID is kept for reports.`}
                      action={convertLeadWithConfirm.bind(null, l.id)}
                      submitLabel="Convert to customer"
                    >
                      <p className="text-sm text-text-muted">
                        {l.name} · {formatPhone(l.phone)}
                        {l.purpose ? ` · ${l.purpose}` : ""}
                      </p>
                    </ActionDialog>
                  )}
                </RowActions>
              ),
          },
        ]}
      />
    </AdminPage>
  );
}
