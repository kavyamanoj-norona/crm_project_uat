import { cn } from "@/lib/cn";

type BrandMarkProps = {
  /** "dark": on the navy sidebar (navy halves drawn white). "light": on white. */
  on?: "dark" | "light";
  size?: number;
  className?: string;
};

/** The Laptop Clinic hourglass mark (L + C), as in the brand guidelines. */
export function BrandMark({ on = "dark", size = 34, className }: BrandMarkProps) {
  const navy = on === "dark" ? "#ffffff" : "#1f1c5b";
  const sky = "#29ace1";
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden className={cn("shrink-0", className)}>
      <path fill={navy} d="M16 22 Q16 10 28 10 L50 10 Q57 10 57 17 L57 56 Q40 38 22 30 Q16 27 16 22 Z" />
      <path fill={sky} d="M63 17 Q63 10 70 10 L92 10 Q104 10 104 22 Q104 27 98 30 Q80 38 63 56 Z" />
      <path fill={sky} d="M16 98 Q16 110 28 110 L50 110 Q57 110 57 103 L57 64 Q40 82 22 90 Q16 93 16 98 Z" />
      <path fill={navy} d="M63 103 Q63 110 70 110 L92 110 Q104 110 104 98 Q104 93 98 90 Q80 82 63 64 Z" />
    </svg>
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
