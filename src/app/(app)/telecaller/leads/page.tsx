import Link from "next/link";
import { Eye, UserCheck } from "lucide-react";
import { db } from "@/server/db";
import { Badge } from "@/components/ui/badge";
import { ListView } from "@/components/data/list-view";
import { WhoWhen, personName } from "@/components/data/who-when";
import { ActionDialog } from "@/components/forms/action-dialog";
import { listState } from "@/lib/list";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatPaise, paiseToInput } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { EntityForm, type FieldConfig } from "@/modules/admin/components/entity-form";
import { RowActions } from "@/modules/admin/components/row-actions";
import { convertLeadWithConfirm, deleteLead, saveLead } from "@/modules/customers/lead-actions";
import { CUSTOMER_PATHS } from "@/modules/customers/paths";
import { LEAD_SOURCE_LABELS, leadEntrySourceOptions } from "@/modules/customers/schemas";
import { INTAKE_TYPE_LABELS, intakeTypeOptions } from "@/modules/service/case-schema";
import { bulkConvertLeads } from "@/modules/telecaller/actions";
import { BulkConvert, BULK_FORM_ID, SelectAllLeads } from "@/modules/telecaller/components/bulk-convert";
import { toDateInput, toDateTimeInput, tatDays } from "@/modules/telecaller/format";
import { TELECALLER_LEAD_SORTS, listStaffOptions, listTelecallers, listTelecallerLeads } from "@/modules/telecaller/queries";
import { leadStatusOptions } from "@/modules/telecaller/schemas";
import { CALL_OUTCOME_LABELS, LEAD_STATUS_LABELS, LEAD_STATUS_TONE, type CallOutcomeValue, type LeadStatusValue } from "@/modules/telecaller/status";
import { getBranchScope, leadWhere } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";
import { isTelecaller } from "@/server/rbac/roles";

export const metadata = { title: "Leads" };

const staffLabel = (u: { firstName: string; lastName: string | null }) => [u.firstName, u.lastName].filter(Boolean).join(" ");

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user, permission } = await requirePageAccess(CUSTOMER_PATHS.leads);
  const scope = await getBranchScope(user);
  const sp = await searchParams;
  const list = listState(CUSTOMER_PATHS.leads, sp, { sorts: TELECALLER_LEAD_SORTS, defaultSort: "createdAt", defaultPageSize: 25 });
  const editId = param(sp, "edit");
  const highlight = param(sp, "highlight") ?? editId;
  const bound = user.privilege.isBranchBound;

  const [{ rows, total, tabs }, editing, branches, staff, telecallers] = await Promise.all([
    listTelecallerLeads(list, scope, isTelecaller(user) ? user.id : null),
    editId && permission.canEdit
      ? db.customer.findFirst({ where: { AND: [{ id: editId, leadCode: { not: null } }, leadWhere(scope)] }, include: { leadProfile: true } })
      : null,
    db.branch.findMany({ where: { isActive: true, isVirtual: false }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    listStaffOptions(),
    listTelecallers(),
  ]);
  const branchOptions = branches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` }));
  const canBulk = permission.canEdit && !bound;

  const fields: FieldConfig[] = [
    { name: "name", label: "Customer name", required: true, placeholder: "Enter customer name" },
    { name: "phone", label: "Mobile number", required: true, placeholder: "Enter mobile number" },
    { name: "email", label: "Email", type: "email", placeholder: "Enter email" },
    { name: "source", label: "Source", type: "select", placeholder: "Select source", options: leadEntrySourceOptions },
    { name: "purpose", label: "Reported issue", type: "textarea", required: true, span: 2, placeholder: "Enter reported issue" },
    { name: "notes", label: "Remarks", type: "textarea", span: 2, placeholder: "Enter remarks" },
    ...(bound ? [] : [{ name: "branchId", label: "Branch", type: "select" as const, placeholder: "Select branch", options: branchOptions, hint: "Handing a lead to a branch puts it on that branch's call list" }]),
    { name: "serviceMode", label: "Service mode", type: "select", placeholder: "Select service mode", options: intakeTypeOptions },
    { name: "appointmentAt", label: "Appointment", type: "datetime-local" },
    { name: "status", label: "Status", type: "select", placeholder: "Select status", options: leadStatusOptions },
    { name: "tokenNo", label: "Token number", placeholder: "Enter token number" },
    { name: "walkInDate", label: "Walk-in date", type: "date" },
    { name: "billingDate", label: "Billing date", type: "date" },
    { name: "purchaseCost", label: "Purchase cost ₹", placeholder: "Enter purchase cost" },
    { name: "margin", label: "Margin ₹", placeholder: "Enter margin" },
    { name: "salesPersonId", label: "Sales person", type: "select", placeholder: "Select sales person", searchable: true, options: staff.map((u) => ({ value: u.id, label: staffLabel(u) })) },
    ...(bound ? [] : [{ name: "assignedTelecallerId", label: "Telecaller", type: "select" as const, placeholder: "Select telecaller", options: telecallers.map((u) => ({ value: u.id, label: staffLabel(u) })) }]),
  ];

  const p = editing?.leadProfile;
  const initial = editing
    ? {
        name: editing.name,
        phone: editing.phone,
        email: editing.email ?? "",
        source: editing.source ?? "",
        purpose: editing.purpose ?? "",
        notes: editing.notes ?? "",
        branchId: editing.branchId ?? "",
        serviceMode: p?.serviceMode ?? "",
        appointmentAt: toDateTimeInput(p?.appointmentAt),
        status: p?.status ?? "",
        tokenNo: p?.tokenNo ?? "",
        walkInDate: toDateInput(p?.walkInDate),
        billingDate: toDateInput(p?.billingDate),
        purchaseCost: paiseToInput(p?.purchaseCostPaise),
        margin: paiseToInput(p?.marginPaise),
        salesPersonId: p?.salesPersonId ?? "",
        assignedTelecallerId: p?.assignedTelecallerId ?? "",
      }
    : undefined;

  return (
    <AdminPage
      title="Leads"
      group="Telecaller"
      subtitle={`${tabs[0]?.count ?? 0} open leads · ${scope.branch ? `${scope.branch.name} (${scope.branch.code})` : "all branches"} · website enquiries arrive here automatically`}
      saved={param(sp, "saved")}
      form={
        (editing ? permission.canEdit : permission.canCreate)
          ? {
              label: "Add Lead",
              editingTitle: editing ? `${editing.name} (${editing.leadCode})` : undefined,
              cancelHref: CUSTOMER_PATHS.leads,
              content: (
                <EntityForm
                  fields={fields}
                  schema="lead"
                  action={saveLead}
                  initial={initial}
                  id={editing?.id}
                  cancelHref={CUSTOMER_PATHS.leads}
                  submitLabel={editing ? "Update" : "Save lead"}
                />
              ),
            }
          : undefined
      }
    >
      <ListView
        list={list}
        total={total}
        tabs={tabs}
        rows={rows}
        rowKey={(l) => l.id}
        highlight={(l) => l.id === highlight}
        searchPlaceholder="Search by name, mobile, lead ID, issue or token"
        empty="No leads here yet."
        toolbar={canBulk ? <BulkConvert branches={branchOptions} action={bulkConvertLeads} /> : undefined}
        columns={[
          ...(canBulk
            ? [
                {
                  header: "Select",
                  headerNode: <SelectAllLeads />,
                  align: "center" as const,
                  cell: (l: (typeof rows)[number]) => (
                    <input type="checkbox" name="ids" value={l.id} form={BULK_FORM_ID} disabled={l.kind !== "LEAD"} aria-label={`Select ${l.name}`} className="size-4 accent-primary" />
                  ),
                },
              ]
            : []),
          { header: "#", cell: (_, i) => (list.page - 1) * list.pageSize + i + 1 },
          { header: "Created", sort: "createdAt", cell: (l) => formatDate(l.createdAt) },
          {
            header: "Lead ID",
            sort: "code",
            cell: (l) => (
              <Link href={`${CUSTOMER_PATHS.leads}/${l.id}`} className="font-semibold text-brand-navy hover:text-primary dark:text-text">
                {l.leadCode}
              </Link>
            ),
          },
          { header: "Customer", sort: "name", cell: (l) => <span className="font-medium">{l.name}</span> },
          { header: "Mobile", sort: "phone", cell: (l) => formatPhone(l.phone) },
          { header: "Reported issue", cell: (l) => <span className="block max-w-56 truncate" title={l.purpose ?? undefined}>{l.purpose ?? "—"}</span> },
          { header: "Branch", cell: (l) => (l.branch ? `${l.branch.name} (${l.branch.code})` : <span className="text-text-muted">Unassigned</span>) },
          {
            header: "Status",
            cell: (l) => {
              const s = (l.leadProfile?.status ?? (l.kind === "CUSTOMER" ? "CONVERTED" : "NEW")) as LeadStatusValue;
              return <Badge tone={LEAD_STATUS_TONE[s]}>{LEAD_STATUS_LABELS[s]}</Badge>;
            },
          },
          { header: "Service mode", cell: (l) => (l.leadProfile?.serviceMode ? INTAKE_TYPE_LABELS[l.leadProfile.serviceMode] : "—") },
          { header: "Appointment", cell: (l) => <span className="whitespace-nowrap">{l.leadProfile?.appointmentAt ? formatDateTime(l.leadProfile.appointmentAt) : "—"}</span> },
          {
            header: "Next follow-up",
            sort: "followUp",
            cell: (l) => {
              const at = l.leadProfile?.nextFollowUpAt;
              if (!at) return <span className="text-text-muted">—</span>;
              return <span className={`whitespace-nowrap ${at.getTime() < Date.now() ? "font-semibold text-danger" : ""}`}>{formatDateTime(at)}</span>;
            },
          },
          { header: "Last call", cell: (l) => (l.leadProfile?.lastOutcome ? CALL_OUTCOME_LABELS[l.leadProfile.lastOutcome as CallOutcomeValue] : "—") },
          { header: "Walk-in", cell: (l) => formatDate(l.leadProfile?.walkInDate) },
          { header: "Billing", cell: (l) => formatDate(l.leadProfile?.billingDate) },
          { header: "Token", cell: (l) => l.leadProfile?.tokenNo ?? "—" },
          { header: "Purchase cost", align: "right", cell: (l) => <span className="tabular-nums">{l.leadProfile?.purchaseCostPaise != null ? formatPaise(l.leadProfile.purchaseCostPaise) : "—"}</span> },
          { header: "Margin", align: "right", cell: (l) => <span className="tabular-nums">{l.leadProfile?.marginPaise != null ? formatPaise(l.leadProfile.marginPaise) : "—"}</span> },
          {
            header: "TAT",
            align: "right",
            cell: (l) => {
              const d = l.leadProfile ? tatDays(l.leadProfile.firstInteractionAt, l.createdAt, l.leadProfile.billingDate) : null;
              return d === null ? "—" : `${d}d`;
            },
          },
          { header: "First interaction", cell: (l) => <span className="whitespace-nowrap">{formatDate(l.leadProfile?.firstInteractionAt ?? l.createdAt)}</span> },
          { header: "Sales person", cell: (l) => personName(l.leadProfile?.salesPerson) ?? "—" },
          { header: "Telecaller", cell: (l) => personName(l.leadProfile?.assignedTelecaller) ?? <span className="text-text-muted">Unassigned</span> },
          { header: "Source", cell: (l) => (l.source ? LEAD_SOURCE_LABELS[l.source] : "—") },
          { header: "Remarks", cell: (l) => <span className="block max-w-48 truncate" title={l.notes ?? undefined}>{l.notes ?? "—"}</span> },
          { header: "Created by", cell: (l) => <WhoWhen by={l.createdBy} at={l.createdAt} /> },
          {
            header: "Action",
            cell: (l) => (
              <RowActions
                editHref={permission.canEdit ? `${CUSTOMER_PATHS.leads}?edit=${l.id}` : undefined}
                remove={permission.canEdit && l.kind === "LEAD" ? deleteLead.bind(null, l.id) : undefined}
              >
                <Link href={`${CUSTOMER_PATHS.leads}/${l.id}`} className="inline-flex size-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted hover:text-text" aria-label="View lead" title="View lead">
                  <Eye className="size-4" />
                </Link>
                {permission.canEdit && l.kind === "LEAD" && l.isActive && (
                  <ActionDialog
                    trigger={
                      <>
                        <UserCheck className="size-4" /> Convert
                      </>
                    }
                    title={`Convert ${l.name} to customer`}
                    description={`${l.leadCode} becomes a customer on the same record. Nothing is duplicated and the Lead ID and call history are kept.`}
                    action={convertLeadWithConfirm.bind(null, l.id)}
                    submitLabel="Convert to customer"
                  >
                    <p className="text-sm text-text-muted">
                      {l.name} · {formatPhone(l.phone)}
                      {l.purpose ? ` · ${l.purpose}` : ""}
                    </p>
                  </ActionDialog>
                )}
                {l.kind === "CUSTOMER" && (
                  <Link href={`${CUSTOMER_PATHS.database}/${l.id}`} className="text-xs font-medium text-primary hover:underline">
                    {l.code}
                  </Link>
                )}
              </RowActions>
            ),
          },
        ]}
      />
      <p className="mt-3 text-xs text-text-muted">TAT is first interaction to billing. Statuses move on their own as leads are converted, walk in and are billed.</p>
    </AdminPage>
  );
}
