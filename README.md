# Laptop Clinic CRM

Next.js 16 (App Router) + PostgreSQL + Prisma 7. Modules, sidebar menus and
permissions are **stored in the database** — the icon rail, module sidebar and
app switcher render whatever the signed-in user's role is allowed to view.

## First-time setup

1. Create the database (once), e.g. in psql: `CREATE DATABASE crm_project;`
2. Copy `.env.example` to `.env` and put your real Postgres password in
   `DATABASE_URL` (`postgresql://postgres:<password>@localhost:5432/crm_project`).
3. Run:

```bash
npm install                      # also runs `prisma generate`
npx prisma migrate dev           # creates all tables
npm run db:seed                  # privileges, modules, menus, company/branches/domains, demo users
npm run dev                      # http://localhost:3000
```

Demo logins (password `Welcome@123`): `admin`, `bm.edp`, `sales.edp`,
`purchase`, `cs`, `chip` — each privilege sees a different set of modules.

## Master Settings (Admin → /admin)

Set these up in order — each one feeds the dropdowns of the next:

1. **Company** → 2. **Branch** (belongs to a company) → 3. **Domain** and its
**Departments** → 4. **Privilege** (then click *Permissions* to tick which menus
it can View / Create / Edit / Delete / Approve) → 5. **Users**.

**Modules** manages the rail icons; click *Menus* on a module to add groups and
items. **Security** has Blocked IP (sign-in refused from those addresses) and
the User Activity Log (logins, logouts and every Master Settings change).

## How the dynamic menu works

| Table             | Holds                                                         |
| ----------------- | ------------------------------------------------------------- |
| `module`               | one rail icon / app-switcher tile (`icon` = lucide name, e.g. `wrench`) |
| `menu`                 | sidebar entries: `GROUP` (collapsible heading) or `ITEM` (link); `parentId` nests items in a group |
| `privilege_permission` | `canView / canCreate / canEdit / canDelete / canApprove` per privilege per menu item |
| `privilege`            | `isSuperAdmin` privileges (and primary-admin users) see everything; `homePath` is the fallback landing page |

Visibility rules (`src/server/navigation/get-navigation.ts`):
an **item** shows if the privilege has `canView`; a **group** shows if any of its
items show; a **module** shows if any of its items show.

To add a screen: in **Master Settings → Modules → Menus** add an item, then in
**Privilege → Permissions** tick View for the privileges that need it. It shows
in the sidebar straight away and opens a placeholder page. Build the real page
by adding a route folder, e.g. `src/app/(app)/service/cases/page.tsx` — it takes
precedence over the placeholder catch-all. Server actions check permissions
with `requireActionPermission(path, "canCreate")` from `src/server/rbac/guard.ts`.

Re-running `npm run db:seed` is safe: it upserts and never overwrites
permissions or passwords changed in the UI.

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
