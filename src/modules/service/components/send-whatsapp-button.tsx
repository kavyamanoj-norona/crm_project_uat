"use client";

import { MessageCircle } from "lucide-react";
import { Field, Select } from "@/components/ui/field";
import { ActionDialog } from "@/components/forms/action-dialog";
import type { FormState } from "@/lib/form";
import { WA_TEMPLATES } from "@/server/notify/whatsapp-templates";

type Props = {
  customerName: string;
  customerPhone: string;
  /** sendWhatsAppTemplate already bound to caseId */
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
};

/** Button that opens a modal to pick a WhatsApp template and send it. */
export function SendWhatsAppButton({ customerName, customerPhone, action }: Props) {
  return (
    <ActionDialog
      trigger={<><MessageCircle className="size-4" /> Send WhatsApp</>}
      triggerVariant="secondary"
      title="Send WhatsApp Message"
      description={`Sending to ${customerName} (${customerPhone})`}
      action={action}
      submitLabel="Send message"
    >
      {(errors) => (
        <Field label="Template" htmlFor="templateName" error={errors.templateName}>
          <Select
            id="templateName"
            name="templateName"
            required
            placeholder="Select a template…"
            options={WA_TEMPLATES.map((t) => ({ value: t.name, label: t.label }))}
            aria-invalid={errors.templateName ? true : undefined}
          />
        </Field>
      )}
    </ActionDialog>
  );
}
