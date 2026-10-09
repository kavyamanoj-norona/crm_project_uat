import { ChevronRight } from "lucide-react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  breadcrumbs?: string[];
  actions?: React.ReactNode;
  /** Shown next to the title, e.g. a status badge. */
  badges?: React.ReactNode;
};

export function PageHeader({ title, subtitle, breadcrumbs, actions, badges }: PageHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <ol className="mb-1 flex flex-wrap items-center gap-1 text-xs text-text-muted">
            {breadcrumbs.map((crumb, i) => (
              <li key={`${crumb}-${i}`} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="size-3" />}
                {crumb}
              </li>
            ))}
          </ol>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-black sm:text-[22px] text-brand-navy dark:text-text">{title}</h1>
          {badges}
        </div>
        {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
