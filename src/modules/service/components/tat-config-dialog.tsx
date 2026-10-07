"use client";

import { useActionState, useEffect } from "react";
import { Loader2, Pencil } from "lucide-react";
import { initialFormState, type FormState } from "@/lib/form";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { ModalButton } from "@/components/ui/modal-button";
import { tatUnitOptions } from "@/modules/service/tat-schema";

export type TatConfigEntry = {
  targetValue: number;
  targetUnit: string;
  warningThreshold: number;
  escalationThreshold: number;
  isActive: boolean;
  remarks: string | null;
};

type Props = {
  status: string;
  stageName: string;
  config: TatConfigEntry | null;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
};

const ACTIVE_OPTIONS = [
  { value: "yes", label: "Yes — active" },
  { value: "no", label: "No — skip this stage" },
];

function TatConfigForm({
  status,
  config,
  action,
  onDone,
}: Props & { onDone: () => void }) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const { errors, onSubmit, onChange } = useFormFeedback({ state });

  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  const v = state.values;
  const def = (field: keyof TatConfigEntry, fallback: string) =>
    v?.[field] ?? (config ? String(config[field] ?? "") : fallback);

  return (
    <form action={formAction} onSubmit={onSubmit} onChange={onChange} noValidate className="space-y-4">
      <input type="hidden" name="status" value={status} />

      <div className="grid grid-cols-2 gap-4">
        <Field label="Target value" htmlFor="targetValue" required error={errors.targetValue}>
          <Input
            id="targetValue"
            name="targetValue"
            type="number"
            min={1}
            max={9999}
            defaultValue={def("targetValue", "4")}
            aria-invalid={errors.targetValue ? true : undefined}
          />
        </Field>
        <Field label="Unit" htmlFor="targetUnit" required error={errors.targetUnit}>
          <Select
            id="targetUnit"
            name="targetUnit"
            defaultValue={def("targetUnit", "HOURS")}
            options={tatUnitOptions}
            placeholder=""
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Warning threshold"
          htmlFor="warningThreshold"
          required
          error={errors.warningThreshold}
          hint="% of TAT elapsed before warning (e.g. 80)"
        >
          <Input
            id="warningThreshold"
            name="warningThreshold"
            type="number"
            min={1}
            max={99}
            defaultValue={def("warningThreshold", "80")}
            aria-invalid={errors.warningThreshold ? true : undefined}
          />
        </Field>
        <Field
          label="Escalation threshold"
          htmlFor="escalationThreshold"
          required
          error={errors.escalationThreshold}
          hint="% at which the stage becomes overdue (e.g. 100)"
        >
          <Input
            id="escalationThreshold"
            name="escalationThreshold"
            type="number"
            min={1}
            max={999}
            defaultValue={def("escalationThreshold", "100")}
            aria-invalid={errors.escalationThreshold ? true : undefined}
          />
        </Field>
      </div>

      <Field label="Active?" htmlFor="isActive" error={errors.isActive}>
        <Select
          id="isActive"
          name="isActive"
          defaultValue={v?.isActive ?? (config === null || config.isActive ? "yes" : "no")}
          options={ACTIVE_OPTIONS}
          placeholder=""
        />
      </Field>

      <Field
        label="Remarks"
        htmlFor="remarks"
        error={errors.remarks}
        hint="Optional note visible to admins"
      >
        <Input
          id="remarks"
          name="remarks"
          maxLength={500}
          defaultValue={def("remarks", "")}
          placeholder="e.g. Extended for warranty cases"
        />
      </Field>

      {state.message && !state.ok && (
        <p className="text-sm text-danger">{state.message}</p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone} type="button">
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Save
        </Button>
      </div>
    </form>
  );
}

export function TatConfigDialog({ status, stageName, config, action }: Props) {
  return (
    <ModalButton
      trigger={
        <>
          <Pencil className="size-3.5" /> Edit
        </>
      }
      variant="secondary"
      buttonSize="sm"
      title={`TAT — ${stageName}`}
      description="Set the expected turnaround time and alert thresholds for this stage."
    >
      {(close) => (
        <TatConfigForm
          status={status}
          stageName={stageName}
          config={config}
          action={action}
          onDone={close}
        />
      )}
    </ModalButton>
  );
}
