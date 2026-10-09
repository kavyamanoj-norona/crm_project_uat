"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { branchWhere, getBranchScope } from "@/server/branch-scope";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { pick, toFieldErrors, type FormState } from "@/lib/form";
import { QC_STAGES, qcAnswersSchema, type QcStage } from "../qc-answer-schema";
import { SERVICE_PATHS } from "../paths";

const STALE = "Someone else changed this case just now. Refresh to see its current stage.";

/**
 * Saves the QC checklist answers for the case's current QC stage — branch
 * Quality Check or the lab's Quality Check. Every active checklist item must be
 * answered; "No" needs remarks. Append-only: old answers are retired, not edited.
 */
export async function saveQcAnswers(caseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = qcAnswersSchema.safeParse(pick(formData, ["answers"]));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  const answers = parsed.data.answers;

  try {
    const probe = await db.case.findFirst({ where: { id: caseId, status: { in: [...QC_STAGES] } }, select: { status: true } });
    if (!probe) return { message: "This case isn't in a Quality Check stage." };
    const stage = probe.status as QcStage;

    const user = await requireActionPermission(stage === "QUALITY_CHECK" ? SERVICE_PATHS.cases : SERVICE_PATHS.lab, "canEdit");
    // Branch QC is branch-scoped; the lab works across branches.
    const scope = stage === "QUALITY_CHECK" ? branchWhere(await getBranchScope(user)) : {};
    const c = await db.case.findFirst({ where: { id: caseId, status: stage, ...scope }, select: { id: true } });
    if (!c) return { message: "Case not found." };

    const items = await db.qcChecklistItem.findMany({ where: { isActive: true }, select: { id: true, title: true } });
    const titles = new Map(items.map((i) => [i.id, i.title]));
    const answered = new Set(answers.map((a) => a.itemId));
    if (answers.some((a) => !titles.has(a.itemId)) || items.some((i) => !answered.has(i.id)))
      return { message: "The checklist changed. Refresh and answer every item.", fieldErrors: { answers: ["Answer every checklist item"] } };

    const now = new Date();
    const saved = await db.$transaction(async (tx) => {
      const still = await tx.case.findFirst({ where: { id: caseId, status: stage }, select: { id: true } });
      if (!still) return false;
      await tx.caseQcResponse.updateMany({ where: { caseId, stage, removedAt: null }, data: { removedAt: now } });
      await tx.caseQcResponse.createMany({
        data: answers.map((a) => ({
          caseId,
          stage,
          checklistItemId: a.itemId,
          title: titles.get(a.itemId)!,
          passed: a.passed === "yes",
          remarks: a.remarks === "" ? null : a.remarks,
          answeredById: user.id,
        })),
      });
      return true;
    });
    if (!saved) return { message: STALE };

    const noCount = answers.filter((a) => a.passed === "no").length;
    await logActivity({
      action: "case.qc",
      userId: user.id,
      entity: "Case",
      entityId: caseId,
      detail: `QC checklist saved: ${answers.length - noCount} yes, ${noCount} no`,
    });
    revalidatePath(SERVICE_PATHS.cases, "layout");
    revalidatePath(SERVICE_PATHS.lab, "layout");
    return { ok: true, message: "Quality Check checklist saved." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
}
