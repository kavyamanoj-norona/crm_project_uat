import { LinkButton } from "@/components/ui/button";
import { BackButton } from "./back-button";
import { StatusIllustration, type IllustrationKind } from "./status-illustration";

type Action = { href: string; label: string };

type StatusPageProps = {
  code: string;
  kind: IllustrationKind;
  title: string;
  message: string;
  primary?: Action;
  /** Adds a "Go back" button next to the primary action. */
  showBack?: boolean;
};

/** Shared layout behind 404 / 403 / 500 / maintenance (blueprint §9). */
export function StatusPage({ code, kind, title, message, primary, showBack }: StatusPageProps) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-10 text-center">
      <StatusIllustration code={code} kind={kind} />
      <h1 className="mt-6 text-2xl font-semibold text-text">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-text-muted">{message}</p>
      {(primary || showBack) && (
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {primary && <LinkButton href={primary.href}>{primary.label}</LinkButton>}
          {showBack && <BackButton />}
        </div>
      )}
    </div>
  );
}
