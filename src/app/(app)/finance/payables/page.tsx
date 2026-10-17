import Link from "next/link";
import { CheckCircle2, Clock, Download, Eye, FileText, Store, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { FilterTabs } from "@/components/data/filter-tabs";
import { ListView } from "@/components/data/list-view";
import { StatCard } from "@/components/data/stat-card";
import { formatDate } from "@/lib/dates";
import { listState } from "@/lib/list";
import { formatPaise } from "@/lib/money";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { FINANCE_PATHS } from "@/modules/finance/paths";
import { PayeeStatusFilter } from "@/modules/finance/components/payee-status-filter";
import { filterPayees, listPayees, PAYEE_SORTS, PAYEE_STATUS_LABEL, type PayeeStatus, type PayeeType } from "@/modules/finance/payables";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Payables" };

const STATUS_TONE = { PAID: "success", PARTIAL: "warning", DUE: "danger" } as const;
const TYPE_TAB: Record<string, PayeeType | undefined> = { suppliers: "SUPPLIER", vendors: "VENDOR" };
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

export default async function PayablesPage({ searchParams }: PageProps<"/finance/payables">) {
  await requirePageAccess(FINANCE_PATHS.payables);
  const sp = await searchParams;
  const list = listState(FINANCE_PATHS.payables, sp, { sorts: PAYEE_SORTS, defaultSort: "duePaise", defaultPageSize: 25 });
  const statusParam = param(sp, "status") ?? "";
  const status = statusParam in PAYEE_STATUS_LABEL ? (statusParam as PayeeStatus) : undefined;
  const type = TYPE_TAB[list.tab];

  const { payees, supplierCount, vendorCount } = await listPayees();
  // The tab picks who the cards and the table cover.
  const scoped = type ? payees.filter((p) => p.type === type) : payees;
  const totalPaise = scoped.reduce((s, p) => s + p.totalPaise, 0);
  const paidPaise = scoped.reduce((s, p) => s + p.paidPaise, 0);
  const duePaise = scoped.reduce((s, p) => s + p.duePaise, 0);
  const suppliers = payees.filter((p) => p.type === "SUPPLIER").length;
  const vendors = payees.filter((p) => p.type === "VENDOR").length;

  const filtered = filterPayees(payees, { type, status, q: list.q, sort: list.sort, dir: list.dir });
  const start = (list.page - 1) * list.pageSize;
  const rows = filtered.slice(start, start + list.pageSize);

  const exportQuery = new URLSearchParams({ ...(list.tab ? { tab: list.tab } : {}), ...(status ? { status } : {}), ...(list.q ? { q: list.q } : {}) }).toString();

  return (
    <AdminPage
      title="Payables"
      group="Finance"
      subtitle="Track supplier and vendor bills, payments and outstanding amounts."
    >
      <div className="mb-4">
        <FilterTabs
          list={list}
          tabs={[
            { key: "", label: "All", count: payees.length, isDefault: true },
            { key: "suppliers", label: "Suppliers", count: suppliers },
            { key: "vendors", label: "Vendors", count: vendors },
          ]}
        />
      </div>

      <div className={`mb-6 grid gap-4 sm:grid-cols-2 ${type ? "xl:grid-cols-4" : "xl:grid-cols-5"}`}>
        <StatCard label="Total bills" value={formatPaise(totalPaise)} icon={<FileText />} iconTone="primary" note={{ text: type === "SUPPLIER" ? "All supplier bills" : type === "VENDOR" ? "All vendor bills" : "All supplier & vendor bills", tone: "muted" }} />
        <StatCard label="Total paid" value={formatPaise(paidPaise)} icon={<CheckCircle2 />} iconTone="success" note={{ text: `${pct(paidPaise, totalPaise)}% of total bills`, tone: "muted" }} />
        <StatCard label="Outstanding / due" value={formatPaise(duePaise)} icon={<Clock />} iconTone="danger" alert={duePaise > 0} note={{ text: `${pct(duePaise, totalPaise)}% pending payment`, tone: "muted" }} />
        {type !== "VENDOR" && <StatCard label="Suppliers" value={supplierCount} icon={<Users />} iconTone="indigo" note={{ text: `${suppliers} with bills`, tone: "muted" }} />}
        {type !== "SUPPLIER" && <StatCard label="Vendors" value={vendorCount} icon={<Store />} iconTone="warning" note={{ text: `${vendors} with outsourced work`, tone: "muted" }} />}
      </div>

      <ListView
        list={list}
        total={filtered.length}
        rows={rows}
        rowKey={(p) => p.key}
        searchPlaceholder="Search by supplier or vendor"
        empty="No supplier or vendor bills yet."
        toolbar={
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <PayeeStatusFilter
              list={list}
              value={status ?? ""}
              options={(Object.keys(PAYEE_STATUS_LABEL) as PayeeStatus[]).map((s) => ({ value: s, label: PAYEE_STATUS_LABEL[s] }))}
            />
            <a href={`${FINANCE_PATHS.payables}/export${exportQuery ? `?${exportQuery}` : ""}`} className={buttonClass("secondary", "sm")}>
              <Download className="size-4" /> Export
            </a>
          </div>
        }
        columns={[
          { header: "#", cell: (_, i) => i + 1 },
          {
            header: "Name",
            sort: "name",
            cell: (p) => (
              <Link href={`${FINANCE_PATHS.payables}/${p.type.toLowerCase()}/${p.id}`} className="font-semibold text-brand-navy hover:text-primary dark:text-text">
                {p.name}
              </Link>
            ),
          },
          { header: "Type", cell: (p) => <Badge tone={p.type === "SUPPLIER" ? "primary" : "danger"}>{p.type === "SUPPLIER" ? "Supplier" : "Vendor"}</Badge> },
          { header: "Total bills", sort: "totalPaise", align: "right", cell: (p) => <span className="tabular-nums">{formatPaise(p.totalPaise)}</span> },
          { header: "Paid amount", sort: "paidPaise", align: "right", cell: (p) => <span className="tabular-nums">{formatPaise(p.paidPaise)}</span> },
          {
            header: "Outstanding",
            sort: "duePaise",
            align: "right",
            cell: (p) => <span className={`font-semibold tabular-nums ${p.duePaise > 0 ? "text-danger" : "text-success"}`}>{formatPaise(p.duePaise)}</span>,
          },
          { header: "Last bill date", sort: "lastDate", cell: (p) => <span className="text-text-muted">{p.lastDate ? formatDate(p.lastDate) : "—"}</span> },
          { header: "Status", cell: (p) => <Badge tone={STATUS_TONE[p.status]}>{PAYEE_STATUS_LABEL[p.status]}</Badge> },
          {
            header: "Action",
            align: "center",
            cell: (p) => (
              <Link
                href={`${FINANCE_PATHS.payables}/${p.type.toLowerCase()}/${p.id}`}
                aria-label={`View ${p.name}`}
                title="View"
                className="inline-flex size-8 items-center justify-center rounded-lg border border-border text-text-muted hover:bg-surface-muted hover:text-text"
              >
                <Eye className="size-4" />
              </Link>
            ),
          },
        ]}
      />
    </AdminPage>
  );
}
