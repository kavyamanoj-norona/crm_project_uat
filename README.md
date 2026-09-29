# Laptop Clinic CRM

Next.js 16 (App Router) + PostgreSQL + Prisma 7. Modules, sidebar menus and
permissions are **stored in the database** — the icon rail, module sidebar and
app switcher render whatever the signed-in user's role is allowed to view.

## First-time setup

```bash
npm install                      # also runs `prisma generate`
cp .env.example .env             # then set DATABASE_URL and SESSION_SECRET
npx prisma migrate dev           # creates the database + tables
npm run db:seed                  # roles, 12 modules + settings, menus, demo users
npm run dev                      # http://localhost:3000
```

Demo logins (password `Welcome@123`): `admin`, `bm.edp`, `sales.edp`,
`purchase`, `cs`, `chip` — each role sees a different set of modules.

## How the dynamic menu works

| Table             | Holds                                                         |
| ----------------- | ------------------------------------------------------------- |
| `module`          | one rail icon / app-switcher tile (`icon` = lucide name, e.g. `wrench`) |
| `menu`            | sidebar entries: `GROUP` (collapsible heading) or `ITEM` (link); `parentId` nests items in a group |
| `role_permission` | `canView / canCreate / canEdit / canDelete / canApprove` per role per menu item |
| `role`            | `isSuperAdmin` roles see everything; `homePath` is the landing page |

Visibility rules (`src/server/navigation/get-navigation.ts`):
an **item** shows if the role has `canView`; a **group** shows if any of its
items show; a **module** shows if any of its items show.

To add a screen: insert a `menu` row (type `ITEM`, `path` under the module's
prefix) and a `role_permission` row with `canView = true`. It appears on the
next page load and opens a placeholder page. Build the real page by adding a
route folder, e.g. `src/app/(app)/service/cases/page.tsx` — it takes
precedence over the placeholder catch-all.

Use `npm run db:studio` to edit rows by hand, or change
`prisma/seed/navigation.ts` and re-run `npm run db:seed` (idempotent upserts).

## Layout

```
prisma/schema.prisma              schema; migrations/ ; seed/
src/app/(auth)/login              login page (no shell)
src/app/(app)/layout.tsx          AppShell: IconRail + ModuleSidebar + TopBar
src/app/(app)/[...slug]/page.tsx  placeholder for any DB menu path + permission check
src/components/layout/            app-shell, icon-rail, module-sidebar, top-bar, app-switcher, profile-menu
src/server/                       db client, auth (session, password, actions), navigation queries
src/lib/                          client-safe helpers (cn, navigation types)
src/proxy.ts                      auth gate (Next 16 name for middleware)
```

## Scripts

`dev`, `build`, `start`, `lint`, `typecheck`, `db:migrate`, `db:seed`,
`db:reset`, `db:studio`, `db:generate`.
