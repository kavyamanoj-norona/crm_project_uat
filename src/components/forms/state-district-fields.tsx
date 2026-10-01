"use client";

import { useState } from "react";
import { DISTRICTS, INDIAN_STATES } from "@/lib/india";
import { Field, Input, Select } from "@/components/ui/field";

type StateDistrictFieldsProps = {
  state?: string;
  district?: string;
  errors: Record<string, string[] | undefined>;
};

/** State select + district (a select for states we have lists for, else text). Submits `state` and `district`. */
export function StateDistrictFields({ state = "", district = "", errors }: StateDistrictFieldsProps) {
  const [stateName, setStateName] = useState(state);
  const districts = DISTRICTS[stateName];
  const invalid = (name: string) => (errors[name] ? true : undefined);

  return (
    <>
      <Field label="State" htmlFor="state" error={errors.state}>
        <Select
          id="state"
          name="state"
          value={stateName}
          onChange={(e) => setStateName(e.target.value)}
          aria-invalid={invalid("state")}
          options={INDIAN_STATES.map((s) => ({ value: s, label: s }))}
        />
      </Field>
      <Field label="District" htmlFor="district" error={errors.district}>
        {districts ? (
          <Select
            key={stateName}
            id="district"
            name="district"
            defaultValue={district}
            aria-invalid={invalid("district")}
            options={districts.map((d) => ({ value: d, label: d }))}
          />
        ) : (
          <Input
            key={stateName}
            id="district"
            name="district"
            defaultValue={district}
            aria-invalid={invalid("district")}
            placeholder="District"
          />
        )}
      </Field>
    </>
  );
}
