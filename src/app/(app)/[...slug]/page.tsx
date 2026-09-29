import { notFound, redirect } from "next/navigation";
import { Construction } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { requireUser } from "@/server/auth/session";
import { getNavigation } from "@/server/navigation/get-navigation";
import { resolveRoute } from "@/server/navigation/resolve-route";

// Catch-all for every menu path stored in the database. Real screens get their
// own route folder (e.g. app/(app)/service/cases/page.tsx), which takes
// precedence over this placeholder.
export default async function MenuPlaceholderPage({ params }: PageProps<"/[...slug]">) {
  const { slug } = await params;
  const pathname = `/${slug.join("/")}`;

  const user = await requireUser();
  const nav = await getNavigation(user);
  const route = await resolveRoute(user, nav, pathname);

  if (route.status === "redirect") redirect(route.to);
  if (route.status === "forbidden") redirect("/forbidden");
  if (route.status === "not-found") notFound();

  const crumbs = [route.module.title, route.groupTitle, route.itemTitle].filter(
    (c): c is string => Boolean(c),
  );
  const flags = Object.entries(route.permission).filter(([, v]) => v).map(([k]) => k.replace(/^can/, ""));

  return (
    <>
      <PageHeader title={route.itemTitle} breadcrumbs={crumbs} />
      <div className="rounded-(--radius) border border-border bg-surface p-8 text-center">
        <Construction className="mx-auto size-10 text-primary" />
        <h2 className="mt-4 text-lg font-semibold">This screen is not built yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-text-muted">
          It shows up because the <strong>{user.privilege.name}</strong> privilege has access to menu{" "}
          <code className="rounded bg-surface-muted px-1.5 py-0.5 text-xs">{route.menuCode}</code>.
        </p>
        <p className="mt-3 text-xs text-text-muted">Permissions: {flags.join(" · ")}</p>
      </div>
    </>
  );
}
