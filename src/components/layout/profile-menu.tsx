"use client";

import Link from "next/link";
import { Bell, KeyRound, LogOut, MonitorSmartphone, Palette, User } from "lucide-react";
import { useDismiss } from "@/hooks/use-dismiss";
import { Avatar } from "@/components/ui/avatar";
import type { LogoutAction, ShellUser } from "./types";

const LINKS = [
  { href: "/settings/profile", label: "Profile", hint: "Your personal details", Icon: User, tone: "bg-sky-100 text-sky-600" },
  { href: "/settings/appearance", label: "Appearance", hint: "Theme and layout", Icon: Palette, tone: "bg-violet-100 text-violet-600" },
  { href: "/settings/security", label: "Password & security", hint: "Change your password", Icon: KeyRound, tone: "bg-amber-100 text-amber-600" },
  { href: "/settings/notifications", label: "Notifications", hint: "What you get alerted about", Icon: Bell, tone: "bg-emerald-100 text-emerald-600" },
  { href: "/settings/sessions", label: "Sessions", hint: "Signed-in devices", Icon: MonitorSmartphone, tone: "bg-rose-100 text-rose-600" },
];

export function ProfileMenu({ user, logout }: { user: ShellUser; logout: LogoutAction }) {
  const { open, setOpen, ref } = useDismiss();

  return (
    <div ref={ref} className="relative mt-2">
      <button
        type="button"
        aria-label="Open profile menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="relative flex size-9 rounded-full"
      >
        <Avatar name={user.name} imageUrl={user.imageUrl} className="size-9 text-xs" />
        <span className="absolute right-0 bottom-0 size-2.5 rounded-full bg-success ring-2 ring-sidebar-rail" />
      </button>

      {open && (
        <div className="absolute bottom-0 left-full z-50 ml-3 w-72 rounded-xl border border-border bg-surface p-2 shadow-lg">
          <div className="flex items-center gap-3 border-b border-border p-3">
            <Avatar name={user.name} imageUrl={user.imageUrl} className="size-10 text-sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-text-muted">{user.roleName}</p>
            </div>
          </div>

          <ul className="py-1">
            {LINKS.map(({ href, label, hint, Icon, tone }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface-muted"
                >
                  <span className={`flex size-8 items-center justify-center rounded-lg ${tone}`}>
                    <Icon className="size-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block text-xs text-text-muted">{hint}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <form action={logout} className="border-t border-border p-2">
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-danger/10 py-2 text-sm font-medium text-danger hover:bg-danger/15"
            >
              <LogOut className="size-4" /> Logout
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
