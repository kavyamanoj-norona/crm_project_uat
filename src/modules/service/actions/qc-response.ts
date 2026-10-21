"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { branchWhere, getBranchScope } from "@/server/branch-scope";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { isEngineer } from "@/server/rbac/roles";
import { getCurrentUser } from "@/server/auth/session";
import { engineerCaseScope } from "../engineer-access";
import { logActivity } from "@/server/security/activity";
import { pick, toFieldErrors, type FormState } from "@/lib/form";
import { z } from "zod";
import { QC_STAGES, qcAnswerSchema, qcAnswersSchema, type QcStage } from "../qc-answer-schema";
import { qcBlockReason } from "../qc-response-queries";
import { SERVICE_PATHS } from "../paths";

const STALE = "Someone else changed this case just now. Refresh to see its current stage.";

/**
 * Saves the QC checklist answers for the case's current QC stage — branch
 * Quality Check or the lab's Quality Check. Every active checklist item must be
 * answered; "No" needs remarks. Append-only: old answers are retired, not edited.
 */
export async function saveQcAnswers(caseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  // "progress" (lab modal): keep the answers given so far; the rest can follow later. Default: every item must be answered.
  const progress = formData.get("intent") === "progress";
  const note = String(formData.get("note") ?? "").trim();
  if (note.length > 300) return { message: "Please fix the highlighted fields.", fieldErrors: { note: ["Keep the notes under 300 characters"] } };

  let answers: { itemId: string; passed: "yes" | "no"; remarks: string }[];
  if (progress) {
    let rows: unknown;
    try {
      rows = JSON.parse(String(formData.get("answers") ?? "[]"));
    } catch {
      return { message: "Answers could not be read. Reload the page and try again." };
    }
    const given = (Array.isArray(rows) ? rows : []).filter((r) => r && (r.passed === "yes" || r.passed === "no"));
    const parsedRows = z.array(qcAnswerSchema).safeParse(given);
    if (!parsedRows.success) return { message: parsedRows.error.issues[0]!.message, fieldErrors: { answers: [parsedRows.error.issues[0]!.message] } };
    if (parsedRows.data.length === 0) return { message: "Answer at least one item to save progress.", fieldErrors: { answers: ["Answer at least one item to save progress"] } };
    answers = parsedRows.data as typeof answers;
  } else {
    const parsed = qcAnswersSchema.safeParse(pick(formData, ["answers"]));
    if (!parsed.success) return toFieldErrors(parsed.error, formData);
    answers = parsed.data.answers as typeof answers;
  }

  try {
    const probe = await db.case.findFirst({ where: { id: caseId, status: { in: [...QC_STAGES] } }, select: { status: true } });
    if (!probe) return { message: "This case isn't in a Quality Check stage." };
    const stage = probe.status as QcStage;

    // Engineers do the branch QC from their workspace, on their own assigned cases only; everyone else through Cases / the lab.
    const me = await getCurrentUser();
    const asEngineer = me !== null && isEngineer(me);
    if (asEngineer && stage !== "QUALITY_CHECK") throw new ForbiddenError();
    const user = await requireActionPermission(asEngineer ? SERVICE_PATHS.engineer : stage === "QUALITY_CHECK" ? SERVICE_PATHS.cases : SERVICE_PATHS.lab, "canEdit");
    // Branch QC is branch-scoped (an engineer's also to their assigned cases); the lab works across branches.
    const scope = asEngineer ? await engineerCaseScope(user) : stage === "QUALITY_CHECK" ? branchWhere(await getBranchScope(user)) : {};
    const c = await db.case.findFirst({ where: { id: caseId, status: stage, ...scope }, select: { id: true } });
    if (!c) return { message: "Case not found." };

    const items = await db.qcChecklistItem.findMany({ where: { isActive: true }, select: { id: true, title: true } });
    const titles = new Map(items.map((i) => [i.id, i.title]));
    const answered = new Set(answers.map((a) => a.itemId));
    if (answers.some((a) => !titles.has(a.itemId)) || (!progress && items.some((i) => !answered.has(i.id))))
      return { message: "The checklist changed. Refresh and answer every item.", fieldErrors: { answers: ["Answer every checklist item"] } };

    // Every QC (branch or lab) gets a "Quality Check completed" timeline entry the first time the checklist becomes complete.
    const labStage = stage === "CHIP_LAB_QUALITY_CHECK";
    const wasComplete = (await qcBlockReason(caseId, stage)) === null;

    const now = new Date();
    const saved = await db.$transaction(async (tx) => {
      const still = await tx.case.findFirst({ where: { id: caseId, status: stage }, select: { id: true } });
      if (!still) return false;
      await tx.caseQcResponse.updateMany({
        where: { caseId, stage, removedAt: null, ...(progress ? { checklistItemId: { in: [...answered] } } : {}) },
        data: { removedAt: now },
      });
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
      if (!progress && !wasComplete) {
        await tx.caseStatusHistory.create({
          data: { caseId, fromStatus: stage, toStatus: stage, note: note || null, changedById: user.id },
        });
      }
      return true;
    });
    if (!saved) return { message: STALE };

    const noCount = answers.filter((a) => a.passed === "no").length;
    await logActivity({
      action: "case.qc",
      userId: user.id,
      entity: "Case",
      entityId: caseId,
      detail: `QC checklist ${progress ? "progress saved" : "saved"}: ${answers.length - noCount} yes, ${noCount} no${note ? ` — ${note}` : ""}`,
    });
    revalidatePath(SERVICE_PATHS.cases, "layout");
    revalidatePath(SERVICE_PATHS.lab, "layout");
    return { ok: true, message: progress ? "Progress saved." : !wasComplete ? "Quality Check completed." : "Quality Check checklist saved." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
}
