import Link from "next/link";
import { CheckCircle2, Flame, PhoneCall, Receipt, TrendingUp, Users, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/data/stat-card";
import { DataTable } from "@/components/data/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { formatDateTime } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import { CUSTOMER_PATHS } from "@/modules/customers/paths";
import { TELECALLER_PATHS } from "@/modules/telecaller/paths";
import { currentMonth, getTelecallerDashboard, isMonth } from "@/modules/telecaller/queries";
import { CALL_OUTCOME_LABELS, LEAD_STATUS_LABELS, LEAD_STATUS_TONE, type CallOutcomeValue, type LeadStatusValue } from "@/modules/telecaller/status";
import { requirePageAccess } from "@/server/rbac/guard";
import { isTelecaller } from "@/server/rbac/roles";

export const metadata = { title: "Telecaller Dashboard" };

const monthFmt = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const monthLabel = (m: string) => monthFmt.format(new Date(`${m}-01T00:00:00Z`));

function Progress({ label, done, target }: { label: string; done: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-text-muted">
          <span className="font-semibold text-text">{done}</span> / {target > 0 ? target : "no target"}
          {target > 0 && ` · ${Math.round((done / target) * 100)}%`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={`h-full rounded-full ${pct >= 100 ? "bg-success" : "bg-primary"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function TelecallerDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user } = await requirePageAccess(TELECALLER_PATHS.dashboard);
  const sp = await searchParams;
  const month = isMonth(typeof sp.month === "string" ? sp.month : undefined) ? (sp.month as string) : currentMonth();
  const own = isTelecaller(user);
  const d = await getTelecallerDashboard(own ? user.id : null, month);

  type Row = (typeof d.overdue)[number] & { due: "Overdue" | "Today" };
  const calls: Row[] = [...d.overdue.map((l) => ({ ...l, due: "Overdue" as const })), ...d.dueToday.map((l) => ({ ...l, due: "Today" as const }))];

  return (
    <>
      <PageHeader
        title={own ? "My dashboard" : "Telecaller dashboard — all telecallers"}
        subtitle={`${d.upcoming} more follow-ups scheduled after today`}
        breadcrumbs={["Telecaller", "Dashboard"]}
        actions={
          <form method="get" className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="tc-month">
              Month
            </label>
            <input id="tc-month" type="month" name="month" defaultValue={month} max={currentMonth()} className="h-9 rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-primary" />
            <Button type="submit" variant="secondary" size="sm">
              Apply
            </Button>
          </form>
        }
      />

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total leads" value={d.total} icon={<Users />} iconTone="primary" href={CUSTOMER_PATHS.leads + "?tab=all"} />
          <StatCard label="Hot leads" value={d.hot} icon={<Flame />} iconTone="danger" href={CUSTOMER_PATHS.leads + "?tab=hot"} />
          <StatCard label="Lost leads" value={d.lost} icon={<XCircle />} iconTone="muted" href={CUSTOMER_PATHS.leads + "?tab=lost"} />
          <StatCard label="Billed customers" value={d.billed} icon={<Receipt />} iconTone="success" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.4fr]">
          <StatCard label="Conversion rate" value={`${d.conversionRate}%`} icon={<TrendingUp />} iconTone="indigo" note={{ text: `${d.converted} of ${d.total} leads converted`, tone: "muted" }} />
          <StatCard label="Billing rate" value={`${d.billingRate}%`} icon={<CheckCircle2 />} iconTone="success" note={{ text: `${d.billed} of ${d.converted} converted leads billed`, tone: "muted" }} />
          <Card title={`Target — ${monthLabel(month)}`}>
            <div className="space-y-4">
              <Progress label="Conversions" done={d.month.conversions} target={d.month.conversionsTarget} />
              <Progress label="Billings" done={d.month.billings} target={d.month.billingsTarget} />
            </div>
          </Card>
        </div>

        <section className="min-w-0 rounded-xl border border-border bg-surface shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-4 sm:px-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <PhoneCall className="size-4 text-primary" /> Today&apos;s call list
            </h2>
            <p className="text-xs text-text-muted">
              {d.overdue.length} overdue · {d.dueToday.length} due today
            </p>
          </div>
          <DataTable
            bordered={false}
            rows={calls}
            rowKey={(l) => l.id}
            empty="No follow-ups due. Nothing is overdue either."
            columns={[
              {
                header: "Follow-up",
                cell: (l) => (
                  <span className="flex flex-col leading-tight">
                    <span className="whitespace-nowrap">{formatDateTime(l.nextFollowUpAt)}</span>
                    <Badge tone={l.due === "Overdue" ? "danger" : "warning"} className="mt-1 w-fit">
                      {l.due}
                    </Badge>
                  </span>
                ),
              },
              {
                header: "Lead",
                cell: (l) => (
                  <Link href={`${CUSTOMER_PATHS.leads}/${l.customer.id}`} className="flex flex-col leading-tight">
                    <span className="font-semibold text-brand-navy hover:text-primary dark:text-text">{l.customer.name}</span>
                    <span className="text-xs text-text-muted">{l.customer.leadCode}</span>
                  </Link>
                ),
              },
              { header: "Mobile", cell: (l) => formatPhone(l.customer.phone) },
              { header: "Reported issue", cell: (l) => <span className="block max-w-64 truncate" title={l.customer.purpose ?? undefined}>{l.customer.purpose ?? "—"}</span> },
              { header: "Branch", cell: (l) => l.customer.branch?.code ?? "—" },
              { header: "Status", cell: (l) => <Badge tone={LEAD_STATUS_TONE[l.status as LeadStatusValue]}>{LEAD_STATUS_LABELS[l.status as LeadStatusValue]}</Badge> },
              { header: "Last call", cell: (l) => (l.lastOutcome ? CALL_OUTCOME_LABELS[l.lastOutcome as CallOutcomeValue] : "—") },
              {
                header: "Action",
                align: "center",
                cell: (l) => (
                  <Link href={`${CUSTOMER_PATHS.leads}/${l.customer.id}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10">
                    <PhoneCall className="size-3.5" />
                    Call
                  </Link>
                ),
              },
            ]}
          />
        </section>
      </div>
    </>
  );
}
