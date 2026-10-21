import Link from "next/link";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ListView } from "@/components/data/list-view";
import { PageHeader } from "@/components/layout/page-header";
import { personName } from "@/components/data/who-when";
import { formatDate } from "@/lib/dates";
import { listState } from "@/lib/list";
import { formatAge } from "@/modules/service/case-age";
import { CASE_STATUS_LABELS, CASE_STATUS_TONE } from "@/modules/service/case-schema";
import { engineerCaseScope } from "@/modules/service/engineer-access";
import { ENGINEER_SORTS, listEngineerCases } from "@/modules/service/engineer-queries";
import { SERVICE_PATHS } from "@/modules/service/paths";
import { requirePageAccess } from "@/server/rbac/guard";
import { isEngineer } from "@/server/rbac/roles";

export const metadata = { title: "Engineer Workspace" };

export default async function EngineerWorkspacePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user } = await requirePageAccess(SERVICE_PATHS.engineer);
  const sp = await searchParams;
  const list = listState(SERVICE_PATHS.engineer, sp, { sorts: ENGINEER_SORTS, defaultSort: "stageChangedAt", defaultDir: "asc" });
  const { rows, total, tabs } = await listEngineerCases(list, await engineerCaseScope(user));
  const own = isEngineer(user);

  return (
    <>
      <PageHeader
        title="Engineer Workspace"
        subtitle={own ? "Cases assigned to you: diagnose them and complete the quality check" : "Cases with an engineer assigned in your branch scope"}
        breadcrumbs={["Service", "Engineer Workspace"]}
      />
      <ListView
        list={list}
        total={total}
        tabs={tabs}
        rows={rows}
        rowKey={(c) => c.id}
        searchPlaceholder="Search by jobsheet, customer or device"
        empty={own ? "No cases are assigned to you right now." : "No assigned cases."}
        columns={[
          { header: "#", cell: (_, i) => (list.page - 1) * list.pageSize + i + 1 },
          {
            header: "Jobsheet",
            sort: "jobsheetNo",
            cell: (c) => (
              <Link href={`${SERVICE_PATHS.engineer}/${c.id}`} className="font-semibold text-brand-navy hover:text-primary dark:text-text">
                {c.jobsheetNo}
              </Link>
            ),
          },
          { header: "Customer", cell: (c) => c.customer.name },
          { header: "Device", cell: (c) => <span className="whitespace-normal">{[c.brand, c.model].filter(Boolean).join(" ")}</span> },
          { header: "Problem reported", cell: (c) => <span className="line-clamp-2 max-w-xs whitespace-normal text-xs">{c.problemReported}</span> },
          { header: "Stage", cell: (c) => <Badge tone={CASE_STATUS_TONE[c.status]}>{CASE_STATUS_LABELS[c.status]}</Badge> },
          { header: "Diagnosis", align: "center", cell: (c) => <Badge tone={c.diagnosis ? "success" : "neutral"}>{c.diagnosis ? "Saved" : "Not yet"}</Badge> },
          ...(own ? [] : [{ header: "Engineer", cell: (c: (typeof rows)[number]) => personName(c.engineer) ?? "—" }]),
          { header: "Age", sort: "stageChangedAt", cell: (c) => <span className="whitespace-nowrap text-xs">{formatAge(Date.now() - c.stageChangedAt.getTime())}</span> },
          { header: "Received", sort: "createdAt", cell: (c) => <span className="whitespace-nowrap text-xs">{formatDate(c.createdAt)}</span> },
          {
            header: "Action",
            align: "center",
            cell: (c) => (
              <Link href={`${SERVICE_PATHS.engineer}/${c.id}`} aria-label={`Open ${c.jobsheetNo}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10">
                <Eye className="size-3.5" />
                Open
              </Link>
            ),
          },
        ]}
      />
    </>
  );
}
