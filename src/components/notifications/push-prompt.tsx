"use client";

import { useEffect, useState } from "react";
import { BellRing, Loader2, X } from "lucide-react";
import { toast } from "@/components/feedback/toast";
import { enablePush, pushState, type PushState, type RegisterDevice } from "./push-client";

const DISMISSED_KEY = "lc_push_prompt_dismissed";

/** "Enable Notifications" chip in the top bar. Shown only while push is set up, allowed by the browser and not yet turned on. */
export function PushPrompt({ register }: { register: RegisterDevice }) {
  const [state, setState] = useState<PushState>("unconfigured");
  const [dismissed, setDismissed] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void pushState().then((s) => {
      setState(s);
      try {
        setDismissed(localStorage.getItem(DISMISSED_KEY) === "1");
      } catch {
        setDismissed(false);
      }
    });
  }, []);

  if (state !== "off" || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      /* private window: it will simply show again next visit */
    }
  };

  return (
    <div className="mr-1 flex items-center rounded-lg bg-primary-soft text-primary sm:mr-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const next = await enablePush(register);
            setState(next);
            if (next === "on") toast("Notifications are on for this device.", "success");
            else if (next === "blocked") toast("Notifications are blocked. Allow them in your browser's site settings.", "warning");
          } catch {
            toast("Could not turn on notifications. Try again.", "error");
          } finally {
            setBusy(false);
          }
        }}
        className="inline-flex h-9 items-center gap-2 rounded-l-lg px-3 text-sm font-semibold hover:bg-primary/10 disabled:opacity-60"
        aria-label="Enable notifications"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <BellRing className="size-4" />}
        <span className="hidden md:inline">Enable Notifications</span>
        <span className="md:hidden">Enable</span>
      </button>
      <button type="button" onClick={dismiss} aria-label="Dismiss" title="Not now" className="inline-flex h-9 items-center rounded-r-lg px-2 hover:bg-primary/10">
        <X className="size-4" />
      </button>
    </div>
  );
}
