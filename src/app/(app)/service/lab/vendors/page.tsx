import Link from "next/link";
import { Pencil } from "lucide-react";
import { db } from "@/server/db";
import { Badge } from "@/components/ui/badge";
import { ListView } from "@/components/data/list-view";
import { listState } from "@/lib/list";
import { formatDate } from "@/lib/dates";
import { requirePageAccess } from "@/server/rbac/guard";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { FlagToggle } from "@/modules/admin/components/flag-toggle";
import { SERVICE_PATHS } from "@/modules/service/paths";
import { VENDOR_SORTS, listVendorsPage, type VendorPageRow } from "@/modules/service/chip-lab-queries";
import { saveVendor, toggleVendorActive } from "@/modules/service/actions/vendor";
import { VendorForm, type VendorFormValues } from "@/modules/service/components/vendor-form";

export const metadata = { title: "Vendors" };

const iconLink =
  "inline-flex size-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted hover:text-text";

export default async function VendorsPage({ searchParams }: PageProps<"/service/lab/vendors">) {
  const { permission } = await requirePageAccess(SERVICE_PATHS.vendors);
  const sp = await searchParams;
  const list = listState(SERVICE_PATHS.vendors, sp, { sorts: VENDOR_SORTS, defaultSort: "createdAt", defaultPageSize: 50 });
  const editId = param(sp, "edit");
  const highlight = param(sp, "highlight") ?? editId;

  const [{ rows, total, tabs }, editing] = await Promise.all([
    listVendorsPage(list),
    editId && permission.canEdit ? db.chipLabVendor.findUnique({ where: { id: editId } }) : null,
  ]);

  const initial: VendorFormValues | undefined = editing
    ? {
        name: editing.name,
        contactName: editing.contactName ?? "",
        phone: editing.phone ?? "",
        email: editing.email ?? "",
        address: editing.address ?? "",
        remarks: editing.remarks ?? "",
      }
    : undefined;

  const bind = (id: string) => (permission.canEdit ? toggleVendorActive.bind(null, id) : undefined);

  return (
    <AdminPage
      title="Vendors"
      group="Service"
      subtitle="External chip-level repair partners"
      saved={param(sp, "saved")}
      form={
        (editing ? permission.canEdit : permission.canCreate)
          ? {
              label: "Add Vendor",
              editingTitle: editing ? editing.name : undefined,
              cancelHref: SERVICE_PATHS.vendors,
              content: <VendorForm action={saveVendor} initial={initial} id={editing?.id} />,
            }
          : undefined
      }
    >
      <ListView
        list={list}
        total={total}
        tabs={tabs}
        rows={rows}
        rowKey={(v) => v.id}
        highlight={(v) => v.id === highlight}
        searchPlaceholder="Search by name, contact, phone or email"
        empty="No vendors added yet."
        columns={[
          { header: "#", cell: (_, i) => i + 1 },
          { header: "Date", sort: "createdAt", cell: (v) => formatDate(v.createdAt) },
          {
            header: "Name",
            sort: "name",
            cell: (v) => (
              <div>
                <span className="font-medium">{v.name}</span>
                {v.contactName && <span className="block text-xs text-text-muted">{v.contactName}</span>}
              </div>
            ),
          },
          { header: "Phone", cell: (v) => v.phone ?? "—" },
          { header: "Email", cell: (v) => v.email ?? "—" },
          { header: "Address", cell: (v) => <span className="text-xs">{v.address ?? "—"}</span> },
          {
            header: "Status",
            cell: (v) => <Badge tone={v.isActive ? "success" : "neutral"}>{v.isActive ? "Active" : "Inactive"}</Badge>,
          },
          {
            header: "Enabled",
            align: "center",
            cell: (v) => <FlagToggle on={v.isActive} label="Enabled" action={bind(v.id)} />,
          },
          ...(permission.canEdit
            ? [
                {
                  header: "Action",
                  cell: (v: VendorPageRow) => (
                    <span className="flex items-center gap-1">
                      <Link
                        href={`${SERVICE_PATHS.vendors}?edit=${v.id}`}
                        className={iconLink}
                        aria-label="Edit"
                        title="Edit"
                      >
                        <Pencil className="size-4" />
                      </Link>
                    </span>
                  ),
                },
              ]
            : []),
        ]}
      />
    </AdminPage>
  );
}
