"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { initialFormState, type FormState } from "@/lib/form";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { tatUnitOptions } from "@/modules/service/tat-schema";
import type { TatUnit } from "@/generated/prisma/client";

// Must match the header row in tat-config/page.tsx
export const TAT_COL_TEMPLATE =
  "grid-cols-[160px_80px_120px_75px_95px_80px_1fr_110px]";

const ACTIVE_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

type Tone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "primary"
  | "navy"
  | "violet"
  | "indigo";

export type TatConfigEntry = {
  targetValue: number;
  targetUnit: TatUnit;
  warningThreshold: number;
  escalationThreshold: number;
  isActive: boolean;
  remarks: string | null;
};

type TatConfigRowProps = {
  status: string;
  stageName: string;
  stageTone: Tone;
  config: TatConfigEntry | null;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  canEdit: boolean;
};

export function TatConfigRow({
  status,
  stageName,
  stageTone,
  config,
  action,
  canEdit,
}: TatConfigRowProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const { errors, onSubmit, onChange } = useFormFeedback({ state });
  const v = state.values;

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      onChange={onChange}
      noValidate
      className={`grid ${TAT_COL_TEMPLATE} items-start gap-x-3 border-b border-border px-3 py-2.5 last:border-0`}
    >
      <input type="hidden" name="status" value={status} />

      {/* Stage */}
      <div className="flex items-center pt-1.5">
        <Badge tone={stageTone}>{stageName}</Badge>
      </div>

      {/* Target Value */}
      <div>
        <Input
          id={`tv-${status}`}
          name="targetValue"
          type="number"
          min={1}
          max={9999}
          defaultValue={v?.targetValue ?? config?.targetValue?.toString() ?? "4"}
          disabled={!canEdit}
          aria-invalid={errors.targetValue ? true : undefined}
          className="h-8 px-2"
        />
        {errors.targetValue && (
          <p className="mt-0.5 text-[11px] text-danger">{errors.targetValue[0]}</p>
        )}
      </div>

      {/* Unit */}
      <div>
        <Select
          id={`tu-${status}`}
          name="targetUnit"
          defaultValue={v?.targetUnit ?? config?.targetUnit ?? "HOURS"}
          options={tatUnitOptions}
          disabled={!canEdit}
          className="h-8 py-0 text-sm"
          placeholder=""
        />
      </div>

      {/* Warning % */}
      <div>
        <Input
          id={`wt-${status}`}
          name="warningThreshold"
          type="number"
          min={1}
          max={99}
          defaultValue={
            v?.warningThreshold ?? config?.warningThreshold?.toString() ?? "80"
          }
          disabled={!canEdit}
          aria-invalid={errors.warningThreshold ? true : undefined}
          className="h-8 px-2"
        />
        {errors.warningThreshold && (
          <p className="mt-0.5 text-[11px] text-danger">
            {errors.warningThreshold[0]}
          </p>
        )}
      </div>

      {/* Escalation % */}
      <div>
        <Input
          id={`et-${status}`}
          name="escalationThreshold"
          type="number"
          min={1}
          max={999}
          defaultValue={
            v?.escalationThreshold ??
            config?.escalationThreshold?.toString() ??
            "100"
          }
          disabled={!canEdit}
          aria-invalid={errors.escalationThreshold ? true : undefined}
          className="h-8 px-2"
        />
        {errors.escalationThreshold && (
          <p className="mt-0.5 text-[11px] text-danger">
            {errors.escalationThreshold[0]}
          </p>
        )}
      </div>

      {/* Active */}
      <div>
        <Select
          id={`ia-${status}`}
          name="isActive"
          defaultValue={
            v?.isActive ?? (config === null || config.isActive ? "yes" : "no")
          }
          options={ACTIVE_OPTIONS}
          disabled={!canEdit}
          className="h-8 py-0 text-sm"
          placeholder=""
        />
      </div>

      {/* Remarks */}
      <div>
        <Input
          id={`rm-${status}`}
          name="remarks"
          type="text"
          maxLength={500}
          defaultValue={v?.remarks ?? config?.remarks ?? ""}
          disabled={!canEdit}
          aria-invalid={errors.remarks ? true : undefined}
          className="h-8 px-2"
          placeholder="Optional note…"
        />
        {errors.remarks && (
          <p className="mt-0.5 text-[11px] text-danger">{errors.remarks[0]}</p>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center gap-2">
        {canEdit ? (
          <Button type="submit" size="sm" disabled={pending} className="w-full">
            {pending && <Loader2 className="size-3 animate-spin" />}
            Save
          </Button>
        ) : (
          <span className="text-xs text-text-muted">Read-only</span>
        )}
        {state.ok && (
          <span className="text-[11px] font-semibold text-success">Saved</span>
        )}
      </div>
    </form>
  );
}
