import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { db } from "@/server/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DetailItem } from "@/components/ui/detail-item";
import { LinkButton } from "@/components/ui/button";
import { ListView } from "@/components/data/list-view";
import { listState } from "@/lib/list";
import { activityColumns } from "@/modules/admin/components/activity-columns";
import { ACTIVITY_SORTS, listActivity } from "@/modules/admin/queries";
import { AdminPage } from "@/modules/admin/components/admin-page";
import { ADMIN_PATHS } from "@/modules/admin/paths";
import { STATUS_TONE, label } from "@/modules/admin/user-schema";
import { formatDate, formatDateTime } from "@/lib/dates";
import { requirePageAccess } from "@/server/rbac/guard";
import { getBranchScope } from "@/server/branch-scope";

export const metadata = { title: "User details" };

export default async function UserDetailsPage({ params, searchParams }: PageProps<"/admin/users/[id]">) {
  const { user: me, permission } = await requirePageAccess(ADMIN_PATHS.users);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const list = listState(`${ADMIN_PATHS.users}/${id}`, sp, { sorts: ACTIVITY_SORTS, defaultSort: "at", defaultPageSize: 10 });

  const [user, activity] = await Promise.all([
    db.user.findUnique({
      where: { id },
      include: {
        company: { select: { name: true } },
        branch: { select: { name: true, code: true } },
        domain: { select: { name: true } },
        department: { select: { name: true } },
        privilege: { select: { name: true, isSuperAdmin: true } },
        defaultModule: { select: { title: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    }),
    listActivity(list, id),
  ]);
  // Outside the header branch → 404, so other branches' records don't leak (blueprint §10).
  const scope = await getBranchScope(me);
  if (!user || (scope.branchId && user.branchId !== scope.branchId)) notFound();

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const autoLocked = user.lockedUntil !== null && user.lockedUntil > new Date();

  return (
    <AdminPage
      title={name}
      subtitle={`${user.userCode} · @${user.username}`}
      actions={
        <>
          <LinkButton href={ADMIN_PATHS.users} variant="secondary">
            <ArrowLeft className="size-4" /> Back
          </LinkButton>
          {permission.canEdit && (
            <LinkButton href={`${ADMIN_PATHS.users}?edit=${user.id}`}>
              <Pencil className="size-4" /> Edit
            </LinkButton>
          )}
        </>
      }
    >
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <div className="flex flex-col items-center text-center">
            {user.imageUrl ? (
              <Image src={user.imageUrl} alt="" width={96} height={96} className="size-24 rounded-full object-cover" />
            ) : (
              <span className="flex size-24 items-center justify-center rounded-full bg-primary-soft text-3xl font-semibold text-primary">
                {user.firstName[0]}
              </span>
            )}
            <p className="mt-3 text-lg font-semibold">{name}</p>
            <p className="text-sm text-text-muted">{user.privilege.name}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Badge tone={STATUS_TONE[user.status]}>{label(user.status)}</Badge>
              {!user.isActive && <Badge tone="neutral">Disabled</Badge>}
              {(user.isLocked || autoLocked) && <Badge tone="danger">Locked</Badge>}
              {user.twoFactorEnabled && <Badge tone="success">2FA</Badge>}
            </div>
            {autoLocked && (
              <p className="mt-2 text-xs text-danger">
                Locked after failed sign-ins until {formatDateTime(user.lockedUntil)}
              </p>
            )}
          </div>
        </Card>

        <Card title="Details" className="xl:col-span-2">
          <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem term="Mobile">{user.mobile}</DetailItem>
            <DetailItem term="Email">{user.email}</DetailItem>
            <DetailItem term="Gender">{user.gender && label(user.gender)}</DetailItem>
            <DetailItem term="Date of birth">{user.dob && formatDate(user.dob)}</DetailItem>
            <DetailItem term="Marital status">{user.maritalStatus && label(user.maritalStatus)}</DetailItem>
            <DetailItem term="Joining date">{user.joiningDate && formatDate(user.joiningDate)}</DetailItem>
            <DetailItem term="Company">{user.company.name}</DetailItem>
            <DetailItem term="Branch">{user.branch ? `${user.branch.name} (${user.branch.code})` : "All branches"}</DetailItem>
            <DetailItem term="Domain / Department">{`${user.domain.name} · ${user.department.name}`}</DetailItem>
            <DetailItem term="Default module">{user.defaultModule?.title}</DetailItem>
            <DetailItem term="State / District">{[user.state, user.district].filter(Boolean).join(", ")}</DetailItem>
            <DetailItem term="Address">{user.address}</DetailItem>
            <DetailItem term="Last sign-in">{user.lastLoginAt && formatDateTime(user.lastLoginAt)}</DetailItem>
            <DetailItem term="Created">
              {formatDateTime(user.createdAt)}
              {user.createdBy ? ` by ${user.createdBy.firstName}` : ""}
            </DetailItem>
          </dl>
        </Card>
      </div>

      <h2 className="text-base font-semibold">Activity</h2>
      <ListView
        list={list}
        total={activity.total}
        tabs={activity.tabs}
        rows={activity.rows}
        rowKey={(r) => r.id}
        searchPlaceholder="Search action or IP…"
        empty="No activity recorded yet."
        columns={activityColumns({ showUser: false })}
      />
    </AdminPage>
  );
}
