"use client";

import Link from "next/link";
import { LogOut, Maximize, Menu, PanelLeft, Settings, Sun, Moon } from "lucide-react";
import type { NavModule } from "@/lib/navigation";
import { PushRegistration } from "@/components/notifications/push-registration";
import { PushPrompt } from "@/components/notifications/push-prompt";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { AppSwitcher } from "./app-switcher";
import { BranchSwitcher } from "./branch-switcher";
import { AskKiran } from "./ask-kiran-modal";
import type { LogoutAction, ShellBranch, ShellNotifications } from "./types";

type TopBarProps = {
  nav: NavModule[];
  activeModule: NavModule | null;
  greeting: string;
  logout: LogoutAction;
  branch: ShellBranch;
  notifications: ShellNotifications;
  restricted?: boolean;
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
  branch,
  notifications,
  restricted,
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
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-surface/90 px-2 backdrop-blur sm:px-3 md:px-5">
      <button type="button" className={`${iconBtn} lg:hidden`} aria-label="Open menu" onClick={onOpenMobile}>
        <Menu className="size-5" />
      </button>
      {activeModule && (
        <button
          type="button"
          className={`${iconBtn} hidden lg:inline-flex`}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggleSidebar}
        >
          <PanelLeft className="size-5" />
        </button>
      )}

      <div className="hidden items-center gap-2 text-[15px] font-bold whitespace-nowrap text-brand-navy lg:flex dark:text-text">
        {greeting}
        {isEvening ? <Moon className="size-4 text-primary" /> : <Sun className="size-4 text-warning" />}
      </div>

      <div className="ml-auto flex min-w-0 items-center gap-1">
        <PushPrompt register={notifications.registerDevice} />
        {!restricted && (
          <>
            <div className="mr-1 sm:mr-2">
              <BranchSwitcher {...branch} />
            </div>
            <AskKiran />
          </>
        )}

        <AppSwitcher nav={nav} activeModule={activeModule} />

        <button type="button" className={`${iconBtn} hidden sm:inline-flex`} aria-label="Toggle fullscreen" onClick={toggleFullscreen}>
          <Maximize className="size-5" />
        </button>

        <NotificationBell {...notifications} buttonClass={iconBtn} />
        <PushRegistration register={notifications.registerDevice} />

        <Link href="/settings/profile" className={`${iconBtn} hidden sm:inline-flex`} aria-label="Settings">
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
