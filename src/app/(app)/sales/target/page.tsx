import Link from "next/link";
import { Pencil } from "lucide-react";
import { db } from "@/server/db";
import { ListView } from "@/components/data/list-view";
import { Badge } from "@/components/ui/badge";
import { DeleteButton } from "@/components/ui/delete-button";
import { listState } from "@/lib/list";
import { formatPaise } from "@/lib/money";
import { requirePageAccess } from "@/server/rbac/guard";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { SALES_PATHS } from "@/modules/sales/paths";
import { TargetForm, type TargetFormValues } from "@/modules/sales/components/target-form";
import { TARGET_SORTS, listActiveBranches, listSalesTargetsPage } from "@/server/sales/target-queries";
import { deleteSalesTarget, saveSalesTarget } from "@/server/sales/target-actions";

export const metadata = { title: "Sales Targets" };

const iconLink =
  "inline-flex size-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted hover:text-text";

const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PERIOD_LABELS = { DAILY: "Daily", MONTHLY: "Monthly", YEARLY: "Yearly" } as const;
const PERIOD_TONE = { DAILY: "primary", MONTHLY: "violet", YEARLY: "success" } as const;

function targetDate(period: string, year: number, month: number | null, day: number | null) {
  if (period === "DAILY" && month && day) return `${day} ${MONTH_NAMES[month]} ${year}`;
  if (period === "MONTHLY" && month) return `${MONTH_NAMES[month]} ${year}`;
  return String(year);
}

export default async function SalesTargetPage({ searchParams }: PageProps<"/sales/target">) {
  const { permission } = await requirePageAccess(SALES_PATHS.target);
  const sp = await searchParams;
  const list = listState(SALES_PATHS.target, sp, { sorts: TARGET_SORTS, defaultSort: "createdAt", defaultPageSize: 25 });
  const editId = param(sp, "edit");
  const highlight = editId;

  const [{ rows, total, tabs }, branches, editing] = await Promise.all([
    listSalesTargetsPage(list),
    listActiveBranches(),
    editId && permission.canEdit ? db.salesTarget.findUnique({ where: { id: editId }, include: { branch: { select: { name: true } } } }) : null,
  ]);

  const initial: TargetFormValues | undefined = editing
    ? {
        branchIds: editing.branchId,
        period: editing.period,
        year: String(editing.year),
        month: editing.month ? String(editing.month) : "",
        day: editing.day ? String(editing.day) : "",
        targetRupees: String(editing.targetPaise / 100),
      }
    : undefined;

  return (
    <AdminPage
      title="Sales Targets"
      group="Sales"
      saved={param(sp, "saved")}
      form={
        (editing ? permission.canEdit : permission.canCreate)
          ? {
              label: "Add Target",
              editingTitle: editing ? `${editing.branch.name} · ${targetDate(editing.period, editing.year, editing.month, editing.day)}` : undefined,
              cancelHref: SALES_PATHS.target,
              content: <TargetForm action={saveSalesTarget} branches={branches} initial={initial} id={editing?.id} />,
            }
          : undefined
      }
    >
      <ListView
        list={list}
        total={total}
        tabs={tabs}
        rows={rows}
        rowKey={(t) => t.id}
        highlight={(t) => t.id === highlight}
        searchPlaceholder="Search by branch"
        empty="No sales targets set yet."
        columns={[
          { header: "#", cell: (_, i) => i + 1 },
          {
            header: "Branch",
            sort: "branch",
            cell: (t) => (
              <>
                <div className="font-medium">{t.branch.name}</div>
                <div className="font-mono text-xs text-text-muted">{t.branch.code}</div>
              </>
            ),
          },
          { header: "Period", cell: (t) => <Badge tone={PERIOD_TONE[t.period]}>{PERIOD_LABELS[t.period]}</Badge> },
          { header: "Date", sort: "year", cell: (t) => targetDate(t.period, t.year, t.month, t.day) },
          { header: "Target amount", sort: "targetPaise", align: "right", cell: (t) => <span className="font-semibold">{formatPaise(t.targetPaise)}</span> },
          { header: "Set by", cell: (t) => (t.createdBy ? `${t.createdBy.firstName} ${t.createdBy.lastName}` : "—") },
          ...(permission.canEdit || permission.canDelete
            ? [
                {
                  header: "Action",
                  cell: (t: (typeof rows)[number]) => (
                    <span className="flex items-center gap-1">
                      {permission.canEdit && (
                        <Link href={`${SALES_PATHS.target}?edit=${t.id}`} className={iconLink} aria-label="Edit" title="Edit">
                          <Pencil className="size-4" />
                        </Link>
                      )}
                      {permission.canDelete && <DeleteButton action={deleteSalesTarget.bind(null, t.id)} />}
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
