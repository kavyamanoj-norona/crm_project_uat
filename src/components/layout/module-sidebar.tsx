"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { findActiveItem, type NavGroup, type NavItem, type NavModule } from "@/lib/navigation";
import { NavIcon } from "@/components/ui/nav-icon";

type ModuleSidebarProps = {
  module: NavModule;
  pathname: string;
  onNavigate: () => void;
  className?: string;
};

export function ModuleSidebar({ module, pathname, onNavigate, className }: ModuleSidebarProps) {
  const activeId = findActiveItem([module], pathname)?.item.id;

  return (
    <nav
      aria-label={`${module.title} menu`}
      className={cn("flex h-full w-64 flex-col border-r border-border bg-surface", className)}
    >
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-5">
        <NavIcon name={module.icon} className="size-5 text-primary" />
        <span className="truncate text-base font-semibold">{module.title}</span>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {module.entries.map((entry) =>
          entry.kind === "item" ? (
            <SidebarItem key={entry.id} item={entry} active={entry.id === activeId} onNavigate={onNavigate} />
          ) : (
            <SidebarGroup key={entry.id} group={entry} activeId={activeId} onNavigate={onNavigate} />
          ),
        )}
      </div>
    </nav>
  );
}

function SidebarGroup({
  group,
  activeId,
  onNavigate,
}: {
  group: NavGroup;
  activeId: string | undefined;
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="pt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[11px] font-semibold tracking-wider text-text-muted uppercase hover:text-text"
      >
        {group.title}
        <ChevronDown className={cn("size-3.5 transition-transform", !open && "-rotate-90")} />
      </button>
      {open && (
        <div className="mt-1 space-y-0.5">
          {group.items.map((item) => (
            <SidebarItem key={item.id} item={item} active={item.id === activeId} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarItem({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={item.path}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface-muted hover:text-text",
        active &&
          "bg-primary-soft font-medium text-primary before:absolute before:inset-y-1.5 before:left-0 before:w-1 before:rounded-r before:bg-primary hover:bg-primary-soft hover:text-primary",
      )}
    >
      <NavIcon name={item.icon} className="size-4 shrink-0" />
      <span className="truncate">{item.title}</span>
    </Link>
  );
}
