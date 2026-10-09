import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DetailItem } from "@/components/ui/detail-item";
import { DataTable } from "@/components/data/data-table";
import { ListView } from "@/components/data/list-view";
import { WhoWhen, personName } from "@/components/data/who-when";
import { listState } from "@/lib/list";
import { formatDate, formatDateTime } from "@/lib/dates";
import { enumLabel } from "@/lib/enum";
import { formatPaise } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { AdminPage } from "@/modules/admin/components/admin-page";
import { CUSTOMER_PATHS } from "@/modules/customers/paths";
import { HISTORY_SORTS, getCustomer, listCustomerCases, listRecordHistory } from "@/modules/customers/queries";
import { CUSTOMER_TYPE_LABELS, LEAD_SOURCE_LABELS, VIP_MIN_VISITS } from "@/modules/customers/schemas";
import { CASE_STATUS_LABELS, CASE_STATUS_TONE } from "@/modules/service/case-schema";
import { SERVICE_PATHS } from "@/modules/service/paths";
import { branchWhere, getBranchScope } from "@/server/branch-scope";
import { getMenuPermission, requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Customer details" };

const ACTION_LABELS: Record<string, string> = {
  "customer.create": "Created",
  "customer.update": "Edited",
  "customer.activate": "Activated",
  "customer.deactivate": "Deactivated",
};

export default async function CustomerDetailsPage({ params, searchParams }: PageProps<"/customers/database/[id]">) {
  const { user, permission } = await requirePageAccess(CUSTOMER_PATHS.database);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const list = listState(`${CUSTOMER_PATHS.database}/${id}`, sp, { sorts: HISTORY_SORTS, defaultSort: "at", defaultPageSize: 10 });
  const scope = await getBranchScope(user);

  const [customer, cases, history, casesPermission] = await Promise.all([
    getCustomer(id, scope),
    listCustomerCases(id, branchWhere(scope)),
    listRecordHistory(list, id),
    getMenuPermission(user, SERVICE_PATHS.cases),
  ]);
  if (!customer) notFound();

  return (
    <AdminPage
      title={customer.name}
      group="Customers & Support"
      subtitle={`${customer.code} · ${formatPhone(customer.phone)}${customer.visitCount >= VIP_MIN_VISITS ? ` · VIP (${customer.visitCount} visits)` : ""}`}
      actions={
        <>
          <LinkButton href={CUSTOMER_PATHS.database} variant="secondary">
            <ArrowLeft className="size-4" /> Back
          </LinkButton>
          {permission.canEdit && (
            <LinkButton href={`${CUSTOMER_PATHS.database}?edit=${customer.id}`}>
              <Pencil className="size-4" /> Edit
            </LinkButton>
          )}
        </>
      }
    >
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Details" className="xl:col-span-2">
          <div className="mb-4 flex flex-wrap gap-2">
            <Badge tone={customer.type === "BUSINESS" ? "primary" : "neutral"}>{CUSTOMER_TYPE_LABELS[customer.type]}</Badge>
            {!customer.isActive && <Badge tone="danger">Inactive</Badge>}
          </div>
          <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem term="Phone">{formatPhone(customer.phone)}</DetailItem>
            <DetailItem term="Alt phone">{customer.altPhone && formatPhone(customer.altPhone)}</DetailItem>
            <DetailItem term="Email">{customer.email}</DetailItem>
            {customer.type === "BUSINESS" && <DetailItem term="GSTIN">{customer.gstin}</DetailItem>}
            {customer.type === "BUSINESS" && <DetailItem term="Contact person">{customer.contactPerson}</DetailItem>}
            <DetailItem term="Source">{customer.source && LEAD_SOURCE_LABELS[customer.source]}</DetailItem>
            <DetailItem term="Visits">{customer.visitCount}</DetailItem>
            <DetailItem term="Last visit">{customer.lastVisitAt && formatDate(customer.lastVisitAt)}</DetailItem>
            <DetailItem term="State / District">{[customer.state, customer.district].filter(Boolean).join(", ")}</DetailItem>
            <DetailItem term="PIN code">{customer.pincode}</DetailItem>
            <DetailItem term="Address" className="sm:col-span-2">
              {customer.address}
            </DetailItem>
            <DetailItem term="Notes" className="sm:col-span-2 lg:col-span-3">
              {customer.notes}
            </DetailItem>
          </dl>
        </Card>

        <Card title="Record">
          <dl className="grid grid-cols-1 gap-5">
            <DetailItem term="Created">
              <WhoWhen by={customer.createdBy} at={customer.createdAt} time />
            </DetailItem>
            <DetailItem term="Last updated">
              <WhoWhen by={customer.updatedBy} at={customer.updatedAt} time />
            </DetailItem>
          </dl>
        </Card>
      </div>

      <Card title={`Cases${scope.branch ? ` — ${scope.branch.name}` : ""}`}>
        <DataTable
          rows={cases}
          rowKey={(c) => c.id}
          empty="No cases in this branch scope."
          columns={[
            {
              header: "Jobsheet",
              cell: (c) =>
                casesPermission.canView ? (
                  <Link href={`${SERVICE_PATHS.cases}/${c.id}`} className="font-medium text-primary hover:underline">
                    {c.jobsheetNo}
                  </Link>
                ) : (
                  c.jobsheetNo
                ),
            },
            { header: "Date", cell: (c) => formatDate(c.createdAt) },
            { header: "Device", cell: (c) => `${enumLabel(c.productType)} · ${[c.brand, c.model].filter(Boolean).join(" ")}` },
            { header: "Stage", cell: (c) => <Badge tone={CASE_STATUS_TONE[c.status]}>{CASE_STATUS_LABELS[c.status]}</Badge> },
            { header: "Estimate", align: "right", cell: (c) => formatPaise(c.estimatedCostPaise) },
            { header: "Branch", cell: (c) => c.branch.code },
          ]}
        />
      </Card>

      <h2 className="text-base font-semibold">Change history</h2>
      <ListView
        list={list}
        total={history.total}
        rows={history.rows}
        rowKey={(r) => r.id}
        empty="No changes recorded."
        columns={[
          { header: "Time", sort: "at", cell: (r) => formatDateTime(r.at) },
          { header: "By", cell: (r) => personName(r.user) ?? r.username ?? "System" },
          { header: "Action", cell: (r) => <Badge>{ACTION_LABELS[r.action] ?? r.action}</Badge> },
          { header: "Details", className: "whitespace-normal", cell: (r) => r.detail ?? "—" },
        ]}
      />
    </AdminPage>
  );
}
