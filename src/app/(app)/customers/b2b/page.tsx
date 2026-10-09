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
import { saveB2bAccount } from "@/modules/customers/b2b-actions";
import { B2bForm, type B2bFormValues } from "@/modules/customers/components/b2b-form";
import { B2B_SORTS, getB2bAccount, listB2bAccounts } from "@/modules/customers/b2b-queries";
import { toggleCustomerActive } from "@/modules/customers/actions";
import { CUSTOMER_PATHS } from "@/modules/customers/paths";
import { VIP_MIN_VISITS } from "@/modules/customers/schemas";
import { requirePageAccess } from "@/server/rbac/guard";
import { getBranchScope } from "@/server/branch-scope";

export const metadata = { title: "B2B Accounts" };

const iconLink =
  "inline-flex size-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted hover:text-text";

export default async function B2bAccountsPage({ searchParams }: PageProps<"/customers/b2b">) {
  const { user, permission } = await requirePageAccess(CUSTOMER_PATHS.b2b);
  const scope = await getBranchScope(user);
  const sp = await searchParams;
  const list = listState(CUSTOMER_PATHS.b2b, sp, { sorts: B2B_SORTS, defaultSort: "createdAt", defaultPageSize: 25 });
  const editId = param(sp, "edit");
  const highlight = param(sp, "highlight") ?? editId;

  const [{ rows, total, tabs }, editing] = await Promise.all([
    listB2bAccounts(list, scope),
    editId && permission.canEdit ? getB2bAccount(editId, scope) : null,
  ]);

  const initial: B2bFormValues | undefined = editing
    ? {
        name: editing.name,
        gstin: editing.gstin ?? "",
        contactPerson: editing.contactPerson ?? "",
        phone: editing.phone,
        altPhone: editing.altPhone ?? "",
        email: editing.email ?? "",
        state: editing.state ?? "",
        district: editing.district ?? "",
        pincode: editing.pincode ?? "",
        address: editing.address ?? "",
        notes: editing.notes ?? "",
      }
    : undefined;

  return (
    <AdminPage
      title="B2B Accounts"
      group="Customers & Support"
      subtitle={`${tabs[0]?.count ?? 0} active accounts · ${scope.branch ? `${scope.branch.name} (${scope.branch.code})` : "all branches"} · pick an account on a case to bill the company`}
      saved={param(sp, "saved")}
      form={
        (editing ? permission.canEdit : permission.canCreate)
          ? {
              label: "Add B2B Account",
              editingTitle: editing ? `${editing.name} (${editing.code})` : undefined,
              cancelHref: CUSTOMER_PATHS.b2b,
              content: <B2bForm action={saveB2bAccount} initial={initial} id={editing?.id} cancelHref={CUSTOMER_PATHS.b2b} />,
            }
          : undefined
      }
    >
      <ListView
        list={list}
        total={total}
        tabs={tabs}
        rows={rows}
        rowKey={(a) => a.id}
        highlight={(a) => a.id === highlight}
        searchPlaceholder="Search by business, GSTIN, contact or phone"
        empty="No B2B accounts yet."
        columns={[
          { header: "#", cell: (_, i) => i + 1 },
          { header: "Created", sort: "createdAt", cell: (a) => formatDate(a.createdAt) },
          { header: "Code", sort: "code", cell: (a) => <span className="font-medium">{a.code}</span> },
          {
            header: "Business",
            sort: "name",
            cell: (a) => (
              <Link href={`${CUSTOMER_PATHS.database}/${a.id}`} className="flex items-center gap-2 font-medium hover:text-primary">
                {a.name}
                {a.visitCount >= VIP_MIN_VISITS && <Badge tone="violet">VIP</Badge>}
                {!a.isActive && <Badge>Inactive</Badge>}
              </Link>
            ),
          },
          { header: "GSTIN", cell: (a) => (a.gstin ? <span className="tabular-nums">{a.gstin}</span> : "—") },
          { header: "Contact person", cell: (a) => a.contactPerson ?? "—" },
          { header: "Phone", sort: "phone", cell: (a) => formatPhone(a.phone) },
          { header: "Email", cell: (a) => a.email ?? "—" },
          {
            header: "Branch",
            cell: (a) => (a.branch ? `${a.branch.name} (${a.branch.code})` : <span className="text-text-muted">—</span>),
          },
          { header: "Cases", align: "center", cell: (a) => a._count.accountCases },
          { header: "Last visit", sort: "lastVisitAt", cell: (a) => formatDate(a.lastVisitAt) },
          { header: "Last updated", sort: "updatedAt", cell: (a) => <WhoWhen by={a.updatedBy} at={a.updatedAt} /> },
          {
            header: "Action",
            cell: (a) => (
              <RowActions
                editHref={permission.canEdit ? `${CUSTOMER_PATHS.b2b}?edit=${a.id}` : undefined}
                toggle={permission.canEdit ? toggleCustomerActive.bind(null, a.id) : undefined}
                active={a.isActive}
              >
                <Link href={`${CUSTOMER_PATHS.database}/${a.id}`} className={iconLink} aria-label="View" title="View">
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
