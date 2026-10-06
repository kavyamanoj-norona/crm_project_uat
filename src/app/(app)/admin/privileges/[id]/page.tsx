import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/server/db";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { PermissionMatrix, type MatrixModule } from "@/modules/admin/components/permission-matrix";
import { ADMIN_PATHS } from "@/modules/admin/paths";
import { listModulesWithMenus } from "@/modules/admin/queries";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Permissions" };

export default async function PrivilegePermissionsPage({ params, searchParams }: PageProps<"/admin/privileges/[id]">) {
  const { permission } = await requirePageAccess(ADMIN_PATHS.privileges);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const selectedModuleId = sp.module as string | undefined;

  const privilege = await db.privilege.findUnique({ where: { id }, include: { permissions: true } });
  if (!privilege) notFound();

  const modules = await listModulesWithMenus();
  const granted = new Map(privilege.permissions.map((p) => [p.menuId, p]));

  const matrix: MatrixModule[] = modules.map((m) => {
    const groups = new Map(m.menus.filter((x) => x.type === "GROUP").map((g) => [g.id, g]));
    // Top-level items and groups in sort order, each group followed by its items.
    const ordered = m.menus
      .filter((x) => x.parentId === null)
      .flatMap((x) => (x.type === "GROUP" ? m.menus.filter((c) => c.parentId === x.id) : [x]));
    return {
      id: m.id,
      title: m.title,
      icon: m.icon,
      isActive: m.isActive,
      items: ordered
        .filter((x) => x.type === "ITEM" && x.path)
        .map((x) => {
          const p = granted.get(x.id);
          return {
            id: x.id,
            title: x.title,
            path: x.path!,
            groupTitle: x.parentId ? groups.get(x.parentId)?.title : undefined,
            flags: {
              canView: p?.canView ?? false,
              canCreate: p?.canCreate ?? false,
              canEdit: p?.canEdit ?? false,
              canDelete: p?.canDelete ?? false,
              canApprove: p?.canApprove ?? false,
            },
          };
        }),
    };
  });

  return (
    <AdminPage
      title={`${privilege.name} — permissions`}
      subtitle="Tick View to show a menu in the sidebar. Modules and groups appear automatically when any item inside is visible."
      saved={param(sp, "saved")}
      actions={
        <LinkButton href={ADMIN_PATHS.privileges} variant="secondary">
          <ArrowLeft className="size-4" /> Back
        </LinkButton>
      }
    >
      <Card>
        {privilege.isSuperAdmin ? (
          <p className="text-sm text-text-muted">
            <strong>{privilege.name}</strong> is a super-admin privilege: it sees every active module and menu, so there
            is nothing to configure here.
          </p>
        ) : (
          <PermissionMatrix
            key={privilege.id}
            modules={matrix}
            privilegeId={privilege.id}
            readOnly={!permission.canEdit}
            privilegeName={privilege.name}
            allModules={modules.map((m) => ({ id: m.id, title: m.title }))}
            selectedModuleId={selectedModuleId}
          />
        )}
      </Card>
    </AdminPage>
  );
}
