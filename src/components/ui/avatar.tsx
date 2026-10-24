import { cn } from "@/lib/cn";

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Round profile picture, falling back to the person's initials. */
export function Avatar({ name, imageUrl, className }: { name: string; imageUrl?: string | null; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary font-semibold text-primary-foreground", className)}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- user upload, size varies
        <img src={imageUrl} alt={name} className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
