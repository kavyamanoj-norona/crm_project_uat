import { db } from "@/server/db";
import { ActiveBadge, Badge } from "@/components/ui/badge";
import { ListView } from "@/components/data/list-view";
import { listState } from "@/lib/list";
import { saveRule } from "@/modules/admin/actions/save";
import { toggleActive } from "@/modules/admin/actions/toggle";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { EntityForm, type FieldConfig } from "@/modules/admin/components/entity-form";
import { RowActions } from "@/modules/admin/components/row-actions";
import { ADMIN_PATHS } from "@/modules/admin/paths";
import { RULE_SORTS, listRules } from "@/modules/admin/queries";
import { RULE_CATEGORIES, RULE_VALUE_TYPES, formatRuleValue } from "@/modules/admin/rule-schema";
import { label } from "@/modules/admin/user-schema";
import { formatDateTime } from "@/lib/dates";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Rules" };

const FIELDS: FieldConfig[] = [
  { name: "code", label: "Code", required: true, placeholder: "DISCOUNT_CAP_PERCENT", hint: "Used by the system to read this rule" },
  { name: "name", label: "Name", required: true, placeholder: "Discount cap before approval" },
  { name: "category", label: "Category", type: "select", required: true, options: RULE_CATEGORIES.map((c) => ({ value: c, label: c })) },
  {
    name: "valueType",
    label: "Value type",
    type: "select",
    required: true,
    options: RULE_VALUE_TYPES.map((t) => ({ value: t, label: label(t) })),
  },
  { name: "value", label: "Value", required: true, hint: "Number, or true / false for Yes-No rules" },
  { name: "description", label: "Description", span: 2 },
  { name: "isActive", label: "Active", type: "switch" },
];

export default async function RulesPage({ searchParams }: PageProps<"/admin/rules">) {
  const { permission } = await requirePageAccess(ADMIN_PATHS.rules);
  const sp = await searchParams;
  const list = listState(ADMIN_PATHS.rules, sp, { sorts: RULE_SORTS, defaultSort: "category", defaultDir: "asc" });
  const editId = param(sp, "edit");
  const [{ rows, total, tabs }, editing] = await Promise.all([
    listRules(list),
    editId && permission.canEdit ? db.rule.findUnique({ where: { id: editId } }) : null,
  ]);

  return (
    <AdminPage
      title="Rules"
      subtitle="Limits the system enforces — discount caps, GST, turnaround times and sign-in security."
      saved={param(sp, "saved")}
      form={
        (editing ? permission.canEdit : permission.canCreate)
          ? {
              label: "Add Rule",
              editingTitle: editing?.name,
              cancelHref: ADMIN_PATHS.rules,
              content: (
                <EntityForm
                  fields={FIELDS}
                  schema="rule" action={saveRule}
                  id={editing?.id}
                  initial={editing ?? { isActive: true, category: list.tab || "General", valueType: "NUMBER" }}
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
        rowKey={(r) => r.id}
        highlight={(r) => r.id === editing?.id}
        searchPlaceholder="Search rule…"
        empty="No rules yet."
        columns={[
          { header: "#", cell: (_, i) => i + 1 },
          {
            header: "Rule",
            sort: "name",
            className: "whitespace-normal min-w-64",
            cell: (r) => (
              <span>
                <span className="block font-medium">{r.name}</span>
                {r.description && <span className="block text-xs text-text-muted">{r.description}</span>}
              </span>
            ),
          },
          { header: "Category", sort: "category", cell: (r) => <Badge>{r.category}</Badge> },
          {
            header: "Value",
            cell: (r) => <span className="font-semibold text-primary">{formatRuleValue(r.valueType, r.value)}</span>,
          },
          { header: "Code", sort: "code", cell: (r) => <code className="text-xs">{r.code}</code> },
          {
            header: "Updated",
            sort: "updatedAt",
            cell: (r) => (
              <span className="text-xs text-text-muted">
                {formatDateTime(r.updatedAt)}
                {r.updatedBy ? ` · ${r.updatedBy.firstName}` : ""}
              </span>
            ),
          },
          { header: "Status", cell: (r) => <ActiveBadge active={r.isActive} /> },
          {
            header: "Action",
            cell: (r) =>
              permission.canEdit && (
                <RowActions editHref={`${ADMIN_PATHS.rules}?edit=${r.id}`} toggle={toggleActive.bind(null, "rule", r.id)} active={r.isActive} />
              ),
          },
        ]}
      />
    </AdminPage>
  );
}
