import { AdminPage } from "@/modules/admin/components/admin-page";
import {
  CASE_STATUS_LABELS,
  CASE_STATUS_TONE,
} from "@/modules/service/case-schema";
import type { CaseStatusValue } from "@/modules/service/case-schema";
import { SERVICE_PATHS } from "@/modules/service/paths";
import { listTatConfigs, TAT_STAGES } from "@/modules/service/tat-queries";
import { saveTatConfig } from "@/modules/service/actions/tat";
import {
  TatConfigPanel,
  type TatRow,
} from "@/modules/service/components/tat-config-panel";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "TAT Configuration" };

export default async function TatConfigPage() {
  const { permission } = await requirePageAccess(SERVICE_PATHS.tatConfig);

  const configs = await listTatConfigs();
  const configMap = new Map(
    configs.map((c) => [
      c.status,
      {
        targetValue: c.targetValue,
        targetUnit: c.targetUnit,
        warningThreshold: c.warningThreshold,
        escalationThreshold: c.escalationThreshold,
        isActive: c.isActive,
        remarks: c.remarks,
      },
    ]),
  );

  const rows: TatRow[] = TAT_STAGES.map((status) => ({
    status,
    stageName: CASE_STATUS_LABELS[status as CaseStatusValue],
    stageTone: CASE_STATUS_TONE[status as CaseStatusValue],
    config: configMap.get(status) ?? null,
  }));

  return (
    <AdminPage
      title="TAT Configuration"
      group="Service"
      subtitle="Define the expected turnaround time for each workflow stage. These targets drive the Ageing Analysis."
    >
      <TatConfigPanel
        rows={rows}
        action={saveTatConfig}
        canEdit={permission.canEdit}
      />
      {!permission.canEdit && (
        <p className="mt-3 text-xs text-text-muted">
          You have read-only access. Contact an admin to change TAT targets.
        </p>
      )}
    </AdminPage>
  );
}
