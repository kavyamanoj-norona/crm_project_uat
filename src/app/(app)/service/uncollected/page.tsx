import Link from "next/link";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { ListView } from "@/components/data/list-view";
import { AdminPage } from "@/modules/admin/components/admin-page";
import { formatDate } from "@/lib/dates";
import { listState } from "@/lib/list";
import { formatPaise } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { SendWhatsAppButton } from "@/modules/service/components/send-whatsapp-button";
import { SERVICE_PATHS } from "@/modules/service/paths";
import { UNCOLLECTED_SORTS, listUncollectedCases } from "@/modules/service/queries";
import { sendWhatsAppTemplate } from "@/modules/service/actions/whatsapp";
import { branchWhere, getBranchScope } from "@/server/branch-scope";
import { getMenuPermission, requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Uncollected devices" };

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function UncollectedDevicesPage({ searchParams }: PageProps<"/service/uncollected">) {
  const { user } = await requirePageAccess(SERVICE_PATHS.uncollected);
  const sp = await searchParams;
  const list = listState(SERVICE_PATHS.uncollected, sp, {
    sorts: UNCOLLECTED_SORTS,
    defaultSort: "stageChangedAt",
    defaultDir: "asc",
    defaultPageSize: 25,
  });
  const scope = await getBranchScope(user);
  const [{ rows, total, days }, casePermission] = await Promise.all([
    listUncollectedCases(list, branchWhere(scope)),
    getMenuPermission(user, SERVICE_PATHS.cases),
  ]);
  const now = new Date();

  return (
    <AdminPage
      title={scope.branch ? `Uncollected devices — ${scope.branch.name}` : "Uncollected devices — all branches"}
      group="Service"
      subtitle={`All ready-for-delivery cases · cases idle >${days} days are highlighted · pickup reminder history shows messages sent from this CRM`}
      actions={<Badge tone={total > 0 ? "warning" : "success"}>{total} ready for delivery</Badge>}
    >
      <ListView
        list={list}
        total={total}
        rows={rows}
        rowKey={(c) => c.id}
        searchPlaceholder="Search jobsheet / customer / phone / device…"
        empty="No devices are past the uncollected threshold."
        columns={[
          {
            header: "Jobsheet",
            sort: "jobsheetNo",
            cell: (c) =>
              casePermission.canView ? (
                <Link href={`${SERVICE_PATHS.cases}/${c.id}`} className="font-semibold text-brand-navy hover:text-primary dark:text-text">
                  {c.jobsheetNo}
                </Link>
              ) : (
                <span className="font-semibold">{c.jobsheetNo}</span>
              ),
          },
          {
            header: "Customer",
            cell: (c) => (
              <span className="flex flex-col leading-tight">
                <span className="font-medium">{c.customer.name}</span>
                <span className="text-xs text-text-muted">{formatPhone(c.customer.phone)}</span>
              </span>
            ),
          },
          {
            header: "Device",
            cell: (c) => <span>{[c.brand, c.model].filter(Boolean).join(" ") || "—"}</span>,
          },
          {
            header: "Idle",
            sort: "stageChangedAt",
            cell: (c) => {
              const idleDays = Math.floor((now.getTime() - c.stageChangedAt.getTime()) / DAY_MS);
              const overdue = idleDays >= days;
              return (
                <span className="flex flex-col items-start gap-1">
                  <Badge tone={overdue ? "danger" : "warning"}>{idleDays} {idleDays === 1 ? "day" : "days"}</Badge>
                  <span className="text-xs text-text-muted">Ready {formatDate(c.stageChangedAt)}</span>
                </span>
              );
            },
          },
          {
            header: "Due ₹",
            align: "right",
            sort: "estimatedCostPaise",
            cell: (c) => {
              if (c.estimatedCostPaise === null) return <span className="text-text-muted">—</span>;
              const paid = c.payments.reduce((sum, payment) => sum + payment.amountPaise, 0);
              return <span className="font-semibold tabular-nums">{formatPaise(Math.max(0, c.estimatedCostPaise - paid))}</span>;
            },
          },
          {
            header: "Pickup reminder",
            cell: (c) => {
              const reminder = c.whatsappMessages[0];
              if (!reminder) return <span className="text-text-muted">None sent</span>;
              const sent = reminder.status === "SENT";
              return (
                <span className="flex flex-col items-start gap-1">
                  <Badge tone={sent ? "success" : reminder.status === "FAILED" ? "danger" : "warning"}>
                    {sent ? "Sent" : reminder.status === "FAILED" ? "Failed" : "Pending"}
                  </Badge>
                  <span className="text-xs text-text-muted">{formatDate(reminder.sentAt ?? reminder.createdAt)}</span>
                </span>
              );
            },
          },
          {
            header: "Actions",
            cell: (c) => (
              <div className="flex items-center gap-2">
                {casePermission.canView && (
                  <LinkButton href={`${SERVICE_PATHS.cases}/${c.id}`} variant="secondary" size="sm" aria-label={`View ${c.jobsheetNo}`}>
                    <Eye className="size-4" /> View
                  </LinkButton>
                )}
                {casePermission.canEdit && c.customer.phone && (
                  <SendWhatsAppButton
                    customerName={c.customer.name}
                    customerPhone={formatPhone(c.customer.phone)}
                    action={sendWhatsAppTemplate.bind(null, c.id)}
                  />
                )}
              </div>
            ),
          },
        ]}
      />
    </AdminPage>
  );
}