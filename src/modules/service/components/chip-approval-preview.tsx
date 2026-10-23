import { AlertTriangle, ChevronRight, FileText, MessageSquare } from "lucide-react";
import { formatPaise } from "@/lib/money";

type Props = {
  jobsheetNo: string;
  branchName: string;
  device: string;
  /** The most the repair is expected to cost, in paise. */
  maxEstimatePaise: number | null;
  /** The device may be beyond repair. */
  deadRisk: boolean;
};

/** What the customer's phone will show for a chip-level repair quote: a demo, nothing on it is clickable. */
export function ChipApprovalPreview({ jobsheetNo, branchName, device, maxEstimatePaise, deadRisk }: Props) {
  return (
    <div aria-hidden className="mx-auto w-full max-w-[19rem] select-none overflow-hidden rounded-[2rem] border-[6px] border-brand-navy bg-white shadow-lg">
      <div className="bg-brand-navy px-4 py-3 text-center text-white">
        <p className="text-sm font-bold">Laptop Clinic</p>
        <p className="text-[11px] text-white/70">
          Jobsheet {jobsheetNo} · {branchName}
        </p>
      </div>
      <div className="space-y-3 px-4 py-4 text-slate-800">
        <p className="text-base font-bold">{device || "Your device"}</p>
        <p className="text-[11px] text-slate-500">
          Status: <span className="font-semibold text-slate-700">Approval needed</span> — your device needs a board-level (chip-level) repair.
        </p>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-bold">Chip-level repair — up to {maxEstimatePaise !== null ? formatPaise(maxEstimatePaise) : "—"}</p>
          <p className="mt-1 text-[11px] leading-snug text-slate-500">
            Maximum estimate for the repair. The final bill will not go above this amount.
          </p>
          {deadRisk && (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" />
              <p className="text-[11px] leading-snug text-red-700">
                <span className="font-bold">Dead risk:</span> this device may be beyond repair. The repair may not succeed.
              </p>
            </div>
          )}
          <div className="mt-3 rounded-lg bg-primary py-2 text-center text-sm font-bold text-white">Approve repair</div>
          <div className="mt-2 rounded-lg border border-red-300 py-2 text-center text-sm font-bold text-red-600">Reject</div>
        </div>

        {[
          { icon: FileText, label: "Acceptance form (PDF)" },
          { icon: MessageSquare, label: "Talk to branch" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
            <Icon className="size-4 text-slate-500" />
            <span className="flex-1">{label}</span>
            <ChevronRight className="size-4 text-slate-400" />
          </div>
        ))}
      </div>
    </div>
  );
}
