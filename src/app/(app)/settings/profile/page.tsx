import { db } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { updateProfile } from "@/server/settings/actions";
import { formatDate, formatDateTime } from "@/lib/dates";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: {
      mobile: true,
      userCode: true,
      firstName: true,
      lastName: true,
      email: true,
      username: true,
      imageUrl: true,
      joiningDate: true,
      lastLoginAt: true,
      createdAt: true,
      branch: { select: { name: true } },
      department: { select: { name: true } },
    },
  });

  const initial = {
    username: dbUser?.username ?? user.username,
    firstName: dbUser?.firstName ?? "",
    lastName: dbUser?.lastName ?? "",
    email: dbUser?.email ?? user.email,
    mobile: dbUser?.mobile ?? "",
    userCode: dbUser?.userCode ?? user.userCode,
    imageUrl: dbUser?.imageUrl ?? null,
    roleName: user.privilege.name,
    branchName: dbUser?.branch?.name ?? "All branches",
    departmentName: dbUser?.department?.name ?? "—",
    memberSince: formatDate(dbUser?.joiningDate ?? dbUser?.createdAt ?? null),
    lastSignIn: dbUser?.lastLoginAt ? formatDateTime(dbUser.lastLoginAt) : "—",
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-brand-navy dark:text-text">Profile</h1>
        <p className="text-sm text-text-muted">Your photo and personal details. They appear across the CRM.</p>
      </div>
      <ProfileForm action={updateProfile} initial={initial} />
    </div>
  );
}
