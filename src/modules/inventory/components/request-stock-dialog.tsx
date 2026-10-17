"use client";

import { PackagePlus } from "lucide-react";
import { validateForm, type FormState } from "@/lib/form";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { MAX_STOCK_REQUEST_QTY, stockRequestSchema } from "../schemas";

type Props = {
  itemName: string;
  itemCode: string;
  /** Server action already bound to the item. */
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
};

/** "Request" on an item: a branch asks Head Office for one or more units; no case is needed. */
export function RequestStockDialog({ itemName, itemCode, action }: Props) {
  return (
    <ActionDialog
      trigger={
        <>
          <PackagePlus className="size-3.5" />
          Request
        </>
      }
      triggerVariant="secondary"
      triggerSize="sm"
      title={`Request ${itemName}`}
      description={`${itemCode} · Head Office will order it and transfer each unit with its own USID.`}
      action={action}
      validate={(fd) => validateForm(stockRequestSchema, fd)}
      submitLabel="Send request"
    >
      {(errors) => (
        <>
          <Field label="Quantity" htmlFor={`qty-${itemCode}`} required error={errors.quantity} hint={`Units needed, up to ${MAX_STOCK_REQUEST_QTY}.`}>
            <Input id={`qty-${itemCode}`} name="quantity" type="number" inputMode="numeric" min={1} max={MAX_STOCK_REQUEST_QTY} step={1} defaultValue={1} placeholder="Enter quantity" />
          </Field>
          <Field label="Notes" htmlFor={`notes-${itemCode}`} error={errors.notes}>
            <Textarea id={`notes-${itemCode}`} name="notes" rows={3} placeholder="Enter notes" />
          </Field>
        </>
      )}
    </ActionDialog>
  );
}
