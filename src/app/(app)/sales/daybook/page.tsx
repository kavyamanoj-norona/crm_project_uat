import { Banknote, Wallet, ArrowDownCircle, BoxIcon, Download } from "lucide-react";
import { StatCard } from "@/components/data/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { requirePageAccess } from "@/server/rbac/guard";
import { SALES_PATHS } from "@/modules/sales/paths";
import { getBranchScope } from "@/server/branch-scope";
import { formatPaise } from "@/lib/money";
import { cn } from "@/lib/cn";
import {
  DaybookDatePicker,
  DayStatusBadge,
  DaybookFormPanel,
} from "@/modules/sales/components/daybook-client";

export const metadata = { title: "Daybook — Cash Book" };

// ─── Mock data (replace with Prisma queries when finance integration is ready) ─

type TxType = "opening" | "auto" | "expense";

interface MockTransaction {
  id: string;
  time: string | null;
  description: string;
  type: TxType;
  moneyInPaise: number | null;
  moneyOutPaise: number | null;
  balancePaise: number;
  hasReceipt: boolean;
}

const MOCK_SUMMARY = {
  openingPaise: 420000,    // ₹4,200
  cashInPaise: 995000,     // ₹9,950
  expensesPaise: 105000,   // ₹1,050
  cashInBoxPaise: 1310000, // ₹13,100
  expenseCount: 3,
};

const MOCK_TRANSACTIONS: MockTransaction[] = [
  {
    id: "0", time: null, type: "opening", hasReceipt: false,
    description: "Opening balance b/f",
    moneyInPaise: null, moneyOutPaise: null, balancePaise: 420000,
  },
  {
    id: "1", time: "09:32", type: "auto", hasReceipt: false,
    description: "Collected customer cash — Sarah Mathew · delivery LC-EDP-2607-0136",
    moneyInPaise: 610000, moneyOutPaise: null, balancePaise: 1030000,
  },
  {
    id: "2", time: "10:15", type: "auto", hasReceipt: false,
    description: "Advance received (cash) — Anita Menon · intake LC-EDP-2607-0144",
    moneyInPaise: 50000, moneyOutPaise: null, balancePaise: 1080000,
  },
  {
    id: "3", time: "11:05", type: "expense", hasReceipt: true,
    description: "Expense — Water bill · Utilities",
    moneyInPaise: null, moneyOutPaise: 45000, balancePaise: 1035000,
  },
  {
    id: "4", time: "12:40", type: "auto", hasReceipt: false,
    description: "Counter sale (cash) — Logitech B100 mouse · Noufal A",
    moneyInPaise: 55000, moneyOutPaise: null, balancePaise: 1090000,
  },
  {
    id: "5", time: "14:20", type: "expense", hasReceipt: true,
    description: "Expense — Stationery, jobsheet rolls",
    moneyInPaise: null, moneyOutPaise: 38000, balancePaise: 1052000,
  },
  {
    id: "6", time: "16:05", type: "auto", hasReceipt: false,
    description: "Collected customer cash — Ajay S Prasad · delivery LC-EDP-2607-0131",
    moneyInPaise: 280000, moneyOutPaise: null, balancePaise: 1332000,
  },
  {
    id: "7", time: "17:30", type: "expense", hasReceipt: true,
    description: "Expense — Courier to HQ lab · CL-2607-031",
    moneyInPaise: null, moneyOutPaise: 22000, balancePaise: 1310000,
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DaybookPage() {
  const { user } = await requirePageAccess(SALES_PATHS.daybook);
  const scope = await getBranchScope(user);

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date()); // "YYYY-MM-DD" in IST

  return (
    <>
      <PageHeader
        title={`Daybook — cash book${scope.branch ? `, ${scope.branch.name}` : ""}`}
        subtitle="Tracks the physical cash box only · UPI & Card settle to bank and never touch this balance · day must be reconciled and closed before tomorrow's opening"
        breadcrumbs={["Sales", "Daybook"]}
        badges={<DayStatusBadge status="open" />}
        actions={
          <div className="flex items-center gap-2">
            <DaybookDatePicker currentDate={today} path={SALES_PATHS.daybook} />
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text transition-colors hover:border-primary hover:text-primary"
            >
              <Download className="size-4" />
              Export for Zoho
            </button>
          </div>
        }
      />

      {/* ── KPI tiles ──────────────────────────────────────────────────── */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Opening balance"
          value={formatPaise(MOCK_SUMMARY.openingPaise)}
          icon={<Wallet />}
          iconTone="navy"
          note={{ text: "Carried from yesterday (closed ✓)", tone: "muted" }}
        />
        <StatCard
          label="Cash in (auto from CRM)"
          value={formatPaise(MOCK_SUMMARY.cashInPaise)}
          icon={<Banknote />}
          iconTone="success"
          note={{ text: "Deliveries, advances, counter sales", tone: "muted" }}
        />
        <StatCard
          label="Expenses / cash out"
          value={formatPaise(MOCK_SUMMARY.expensesPaise)}
          icon={<ArrowDownCircle />}
          iconTone="danger"
          note={{ text: `${MOCK_SUMMARY.expenseCount} entries today`, tone: "muted" }}
        />
        <StatCard
          label="Cash in box (CRM)"
          hint="live"
          value={formatPaise(MOCK_SUMMARY.cashInBoxPaise)}
          icon={<BoxIcon />}
          iconTone="primary"
          note={{ text: "Opening + in − out", tone: "muted" }}
        />
      </div>

      {/* ── Two-column layout ───────────────────────────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">

        {/* Transaction table */}
        <div className="rounded-xl border border-border bg-surface shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-text">Today&apos;s cash transactions</h2>
            <p className="text-xs text-text-muted">
              auto-posted from case payments &amp; sales; expenses posted from the form →
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-border bg-surface-muted/40">
                  <th className="py-2.5 pr-3 pl-5 text-left text-[11px] font-semibold tracking-wide text-text-muted uppercase w-14">
                    Time
                  </th>
                  <th className="py-2.5 pr-3 text-left text-[11px] font-semibold tracking-wide text-text-muted uppercase">
                    Description
                  </th>
                  <th className="py-2.5 pr-3 text-right text-[11px] font-semibold tracking-wide text-text-muted uppercase w-28">
                    Money in
                  </th>
                  <th className="py-2.5 pr-3 text-right text-[11px] font-semibold tracking-wide text-text-muted uppercase w-28">
                    Money out
                  </th>
                  <th className="py-2.5 pr-5 text-right text-[11px] font-semibold tracking-wide text-text-muted uppercase w-28">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {MOCK_TRANSACTIONS.map((tx) => (
                  <tr
                    key={tx.id}
                    className={cn(
                      "border-b border-border last:border-0 transition-colors",
                      tx.type === "opening" && "bg-surface-muted/30",
                    )}
                  >
                    <td className="py-3.5 pr-3 pl-5 text-xs text-text-muted whitespace-nowrap">
                      {tx.time ?? "—"}
                    </td>
                    <td className="py-3.5 pr-3 text-sm text-text">
                      <span className={cn(tx.type === "opening" && "font-semibold")}>
                        {tx.description}
                      </span>
                      {tx.type === "auto" && (
                        <span className="ml-2 inline-flex items-center rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                          auto
                        </span>
                      )}
                      {tx.hasReceipt && (
                        <span className="ml-1.5 inline-flex items-center rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
                          receipt
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 pr-3 text-right text-sm font-medium tabular-nums text-success">
                      {tx.moneyInPaise ? formatPaise(tx.moneyInPaise) : ""}
                    </td>
                    <td className="py-3.5 pr-3 text-right text-sm font-medium tabular-nums text-danger">
                      {tx.moneyOutPaise ? formatPaise(tx.moneyOutPaise) : ""}
                    </td>
                    <td className="py-3.5 pr-5 text-right text-sm font-semibold tabular-nums text-text">
                      {formatPaise(tx.balancePaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
            <p className="text-xs text-text-muted">
              Cash entries are immutable after save — corrections go via the refund / adjustment flow with approval.
            </p>
            <p className="shrink-0 text-xs font-semibold text-text">
              CRM cash balance: {formatPaise(MOCK_SUMMARY.cashInBoxPaise)}
            </p>
          </div>
        </div>

        {/* Right panel — expense form + EOD reconcile */}
        <DaybookFormPanel crmBalancePaise={MOCK_SUMMARY.cashInBoxPaise} />
      </div>
    </>
  );
}
