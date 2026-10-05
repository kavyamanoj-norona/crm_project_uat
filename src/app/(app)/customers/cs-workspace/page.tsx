import Link from "next/link";
import { Phone, MessageCircle, Clock, Star, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { enumLabel } from "@/lib/enum";
import { CUSTOMER_PATHS } from "@/modules/customers/paths";
import { SERVICE_PATHS } from "@/modules/service/paths";
import { getCsWorkspaceData } from "@/modules/customers/queries";
import { requirePageAccess } from "@/server/rbac/guard";
import { branchWhere, getBranchScope } from "@/server/branch-scope";

export const metadata = { title: "CS Workspace" };

function SectionHeader({ title, count, tone }: { title: string; count: number; tone: "danger" | "warning" | "primary" }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-base font-bold text-brand-navy dark:text-text">{title}</h2>
      {count > 0 && <Badge tone={tone}>{count} pending</Badge>}
    </div>
  );
}

function EmptySlot({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border py-8 text-center">
      <p className="text-sm text-text-muted">{message}</p>
    </div>
  );
}

export default async function CsWorkspacePage() {
  const { user } = await requirePageAccess(CUSTOMER_PATHS.csWorkspace);
  const scope = await getBranchScope(user);
  const { feedbackPending, readyForDelivery, lapseRisk } = await getCsWorkspaceData(branchWhere(scope));

  return (
    <>
      <PageHeader
        title="Customer Success Workspace"
        subtitle="The anti-leakage engine — every follow-up logged with an outcome"
        breadcrumbs={["Customers & Support", "CS Workspace"]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Column 1: Feedback pending ── */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <SectionHeader title="Feedback Calls" count={feedbackPending.length} tone="primary" />
          <p className="mb-4 text-xs text-text-muted">
            Closed cases with no feedback collected yet — call the customer.
          </p>
          {feedbackPending.length === 0 ? (
            <EmptySlot message="All closed cases have feedback. Great job!" />
          ) : (
            <div className="space-y-3">
              {feedbackPending.map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg border border-border bg-surface-muted/40 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`${SERVICE_PATHS.cases}/${c.id}`}
                        className="block text-sm font-bold text-brand-navy hover:text-primary dark:text-text"
                      >
                        {c.jobsheetNo}
                      </Link>
                      <p className="mt-0.5 truncate text-sm font-medium">{c.customer.name}</p>
                      <p className="text-xs text-text-muted">
                        {enumLabel(c.productType)} · {c.brand} {c.model}
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        Closed {formatDate(c.updatedAt)} · {c.branch.code}
                        {c.estimatedCostPaise ? ` · ${formatPaise(c.estimatedCostPaise)}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <a
                        href={`tel:${c.customer.phone}`}
                        className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-primary/90"
                      >
                        <Phone className="size-3" /> Call
                      </a>
                      <Link
                        href={`${SERVICE_PATHS.cases}/${c.id}?feedback=1`}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-surface-muted"
                      >
                        <Star className="size-3" /> Log
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Column 2: Ready for delivery ── */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <SectionHeader title="Ready for Pickup" count={readyForDelivery.length} tone="warning" />
          <p className="mb-4 text-xs text-text-muted">
            Devices waiting &gt;24 hours — remind the customer to collect.
          </p>
          {readyForDelivery.length === 0 ? (
            <EmptySlot message="No devices waiting for more than 24 hours." />
          ) : (
            <div className="space-y-3">
              {readyForDelivery.map((c) => {
                const waitHours = Math.round(
                  (Date.now() - new Date(c.stageChangedAt).getTime()) / (1000 * 60 * 60),
                );
                return (
                  <div
                    key={c.id}
                    className="rounded-lg border border-border bg-surface-muted/40 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`${SERVICE_PATHS.cases}/${c.id}`}
                          className="block text-sm font-bold text-brand-navy hover:text-primary dark:text-text"
                        >
                          {c.jobsheetNo}
                        </Link>
                        <p className="mt-0.5 truncate text-sm font-medium">{c.customer.name}</p>
                        <p className="text-xs text-text-muted">
                          {enumLabel(c.productType)} · {c.brand} {c.model}
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                          <Clock className="size-3" />
                          Waiting {waitHours}h · {c.branch.code}
                        </p>
                      </div>
                      <a
                        href={`tel:${c.customer.phone}`}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-600"
                      >
                        <Phone className="size-3" /> Call
                      </a>
                    </div>
                    {c.estimatedCostPaise && (
                      <p className="mt-2 text-right text-xs font-bold text-text">
                        {formatPaise(c.estimatedCostPaise)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Column 3: Lapse risk ── */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <SectionHeader title="Lapse Risk" count={lapseRisk.length} tone="danger" />
          <p className="mb-4 text-xs text-text-muted">
            Active customers with no visit in 60+ days — send a nudge.
          </p>
          {lapseRisk.length === 0 ? (
            <EmptySlot message="No lapse-risk customers right now." />
          ) : (
            <div className="space-y-3">
              {lapseRisk.map((c) => {
                const daysAgo = c.lastVisitAt
                  ? Math.round((Date.now() - new Date(c.lastVisitAt).getTime()) / (1000 * 60 * 60 * 24))
                  : null;
                return (
                  <div
                    key={c.id}
                    className="rounded-lg border border-border bg-surface-muted/40 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`${CUSTOMER_PATHS.database}/${c.id}`}
                          className="block text-sm font-bold text-brand-navy hover:text-primary dark:text-text"
                        >
                          {c.name}
                        </Link>
                        <p className="text-xs text-text-muted">{c.code} · {c.visitCount} visits total</p>
                        {c.lastVisitAt && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                            <AlertCircle className="size-3" />
                            Last seen {daysAgo}d ago · {formatDate(c.lastVisitAt)}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col gap-1.5">
                        <a
                          href={`tel:${c.phone}`}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-surface-muted"
                        >
                          <Phone className="size-3" /> Call
                        </a>
                        <a
                          href={`https://wa.me/91${c.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-green-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-600"
                        >
                          <MessageCircle className="size-3" /> WA
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-text-muted">
        Queue refreshes on every page load · Branch scope:{" "}
        <span className="font-medium">{scope.branch?.name ?? "All branches"}</span>
      </p>
    </>
  );
}
