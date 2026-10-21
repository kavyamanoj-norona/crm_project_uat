import { PhoneCall, PhoneIncoming } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { KvList } from "@/components/ui/kv-list";
import { Timeline, type TimelineItem } from "@/components/data/timeline";
import { personName } from "@/components/data/who-when";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { LEAD_SOURCE_LABELS } from "@/modules/customers/schemas";
import { INTAKE_TYPE_LABELS } from "@/modules/service/case-schema";
import { tatDays } from "../format";
import type { getLeadWithCalls, listServicePrices } from "../queries";
import { CALL_OUTCOME_LABELS, LEAD_STATUS_LABELS, LEAD_STATUS_TONE, type CallOutcomeValue, type LeadStatusValue } from "../status";

type Lead = NonNullable<Awaited<ReturnType<typeof getLeadWithCalls>>>;
type Estimates = Awaited<ReturnType<typeof listServicePrices>>;

const OUTCOME_TONE_DANGER: CallOutcomeValue[] = ["NOT_INTERESTED", "WRONG_NUMBER"];

/** The lead's call history, newest first: who called (telecaller or which branch), the outcome, remarks and next follow-up. */
export function CallHistory({ calls }: { calls: Lead["leadCalls"] }) {
  const items: TimelineItem[] = calls.map((c) => ({
    key: c.id,
    icon: c.side === "BRANCH" ? <PhoneIncoming /> : <PhoneCall />,
    title: `${CALL_OUTCOME_LABELS[c.outcome as CallOutcomeValue]} · ${c.side === "BRANCH" ? `Branch${c.branch ? ` ${c.branch.code}` : ""}` : "Telecaller"}`,
    detail: [c.remarks, c.nextFollowUpAt ? `Next follow-up ${formatDateTime(c.nextFollowUpAt)}` : null].filter(Boolean).join(" — ") || null,
    meta: `${formatDateTime(c.calledAt)} · ${personName(c.calledBy) ?? "—"}`,
    tone: OUTCOME_TONE_DANGER.includes(c.outcome as CallOutcomeValue) ? "danger" : "default",
  }));
  return <Timeline items={items} />;
}

/** Everything about a lead on one screen. Shared by the Leads and Branch Call List detail pages. */
export function LeadDetail({ lead, estimates, actions }: { lead: Lead; estimates: Estimates; actions?: React.ReactNode }) {
  const p = lead.leadProfile;
  const status = (p?.status ?? (lead.kind === "CUSTOMER" ? "CONVERTED" : "NEW")) as LeadStatusValue;
  const tat = p ? tatDays(p.firstInteractionAt, lead.createdAt, p.billingDate) : null;
  const overdue = p?.nextFollowUpAt && p.nextFollowUpAt.getTime() < Date.now();

  return (
    <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
      <div className="min-w-0 space-y-6">
        <Card title="Call history" actions={actions}>
          {p?.nextFollowUpAt && (
            <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${overdue ? "bg-danger/10 text-danger" : "bg-warning/10 text-text"}`}>
              {overdue ? "Overdue follow-up" : "Next follow-up"}: <span className="font-semibold">{formatDateTime(p.nextFollowUpAt)}</span>
            </p>
          )}
          {lead.leadCalls.length === 0 ? <p className="text-sm text-text-muted">No calls recorded yet.</p> : <CallHistory calls={lead.leadCalls} />}
        </Card>

        <Card title="Service price estimates">
          {estimates.length === 0 ? (
            <p className="text-sm text-text-muted">No estimates are set up yet.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {estimates.map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
                  <span className="min-w-0">
                    {e.name}
                    {e.notes && <span className="block text-xs text-text-muted">{e.notes}</span>}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatPaise(e.minPaise)} – {formatPaise(e.maxPaise)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="min-w-0 space-y-6">
        <Card title="Lead" actions={<Badge tone={LEAD_STATUS_TONE[status]}>{LEAD_STATUS_LABELS[status]}</Badge>}>
          <KvList
            items={[
              ["Lead ID", lead.leadCode],
              ...(lead.kind === "CUSTOMER" ? ([["Customer ID", lead.code]] as [string, string][]) : []),
              ["Customer", lead.name],
              ["Mobile", formatPhone(lead.phone)],
              ["Email", lead.email],
              ["Reported issue", lead.purpose],
              ["Remarks", lead.notes],
              ["Source", lead.source ? LEAD_SOURCE_LABELS[lead.source] : null],
              ["Branch", lead.branch ? `${lead.branch.name} (${lead.branch.code})` : "Unassigned"],
              ["Created", `${formatDate(lead.createdAt)}${personName(lead.createdBy) ? ` · ${personName(lead.createdBy)}` : ""}`],
              ["Converted", lead.convertedAt ? `${formatDate(lead.convertedAt)}${personName(lead.convertedBy) ? ` · ${personName(lead.convertedBy)}` : ""}` : null],
            ]}
          />
        </Card>
        <Card title="Tracking">
          <KvList
            items={[
              ["Service mode", p?.serviceMode ? INTAKE_TYPE_LABELS[p.serviceMode] : null],
              ["Appointment", p?.appointmentAt ? formatDateTime(p.appointmentAt) : null],
              ["Token number", p?.tokenNo],
              ["Walk-in date", p?.walkInDate ? formatDate(p.walkInDate) : null],
              ["Billing date", p?.billingDate ? formatDate(p.billingDate) : null],
              ["Purchase cost", p?.purchaseCostPaise != null ? formatPaise(p.purchaseCostPaise) : null],
              ["Margin", p?.marginPaise != null ? formatPaise(p.marginPaise) : null],
              ["TAT", tat === null ? null : `${tat} ${tat === 1 ? "day" : "days"}`],
              ["First interaction", formatDate(p?.firstInteractionAt ?? lead.createdAt)],
              ["Sales person", personName(p?.salesPerson)],
              ["Telecaller", personName(p?.assignedTelecaller)],
              ["Assigned to branch", p?.assignedToBranchAt ? `${formatDate(p.assignedToBranchAt)}${personName(p.assignedToBranchBy) ? ` · ${personName(p.assignedToBranchBy)}` : ""}` : null],
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
