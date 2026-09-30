"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { StatusIllustration } from "@/components/feedback/status-illustration";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error); // TODO: report to Sentry (blueprint §15)
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-10 text-center">
      <StatusIllustration code="500" kind="error" />
      <h1 className="mt-6 text-2xl font-semibold text-text">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-text-muted">
        We couldn&apos;t load this page. Try again, and if it keeps happening share the reference below with support.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-text-muted">
          Reference: <code className="rounded bg-surface-muted px-1.5 py-0.5">{error.digest}</code>
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={() => retry()}>Try again</Button>
        <LinkButton href="/" variant="secondary">
          Back to home
        </LinkButton>
      </div>
    </div>
  );
}
