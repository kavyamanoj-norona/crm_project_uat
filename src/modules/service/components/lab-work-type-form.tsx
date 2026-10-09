"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { initialFormState, type FormState } from "@/lib/form";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { LAB_WORK_TYPE_LABELS, type LabWorkType } from "../case-schema";

type Option = { value: string; label: string };

type LabWorkTypeFormProps = {
  caseId: string;
  initial: { workType: LabWorkType | null; engineerId: string | null; vendorId: string | null };
  engineers: Option[];
  vendors: Option[];
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
};

export function LabWorkTypeForm({ initial, engineers, vendors, action }: LabWorkTypeFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const [workType, setWorkType] = useState<LabWorkType | "">(initial.workType ?? "");
  const { errors, onSubmit, onChange } = useFormFeedback({ state });

  useEffect(() => {
    if (initial.workType) setWorkType(initial.workType);
  }, [initial.workType]);

  return (
    <form action={formAction} onSubmit={onSubmit} onChange={onChange} noValidate className="space-y-4">
      {/* Work type radio buttons */}
      <div>
        <p className="mb-2 text-sm font-medium">
          Work type <span className="text-danger">*</span>
        </p>
        <div className="flex gap-4">
          {(["INHOUSE", "OUTSOURCE"] as const).map((type) => (
            <label key={type} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="workType"
                value={type}
                checked={workType === type}
                onChange={() => setWorkType(type)}
                className="accent-primary"
              />
              <span className="text-sm">{LAB_WORK_TYPE_LABELS[type]}</span>
            </label>
          ))}
        </div>
        {errors.workType && <p className="mt-1 text-xs text-danger">{errors.workType[0]}</p>}
      </div>

      {/* Engineer select (inhouse) */}
      {workType === "INHOUSE" && (
        <div>
          <label className="mb-1 block text-sm font-medium">
            Assigned engineer <span className="text-danger">*</span>
          </label>
          <Select
            name="engineerId"
            defaultValue={initial.engineerId ?? ""}
            options={engineers}
            placeholder="Select engineer"
          />
          {errors.engineerId && <p className="mt-1 text-xs text-danger">{errors.engineerId[0]}</p>}
        </div>
      )}

      {/* Vendor select (outsource) */}
      {workType === "OUTSOURCE" && (
        <div>
          <label className="mb-1 block text-sm font-medium">
            Vendor <span className="text-danger">*</span>
          </label>
          <Select
            name="vendorId"
            defaultValue={initial.vendorId ?? ""}
            options={vendors}
            placeholder="Select vendor"
          />
          {errors.vendorId && <p className="mt-1 text-xs text-danger">{errors.vendorId[0]}</p>}
        </div>
      )}

      {state.message && !state.ok && (
        <p className="rounded-md bg-danger/5 px-3 py-2 text-sm text-danger">{state.message}</p>
      )}
      {state.ok && (
        <p className="rounded-md bg-success/5 px-3 py-2 text-sm text-success">{state.message}</p>
      )}

      {workType && (
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          Save work type
        </Button>
      )}
    </form>
  );
}
