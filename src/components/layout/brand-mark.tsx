import { cn } from "@/lib/cn";

type BrandMarkProps = {
  /** "dark": on the navy sidebar (navy halves drawn white). "light": on white. */
  on?: "dark" | "light";
  size?: number;
  className?: string;
};

/**
 * The CRM logo. On the navy sidebar it uses CRM-logo-dark.png (the same mark with its dark-blue halves in white),
 * so it sits straight on the sidebar colour with no tile behind it.
 */
export function BrandMark({ on = "dark", size = 34, className }: BrandMarkProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small static brand asset
    <img
      src={on === "dark" ? "/CRM-logo-dark.png" : "/CRM-logo.png"}
      alt="Laptop Clinic CRM"
      width={size}
      style={{ height: "auto" }}
      className={cn("block shrink-0", className)}
    />
  );
}

/** Mark + "LAPTOP / CLINIC · CRM" wordmark. `mark={false}` when the mark is already shown alongside (icon rail). */
export function BrandLockup({ on = "dark", mark = true, className }: { on?: "dark" | "light"; mark?: boolean; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      {mark && <BrandMark on={on} />}
      <span className="leading-none">
        <span className={cn("block text-[15px] font-black tracking-[0.4px]", on === "dark" ? "text-white" : "text-brand-navy")}>
          LAPTOP
        </span>
        <span className="mt-[3px] block text-[10.5px] font-bold tracking-[2.4px] text-primary">CLINIC · CRM</span>
      </span>
    </span>
  );
}
