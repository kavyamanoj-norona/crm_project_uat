"use client";

import { useState } from "react";
import { Plus, PackagePlus, Trash2 } from "lucide-react";
import type { FormState } from "@/lib/form";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";

const MAX_QTY = 100;
const MAX_LINES = 30;

type Option = { value: string; label: string };
type Props = {
  items: Option[];
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
};

let nextKey = 1;
const blank = () => ({ key: nextKey++, itemId: "", quantity: "1" });

/** Same checks as the server action, run before submitting. */
function validate(fd: FormData) {
  const ids = fd.getAll("itemId").map(String);
  const qtys = fd.getAll("quantity").map(String);
  if (ids.length === 0) return { lines: ["Add at least one item"] };
  if (ids.some((id) => !id)) return { lines: ["Select an item on every row"] };
  if (qtys.some((q) => !Number.isInteger(Number(q)) || Number(q) < 1 || Number(q) > MAX_QTY)) return { lines: [`Enter a whole quantity between 1 and ${MAX_QTY} for every item`] };
  return null;
}

/** "New Request": pick several spare parts / accessories with a quantity each and send them to Head Office in one go. */
export function StockRequestDialog({ items, action }: Props) {
  return (
    <ActionDialog
      trigger={
        <>
          <PackagePlus className="size-4" />
          New Request
        </>
      }
      triggerVariant="primary"
      size="lg"
      title="New stock request"
      description="Pick the spare parts and accessories you need. Head Office orders them and transfers each unit with its own USID."
      action={action}
      validate={validate}
      submitLabel="Send request"
    >
      {(errors) => (
        <>
          <Lines items={items} error={errors.lines?.[0]} />
          <Field label="Notes" htmlFor="sr-notes" error={errors.notes}>
            <Textarea id="sr-notes" name="notes" rows={2} placeholder="Enter notes" />
          </Field>
        </>
      )}
    </ActionDialog>
  );
}

function Lines({ items, error }: { items: Option[]; error?: string }) {
  const [rows, setRows] = useState([blank()]);
  const set = (key: number, patch: Partial<ReturnType<typeof blank>>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  // An item already picked on another row isn't offered again.
  const taken = (key: number) => new Set(rows.filter((r) => r.key !== key && r.itemId).map((r) => r.itemId));

  return (
    <div className="space-y-2">
      <div className="hidden grid-cols-[1fr_7rem_2.25rem] gap-2 text-xs font-semibold text-text-muted sm:grid">
        <span>Item *</span>
        <span>Quantity *</span>
        <span />
      </div>
      {rows.map((r, i) => (
        <div key={r.key} className="grid grid-cols-[1fr_6rem_2.25rem] items-center gap-2 sm:grid-cols-[1fr_7rem_2.25rem]">
          <Select
            name="itemId"
            aria-label={`Item ${i + 1}`}
            value={r.itemId}
            onChange={(e) => set(r.key, { itemId: e.target.value })}
            options={items.filter((o) => !taken(r.key).has(o.value))}
            placeholder="Select item"
          />
          <Input
            name="quantity"
            aria-label={`Quantity ${i + 1}`}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_QTY}
            step={1}
            value={r.quantity}
            onChange={(e) => set(r.key, { quantity: e.target.value })}
            placeholder="Enter quantity"
          />
          <button
            type="button"
            aria-label={`Remove item ${i + 1}`}
            disabled={rows.length === 1}
            onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))}
            className="inline-flex size-9 items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted hover:text-danger disabled:opacity-40"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button type="button" variant="secondary" size="sm" disabled={rows.length >= MAX_LINES} onClick={() => setRows((r) => [...r, blank()])}>
        <Plus className="size-3.5" />
        Add item
      </Button>
    </div>
  );
}
