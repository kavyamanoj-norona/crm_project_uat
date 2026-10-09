import Link from "next/link";
import {
  Users,
  UserPlus,
  Building2,
  AlertTriangle,
  RefreshCw,
  Phone,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { formatDate } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import { CUSTOMER_PATHS } from "@/modules/customers/paths";
import { LEAD_SOURCE_LABELS } from "@/modules/customers/schemas";
import { getCustomerDashboardStats } from "@/modules/customers/queries";
import { requirePageAccess } from "@/server/rbac/guard";
import { getBranchScope } from "@/server/branch-scope";

export const metadata = { title: "Customers Dashboard" };

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ElementType;
  tone?: "default" | "success" | "warning" | "danger" | "primary";
}) {
  const iconColors = {
    default: "bg-surface-muted text-text-muted",
    success: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
    warning: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
    danger: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
    primary: "bg-primary/10 text-primary",
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-text-muted">{label}</p>
          <p className="mt-1 text-3xl font-black text-brand-navy dark:text-text">
            {typeof value === "number" ? value.toLocaleString("en-IN") : value}
          </p>
          {sub && <p className="mt-1 text-xs text-text-muted">{sub}</p>}
        </div>
        <div className={`rounded-lg p-2.5 ${iconColors[tone]}`}>
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  );
}

export default async function CustomersDashboardPage() {
  const { user } = await requirePageAccess(CUSTOMER_PATHS.dashboard);
  const stats = await getCustomerDashboardStats(await getBranchScope(user));

  const maxSource = Math.max(...stats.bySource.map((s) => s._count.id), 1);

  return (
    <>
      <PageHeader
        title="Customers Dashboard"
        breadcrumbs={["Customers & Support", "Dashboard"]}
        actions={
          <Link
            href={CUSTOMER_PATHS.database}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Users className="size-4" />
            View All Customers
          </Link>
        }
      />

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <StatCard label="Total Customers" value={stats.total} icon={Users} tone="primary" />
        <StatCard
          label="New This Month"
          value={stats.newThisMonth}
          sub="joined since 1st"
          icon={UserPlus}
          tone="success"
        />
        <StatCard
          label="B2B Accounts"
          value={stats.business}
          sub="business customers"
          icon={Building2}
          tone="primary"
        />
        <StatCard
          label="Repeat (Last 30d)"
          value={stats.repeatLast30}
          sub="returned customers"
          icon={RefreshCw}
          tone="success"
        />
        <StatCard
          label="Lapse Risk"
          value={stats.atRisk}
          sub="no visit in 90+ days"
          icon={AlertTriangle}
          tone="warning"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Top customers by visits */}
        <Card title="Top Customers by Visits" className="lg:col-span-2">
          {stats.topByVisits.length === 0 ? (
            <p className="py-4 text-center text-sm text-text-muted">No repeat visits recorded yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {stats.topByVisits.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3 py-3">
                  <span className="w-6 shrink-0 text-center text-sm font-bold text-text-muted">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`${CUSTOMER_PATHS.database}/${c.id}`}
                        className="truncate font-medium hover:text-primary"
                      >
                        {c.name}
                      </Link>
                      {c.type === "BUSINESS" && <Badge tone="primary">B2B</Badge>}
                    </div>
                    <p className="flex items-center gap-1 text-xs text-text-muted">
                      <Phone className="size-3" />
                      {formatPhone(c.phone)}
                      {c.lastVisitAt && (
                        <>
                          <span className="mx-1">·</span>
                          <Clock className="size-3" />
                          last {formatDate(c.lastVisitAt)}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="h-2 w-20 overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.round((c.visitCount / (stats.topByVisits[0]?.visitCount ?? 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-sm font-bold">{c.visitCount}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Acquisition sources */}
        <Card title="How They Found Us">
          {stats.bySource.length === 0 ? (
            <p className="py-4 text-center text-sm text-text-muted">No source data yet.</p>
          ) : (
            <div className="space-y-3">
              {stats.bySource.slice(0, 8).map((s) => {
                const pct = Math.round((s._count.id / maxSource) * 100);
                const label = s.source ? (LEAD_SOURCE_LABELS[s.source] ?? s.source) : "Unknown";
                return (
                  <div key={s.source ?? "null"}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-text">{label}</span>
                      <span className="font-medium">{s._count.id.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                      <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
