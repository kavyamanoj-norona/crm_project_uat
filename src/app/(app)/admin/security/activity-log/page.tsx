import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { DataTable } from "@/components/data/data-table";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { ADMIN_PATHS } from "@/modules/admin/paths";
import { formatDateTime } from "@/lib/dates";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "User Activity Log" };

const PAGE_SIZE = 50;

function tone(action: string) {
  if (action === "login.success") return "success" as const;
  if (action.startsWith("login.")) return "danger" as const;
  if (action.endsWith(".deactivate") || action.endsWith(".lock")) return "warning" as const;
  return "neutral" as const;
}

export default async function ActivityLogPage({ searchParams }: PageProps<"/admin/security/activity-log">) {
  await requirePageAccess(ADMIN_PATHS.activityLog);
  const sp = await searchParams;
  const q = param(sp, "q");
  const page = Math.max(1, Number(param(sp, "page") ?? 1) || 1);

  const where: Prisma.UserActivityLogWhereInput = q
    ? {
        OR: [
          { username: { contains: q, mode: "insensitive" } },
          { action: { contains: q, mode: "insensitive" } },
          { ip: { contains: q } },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    db.userActivityLog.findMany({
      where,
      orderBy: { at: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { firstName: true, lastName: true, userCode: true } } },
    }),
    db.userActivityLog.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) => `${ADMIN_PATHS.activityLog}?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <AdminPage title="User Activity Log" group="Security" subtitle="Sign-ins, sign-outs and changes made in Master Settings.">
      <Card
        title={`${total} entries`}
        actions={
          <form className="flex gap-2">
            <Input name="q" defaultValue={q} placeholder="Search user, action or IP" className="w-64" />
            <button type="submit" className={buttonClass("secondary")}>
              Search
            </button>
          </form>
        }
      >
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          empty="No activity yet."
          columns={[
            { header: "Time", cell: (r) => formatDateTime(r.at) },
            {
              header: "User",
              cell: (r) =>
                r.user ? (
                  <span>
                    {[r.user.firstName, r.user.lastName].filter(Boolean).join(" ")}
                    <span className="ml-1 text-xs text-text-muted">{r.user.userCode}</span>
                  </span>
                ) : (
                  <span className="text-text-muted">{r.username ?? "—"}</span>
                ),
            },
            { header: "Action", cell: (r) => <Badge tone={tone(r.action)}>{r.action}</Badge> },
            { header: "Record", cell: (r) => (r.entity ? `${r.entity}` : "—") },
            { header: "IP", cell: (r) => <code className="text-xs">{r.ip ?? "—"}</code> },
            {
              header: "Device",
              cell: (r) => <span className="block max-w-72 truncate text-xs text-text-muted">{r.userAgent ?? "—"}</span>,
            },
          ]}
        />
        {pages > 1 && (
          <div className="mt-4 flex items-center justify-end gap-2 text-sm">
            {page > 1 && (
              <Link href={href(page - 1)} className={buttonClass("secondary", "sm")}>
                Previous
              </Link>
            )}
            <span className="text-text-muted">
              Page {page} of {pages}
            </span>
            {page < pages && (
              <Link href={href(page + 1)} className={buttonClass("secondary", "sm")}>
                Next
              </Link>
            )}
          </div>
        )}
      </Card>
    </AdminPage>
  );
}
