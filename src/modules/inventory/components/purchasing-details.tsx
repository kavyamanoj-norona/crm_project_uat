import Link from "next/link";
import { Eye, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { KvList } from "@/components/ui/kv-list";
import { ModalButton } from "@/components/ui/modal-button";
import { formatDate, formatDateTime } from "@/lib/dates";

type Person = { firstName: string; lastName?: string | null } | null | undefined;
type Photo = { id: string; url: string; fileName: string };
type CaseRef = { id: string; jobsheetNo: string } | null | undefined;

const name = (u: Person) => (u ? [u.firstName, u.lastName].filter(Boolean).join(" ") : null);
const when = (d: Date | null | undefined, by?: Person) => (d ? `${formatDateTime(d)}${by ? ` · ${name(by)}` : ""}` : null);

/** Marks a request raised again because the earlier unit was defective or not working. */
export function ReplacementTag() {
  return (
    <Badge tone="warning">
      <RefreshCw className="size-3" /> Replacement / Reorder
    </Badge>
  );
}

/** The eye icon on a table row: opens `children` in a modal. */
export function ViewButton({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <ModalButton
      trigger={
        <>
          <Eye className="size-4" />
          <span className="sr-only">View details</span>
        </>
      }
      variant="ghost"
      buttonSize="sm"
      className="size-8 !px-0"
      title={title}
      description={subtitle}
      size="lg"
    >
      {children}
    </ModalButton>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-brand-navy dark:text-text">{title}</h3>
      {children}
    </section>
  );
}

function Notes({ label, text }: { label: string; text: string | null | undefined }) {
  return (
    <div className="rounded-lg border border-border bg-surface-muted/60 p-3">
      <p className="mb-1 text-xs font-bold text-text-muted">{label}</p>
      <p className="whitespace-pre-wrap break-words text-sm">{text || "—"}</p>
    </div>
  );
}

function PhotoGrid({ photos }: { photos: Photo[] }) {
  if (photos.length === 0) return <p className="text-sm text-text-muted">No photos were added.</p>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {photos.map((p) => (
        <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-lg border border-border bg-surface-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- uploaded file, size unknown */}
          <img src={p.url} alt={p.fileName} className="aspect-4/3 w-full object-cover transition-transform group-hover:scale-[1.03]" />
        </a>
      ))}
    </div>
  );
}

const caseLink = (c: CaseRef) =>
  c ? (
    <Link href={`/service/cases/${c.id}`} className="font-medium text-primary hover:underline">
      {c.jobsheetNo}
    </Link>
  ) : null;

type RequestData = {
  code: string;
  isReplacement: boolean;
  replacementReason: string | null;
  replacementConfirmedAt: Date | null;
  replacementConfirmedBy: Person;
  replacementOf: { code: string } | null;
  modelNo: string | null;
  notes: string | null;
  pmRemarks: string | null;
  quantity: number;
  consumedQty: number;
  createdAt: Date;
  orderedAt: Date | null;
  transferredAt: Date | null;
  item: { code: string; name: string };
  branch: { code: string; name: string };
  case: (CaseRef & { customer?: { name: string } | null; branch?: { code: string; name: string } | null }) | null;
  requestedBy: Person;
  attachments: Photo[];
  stockUnits: { id: string; usid: string; status: string; receivedAt: Date | null }[];
};

/** Everything a Purchase Manager needs to act on a request: what, why, for which case, and the branch photos. */
export function RequestDetails({ pr, status }: { pr: RequestData; status: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {status}
        <span className="text-xs text-text-muted">{pr.code}</span>
      </div>
      {pr.isReplacement && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
          <div className="mb-2 flex items-center gap-2">
            <ReplacementTag />
            {pr.replacementOf && <span className="text-xs text-text-muted">replaces {pr.replacementOf.code}</span>}
          </div>
          <p className="text-xs font-bold text-text-muted">Reason</p>
          <p className="mb-2 whitespace-pre-wrap break-words text-sm">{pr.replacementReason || "—"}</p>
          <p className="text-xs text-text-muted">
            Confirmed by <span className="font-medium text-text">{name(pr.replacementConfirmedBy) ?? "—"}</span>
            {pr.replacementConfirmedAt && <> · {formatDateTime(pr.replacementConfirmedAt)}</>}
          </p>
        </div>
      )}
      <Section title="Request">
        <KvList
          items={[
            ["Item", `${pr.item.name} (${pr.item.code})`],
            ["Model number", pr.modelNo],
            // The part is for the case branch, even when another branch (e.g. the chip-level lab) raised the request.
            ["Branch", `${(pr.case?.branch ?? pr.branch).name} (${(pr.case?.branch ?? pr.branch).code})`],
            ["Raised by branch", pr.case?.branch && pr.case.branch.code !== pr.branch.code ? `${pr.branch.name} (${pr.branch.code})` : null],
            ["Case ID", caseLink(pr.case)],
            ["Customer", pr.case?.customer?.name],
            ["Raised", when(pr.createdAt, pr.requestedBy)],
            ["Ordered", when(pr.orderedAt)],
            ["Transferred", when(pr.transferredAt)],
          ]}
        />
      </Section>
      <div className="grid gap-3 sm:grid-cols-2">
        <Notes label="Branch notes" text={pr.notes} />
        <Notes label="Purchase Manager remarks" text={pr.pmRemarks} />
      </div>
      <Section title={`Photos (${pr.attachments.length})`}>
        <PhotoGrid photos={pr.attachments} />
      </Section>
      {pr.stockUnits.length > 0 && (
        <Section title="Transferred units">
          <ul className="space-y-1 text-sm">
            {pr.stockUnits.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <span className="font-medium tabular-nums">{u.usid}</span>
                <span className="text-xs text-text-muted">{u.status === "ALLOCATED" ? "Awaiting receipt" : `Received ${formatDate(u.receivedAt)}`}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

type ReturnData = {
  returnType: string;
  notes: string;
  warrantyEndsAt: Date | null;
  createdAt: Date;
  reviewedAt: Date | null;
  case: { id: string; jobsheetNo: string; customer: { name: string }; branch: { code: string; name: string } };
  caseItem: { name: string; code: string; quantity: number };
  createdBy: Person;
  reviewedBy: Person;
  attachments: Photo[];
};

export function ReturnDetails({ r, status }: { r: ReturnData; status: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {status}
        <Badge tone="navy">{r.returnType === "WARRANTY_CLAIM" ? "Warranty claim" : "Return"}</Badge>
      </div>
      <Section title="Item">
        <KvList
          items={[
            ["Product", `${r.caseItem.name} (${r.caseItem.code})`],
            ["Quantity", r.caseItem.quantity],
            ["Case ID", caseLink(r.case)],
            ["Customer", r.case.customer.name],
            ["Branch", `${r.case.branch.name} (${r.case.branch.code})`],
            ...(r.returnType === "WARRANTY_CLAIM" ? ([["Warranty until", formatDate(r.warrantyEndsAt)]] as [string, React.ReactNode][]) : []),
            ["Raised", when(r.createdAt, r.createdBy)],
            ["Reviewed", when(r.reviewedAt, r.reviewedBy)],
          ]}
        />
      </Section>
      <Notes label="Reason" text={r.notes} />
      <Section title={`Photos (${r.attachments.length})`}>
        <PhotoGrid photos={r.attachments} />
      </Section>
    </div>
  );
}

type UnitData = {
  usid: string;
  returnType?: string | null;
  returnRemarks?: string | null;
  returnedAt?: Date | null;
  note: string | null;
  allocatedAt: Date | null;
  receivedAt: Date | null;
  consumedAt: Date | null;
  item: { code: string; name: string };
  allocatedCase: CaseRef;
  allocatedBranch: { code: string; name: string } | null;
  allocatedBy: Person;
  receivedBy: Person;
  consumedBy: Person;
  billItem: { bill: { code: string; billNo: string; supplier: { name: string } } } | null;
  purchaseRequest: { code: string; modelNo: string | null; notes: string | null; pmRemarks: string | null } | null;
  attachments: Photo[];
};

/** One physical unit (USID): where it came from, where it went, and who handled it at each step. */
export function UnitDetails({ u, status }: { u: UnitData; status: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">{status}</div>
      <Section title="Unit">
        <KvList
          items={[
            ["USID", <span key="u" className="font-semibold tabular-nums">{u.usid}</span>],
            ["Item", `${u.item.name} (${u.item.code})`],
            ["Model number", u.purchaseRequest?.modelNo],
            ["Case ID", caseLink(u.allocatedCase)],
            ["Branch", u.allocatedBranch ? `${u.allocatedBranch.name} (${u.allocatedBranch.code})` : null],
            ["Request", u.purchaseRequest?.code],
            ["Bought on bill", u.billItem ? `${u.billItem.bill.billNo} · ${u.billItem.bill.supplier.name}` : "Opening stock"],
          ]}
        />
      </Section>
      <Section title="History">
        <KvList
          items={[
            ["Transferred", when(u.allocatedAt, u.allocatedBy)],
            ["Received", when(u.receivedAt, u.receivedBy)],
            ["Consumed", when(u.consumedAt, u.consumedBy)],
            ["Returned", u.returnedAt ? `${u.returnType === "COURIER_DAMAGE" ? "Courier / Branch damage" : "Defective / Not working"} · ${formatDateTime(u.returnedAt)}` : null],
            ["Return remarks", u.returnRemarks],
          ]}
        />
      </Section>
      <div className="grid gap-3 sm:grid-cols-2">
        <Notes label="Branch notes" text={u.purchaseRequest?.notes} />
        <Notes label="Transfer note / remarks" text={[u.note, u.purchaseRequest?.pmRemarks].filter(Boolean).join("\n") || null} />
      </div>
      <Section title={`Photos (${u.attachments.length})`}>
        <PhotoGrid photos={u.attachments} />
      </Section>
    </div>
  );
}
