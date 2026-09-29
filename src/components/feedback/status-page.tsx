import Link from "next/link";

type Action = { href: string; label: string };

type StatusPageProps = {
  code: string;
  title: string;
  message: string;
  primary?: Action;
  secondary?: Action;
};

/** Shared layout behind 404 / 403 / 500 / maintenance (blueprint §9). */
export function StatusPage({ code, title, message, primary, secondary }: StatusPageProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl font-bold text-primary">{code}</p>
      <h1 className="mt-4 text-2xl font-semibold">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-text-muted">{message}</p>
      <div className="mt-6 flex gap-3">
        {primary && (
          <Link
            href={primary.href}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            {primary.label}
          </Link>
        )}
        {secondary && (
          <Link
            href={secondary.href}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-muted"
          >
            {secondary.label}
          </Link>
        )}
      </div>
    </div>
  );
}
