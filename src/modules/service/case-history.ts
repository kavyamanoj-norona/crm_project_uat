import "server-only";
import { db } from "@/server/db";
import { personName } from "@/components/data/who-when";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { CASE_STATUS_LABELS, type CaseStatusValue } from "./case-schema";

export type HistoryCategory = "stage" | "handover" | "qc" | "items" | "worktype" | "outsource" | "password" | "action";

export type HistoryDetail = { heading?: string; rows: [label: string, value: string][] }[];

export type HistoryEntry = {
  key: string;
  at: Date;
  category: HistoryCategory;
  title: string;
  /** Set for stage changes, so the page can show the stage badge. */
  stage: CaseStatusValue | null;
  track: "Branch" | "Chip Lab" | null;
  by: string | null;
  note: string | null;
  /** Full details for the admin view; empty for everyone else. */
  detail: HistoryDetail;
};

const LAB_TRACK = new Set<string>([
  "CHIP_LAB_RECEIVED",
  "CHIP_LAB_DIAGNOSIS",
  "CHIP_LAB_PENDING_APPROVAL",
  "CHIP_LAB_SERVICING",
  "CHIP_LAB_READY_DISPATCH",
  "CHIP_LAB_QUALITY_CHECK",
  "NON_REPAIRABLE",
  "CHIP_BRANCH_RECEIVED",
]);

const label = (s: string) => CASE_STATUS_LABELS[s as CaseStatusValue] ?? s;
const yesNo = (passed: boolean) => (passed ? "Yes" : "No");

/** Activity-log actions shown as their own rows (everything else is covered by a richer source). */
const ACTIVITY_LABELS: Record<string, { title: string; category: HistoryCategory }> = {
  "case.lab.worktype": { title: "Work type changed", category: "worktype" },
  "case.lab.transfer-complete": { title: "Lab completed the transfer to the branch", category: "handover" },
  "case.password-reveal": { title: "Device passcode revealed", category: "password" },
  "case.engineer": { title: "Engineer assigned", category: "action" },
  "case.feedback": { title: "Customer feedback recorded", category: "action" },
  "whatsapp.send": { title: "WhatsApp message sent", category: "action" },
};
/** Logged actions that duplicate rows built from the stage history, QC answers, items or outsource records. */
const COVERED_ELSEWHERE = ["case.stage", "case.create", "case.qc", "case.estimate", "case.lab.outsource"];

/**
 * Everything that happened on a case, newest first: stage changes, branch ↔ lab
 * handovers, QC checklists, items, work-type changes, outsourcing and other user
 * actions. Password reveals and the per-row details are for admins only.
 */
export async function buildCaseHistory(caseId: string, opts: { isAdmin: boolean }): Promise<HistoryEntry[]> {
  const { isAdmin } = opts;
  const who = { select: { firstName: true, lastName: true } } as const;

  const [stages, qc, items, outsources, activity] = await Promise.all([
    db.caseStatusHistory.findMany({ where: { caseId }, orderBy: { at: "asc" }, include: { changedBy: who } }),
    db.caseQcResponse.findMany({ where: { caseId }, orderBy: { createdAt: "asc" }, include: { answeredBy: who } }),
    db.caseItem.findMany({ where: { caseId }, orderBy: { createdAt: "asc" }, include: { addedBy: who } }),
    db.chipLabOutsource.findMany({ where: { caseId }, orderBy: { createdAt: "asc" }, include: { vendor: true, createdBy: who } }),
    db.userActivityLog.findMany({
      where: {
        entity: "Case",
        entityId: caseId,
        action: { notIn: COVERED_ELSEWHERE },
        ...(isAdmin ? {} : { NOT: { action: "case.password-reveal" } }),
      },
      orderBy: { at: "asc" },
      include: { user: who },
    }),
  ]);

  /** Which side had the device when something happened. */
  const trackAt = (at: Date): "Branch" | "Chip Lab" => {
    let last: string | null = null;
    for (const s of stages) if (s.at.getTime() <= at.getTime()) last = s.toStatus;
    return last && LAB_TRACK.has(last) ? "Chip Lab" : "Branch";
  };

  const entries: HistoryEntry[] = [];

  // ── Stage changes & handovers ──
  for (const [index, s] of stages.entries()) {
    const to = s.toStatus as CaseStatusValue;
    const isCreate = !s.fromStatus;
    const handover = to === "CHIP_TRANSFER" || to === "CHIP_BRANCH_RECEIVED";
    const beenToLab = stages.slice(0, index).some((p) => p.toStatus === "CHIP_TRANSFER");
    const title = isCreate
      ? "Case created"
      : to === "CHIP_TRANSFER"
        ? s.fromStatus === "QUALITY_CHECK"
          ? beenToLab
            ? "Sent back to Chip-Level Lab (HO)"
            : "Sent to Chip-Level Lab (HO) after Quality Check"
          : "Handed over to Chip-Level Lab (HO)"
        : to === "CHIP_BRANCH_RECEIVED"
          ? "Transferred back to the Branch"
          : `Moved to ${label(to)}`;
    entries.push({
      key: `stage-${s.id}`,
      at: s.at,
      category: handover ? "handover" : "stage",
      title,
      stage: to,
      track: isCreate ? null : LAB_TRACK.has(to) ? "Chip Lab" : "Branch",
      by: personName(s.changedBy),
      note: s.note,
      detail: isAdmin
        ? [
            {
              rows: [
                ["From stage", s.fromStatus ? label(s.fromStatus) : "—"],
                ["To stage", label(to)],
                ["Changed by", personName(s.changedBy) ?? "System"],
                ["When", formatDateTime(s.at)],
                ["Note", s.note ?? "—"],
              ],
            },
          ]
        : [],
    });
  }

  // ── Quality Check checklists (one row per save) ──
  const qcGroups = new Map<string, typeof qc>();
  for (const r of qc) {
    const k = `${r.stage}|${r.createdAt.getTime()}`;
    qcGroups.set(k, [...(qcGroups.get(k) ?? []), r]);
  }
  for (const [k, rows] of qcGroups) {
    const first = rows[0]!;
    const no = rows.filter((r) => !r.passed);
    const replacedAt = first.removedAt;
    entries.push({
      key: `qc-${k}`,
      at: first.createdAt,
      category: "qc",
      title: `Quality Check checklist saved — ${rows.length - no.length} Yes${no.length ? `, ${no.length} No` : ""}`,
      stage: first.stage as CaseStatusValue,
      track: first.stage === "CHIP_LAB_QUALITY_CHECK" ? "Chip Lab" : "Branch",
      by: personName(first.answeredBy),
      note: no.length ? no.map((r) => `${r.title}: ${r.remarks ?? "—"}`).join(" · ") : null,
      detail: isAdmin
        ? [
            {
              heading: `${label(first.stage)} checklist${replacedAt ? ` (replaced ${formatDateTime(replacedAt)})` : " (current)"}`,
              rows: rows.map((r): [string, string] => [r.title, `${yesNo(r.passed)}${r.remarks ? ` — ${r.remarks}` : ""}`]),
            },
            { rows: [["Answered by", personName(first.answeredBy) ?? "—"], ["When", formatDateTime(first.createdAt)]] },
          ]
        : [],
    });
  }

  // ── Billable items (one row per save) ──
  const itemGroups = new Map<number, typeof items>();
  for (const i of items) itemGroups.set(i.createdAt.getTime(), [...(itemGroups.get(i.createdAt.getTime()) ?? []), i]);
  for (const [ms, rows] of itemGroups) {
    const first = rows[0]!;
    const total = rows.reduce((sum, r) => sum + r.lineTotalPaise, 0);
    entries.push({
      key: `items-${ms}`,
      at: first.createdAt,
      category: "items",
      title: `Items updated — ${rows.length} ${rows.length === 1 ? "item" : "items"}, ${formatPaise(total)}`,
      stage: null,
      track: trackAt(first.createdAt),
      by: personName(first.addedBy),
      note: rows.map((r) => `${r.name} × ${r.quantity}`).join(", "),
      detail: isAdmin
        ? [
            {
              heading: first.removedAt ? `Replaced ${formatDateTime(first.removedAt)}` : "Current items",
              rows: rows.map((r): [string, string] => [
                `${r.name} (${r.code})`,
                `${r.quantity} × ${formatPaise(r.unitPricePaise)} = ${formatPaise(r.lineTotalPaise)}`,
              ]),
            },
            { rows: [["Total", formatPaise(total)], ["Saved by", personName(first.addedBy) ?? "—"], ["When", formatDateTime(first.createdAt)]] },
          ]
        : [],
    });
  }

  // ── Outsourcing to vendors ──
  for (const o of outsources) {
    entries.push({
      key: `out-${o.id}`,
      at: o.createdAt,
      category: "outsource",
      title: `Outsourced to ${o.vendor.name}`,
      stage: null,
      track: "Chip Lab",
      by: personName(o.createdBy),
      note: o.notes,
      detail: isAdmin
        ? [
            {
              rows: [
                ["Vendor", o.vendor.name],
                ["Sent", formatDate(o.sentAt)],
                ["Expected return", o.expectedReturnAt ? formatDate(o.expectedReturnAt) : "—"],
                ["Reference", o.referenceNo ?? "—"],
                ["Notes", o.notes ?? "—"],
                ["Recorded by", personName(o.createdBy) ?? "—"],
              ],
            },
          ]
        : [],
    });
    if (o.actualReturnAt) {
      entries.push({
        key: `ret-${o.id}`,
        at: o.actualReturnAt,
        category: "outsource",
        title: `Returned from ${o.vendor.name}`,
        stage: null,
        track: "Chip Lab",
        by: null,
        note: null,
        detail: isAdmin ? [{ rows: [["Vendor", o.vendor.name], ["Returned", formatDateTime(o.actualReturnAt)]] }] : [],
      });
    }
  }

  // ── Other logged user actions ──
  for (const a of activity) {
    const meta = ACTIVITY_LABELS[a.action] ?? { title: a.action, category: "action" as const };
    const by = personName(a.user);
    entries.push({
      key: `act-${a.id}`,
      at: a.at,
      category: meta.category,
      title: meta.title,
      stage: null,
      track: trackAt(a.at),
      by,
      note: a.action === "case.password-reveal" ? null : a.detail,
      detail: isAdmin
        ? [
            {
              rows: [
                ["Action", meta.title],
                ["By", by ?? "System"],
                ["When", formatDateTime(a.at)],
                ["Details", a.detail ?? "—"],
                ...(a.ip ? ([["IP address", a.ip]] as [string, string][]) : []),
              ],
            },
          ]
        : [],
    });
  }

  // Newest first, so the latest activity is row 1.
  return entries.sort((a, b) => b.at.getTime() - a.at.getTime());
}
