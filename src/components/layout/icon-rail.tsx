"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import type { NavModule } from "@/lib/navigation";
import { NavIcon } from "@/components/ui/nav-icon";
import { ProfileMenu } from "./profile-menu";
import type { LogoutAction, ShellUser } from "./types";

type IconRailProps = {
  nav: NavModule[];
  activeModule: NavModule | null;
  user: ShellUser;
  logout: LogoutAction;
  onNavigate: () => void;
};

export function IconRail({ nav, activeModule, user, logout, onNavigate }: IconRailProps) {
  return (
    <nav
      aria-label="Modules"
      className="flex h-full w-16 flex-col items-center border-r border-border bg-surface py-3"
    >
      <Link
        href="/"
        onClick={onNavigate}
        className="mb-4 flex size-10 items-center justify-center rounded-xl bg-brand-navy text-sm font-bold text-white"
        aria-label="Laptop Clinic home"
      >
        LC
      </Link>

      <ul className="flex flex-1 flex-col items-center gap-1">
        {nav.map((module) => {
          const active = module.id === activeModule?.id;
          return (
            <li key={module.id} className="group relative">
              <Link
                href={module.href}
                onClick={onNavigate}
                aria-label={module.title}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex size-11 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-surface-muted hover:text-text",
                  active && "bg-primary-soft text-primary hover:bg-primary-soft hover:text-primary",
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
