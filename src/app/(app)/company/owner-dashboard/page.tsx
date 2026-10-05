import { Suspense } from "react";
import { PeriodTabs } from "./period-tabs";
import { requirePageAccess } from "@/server/rbac/guard";
import { getOwnerDashboard } from "@/server/company/queries";

export const metadata = { title: "Owner Dashboard" };

function fmtL(paise: number): string {
  const r = paise / 100;
  if (r >= 1_00_00_000) return `₹${(r / 1_00_00_000).toFixed(1)} Cr`;
  if (r >= 1_00_000) return `₹${(r / 1_00_000).toFixed(1)} L`;
  if (r >= 1_000) return `₹${(r / 1_000).toFixed(1)}K`;
  return `₹${r.toLocaleString("en-IN")}`;
}

function pct(now: number, prev: number): string {
  if (prev === 0) return "+0%";
  const d = ((now - prev) / prev) * 100;
  return `${d >= 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(0)}%`;
}

function pctNum(now: number, prev: number): number {
  if (prev === 0) return 0;
  return ((now - prev) / prev) * 100;
}

type PageProps = { searchParams: Promise<Record<string, string>> };

export default async function OwnerDashboardPage({ searchParams }: PageProps) {
  await requirePageAccess("/company/owner-dashboard");
  const sp = await searchParams;
  const week = Math.max(0, Math.min(52, Number(sp.week ?? "0")));

  const data = await getOwnerDashboard(week);

  const revChgPct = pctNum(data.totalRevenuePaise, data.prevRevenuePaise);
  const tatChg =
    data.avgTat != null && data.prevAvgTat != null
      ? data.prevAvgTat - data.avgTat
      : null;

  const maxBranchRev = Math.max(...data.branches.map((b) => b.revenuePaise), 1);

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text">
            Owner dashboard —{" "}
            {week === 0 ? "this week" : week === 1 ? "last week" : `${week} weeks ago`}
          </h1>
          <p className="mt-0.5 text-sm text-text-muted">
            Revenue net of refunds · drill into any branch
          </p>
        </div>
        <Suspense>
          <PeriodTabs />
        </Suspense>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Company Revenue (Net) */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Company Revenue (Net)
          </p>
          <p className="mt-2 text-3xl font-bold text-text">
            {fmtL(data.totalRevenuePaise)}
          </p>
          <p
            className={`mt-1.5 text-xs font-medium ${
              revChgPct >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {revChgPct >= 0 ? "▲" : "▼"} {Math.abs(revChgPct).toFixed(0)}% vs
            last week
          </p>
        </div>

        {/* Avg TAT */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Avg TAT
          </p>
          <p className="mt-2 text-3xl font-bold text-text">
            {data.avgTat != null ? `${data.avgTat.toFixed(1)} d` : "—"}
          </p>
          {tatChg != null ? (
            <p
              className={`mt-1.5 text-xs font-medium ${
                tatChg >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {tatChg >= 0 ? "▲" : "▼"} {Math.abs(tatChg).toFixed(1)} d{" "}
              {tatChg >= 0 ? "faster" : "slower"}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-text-muted">No prior data</p>
          )}
        </div>

        {/* Stock Value (All) */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Stock Value (All)
          </p>
          <p className="mt-2 text-3xl font-bold text-text">
            {fmtL(data.stockValuePaise)}
          </p>
          <p className="mt-1.5 text-xs text-text-muted">
            Lab holds{" "}
            {fmtL(
              data.branches.find((b) => b.branch.isVirtual)?.stockValuePaise ??
                0,
            )}
          </p>
        </div>

        {/* Refunds This Week */}
        <div className="rounded-xl border border-border border-l-4 border-l-red-400 bg-surface p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Refunds This Week
          </p>
          <p className="mt-2 text-3xl font-bold text-red-600">₹0</p>
          <p className="mt-1.5 text-xs text-text-muted">No refund records yet</p>
        </div>
      </div>

      {/* Branch Leaderboard */}
      <div className="rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-3.5">
          <h2 className="font-semibold text-text">
            Branch leaderboard vs targets
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {[
                  "Branch",
                  "New Cases",
                  "Revenue (Net)",
                  "Δ vs LW",
                  "TAT",
                  "Aging",
                  "Uncollected",
                  "Target Pace",
                ].map((h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted first:pl-5"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.branches.map((row) => {
                const revDelta = pctNum(row.revenuePaise, row.prevRevenuePaise);
                const pace =
                  maxBranchRev > 0
                    ? Math.min(100, (row.revenuePaise / maxBranchRev) * 100)
                    : 0;
                const tatBad = row.avgTat != null && row.avgTat > 3.5;
                const agingBad = row.agingCases > 5;

                return (
                  <tr
                    key={row.branch.id}
                    className="hover:bg-surface-raised/50"
                  >
                    {/* Branch name */}
                    <td className="px-5 py-3.5 font-semibold text-text">
                      <span>{row.branch.name}</span>
                      {row.branch.isVirtual && (
                        <span className="ml-2 rounded-full border border-primary/40 px-2 py-0.5 text-[10px] font-medium text-primary">
                          virtual branch
                        </span>
                      )}
                    </td>
                    {/* New Cases */}
                    <td className="px-5 py-3.5 text-text">{row.newCases}</td>
                    {/* Revenue */}
                    <td className="px-5 py-3.5 font-medium text-text">
                      {row.branch.isVirtual
                        ? `${fmtL(row.revenuePaise)} internal`
                        : fmtL(row.revenuePaise)}
                    </td>
                    {/* Δ vs LW */}
                    <td
                      className={`px-5 py-3.5 font-semibold ${
                        revDelta >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {row.prevRevenuePaise === 0 ? (
                        "—"
                      ) : (
                        <>
                          {revDelta >= 0 ? "▲" : "▼"}{" "}
                          {Math.abs(revDelta).toFixed(0)}%
                        </>
                      )}
                    </td>
                    {/* TAT */}
                    <td className="px-5 py-3.5">
                      {row.avgTat != null ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            tatBad
                              ? "bg-red-100 text-red-700"
                              : "text-text"
                          }`}
                        >
                          {row.avgTat.toFixed(1)} d
                        </span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    {/* Aging */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          agingBad ? "bg-red-100 text-red-700" : "text-text"
                        }`}
                      >
                        {row.agingCases}
                      </span>
                    </td>
                    {/* Uncollected */}
                    <td className="px-5 py-3.5 text-text">
                      {row.branch.isVirtual ? "—" : row.uncollected}
                    </td>
                    {/* Target Pace bar */}
                    <td className="px-5 py-3.5">
                      <div className="h-2 w-32 rounded-full bg-border">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${pace}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-[11px] text-text-muted">
        Laptop Clinic CRM · Owner Dashboard · data refreshes on every page load
      </p>
    </div>
  );
}
