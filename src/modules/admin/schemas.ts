import { z } from "zod";
import { checkbox, optionalText, requiredText } from "@/lib/form";
import { optionalPercent } from "@/lib/percent";

const upperCode = (label: string, max = 12) =>
  z
    .string()
    .trim()
    .toUpperCase()
    .regex(new RegExp(`^[A-Z0-9_]{2,${max}}$`), `${label}: 2–${max} letters, digits or _`);

const optionalEmail = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.email("Enter a valid email").nullable());

const optionalPhone = optionalText.refine((v) => v === null || /^\+?[0-9 -]{7,15}$/.test(v), "Enter a valid phone number");

const routePath = z
  .string()
  .trim()
  .regex(/^\/[a-z0-9\-/]*[a-z0-9]$/, "Path must start with / and use lowercase letters, digits, - and /");

const sortOrder = z.coerce.number().int().min(0).max(9999).default(0);

export const companySchema = z.object({
  code: upperCode("Code", 10),
  name: requiredText("Name"),
  gstin: optionalText.refine(
    (v) => v === null || /^[0-9]{2}[A-Z0-9]{13}$/.test(v.toUpperCase()),
    "GSTIN must be 15 characters",
  ),
  email: optionalEmail,
  phone: optionalPhone,
  address: optionalText,
  isActive: checkbox,
});

export const BRANCH_TYPES = ["COMPANY_OWNED", "FRANCHISE"] as const;
export type BranchTypeValue = (typeof BRANCH_TYPES)[number];
export const BRANCH_TYPE_LABELS: Record<BranchTypeValue, string> = {
  COMPANY_OWNED: "Company-owned",
  FRANCHISE: "Franchise",
};
export const branchTypeOptions = BRANCH_TYPES.map((v) => ({ value: v, label: BRANCH_TYPE_LABELS[v] }));

/**
 * companyShare / franchiseShare are percentages typed in the form and parsed to
 * basis points here. They only apply to a franchise, where they must add up to
 * 100%; saveBranch fixes a company-owned branch at 100% / 0%.
 */
export const branchSchema = z
  .object({
    companyId: requiredText("Company"),
    code: upperCode("Code", 6),
    name: requiredText("Name"),
    branchType: z.enum(BRANCH_TYPES, { error: "Select branch type" }),
    companyShare: optionalPercent("Company share"),
    franchiseShare: optionalPercent("Franchise owner share"),
    phone: optionalPhone,
    address: optionalText,
    isVirtual: checkbox,
    isActive: checkbox,
  })
  .superRefine((v, ctx) => {
    if (v.branchType !== "FRANCHISE") return;
    if (v.companyShare === null)
      ctx.addIssue({ code: "custom", path: ["companyShare"], message: "Enter the company share" });
    if (v.franchiseShare === null)
      ctx.addIssue({ code: "custom", path: ["franchiseShare"], message: "Enter the franchise owner share" });
    if (v.companyShare !== null && v.franchiseShare !== null && v.companyShare + v.franchiseShare !== 10000)
      ctx.addIssue({
        code: "custom",
        path: ["franchiseShare"],
        message: "Company and franchise owner shares must add up to 100%",
      });
  });

export const domainSchema = z.object({
  code: upperCode("Code", 20),
  name: requiredText("Name"),
  isActive: checkbox,
});

export const departmentSchema = z.object({
  domainId: requiredText("Domain"),
  name: requiredText("Name"),
  isActive: checkbox,
});

export const privilegeSchema = z.object({
  code: upperCode("Code", 30),
  name: requiredText("Name"),
  description: optionalText,
  homePath: optionalText.refine((v) => v === null || routePath.safeParse(v).success, "Must be a path like /dashboard"),
  isSuperAdmin: checkbox,
  isBranchBound: checkbox,
  isActive: checkbox,
});

export const moduleSchema = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z][a-z0-9-]{1,30}$/, "Code: lowercase letters, digits and -"),
  title: requiredText("Title"),
  icon: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Use a lucide icon name, e.g. wrench"),
  path: routePath,
  sortOrder,
  isActive: checkbox,
});

export const menuSchema = z
  .object({
    moduleId: requiredText("Module"),
    parentId: optionalText,
    type: z.enum(["GROUP", "ITEM"]),
    title: requiredText("Title"),
    icon: optionalText,
    path: optionalText,
    sortOrder,
    isActive: checkbox,
  })
  .superRefine((v, ctx) => {
    if (v.type === "ITEM") {
      if (!v.path) ctx.addIssue({ code: "custom", path: ["path"], message: "Path is required for a menu item" });
      else if (!routePath.safeParse(v.path).success)
        ctx.addIssue({ code: "custom", path: ["path"], message: "Path must start with / and be lowercase" });
    }
    if (v.type === "GROUP" && v.parentId)
      ctx.addIssue({ code: "custom", path: ["parentId"], message: "A group sits directly under the module" });
  });

export const blockedIpSchema = z.object({
  ip: z.string().trim().pipe(z.union([z.ipv4(), z.ipv6()], { error: "Enter a valid IPv4 or IPv6 address" })),
  reason: optionalText,
  isActive: checkbox,
});
