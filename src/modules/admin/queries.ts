import "server-only";
import { db } from "@/server/db";

// Read functions for Master Settings. Option lists only include active rows.

export const listCompanies = () =>
  db.company.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { branches: true, users: true } } } });

export const listBranches = () =>
  db.branch.findMany({
    orderBy: [{ company: { name: "asc" } }, { name: "asc" }],
    include: { company: { select: { name: true } }, _count: { select: { users: true } } },
  });

export const listDomains = () =>
  db.domain.findMany({
    orderBy: { name: "asc" },
    include: { departments: { orderBy: { name: "asc" } }, _count: { select: { users: true } } },
  });

export const listPrivileges = () =>
  db.privilege.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true, permissions: { where: { canView: true } } } } },
  });

export const listModules = () =>
  db.module.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: { _count: { select: { menus: true } } },
  });

export const getModuleWithMenus = (id: string) =>
  db.module.findUnique({
    where: { id },
    include: { menus: { orderBy: [{ sortOrder: "asc" }, { title: "asc" }] } },
  });

/** All modules with their menus, for the permission matrix. */
export const listModulesWithMenus = () =>
  db.module.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: { menus: { orderBy: [{ sortOrder: "asc" }, { title: "asc" }] } },
  });

export const listBlockedIps = () =>
  db.blockedIp.findMany({
    orderBy: { createdAt: "desc" },
    include: { blockedBy: { select: { firstName: true, lastName: true } } },
  });

export async function selectOptions() {
  const [companies, branches, domains, departments, privileges, modules] = await Promise.all([
    db.company.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.branch.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, companyId: true },
    }),
    db.domain.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.department.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, domainId: true },
    }),
    db.privilege.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.module.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      select: { id: true, title: true },
    }),
  ]);
  return { companies, branches, domains, departments, privileges, modules };
}

export type SelectOptions = Awaited<ReturnType<typeof selectOptions>>;
