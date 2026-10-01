import { cn } from "@/lib/cn";

type FormSectionProps = {
  /** Step number shown in the badge, e.g. 1. */
  step?: number;
  title: string;
  hint?: string;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

/** A titled card that groups related fields of a long form (Customer · Product · Cost …). */
export function FormSection({ step, title, hint, actions, className, children }: FormSectionProps) {
  return (
    <section className={cn("rounded-xl border border-border bg-surface shadow-sm", className)}>
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
        {step !== undefined && (
          <span className="flex size-5 items-center justify-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground">
            {step}
          </span>
        )}
        <h2 className="text-[15px] font-extrabold text-brand-navy dark:text-text">{title}</h2>
        {hint && <span className="text-xs text-text-muted">— {hint}</span>}
        {actions && <div className="ml-auto">{actions}</div>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}
