"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { pick, toFieldErrors, type FormState } from "@/lib/form";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { engineerCaseScope } from "../engineer-access";
import { DIAGNOSIS_FIELDS, diagnosisSchema } from "../engineer-schema";
import { SERVICE_PATHS } from "../paths";

/**
 * The engineer saves (or updates) the diagnosis of a case assigned to them: what was examined, what was found and the
 * repairs recommended. Allowed while the case is in Diagnosis; the save lands in the activity log and so the case history.
 */
export async function saveDiagnosis(caseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = diagnosisSchema.safeParse(pick(formData, DIAGNOSIS_FIELDS));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  try {
    const user = await requireActionPermission(SERVICE_PATHS.engineer, "canEdit");
    const c = await db.case.findFirst({
      where: { id: caseId, isDelete: 0, ...(await engineerCaseScope(user)) },
      select: { status: true, jobsheetNo: true, diagnosis: { select: { id: true } } },
    });
    if (!c) return { message: "Case not found." };
    if (c.status !== "DIAGNOSIS") return { message: "A diagnosis can only be saved while the case is in Diagnosis." };

    const data = { ...parsed.data, savedById: user.id };
    await db.caseDiagnosis.upsert({ where: { caseId }, update: data, create: { caseId, ...data } });
    await db.case.update({ where: { id: caseId }, data: { updatedById: user.id } });

    await logActivity({
      action: "case.diagnosis",
      userId: user.id,
      entity: "Case",
      entityId: caseId,
      detail: `${c.diagnosis ? "Updated" : "Saved"} — recommended repairs: ${parsed.data.recommendedRepairs.slice(0, 160)}`,
    });
    revalidatePath(SERVICE_PATHS.engineer, "layout");
    revalidatePath(SERVICE_PATHS.cases, "layout");
    return { ok: true, message: "Diagnosis saved." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
}
