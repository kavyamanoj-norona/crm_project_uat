"use client";

import { useState } from "react";
import { ChevronDown, PackageCheck } from "lucide-react";
import { validateForm, type FormState } from "@/lib/form";
import { ActionDialog } from "@/components/forms/action-dialog";
import { DataTable } from "@/components/data/data-table";
import { PhotoInput } from "@/components/forms/photo-input";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Textarea } from "@/components/ui/field";
import { allocateSchema } from "../schemas";

/** One available stock unit: it has its own USID even when other units share the item name. */
export type AvailableUnit = {
  id: string;
  usid: string;
  itemId: string;
  itemName: string;
  billNo: string | null;
  /** Branch code where the unit is held. */
  location: string;
};

type ConsumeDialogProps = {
  requestedItemId: string;
  requestedItemName: string;
  /** Units the request still needs. */
  outstanding: number;
  units: AvailableUnit[];
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
};

/**
 * A dropdown whose open list is a table (USID · Item · Bill · Location). The list opens inline,
 * inside the modal, so it never spills outside it the way a native select list does.
 */
function UnitPicker({ units, requestedItemId, error }: { units: AvailableUnit[]; requestedItemId: string; error?: string }) {
  const [selected, setSelected] = useState("");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const needle = q.trim().toLowerCase();
  const rows = units
    .filter((u) => !needle || `${u.usid} ${u.itemName} ${u.billNo ?? ""} ${u.location}`.toLowerCase().includes(needle))
    // Units of the requested item first; any other available unit can still be picked.
    .sort((a, b) => Number(b.itemId === requestedItemId) - Number(a.itemId === requestedItemId));
  const chosen = units.find((u) => u.id === selected);

  const pick = (id: string) => {
    setSelected(id);
    setOpen(false);
  };
  // Every cell is a button, so clicking anywhere on a row picks it.
  const cell = (u: AvailableUnit, content: React.ReactNode) => (
    <button type="button" onClick={() => pick(u.id)} className="block w-full cursor-pointer text-left">
      {content}
    </button>
  );

  return (
    <div className="space-y-2">
      <input type="hidden" name="unitId" value={selected} />
      <button
        type="button"
        id="unit-select"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-surface px-3 text-left text-sm outline-none transition-colors focus:border-primary ${
          error ? "border-danger" : open ? "border-primary" : "border-border"
        }`}
      >
        <span className={`min-w-0 truncate ${chosen ? "text-text" : "text-text-muted"}`}>
          {chosen ? `${chosen.usid} — ${chosen.itemName}` : "Select USID"}
        </span>
        <ChevronDown className={`size-4 shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-2 rounded-lg border border-border bg-surface p-2 shadow-md">
          <Input aria-label="Search units" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by USID, item or bill" autoFocus />
          <div className="max-h-60 overflow-y-auto rounded-lg border border-border">
            <DataTable
              bordered={false}
              rows={rows}
              rowKey={(u) => u.id}
              empty={units.length === 0 ? "No stock units are available. Record a supplier bill under Billing to add stock." : "No units match your search."}
              highlight={(u) => u.id === selected}
              columns={[
                { header: "USID", cell: (u) => cell(u, <span className="font-medium tabular-nums">{u.usid}</span>) },
                {
                  header: "Item",
                  cell: (u) =>
                    cell(
                      u,
                      <span className="flex items-center gap-2">
                        {u.itemName}
                        {u.itemId === requestedItemId && <Badge tone="success">Match</Badge>}
                      </span>,
                    ),
                },
                { header: "Bill", cell: (u) => cell(u, u.billNo ?? "—") },
                { header: "Location", cell: (u) => cell(u, u.location) },
              ]}
            />
          </div>
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

/** "Consume" on a purchase request: pick one stock unit by USID; it is allocated to the request's case. */
export function ConsumeDialog({ requestedItemId, requestedItemName, outstanding, units, action }: ConsumeDialogProps) {
  return (
    <ActionDialog
      trigger={
        <>
          <PackageCheck className="size-3.5" />
          Consume
        </>
      }
      triggerVariant="success"
      triggerSize="sm"
      size="xl"
      title={`Consume for ${requestedItemName}`}
      description={`${outstanding} still needed. Select the unit by its USID. Each USID can be allocated only once.`}
      action={action}
      validate={(fd) => validateForm(allocateSchema, fd)}
      submitLabel="Allocate to case"
    >
      {(errors) => (
        <>
          <Field label="Stock unit (USID)" htmlFor="unit-select" required>
            <UnitPicker units={units} requestedItemId={requestedItemId} error={errors.unitId?.[0]} />
          </Field>
          <Field label="Note" htmlFor="note" error={errors.note}>
            <Textarea id="note" name="note" rows={2} placeholder="Enter note" />
          </Field>
          <Field label="Photos" htmlFor="photos" error={errors.photos} hint="Optional. The branch can view these with the unit.">
            <PhotoInput name="photos" allowUpload invalid={Boolean(errors.photos)} />
          </Field>
        </>
      )}
    </ActionDialog>
  );
}
