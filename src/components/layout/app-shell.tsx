"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { findActiveModule, type NavModule } from "@/lib/navigation";
import { SETTINGS_MODULE } from "@/lib/settings-nav";
import { IconRail } from "./icon-rail";
import { ModuleSidebar } from "./module-sidebar";
import { SettingsFooter } from "./settings-footer";
import { TopBar } from "./top-bar";
import type { LogoutAction, ShellBranch, ShellUser } from "./types";

type AppShellProps = {
  nav: NavModule[];
  counts: Record<string, number>;
  user: ShellUser;
  greeting: string;
  logout: LogoutAction;
  branch: ShellBranch;
  children: React.ReactNode;
};

/** Icon rail (48px) + module sidebar (192px) + top bar (64px) + content. Below lg the rail and sidebar become a slide-in drawer. */
export function AppShell({ nav, counts, user, greeting, logout, branch, children }: AppShellProps) {
  const pathname = usePathname();

  // Settings is NOT a module — detect the route separately so it never appears
  // in the module switcher grid or duplicates the gear icon.
  const isSettings = pathname.startsWith("/settings");
  const activeDbModule = findActiveModule(nav, pathname);
  const activeModule = isSettings ? SETTINGS_MODULE : activeDbModule;

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const showSidebar = activeModule !== null && !collapsed;
  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="min-h-screen">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          aria-hidden
          onClick={closeMobile}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex transition-transform duration-200 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* nav = DB modules only; settings button is rendered separately inside IconRail */}
        <IconRail
          nav={nav}
          activeModule={activeDbModule}
          isSettings={isSettings}
          user={user}
          logout={logout}
          onNavigate={closeMobile}
        />
        {activeModule && (
          <ModuleSidebar
            module={activeModule}
            pathname={pathname}
            counts={counts}
            onNavigate={closeMobile}
            className={cn(!showSidebar && "lg:hidden")}
            footer={isSettings ? <SettingsFooter /> : undefined}
          />
        )}
      </aside>

      <div className={cn("transition-[padding] duration-200", showSidebar ? "lg:pl-[240px]" : "lg:pl-12")}>
        <TopBar
          nav={nav}
          activeModule={activeDbModule}
          greeting={greeting}
          logout={logout}
          branch={branch}
          onOpenMobile={() => setMobileOpen(true)}
          onToggleSidebar={() => setCollapsed((c) => !c)}
          sidebarCollapsed={collapsed}
        />
        <main className="mx-auto max-w-[1440px] p-3 sm:p-4 md:p-6 2xl:max-w-[1760px] 2xl:p-8 min-[2200px]:max-w-[2200px]">{children}</main>
      </div>
    </div>
  );
}
