import { Field, Input, Select } from "@/components/ui/field";
import { MODE_LABELS } from "./finance-ui";

const MODES = ["CASH", "UPI", "CARD", "BANK_TRANSFER"].map((m) => ({ value: m, label: MODE_LABELS[m]! }));

/** Amount, mode and reference: the fields of every "receive / pay money" dialog. */
export function PaymentFields({ id, amountLabel = "Amount (₹)", defaultAmount }: { id: string; amountLabel?: string; defaultAmount?: string }) {
  return (
    <>
      <Field label={amountLabel} htmlFor={`${id}-amount`} required>
        <Input id={`${id}-amount`} name="amount" inputMode="decimal" defaultValue={defaultAmount} placeholder="Enter amount" />
      </Field>
      <Field label="Payment mode" htmlFor={`${id}-mode`} required>
        <Select id={`${id}-mode`} name="mode" options={MODES} placeholder="Select payment mode" />
      </Field>
      <Field label="Reference" htmlFor={`${id}-ref`} hint="Optional: UPI, card or transfer reference.">
        <Input id={`${id}-ref`} name="reference" placeholder="Enter reference" />
      </Field>
    </>
  );
}
