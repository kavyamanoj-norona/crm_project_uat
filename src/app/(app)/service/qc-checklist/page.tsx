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
import { QC_CHECKLIST_SORTS, listQcChecklistPage, type QcChecklistPageRow } from "@/modules/service/qc-checklist-queries";
import { saveQcChecklistItem, toggleQcChecklistActive } from "@/modules/service/actions/qc-checklist";
import { QcChecklistForm, type QcChecklistFormValues } from "@/modules/service/components/qc-checklist-form";

export const metadata = { title: "QC Checklist" };

const iconLink =
  "inline-flex size-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted hover:text-text";

export default async function QcChecklistPage({ searchParams }: PageProps<"/service/qc-checklist">) {
  const { permission } = await requirePageAccess(SERVICE_PATHS.qcChecklist);
  const sp = await searchParams;
  const list = listState(SERVICE_PATHS.qcChecklist, sp, {
    sorts: QC_CHECKLIST_SORTS,
    defaultSort: "createdAt",
    defaultPageSize: 50,
  });
  const editId = param(sp, "edit");
  const highlight = param(sp, "highlight") ?? editId;

  const [{ rows, total, tabs }, editing] = await Promise.all([
    listQcChecklistPage(list),
    editId && permission.canEdit ? db.qcChecklistItem.findUnique({ where: { id: editId } }) : null,
  ]);

  const initial: QcChecklistFormValues | undefined = editing
    ? { title: editing.title, description: editing.description ?? "" }
    : undefined;

  const bind = (id: string) => (permission.canEdit ? toggleQcChecklistActive.bind(null, id) : undefined);

  return (
    <AdminPage
      title="QC Checklist"
      group="Service"
      subtitle="Quality-check points verified before a chip-level case leaves the lab"
      saved={param(sp, "saved")}
      form={
        (editing ? permission.canEdit : permission.canCreate)
          ? {
              label: "Add Checklist Item",
              editingTitle: editing ? editing.title : undefined,
              cancelHref: SERVICE_PATHS.qcChecklist,
              content: <QcChecklistForm action={saveQcChecklistItem} initial={initial} id={editing?.id} />,
            }
          : undefined
      }
    >
      <ListView
        list={list}
        total={total}
        tabs={tabs}
        rows={rows}
        rowKey={(q) => q.id}
        highlight={(q) => q.id === highlight}
        searchPlaceholder="Search by item or description"
        empty="No checklist items added yet."
        columns={[
          { header: "#", cell: (_, i) => i + 1 },
          { header: "Date", sort: "createdAt", cell: (q) => formatDate(q.createdAt) },
          { header: "Checklist item", sort: "title", cell: (q) => <span className="font-medium">{q.title}</span> },
          {
            header: "Description",
            cell: (q) => <span className="text-xs text-text-muted">{q.description ?? "—"}</span>,
          },
          {
            header: "Status",
            cell: (q) => <Badge tone={q.isActive ? "success" : "neutral"}>{q.isActive ? "Active" : "Inactive"}</Badge>,
          },
          {
            header: "Enabled",
            align: "center",
            cell: (q) => <FlagToggle on={q.isActive} label="Enabled" action={bind(q.id)} />,
          },
          ...(permission.canEdit
            ? [
                {
                  header: "Action",
                  cell: (q: QcChecklistPageRow) => (
                    <span className="flex items-center gap-1">
                      <Link
                        href={`${SERVICE_PATHS.qcChecklist}?edit=${q.id}`}
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
