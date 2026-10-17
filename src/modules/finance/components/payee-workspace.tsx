"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowDown, ArrowUp, BarChart3, BookOpen, Calendar, CheckCircle2, ChevronLeft, ChevronRight, Clock, Download, Eye, FileText, Phone, Settings, Upload, Wallet, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { FormState } from "@/lib/form";
import { formatPaise } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/data/data-table";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Field, Input, Select } from "@/components/ui/field";
import type { BillStatus, WorkBill, WorkDocument, WorkLedgerRow, WorkPayment, WorkSummary } from "../payables";
import { MODE_LABELS } from "./finance-ui";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

const PAGE_SIZE = 10;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** yyyy-mm-dd → "01 Oct 2026" */
const day = (ymd: string) => (ymd ? `${ymd.slice(8, 10)} ${MON[Number(ymd.slice(5, 7)) - 1]} ${ymd.slice(0, 4)}` : "—");
const rupees = (paise: number) => formatPaise(paise, { fixed: true });

const STATUS: Record<BillStatus, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  PAID: { label: "Paid", tone: "success" },
  PARTIAL: { label: "Partial", tone: "warning" },
  OVERDUE: { label: "Overdue", tone: "danger" },
  DUE: { label: "Due", tone: "danger" },
};

/** Bills pending longer than this many days count as long-pending. */
const AGING_LIMIT = 45;
/** Past this the TAT turns amber, one step before it turns red. */
const AGING_WARN = 30;
type Aging = "" | "upto" | "above";

/** Whole days from a yyyy-mm-dd bill date to today (never negative). */
function daysSince(ymd: string) {
  const t = new Date();
  const today = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.max(0, Math.round((today - Date.parse(`${ymd}T00:00:00Z`)) / 86_400_000));
}

const MODES = ["CASH", "UPI", "CARD", "BANK_TRANSFER"].map((m) => ({ value: m, label: MODE_LABELS[m]! }));

const PERIODS = [
  { value: "month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "quarter", label: "Last 3 months" },
  { value: "year", label: "This year" },
] as const;
/** "" = all time. */
type Period = "" | (typeof PERIODS)[number]["value"];

/** The yyyy-mm-dd range a summary period covers (inclusive); null = no limit. */
function periodRange(p: Period): { from: string; to: string } | null {
  if (p === "") return null;
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (p === "month") return { from: ymd(new Date(y, m, 1)), to: ymd(new Date(y, m + 1, 0)) };
  if (p === "last-month") return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) };
  if (p === "quarter") return { from: ymd(new Date(y, m - 2, 1)), to: ymd(new Date(y, m + 1, 0)) };
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

function summarise(bills: WorkBill[]): WorkSummary {
  const overdue = bills.filter((b) => b.status === "OVERDUE");
  return {
    totalPaise: bills.reduce((s, b) => s + b.totalPaise, 0),
    paidPaise: bills.reduce((s, b) => s + b.paidPaise, 0),
    duePaise: bills.reduce((s, b) => s + b.duePaise, 0),
    overduePaise: overdue.reduce((s, b) => s + b.duePaise, 0),
    overdueCount: overdue.length,
    count: bills.length,
  };
}

type TabKey = "bills" | "payments" | "ledger" | "documents";

type Props = {
  kind: "supplier" | "vendor";
  bills: WorkBill[];
  payments: WorkPayment[];
  ledger: WorkLedgerRow[];
  documents: WorkDocument[];
  contact: { phone: string | null; email: string | null };
  /** Paying is allowed (permission) and possible here (suppliers only: vendors are paid on the case). */
  canPay: boolean;
  paySelected?: Action;
  recordPayment?: Action;
  uploadDocument?: Action;
  /** File name stem for the Export download. */
  exportName: string;
};

const checkboxCls = "size-4 rounded border-border accent-primary disabled:cursor-not-allowed disabled:opacity-40";
const pageBtn = "inline-flex size-8 items-center justify-center rounded-lg border border-border text-text-muted hover:bg-surface-muted disabled:opacity-40";

function SummaryTile({ icon, tone, label, value, note, noteTone }: { icon: React.ReactNode; tone: string; label: string; value: string; note: string; noteTone?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border p-3">
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg]:size-5", tone)}>{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-text-muted">{label}</p>
        <p className="text-lg font-bold tabular-nums text-brand-navy dark:text-text">{value}</p>
        <p className={cn("text-xs", noteTone ?? "text-text-muted")}>{note}</p>
      </div>
    </div>
  );
}

export function PayeeWorkspace({ kind, bills, payments, ledger, documents, contact, canPay, paySelected, recordPayment, uploadDocument, exportName }: Props) {
  const supplier = kind === "supplier";
  const noun = supplier ? "bill" : "case";
  const [tab, setTab] = useState<TabKey>("bills");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [newestFirst, setNewestFirst] = useState(true);
  const [aging, setAging] = useState<Aging>("");
  const [period, setPeriod] = useState<Period>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** The last bill ticked: Shift+click selects everything between it and the next one clicked. */
  const [anchor, setAnchor] = useState<string | null>(null);

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "bills", label: supplier ? "Bills" : "Cases", count: bills.length },
    { key: "payments", label: "Payments", count: payments.length },
    ...(supplier ? [{ key: "ledger" as const, label: "Ledger", count: ledger.length }, { key: "documents" as const, label: "Documents", count: documents.length }] : []),
  ];

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = bills.filter(
      (b) =>
        (!status || b.status === status) &&
        (aging === "" || (b.duePaise > 0 && (aging === "upto" ? daysSince(b.date) <= AGING_LIMIT : daysSince(b.date) > AGING_LIMIT))) &&
        (!from || b.date >= from) &&
        (!to || b.date <= to) &&
        (!needle || b.number.toLowerCase().includes(needle) || b.date.includes(needle) || String(b.totalPaise / 100).includes(needle) || String(b.duePaise / 100).includes(needle)),
    );
    return rows.sort((a, b) => (newestFirst ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)) || a.number.localeCompare(b.number));
  }, [bills, q, status, from, to, newestFirst, aging]);

  // Tab counts: unpaid bills only for the two aging tabs.
  const agingCounts = useMemo(() => {
    const unpaid = bills.filter((b) => b.duePaise > 0);
    const above = unpaid.filter((b) => daysSince(b.date) > AGING_LIMIT).length;
    return { all: bills.length, upto: unpaid.length - above, above };
  }, [bills]);

  const summary = useMemo(() => {
    const range = periodRange(period);
    return summarise(range ? bills.filter((b) => b.date >= range.from && b.date <= range.to) : bills);
  }, [bills, period]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  // A selection only holds bills that still owe something (a bill that was just paid drops out by itself).
  const picked = bills.filter((b) => selected.has(b.id) && b.duePaise > 0);
  const pickedTotal = picked.reduce((s, b) => s + b.totalPaise, 0);
  const pickedPaid = picked.reduce((s, b) => s + b.paidPaise, 0);
  const pickedDue = picked.reduce((s, b) => s + b.duePaise, 0);
  const selectable = canPay && supplier;
  const pageSelectable = rows.filter((b) => b.duePaise > 0);
  const allOnPage = pageSelectable.length > 0 && pageSelectable.every((b) => selected.has(b.id));

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const togglePage = () =>
    setSelected((s) => {
      const n = new Set(s);
      for (const b of pageSelectable) {
        if (allOnPage) n.delete(b.id);
        else n.add(b.id);
      }
      return n;
    });
  /** Tick / untick one bill; with Shift held, the whole run from the last ticked bill to this one (across pages) follows it. */
  const pick = (id: string, shift: boolean) => {
    const want = !selected.has(id);
    const order = filtered.filter((x) => x.duePaise > 0).map((x) => x.id);
    const a = shift && anchor ? order.indexOf(anchor) : -1;
    const i = order.indexOf(id);
    setSelected((s) => {
      const n = new Set(s);
      if (a >= 0 && i >= 0) {
        for (let k = Math.min(a, i); k <= Math.max(a, i); k++) {
          if (want) n.add(order[k]!);
          else n.delete(order[k]!);
        }
      } else if (want) n.add(id);
      else n.delete(id);
      return n;
    });
    setAnchor(id);
  };

  /** Shift+↓ / Shift+↑ on a focused checkbox extends the selection to the next / previous bill. */
  const extend = (e: React.KeyboardEvent, id: string) => {
    if (!e.shiftKey || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
    const order = rows.filter((x) => x.duePaise > 0).map((x) => x.id);
    const next = order[order.indexOf(id) + (e.key === "ArrowDown" ? 1 : -1)];
    if (!next) return;
    e.preventDefault();
    setSelected((s) => new Set(s).add(id).add(next));
    setAnchor(next);
    document.getElementById(`pick-${next}`)?.focus();
  };

  const reset = () => setPage(1);

  function exportCsv() {
    const cell = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
    const lines = [
      [supplier ? "Bill number" : "Jobsheet", "Date", "Due date", "Total (INR)", "Paid (INR)", "Outstanding (INR)", "TAT (days)", "Status"].map(cell).join(","),
      ...filtered.map((b) => [b.number, b.date, b.dueDate, (b.totalPaise / 100).toFixed(2), (b.paidPaise / 100).toFixed(2), (b.duePaise / 100).toFixed(2), b.duePaise > 0 ? daysSince(b.date) : "", STATUS[b.status].label].map(cell).join(",")),
    ];
    const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportName}-${supplier ? "bills" : "cases"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const billColumns: Column<WorkBill>[] = [
    ...(selectable
      ? [
          {
            header: "Select",
            headerNode: <input type="checkbox" aria-label="Select all on this page" className={checkboxCls} checked={allOnPage} disabled={pageSelectable.length === 0} onChange={togglePage} />,
            align: "center" as const,
            cell: (b: WorkBill) => (
              <input
                id={`pick-${b.id}`}
                type="checkbox"
                aria-label={`Select ${b.number}`}
                title="Shift+click selects a range"
                className={checkboxCls}
                checked={selected.has(b.id)}
                disabled={b.duePaise === 0}
                onChange={(e) => pick(b.id, (e.nativeEvent as MouseEvent).shiftKey === true)}
                onKeyDown={(e) => extend(e, b.id)}
              />
            ),
          },
        ]
      : []),
    { header: "#", cell: (_, i) => (current - 1) * PAGE_SIZE + i + 1 },
    { header: supplier ? "Bill number" : "Jobsheet", cell: (b) => <span className="font-semibold">{b.number}</span> },
    {
      header: supplier ? "Bill date" : "Created",
      headerNode: (
        <button type="button" onClick={() => setNewestFirst((v) => !v)} className="inline-flex items-center gap-1 font-semibold hover:text-primary" aria-label={`Sort by date, ${newestFirst ? "newest" : "oldest"} first`}>
          {supplier ? "Bill date" : "Created"} {newestFirst ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />}
        </button>
      ),
      cell: (b) => <span className="text-text-muted">{day(b.date)}</span>,
    },
    { header: "Due date", cell: (b) => <span className="text-text-muted">{day(b.dueDate)}</span> },
    {
      header: "TAT",
      align: "center",
      cell: (b) => {
        if (b.duePaise === 0) return <span className="text-text-muted">—</span>;
        const d = daysSince(b.date);
        return (
          <Badge tone={d > AGING_LIMIT ? "danger" : d > AGING_WARN ? "warning" : "neutral"} className={cn(d > AGING_LIMIT && "ring-1 ring-danger/30")}>
            {d > AGING_LIMIT && <AlertTriangle className="size-3" />}
            {d} {d === 1 ? "day" : "days"}
          </Badge>
        );
      },
    },
    { header: "Total amount", align: "right", cell: (b) => <span className="tabular-nums">{rupees(b.totalPaise)}</span> },
    { header: "Paid amount", align: "right", cell: (b) => <span className="tabular-nums">{rupees(b.paidPaise)}</span> },
    { header: "Outstanding", align: "right", cell: (b) => <span className={cn("font-semibold tabular-nums", b.duePaise > 0 ? "text-danger" : "text-success")}>{rupees(b.duePaise)}</span> },
    { header: "Status", align: "center", cell: (b) => <Badge tone={STATUS[b.status].tone}>{STATUS[b.status].label}</Badge> },
    {
      header: "Action",
      align: "center",
      cell: (b) => (
        <Link href={b.href} aria-label={`View ${b.number}`} title="View" className="inline-flex size-8 items-center justify-center rounded-lg border border-border text-text-muted hover:bg-surface-muted hover:text-text">
          <Eye className="size-4" />
        </Link>
      ),
    },
  ];

  const phone = contact.phone?.split(/[,/;]/)[0]?.trim().replace(/[^\d+]/g, "") || null;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      {/* ── Main ─────────────────────────────────────────────── */}
      <div className="min-w-0 space-y-4">
        <div className="min-w-0 rounded-xl border border-border bg-surface shadow-sm">
          <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-border px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3.5 text-sm font-semibold whitespace-nowrap transition-colors",
                  tab === t.key ? "border-primary text-primary" : "border-transparent text-text-muted hover:text-text",
                )}
              >
                {t.label}
                <span className={cn("rounded-full px-1.5 text-[11px] leading-5", tab === t.key ? "bg-primary-soft text-primary" : "bg-surface-muted")}>{t.count}</span>
              </button>
            ))}
          </div>

          {tab === "bills" && (
            <>
              <div role="tablist" aria-label="Aging" className="flex flex-wrap gap-2 px-3 pt-3 sm:px-4 sm:pt-4">
                {([
                  { key: "", label: `All ${supplier ? "bills" : "cases"}`, count: agingCounts.all, tone: "primary" },
                  { key: "upto", label: `Up to ${AGING_LIMIT} days`, count: agingCounts.upto, tone: "primary" },
                  { key: "above", label: `Above ${AGING_LIMIT} days`, count: agingCounts.above, tone: "danger" },
                ] as const).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={aging === t.key}
                    onClick={() => {
                      setAging(t.key);
                      reset();
                    }}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                      aging === t.key
                        ? t.tone === "danger"
                          ? "border-danger/40 bg-danger/10 text-danger"
                          : "border-primary/40 bg-primary-soft text-primary"
                        : "border-border text-text-muted hover:bg-surface-muted hover:text-text",
                    )}
                  >
                    {t.label}
                    <span className={cn("rounded-full px-1.5 text-[11px] leading-5", aging === t.key ? "bg-surface/70" : "bg-surface-muted", t.tone === "danger" && t.count > 0 && aging !== t.key && "bg-danger/10 text-danger")}>{t.count}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 p-3 sm:p-4">
                <div className="min-w-48 flex-1 sm:max-w-sm">
                  <Input
                    aria-label={`Search ${noun}s`}
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      reset();
                    }}
                    placeholder={`Search by ${noun} number, date or amount`}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                  <div className="w-36">
                    <Select
                      aria-label="Status"
                      value={status}
                      onChange={(e) => {
                        setStatus(e.target.value);
                        reset();
                      }}
                      placeholder="All status"
                      options={(Object.keys(STATUS) as BillStatus[]).map((s) => ({ value: s, label: STATUS[s].label }))}
                    />
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus-within:border-primary">
                    <Calendar className="size-4 shrink-0 text-text-muted" />
                    <input
                      type="date"
                      aria-label="From date"
                      value={from}
                      max={to || undefined}
                      onChange={(e) => {
                        setFrom(e.target.value);
                        reset();
                      }}
                      className="w-32 bg-transparent outline-none"
                    />
                    <span className="text-text-muted">–</span>
                    <input
                      type="date"
                      aria-label="To date"
                      value={to}
                      min={from || undefined}
                      onChange={(e) => {
                        setTo(e.target.value);
                        reset();
                      }}
                      className="w-32 bg-transparent outline-none"
                    />
                    {(from || to) && (
                      <button
                        type="button"
                        aria-label="Clear dates"
                        onClick={() => {
                          setFrom("");
                          setTo("");
                          reset();
                        }}
                        className="rounded p-0.5 text-text-muted hover:bg-surface-muted hover:text-text"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                  <Button variant="secondary" onClick={exportCsv} disabled={filtered.length === 0}>
                    <Download className="size-4" /> Export
                  </Button>
                </div>
              </div>
              <DataTable bordered={false} rows={rows} rowKey={(b) => b.id} empty={bills.length === 0 ? `No ${noun}s yet.` : aging === "above" && !q && !status && !from && !to ? `No ${noun} has been pending more than ${AGING_LIMIT} days.` : `No ${noun}s match these filters.`} columns={billColumns} />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
                <p className="text-xs text-text-muted">
                  {filtered.length === 0 ? `Showing 0 ${noun}s` : `Showing ${(current - 1) * PAGE_SIZE + 1} to ${Math.min(current * PAGE_SIZE, filtered.length)} of ${filtered.length} ${filtered.length === 1 ? noun : `${noun}s`}`}
                </p>
                {pages > 1 && (
                  <nav aria-label="Pages" className="flex items-center gap-1">
                    <button type="button" aria-label="Previous page" disabled={current === 1} onClick={() => setPage(current - 1)} className={pageBtn}>
                      <ChevronLeft className="size-4" />
                    </button>
                    {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        type="button"
                        aria-current={n === current ? "page" : undefined}
                        onClick={() => setPage(n)}
                        className={cn("inline-flex size-8 items-center justify-center rounded-lg border text-sm", n === current ? "border-primary bg-primary font-semibold text-white" : "border-border text-text hover:bg-surface-muted")}
                      >
                        {n}
                      </button>
                    ))}
                    <button type="button" aria-label="Next page" disabled={current === pages} onClick={() => setPage(current + 1)} className={pageBtn}>
                      <ChevronRight className="size-4" />
                    </button>
                  </nav>
                )}
              </div>
            </>
          )}

          {tab === "payments" && (
            <DataTable
              bordered={false}
              rows={payments}
              rowKey={(p) => p.id}
              empty="No payments yet."
              columns={[
                { header: "#", cell: (_, i) => i + 1 },
                { header: "Date", cell: (p) => <span className="text-text-muted">{day(p.date)}</span> },
                { header: supplier ? "Bill" : "Jobsheet", cell: (p) => <span className="font-semibold">{p.against}</span> },
                { header: "Mode", cell: (p) => (p.mode ? (MODE_LABELS[p.mode] ?? p.mode) : "—") },
                { header: supplier ? "Reference" : "Note", cell: (p) => p.reference ?? "—" },
                { header: "Amount", align: "right", cell: (p) => <span className="font-semibold tabular-nums">{rupees(p.amountPaise)}</span> },
              ]}
            />
          )}

          {tab === "ledger" && (
            <DataTable
              bordered={false}
              rows={ledger}
              rowKey={(l) => l.id}
              empty="Nothing posted to this supplier's account yet."
              columns={[
                { header: "Date", cell: (l) => <span className="text-text-muted">{day(l.date)}</span> },
                { header: "Entry", cell: (l) => <span className="text-xs tabular-nums">{l.entryNo}</span> },
                { header: "Narration", cell: (l) => <span className="block max-w-80 truncate" title={l.narration}>{l.narration}</span> },
                { header: "Debit ₹ (paid)", align: "right", cell: (l) => <span className="tabular-nums">{l.debitPaise ? formatPaise(l.debitPaise, { symbol: false, fixed: true }) : ""}</span> },
                { header: "Credit ₹ (billed)", align: "right", cell: (l) => <span className="tabular-nums">{l.creditPaise ? formatPaise(l.creditPaise, { symbol: false, fixed: true }) : ""}</span> },
                { header: "Balance ₹ (owed)", align: "right", cell: (l) => <span className="font-semibold tabular-nums">{formatPaise(l.balancePaise, { symbol: false, fixed: true })}</span> },
              ]}
            />
          )}

          {tab === "documents" && (
            <DataTable
              bordered={false}
              rows={documents}
              rowKey={(d) => `${d.kind}:${d.id}`}
              empty="No documents yet. Upload one from Quick actions."
              columns={[
                { header: "#", cell: (_, i) => i + 1 },
                { header: "Document", cell: (d) => <span className="font-medium">{d.name}</span> },
                { header: "Type", cell: (d) => <Badge tone={d.kind === "Uploaded" ? "primary" : "neutral"}>{d.kind}</Badge> },
                { header: "Date", cell: (d) => <span className="text-text-muted">{day(d.date)}</span> },
                {
                  header: "Action",
                  align: "center",
                  cell: (d) => (
                    <a href={d.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline">
                      View
                    </a>
                  ),
                },
              ]}
            />
          )}
        </div>

        {/* Pay bar: sticks to the bottom of the screen so it stays reachable however long the list is. */}
        {tab === "bills" && selectable && picked.length > 0 && paySelected && (
          <div className="sticky bottom-3 z-30 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-primary/30 bg-primary-soft px-4 py-3 shadow-lg backdrop-blur">
            <p className="text-sm font-bold text-primary">
              {picked.length} {picked.length === 1 ? "bill" : "bills"} selected
            </p>
            <div>
              <p className="text-[11px] text-text-muted">Total amount</p>
              <p className="text-sm font-bold tabular-nums">{rupees(pickedTotal)}</p>
            </div>
            <div>
              <p className="text-[11px] text-text-muted">Already paid</p>
              <p className="text-sm font-bold tabular-nums">{rupees(pickedPaid)}</p>
            </div>
            <div>
              <p className="text-[11px] text-text-muted">Payable amount</p>
              <p className="text-sm font-bold tabular-nums text-danger">{rupees(pickedDue)}</p>
            </div>
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              <Button variant="secondary" onClick={() => setSelected(new Set())}>
                Clear selection
              </Button>
              <ActionDialog
                trigger={
                  <>
                    <Wallet className="size-4" /> Pay selected bills
                  </>
                }
                triggerVariant="primary"
                title="Pay selected bills"
                description={`${picked.length} ${picked.length === 1 ? "bill" : "bills"} · ${rupees(pickedDue)} payable in full`}
                action={paySelected}
                submitLabel={`Pay ${rupees(pickedDue)}`}
              >
                <input type="hidden" name="billIds" value={picked.map((b) => b.id).join(",")} />
                <Field label="Payment mode" htmlFor="sel-mode" required>
                  <Select id="sel-mode" name="mode" options={MODES} placeholder="Select payment mode" />
                </Field>
                <Field label="Reference" htmlFor="sel-ref" hint="Optional: UPI, card or transfer reference.">
                  <Input id="sel-ref" name="reference" placeholder="Enter reference" />
                </Field>
              </ActionDialog>
            </div>
          </div>
        )}
      </div>

      {/* ── Side: stays in view while the bill list scrolls ───── */}
      <aside className="min-w-0 space-y-4 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:self-start xl:overflow-y-auto xl:pr-1">
        <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-navy dark:text-text">
              <BarChart3 className="size-4 text-primary" /> Financial summary
            </h2>
            <div className="w-32">
              <Select aria-label="Summary period" value={period} onChange={(e) => setPeriod(e.target.value as Period)} placeholder="All time" options={PERIODS.map((p) => ({ value: p.value, label: p.label }))} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <SummaryTile icon={<FileText />} tone="bg-primary-soft text-primary" label="Total billing" value={rupees(summary.totalPaise)} note={`${summary.count} ${summary.count === 1 ? noun : `${noun}s`}`} />
            <SummaryTile icon={<CheckCircle2 />} tone="bg-success/12 text-success" label="Total paid" value={rupees(summary.paidPaise)} note={`${summary.totalPaise ? Math.round((summary.paidPaise / summary.totalPaise) * 100) : 0}% of total`} />
            <SummaryTile icon={<Clock />} tone="bg-danger/12 text-danger" label="Outstanding due" value={rupees(summary.duePaise)} note={`${summary.totalPaise ? Math.round((summary.duePaise / summary.totalPaise) * 100) : 0}% pending`} />
            <SummaryTile
              icon={<AlertTriangle />}
              tone="bg-danger/12 text-danger"
              label="Overdue amount"
              value={rupees(summary.overduePaise)}
              note={`${summary.overdueCount} ${summary.overdueCount === 1 ? noun : `${noun}s`} overdue`}
              noteTone={summary.overdueCount ? "text-danger" : undefined}
            />
          </div>
        </section>

        {selectable && (
          <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-navy dark:text-text">
                <FileText className="size-4 text-primary" /> Selected bills ({picked.length})
              </h2>
              {picked.length > 0 && (
                <button type="button" onClick={() => setSelected(new Set())} className="text-xs font-semibold text-primary hover:underline">
                  Clear all
                </button>
              )}
            </div>
            {picked.length === 0 ? (
              <p className="rounded-lg bg-surface-muted px-3 py-3 text-xs text-text-muted">Tick bills in the table to pay them together. Hold Shift to select a range.</p>
            ) : (
              <>
                <ul className="max-h-56 divide-y divide-border/60 overflow-y-auto rounded-lg border border-border">
                  {picked.map((b, i) => (
                    <li key={b.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <span className="w-4 shrink-0 text-xs text-text-muted">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{b.number}</span>
                      <span className="hidden shrink-0 text-xs text-text-muted 2xl:inline">{day(b.date)}</span>
                      <span className="shrink-0 font-semibold tabular-nums">{rupees(b.duePaise)}</span>
                      <button type="button" aria-label={`Remove ${b.number}`} onClick={() => toggle(b.id)} className="shrink-0 rounded p-0.5 text-text-muted hover:bg-surface-muted hover:text-text">
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-center justify-between rounded-lg bg-primary-soft px-3 py-2.5">
                  <span className="text-sm font-semibold text-primary">Total payable ({picked.length} {picked.length === 1 ? "bill" : "bills"})</span>
                  <span className="text-lg font-bold tabular-nums text-danger">{rupees(pickedDue)}</span>
                </div>
              </>
            )}
          </section>
        )}

        <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-navy dark:text-text">
            <Settings className="size-4 text-primary" /> Quick actions
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {selectable && recordPayment && (
              <ActionDialog
                trigger={
                  <>
                    <Wallet className="size-4" /> Record payment
                  </>
                }
                triggerVariant="success"
                title="Record payment"
                description={summary.duePaise > 0 ? `${rupees(bills.reduce((s, b) => s + b.duePaise, 0))} due in all. The amount settles the oldest unpaid bills first.` : "Nothing is due to this supplier."}
                action={recordPayment}
                submitLabel="Record payment"
              >
                <Field label="Amount paid (₹)" htmlFor="rec-amount" required>
                  <Input id="rec-amount" name="amount" inputMode="decimal" placeholder="Enter amount" />
                </Field>
                <Field label="Payment mode" htmlFor="rec-mode" required>
                  <Select id="rec-mode" name="mode" options={MODES} placeholder="Select payment mode" />
                </Field>
                <Field label="Reference" htmlFor="rec-ref" hint="Optional: UPI, card or transfer reference.">
                  <Input id="rec-ref" name="reference" placeholder="Enter reference" />
                </Field>
              </ActionDialog>
            )}
            {canPay && uploadDocument && (
              <ActionDialog
                trigger={
                  <>
                    <Upload className="size-4" /> Upload document
                  </>
                }
                triggerVariant="secondary"
                title="Upload document"
                description="An agreement, GST certificate, statement or any file for this supplier. JPG, PNG, WebP or PDF, up to 5 MB."
                action={uploadDocument}
                submitLabel="Upload"
              >
                <Field label="Title" htmlFor="doc-title" hint="Optional. The file name is used when blank.">
                  <Input id="doc-title" name="title" placeholder="Enter document title" />
                </Field>
                <Field label="File" htmlFor="doc-file" required>
                  <Input id="doc-file" type="file" name="file" accept="image/*,application/pdf" />
                </Field>
              </ActionDialog>
            )}
            {supplier && (
              <Button variant="secondary" onClick={() => setTab("ledger")}>
                <BookOpen className="size-4" /> View ledger
              </Button>
            )}
            {(phone || contact.email) && (
              <a
                href={phone ? `tel:${phone}` : `mailto:${contact.email}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-text hover:bg-surface-muted"
              >
                <Phone className="size-4" /> Contact {supplier ? "supplier" : "vendor"}
              </a>
            )}
          </div>
          {!supplier && <p className="mt-3 text-xs text-text-muted">Vendor payments are recorded on the case in the Chip-Level Lab.</p>}
        </section>
      </aside>
    </div>
  );
}
