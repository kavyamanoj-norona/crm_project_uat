import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { KvList } from "@/components/ui/kv-list";
import { LinkButton } from "@/components/ui/button";
import { DataTable } from "@/components/data/data-table";
import { FlashToast } from "@/components/feedback/flash-toast";
import { PageHeader } from "@/components/layout/page-header";
import { personName } from "@/components/data/who-when";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { param } from "@/modules/admin/components/admin-page";
import { BILL_PAYMENT_MODE_LABELS } from "@/modules/inventory/billing-schema";
import { getBill } from "@/modules/inventory/billing-queries";
import { INVENTORY_PATHS } from "@/modules/inventory/paths";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Purchase bill" };

const STATUS = {
  UNPAID: { label: "Unpaid", tone: "danger" },
  PARTIAL: { label: "Part paid", tone: "warning" },
  PAID: { label: "Paid", tone: "success" },
} as const;

type SearchParams = Record<string, string | string[] | undefined>;

export default async function BillDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  await requirePageAccess(INVENTORY_PATHS.billing);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const bill = await getBill(id);
  if (!bill) notFound();

  const due = bill.totalPaise - bill.paidPaise;
  const status = STATUS[bill.paymentStatus];

  return (
    <>
      <FlashToast flag={param(sp, "saved")} message="Bill saved. Stock and payment updated." />
      <PageHeader
        title={bill.billNo}
        badges={
          <>
            <Badge tone={status.tone}>{status.label}</Badge>
            {bill.isOfficeUse && <Badge tone="violet">Office use</Badge>}
          </>
        }
        subtitle={`${bill.code} · ${bill.supplier.name} · ${formatDate(bill.billDate)}`}
        breadcrumbs={["Inventory", "Billing", bill.billNo]}
        actions={
          <>
            <LinkButton href={INVENTORY_PATHS.billing} variant="secondary">
              <ArrowLeft className="size-4" /> Back
            </LinkButton>
          </>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[1.65fr_1fr]">
        <div className="min-w-0 space-y-6">
          <Card title="Items">
            <DataTable
              rows={bill.items}
              rowKey={(l) => l.id}
              columns={[
                { header: "#", cell: (_, i) => i + 1 },
                {
                  header: "Item",
                  cell: (l) => (
                    <>
                      <p className="flex items-center gap-2 font-medium">
                        {l.item.name} {bill.isOfficeUse && <Badge tone="violet">Office use</Badge>}
                      </p>
                      <p className="text-xs text-text-muted">
                        {l.item.code}
                        {l.description !== l.item.name && ` · billed as "${l.description}"`}
                      </p>
                    </>
                  ),
                },
                { header: "HSN/SAC", cell: (l) => l.hsnSac ?? "—" },
                { header: "Warranty", cell: (l) => l.warranty?.name ?? "—" },
                { header: "Qty", align: "center", cell: (l) => l.quantity },
                {
                  header: "Allocated",
                  align: "center",
                  cell: (l) => <span className="tabular-nums">{l.stockUnits.filter((u) => u.status !== "AVAILABLE").length}</span>,
                },
                {
                  header: "Available",
                  align: "center",
                  cell: (l) => <span className="font-semibold tabular-nums">{l.stockUnits.filter((u) => u.status === "AVAILABLE").length}</span>,
                },
                { header: "Price ₹", align: "right", cell: (l) => formatPaise(l.unitCostPaise, { symbol: false }) },
                { header: "Total ₹", align: "right", cell: (l) => formatPaise(l.unitCostPaise * l.quantity, { symbol: false }) },
                { header: "Disc ₹", align: "right", cell: (l) => formatPaise(l.discountPaise, { symbol: false }) },
                { header: "GST", align: "right", cell: (l) => `${l.gstPercent}%` },
                { header: "GST ₹", align: "right", cell: (l) => formatPaise(l.taxPaise, { symbol: false }) },
                { header: "Net ₹", align: "right", cell: (l) => <span className="font-semibold">{formatPaise(l.lineTotalPaise, { symbol: false })}</span> },
              ]}
            />
            <dl className="ml-auto mt-5 w-full max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Subtotal</dt>
                <dd className="tabular-nums">{formatPaise(bill.subtotalPaise)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">GST</dt>
                <dd className="tabular-nums">{formatPaise(bill.taxPaise)}</dd>
              </div>
              {bill.roundOffPaise !== 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-text-muted">Round off</dt>
                  <dd className="tabular-nums">{formatPaise(bill.roundOffPaise)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3 border-t border-border pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatPaise(bill.totalPaise)}</dd>
              </div>
            </dl>
          </Card>

          <Card title="Stock units (USIDs)">
            <DataTable
              rows={bill.items.flatMap((l) => l.stockUnits.map((u) => ({ ...u, itemName: l.item.name })))}
              rowKey={(u) => u.id}
              empty="No stock units for this bill."
              columns={[
                { header: "USID", cell: (u) => <span className="font-medium tabular-nums">{u.usid}</span> },
                {
                  header: "Item",
                  cell: (u) => (
                    <span className="flex items-center gap-2">
                      {u.itemName} {u.isOfficeUse && <Badge tone="violet">Office use</Badge>}
                    </span>
                  ),
                },
                {
                  header: "Status",
                  cell: (u) =>
                    u.status === "AVAILABLE" ? (
                      <Badge tone="success">Available</Badge>
                    ) : u.status === "OFFICE_CONSUMED" ? (
                      <Badge tone="violet">Office consumed</Badge>
                    ) : u.status === "RECEIVED" ? (
                      <Badge tone="navy">Received</Badge>
                    ) : u.status === "RETURNED" ? (
                <Badge tone="danger">Returned (damaged)</Badge>
              ) : u.status === "AWAITING_VENDOR" ? (
                <Badge tone="warning">With vendor</Badge>
              ) : u.status === "CONSUMED" ? (
                      <Badge tone="neutral">Consumed</Badge>
                    ) : (
                      <Badge tone="primary">Allocated</Badge>
                    ),
                },
                {
                  header: "Allocated to",
                  cell: (u) =>
                    u.allocatedCase ? (
                      <span className="font-medium">
                        {u.allocatedCase.jobsheetNo}
                        {u.allocatedBranch && <span className="ml-1 text-xs font-normal text-text-muted">{u.allocatedBranch.code}</span>}
                      </span>
                    ) : (
                      "—"
                    ),
                },
                { header: "Warranty until", cell: (u) => (u.warrantyEndsAt ? formatDate(u.warrantyEndsAt) : "—") },
                {
                  header: "Office employee",
                  cell: (u) => (u.officeEmployee ? personName(u.officeEmployee) : "—"),
                },
                { header: "Allocated on", cell: (u) => (u.allocatedAt ? formatDateTime(u.allocatedAt) : "—") },
                { header: "Received on", cell: (u) => (u.receivedAt ? formatDateTime(u.receivedAt) : "—") },
              ]}
            />
          </Card>

          <Card title="Payments">
            <DataTable
              rows={bill.payments}
              rowKey={(p) => p.id}
              empty="No payment recorded yet."
              columns={[
                { header: "Date", cell: (p) => formatDateTime(p.paidAt) },
                { header: "Amount ₹", align: "right", cell: (p) => <span className="font-semibold">{formatPaise(p.amountPaise, { symbol: false })}</span> },
                { header: "Mode", cell: (p) => BILL_PAYMENT_MODE_LABELS[p.mode as keyof typeof BILL_PAYMENT_MODE_LABELS] ?? p.mode },
                { header: "Reference", cell: (p) => p.referenceNo ?? "—" },
                { header: "Note", cell: (p) => p.note ?? "—" },
                { header: "Recorded by", cell: (p) => personName(p.createdBy) ?? "—" },
              ]}
            />
            <p className="mt-4 text-sm text-text-muted">
              Paid {formatPaise(bill.paidPaise)} of {formatPaise(bill.totalPaise)} ·{" "}
              <span className="font-semibold text-text">Due {formatPaise(due)}</span>
            </p>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card title="Supplier">
            <KvList
              items={[
                ["Name", bill.supplier.name],
                ["GSTIN", bill.supplier.gstin],
                ["State", bill.supplier.state],
                ["Phone", bill.supplier.phone],
                ["Email", bill.supplier.email],
                ["Address", bill.supplier.address],
              ]}
            />
          </Card>

          <Card title="Record">
            <KvList
              items={[
                ["Code", bill.code],
                ...(bill.isOfficeUse ? ([["Office use", bill.officePurpose]] as [string, React.ReactNode][]) : []),
                ["Entered by", personName(bill.createdBy) ?? "—"],
                ["Entered on", formatDateTime(bill.createdAt)],
                ["Notes", bill.notes],
              ]}
            />
          </Card>

          {bill.imageUrl && (
            <Card title="Bill">
              {bill.imageUrl.endsWith(".pdf") ? (
                <LinkButton href={bill.imageUrl} target="_blank" rel="noreferrer" variant="secondary">
                  <FileText className="size-4" /> Open bill (PDF)
                </LinkButton>
              ) : (
                <a href={bill.imageUrl} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- uploaded file, size unknown */}
                  <img src={bill.imageUrl} alt="Supplier bill" className="max-h-96 w-full rounded-lg border border-border object-contain" />
                </a>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
