import { ChevronRight } from "lucide-react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  breadcrumbs?: string[];
  actions?: React.ReactNode;
};

export function PageHeader({ title, subtitle, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
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
        <h1 className="text-2xl font-semibold text-text">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
