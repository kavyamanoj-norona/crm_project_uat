import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { hashPassword } from "../../src/server/auth/password";
import { DEMO_USERS, MODULES, ROLES, type GroupDef, type ItemDef, type RoleCode } from "./navigation";

// Idempotent: safe to re-run. It upserts; it never deletes rows.
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const DEMO_PASSWORD = "Welcome@123";

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const isGroup = (e: ItemDef | GroupDef): e is GroupDef => "group" in e;

async function main() {
  // Roles
  const roleIds = {} as Record<RoleCode, string>;
  for (const r of ROLES) {
    const role = await db.role.upsert({
      where: { code: r.code },
      update: { name: r.name, isSuperAdmin: r.isSuperAdmin, homePath: r.homePath },
      create: { code: r.code, name: r.name, isSuperAdmin: r.isSuperAdmin, homePath: r.homePath },
    });
    roleIds[r.code] = role.id;
  }

  // Modules, groups, items, permissions
  let permissionCount = 0;
  for (const [mIndex, m] of MODULES.entries()) {
    const moduleRow = await db.module.upsert({
      where: { code: m.code },
      update: { title: m.title, icon: m.icon, path: m.path, sortOrder: mIndex + 1 },
      create: { code: m.code, title: m.title, icon: m.icon, path: m.path, sortOrder: mIndex + 1 },
    });

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

      for (const roleCode of item.roles ?? m.roles) {
        const readOnly = m.readOnly?.includes(roleCode) ?? false;
        const flags = {
          canView: true,
          canCreate: !readOnly,
          canEdit: !readOnly,
          canDelete: false,
          canApprove: item.approve?.includes(roleCode) ?? false,
        };
        await db.rolePermission.upsert({
          where: { roleId_menuId: { roleId: roleIds[roleCode], menuId: menu.id } },
          update: flags,
          create: { roleId: roleIds[roleCode], menuId: menu.id, ...flags },
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

  // Demo users (one per role)
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  for (const u of DEMO_USERS) {
    await db.user.upsert({
      where: { username: u.username },
      update: { name: u.name, email: u.email, roleId: roleIds[u.role] },
      create: { username: u.username, name: u.name, email: u.email, roleId: roleIds[u.role], passwordHash },
    });
  }

  console.log(`Seeded ${ROLES.length} roles, ${MODULES.length} modules, ${permissionCount} permissions.`);
  console.table(DEMO_USERS.map((u) => ({ username: u.username, role: u.role, password: DEMO_PASSWORD })));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
