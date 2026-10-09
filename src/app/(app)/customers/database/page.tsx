import Link from "next/link";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ListView } from "@/components/data/list-view";
import { WhoWhen } from "@/components/data/who-when";
import { listState } from "@/lib/list";
import { formatDate } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { RowActions } from "@/modules/admin/components/row-actions";
import { saveCustomer, toggleCustomerActive } from "@/modules/customers/actions";
import { CustomerForm, type CustomerFormValues } from "@/modules/customers/components/customer-form";
import { CUSTOMER_PATHS } from "@/modules/customers/paths";
import { CUSTOMER_SORTS, getCustomer, listCustomers } from "@/modules/customers/queries";
import { LEAD_SOURCE_LABELS, VIP_MIN_VISITS, VISIT_FILTERS } from "@/modules/customers/schemas";
import { FilterSelect } from "@/components/data/filter-select";
import { requirePageAccess } from "@/server/rbac/guard";
import { getBranchScope } from "@/server/branch-scope";

export const metadata = { title: "Customer Database" };

const iconLink =
  "inline-flex size-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted hover:text-text";

export default async function CustomersPage({ searchParams }: PageProps<"/customers/database">) {
  const { user, permission } = await requirePageAccess(CUSTOMER_PATHS.database);
  const scope = await getBranchScope(user);
  const sp = await searchParams;
  const list = listState(CUSTOMER_PATHS.database, sp, { sorts: CUSTOMER_SORTS, defaultSort: "createdAt", defaultPageSize: 25 });
  const editId = param(sp, "edit");
  const highlight = param(sp, "highlight") ?? editId;

  const [{ rows, total, tabs }, editing] = await Promise.all([
    listCustomers(list, scope),
    editId && permission.canEdit ? getCustomer(editId, scope) : null,
  ]);

  const initial: CustomerFormValues | undefined = editing
    ? {
        type: editing.type,
        name: editing.name,
        phone: editing.phone,
        altPhone: editing.altPhone ?? "",
        email: editing.email ?? "",
        gstin: editing.gstin ?? "",
        source: editing.source ?? "",
        address: editing.address ?? "",
        state: editing.state ?? "",
        district: editing.district ?? "",
        pincode: editing.pincode ?? "",
        notes: editing.notes ?? "",
      }
    : undefined;

  return (
    <AdminPage
      title="Customer Database"
      group="Customers & Support"
      subtitle={`${total.toLocaleString("en-IN")} customers · ${scope.branch ? `${scope.branch.name} (${scope.branch.code})` : "all branches"} · one record per phone number`}
      saved={param(sp, "saved")}
      form={
        (editing ? permission.canEdit : permission.canCreate)
          ? {
              label: "Add Customer",
              editingTitle: editing ? `${editing.name} (${editing.code})` : undefined,
              cancelHref: CUSTOMER_PATHS.database,
              content: (
                <CustomerForm action={saveCustomer} initial={initial} id={editing?.id} cancelHref={CUSTOMER_PATHS.database} />
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
        rowKey={(c) => c.id}
        highlight={(c) => c.id === highlight}
        searchPlaceholder="Search name / phone / email / code…"
        toolbar={
          <FilterSelect
            className="sm:w-56"
            path={list.path}
            query={list.query}
            prefix={list.prefix}
            param="visits"
            label="Filter by visits"
            value={list.query[list.prefix + "visits"] ?? ""}
            options={VISIT_FILTERS.map((f) => ({ value: f.value, label: f.label }))}
          />
        }
        empty="No customers yet. They are also added automatically from New Case."
        columns={[
          { header: "#", cell: (_, i) => i + 1 },
          { header: "Created", sort: "createdAt", cell: (c) => formatDate(c.createdAt) },
          { header: "Code", sort: "code", cell: (c) => <span className="font-medium">{c.code}</span> },
          {
            header: "Customer",
            sort: "name",
            cell: (c) => (
              <Link href={`${CUSTOMER_PATHS.database}/${c.id}`} className="flex items-center gap-2 font-medium hover:text-primary">
                {c.name}
                {c.type === "BUSINESS" && <Badge tone="primary">B2B</Badge>}
                {c.visitCount >= VIP_MIN_VISITS && <Badge tone="violet">VIP</Badge>}
                {!c.isActive && <Badge>Inactive</Badge>}
              </Link>
            ),
          },
          {
            header: "Branch",
            cell: (c) => (c.branch ? `${c.branch.name} (${c.branch.code})` : <span className="text-text-muted">—</span>),
          },
          { header: "Phone", sort: "phone", cell: (c) => formatPhone(c.phone) },
          { header: "Email", cell: (c) => c.email ?? "—" },
          { header: "Visits", sort: "visitCount", align: "center", cell: (c) => c.visitCount },
          { header: "Last visit", sort: "lastVisitAt", cell: (c) => formatDate(c.lastVisitAt) },
          { header: "Source", cell: (c) => (c.source ? LEAD_SOURCE_LABELS[c.source] : "—") },
          { header: "Created by", cell: (c) => <WhoWhen by={c.createdBy} at={c.createdAt} /> },
          { header: "Last updated", sort: "updatedAt", cell: (c) => <WhoWhen by={c.updatedBy} at={c.updatedAt} /> },
          {
            header: "Action",
            cell: (c) => (
              <RowActions
                editHref={permission.canEdit ? `${CUSTOMER_PATHS.database}?edit=${c.id}` : undefined}
                toggle={permission.canEdit ? toggleCustomerActive.bind(null, c.id) : undefined}
                active={c.isActive}
              >
                <Link href={`${CUSTOMER_PATHS.database}/${c.id}`} className={iconLink} aria-label="View" title="View">
                  <Eye className="size-4" />
                </Link>
              </RowActions>
            ),
          },
        ]}
      />
    </AdminPage>
  );
}
