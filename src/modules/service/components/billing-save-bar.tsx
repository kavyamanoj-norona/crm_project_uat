"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import type { ActionResult } from "@/lib/form";
import { Button } from "@/components/ui/button";
import { billedError } from "./billed-amount-cell";
import { clearDrafts, useDrafts } from "./billing-draft";

type BillingSaveBarProps = {
  caseId: string;
  /** Minimum selling price (paise) per editable line id. */
  minByItem: Record<string, number>;
  /** saveBilledAmounts bound to the case. */
  action: (lines: { id: string; unitPrice: string }[]) => Promise<ActionResult>;
};

/** "Save changes" under the billing table: shows while any billed amount is edited and saves them all together. */
export function BillingSaveBar({ caseId, minByItem, action }: BillingSaveBarProps) {
  const drafts = useDrafts(caseId);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const entries = Object.entries(drafts);
  if (entries.length === 0) return null;

  const invalid = entries.some(([id, text]) => billedError(text, minByItem[id] ?? 0));
  const save = () =>
    start(async () => {
      const res = await action(entries.map(([id, unitPrice]) => ({ id, unitPrice })));
      if (res.ok) {
        clearDrafts(caseId);
        setMessage("");
      } else setMessage(res.message ?? "Could not save the changes.");
    });

  return (
    <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
      <p className="text-xs text-text-muted" role="status">
        {message ? <span className="text-danger">{message}</span> : "Unsaved billed amount changes — save them before sending the quote."}
      </p>
      <Button onClick={save} disabled={pending || invalid}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Save changes
      </Button>
    </div>
  );
}
