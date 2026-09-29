import { cn } from "@/lib/cn";

/** Inline success / error banner for form results and ?saved=1 flashes. */
export function FormMessage({ ok, message }: { ok?: boolean; message?: string }) {
  if (!message) return null;
  return (
    <p
      role={ok ? "status" : "alert"}
      className={cn(
        "rounded-lg px-3 py-2 text-sm",
        ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
      )}
    >
      {message}
    </p>
  );
}
