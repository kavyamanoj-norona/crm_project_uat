import { db } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { updateProfile } from "@/server/settings/actions";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { mobile: true, userCode: true, firstName: true, lastName: true, email: true, username: true },
  });

  const initial = {
    username: dbUser?.username ?? user.username,
    firstName: dbUser?.firstName ?? "",
    lastName: dbUser?.lastName ?? "",
    email: dbUser?.email ?? user.email,
    mobile: dbUser?.mobile ?? "",
    userCode: dbUser?.userCode ?? user.userCode,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-brand-navy dark:text-text">Profile</h1>
        <p className="text-sm text-text-muted">Update your personal details.</p>
      </div>
      <div className="rounded-xl border border-border bg-surface p-5">
        <ProfileForm action={updateProfile} initial={initial} />
      </div>
    </div>
  );
}
