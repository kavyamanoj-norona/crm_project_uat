import { AtSign, Package, ShieldCheck, Wrench, type LucideIcon } from "lucide-react";

export type NotificationItem = {
  id: string;
  category: string;
  title: string;
  body: string;
  url: string;
  createdAt: string;
  read: boolean;
};

export const NOTIFICATION_CATEGORIES: { key: string; label: string }[] = [
  { key: "MENTION", label: "Mentions" },
  { key: "APPROVAL", label: "Approvals" },
  { key: "SERVICE", label: "Service" },
  { key: "INVENTORY", label: "Inventory" },
];

const META: Record<string, { icon: LucideIcon; tile: string; label: string }> = {
  MENTION: { icon: AtSign, tile: "bg-primary text-primary-foreground", label: "MENTION" },
  APPROVAL: { icon: ShieldCheck, tile: "bg-success text-white", label: "APPROVAL" },
  SERVICE: { icon: Wrench, tile: "bg-brand-navy text-white", label: "SERVICE" },
  INVENTORY: { icon: Package, tile: "bg-warning text-white", label: "INVENTORY" },
};

export const categoryMeta = (category: string) => META[category] ?? META.SERVICE!;

/** "just now", "5m ago", "3h ago", "6d ago", then the date. */
export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

/** Tile with the category icon, as in the bell and on the notifications page. */
export function CategoryTile({ category, className = "size-10" }: { category: string; className?: string }) {
  const { icon: Icon, tile } = categoryMeta(category);
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-lg ${tile} ${className}`}>
      <Icon className="size-5" />
    </span>
  );
}
