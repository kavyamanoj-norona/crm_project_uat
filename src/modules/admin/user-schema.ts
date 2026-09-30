import { z } from "zod";
import { optionalText, requiredText } from "@/lib/form";

const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.iso.date("Enter a valid date").nullable())
  .transform((v) => (v ? new Date(`${v}T00:00:00Z`) : null));

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.enum(values).nullable());

export const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
export const MARITAL_STATUSES = ["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"] as const;
export const EMPLOYMENT_STATUSES = ["WORKING", "ON_LEAVE", "RESIGNED", "TERMINATED"] as const;

export const PASSWORD_MIN = 10;

export const userSchema = z.object({
  firstName: requiredText("First name"),
  lastName: optionalText,
  mobile: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^(\+91)?[6-9][0-9]{9}$/, "Enter a valid 10-digit mobile number")),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._]{3,30}$/, "3–30 characters: letters, digits, . or _"),
  // Only sent when creating; editing changes it through the Change password dialog.
  password: z.string().optional(),
  dob: optionalDate,
  gender: optionalEnum(GENDERS),
  maritalStatus: optionalEnum(MARITAL_STATUSES),
  state: optionalText,
  district: optionalText,
  address: optionalText,
  joiningDate: optionalDate,
  status: z.enum(EMPLOYMENT_STATUSES, { error: "Select an active status" }),
  companyId: requiredText("Company"),
  branchId: requiredText("Branch"),
  domainId: requiredText("Domain"),
  departmentId: requiredText("Department"),
  privilegeId: requiredText("Privilege"),
  defaultModuleId: requiredText("Default module"),
});

export type UserInput = z.output<typeof userSchema>;

const passwordRule = z.string().min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters`);

/** Creating a user: password is required. */
export const createUserSchema = userSchema.extend({ password: passwordRule });
/** Editing a user: the password is changed separately. */
export const editUserSchema = userSchema.omit({ password: true });

/** Change password dialog. */
export const passwordChangeSchema = z
  .object({ password: passwordRule, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });

export const USER_FIELDS = Object.keys(userSchema.shape);

export const label = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, " ");

export const STATUS_TONE = { WORKING: "success", ON_LEAVE: "warning", RESIGNED: "neutral", TERMINATED: "danger" } as const;
