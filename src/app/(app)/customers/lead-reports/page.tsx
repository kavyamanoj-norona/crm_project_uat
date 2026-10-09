import { CheckCircle2, Hourglass, Percent, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { ColumnChart } from "@/components/data/column-chart";
import { DataTable } from "@/components/data/data-table";
import { StatCard } from "@/components/data/stat-card";
import { getBranchScope } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";
import { CUSTOMER_PATHS } from "@/modules/customers/paths";
import { getLeadReport } from "@/modules/customers/lead-queries";
import { LEAD_SOURCE_LABELS } from "@/modules/customers/schemas";

export const metadata = { title: "Lead Reports" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10" → "Oct 2026" */
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

const pct = (n: number) => `${n.toFixed(1)}%`;

export default async function LeadReportsPage() {
  const { user } = await requirePageAccess(CUSTOMER_PATHS.leadReports);
  const scope = await getBranchScope(user);
  const { months, bySource, totals } = await getLeadReport(scope);

  const latest = months.slice(0, 12);
  // oldest → newest for the chart
  const chart = [...latest].reverse().map((m, i, all) => ({
    label: MONTHS[Number(m.month.slice(5, 7)) - 1]!,
    value: m.rate,
    highlight: i === all.length - 1,
  }));

  return (
    <>
      <PageHeader
        title="Lead Reports"
        subtitle={`Monthly lead conversions · ${scope.branch ? `${scope.branch.name} (${scope.branch.code})` : "all branches"}`}
        breadcrumbs={["Customers & Support", "Lead Reports"]}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total leads" value={totals.total} icon={<UserPlus />} iconTone="primary" />
        <StatCard label="Converted" value={totals.converted} icon={<CheckCircle2 />} iconTone="success" />
        <StatCard label="Open" value={totals.open} icon={<Hourglass />} iconTone="warning" />
        <StatCard
          label="Conversion rate"
          value={pct(totals.rate)}
          icon={<Percent />}
          iconTone="navy"
          note={{ text: `${totals.converted} of ${totals.total} leads`, tone: "muted" }}
        />
      </div>

      <div className="space-y-6">
        <Card title="Conversion rate by month">
          {chart.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">No leads recorded yet.</p>
          ) : (
            <ColumnChart
              data={chart}
              title="Lead conversion rate by month"
              format={(v) => `${v}%`}
              unit={["percent", "percent"]}
            />
          )}
        </Card>

        <Card title="Monthly conversions">
          <p className="mb-3 text-xs text-text-muted">
            Each month shows the leads that arrived that month and how many of them have been converted so far.
            “Converted in month” counts conversions made in that month, whenever the lead arrived.
          </p>
          <DataTable
            rows={months}
            rowKey={(m) => m.month}
            empty="No leads recorded yet."
            columns={[
              { header: "Month", cell: (m) => <span className="font-medium">{monthLabel(m.month)}</span> },
              { header: "Total leads", align: "right", cell: (m) => m.total },
              { header: "Converted", align: "right", cell: (m) => m.converted },
              {
                header: "Conversion rate",
                align: "right",
                cell: (m) => (
                  <Badge tone={m.total === 0 ? "neutral" : m.rate >= 50 ? "success" : m.rate >= 20 ? "warning" : "danger"}>
                    {pct(m.rate)}
                  </Badge>
                ),
              },
              { header: "Still open", align: "right", cell: (m) => m.open },
              { header: "Converted in month", align: "right", cell: (m) => m.convertedInMonth },
            ]}
          />
        </Card>

        <Card title="By source">
          <DataTable
            rows={bySource}
            rowKey={(s) => s.source ?? "unknown"}
            empty="No leads recorded yet."
            columns={[
              {
                header: "Source",
                cell: (s) => (
                  <span className="font-medium">
                    {s.source ? (LEAD_SOURCE_LABELS[s.source as keyof typeof LEAD_SOURCE_LABELS] ?? s.source) : "Not specified"}
                  </span>
                ),
              },
              { header: "Total leads", align: "right", cell: (s) => s.total },
              { header: "Converted", align: "right", cell: (s) => s.converted },
              { header: "Conversion rate", align: "right", cell: (s) => pct(s.rate) },
            ]}
          />
        </Card>
      </div>
    </>
  );
}
