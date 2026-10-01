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

## Modules

| # | Module | Menus |
|---|---|---|
| 1 | Service | Dashboard · Cases · New Case (Intake) · Chip-Level Lab · Uncollected Devices |
| 2 | Sales & Finance | Dashboard · Direct Sales · Daybook & Expenses |
| 3 | Inventory | Dashboard · Stock & Purchasing · Catalog |
| 4 | Customers & Support | Dashboard · Customer Database · CS Workspace · Announcements · Portal Preview |
| 5 | Company (Owner/Admin) | Owner Dashboard · AI Agents — "The Seven" · Audit Log |
| 6 | Master Settings | Users · Company · Privilege · Modules · Rules · Security (Block List, User Activity) |

The list lives in `prisma/seed/navigation.ts`. `npm run db:seed` adds and updates
it; `npm run db:seed:sync` also **removes** any module or menu that is not in
that file (including ones added through the UI).

## Master Settings flow

1. **Company**: the company, then its **Branches** and **Domains & Departments** (tabs).
2. **Privilege**: create one, then *Permissions* to tick View / Create / Edit /
   Delete / Approve per menu.
3. **Users**: company → branch, domain → department, privilege and default
   module. The eye icon opens the user's details and recent activity.
4. **Modules**: rail icons; *Menus* adds sidebar groups and items.
5. **Rules**: discount cap, GST, service TAT hours and sign-in security. Code
   reads them with `getNumberRule()` / `getBooleanRule()` from `src/server/rules.ts`.
6. **Security**: **Block List** refuses sign-in from listed IPs; **User Activity**
   logs sign-ins, failures, lockouts and every Master Settings change. After
   `LOGIN_MAX_ATTEMPTS` failed sign-ins an account locks for `LOGIN_LOCK_MINUTES`;
   unlock it with the lock icon on the Users screen.

## Service & Customers

- **New Case (Intake)** `/service/new`: type the phone first; a known customer's
  details fill in. Saving creates or updates the customer (the phone is the dedupe
  key), the case, its received items, intake photos, the first timeline entry and an
  advance `Payment` row, all in one transaction.
- **Jobsheet numbers** `LC-{BRANCH}-{YYMM}-{SEQ}` (e.g. `LC-EDP-2609-0001`) restart
  each month per branch (month in IST). `nextJobsheetNo()` in
  `src/modules/service/jobsheet.ts` takes the number from the `number_sequence`
  table with one atomic `INSERT … ON CONFLICT … RETURNING` inside the save
  transaction, so numbers never repeat and a failed save leaves no gap.
  `Case.jobsheetNo` is also unique in the database.
- **Cases** `/service/cases`: list with stage tabs; the details page has the
  timeline, photos and the device passcode (stored encrypted with
  `DATA_ENCRYPTION_KEY`; every reveal is logged).
- **Customer Database** `/customers/database`: shared by all branches. The list
  shows who created and who last updated each customer; the details page has
  the full change history ("Changed: Email, PIN code") from the activity log.

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
permissions, rules or passwords changed in the UI.

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
`db:seed:sync`, `db:reset`, `db:studio`, `db:generate`.

## Branch scope

The header shows a branch selector. Admins and privileges with **Own branch only**
switched off pick *All branches* or one branch; branch-bound users see their own
branch as a fixed chip. Server code applies it with
`branchWhere(await getBranchScope(user))` from `src/server/branch-scope.ts` — use it
in every query on a table that has `branchId`. Records from another branch return 404.
