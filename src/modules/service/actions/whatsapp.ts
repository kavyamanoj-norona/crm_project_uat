"use server";

import { db } from "@/server/db";
import { branchWhere, getBranchScope } from "@/server/branch-scope";
import { requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { sendMetaWhatsAppTemplate } from "@/server/notify/customer";
import { WA_TEMPLATE_MAP, type CaseMsgData } from "@/server/notify/whatsapp-templates";
import { type FormState } from "@/lib/form";
import { CASE_STATUS_LABELS } from "../case-schema";
import { SERVICE_PATHS } from "../paths";

export async function sendWhatsAppTemplate(caseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  let user;
  try {
    user = await requireActionPermission(SERVICE_PATHS.cases, "canEdit");
  } catch {
    return { ok: false, message: "You don't have permission to send WhatsApp messages." };
  }

  const scope = branchWhere(await getBranchScope(user));
  const c = await db.case.findFirst({
    where: { id: caseId, ...scope },
    select: {
      id: true,
      jobsheetNo: true,
      brand: true,
      model: true,
      estimatedCostPaise: true,
      status: true,
      customerId: true,
      customer: { select: { phone: true, name: true } },
      branch: { select: { name: true } },
    },
  });
  if (!c) return { ok: false, message: "Case not found." };
  if (!c.customer.phone) return { ok: false, message: "Customer has no phone number." };

  const templateName = String(formData.get("templateName") ?? "").trim();
  if (!templateName) {
    return { ok: false, message: "Please select a template.", fieldErrors: { templateName: ["Please select a template."] } };
  }
  const template = WA_TEMPLATE_MAP.get(templateName);
  if (!template) {
    return { ok: false, message: "Unknown template selected." };
  }

  const device = [c.brand, c.model].filter(Boolean).join(" ");
  const msgData: CaseMsgData = {
    customerName: c.customer.name,
    jobsheetNo: c.jobsheetNo,
    device,
    estimatePaise: c.estimatedCostPaise,
    stageLabel: CASE_STATUS_LABELS[c.status],
    branchName: c.branch.name,
  };
  const components = template.buildComponents(msgData);

  const digits = c.customer.phone.replace(/\D/g, "");
  const e164Phone = `+${digits.startsWith("91") ? digits : `91${digits}`}`;

  const payload = {
    messaging_product: "whatsapp",
    to: e164Phone,
    type: "template",
    template: {
      name: templateName,
      language: { code: template.language },
      components,
    },
  };

  // Persist the message attempt immediately (QUEUED) so we always have a record.
  const record = await db.whatsAppMessage.create({
    data: {
      caseId: c.id,
      customerId: c.customerId,
      templateName,
      phone: e164Phone,
      payload,
      status: "QUEUED",
      createdById: user.id,
    },
  });

  try {
    const { messageId } = await sendMetaWhatsAppTemplate({
      phone: c.customer.phone,
      templateName,
      language: template.language,
      components,
    });

    await db.whatsAppMessage.update({
      where: { id: record.id },
      data: { status: "SENT", metaMessageId: messageId, sentAt: new Date() },
    });

    await logActivity({
      action: "whatsapp.send",
      userId: user.id,
      entity: "Case",
      entityId: c.id,
      detail: `Template "${templateName}" sent to ${e164Phone} (${c.jobsheetNo})`,
    });

    return { ok: true, message: `WhatsApp message sent to ${c.customer.name}.` };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    await db.whatsAppMessage.update({
      where: { id: record.id },
      data: { status: "FAILED", error },
    });
    return { ok: false, message: `Failed to send: ${error}` };
  }
}
