"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, FlaskConical, Loader2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { initialFormState, type ActionResult, type FormState } from "@/lib/form";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { Button, buttonClass } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { ModalButton } from "@/components/ui/modal-button";
import { qcAnswerError, type QcAnswer } from "../qc-answer-schema";

/** One checklist point and its saved answer for this QC round. */
export type QcPanelItem = {
  id: string;
  title: string;
  description: string | null;
  answer: { passed: boolean; remarks: string | null } | null;
};

/** What happens after the checklist is saved, in the same popup. */
export type QcNextStep = {
  /** Name of the next stage, e.g. "Ready for delivery". */
  label: string;
  move: () => Promise<ActionResult>;
  /** Send the device to the chip-level lab (HO) because QC found an issue. */
  sendBack?: (prev: FormState, formData: FormData) => Promise<FormState>;
  /** The case has been to the lab before, so this is a send-back rather than a first transfer. */
  cameFromLab?: boolean;
};

type QcChecklistDialogProps = {
  trigger: React.ReactNode;
  /** Style of the button that opens the popup; "navy" when it stands in for a stage button. */
  triggerVariant?: "primary" | "navy" | "secondary";
  jobsheetNo: string;
  items: QcPanelItem[];
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  /** Adds step 2 (move on / send back) after the checklist is saved. */
  next?: QcNextStep;
};

export function QcChecklistDialog({ trigger, triggerVariant = "secondary", jobsheetNo, items, action, next }: QcChecklistDialogProps) {
  return (
    <ModalButton
      trigger={trigger}
      variant={triggerVariant}
      size="xl"
      title={`Quality Check — ${jobsheetNo}`}
      description={
        next
          ? "Complete the checklist, then choose what happens next. Remarks are required when the answer is No."
          : "Complete the checklist before moving this case on. Remarks are required when the answer is No."
      }
    >
      {(close) => <QcFlow items={items} action={action} next={next} onDone={close} />}
    </ModalButton>
  );
}

function QcFlow({
  items,
  action,
  next,
  onDone,
}: Pick<QcChecklistDialogProps, "items" | "action" | "next"> & { onDone: () => void }) {
  const [step, setStep] = useState<"check" | "next">("check");
  const [answers, setAnswers] = useState<QcAnswer[]>(() =>
    items.map((i) => ({
      itemId: i.id,
      passed: (i.answer ? (i.answer.passed ? "yes" : "no") : "") as QcAnswer["passed"],
      remarks: i.answer?.remarks ?? "",
    })),
  );

  if (items.length === 0) {
    return <p className="text-sm text-text-muted">No checklist items are set up. Add them under Manage → QC Checklist.</p>;
  }

  return (
    <div className="space-y-4">
      {next && (
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Step {step === "check" ? 1 : 2} of 2 · {step === "check" ? "Checklist" : "Next step"}
        </p>
      )}
      {step === "check" ? (
        <ChecklistStep
          items={items}
          answers={answers}
          setAnswers={setAnswers}
          action={action}
          hasNext={Boolean(next)}
          onSaved={() => (next ? setStep("next") : onDone())}
          onClose={onDone}
        />
      ) : (
        next && <NextStep next={next} answers={answers} onBack={() => setStep("check")} onDone={onDone} />
      )}
    </div>
  );
}

function ChecklistStep({
  items,
  answers,
  setAnswers,
  action,
  hasNext,
  onSaved,
  onClose,
}: {
  items: QcPanelItem[];
  answers: QcAnswer[];
  setAnswers: React.Dispatch<React.SetStateAction<QcAnswer[]>>;
  action: QcChecklistDialogProps["action"];
  hasNext: boolean;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const [showErrors, setShowErrors] = useState(false);

  const { onSubmit, onChange } = useFormFeedback({
    state,
    validate: () => {
      setShowErrors(true);
      const problem = answers.map(qcAnswerError).find(Boolean);
      return problem ? { answers: [problem] } : null;
    },
  });

  useEffect(() => {
    if (state.ok) onSaved();
    // run once per server response
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const set = (i: number, patch: Partial<QcAnswer>) =>
    setAnswers((prev) => prev.map((a, j) => (j === i ? { ...a, ...patch } : a)));

  return (
    <form action={formAction} onSubmit={onSubmit} onChange={onChange} noValidate className="space-y-4">
      <input type="hidden" name="answers" value={JSON.stringify(answers)} />

      <ul className="divide-y divide-border rounded-lg border border-border">
        {items.map((item, i) => {
          const a = answers[i]!;
          const rowError = showErrors ? qcAnswerError(a) : null;
          return (
            <li key={item.id} className="space-y-2 px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.description && <p className="text-xs text-text-muted">{item.description}</p>}
                </div>
                <div className="flex gap-2" role="group" aria-label={`${item.title} answer`}>
                  <button
                    type="button"
                    aria-pressed={a.passed === "yes"}
                    onClick={() => set(i, { passed: "yes" })}
                    className={cn(
                      buttonClass("secondary", "sm"),
                      "min-w-16",
                      a.passed === "yes" && "border-success bg-success text-white hover:bg-success",
                    )}
                  >
                    <Check className="size-3.5" /> Yes
                  </button>
                  <button
                    type="button"
                    aria-pressed={a.passed === "no"}
                    onClick={() => set(i, { passed: "no" })}
                    className={cn(
                      buttonClass("secondary", "sm"),
                      "min-w-16",
                      a.passed === "no" && "border-danger bg-danger text-white hover:bg-danger",
                    )}
                  >
                    <X className="size-3.5" /> No
                  </button>
                </div>
              </div>

              <Input
                value={a.remarks}
                onChange={(e) => set(i, { remarks: e.target.value })}
                placeholder={a.passed === "no" ? "Enter remarks (required)" : "Enter remarks (optional)"}
                aria-label={`${item.title} remarks`}
                aria-invalid={rowError ? true : undefined}
              />
              {rowError && <p className="text-xs text-danger">{rowError}</p>}
            </li>
          );
        })}
      </ul>

      {state.message && !state.ok && <p className="rounded-md bg-danger/5 px-3 py-2 text-sm text-danger">{state.message}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {hasNext ? (
            <>
              Save & continue <ArrowRight className="size-4" />
            </>
          ) : (
            "Save checklist"
          )}
        </Button>
      </div>
    </form>
  );
}

function NextStep({
  next,
  answers,
  onBack,
  onDone,
}: {
  next: QcNextStep;
  answers: QcAnswer[];
  onBack: () => void;
  onDone: () => void;
}) {
  const [outcome, setOutcome] = useState<"next" | "lab">("next");
  const [state, formAction, pending] = useActionState(async (prev: FormState, fd: FormData): Promise<FormState> => {
    if (fd.get("outcome") === "lab" && next.sendBack) return next.sendBack(prev, fd);
    const r = await next.move();
    return { ok: r.ok, message: r.message };
  }, initialFormState);
  const { onSubmit, onChange } = useFormFeedback({ state });

  useEffect(() => {
    if (state.ok) onDone();
    // run once per server response
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const noCount = answers.filter((a) => a.passed === "no").length;

  return (
    <form action={formAction} onSubmit={onSubmit} onChange={onChange} className="space-y-4">
      <p className="rounded-md bg-success/5 px-3 py-2 text-sm text-success">
        Checklist saved · {answers.length - noCount} Yes{noCount > 0 ? ` · ${noCount} No` : ""}
      </p>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">What happens next?</legend>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-4 py-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
          <input
            type="radio"
            name="outcome"
            value="next"
            checked={outcome === "next"}
            onChange={() => setOutcome("next")}
            className="mt-1 accent-primary"
          />
          <span>
            <span className="block text-sm font-medium">Move to {next.label}</span>
            <span className="block text-xs text-text-muted">The device passed quality check.</span>
          </span>
        </label>
        {next.sendBack && (
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-4 py-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
            <input
              type="radio"
              name="outcome"
              value="lab"
              checked={outcome === "lab"}
              onChange={() => setOutcome("lab")}
              className="mt-1 accent-primary"
            />
            <span>
              <span className="block text-sm font-medium">
                {next.cameFromLab ? "Send back to Chip-Level Lab (HO)" : "Send to Chip-Level Lab (HO)"}
              </span>
              <span className="block text-xs text-text-muted">
                {next.cameFromLab
                  ? "QC failed — the device returns to the lab for further repair."
                  : "A new issue was found — the device goes to the chip-level lab for board-level repair."}
              </span>
            </span>
          </label>
        )}
      </fieldset>

      {outcome === "lab" && next.sendBack && (
        <div>
          <label htmlFor="qc-note" className="mb-1 block text-sm font-medium">
            Reason / Note
          </label>
          <Textarea id="qc-note" name="note" rows={2} placeholder="Enter reason" />
          <p className="mt-1 text-xs text-text-muted">Optional — shown on the timeline</p>
        </div>
      )}

      {state.message && !state.ok && <p className="rounded-md bg-danger/5 px-3 py-2 text-sm text-danger">{state.message}</p>}

      <div className="flex justify-between gap-2">
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft className="size-4" /> Back to checklist
        </Button>
        <Button type="submit" variant="navy" disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : outcome === "lab" ? (
            <FlaskConical className="size-4" />
          ) : (
            <ArrowRight className="size-4" />
          )}
          {outcome === "lab" ? (next.cameFromLab ? "Confirm send-back" : "Confirm send to lab") : `Move to ${next.label}`}
        </Button>
      </div>
    </form>
  );
}
