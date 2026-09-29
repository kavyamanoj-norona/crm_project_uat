import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { hashPassword } from "../../src/server/auth/password";
import {
  BRANCHES,
  COMPANY,
  DEMO_USERS,
  DOMAINS,
  MODULES,
  PRIVILEGES,
  type GroupDef,
  type ItemDef,
  type PrivilegeCode,
} from "./navigation";

// Idempotent: safe to re-run. It upserts; it never deletes rows, and it never
// overwrites a password that was changed after the first seed.
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const DEMO_PASSWORD = "Welcome@123";

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const isGroup = (e: ItemDef | GroupDef): e is GroupDef => "group" in e;

async function seedPrivileges() {
  const ids = {} as Record<PrivilegeCode, string>;
  for (const p of PRIVILEGES) {
    const { code, ...rest } = p;
    const row = await db.privilege.upsert({ where: { code }, update: rest, create: { code, ...rest } });
    ids[code] = row.id;
  }
  return ids;
}

async function seedNavigation(privilegeIds: Record<PrivilegeCode, string>) {
  let permissionCount = 0;
  const moduleIds: Record<string, string> = {};

  for (const [mIndex, m] of MODULES.entries()) {
    const moduleData = { title: m.title, icon: m.icon, path: m.path, sortOrder: mIndex + 1 };
    const moduleRow = await db.module.upsert({
      where: { code: m.code },
      update: moduleData,
      create: { code: m.code, ...moduleData },
    });
    moduleIds[m.code] = moduleRow.id;

    const upsertItem = async (item: ItemDef, order: number, parent?: { id: string; code: string }) => {
      const code = `${parent?.code ?? m.code}.${slug(item.title)}`;
      const data = {
        moduleId: moduleRow.id,
        parentId: parent?.id ?? null,
        type: "ITEM" as const,
        title: item.title,
        icon: item.icon,
        path: item.path,
        sortOrder: order,
      };
      const menu = await db.menu.upsert({ where: { code }, update: data, create: { code, ...data } });

      for (const privilegeCode of item.roles ?? m.roles) {
        const readOnly = m.readOnly?.includes(privilegeCode) ?? false;
        const flags = {
          canView: true,
          canCreate: !readOnly,
          canEdit: !readOnly,
          canDelete: false,
          canApprove: item.approve?.includes(privilegeCode) ?? false,
        };
        const privilegeId = privilegeIds[privilegeCode];
        // create-only: permissions edited in the UI are never overwritten by a re-seed
        await db.privilegePermission.upsert({
          where: { privilegeId_menuId: { privilegeId, menuId: menu.id } },
          update: {},
          create: { privilegeId, menuId: menu.id, ...flags },
        });
        permissionCount++;
      }
    };

    for (const [eIndex, entry] of m.entries.entries()) {
      const order = (eIndex + 1) * 10;
      if (!isGroup(entry)) {
        await upsertItem(entry, order);
        continue;
      }
      const code = `${m.code}.${slug(entry.group)}`;
      const data = {
        moduleId: moduleRow.id,
        parentId: null,
        type: "GROUP" as const,
        title: entry.group,
        icon: entry.icon ?? null,
        path: null,
        sortOrder: order,
      };
      const group = await db.menu.upsert({ where: { code }, update: data, create: { code, ...data } });
      for (const [iIndex, item] of entry.items.entries()) {
        await upsertItem(item, (iIndex + 1) * 10, group);
      }
    }
  }
  return { moduleIds, permissionCount };
}

async function seedOrganisation() {
  const { code, ...companyData } = COMPANY;
  const company = await db.company.upsert({ where: { code }, update: companyData, create: { code, ...companyData } });

  const branchIds: Record<string, string> = {};
  for (const b of BRANCHES) {
    const data = { name: b.name, isVirtual: b.isVirtual, companyId: company.id };
    const row = await db.branch.upsert({ where: { code: b.code }, update: data, create: { code: b.code, ...data } });
    branchIds[b.code] = row.id;
  }

  const domainIds: Record<string, string> = {};
  const departmentIds: Record<string, string> = {};
  for (const d of DOMAINS) {
    const domain = await db.domain.upsert({
      where: { code: d.code },
      update: { name: d.name },
      create: { code: d.code, name: d.name },
    });
    domainIds[d.code] = domain.id;
    for (const name of d.departments) {
      const dep = await db.department.upsert({
        where: { domainId_name: { domainId: domain.id, name } },
        update: {},
        create: { domainId: domain.id, name },
      });
      departmentIds[`${d.code}/${name}`] = dep.id;
    }
  }
  return { companyId: company.id, branchIds, domainIds, departmentIds };
}

async function main() {
  const privilegeIds = await seedPrivileges();
  const { moduleIds, permissionCount } = await seedNavigation(privilegeIds);
  const org = await seedOrganisation();

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  for (const [i, u] of DEMO_USERS.entries()) {
    const data = {
      firstName: u.firstName,
      lastName: u.lastName,
      mobile: u.mobile,
      email: `${u.username}@laptopclinic.local`,
      privilegeId: privilegeIds[u.privilege],
      companyId: org.companyId,
      branchId: u.branch ? org.branchIds[u.branch]! : null,
      domainId: org.domainIds[u.domain]!,
      departmentId: org.departmentIds[`${u.domain}/${u.department}`]!,
      defaultModuleId: moduleIds[u.defaultModule] ?? null,
      state: "Kerala",
      district: "Ernakulam",
      isPrimaryAdmin: u.privilege === "ADMIN",
    };
    await db.user.upsert({
      where: { username: u.username },
      update: data,
      create: { ...data, username: u.username, userCode: `LC${String(i + 1).padStart(5, "0")}`, passwordHash },
    });
  }

  console.log(
    `Seeded ${PRIVILEGES.length} privileges, ${MODULES.length} modules, ${permissionCount} permissions, ` +
      `${BRANCHES.length} branches, ${DOMAINS.length} domains, ${DEMO_USERS.length} users.`,
  );
  console.table(DEMO_USERS.map((u) => ({ username: u.username, privilege: u.privilege, password: DEMO_PASSWORD })));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
