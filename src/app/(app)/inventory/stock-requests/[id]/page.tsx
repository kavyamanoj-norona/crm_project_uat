import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { KvList } from "@/components/ui/kv-list";
import { LinkButton } from "@/components/ui/button";
import { DataTable } from "@/components/data/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { personName } from "@/components/data/who-when";
import { formatDateTime } from "@/lib/dates";
import { INVENTORY_PATHS } from "@/modules/inventory/paths";
import { getStockRequest } from "@/modules/inventory/stock-request-queries";
import { LINE_STATUS, stockRequestStatus } from "@/modules/inventory/stock-request-status";
import { db } from "@/server/db";
import { branchWhere, getBranchScope } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Stock request" };

export default async function StockRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requirePageAccess(INVENTORY_PATHS.stockRequests);
  const { id } = await params;
  // Outside the branch scope is a 404, not a 403.
  const req = await getStockRequest(id, branchWhere(await getBranchScope(user)));
  if (!req) notFound();

  const photos = await db.stockAttachment.findMany({
    where: { stockRequestId: req.id, isDelete: 0 },
    orderBy: { createdAt: "asc" },
    select: { id: true, url: true, fileName: true },
  });
  const status = stockRequestStatus(req.lines);
  type Line = (typeof req.lines)[number];

  return (
    <>
      <PageHeader
        title={req.code}
        subtitle={`${req.branch.name} · requested ${formatDateTime(req.createdAt)}`}
        breadcrumbs={["Inventory", "Stock Requests", req.code]}
        badges={<Badge tone={status.tone}>{status.label}</Badge>}
        actions={
          <LinkButton href={INVENTORY_PATHS.stockRequests} variant="secondary">
            <ArrowLeft className="size-4" />
            Back
          </LinkButton>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <DataTable
          rows={req.lines}
          rowKey={(l) => l.id}
          columns={[
            {
              header: "Item",
              cell: (l: Line) => (
                <span className="flex flex-col leading-tight">
                  <span className="font-medium">{l.item.name}</span>
                  <span className="text-xs text-text-muted">
                    {l.item.code} · {l.code}
                  </span>
                </span>
              ),
            },
            { header: "Qty", align: "right", cell: (l: Line) => <span className="tabular-nums">{l.quantity}</span> },
            {
              header: "Status",
              cell: (l: Line) => {
                const s = LINE_STATUS[l.status] ?? { label: l.status, tone: "neutral" as const };
                return <Badge tone={s.tone}>{s.label}</Badge>;
              },
            },
            {
              header: "Updates",
              cell: (l: Line) => (
                <div className="max-w-md whitespace-normal text-xs text-text-muted">
                  {l.orderedAt && <p>Ordered {formatDateTime(l.orderedAt)}</p>}
                  {l.stockUnits.map((u) => (
                    <p key={u.id}>
                      {u.usid}: transferred {formatDateTime(u.allocatedAt)}
                      {u.receivedAt ? `, received ${formatDateTime(u.receivedAt)}` : ", awaiting receipt"}
                    </p>
                  ))}
                  {l.pmRemarks && <p className="text-text">Head Office: {l.pmRemarks}</p>}
                  {!l.orderedAt && l.stockUnits.length === 0 && !l.pmRemarks && <p>Waiting for Head Office</p>}
                </div>
              ),
            },
          ]}
        />
        <Card title="Request">
          <KvList
            items={[
              ["Request ID", req.code],
              ["Branch", `${req.branch.name} (${req.branch.code})`],
              ["Requested by", personName(req.requestedBy) ?? "—"],
              ["Date", formatDateTime(req.createdAt)],
              ["Notes", req.notes ?? "—"],
              [
                "Photos",
                photos.length === 0 ? (
                  "—"
                ) : (
                  <span key="photos" className="flex flex-wrap gap-2">
                    {photos.map((p) => (
                      <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${p.fileName}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- stored upload */}
                        <img src={p.url} alt={p.fileName} className="size-16 rounded-md border border-border object-cover" />
                      </a>
                    ))}
                  </span>
                ),
              ],
            ]}
          />
        </Card>
      </div>
    </>
  );
}
