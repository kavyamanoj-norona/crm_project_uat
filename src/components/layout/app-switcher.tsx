"use client";

import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { cn } from "@/lib/cn";
import type { NavModule } from "@/lib/navigation";
import { useDismiss } from "@/hooks/use-dismiss";
import { NavIcon } from "@/components/ui/nav-icon";

/** 3-column grid of permitted module tiles (KIAL-style app switcher). */
export function AppSwitcher({ nav, activeModule }: { nav: NavModule[]; activeModule: NavModule | null }) {
  const { open, setOpen, ref } = useDismiss();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Switch module"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex size-9 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
      >
        <LayoutGrid className="size-5" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl border border-border bg-surface p-3 shadow-lg">
          <p className="px-1 pb-2 text-sm font-semibold">Modules</p>
          <div className="grid grid-cols-3 gap-2">
            {nav.map((module) => (
              <Link
                key={module.id}
                href={module.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg px-2 py-3 text-center text-xs text-text-muted transition-colors hover:bg-surface-muted hover:text-text",
                  module.id === activeModule?.id && "bg-primary-soft text-primary",
                )}
              >
                <NavIcon name={module.icon} className="size-5" />
                <span className="leading-tight">{module.title}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
