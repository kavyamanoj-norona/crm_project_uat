@AGENTS.md

# Project notes

- Prisma 7 (`prisma-client` generator, output `src/generated/prisma`, driver adapter `@prisma/adapter-pg`). Not Prisma 8.
- Navigation (modules, menus, role permissions) lives in the database; see README "How the dynamic menu works".
- `src/components/` must not import from `src/server/`; pass server actions down as props.
- Money is integer paise; never floats. No hard deletes.
- Branch scope: every query on a model with `branchId` must spread `branchWhere(await getBranchScope(user))` from `src/server/branch-scope.ts`. Branch-bound privileges are fixed to their branch; others pick one in the header switcher (cookie `lc_branch`). Records outside the scope return 404, not 403.
- Lists use `listState()` + `pageArgs()` (`src/lib/list.ts`) and render `<ListView>`; create/edit forms go in `AdminPage`'s `form` (collapsible `CreatePanel`).
