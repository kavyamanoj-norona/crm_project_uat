import { db } from "@/server/db";
import { Card } from "@/components/ui/card";
import { FlashToast } from "@/components/feedback/flash-toast";
import { PageHeader } from "@/components/layout/page-header";
import { param } from "@/modules/admin/components/admin-page";
import { PermissionMatrix, type MatrixModule } from "@/modules/admin/components/permission-matrix";
import { PrivilegeSelector } from "@/modules/admin/components/privilege-selector";
import { ADMIN_PATHS } from "@/modules/admin/paths";
import { listModulesWithMenus } from "@/modules/admin/queries";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Rules" };

export default async function RulesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { permission } = await requirePageAccess(ADMIN_PATHS.rules);
  const sp = await searchParams;
  const privilegeId = typeof sp.privilege === "string" ? sp.privilege : undefined;
  const selectedModuleId = typeof sp.module === "string" ? sp.module : undefined;
  const saved = param(sp, "saved");

  // Always load privileges for the selector
  const privileges = await db.privilege.findMany({
    where: { isActive: true, isSuperAdmin: false },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });

  // Load permission matrix if a privilege is selected
  let matrix: MatrixModule[] | null = null;
  let selectedPrivilege: { id: string; name: string } | null = null;

  if (privilegeId) {
    const [privilege, modules] = await Promise.all([
      db.privilege.findUnique({ where: { id: privilegeId }, include: { permissions: true } }),
      listModulesWithMenus(),
    ]);

    if (privilege) {
      selectedPrivilege = { id: privilege.id, name: privilege.name };
      const granted = new Map(privilege.permissions.map((p) => [p.menuId, p]));
      const groups = (m: Awaited<ReturnType<typeof listModulesWithMenus>>[number]) =>
        new Map(m.menus.filter((x) => x.type === "GROUP").map((g) => [g.id, g]));

      matrix = modules.map((m) => {
        const groupMap = groups(m);
        return {
          id: m.id,
          title: m.title,
          icon: m.icon,
          isActive: m.isActive,
          items: m.menus
            .filter((x) => x.type === "ITEM" && x.path)
            .map((x) => {
              const p = granted.get(x.id);
              return {
                id: x.id,
                title: x.title,
                path: x.path!,
                groupTitle: x.parentId ? groupMap.get(x.parentId)?.title : undefined,
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
    }
  }

  return (
    <>
      <FlashToast flag={saved} message="Permissions saved." />
      <PageHeader
        title="Rules"
        subtitle="Set which menus and actions each privilege can access."
        breadcrumbs={["Master Settings", "Rules"]}
      />

      <div className="space-y-5">
        {/* Selector bar */}
        <PrivilegeSelector
          privileges={privileges}
          selectedId={privilegeId}
          selectedPrivilegeName={selectedPrivilege?.name}
          modules={matrix ? matrix.map((m) => ({ id: m.id, title: m.title })) : undefined}
          selectedModuleId={selectedModuleId}
        />

        {/* Matrix or empty state */}
        {matrix && selectedPrivilege ? (
          <Card>
            <PermissionMatrix
              key={privilegeId}
              modules={matrix}
              privilegeId={selectedPrivilege.id}
              readOnly={!permission.canEdit}
              privilegeName={selectedPrivilege.name}
              allModules={matrix.map((m) => ({ id: m.id, title: m.title }))}
              selectedModuleId={selectedModuleId}
              showSelectorBar={false}
            />
          </Card>
        ) : (
          <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-border bg-surface text-sm text-text-muted">
            No privilege selected. Please choose one.
          </div>
        )}
      </div>
    </>
  );
}
