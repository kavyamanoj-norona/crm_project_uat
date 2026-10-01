import { cn } from "@/lib/cn";

type Tone = "neutral" | "success" | "warning" | "danger" | "primary" | "navy" | "violet" | "indigo";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-muted text-text-muted",
  success: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
  danger: "bg-danger/12 text-danger",
  primary: "bg-primary-soft text-primary",
  navy: "bg-brand-navy/10 text-brand-navy dark:bg-white/10 dark:text-text",
  violet: "bg-violet-500/12 text-violet-600 dark:text-violet-300",
  indigo: "bg-indigo-500/12 text-indigo-600 dark:text-indigo-300",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return <Badge tone={active ? "success" : "neutral"}>{active ? "Active" : "Inactive"}</Badge>;
}
