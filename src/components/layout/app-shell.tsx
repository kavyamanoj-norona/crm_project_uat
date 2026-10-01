"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { findActiveModule, type NavModule } from "@/lib/navigation";
import { IconRail } from "./icon-rail";
import { ModuleSidebar } from "./module-sidebar";
import { TopBar } from "./top-bar";
import type { LogoutAction, ShellBranch, ShellUser } from "./types";

type AppShellProps = {
  nav: NavModule[];
  /** Badge per menu path, e.g. { "/service/cases": 37 }. */
  counts: Record<string, number>;
  user: ShellUser;
  greeting: string;
  logout: LogoutAction;
  branch: ShellBranch;
  children: React.ReactNode;
};

/** Icon rail (48px) + module sidebar (192px) + top bar (64px) + content. */
export function AppShell({ nav, counts, user, greeting, logout, branch, children }: AppShellProps) {
  const pathname = usePathname();
  const activeModule = findActiveModule(nav, pathname);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const showSidebar = activeModule !== null && !collapsed;
  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="min-h-screen">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          aria-hidden
          onClick={closeMobile}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex transition-transform duration-200 md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <IconRail nav={nav} activeModule={activeModule} user={user} logout={logout} onNavigate={closeMobile} />
        {activeModule && (
          <ModuleSidebar
            module={activeModule}
            pathname={pathname}
            counts={counts}
            onNavigate={closeMobile}
            className={cn(!showSidebar && "md:hidden")}
          />
        )}
      </aside>

      <div className={cn("transition-[padding] duration-200", showSidebar ? "md:pl-[240px]" : "md:pl-12")}>
        <TopBar
          nav={nav}
          activeModule={activeModule}
          greeting={greeting}
          logout={logout}
          branch={branch}
          onOpenMobile={() => setMobileOpen(true)}
          onToggleSidebar={() => setCollapsed((c) => !c)}
          sidebarCollapsed={collapsed}
        />
        <main className="mx-auto max-w-[1440px] p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
