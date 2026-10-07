"use client";

import { Star } from "lucide-react";
import { validateForm, type FormState } from "@/lib/form";
import { enumOptions } from "@/lib/enum";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Field, Select, Textarea } from "@/components/ui/field";
import { CUSTOMER_BEHAVIOURS, CUSTOMER_BEHAVIOUR_LABELS, feedbackSchema } from "../case-schema";

const behaviourOptions = enumOptions(CUSTOMER_BEHAVIOURS, CUSTOMER_BEHAVIOUR_LABELS);

type FeedbackDialogProps = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: { rating: number; comment: string | null; customerBehaviour: string } | null;
};

/** Star-rating + behaviour dialog shown on closed/cancelled cases. */
export function FeedbackDialog({ action, initial }: FeedbackDialogProps) {
  return (
    <ActionDialog
      trigger={
        <>
          <Star className="size-4" />
          {initial ? "Edit feedback" : "Add feedback"}
        </>
      }
      triggerVariant="secondary"
      title="Case feedback"
      description="Record the service outcome and customer behaviour for this case."
      action={action}
      validate={(fd) => validateForm(feedbackSchema, fd)}
      submitLabel="Save feedback"
    >
      {(errors) => (
        <>
          <Field label="Rating" htmlFor="rating" required error={errors.rating} hint="1 = poor · 5 = excellent">
            <Select
              id="rating"
              name="rating"
              defaultValue={initial?.rating ? String(initial.rating) : "5"}
              options={[
                { value: "1", label: "1 — Poor" },
                { value: "2", label: "2 — Below average" },
                { value: "3", label: "3 — Average" },
                { value: "4", label: "4 — Good" },
                { value: "5", label: "5 — Excellent" },
              ]}
              aria-invalid={errors.rating ? true : undefined}
            />
          </Field>
          <Field label="Customer behaviour" htmlFor="customerBehaviour" required error={errors.customerBehaviour}>
            <Select
              id="customerBehaviour"
              name="customerBehaviour"
              defaultValue={initial?.customerBehaviour ?? "NORMAL"}
              options={behaviourOptions}
              aria-invalid={errors.customerBehaviour ? true : undefined}
            />
          </Field>
          <Field label="Comment" htmlFor="comment" error={errors.comment} hint="Optional — shown on the case record">
            <Textarea
              id="comment"
              name="comment"
              rows={3}
              defaultValue={initial?.comment ?? ""}
              aria-invalid={errors.comment ? true : undefined}
              placeholder="Enter feedback"
            />
          </Field>
        </>
      )}
    </ActionDialog>
  );
}
