"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, UserCog } from "lucide-react";
import { initialFormState, type FormState } from "@/lib/form";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { ModalButton } from "@/components/ui/modal-button";

type StaffOption = { value: string; label: string };

export type AssignEngineerDialogProps = {
  jobsheetNo: string;
  currentEngineerId: string;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  /** Pre-loaded staff options (detail page). Omit to use loadStaff instead. */
  staff?: StaffOption[];
  /** Called once on dialog open when staff is not pre-loaded (list page). */
  loadStaff?: () => Promise<StaffOption[]>;
  trigger?: React.ReactNode;
  triggerVariant?: "primary" | "secondary" | "ghost";
  /** Extra className on the trigger button. */
  triggerClassName?: string;
};

/** Dialog to assign or reassign the engineer on any open service case. */
export function AssignEngineerDialog({
  trigger,
  triggerVariant = "secondary",
  triggerClassName,
  jobsheetNo,
  ...rest
}: AssignEngineerDialogProps) {
  return (
    <ModalButton
      trigger={trigger ?? <><UserCog className="size-4" /> Assign engineer</>}
      variant={triggerVariant}
      className={triggerClassName}
      title={`Assign engineer — ${jobsheetNo}`}
      description="Pick an active staff member working in this branch."
    >
      {(close) => <AssignEngineerForm {...rest} onDone={close} />}
    </ModalButton>
  );
}

function AssignEngineerForm({
  action,
  staff: preloadedStaff,
  loadStaff,
  currentEngineerId,
  onDone,
}: Omit<AssignEngineerDialogProps, "trigger" | "triggerVariant" | "triggerClassName" | "jobsheetNo"> & {
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const [staff, setStaff] = useState<StaffOption[]>(preloadedStaff ?? []);
  const [staffLoading, setStaffLoading] = useState(!preloadedStaff && !!loadStaff);
  const { errors, onSubmit } = useFormFeedback({ state });

  useEffect(() => {
    if (staffLoading && loadStaff) {
      loadStaff().then((s) => {
        setStaff(s);
        setStaffLoading(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="space-y-4">
      <Field label="Engineer" htmlFor="engineerId" required error={errors.engineerId}>
        {staffLoading ? (
          <div className="flex h-10 items-center gap-2 text-sm text-text-muted">
            <Loader2 className="size-4 animate-spin" /> Loading staff…
          </div>
        ) : (
          <Select
            id="engineerId"
            name="engineerId"
            defaultValue={currentEngineerId}
            options={staff}
            placeholder={staff.length ? "Select engineer…" : "No active staff in this branch"}
          />
        )}
      </Field>
      {state.message && !state.ok && <p className="text-sm text-danger">{state.message}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onDone} type="button">
          Close
        </Button>
        <Button type="submit" disabled={pending || staffLoading}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Save
        </Button>
      </div>
    </form>
  );
}
