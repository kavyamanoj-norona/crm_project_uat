import { requireUser } from "@/server/auth/session";

export default async function SettingsLayout({ children }: LayoutProps<"/settings">) {
  await requireUser();
  return <>{children}</>;
}
