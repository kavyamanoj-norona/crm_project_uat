import { ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/data/data-table";
import { formatDateTime } from "@/lib/dates";
import type { FormState } from "@/lib/form";
import type { QcPanelRow } from "../qc-response-queries";
import { QcChecklistDialog } from "./qc-checklist-panel";

type QcChecklistCardProps = {
  jobsheetNo: string;
  rows: QcPanelRow[];
  /** Omit for a view-only card. */
  action?: (prev: FormState, formData: FormData) => Promise<FormState>;
  canEdit: boolean;
};

/** Saved QC answers as a table, with the button that opens the checklist popup. */
export function QcChecklistCard({ jobsheetNo, rows, action, canEdit }: QcChecklistCardProps) {
  const pending = rows.filter((r) => r.answer === null).length;
  const complete = rows.length > 0 && pending === 0;

  return (
    <Card
      title="Quality Check checklist"
      actions={
        <div className="flex items-center gap-3">
          <Badge tone={complete ? "success" : "warning"}>
            {rows.length === 0 ? "No items set up" : complete ? "Completed" : `${pending} pending`}
          </Badge>
          {canEdit && action && rows.length > 0 && (
            <QcChecklistDialog
              trigger={
                <>
                  <ClipboardCheck className="size-3.5" /> {complete ? "Edit checklist" : "Fill checklist"}
                </>
              }
              jobsheetNo={jobsheetNo}
              items={rows}
              action={action}
            />
          )}
        </div>
      }
    >
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        empty="No checklist items are set up. Add them under Manage → QC Checklist."
        columns={[
          { header: "Checklist item", cell: (r) => <span className="font-medium">{r.title}</span> },
          {
            header: "Answer",
            cell: (r) =>
              r.answer ? (
                <Badge tone={r.answer.passed ? "success" : "danger"}>{r.answer.passed ? "Yes" : "No"}</Badge>
              ) : (
                <Badge tone="warning">Pending</Badge>
              ),
          },
          { header: "Remarks", cell: (r) => <span className="text-xs">{r.answer?.remarks ?? "—"}</span> },
          {
            header: "Done by",
            cell: (r) =>
              r.answer ? (
                <div className="text-xs">
                  <span className="font-medium">{r.answer.by ?? "—"}</span>
                  <span className="block text-text-muted">{formatDateTime(new Date(r.answer.at))}</span>
                </div>
              ) : (
                "—"
              ),
          },
        ]}
      />
      {!complete && action && rows.length > 0 && (
        <p className="mt-3 text-xs text-text-muted">Complete the checklist to move this case to the next stage.</p>
      )}
    </Card>
  );
}
