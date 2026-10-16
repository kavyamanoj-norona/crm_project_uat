"use client";

import { useState } from "react";
import { AlertTriangle, PackageCheck } from "lucide-react";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Badge } from "@/components/ui/badge";
import type { FormState } from "@/lib/form";

export type UsidOption = { id: string; usid: string; mine: boolean; otherCase: string | null };

type Props = {
  itemName: string;
  jobsheetNo: string;
  /** Received, unused units at the case's branch: this case's own USID first. */
  options: UsidOption[];
  /** Branch stock without a USID can be used too. */
  allowStock: boolean;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
};

function Picker({ options, allowStock, jobsheetNo, error }: Pick<Props, "options" | "allowStock" | "jobsheetNo"> & { error?: string }) {
  // The USID allocated to this case is pre-selected; the user still has to confirm.
  const [picked, setPicked] = useState(options.find((o) => o.mine)?.id ?? "");
  const chosen = options.find((o) => o.id === picked);

  return (
    <div className="space-y-3">
      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-[12.5px] font-bold text-brand-navy dark:text-text">
          Select the USID to consume <span className="text-danger">*</span>
        </legend>
        {options.map((o) => (
          <label
            key={o.id}
            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${picked === o.id ? "border-primary bg-primary-soft" : "border-border hover:border-primary"}`}
          >
            <input type="radio" name="unitId" value={o.id} checked={picked === o.id} onChange={() => setPicked(o.id)} className="size-4 accent-primary" />
            <span className="font-semibold tabular-nums">{o.usid}</span>
            {o.mine ? <Badge tone="success">Allocated to this case</Badge> : <Badge tone="warning">Allocated to {o.otherCase ?? "another case"}</Badge>}
          </label>
        ))}
        {allowStock && (
          <label className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${picked === "stock" ? "border-primary bg-primary-soft" : "border-border hover:border-primary"}`}>
            <input type="radio" name="unitId" value="stock" checked={picked === "stock"} onChange={() => setPicked("stock")} className="size-4 accent-primary" />
            <span className="font-medium">Branch stock without a USID</span>
          </label>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
      </fieldset>

      {chosen && !chosen.mine && (
        <p className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            {chosen.usid} was received for {chosen.otherCase ?? "another case"}. Using it here re-allocates it to {jobsheetNo}, and that case will need the part
            again. Do this only for an urgent case.
          </span>
        </p>
      )}
      <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm">
        {picked
          ? <>You are about to consume <strong className="tabular-nums">{picked === "stock" ? "branch stock (no USID)" : chosen?.usid}</strong> on <strong>{jobsheetNo}</strong>. This cannot be undone.</>
          : "Select a USID to continue."}
      </p>
    </div>
  );
}

/** "Consume" on a case line: pick the USID, see it confirmed, then consume. Nothing is consumed without this step. */
export function ConsumeUsidDialog({ itemName, jobsheetNo, options, allowStock, action }: Props) {
  return (
    <ActionDialog
      trigger={
        <>
          <PackageCheck className="size-3.5" /> Consume
        </>
      }
      triggerVariant="success"
      triggerSize="sm"
      title="Consume item"
      description={`${itemName} · ${jobsheetNo}`}
      action={action}
      validate={(fd) => (String(fd.get("unitId") ?? "") ? null : { unitId: ["Select the USID to consume"] })}
      submitLabel="Confirm consume"
    >
      {(errors) => <Picker options={options} allowStock={allowStock} jobsheetNo={jobsheetNo} error={errors.unitId?.[0]} />}
    </ActionDialog>
  );
}
