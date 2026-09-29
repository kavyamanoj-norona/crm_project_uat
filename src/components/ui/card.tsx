import { cn } from "@/lib/cn";

type CardProps = {
  title?: string;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

export function Card({ title, actions, className, children }: CardProps) {
  return (
    <section className={cn("rounded-xl border border-border bg-surface p-5 shadow-sm", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
