@AGENTS.md

# Project notes

- Prisma 7 (`prisma-client` generator, output `src/generated/prisma`, driver adapter `@prisma/adapter-pg`). Not Prisma 8.
- Navigation (modules, menus, role permissions) lives in the database; see README "How the dynamic menu works".
- `src/components/` must not import from `src/server/`; pass server actions down as props.
- Money is integer paise; never floats. No hard deletes.
