"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun, RotateCcw } from "lucide-react";

const THEMES = [
  { value: "system", label: "System", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
] as const;

const PRIMARY_COLORS = [
  { value: "#6366f1", label: "Indigo" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#22c55e", label: "Green" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#a855f7", label: "Purple" },
  { value: "#ef4444", label: "Red" },
];

const LIGHT_SCHEMES = [
  { value: "slate", label: "Slate" },
  { value: "gray", label: "Gray" },
  { value: "neutral", label: "Neutral" },
];

const DARK_SCHEMES = [
  { value: "mint", label: "Mint" },
  { value: "navy", label: "Navy" },
  { value: "mirage", label: "Mirage" },
  { value: "cinder", label: "Cinder" },
  { value: "black", label: "Black" },
];

const CARD_SKINS = ["Bordered", "Shadow", "Flat"];
const NOTIFICATION_POSITIONS = ["Bottom Right", "Bottom Left", "Top Right", "Top Left"];

function setThemeCookie(value: string) {
  document.cookie = `lc_theme=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

export default function AppearancePage() {
  const [theme, setTheme] = useState<string>("light");
  const [primaryColor, setPrimaryColor] = useState(PRIMARY_COLORS[0]!.value);
  const [lightScheme, setLightScheme] = useState("slate");
  const [darkScheme, setDarkScheme] = useState("cinder");
  const [cardSkin, setCardSkin] = useState("Bordered");
  const [notifPosition, setNotifPosition] = useState("Bottom Right");
  const [notifMax, setNotifMax] = useState(4);
  const [monoMode, setMonoMode] = useState(false);

  useEffect(() => {
    const saved = document.cookie.match(/lc_theme=([^;]+)/)?.[1] ?? "light";
    setTheme(saved);
    const savedColor = localStorage.getItem("lc_primary_color");
    if (savedColor) setPrimaryColor(savedColor);
  }, []);

  function applyTheme(value: string) {
    setTheme(value);
    const resolved = value === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : value;
    document.documentElement.setAttribute("data-theme", resolved);
    setThemeCookie(resolved);
  }

  function resetTheme() {
    applyTheme("light");
    setPrimaryColor(PRIMARY_COLORS[0]!.value);
    setLightScheme("slate");
    setDarkScheme("cinder");
    setCardSkin("Bordered");
    setNotifPosition("Bottom Right");
    setNotifMax(4);
    setMonoMode(false);
    localStorage.removeItem("lc_primary_color");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-brand-navy dark:text-text">Appearance</h1>
        <p className="text-sm text-text-muted">Customize the appearance of the app. Select Theme colors and mode.</p>
      </div>

      {/* Theme Mode */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-1 font-semibold">Theme</h2>
        <p className="mb-3 text-sm text-text-muted">You can select a theme color from the list below.</p>
        <div className="grid grid-cols-3 gap-3">
          {THEMES.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => applyTheme(value)}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors hover:border-primary/50 ${theme === value || (value === "system" && theme !== "light" && theme !== "dark") ? "border-primary" : "border-border"}`}
            >
              <div className={`flex size-16 items-center justify-center rounded-lg ${value === "dark" ? "bg-slate-800" : value === "system" ? "bg-gradient-to-br from-white to-slate-800" : "bg-white"} border border-border`}>
                <Icon className={`size-8 ${value === "dark" ? "text-slate-300" : "text-slate-600"}`} />
              </div>
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Primary Color */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-1 font-semibold">Primary Color</h2>
        <p className="mb-3 text-sm text-text-muted">Choose a color that will be used as the primary color for your theme.</p>
        <div className="flex gap-3">
          {PRIMARY_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={c.label}
              onClick={() => { setPrimaryColor(c.value); localStorage.setItem("lc_primary_color", c.value); }}
              className={`size-10 rounded-lg border-2 transition-transform hover:scale-110 ${primaryColor === c.value ? "border-text ring-2 ring-offset-2" : "border-transparent"}`}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>
      </div>

      {/* Light Scheme */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-1 font-semibold">Light Color Scheme</h2>
        <p className="mb-3 text-sm text-text-muted">Select light color scheme that will be used for your theme.</p>
        <div className="flex gap-3">
          {LIGHT_SCHEMES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setLightScheme(s.value)}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 ${lightScheme === s.value ? "border-primary" : "border-border"} hover:border-primary/50`}
            >
              <div className="flex w-20 flex-col gap-1 rounded-lg border border-border bg-white p-2">
                {[60, 40, 60, 40].map((w, i) => (
                  <div key={i} className="h-1.5 rounded-full bg-slate-200" style={{ width: `${w}%` }} />
                ))}
              </div>
              <span className="text-xs font-medium">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Dark Scheme */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-1 font-semibold">Dark Color Scheme</h2>
        <p className="mb-3 text-sm text-text-muted">Select dark color scheme that will be used for your theme.</p>
        <div className="flex flex-wrap gap-3">
          {DARK_SCHEMES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setDarkScheme(s.value)}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 ${darkScheme === s.value ? "border-primary" : "border-border"} hover:border-primary/50`}
            >
              <div className="flex w-20 flex-col gap-1 rounded-lg border border-slate-600 bg-slate-800 p-2">
                {[60, 40, 60, 40].map((w, i) => (
                  <div key={i} className="h-1.5 rounded-full bg-slate-600" style={{ width: `${w}%` }} />
                ))}
              </div>
              <span className="text-xs font-medium">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Notification settings */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <div>
          <h2 className="mb-1 font-semibold">Notification</h2>
          <p className="mb-4 text-sm text-text-muted">Choose notification position and group style.</p>

          <p className="mb-2 text-sm font-medium">Notification Max Count</p>
          <div className="flex gap-6 border-b border-border pb-4">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNotifMax(n)}
                className={`text-sm font-medium pb-1 ${notifMax === n ? "border-b-2 border-primary text-primary" : "text-text-muted"}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Notification Position:</label>
          <select
            value={notifPosition}
            onChange={(e) => setNotifPosition(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            {NOTIFICATION_POSITIONS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Card Skin:</label>
          <select
            value={cardSkin}
            onChange={(e) => setCardSkin(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            {CARD_SKINS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Theme Chrome Mode:</label>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-muted">Monochrome Mode</span>
            <button
              type="button"
              role="switch"
              aria-checked={monoMode}
              onClick={() => setMonoMode((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${monoMode ? "bg-primary" : "bg-border"}`}
            >
              <span className={`inline-block size-4 rounded-full bg-white transition-transform ${monoMode ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={resetTheme}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
      >
        <RotateCcw className="size-4" /> Reset Theme
      </button>
    </div>
  );
}
