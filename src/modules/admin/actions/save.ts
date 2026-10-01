"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { db } from "@/server/db";
import { pick, toFieldErrors, type FormState } from "@/lib/form";
import { FieldError, handleActionError } from "@/server/prisma-errors";
import { requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { ADMIN_PATHS } from "../paths";
import {
  blockedIpSchema,
  branchSchema,
  companySchema,
  departmentSchema,
  domainSchema,
  menuSchema,
  moduleSchema,
  privilegeSchema,
} from "../schemas";
import { ruleSchema } from "../rule-schema";
import { itemSchema } from "../item-schema";

type SaveOptions<S extends z.ZodType> = {
  entity: string;
  path: string;
  schema: S;
  labels?: Record<string, string>;
  /** Where to go after saving (defaults to `${path}?saved=<timestamp>`). */
  redirectTo?: (id: string) => string;
  write: (data: z.output<S>, id: string | null, userId: string) => Promise<{ id: string }>;
};

/** Shared create/update flow: validate → permission → write → log → redirect. */
async function save<S extends z.ZodType>(formData: FormData, opts: SaveOptions<S>): Promise<FormState> {
  const shape = (opts.schema as unknown as { shape?: Record<string, unknown> }).shape;
  const keys = shape ? Object.keys(shape) : [...formData.keys()];
  const parsed = opts.schema.safeParse(pick(formData, keys));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);

  const id = formData.get("id")?.toString() || null;
  let savedId: string;
  try {
    const user = await requireActionPermission(opts.path, id ? "canEdit" : "canCreate");
    savedId = (await opts.write(parsed.data, id, user.id)).id;
    await logActivity({
      action: `${opts.entity.toLowerCase()}.${id ? "update" : "create"}`,
      userId: user.id,
      entity: opts.entity,
      entityId: savedId,
    });
  } catch (e) {
    return handleActionError(e, opts.labels, formData);
  }

  revalidatePath(opts.path, "layout");
  redirect(opts.redirectTo?.(savedId) ?? `${opts.path}?saved=${Date.now()}`);
}

export async function saveCompany(_prev: FormState, formData: FormData) {
  return save(formData, {
    entity: "Company",
    path: ADMIN_PATHS.companies,
    schema: companySchema,
    labels: { code: "Code" },
    write: (data, id) => {
      const d = { ...data, gstin: data.gstin?.toUpperCase() ?? null };
      return id ? db.company.update({ where: { id }, data: d }) : db.company.create({ data: d });
    },
  });
}

export async function saveBranch(_prev: FormState, formData: FormData) {
  return save(formData, {
    entity: "Branch",
    path: ADMIN_PATHS.branches,
    schema: branchSchema,
    labels: { code: "Code" },
    write: (data, id) => (id ? db.branch.update({ where: { id }, data }) : db.branch.create({ data })),
  });
}

export async function saveDomain(_prev: FormState, formData: FormData) {
  return save(formData, {
    entity: "Domain",
    path: ADMIN_PATHS.domains,
    schema: domainSchema,
    labels: { code: "Code" },
    write: (data, id) => (id ? db.domain.update({ where: { id }, data }) : db.domain.create({ data })),
  });
}

export async function saveDepartment(_prev: FormState, formData: FormData) {
  return save(formData, {
    entity: "Department",
    path: ADMIN_PATHS.departments,
    schema: departmentSchema,
    labels: { domainId: "Department in this domain", name: "Department" },
    write: (data, id) =>
      id ? db.department.update({ where: { id }, data }) : db.department.create({ data }),
  });
}

export async function savePrivilege(_prev: FormState, formData: FormData) {
  return save(formData, {
    entity: "Privilege",
    path: ADMIN_PATHS.privileges,
    schema: privilegeSchema,
    labels: { code: "Code" },
    // New privileges go straight to their permission matrix.
    redirectTo: (id) => `${ADMIN_PATHS.privileges}/${id}`,
    write: (data, id) =>
      id ? db.privilege.update({ where: { id }, data }) : db.privilege.create({ data }),
  });
}

export async function saveModule(_prev: FormState, formData: FormData) {
  return save(formData, {
    entity: "Module",
    path: ADMIN_PATHS.modules,
    schema: moduleSchema,
    labels: { code: "Code", path: "Path" },
    redirectTo: (id) => `${ADMIN_PATHS.modules}/${id}`,
    write: (data, id) => (id ? db.module.update({ where: { id }, data }) : db.module.create({ data })),
  });
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export async function saveMenu(_prev: FormState, formData: FormData) {
  return save(formData, {
    entity: "Menu",
    path: ADMIN_PATHS.modules,
    schema: menuSchema,
    labels: { path: "Path", code: "Menu" },
    redirectTo: () => `${ADMIN_PATHS.modules}/${formData.get("moduleId")}?saved=${Date.now()}`,
    write: async (data, id) => {
      const mod = await db.module.findUniqueOrThrow({ where: { id: data.moduleId } });
      if (data.type === "ITEM" && data.path && data.path !== mod.path && !data.path.startsWith(`${mod.path}/`)) {
        throw new FieldError("path", `Path must start with ${mod.path}/`);
      }
      const parent = data.parentId ? await db.menu.findUnique({ where: { id: data.parentId } }) : null;
      const row = {
        ...data,
        path: data.type === "GROUP" ? null : data.path,
        parentId: data.type === "GROUP" ? null : data.parentId,
      };
      if (id) return db.menu.update({ where: { id }, data: row });
      const code = `${parent?.code ?? mod.code}.${slug(data.title)}`;
      return db.menu.create({ data: { ...row, code } });
    },
  });
}

export async function saveBlockedIp(_prev: FormState, formData: FormData) {
  return save(formData, {
    entity: "BlockedIp",
    path: ADMIN_PATHS.blockedIps,
    schema: blockedIpSchema,
    labels: { ip: "IP address" },
    write: (data, id, userId) =>
      id
        ? db.blockedIp.update({ where: { id }, data })
        : db.blockedIp.create({ data: { ...data, blockedById: userId } }),
  });
}

export async function saveRule(_prev: FormState, formData: FormData) {
  return save(formData, {
    entity: "Rule",
    path: ADMIN_PATHS.rules,
    schema: ruleSchema,
    labels: { code: "Code" },
    write: (data, id, userId) =>
      id
        ? db.rule.update({ where: { id }, data: { ...data, updatedById: userId } })
        : db.rule.create({ data: { ...data, updatedById: userId } }),
  });
}

export async function saveItem(_prev: FormState, formData: FormData) {
  return save(formData, {
    entity: "Item",
    path: ADMIN_PATHS.items,
    schema: itemSchema,
    labels: { code: "Item code" },
    write: (data, id, userId) => {
      const { price, ...rest } = data;
      const row = { ...rest, pricePaise: price!, updatedById: userId };
      return id ? db.item.update({ where: { id }, data: row }) : db.item.create({ data: { ...row, createdById: userId } });
    },
  });
}
