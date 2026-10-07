"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { initialFormState, validateForm, type FormState } from "@/lib/form";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { StateDistrictFields } from "@/components/forms/state-district-fields";
import type { SelectOptions } from "../queries";
import {
  EMPLOYMENT_STATUSES,
  GENDERS,
  MARITAL_STATUSES,
  PASSWORD_MIN,
  USER_FIELDS,
  createUserSchema,
  editUserSchema,
  label,
} from "../user-schema";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

/** Same rules as the server, so bad input never leaves the browser. */
function validateUser(fd: FormData, editing: boolean) {
  const errors = validateForm(editing ? editUserSchema : createUserSchema, fd, USER_FIELDS) ?? {};
  const image = fd.get("image");
  if (image instanceof File && image.size > 0) {
    if (!IMAGE_TYPES.includes(image.type)) errors.image = ["Use a JPG, PNG or WebP image"];
    else if (image.size > IMAGE_MAX_BYTES) errors.image = ["Image must be 2 MB or smaller"];
  }
  return Object.keys(errors).length ? errors : null;
}

export type UserFormValues = Record<string, string>;

type UserFormProps = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  options: SelectOptions;
  /** Editing: the user's current values (dates as yyyy-mm-dd). New: defaults. */
  initial?: UserFormValues;
  id?: string;
};

const enumOptions = (values: readonly string[]) => values.map((v) => ({ value: v, label: label(v) }));

export function UserForm({ action, options, initial, id }: UserFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const { errors, onSubmit, onChange } = useFormFeedback({ state, validate: (fd) => validateUser(fd, Boolean(id)) });
  const v: UserFormValues = state.values ?? initial ?? { status: "WORKING", state: "Kerala" };

  return (
    <form
      key={`${id ?? "new"}-${JSON.stringify(state.values ?? {})}`}
      action={formAction}
      onSubmit={onSubmit}
      onChange={onChange}
      className="space-y-4"
      noValidate
    >
      {id && <input type="hidden" name="id" value={id} />}
      <UserFields v={v} errors={errors} options={options} editing={Boolean(id)} />
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
}: {
  v: UserFormValues;
  errors: Record<string, string[] | undefined>;
  options: SelectOptions;
  editing: boolean;
}) {
  // Dependent selects: branch follows company, department follows domain.
  const [companyId, setCompanyId] = useState(v.companyId ?? "");
  const [domainId, setDomainId] = useState(v.domainId ?? "");

  const branches = options.branches.filter((b) => b.companyId === companyId);
  const departments = options.departments.filter((d) => d.domainId === domainId);

  const f = (name: string) => ({
    id: name,
    name,
    defaultValue: v[name] ?? "",
    "aria-invalid": errors[name] ? true : undefined,
  });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
      <Field label="First name" htmlFor="firstName" required error={errors.firstName}>
        <Input {...f("firstName")} placeholder="Enter first name" />
      </Field>
      <Field label="Last name" htmlFor="lastName" error={errors.lastName}>
        <Input {...f("lastName")} placeholder="Enter last name" />
      </Field>
      <Field label="Mobile" htmlFor="mobile" required error={errors.mobile}>
        <Input {...f("mobile")} type="tel" inputMode="numeric" placeholder="Enter mobile number" />
      </Field>
      <Field label="Email" htmlFor="email" required error={errors.email}>
        <Input {...f("email")} type="email" autoComplete="off" placeholder="Enter email" />
      </Field>
      <Field label="Username" htmlFor="username" required error={errors.username}>
        <Input {...f("username")} autoComplete="off" placeholder="Enter username" />
      </Field>

      {/* Editing changes the password from the key button in the Users table. */}
      {!editing && (
        <Field label="Password" htmlFor="password" required error={errors.password} hint={`At least ${PASSWORD_MIN} characters`}>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.password ? true : undefined}
          />
        </Field>
      )}
      <Field label="DOB" htmlFor="dob" error={errors.dob}>
        <Input {...f("dob")} type="date" />
      </Field>
      <StateDistrictFields state={v.state} district={v.district} errors={errors} />

      <Field label="Address" htmlFor="address" error={errors.address} className="lg:col-span-2">
        <Textarea {...f("address")} placeholder="Enter address" />
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
