import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/cn";

export type StatTone = "primary" | "success" | "warning" | "danger" | "violet" | "indigo" | "navy" | "muted";

const iconTones: Record<StatTone, string> = {
  primary: "bg-primary-soft text-primary",
  success: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
  danger: "bg-danger/12 text-danger",
  violet: "bg-violet-500/12 text-violet-600 dark:text-violet-300",
  indigo: "bg-indigo-500/12 text-indigo-600 dark:text-indigo-300",
  navy: "bg-brand-navy/10 text-brand-navy dark:bg-white/10 dark:text-text",
  muted: "bg-surface-muted text-text-muted",
};

const noteTones = { default: "text-text", muted: "text-text-muted", success: "text-success", warning: "text-warning", danger: "text-danger" };

type StatCardProps = {
  label: string;
  value: React.ReactNode;
  /** Rendered icon element, e.g. <Wrench />. */
  icon: React.ReactNode;
  iconTone?: StatTone;
  /** Small caption next to the label, e.g. "now" for a live snapshot. */
  hint?: string;
  /** Line under the value. `trend` adds ▲/▼. */
  note?: { text: string; tone?: keyof typeof noteTones; trend?: "up" | "down" };
  /** Red edge and value — for "needs attention" numbers. */
  alert?: boolean;
  /** Every number clicks through to its list. */
  href?: string;
};

/** KPI tile: label · big value · note, with a tinted icon. */
export function StatCard({ label, value, icon, iconTone = "primary", hint, note, alert, href }: StatCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">
          {label}
          {hint && <span className="ml-1.5 rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium normal-case">{hint}</span>}
        </p>
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5", iconTones[alert ? "danger" : iconTone])}>
          {icon}
        </span>
      </div>
      <p className={cn("-mt-2 text-3xl font-bold tabular-nums", alert ? "text-danger" : "text-brand-navy dark:text-text")}>{value}</p>
      {note && (
        <p className={cn("mt-1.5 flex items-center gap-1 text-sm font-medium", noteTones[note.tone ?? "default"])}>
          {note.trend === "up" && <TrendingUp className="size-4" aria-label="Up" />}
          {note.trend === "down" && <TrendingDown className="size-4" aria-label="Down" />}
          {note.text}
        </p>
      )}
    </>
  );

  const cls = cn(
    "block rounded-xl border border-border bg-surface p-5 shadow-sm transition-colors",
    alert && "border-l-4 border-l-danger",
    href && "hover:border-primary focus-visible:border-primary",
  );
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
