"use client";

import { useState } from "react";
import { Pencil, Plus, Target } from "lucide-react";
import { validateForm, type FormState } from "@/lib/form";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  INCENTIVE_RULE_FIELDS,
  SERVICE_PRICE_FIELDS,
  TARGET_FIELDS,
  incentiveBasisOptions,
  incentiveRuleSchema,
  servicePriceSchema,
  targetSchema,
} from "../schemas";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;
type Option = { value: string; label: string };

const PRODUCT_OPTIONS: Option[] = [
  { value: "LAPTOP", label: "Laptop" },
  { value: "PRINTER", label: "Printer" },
  { value: "DESKTOP", label: "Desktop" },
  { value: "OTHER", label: "Other" },
];

// ─── Service price estimate ──────────────────────────────────────────────────

type PriceInitial = { name: string; productType: string; min: string; max: string; notes: string };

export function ServicePriceDialog({ action, initial }: { action: Action; initial?: PriceInitial }) {
  return (
    <ActionDialog
      trigger={
        initial ? (
          <>
            <Pencil className="size-3.5" />
            Edit
          </>
        ) : (
          <>
            <Plus className="size-4" />
            Add estimate
          </>
        )
      }
      triggerVariant={initial ? "secondary" : "primary"}
      triggerSize={initial ? "sm" : "md"}
      title={initial ? `Edit ${initial.name}` : "Add service price estimate"}
      description="The approximate range telecallers quote on a call for this issue or repair."
      action={action}
      validate={(fd) => validateForm(servicePriceSchema, fd, SERVICE_PRICE_FIELDS)}
      submitLabel="Save estimate"
    >
      {(errors) => (
        <>
          <Field label="Issue or repair type" htmlFor="sp-name" required error={errors.name}>
            <Input id="sp-name" name="name" defaultValue={initial?.name} placeholder="Enter issue or repair type" aria-invalid={errors.name ? true : undefined} />
          </Field>
          <Field label="Product" htmlFor="sp-product" error={errors.productType}>
            <Select id="sp-product" name="productType" defaultValue={initial?.productType ?? ""} options={PRODUCT_OPTIONS} placeholder="Select product" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Lowest price ₹" htmlFor="sp-min" required error={errors.min}>
              <Input id="sp-min" name="min" inputMode="decimal" defaultValue={initial?.min} placeholder="Enter lowest price" aria-invalid={errors.min ? true : undefined} />
            </Field>
            <Field label="Highest price ₹" htmlFor="sp-max" required error={errors.max}>
              <Input id="sp-max" name="max" inputMode="decimal" defaultValue={initial?.max} placeholder="Enter highest price" aria-invalid={errors.max ? true : undefined} />
            </Field>
          </div>
          <Field label="Notes" htmlFor="sp-notes" error={errors.notes} hint="Shown to the telecaller, e.g. what the range includes.">
            <Textarea id="sp-notes" name="notes" rows={2} defaultValue={initial?.notes} placeholder="Enter notes" />
          </Field>
        </>
      )}
    </ActionDialog>
  );
}

// ─── Incentive rule ──────────────────────────────────────────────────────────

export function IncentiveRuleDialog({ action, today }: { action: Action; today: string }) {
  return (
    <ActionDialog
      trigger={
        <>
          <Plus className="size-4" />
          Add rule
        </>
      }
      triggerVariant="primary"
      title="Add incentive rule"
      description="Applies to conversions and billings from the start date. To change a rule, switch it off and add a new one."
      action={action}
      validate={(fd) => validateForm(incentiveRuleSchema, fd, INCENTIVE_RULE_FIELDS)}
      submitLabel="Add rule"
    >
      {(errors) => <RuleFields errors={errors} today={today} />}
    </ActionDialog>
  );
}

function RuleFields({ errors, today }: { errors: Record<string, string[] | undefined>; today: string }) {
  const [basis, setBasis] = useState("");
  const margin = basis === "MARGIN_PERCENT";
  return (
    <>
      <Field label="Rule name" htmlFor="ir-name" required error={errors.name}>
        <Input id="ir-name" name="name" placeholder="Enter rule name" aria-invalid={errors.name ? true : undefined} />
      </Field>
      <Field label="Earned on" htmlFor="ir-basis" required error={errors.basis}>
        <Select id="ir-basis" name="basis" value={basis} onChange={(e) => setBasis(e.target.value)} options={incentiveBasisOptions} placeholder="Select how it is earned" aria-invalid={errors.basis ? true : undefined} />
      </Field>
      {margin ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Percent of margin" htmlFor="ir-percent" required error={errors.percent}>
            <Input id="ir-percent" name="percent" inputMode="decimal" placeholder="Enter percent" aria-invalid={errors.percent ? true : undefined} />
          </Field>
          <Field label="Minimum margin ₹" htmlFor="ir-min" error={errors.minMargin} hint="Billings below this earn nothing.">
            <Input id="ir-min" name="minMargin" inputMode="decimal" placeholder="Enter minimum margin" aria-invalid={errors.minMargin ? true : undefined} />
          </Field>
        </div>
      ) : (
        <Field label="Amount ₹ each" htmlFor="ir-amount" required={basis !== ""} error={errors.amount}>
          <Input id="ir-amount" name="amount" inputMode="decimal" placeholder="Enter amount" aria-invalid={errors.amount ? true : undefined} />
        </Field>
      )}
      <Field label="Applies from" htmlFor="ir-from" required error={errors.effectiveFrom}>
        <Input id="ir-from" name="effectiveFrom" type="date" defaultValue={today} aria-invalid={errors.effectiveFrom ? true : undefined} />
      </Field>
    </>
  );
}

// ─── Monthly target ──────────────────────────────────────────────────────────

export function TargetDialog({ action, telecallers, month }: { action: Action; telecallers: Option[]; month: string }) {
  return (
    <ActionDialog
      trigger={
        <>
          <Target className="size-4" />
          Set target
        </>
      }
      triggerVariant="secondary"
      title="Set monthly target"
      description="Replaces the telecaller's target for that month."
      action={action}
      validate={(fd) => validateForm(targetSchema, fd, TARGET_FIELDS)}
      submitLabel="Save target"
    >
      {(errors) => (
        <>
          <Field label="Telecaller" htmlFor="tg-user" required error={errors.userId}>
            <Select id="tg-user" name="userId" options={telecallers} placeholder="Select telecaller" aria-invalid={errors.userId ? true : undefined} />
          </Field>
          <Field label="Month" htmlFor="tg-month" required error={errors.month}>
            <Input id="tg-month" name="month" type="month" defaultValue={month} aria-invalid={errors.month ? true : undefined} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Conversions target" htmlFor="tg-conv" required error={errors.conversionsTarget}>
              <Input id="tg-conv" name="conversionsTarget" type="number" inputMode="numeric" min={0} placeholder="Enter conversions target" aria-invalid={errors.conversionsTarget ? true : undefined} />
            </Field>
            <Field label="Billings target" htmlFor="tg-bill" required error={errors.billingsTarget}>
              <Input id="tg-bill" name="billingsTarget" type="number" inputMode="numeric" min={0} placeholder="Enter billings target" aria-invalid={errors.billingsTarget ? true : undefined} />
            </Field>
          </div>
        </>
      )}
    </ActionDialog>
  );
}
