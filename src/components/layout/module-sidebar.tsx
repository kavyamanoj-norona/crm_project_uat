"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { findActiveItem, type NavGroup, type NavItem, type NavModule } from "@/lib/navigation";
import { NavIcon } from "@/components/ui/nav-icon";
import { BrandLockup } from "./brand-mark";

type ModuleSidebarProps = {
  module: NavModule;
  pathname: string;
  counts: Record<string, number>;
  onNavigate: () => void;
  className?: string;
  footer?: React.ReactNode;
};

export function ModuleSidebar({ module, pathname, counts, onNavigate, className, footer }: ModuleSidebarProps) {
  const activeId = findActiveItem([module], pathname)?.item.id;

  return (
    <nav
      aria-label={`${module.title} menu`}
      className={cn("flex h-full w-48 flex-col bg-sidebar text-sidebar-text", className)}
    >
      <Link href="/" onClick={onNavigate} className="flex h-16 shrink-0 items-center border-b border-sidebar-line px-3.5" aria-label="Laptop Clinic home">
        <BrandLockup mark={false} />
      </Link>

      <div className="flex-1 space-y-px overflow-y-auto px-2 py-2">
        <p className="flex items-center gap-2 px-2.5 pt-2 pb-1 text-[10px] font-semibold tracking-[1.6px] text-sidebar-muted uppercase">
          <NavIcon name={module.icon} className="size-3.5" />
          {module.title}
        </p>
        {module.entries.map((entry) =>
          entry.kind === "item" ? (
            <SidebarItem key={entry.id} item={entry} active={entry.id === activeId} count={counts[entry.path]} onNavigate={onNavigate} />
          ) : (
            <SidebarGroup key={entry.id} group={entry} activeId={activeId} counts={counts} onNavigate={onNavigate} />
          ),
        )}
      </div>
      {footer && (
        <div className="shrink-0 border-t border-sidebar-line">{footer}</div>
      )}
    </nav>
  );
}

function SidebarGroup({
  group,
  activeId,
  counts,
  onNavigate,
}: {
  group: NavGroup;
  activeId: string | undefined;
  counts: Record<string, number>;
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-md px-2.5 pt-2.5 pb-1 text-[10px] font-semibold tracking-[1.6px] text-sidebar-muted uppercase hover:text-white"
      >
        {group.title}
        <ChevronDown className={cn("size-3.5 transition-transform", !open && "-rotate-90")} />
      </button>
      {open && (
        <div className="space-y-px">
          {group.items.map((item) => (
            <SidebarItem key={item.id} item={item} active={item.id === activeId} count={counts[item.path]} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarItem({
  item,
  active,
  count,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  /** Badge on the right; hidden when 0 or missing. */
  count?: number;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={item.path}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-semibold text-sidebar-text transition-colors hover:bg-sidebar-hover hover:text-white",
        active && "bg-primary text-white hover:bg-primary hover:text-white",
      )}
    >
      <NavIcon name={item.icon} className="size-4 shrink-0 opacity-90" />
      <span className="truncate">{item.title}</span>
      {count ? (
        <span
          className={cn(
            "ml-auto rounded-full px-1.5 text-[11px] leading-[18px] font-bold tabular-nums",
            active ? "bg-white/28 text-white" : "bg-white/16 text-white",
          )}
          aria-label={`${count} items`}
        >
          {count > 999 ? "999+" : count}
        </span>
      ) : null}
    </Link>
  );
}
