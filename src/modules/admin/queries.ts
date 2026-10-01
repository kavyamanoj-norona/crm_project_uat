import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { pageArgs, type ListState } from "@/lib/list";
import type { FilterTab } from "@/components/data/filter-tabs";

// Read functions for Master Settings. List functions take the URL list state
// and return one page of rows plus the total and filter-tab counts.

const contains = (q: string) => ({ contains: q, mode: "insensitive" as const });

type Page<T> = { rows: T[]; total: number; tabs: FilterTab[] };

/** All · Active · Inactive tabs with counts (search applied, tab not). */
async function statusTabs(count: (where: { isActive?: boolean }) => Promise<number>, labels = ["Active", "Inactive"]) {
  const [all, active] = await Promise.all([count({}), count({ isActive: true })]);
  return [
    { key: "", label: "All", count: all },
    { key: "active", label: labels[0]!, count: active },
    { key: "inactive", label: labels[1]!, count: all - active },
  ];
}

function statusWhere(tab: string) {
  return tab === "active" ? { isActive: true } : tab === "inactive" ? { isActive: false } : {};
}

// ─── Company ─────────────────────────────────────────────────────────────────

export const COMPANY_SORTS = ["code", "name", "createdAt"] as const;

export async function listCompanies(list: ListState): Promise<Page<Prisma.CompanyGetPayload<{ include: { _count: { select: { branches: true; users: true } } } }>>> {
  const search: Prisma.CompanyWhereInput = list.q
    ? { OR: [{ name: contains(list.q) }, { code: contains(list.q) }, { gstin: contains(list.q) }] }
    : {};
  const where = { ...search, ...statusWhere(list.tab) };
  const [rows, total, tabs] = await Promise.all([
    db.company.findMany({
      where,
      orderBy: { [list.sort]: list.dir },
      include: { _count: { select: { branches: true, users: true } } },
      ...pageArgs(list),
    }),
    db.company.count({ where }),
    statusTabs((w) => db.company.count({ where: { ...search, ...w } })),
  ]);
  return { rows, total, tabs };
}

// ─── Branch ──────────────────────────────────────────────────────────────────

export const BRANCH_SORTS = ["code", "name", "company", "createdAt"] as const;

export async function listBranches(list: ListState) {
  const search: Prisma.BranchWhereInput = list.q
    ? { OR: [{ name: contains(list.q) }, { code: contains(list.q) }, { company: { name: contains(list.q) } }] }
    : {};
  const where = { ...search, ...statusWhere(list.tab) };
  const orderBy: Prisma.BranchOrderByWithRelationInput =
    list.sort === "company" ? { company: { name: list.dir } } : { [list.sort]: list.dir };
  const [rows, total, tabs] = await Promise.all([
    db.branch.findMany({
      where,
      orderBy,
      include: { company: { select: { name: true } }, _count: { select: { users: true } } },
      ...pageArgs(list),
    }),
    db.branch.count({ where }),
    statusTabs((w) => db.branch.count({ where: { ...search, ...w } })),
  ]);
  return { rows, total, tabs };
}

// ─── Domain / Department ─────────────────────────────────────────────────────

export const DOMAIN_SORTS = ["code", "name", "createdAt"] as const;

export async function listDomains(list: ListState) {
  const search: Prisma.DomainWhereInput = list.q ? { OR: [{ name: contains(list.q) }, { code: contains(list.q) }] } : {};
  const where = { ...search, ...statusWhere(list.tab) };
  const [rows, total, tabs] = await Promise.all([
    db.domain.findMany({
      where,
      orderBy: { [list.sort]: list.dir },
      include: { _count: { select: { departments: true, users: true } } },
      ...pageArgs(list),
    }),
    db.domain.count({ where }),
    statusTabs((w) => db.domain.count({ where: { ...search, ...w } })),
  ]);
  return { rows, total, tabs };
}

export const DEPARTMENT_SORTS = ["name", "domain", "createdAt"] as const;

/** Tabs are the domains; `list.tab` is a domain id. */
export async function listDepartments(list: ListState) {
  const search: Prisma.DepartmentWhereInput = list.q
    ? { OR: [{ name: contains(list.q) }, { domain: { name: contains(list.q) } }] }
    : {};
  const where = { ...search, ...(list.tab ? { domainId: list.tab } : {}) };
  const orderBy: Prisma.DepartmentOrderByWithRelationInput =
    list.sort === "domain" ? { domain: { name: list.dir } } : { [list.sort]: list.dir };
  const [rows, total, all, byDomain, domains] = await Promise.all([
    db.department.findMany({
      where,
      orderBy,
      include: { domain: { select: { name: true } }, _count: { select: { users: true } } },
      ...pageArgs(list),
    }),
    db.department.count({ where }),
    db.department.count({ where: search }),
    db.department.groupBy({ by: ["domainId"], where: search, _count: { _all: true } }),
    db.domain.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const counts = new Map(byDomain.map((d) => [d.domainId, d._count._all]));
  const tabs: FilterTab[] = [
    { key: "", label: "All", count: all },
    ...domains.map((d) => ({ key: d.id, label: d.name, count: counts.get(d.id) ?? 0 })),
  ];
  return { rows, total, tabs };
}

export const listDomainOptions = () =>
  db.domain.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });

// ─── Privilege ───────────────────────────────────────────────────────────────

export const PRIVILEGE_SORTS = ["code", "name", "createdAt"] as const;

export async function listPrivileges(list: ListState) {
  const search: Prisma.PrivilegeWhereInput = list.q
    ? { OR: [{ name: contains(list.q) }, { code: contains(list.q) }, { description: contains(list.q) }] }
    : {};
  const where = { ...search, ...statusWhere(list.tab) };
  const [rows, total, tabs] = await Promise.all([
    db.privilege.findMany({
      where,
      orderBy: { [list.sort]: list.dir },
      include: { _count: { select: { users: true, permissions: { where: { canView: true } } } } },
      ...pageArgs(list),
    }),
    db.privilege.count({ where }),
    statusTabs((w) => db.privilege.count({ where: { ...search, ...w } })),
  ]);
  return { rows, total, tabs };
}

// ─── Module / Menu ───────────────────────────────────────────────────────────

export const MODULE_SORTS = ["sortOrder", "title", "code", "path"] as const;

export async function listModules(list: ListState) {
  const search: Prisma.ModuleWhereInput = list.q
    ? { OR: [{ title: contains(list.q) }, { code: contains(list.q) }, { path: contains(list.q) }] }
    : {};
  const where = { ...search, ...statusWhere(list.tab) };
  const [rows, total, tabs, last] = await Promise.all([
    db.module.findMany({
      where,
      orderBy: [{ [list.sort]: list.dir }, { title: "asc" }],
      include: { _count: { select: { menus: true } } },
      ...pageArgs(list),
    }),
    db.module.count({ where }),
    statusTabs((w) => db.module.count({ where: { ...search, ...w } })),
    db.module.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } }),
  ]);
  return { rows, total, tabs, nextSortOrder: (last?.sortOrder ?? 0) + 1 };
}

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

// ─── Rules ───────────────────────────────────────────────────────────────────

export const RULE_SORTS = ["name", "category", "code", "updatedAt"] as const;

/** Tabs are the rule categories. */
export async function listRules(list: ListState) {
  const search: Prisma.RuleWhereInput = list.q
    ? { OR: [{ name: contains(list.q) }, { code: contains(list.q) }, { description: contains(list.q) }] }
    : {};
  const where = { ...search, ...(list.tab ? { category: list.tab } : {}) };
  const [rows, total, all, byCategory] = await Promise.all([
    db.rule.findMany({
      where,
      orderBy: [{ [list.sort]: list.dir }, { name: "asc" }],
      include: { updatedBy: { select: { firstName: true } } },
      ...pageArgs(list),
    }),
    db.rule.count({ where }),
    db.rule.count({ where: search }),
    db.rule.groupBy({ by: ["category"], where: search, _count: { _all: true }, orderBy: { category: "asc" } }),
  ]);
  const tabs: FilterTab[] = [
    { key: "", label: "All", count: all },
    ...byCategory.map((c) => ({ key: c.category, label: c.category, count: c._count._all })),
  ];
  return { rows, total, tabs };
}

// ─── Security ────────────────────────────────────────────────────────────────

export const BLOCKED_IP_SORTS = ["ip", "createdAt"] as const;

export async function listBlockedIps(list: ListState) {
  const search: Prisma.BlockedIpWhereInput = list.q
    ? { OR: [{ ip: { contains: list.q } }, { reason: contains(list.q) }] }
    : {};
  const where = { ...search, ...statusWhere(list.tab) };
  const [rows, total, tabs] = await Promise.all([
    db.blockedIp.findMany({
      where,
      orderBy: { [list.sort]: list.dir },
      include: { blockedBy: { select: { firstName: true, lastName: true } } },
      ...pageArgs(list),
    }),
    db.blockedIp.count({ where }),
    statusTabs((w) => db.blockedIp.count({ where: { ...search, ...w } }), ["Blocked", "Unblocked"]),
  ]);
  return { rows, total, tabs };
}

export const ACTIVITY_SORTS = ["at", "action"] as const;

const ACTIVITY_TABS: Record<string, Prisma.UserActivityLogWhereInput> = {
  signins: { action: { in: ["login.success", "logout"] } },
  failed: { action: { in: ["login.failed", "login.locked", "login.blocked-ip", "login.disabled", "user.auto-lock"] } },
  changes: { NOT: { action: { startsWith: "login." } }, AND: { NOT: { action: { in: ["logout", "user.auto-lock"] } } } },
};

/** `scope` limits entries to users of the header branch. */
export async function listActivity(list: ListState, userId?: string, scope: { branchId?: string } = {}) {
  const search: Prisma.UserActivityLogWhereInput = {
    ...(userId ? { userId } : {}),
    ...(scope.branchId ? { user: { branchId: scope.branchId } } : {}),
    ...(list.q
      ? {
          OR: [
            { username: contains(list.q) },
            { action: contains(list.q) },
            { ip: { contains: list.q } },
            { user: { OR: [{ firstName: contains(list.q) }, { lastName: contains(list.q) }] } },
          ],
        }
      : {}),
  };
  const where = { ...search, ...(ACTIVITY_TABS[list.tab] ?? {}) };
  const [rows, total, all, signins, failed, changes] = await Promise.all([
    db.userActivityLog.findMany({
      where,
      orderBy: [{ [list.sort]: list.dir }, { at: "desc" }],
      include: { user: { select: { firstName: true, lastName: true, userCode: true } } },
      ...pageArgs(list),
    }),
    db.userActivityLog.count({ where }),
    db.userActivityLog.count({ where: search }),
    ...(["signins", "failed", "changes"] as const).map((k) =>
      db.userActivityLog.count({ where: { ...search, ...ACTIVITY_TABS[k] } }),
    ),
  ]);
  const tabs: FilterTab[] = [
    { key: "", label: "All", count: all },
    { key: "signins", label: "Sign-ins", count: signins },
    { key: "failed", label: "Failed / locked", count: failed },
    { key: "changes", label: "Changes", count: changes },
  ];
  return { rows, total, tabs };
}

// ─── Users ───────────────────────────────────────────────────────────────────

export const USER_SORTS = ["createdAt", "userCode", "name", "username", "mobile", "email", "privilege", "gender"] as const;

/** Tabs are the privileges; `list.tab` is a privilege id. `scope` = header branch filter. */
export async function listUsers(list: ListState, scope: { branchId?: string } = {}) {
  const search: Prisma.UserWhereInput = list.q
    ? {
        ...scope,
        OR: [
          { firstName: contains(list.q) },
          { lastName: contains(list.q) },
          { username: contains(list.q) },
          { email: contains(list.q) },
          { mobile: { contains: list.q } },
          { userCode: contains(list.q) },
        ],
      }
    : scope;
  const where = { ...search, ...(list.tab ? { privilegeId: list.tab } : {}) };
  const orderBy: Prisma.UserOrderByWithRelationInput =
    list.sort === "name"
      ? { firstName: list.dir }
      : list.sort === "privilege"
        ? { privilege: { name: list.dir } }
        : { [list.sort]: list.dir };

  const [rows, total, all, byPrivilege, privileges] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: [orderBy, { createdAt: "desc" }],
      include: {
        privilege: { select: { name: true } },
        department: { select: { name: true } },
        branch: { select: { code: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
      ...pageArgs(list),
    }),
    db.user.count({ where }),
    db.user.count({ where: search }),
    db.user.groupBy({ by: ["privilegeId"], where: search, _count: { _all: true } }),
    db.privilege.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const counts = new Map(byPrivilege.map((p) => [p.privilegeId, p._count._all]));
  const tabs: FilterTab[] = [
    { key: "", label: "All", count: all },
    ...privileges.map((p) => ({ key: p.id, label: p.name, count: counts.get(p.id) ?? 0 })),
  ];
  return { rows, total, tabs };
}

// ─── Form options ────────────────────────────────────────────────────────────

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

// ─── Items (catalog) ─────────────────────────────────────────────────────────

export const ITEM_SORTS = ["code", "name", "category", "pricePaise", "maxDiscountPercent", "updatedAt"] as const;

const ITEM_TABS: Record<string, Prisma.ItemWhereInput> = {
  service: { type: "SERVICE", isActive: true },
  part: { type: "PART", isActive: true },
  accessory: { type: "ACCESSORY", isActive: true },
  inactive: { isActive: false },
};

/** Tabs are the item types (active) plus Inactive. */
export async function listItems(list: ListState) {
  const search: Prisma.ItemWhereInput = list.q
    ? {
        OR: [
          { code: contains(list.q) },
          { name: contains(list.q) },
          { category: contains(list.q) },
          { brand: contains(list.q) },
          { hsnSac: { contains: list.q } },
        ],
      }
    : {};
  const where = { ...search, ...(ITEM_TABS[list.tab] ?? {}) };
  const [rows, total, all, ...counts] = await Promise.all([
    db.item.findMany({
      where,
      orderBy: [{ [list.sort]: list.dir }, { name: "asc" }],
      include: { updatedBy: { select: { firstName: true, lastName: true } } },
      ...pageArgs(list),
    }),
    db.item.count({ where }),
    db.item.count({ where: search }),
    ...Object.values(ITEM_TABS).map((w) => db.item.count({ where: { ...search, ...w } })),
  ]);
  const labels = { service: "Services", part: "Spare parts", accessory: "Accessories", inactive: "Inactive" };
  const tabs: FilterTab[] = [
    { key: "", label: "All", count: all },
    ...Object.keys(ITEM_TABS).map((k, i) => ({ key: k, label: labels[k as keyof typeof labels], count: counts[i]! })),
  ];
  return { rows, total, tabs };
}

/** Categories in use, for the item form's suggestions. */
export const listItemCategories = async () =>
  (await db.item.findMany({ where: { category: { not: null } }, distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } }))
    .map((r) => r.category!);
