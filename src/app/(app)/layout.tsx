import { AppShell } from "@/components/layout/app-shell";
import { logout } from "@/server/auth/actions";
import { requireUser } from "@/server/auth/session";
import { getNavigation } from "@/server/navigation/get-navigation";
import { setBranchScope } from "@/server/branch-actions";
import { getBranchScope, listBranchOptions } from "@/server/branch-scope";

function istGreeting(name: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(new Date()),
  );
  const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  return `Good ${part}, ${name.split(" ")[0]}`;
}

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const [nav, scope] = await Promise.all([getNavigation(user), getBranchScope(user)]);
  const options = scope.canSwitch ? await listBranchOptions() : [];

  return (
    <AppShell
      nav={nav}
      user={{ name: user.name, username: user.username, roleName: user.privilege.name }}
      greeting={istGreeting(user.name)}
      logout={logout}
      branch={{ canSwitch: scope.canSwitch, current: scope.branch, options, setBranch: setBranchScope }}
    >
      {children}
    </AppShell>
  );
}
