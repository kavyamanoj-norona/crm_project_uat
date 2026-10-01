import Link from "next/link";
import { Clock, Eye, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { FilterSelect } from "@/components/data/filter-select";
import { ListView } from "@/components/data/list-view";
import { WhoWhen, personName } from "@/components/data/who-when";
import { listState } from "@/lib/list";
import { formatPaise } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { enumLabel } from "@/lib/enum";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { caseAge } from "@/modules/service/case-age";
import { CASE_KIND_LABELS, CASE_STATUS_LABELS, CASE_STATUS_TONE } from "@/modules/service/case-schema";
import { SERVICE_PATHS } from "@/modules/service/paths";
import { CASE_SORTS, CASE_TYPE_FILTERS, getTatLimits, isCaseTypeFilter, listCases } from "@/modules/service/queries";
import { branchWhere, getBranchScope } from "@/server/branch-scope";
import { getMenuPermission, requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Cases" };

const iconLink =
  "inline-flex size-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted hover:text-text";

export default async function CasesPage({ searchParams }: PageProps<"/service/cases">) {
  const { user } = await requirePageAccess(SERVICE_PATHS.cases);
  const sp = await searchParams;
  const list = listState(SERVICE_PATHS.cases, sp, { sorts: CASE_SORTS, defaultSort: "createdAt", defaultPageSize: 25 });
  const type = param(sp, "type");
  const scope = await getBranchScope(user);
  const [{ rows, total, tabs }, intake, tat] = await Promise.all([
    listCases(list, branchWhere(scope), isCaseTypeFilter(type) ? type : undefined),
    getMenuPermission(user, SERVICE_PATHS.newCase),
    getTatLimits(),
  ]);
  const highlight = param(sp, "highlight");
  const now = new Date();

  return (
    <AdminPage
      title={scope.branch ? `Cases — ${scope.branch.name}` : "Cases — all branches"}
      group="Service"
      subtitle={
        scope.canSwitch
          ? "Pick a branch in the header to see only its cases"
          : "Branch-bound: you only see your own branch's cases"
      }
      actions={
        intake.canCreate && (
          <LinkButton href={SERVICE_PATHS.newCase}>
            <Plus className="size-4" /> New case
          </LinkButton>
        )
      }
    >
      <ListView
        list={list}
        total={total}
        tabs={tabs}
        rows={rows}
        rowKey={(c) => c.id}
        highlight={(c) => c.id === highlight}
        searchPlaceholder="Search jobsheet / customer / phone / serial…"
        empty="No cases yet."
        toolbar={
          <FilterSelect
            className="sm:w-48"
            param="type"
            label="Type"
            path={list.path}
            query={list.query}
            prefix={list.prefix}
            value={isCaseTypeFilter(type) ? type : ""}
            options={[
              { value: "", label: "Type: All" },
              ...Object.entries(CASE_TYPE_FILTERS).map(([value, f]) => ({ value, label: `Type: ${f.label}` })),
            ]}
          />
        }
        columns={[
          { header: "#", cell: (_, i) => i + 1 },
          {
            header: "Jobsheet",
            sort: "jobsheetNo",
            cell: (c) => (
              <Link href={`${SERVICE_PATHS.cases}/${c.id}`} className="font-semibold text-brand-navy hover:text-primary dark:text-text">
                {c.jobsheetNo}
              </Link>
            ),
          },
          {
            header: "Customer",
            cell: (c) => (
              <span className="flex flex-col leading-tight">
                <span className="flex items-center gap-2 font-medium">
                  {c.customer.name}
                  {c.customer.type === "BUSINESS" && <Badge tone="navy">B2B</Badge>}
                </span>
                <span className="text-xs text-text-muted">{formatPhone(c.customer.phone)}</span>
              </span>
            ),
          },
          {
            header: "Device",
            cell: (c) => (
              <span className="flex items-center gap-2">
                {[c.brand, c.model].filter(Boolean).join(" ")}
                {c.productType !== "LAPTOP" && <span className="text-text-muted">({enumLabel(c.productType)})</span>}
                {c.warrantyStatus !== "NON_WARRANTY" && <Badge tone="warning">{CASE_KIND_LABELS[c.warrantyStatus]}</Badge>}
              </span>
            ),
          },
          {
            header: "Stage",
            sort: "status",
            cell: (c) => <Badge tone={CASE_STATUS_TONE[c.status]}>{CASE_STATUS_LABELS[c.status]}</Badge>,
          },
          { header: "Engineer", cell: (c) => personName(c.engineer) ?? <span className="text-text-muted">Unassigned</span> },
          {
            header: "Due ₹",
            align: "right",
            cell: (c) => {
              if (c.estimatedCostPaise === null) return <span className="text-text-muted">—</span>;
              const paid = c.payments.reduce((sum, p) => sum + p.amountPaise, 0);
              return <span className="font-semibold tabular-nums">{formatPaise(Math.max(0, c.estimatedCostPaise - paid))}</span>;
            },
          },
          {
            header: "Age",
            sort: "stageChangedAt",
            cell: (c) => {
              const age = caseAge(c.status, c.stageChangedAt, tat, now);
              if (!age) return <span className="text-text-muted">—</span>;
              return age.overdue ? (
                <Badge tone="danger">
                  <Clock className="size-3" /> {age.label}
                </Badge>
              ) : (
                age.label
              );
            },
          },
          ...(scope.branchId ? [] : [{ header: "Branch", cell: (c: (typeof rows)[number]) => c.branch.code }]),
          { header: "Created", sort: "createdAt", cell: (c) => <WhoWhen by={c.createdBy} at={c.createdAt} /> },
          {
            header: "Action",
            cell: (c) => (
              <Link href={`${SERVICE_PATHS.cases}/${c.id}`} className={iconLink} aria-label="View" title="View">
                <Eye className="size-4" />
              </Link>
            ),
          },
        ]}
      />
    </AdminPage>
  );
}
