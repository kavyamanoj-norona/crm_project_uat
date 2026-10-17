"use client";

import { useState } from "react";
import { PackageCheck } from "lucide-react";
import type { FormState } from "@/lib/form";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Field, Select, Textarea } from "@/components/ui/field";
import type { AvailableUnit } from "./transfer-dialog";

type Props = {
  requestedItemName: string;
  /** Units still to transfer on the request. */
  remaining: number;
  /** AVAILABLE units of the requested item. */
  units: AvailableUnit[];
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
};

/** One USID picker per requested unit. A USID chosen in one row is not offered in the others. */
function UnitSlots({ remaining, units, error }: { remaining: number; units: AvailableUnit[]; error?: string }) {
  const [picked, setPicked] = useState<string[]>(() => Array.from({ length: remaining }, () => ""));
  const set = (i: number, id: string) => setPicked((p) => p.map((v, j) => (j === i ? id : v)));

  return (
    <div className="space-y-2">
      {picked.map((value, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-xs font-semibold text-text-muted">Unit {i + 1}</span>
          <Select
            aria-label={`USID for unit ${i + 1}`}
            name="unitId"
            value={value}
            onChange={(e) => set(i, e.target.value)}
            placeholder="Select USID"
            options={units
              .filter((u) => u.id === value || !picked.includes(u.id))
              .map((u) => ({ value: u.id, label: `${u.usid}${u.billNo ? ` · ${u.billNo}` : ""} · ${u.location}` }))}
          />
        </div>
      ))}
      <p className="text-xs text-text-muted">
        {picked.filter(Boolean).length} of {remaining} selected · {units.length} available
      </p>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

/** "Transfer" for a request of several units: give every unit its own USID and send them all together. */
export function TransferManyDialog({ requestedItemName, remaining, units, action }: Props) {
  return (
    <ActionDialog
      trigger={
        <>
          <PackageCheck className="size-3.5" />
          Transfer {remaining} units
        </>
      }
      triggerVariant="success"
      triggerSize="sm"
      size="lg"
      title={`Transfer ${remaining} × ${requestedItemName}`}
      description="Pick a different USID for each unit. All units are transferred together; each USID can be transferred only once."
      action={action}
      validate={(fd) => {
        const ids = fd.getAll("unitId").map(String);
        if (ids.some((v) => !v)) return { unitId: ["Select a USID for every unit"] };
        return null;
      }}
      submitLabel={`Transfer ${remaining} units`}
    >
      {(errors) => (
        <>
          <Field label="Stock units (USID)" htmlFor="unit-select" required>
            <UnitSlots remaining={remaining} units={units} error={errors.unitId?.[0]} />
          </Field>
          <Field label="Note" htmlFor="note" error={errors.note}>
            <Textarea id="note" name="note" rows={2} placeholder="Enter note" />
          </Field>
        </>
      )}
    </ActionDialog>
  );
}
