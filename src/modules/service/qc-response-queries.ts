import "server-only";
import { db } from "@/server/db";
import type { QcStage } from "./qc-answer-schema";

/** Row shape the checklist panel renders (serialisable: dates are ISO strings). */
export type QcPanelRow = {
  id: string;
  title: string;
  description: string | null;
  answer: { passed: boolean; remarks: string | null; by: string | null; at: string } | null;
};

/**
 * Active checklist points with this QC round's answers. A round starts when the
 * case enters the stage, so answers from an earlier visit (e.g. before the case
 * was sent back to the lab) don't count.
 */
export async function getQcState(caseId: string, stage: QcStage, stageChangedAt: Date) {
  const [items, answers] = await Promise.all([
    db.qcChecklistItem.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, description: true },
    }),
    db.caseQcResponse.findMany({
      where: { caseId, stage, removedAt: null, createdAt: { gte: stageChangedAt } },
      select: {
        checklistItemId: true,
        passed: true,
        remarks: true,
        createdAt: true,
        answeredBy: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);
  const byItem = new Map(answers.map((a) => [a.checklistItemId, a]));
  const rows: QcPanelRow[] = items.map((i) => {
    const a = byItem.get(i.id);
    return {
      ...i,
      answer: a
        ? {
            passed: a.passed,
            remarks: a.remarks,
            by: a.answeredBy ? [a.answeredBy.firstName, a.answeredBy.lastName].filter(Boolean).join(" ") : null,
            at: a.createdAt.toISOString(),
          }
        : null,
    };
  });
  return { rows, complete: rows.every((r) => r.answer !== null) };
}

/** The latest saved answers for a stage, for viewing after the case has moved on. Empty when none were saved. */
export async function getSavedQcAnswers(caseId: string, stage: QcStage): Promise<QcPanelRow[]> {
  const answers = await db.caseQcResponse.findMany({
    where: { caseId, stage, removedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      checklistItemId: true,
      title: true,
      passed: true,
      remarks: true,
      createdAt: true,
      answeredBy: { select: { firstName: true, lastName: true } },
    },
  });
  return answers.map((a) => ({
    id: a.checklistItemId,
    title: a.title,
    description: null,
    answer: {
      passed: a.passed,
      remarks: a.remarks,
      by: a.answeredBy ? [a.answeredBy.firstName, a.answeredBy.lastName].filter(Boolean).join(" ") : null,
      at: a.createdAt.toISOString(),
    },
  }));
}

/** Why the case can't leave its QC stage yet, or null when the checklist is complete. */
export async function qcBlockReason(caseId: string, stage: QcStage): Promise<string | null> {
  const c = await db.case.findUnique({ where: { id: caseId }, select: { stageChangedAt: true } });
  if (!c) return null;
  const { rows, complete } = await getQcState(caseId, stage, c.stageChangedAt);
  if (complete) return null;
  const left = rows.filter((r) => r.answer === null).length;
  return `Complete the Quality Check checklist first (${left} ${left === 1 ? "item" : "items"} unanswered).`;
}
