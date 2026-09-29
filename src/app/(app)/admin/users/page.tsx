import Image from "next/image";
import Link from "next/link";
import { Lock, LockOpen, Pencil } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { DataTable } from "@/components/data/data-table";
import { saveUser, toggleUserFlag } from "@/modules/admin/actions/users";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { FlagToggle } from "@/modules/admin/components/flag-toggle";
import { UserForm, type UserFormValues } from "@/modules/admin/components/user-form";
import { ADMIN_PATHS } from "@/modules/admin/paths";
import { selectOptions } from "@/modules/admin/queries";
import { label } from "@/modules/admin/user-schema";
import { formatDate, toDateInput } from "@/lib/dates";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Users" };

const STATUS_TONE = { WORKING: "success", ON_LEAVE: "warning", RESIGNED: "neutral", TERMINATED: "danger" } as const;

const fullName = (u: { firstName: string; lastName: string | null }) => [u.firstName, u.lastName].filter(Boolean).join(" ");

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const { user: me, permission } = await requirePageAccess(ADMIN_PATHS.users);
  const sp = await searchParams;
  const q = param(sp, "q");
  const editId = param(sp, "edit");
  const highlight = param(sp, "highlight") ?? editId;

  const where: Prisma.UserWhereInput = q
    ? {
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { username: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { mobile: { contains: q } },
          { userCode: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const [users, options, editing] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        privilege: { select: { name: true } },
        department: { select: { name: true } },
        branch: { select: { code: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    }),
    selectOptions(),
    editId ? db.user.findUnique({ where: { id: editId } }) : null,
  ]);

  const showForm = editing ? permission.canEdit : permission.canCreate;
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
        isPrimaryAdmin: editing.isPrimaryAdmin ? "on" : "",
        companyId: editing.companyId,
        branchId: editing.branchId ?? "",
        domainId: editing.domainId,
        departmentId: editing.departmentId,
        privilegeId: editing.privilegeId,
        defaultModuleId: editing.defaultModuleId ?? "",
      }
    : undefined;

  const bind = (id: string, flag: Parameters<typeof toggleUserFlag>[1]) =>
    permission.canEdit ? toggleUserFlag.bind(null, id, flag) : undefined;

  return (
    <AdminPage title="Users" saved={Boolean(param(sp, "saved"))}>
      {showForm && (
        <Card title={editing ? `Edit ${fullName(editing)} (${editing.userCode})` : "Create user"}>
          {missing.length > 0 ? (
            <p className="text-sm text-text-muted">
              Before creating users, add {missing.join(", ")} in Master Settings.
            </p>
          ) : (
            <UserForm
              action={saveUser}
              options={options}
              initial={initial}
              id={editing?.id}
              canSetPrimaryAdmin={me.privilege.isSuperAdmin}
            />
          )}
        </Card>
      )}

      <Card
        title={`Users (${users.length}${users.length === 100 ? "+" : ""})`}
        actions={
          <form className="flex gap-2">
            <Input name="q" defaultValue={q} placeholder="Search" className="w-56" />
            <button type="submit" className={buttonClass("secondary")}>
              Search
            </button>
          </form>
        }
      >
        <DataTable
          rows={users}
          rowKey={(u) => u.id}
          highlight={(u) => u.id === highlight}
          columns={[
            { header: "#", cell: (_, i) => i + 1 },
            { header: "Date", cell: (u) => formatDate(u.createdAt) },
            { header: "User ID", cell: (u) => u.userCode },
            {
              header: "Name",
              cell: (u) => (
                <span className="flex items-center gap-2">
                  {u.imageUrl ? (
                    <Image src={u.imageUrl} alt="" width={28} height={28} className="size-7 rounded-full object-cover" />
                  ) : (
                    <span className="flex size-7 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                      {u.firstName[0]}
                    </span>
                  )}
                  {fullName(u)}
                </span>
              ),
            },
            { header: "Username", cell: (u) => u.username },
            { header: "Mobile", cell: (u) => u.mobile },
            { header: "Privilege", cell: (u) => u.privilege.name },
            { header: "Department", cell: (u) => u.department.name },
            { header: "Branch", cell: (u) => u.branch?.code ?? "All" },
            { header: "Staff", cell: (u) => (u.createdBy ? fullName(u.createdBy) : "System") },
            {
              header: "Active Status",
              cell: (u) => <Badge tone={STATUS_TONE[u.status]}>{label(u.status)}</Badge>,
            },
            {
              header: "2 FA",
              cell: (u) => <FlagToggle on={u.twoFactorEnabled} label="Two-factor" action={bind(u.id, "twoFactorEnabled")} />,
            },
            {
              header: "Status",
              cell: (u) => (
                <FlagToggle
                  on={u.isLocked}
                  label={u.isLocked ? "Unlock user" : "Lock user"}
                  action={u.id === me.id ? undefined : bind(u.id, "isLocked")}
                >
                  {u.isLocked ? <Lock className="size-5 text-danger" /> : <LockOpen className="size-5 text-success" />}
                </FlagToggle>
              ),
            },
            {
              header: "Primary Admin",
              cell: (u) => (
                <FlagToggle
                  on={u.isPrimaryAdmin}
                  label="Primary admin"
                  action={me.privilege.isSuperAdmin && u.id !== me.id ? bind(u.id, "isPrimaryAdmin") : undefined}
                />
              ),
            },
            {
              header: "Enabled",
              cell: (u) => (
                <FlagToggle on={u.isActive} label="Enabled" action={u.id === me.id ? undefined : bind(u.id, "isActive")} />
              ),
            },
            {
              header: "Action",
              cell: (u) =>
                permission.canEdit && (
                  <Link
                    href={`${ADMIN_PATHS.users}?edit=${u.id}`}
                    className="inline-flex size-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted hover:text-text"
                    aria-label="Edit"
                  >
                    <Pencil className="size-4" />
                  </Link>
                ),
            },
          ]}
        />
      </Card>
    </AdminPage>
  );
}
