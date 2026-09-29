"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { initialFormState, type FormState } from "@/lib/form";
import { DISTRICTS, INDIAN_STATES } from "@/lib/india";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/forms/form-message";
import type { SelectOptions } from "../queries";
import { EMPLOYMENT_STATUSES, GENDERS, MARITAL_STATUSES, PASSWORD_MIN, label } from "../user-schema";

export type UserFormValues = Record<string, string>;

type UserFormProps = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  options: SelectOptions;
  /** Editing: the user's current values (dates as yyyy-mm-dd, booleans as "on"). */
  initial?: UserFormValues;
  id?: string;
  canSetPrimaryAdmin: boolean;
};

const enumOptions = (values: readonly string[]) => values.map((v) => ({ value: v, label: label(v) }));

export function UserForm({ action, options, initial, id, canSetPrimaryAdmin }: UserFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const v: UserFormValues = state.values ?? initial ?? { status: "WORKING", state: "Kerala" };

  return (
    <form
      key={`${id ?? "new"}-${JSON.stringify(state.values ?? {})}`}
      action={formAction}
      className="space-y-4"
      noValidate
    >
      <FormMessage ok={state.ok} message={state.message} />
      {id && <input type="hidden" name="id" value={id} />}
      <UserFields
        v={v}
        errors={state.fieldErrors ?? {}}
        options={options}
        editing={Boolean(id)}
        canSetPrimaryAdmin={canSetPrimaryAdmin}
      />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {id ? "Update" : "Submit"}
        </Button>
        {id ? (
          <LinkButton href="/admin/users" variant="secondary">
            Cancel
          </LinkButton>
        ) : (
          <Button type="reset" variant="danger">
            Reset
          </Button>
        )}
      </div>
    </form>
  );
}

function UserFields({
  v,
  errors,
  options,
  editing,
  canSetPrimaryAdmin,
}: {
  v: UserFormValues;
  errors: Record<string, string[] | undefined>;
  options: SelectOptions;
  editing: boolean;
  canSetPrimaryAdmin: boolean;
}) {
  // Dependent selects: branch follows company, department follows domain, district follows state.
  const [companyId, setCompanyId] = useState(v.companyId ?? "");
  const [domainId, setDomainId] = useState(v.domainId ?? "");
  const [stateName, setStateName] = useState(v.state ?? "");

  const branches = options.branches.filter((b) => b.companyId === companyId);
  const departments = options.departments.filter((d) => d.domainId === domainId);
  const districts = DISTRICTS[stateName];

  const f = (name: string) => ({
    id: name,
    name,
    defaultValue: v[name] ?? "",
    "aria-invalid": errors[name] ? true : undefined,
  });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
      <Field label="First name" htmlFor="firstName" required error={errors.firstName}>
        <Input {...f("firstName")} placeholder="First name" />
      </Field>
      <Field label="Last name" htmlFor="lastName" error={errors.lastName}>
        <Input {...f("lastName")} placeholder="Last name" />
      </Field>
      <Field label="Mobile" htmlFor="mobile" required error={errors.mobile}>
        <Input {...f("mobile")} type="tel" inputMode="numeric" placeholder="Mobile" />
      </Field>
      <Field label="Email" htmlFor="email" required error={errors.email}>
        <Input {...f("email")} type="email" autoComplete="off" placeholder="Email" />
      </Field>
      <Field label="Username" htmlFor="username" required error={errors.username}>
        <Input {...f("username")} autoComplete="off" placeholder="Username" />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        required={!editing}
        error={errors.password}
        hint={editing ? "Leave blank to keep the current password" : `At least ${PASSWORD_MIN} characters`}
      >
        <Input id="password" name="password" type="password" autoComplete="new-password" aria-invalid={errors.password ? true : undefined} />
      </Field>
      <Field label="DOB" htmlFor="dob" error={errors.dob}>
        <Input {...f("dob")} type="date" />
      </Field>
      <Field label="State" htmlFor="state" error={errors.state}>
        <Select
          {...f("state")}
          value={stateName}
          defaultValue={undefined}
          onChange={(e) => setStateName(e.target.value)}
          options={INDIAN_STATES.map((s) => ({ value: s, label: s }))}
        />
      </Field>
      <Field label="District" htmlFor="district" error={errors.district}>
        {districts ? (
          <Select key={stateName} {...f("district")} options={districts.map((d) => ({ value: d, label: d }))} />
        ) : (
          <Input key={stateName} {...f("district")} placeholder="District" />
        )}
      </Field>
      <div className="flex items-end pb-2">
        <Switch
          id="isPrimaryAdmin"
          name="isPrimaryAdmin"
          label="Primary Admin"
          defaultChecked={v.isPrimaryAdmin === "on"}
          disabled={!canSetPrimaryAdmin}
        />
      </div>

      <Field label="Address" htmlFor="address" error={errors.address} className="lg:col-span-2">
        <Textarea {...f("address")} placeholder="Address" />
      </Field>
      <Field label="Image" htmlFor="image" error={errors.image} hint="JPG, PNG or WebP, up to 2 MB">
        <Input
          id="image"
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="py-1.5 file:mr-3 file:rounded-md file:border-0 file:bg-surface-muted file:px-3 file:py-1 file:text-sm"
        />
      </Field>
      <Field label="Joining Date" htmlFor="joiningDate" error={errors.joiningDate}>
        <Input {...f("joiningDate")} type="date" />
      </Field>
      <Field label="Marital Status" htmlFor="maritalStatus" error={errors.maritalStatus}>
        <Select {...f("maritalStatus")} options={enumOptions(MARITAL_STATUSES)} />
      </Field>

      <Field label="Active Status" htmlFor="status" required error={errors.status}>
        <Select {...f("status")} options={enumOptions(EMPLOYMENT_STATUSES)} />
      </Field>
      <Field label="Company" htmlFor="companyId" required error={errors.companyId}>
        <Select
          {...f("companyId")}
          value={companyId}
          defaultValue={undefined}
          onChange={(e) => setCompanyId(e.target.value)}
          options={options.companies.map((c) => ({ value: c.id, label: c.name }))}
        />
      </Field>
      <Field label="Domain" htmlFor="domainId" required error={errors.domainId}>
        <Select
          {...f("domainId")}
          value={domainId}
          defaultValue={undefined}
          onChange={(e) => setDomainId(e.target.value)}
          options={options.domains.map((d) => ({ value: d.id, label: d.name }))}
        />
      </Field>
      <Field label="Branch" htmlFor="branchId" required error={errors.branchId}>
        <Select
          key={companyId}
          {...f("branchId")}
          placeholder={companyId ? "Select…" : "Select a company first"}
          options={branches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` }))}
        />
      </Field>
      <Field label="Privilege" htmlFor="privilegeId" required error={errors.privilegeId}>
        <Select {...f("privilegeId")} options={options.privileges.map((p) => ({ value: p.id, label: p.name }))} />
      </Field>

      <Field label="Gender" htmlFor="gender" error={errors.gender}>
        <Select {...f("gender")} options={enumOptions(GENDERS)} />
      </Field>
      <Field label="Default Module" htmlFor="defaultModuleId" required error={errors.defaultModuleId}>
        <Select {...f("defaultModuleId")} options={options.modules.map((m) => ({ value: m.id, label: m.title }))} />
      </Field>
      <Field label="Department" htmlFor="departmentId" required error={errors.departmentId}>
        <Select
          key={domainId}
          {...f("departmentId")}
          placeholder={domainId ? "Select…" : "Select a domain first"}
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
        />
      </Field>
    </div>
  );
}
