"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

const THEMES = [
  { value: "light", Icon: Sun, label: "Light" },
  { value: "system", Icon: Monitor, label: "System" },
  { value: "dark", Icon: Moon, label: "Dark" },
] as const;

function setThemeCookie(value: string) {
  document.cookie = `lc_theme=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

export function SettingsFooter() {
  const [theme, setTheme] = useState<string>("light");

  useEffect(() => {
    const saved = document.cookie.match(/lc_theme=([^;]+)/)?.[1] ?? "light";
    setTheme(saved);
  }, []);

  function applyTheme(value: string) {
    setTheme(value);
    const resolved =
      value === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : value;
    document.documentElement.setAttribute("data-theme", resolved);
    setThemeCookie(resolved);
  }

  return (
    <div className="px-4 py-3 text-center">
      <p className="text-[10px] text-sidebar-muted">© 2026 Laptop Clinic CRM</p>
      <p className="text-[10px] text-sidebar-muted">All Rights Reserved.</p>
      <p className="mt-1.5 text-[10px] text-sidebar-muted">
        Powered by{" "}
        <span className="font-semibold" style={{ color: "rgba(255,255,255,0.72)" }}>
          Norona Tech
        </span>
      </p>
      <span className="mt-1 inline-block rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-medium text-sidebar-muted">
        V1.0.0
      </span>

      <div className="mt-3 flex justify-center gap-0.5 rounded-lg bg-white/8 p-1">
        {THEMES.map(({ value, Icon, label }) => (
          <button
            key={value}
            type="button"
            aria-label={label}
            aria-pressed={theme === value}
            onClick={() => applyTheme(value)}
            className={cn(
              "flex size-8 items-center justify-center rounded-md transition-colors",
              theme === value
                ? "bg-white/20 text-white"
                : "text-sidebar-muted hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className="size-3.5" />
          </button>
        ))}
      </div>
    </div>
  );
}
