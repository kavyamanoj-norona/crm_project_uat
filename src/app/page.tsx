import { redirect } from "next/navigation";
import { findActiveItem } from "@/lib/navigation";
import { requireUser } from "@/server/auth/session";
import { getNavigation } from "@/server/navigation/get-navigation";

// "/" sends the user to their default module, else their privilege's home,
// else the first page they can see.
export default async function Home() {
  const user = await requireUser();
  const nav = await getNavigation(user);

  const defaultModule = nav.find((m) => m.id === user.defaultModuleId);
  if (defaultModule) redirect(defaultModule.href);

  const home = user.privilege.homePath;
  if (home && findActiveItem(nav, home)) redirect(home);

  redirect(nav[0]?.href ?? "/forbidden");
}
