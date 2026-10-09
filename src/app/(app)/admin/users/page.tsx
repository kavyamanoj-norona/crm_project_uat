import Image from "next/image";
import Link from "next/link";
import { Eye, Lock, LockOpen, Pencil } from "lucide-react";
import { db } from "@/server/db";
import { Badge } from "@/components/ui/badge";
import { ListView } from "@/components/data/list-view";
import { listState } from "@/lib/list";
import { changeUserPassword, saveUser, toggleUserFlag } from "@/modules/admin/actions/users";
import { PasswordDialog } from "@/modules/admin/components/password-dialog";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { FlagToggle } from "@/modules/admin/components/flag-toggle";
import { UserForm, type UserFormValues } from "@/modules/admin/components/user-form";
import { ADMIN_PATHS } from "@/modules/admin/paths";
import { USER_SORTS, listUsers, selectOptions } from "@/modules/admin/queries";
import { STATUS_TONE, label } from "@/modules/admin/user-schema";
import { formatDate, toDateInput } from "@/lib/dates";
import { requirePageAccess } from "@/server/rbac/guard";
import { branchWhere, getBranchScope } from "@/server/branch-scope";

export const metadata = { title: "Users" };

const iconLink =
  "inline-flex size-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted hover:text-text";

const isLocked = (u: { isLocked: boolean; lockedUntil: Date | null }) =>
  u.isLocked || (u.lockedUntil !== null && u.lockedUntil > new Date());

const fullName = (u: { firstName: string; lastName: string | null }) => [u.firstName, u.lastName].filter(Boolean).join(" ");

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const { user: me, permission } = await requirePageAccess(ADMIN_PATHS.users);
  const sp = await searchParams;
  const list = listState(ADMIN_PATHS.users, sp, { sorts: USER_SORTS, defaultSort: "createdAt", defaultPageSize: 50 });
  const editId = param(sp, "edit");
  const highlight = param(sp, "highlight") ?? editId;
  const scope = await getBranchScope(me);

  const [{ rows, total, tabs }, options, editing] = await Promise.all([
    listUsers(list, branchWhere(scope)),
    selectOptions(),
    editId && permission.canEdit ? db.user.findUnique({ where: { id: editId } }) : null,
  ]);

  const missing = [
    !options.companies.length && "a company",
    !options.branches.length && "a branch",
    !options.domains.length && "a domain",
    !options.departments.length && "a department",
    !options.privileges.length && "a privilege",
  ].filter(Boolean);

  // Only the fields the form shows — never the password hash.
  const initial: UserFormValues | undefined = editing
    ? {
        firstName: editing.firstName,
        lastName: editing.lastName ?? "",
        mobile: editing.mobile,
        email: editing.email,
        username: editing.username,
        dob: toDateInput(editing.dob),
        gender: editing.gender ?? "",
        maritalStatus: editing.maritalStatus ?? "",
        state: editing.state ?? "",
        district: editing.district ?? "",
        address: editing.address ?? "",
        joiningDate: toDateInput(editing.joiningDate),
        status: editing.status,
        companyId: editing.companyId,
        branchId: editing.branchId ?? "",
        domainId: editing.domainId,
        departmentId: editing.departmentId,
        privilegeId: editing.privilegeId,
        defaultModuleId: editing.defaultModuleId ?? "",
      }
    : scopeDefaults();

  // New users default to the branch picked in the header.
  function scopeDefaults(): UserFormValues | undefined {
    const b = options.branches.find((x) => x.id === scope.branchId);
    return b ? { status: "WORKING", state: "Kerala", companyId: b.companyId, branchId: b.id } : undefined;
  }

  const bind = (id: string, flag: Parameters<typeof toggleUserFlag>[1]) =>
    permission.canEdit ? toggleUserFlag.bind(null, id, flag) : undefined;

  return (
    <AdminPage
      title="Users"
      subtitle={scope.branch ? `Branch: ${scope.branch.name} (${scope.branch.code})` : "All branches"}
      saved={param(sp, "saved")}
      form={
        (editing ? permission.canEdit : permission.canCreate)
          ? {
              label: "Add User",
              editingTitle: editing ? `${fullName(editing)} (${editing.userCode})` : undefined,
              cancelHref: ADMIN_PATHS.users,
              content:
                missing.length > 0 ? (
                  <p className="text-sm text-text-muted">
                    Before creating users, add {missing.join(", ")} in Master Settings → Company / Privilege.
                  </p>
                ) : (
                  <UserForm
                    action={saveUser}
                    options={options}
                    initial={initial}
                    id={editing?.id}
                  />
                ),
            }
          : undefined
      }
    >
      <ListView
        list={list}
        total={total}
        tabs={tabs}
        rows={rows}
        rowKey={(u) => u.id}
        highlight={(u) => u.id === highlight}
        searchPlaceholder="Search…"
        empty="No users yet."
        columns={[
          { header: "#", cell: (_, i) => i + 1 },
          { header: "Date", sort: "createdAt", cell: (u) => formatDate(u.createdAt) },
          { header: "User ID", sort: "userCode", cell: (u) => u.userCode },
          {
            header: "Name",
            sort: "name",
            cell: (u) => (
              <span className="flex items-center gap-2 font-medium">
                {u.imageUrl ? (
                  <Image src={u.imageUrl} alt="" width={32} height={32} className="size-8 rounded-full object-cover" />
                ) : (
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                    {u.firstName[0]}
                    {u.lastName?.[0]}
                  </span>
                )}
                {fullName(u)}
              </span>
            ),
          },
          { header: "Username", sort: "username", cell: (u) => u.username },
          { header: "Mobile", sort: "mobile", cell: (u) => u.mobile },
          { header: "Email", sort: "email", cell: (u) => u.email },
          { header: "Branch", cell: (u) => u.branch ? `${u.branch.name} (${u.branch.code})` : "—" },
          { header: "Privilege", sort: "privilege", cell: (u) => u.privilege.name },
          { header: "Department", cell: (u) => u.department.name },
          { header: "Gender", sort: "gender", cell: (u) => (u.gender ? label(u.gender) : "—") },
          { header: "Status", cell: (u) => <Badge tone={STATUS_TONE[u.status]}>{label(u.status)}</Badge> },
          {
            header: "Two Auth",
            align: "center",
            cell: (u) => <FlagToggle on={u.twoFactorEnabled} label="Two-factor" action={bind(u.id, "twoFactorEnabled")} />,
          },
          {
            header: "Enabled",
            align: "center",
            cell: (u) => (
              <FlagToggle on={u.isActive} label="Enabled" action={u.id === me.id ? undefined : bind(u.id, "isActive")} />
            ),
          },
          {
            header: "Action",
            cell: (u) => (
              <span className="flex items-center gap-1">
                <Link href={`${ADMIN_PATHS.users}/${u.id}`} className={iconLink} aria-label="View" title="View">
                  <Eye className="size-4" />
                </Link>
                {permission.canEdit && (
                  <>
                    <Link href={`${ADMIN_PATHS.users}?edit=${u.id}`} className={iconLink} aria-label="Edit" title="Edit">
                      <Pencil className="size-4" />
                    </Link>
                    <PasswordDialog
                      userName={fullName(u)}
                      action={changeUserPassword.bind(null, u.id)}
                      className={iconLink}
                    />
                  </>
                )}
                <FlagToggle
                  on={isLocked(u)}
                  label={isLocked(u) ? "Unlock user" : "Lock user"}
                  action={u.id === me.id ? undefined : bind(u.id, "isLocked")}
                >
                  <span className={iconLink}>
                    {isLocked(u) ? <Lock className="size-4 text-danger" /> : <LockOpen className="size-4 text-success" />}
                  </span>
                </FlagToggle>
              </span>
            ),
          },
        ]}
      />
    </AdminPage>
  );
}
