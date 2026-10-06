"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import type { NavModule } from "@/lib/navigation";
import { NavIcon } from "@/components/ui/nav-icon";
import { BrandMark } from "./brand-mark";
import { ProfileMenu } from "./profile-menu";
import type { LogoutAction, ShellUser } from "./types";

type IconRailProps = {
  nav: NavModule[];
  activeModule: NavModule | null;
  /** True when the current route is under /settings */
  isSettings: boolean;
  user: ShellUser;
  logout: LogoutAction;
  onNavigate: () => void;
};

export function IconRail({ nav, activeModule, isSettings, user, logout, onNavigate }: IconRailProps) {
  return (
    <nav
      aria-label="Modules"
      className="flex h-full w-12 flex-col items-center border-r border-sidebar-line bg-sidebar-rail pb-3"
    >
      <Link
        href="/"
        onClick={onNavigate}
        className="mb-3 flex h-16 w-full shrink-0 items-center justify-center border-b border-sidebar-line hover:bg-sidebar-hover"
        aria-label="Laptop Clinic home"
      >
        <BrandMark size={30} />
      </Link>

      {/* Module icons — DB modules only, Settings is NOT in this list */}
      <ul className="flex flex-1 flex-col items-center gap-1">
        {nav.map((module) => {
          const active = !isSettings && module.id === activeModule?.id;
          return (
            <li key={module.id} className="group relative">
              <Link
                href={module.href}
                onClick={onNavigate}
                aria-label={module.title}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex size-10 items-center justify-center rounded-xl text-sidebar-text transition-colors hover:bg-sidebar-hover hover:text-white",
                  active && "bg-primary text-white hover:bg-primary hover:text-white",
                )}
              >
                <NavIcon name={module.icon} className="size-5" />
              </Link>
              <span className="pointer-events-none absolute top-1/2 left-full z-50 ml-2 -translate-y-1/2 rounded-md bg-brand-navy px-2 py-1 text-xs whitespace-nowrap text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
                {module.title}
              </span>
            </li>
          );
        })}
      </ul>

      <ProfileMenu user={user} logout={logout} />
    </nav>
  );
}
