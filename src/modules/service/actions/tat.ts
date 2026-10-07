"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { pick, toFieldErrors, type FormState } from "@/lib/form";
import { handleActionError } from "@/server/prisma-errors";
import { tatConfigSchema, TAT_CONFIG_FIELDS } from "../tat-schema";
import { SERVICE_PATHS } from "../paths";
import type { CaseStatus } from "@/generated/prisma/client";

export async function saveTatConfig(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = tatConfigSchema.safeParse(pick(formData, TAT_CONFIG_FIELDS));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  const data = parsed.data;
  try {
    const user = await requireActionPermission(SERVICE_PATHS.tatConfig, "canEdit");
    await db.tatConfig.upsert({
      where: { status: data.status as CaseStatus },
      create: { ...data, status: data.status as CaseStatus, createdById: user.id, updatedById: user.id },
      update: { ...data, status: data.status as CaseStatus, updatedById: user.id },
    });
    await logActivity({
      action: "tat.config",
      userId: user.id,
      entity: "TatConfig",
      entityId: data.status,
      detail: `TAT for ${data.status}: ${data.targetValue} ${data.targetUnit}`,
    });
    revalidatePath(SERVICE_PATHS.tatConfig);
    return { ok: true, message: `TAT for ${data.status} saved.` };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    return handleActionError(e, {}, formData);
  }
}
