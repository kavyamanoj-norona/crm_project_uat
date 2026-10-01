import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "navy" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[9px] font-bold transition-colors disabled:pointer-events-none disabled:opacity-60";
const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
  /** Main action of a record, e.g. "Move to Pending approval →". */
  navy: "bg-brand-navy text-white hover:bg-brand-navy-hover",
  secondary: "border border-border bg-surface text-brand-navy hover:border-primary hover:bg-primary-soft dark:text-text",
  danger: "bg-danger text-white hover:bg-danger/90",
  ghost: "text-text-muted hover:bg-surface-muted hover:text-text",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[12.5px]",
  md: "h-10 px-4 text-[13.5px]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

type LinkButtonProps = React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size };

export function LinkButton({ variant, size, className, ...props }: LinkButtonProps) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
