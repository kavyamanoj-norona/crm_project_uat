"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, ChevronRight, FileText, Loader2, MessageSquare, Send } from "lucide-react";
import { toast } from "@/components/feedback/toast";
import { Button } from "@/components/ui/button";
import { ModalButton } from "@/components/ui/modal-button";
import { formatPaise } from "@/lib/money";
import type { ActionResult } from "@/lib/form";
import { useDrafts } from "./billing-draft";
import { ChipApprovalPreview } from "./chip-approval-preview";

type Props = {
  /** Chip-level service: the customer is quoted the maximum estimate, with the dead-risk warning if it applies. */
  chip?: { maxEstimatePaise: number; deadRisk: boolean };
  caseId: string;
  jobsheetNo: string;
  branchName: string;
  device: string;
  /** Customer-facing lines: category and price only, never the item name or code. */
  lines: { category: string; quantity: number; totalPaise: number }[];
  totalPaise: number;
  gstInclusive: boolean;
  /** Server action already bound to the case: moves it to Pending approval and notifies the customer. */
  send: () => Promise<ActionResult>;
};

/** What the customer's phone will show: a demo, nothing on it is clickable. */
function PhonePreview({ jobsheetNo, branchName, device, lines, totalPaise, gstInclusive }: Omit<Props, "send" | "caseId">) {
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
        <div className="flex gap-1">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i < 2 ? "bg-primary" : i === 2 ? "bg-primary/50" : "bg-slate-200"}`} />
          ))}
        </div>
        <p className="text-[11px] text-slate-500">
          Status: <span className="font-semibold text-slate-700">Quote ready</span> — please approve or reject it.
        </p>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-bold">Quotation — {formatPaise(totalPaise)}</p>
          <p className="mt-1 text-[11px] leading-snug text-slate-500">
            {lines.map((l) => `${l.category}${l.quantity > 1 ? ` ×${l.quantity}` : ""} ${formatPaise(l.totalPaise)}`).join(" · ")}
            {gstInclusive ? " · GST incl." : " · GST extra"}
          </p>
          <div className="mt-3 rounded-lg bg-primary py-2 text-center text-sm font-bold text-white">Approve quote</div>
          <div className="mt-2 rounded-lg border border-red-300 py-2 text-center text-sm font-bold text-red-600">Reject</div>
        </div>

        {[
          { icon: FileText, label: "Acceptance form (PDF)" },
          { icon: MessageSquare, label: "Talk to branch" },
          { icon: AlertTriangle, label: "Raise a concern" },
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

function Body({ send, onDone, ...preview }: Props & { onDone: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const confirm = () =>
    start(async () => {
      setError(null);
      try {
        const res = await send();
        if (res.ok) {
          toast.success(res.message);
          onDone();
        } else {
          setError(res.message);
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        This is how the quote will look to the customer. Confirming sends it and moves the case to <strong className="text-text">Pending approval</strong>.
      </p>
      {preview.chip ? (
        <ChipApprovalPreview
          jobsheetNo={preview.jobsheetNo}
          branchName={preview.branchName}
          device={preview.device}
          maxEstimatePaise={preview.chip.maxEstimatePaise}
          deadRisk={preview.chip.deadRisk}
        />
      ) : (
        <PhonePreview {...preview} />
      )}
      {error && <p className="rounded-md bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone} disabled={pending}>
          Close
        </Button>
        <Button variant="navy" onClick={confirm} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Confirm & send quote
        </Button>
      </div>
    </div>
  );
}

/** "Send quote to customer": shows the customer's view first; confirming sends the quote and moves the case on. */
export function QuotePreviewDialog(props: Props) {
  // Billed amounts edited but not saved: the quote would show the old prices, so it can't go out yet.
  const unsaved = Object.keys(useDrafts(props.caseId)).length > 0;
  return (
    <ModalButton
      disabled={unsaved}
      disabledReason="Save your billed amount changes before sending the quote"
      trigger={
        <>
          <Send className="size-4" /> {props.chip ? "Send for Customer Approval" : "Send quote to customer"}
        </>
      }
      variant="navy"
      title={`Send quote — ${props.jobsheetNo}`}
      size="md"
    >
      {(close) => <Body {...props} onDone={close} />}
    </ModalButton>
  );
}
