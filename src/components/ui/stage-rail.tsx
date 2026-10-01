import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";

export type RailStage = {
  key: string;
  label: string;
  /** Rendered icon element for a stage not reached yet. */
  icon: React.ReactNode;
  /** Under the label of a completed stage, e.g. when it was reached. */
  caption?: string;
};

type StageRailProps = {
  stages: RailStage[];
  /** Key of the current stage; stages before it show as done. */
  current: string;
  /** Stopped at the current stage (e.g. cancelled): it shows red with this caption. */
  stoppedLabel?: string;
  /** Caption under the current stage when not stopped. */
  currentLabel?: string;
};

/** Lifecycle stepper: ✓ done · ● current · icon upcoming, joined by a progress line. */
export function StageRail({ stages, current, stoppedLabel, currentLabel = "In progress" }: StageRailProps) {
  const at = stages.findIndex((s) => s.key === current);

  return (
    <ol className="flex overflow-x-auto pb-1" aria-label="Stages">
      {stages.map((s, i) => {
        const state = i < at ? "done" : i === at ? "now" : "todo";
        const stopped = state === "now" && Boolean(stoppedLabel);
        return (
          <li
            key={s.key}
            aria-current={state === "now" ? "step" : undefined}
            className="relative flex min-w-28 flex-1 flex-col items-center text-center"
          >
            {/* line to the next stage: full blue when passed, half blue out of the current one */}
            {i < stages.length - 1 && (
              <span aria-hidden className="absolute top-[18px] left-[calc(50%+24px)] right-[calc(-50%+24px)] h-1 rounded-full bg-border">
                <span
                  className={cn(
                    "block h-full rounded-full",
                    state === "done" && "w-full bg-primary",
                    state === "now" && !stopped && "w-1/2 bg-brand-navy dark:bg-primary",
                  )}
                />
              </span>
            )}
            <span
              className={cn(
                "relative flex size-10 items-center justify-center rounded-full [&_svg]:size-4",
                state === "done" && "bg-success text-white ring-4 ring-success/20",
                state === "now" && !stopped && "bg-brand-navy text-white ring-4 ring-brand-navy/15 dark:bg-primary",
                stopped && "bg-danger text-white ring-4 ring-danger/20",
                state === "todo" && "bg-surface-muted text-text-muted",
              )}
            >
              {state === "done" ? (
                <Check className="stroke-3" />
              ) : stopped ? (
                <X className="stroke-3" />
              ) : state === "now" ? (
                <span className="size-3 rounded-full bg-white" />
              ) : (
                s.icon
              )}
            </span>
            <span
              className={cn(
                "mt-2 text-sm",
                state === "done" && "font-semibold text-success",
                state === "now" && (stopped ? "font-semibold text-danger" : "font-semibold text-brand-navy dark:text-text"),
                state === "todo" && "text-text-muted",
              )}
            >
              {s.label}
            </span>
            {state === "done" && s.caption && <span className="text-xs text-text-muted">{s.caption}</span>}
            {state === "now" && (
              <span className={cn("text-xs font-medium", stopped ? "text-danger" : "text-primary")}>{stoppedLabel ?? currentLabel}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
