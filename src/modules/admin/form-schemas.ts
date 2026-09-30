import {
  blockedIpSchema,
  branchSchema,
  companySchema,
  departmentSchema,
  domainSchema,
  menuSchema,
  moduleSchema,
  privilegeSchema,
} from "./schemas";
import { ruleSchema } from "./rule-schema";

/**
 * Schemas the browser validates with before submitting. Server pages pass the
 * key (schemas themselves can't cross the server → client boundary).
 */
export const FORM_SCHEMAS = {
  company: companySchema,
  branch: branchSchema,
  domain: domainSchema,
  department: departmentSchema,
  privilege: privilegeSchema,
  module: moduleSchema,
  menu: menuSchema,
  blockedIp: blockedIpSchema,
  rule: ruleSchema,
};

export type FormSchemaKey = keyof typeof FORM_SCHEMAS;
