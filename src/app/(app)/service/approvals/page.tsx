import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { ListView } from "@/components/data/list-view";
import { personName } from "@/components/data/who-when";
import { formatDateTime } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { listState } from "@/lib/list";
import { getBranchScope } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";
import { quoteWhatsAppLink } from "@/server/notify/customer";
import { AdminPage } from "@/modules/admin/components/admin-page";
import { isPurchaseManager } from "@/modules/inventory/purchase-access";
import { decideApprovalRequest } from "@/modules/service/actions/approval";
import { recordLabQuoteDecision, sendLabQuoteToCustomer } from "@/modules/service/actions/lab-quote";
import { approvalKinds } from "@/modules/service/approval-access";
import { APPROVAL_SORTS, listApprovalRequests } from "@/modules/service/approval-queries";
import { DecisionDialogs } from "@/modules/service/components/approval-dialogs";
import { CustomerDecisionDialogs, SendToCustomerDialog } from "@/modules/service/components/lab-quote-dialogs";
import { SERVICE_PATHS } from "@/modules/service/paths";

export const metadata = { title: "Approval Inbox" };

const TONE = { PENDING: "warning", SENT: "primary", APPROVED: "success", REJECTED: "danger" } as const;
const LABEL = { PENDING: "Pending", SENT: "With customer", APPROVED: "Approved", REJECTED: "Rejected" } as const;
const LAB_LABEL = { PENDING: "To send to customer", SENT: "With customer", APPROVED: "Customer approved", REJECTED: "Customer rejected" } as const;

export default async function ApprovalInboxPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user, permission } = await requirePageAccess(SERVICE_PATHS.approvals);
  const kinds = approvalKinds(user);
  // Branch staff, the Purchase Manager and admins use this inbox; everyone else has nothing here.
  if (!permission.canView) redirect("/forbidden");
  const sp = await searchParams;
  const list = listState(SERVICE_PATHS.approvals, sp, { sorts: APPROVAL_SORTS, defaultSort: "requestedAt" });
  const scope = await getBranchScope(user);
  const { rows, total, tabs } = await listApprovalRequests(list, scope.branchId, kinds);
  const both = kinds.length > 1;
  const labOnly = kinds.length === 1 && kinds[0] === "LAB_QUOTE";
  const canDecideManual = permission.canApprove && isPurchaseManager(user);
  const canHandleLab = permission.canApprove && user.privilege.code !== "PURCHASE_MANAGER";

  return (
    <AdminPage
      title="Approval Inbox"
      group="Service"
      subtitle={
        labOnly
          ? "Quotes from the chip-level lab that need the customer's approval. Send each to the customer, then record their answer."
          : "Cases where the customer approved the quotation verbally or by other means. Review the branch's note and confirm."
      }
    >
      <ListView
        list={list}
        total={total}
        tabs={tabs}
        tone="blue"
        rows={rows}
        rowKey={(r) => r.id}
        searchPlaceholder="Search by case ID, customer or branch"
        empty="No approval requests here."
        columns={[
          {
            header: "Case",
            cell: (r) => (
              <>
                <Link href={`${SERVICE_PATHS.cases}/${r.case.id}`} className="text-sm font-medium text-primary hover:underline">
                  {r.case.jobsheetNo}
                </Link>
                <p className="text-xs text-text-muted">{[r.case.brand, r.case.model].filter(Boolean).join(" ") || "—"}</p>
              </>
            ),
          },
          ...(both
            ? [{ header: "Type", cell: (r: (typeof rows)[number]) => <Badge tone={r.kind === "LAB_QUOTE" ? "indigo" : "navy"}>{r.kind === "LAB_QUOTE" ? "Lab quote" : "Manual approval"}</Badge> }]
            : []),
          { header: "Customer", cell: (r) => r.case.customer.name },
          { header: "Branch", cell: (r) => <span className="text-xs text-text-muted">{r.case.branch.code} — {r.case.branch.name}</span> },
          {
            header: "Quotation",
            align: "right",
            cell: (r) => (
              <>
                <span className="font-semibold tabular-nums">{formatPaise(r.quoteAmountPaise)}</span>
                {r.kind === "LAB_QUOTE" && r.baselinePaise !== null && <p className="text-xs text-text-muted">was {formatPaise(r.baselinePaise)}</p>}
              </>
            ),
          },
          {
            header: labOnly ? "From the lab" : both ? "Request note" : "Branch note",
            cell: (r) => (
              <>
                <p className="max-w-64 whitespace-pre-wrap text-sm">{r.requestNote}</p>
                <p className="text-xs text-text-muted">
                  {personName(r.requestedBy) ?? "—"} · {formatDateTime(r.requestedAt)}
                </p>
              </>
            ),
          },
          ...(rows.some((r) => r.kind === "LAB_QUOTE")
            ? [
                {
                  header: "Sent to customer",
                  cell: (r: (typeof rows)[number]) =>
                    r.sentAt ? (
                      <>
                        <p className="max-w-64 whitespace-pre-wrap text-sm">{r.sendRemarks}</p>
                        <p className="text-xs text-text-muted">
                          {personName(r.sentBy) ?? "—"} · {formatDateTime(r.sentAt)}
                        </p>
                      </>
                    ) : (
                      "—"
                    ),
                },
              ]
            : []),
          {
            header: "Decision",
            cell: (r) => (
              <>
                <Badge tone={TONE[r.status]}>{(r.kind === "LAB_QUOTE" ? LAB_LABEL : LABEL)[r.status]}</Badge>
                {r.reviewedAt && (
                  <>
                    <p className="mt-1 max-w-64 whitespace-pre-wrap text-sm">{r.reviewRemarks}</p>
                    <p className="text-xs text-text-muted">
                      {personName(r.reviewedBy) ?? "—"} · {formatDateTime(r.reviewedAt)}
                    </p>
                  </>
                )}
              </>
            ),
          },
          {
            header: "Actions",
            align: "center",
            cell: (r) => {
              if (r.kind === "MANUAL_APPROVAL")
                return r.status === "PENDING" && canDecideManual ? (
                  <DecisionDialogs
                    jobsheetNo={r.case.jobsheetNo}
                    approve={decideApprovalRequest.bind(null, r.id, "APPROVED")}
                    reject={decideApprovalRequest.bind(null, r.id, "REJECTED")}
                  />
                ) : null;
              if (!canHandleLab) return null;
              if (r.status === "PENDING")
                return <SendToCustomerDialog jobsheetNo={r.case.jobsheetNo} action={sendLabQuoteToCustomer.bind(null, r.id)} />;
              if (r.status === "SENT")
                return (
                  <div className="flex flex-col items-center gap-1.5">
                    <LinkButton
                      href={quoteWhatsAppLink({
                        customerName: r.case.customer.name,
                        customerPhone: r.case.customer.phone,
                        jobsheetNo: r.case.jobsheetNo,
                        device: [r.case.brand, r.case.model].filter(Boolean).join(" "),
                        estimatePaise: r.quoteAmountPaise,
                        branchName: r.case.branch.name,
                      })}
                      variant="secondary"
                      size="sm"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="size-4" /> WhatsApp customer
                    </LinkButton>
                    <CustomerDecisionDialogs
                      jobsheetNo={r.case.jobsheetNo}
                      approve={recordLabQuoteDecision.bind(null, r.id, "APPROVED")}
                      reject={recordLabQuoteDecision.bind(null, r.id, "REJECTED")}
                    />
                  </div>
                );
              return null;
            },
          },
        ]}
      />
    </AdminPage>
  );
}
