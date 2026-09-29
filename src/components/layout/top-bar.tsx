"use client";

import Link from "next/link";
import { Bell, LogOut, Maximize, Menu, PanelLeft, Search, Settings, Sun, Moon } from "lucide-react";
import type { NavModule } from "@/lib/navigation";
import { useDismiss } from "@/hooks/use-dismiss";
import { AppSwitcher } from "./app-switcher";
import type { LogoutAction } from "./types";

type TopBarProps = {
  nav: NavModule[];
  activeModule: NavModule | null;
  greeting: string;
  logout: LogoutAction;
  onOpenMobile: () => void;
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
};

const iconBtn =
  "inline-flex size-9 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-muted hover:text-text";

export function TopBar({
  nav,
  activeModule,
  greeting,
  logout,
  onOpenMobile,
  onToggleSidebar,
  sidebarCollapsed,
}: TopBarProps) {
  const isEvening = greeting.startsWith("Good evening");

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-surface/90 px-3 backdrop-blur md:px-5">
      <button type="button" className={`${iconBtn} md:hidden`} aria-label="Open menu" onClick={onOpenMobile}>
        <Menu className="size-5" />
      </button>
      {activeModule && (
        <button
          type="button"
          className={`${iconBtn} hidden md:inline-flex`}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggleSidebar}
        >
          <PanelLeft className="size-5" />
        </button>
      )}

      <div className="hidden items-center gap-2 text-sm font-medium lg:flex">
        {greeting}
        {isEvening ? <Moon className="size-4 text-primary" /> : <Sun className="size-4 text-warning" />}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <label className="relative mr-2 hidden sm:block">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            placeholder="Search or ask Kiran…"
            className="h-9 w-56 rounded-lg border border-border bg-surface-muted pr-12 pl-9 text-sm outline-none placeholder:text-text-muted focus:border-primary lg:w-72"
          />
          <kbd className="absolute top-1/2 right-2 -translate-y-1/2 rounded border border-border px-1.5 text-[10px] text-text-muted">
            ⌘K
          </kbd>
        </label>

        <AppSwitcher nav={nav} activeModule={activeModule} />

        <button type="button" className={`${iconBtn} hidden sm:inline-flex`} aria-label="Toggle fullscreen" onClick={toggleFullscreen}>
          <Maximize className="size-5" />
        </button>

        <NotificationButton />

        <Link href="/settings/profile" className={iconBtn} aria-label="Settings">
          <Settings className="size-5" />
        </Link>

        <form action={logout}>
          <button type="submit" className={iconBtn} aria-label="Log out">
            <LogOut className="size-5" />
          </button>
        </form>
      </div>
    </header>
  );
}

function NotificationButton() {
  const { open, setOpen, ref } = useDismiss();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={iconBtn}
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="size-5" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl border border-border bg-surface p-4 shadow-lg">
          <p className="text-sm font-semibold">Notifications</p>
          <p className="mt-6 mb-4 text-center text-sm text-text-muted">You&apos;re all caught up.</p>
        </div>
      )}
    </div>
  );
}
