"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { CircleCheck, Loader2, LocateFixed, UserPlus } from "lucide-react";
import { initialFormState, validateForm, type FormState } from "@/lib/form";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import { PhotoInput } from "@/components/forms/photo-input";
import { leadSourceOptions } from "@/modules/customers/schemas";
import {
  INTAKE_FIELDS,
  intakeSchema,
  intakeTypeOptions,
  productTypeOptions,
  warrantyOptions,
  type CustomerMatch,
} from "../case-schema";
import { ReceivedItemsInput } from "./received-items-input";

export type IntakeOptions = {
  branches: { id: string; code: string; name: string }[];
  accounts: { id: string; label: string }[];
  /** Next jobsheet number per branch id (preview; assigned on save). */
  previews: Record<string, string>;
};

type IntakeFormProps = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  lookup: (phone: string) => Promise<CustomerMatch | null>;
  options: IntakeOptions;
};

const DEFAULTS: Record<string, string> = {
  intakeType: "WALK_IN",
  productType: "LAPTOP",
  warrantyStatus: "NON_WARRANTY",
};

/** New case: customer (phone-first lookup) → product. Items and the estimate are added when diagnosis starts. */
export function IntakeForm({ action, lookup, options }: IntakeFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const { errors, onSubmit, onChange } = useFormFeedback({
    state,
    validate: (fd) => validateForm(intakeSchema, fd, INTAKE_FIELDS),
  });
  const single = options.branches.length === 1 ? options.branches[0]!.id : "";
  const v: Record<string, string> = state.values ?? { ...DEFAULTS, branchId: single };

  const [branchId, setBranchId] = useState(v.branchId ?? single);
  const [intakeType, setIntakeType] = useState(v.intakeType ?? "WALK_IN");
  const preview = options.previews[branchId];

  const f = (name: string) => ({
    id: name,
    name,
    defaultValue: v[name] ?? "",
    "aria-invalid": errors[name] ? true : undefined,
  });

  return (
    <form
      key={JSON.stringify(state.values ?? {})}
      action={formAction}
      onSubmit={onSubmit}
      onChange={onChange}
      className="space-y-4"
      noValidate
    >
      {/* Header row: jobsheet preview · intake type · save */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          {options.branches.length > 1 ? (
            <Field label="Branch" htmlFor="branchId" required error={errors.branchId} className="w-56">
              <Select
                {...f("branchId")}
                value={branchId}
                defaultValue={undefined}
                onChange={(e) => setBranchId(e.target.value)}
                options={options.branches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` }))}
              />
            </Field>
          ) : (
            <input type="hidden" name="branchId" value={branchId} />
          )}
          <p className="pb-2 text-sm text-text-muted">
            Jobsheet{" "}
            <span className="font-semibold text-text">{preview ?? "— pick a branch"}</span>
            {preview && <span className="text-xs"> · confirmed on save</span>}
          </p>
        </div>
        <div className="flex items-end gap-2">
          <Field label="Intake type" htmlFor="intakeType" required error={errors.intakeType} className="w-40">
            <Select
              {...f("intakeType")}
              value={intakeType}
              defaultValue={undefined}
              onChange={(e) => setIntakeType(e.target.value)}
              options={intakeTypeOptions}
              placeholder="Select…"
            />
          </Field>
          <SaveButton pending={pending} />
        </div>
      </div>

      <FormSection step={1} title="Customer" hint="phone-first lookup, auto-prefill on match">
        <CustomerFields v={v} f={f} errors={errors} lookup={lookup} accounts={options.accounts} intakeType={intakeType} />
      </FormSection>

      <FormSection step={2} title="Product">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Product type" htmlFor="productType" required error={errors.productType}>
            <Select {...f("productType")} options={productTypeOptions} />
          </Field>
          <Field label="Brand" htmlFor="brand" required error={errors.brand}>
            <Input {...f("brand")} placeholder="Dell" />
          </Field>
          <Field label="Model" htmlFor="model" error={errors.model}>
            <Input {...f("model")} placeholder="Inspiron 5518" />
          </Field>
          <Field label="Serial / IMEI" htmlFor="serialNo" error={errors.serialNo}>
            <Input {...f("serialNo")} autoComplete="off" />
          </Field>
          <Field label="Status" htmlFor="warrantyStatus" required error={errors.warrantyStatus}>
            <Select {...f("warrantyStatus")} options={warrantyOptions} />
          </Field>
          <Field
            label="Password / passcode"
            htmlFor="devicePassword"
            error={errors.devicePassword}
            hint="Stored encrypted; every reveal is logged"
          >
            <Input id="devicePassword" name="devicePassword" type="password" autoComplete="off" />
          </Field>
          <Field label="Problem reported" htmlFor="problemReported" required error={errors.problemReported} className="lg:col-span-2">
            <Input {...f("problemReported")} placeholder="No power; intermittent charging" />
          </Field>
          <Field label="Intake photos" htmlFor="photos" error={errors.photos} hint="Up to 8; re-add them if the save fails">
            <PhotoInput name="photos" invalid={Boolean(errors.photos)} />
          </Field>
          <Field
            label="Received items"
            htmlFor="receivedItems"
            error={errors.receivedItems}
            hint="Charger, bag, sleeve … with reference no. and condition"
            className="sm:col-span-2 lg:col-span-3"
          >
            <ReceivedItemsInput name="receivedItems" initial={v.receivedItems} invalid={Boolean(errors.receivedItems)} />
          </Field>
        </div>
      </FormSection>

      <div className="flex justify-end">
        <SaveButton pending={pending} />
      </div>
    </form>
  );
}

function SaveButton({ pending }: { pending: boolean }) {
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      Save case
    </Button>
  );
}

type FieldProps = (name: string) => {
  id: string;
  name: string;
  defaultValue: string;
  "aria-invalid": boolean | undefined;
};

function CustomerFields({
  v,
  f,
  errors,
  lookup,
  accounts,
  intakeType,
}: {
  v: Record<string, string>;
  f: FieldProps;
  errors: Record<string, string[] | undefined>;
  lookup: IntakeFormProps["lookup"];
  accounts: IntakeOptions["accounts"];
  intakeType: string;
}) {
  // undefined = not looked up yet, null = new customer
  const [match, setMatch] = useState<CustomerMatch | null | undefined>(undefined);
  const [looking, startLookup] = useTransition();
  const lastLookup = useRef("");
  const [coords, setCoords] = useState({ lat: v.siteLatitude ?? "", lng: v.siteLongitude ?? "" });
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");

  const onPhone = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = normalizePhone(e.target.value);
    if (!isValidPhone(digits)) {
      lastLookup.current = "";
      setMatch(undefined);
      return;
    }
    if (digits === lastLookup.current) return;
    lastLookup.current = digits;
    const form = e.target.form;
    startLookup(async () => {
      const found = await lookup(digits).catch(() => null);
      if (lastLookup.current !== digits) return; // typed on meanwhile
      setMatch(found);
      if (!found || !form) return;
      const set = (name: string, value: string | null) => {
        const el = form.elements.namedItem(name);
        if ((el instanceof HTMLInputElement || el instanceof HTMLSelectElement) && value) el.value = value;
      };
      set("name", found.name);
      set("email", found.email);
      set("altPhone", found.altPhone);
      set("source", "REPEAT_CUSTOMER");
    });
  };

  const locate = () => {
    if (!navigator.geolocation) return setLocateError("This device can't share its location");
    setLocating(true);
    setLocateError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) });
        setLocating(false);
      },
      () => {
        setLocateError("Location permission was denied or unavailable");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <Field label="Phone" htmlFor="phone" required error={errors.phone}>
          <Input {...f("phone")} type="tel" inputMode="tel" autoComplete="off" placeholder="98470 12345" onChange={onPhone} autoFocus />
        </Field>
        {!errors.phone && (
          <p className="mt-1 flex items-center gap-1 text-xs" aria-live="polite">
            {looking ? (
              <span className="flex items-center gap-1 text-text-muted">
                <Loader2 className="size-3 animate-spin" /> Looking up…
              </span>
            ) : match ? (
              <span className="flex items-center gap-1 font-medium text-success">
                <CircleCheck className="size-3.5" /> Matched: {match.name} ({match.code}) — prefilled · {match.visitCount}{" "}
                {match.visitCount === 1 ? "visit" : "visits"}
                {!match.isActive && <span className="text-warning"> · marked inactive</span>}
              </span>
            ) : match === null ? (
              <span className="flex items-center gap-1 text-text-muted">
                <UserPlus className="size-3.5" /> New customer — added to the database on save
              </span>
            ) : null}
          </p>
        )}
      </div>
      <Field label="Name" htmlFor="name" required error={errors.name}>
        <Input {...f("name")} autoComplete="off" />
      </Field>
      <Field label="Email" htmlFor="email" required error={errors.email}>
        <Input {...f("email")} type="email" autoComplete="off" />
      </Field>
      <Field label="Alt phone" htmlFor="altPhone" error={errors.altPhone}>
        <Input {...f("altPhone")} type="tel" inputMode="tel" autoComplete="off" />
      </Field>
      <Field label="Company account (B2B)" htmlFor="accountId" error={errors.accountId}>
        <Select {...f("accountId")} placeholder="— none —" options={accounts.map((a) => ({ value: a.id, label: a.label }))} />
      </Field>
      <Field label="How did you hear about us?" htmlFor="source" required error={errors.source}>
        <Select {...f("source")} options={leadSourceOptions} />
      </Field>

      {intakeType !== "WALK_IN" && (
        <>
          <Field
            label={intakeType === "PICKUP" ? "Pickup address" : "Site address"}
            htmlFor="siteAddress"
            required
            error={errors.siteAddress}
            className="sm:col-span-2"
          >
            <Textarea {...f("siteAddress")} />
          </Field>
          {intakeType === "ON_SITE" && (
            <Field label="Site location" htmlFor="locate" error={locateError || errors.siteLatitude}>
              <input type="hidden" name="siteLatitude" value={coords.lat} />
              <input type="hidden" name="siteLongitude" value={coords.lng} />
              <Button id="locate" variant="secondary" onClick={locate} disabled={locating} className="w-full">
                {locating ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
                {coords.lat ? `${coords.lat}, ${coords.lng}` : "Capture location"}
              </Button>
            </Field>
          )}
        </>
      )}
    </div>
  );
}
