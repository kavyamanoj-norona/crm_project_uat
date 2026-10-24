"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { enablePush, pushState, type PushState, type RegisterDevice } from "./push-client";

/** "Turn on push notifications" row inside the bell menu. Hidden when push isn't configured or the browser can't do it. */
export function PushToggle({ register }: { register: RegisterDevice }) {
  const [state, setState] = useState<PushState>("unconfigured");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void pushState().then(setState);
  }, []);

  if (state === "unconfigured" || state === "unsupported") return null;

  return (
    <div className="mt-3 border-t border-border pt-3 text-xs">
      {state === "on" ? (
        <p className="flex items-center gap-2 text-success">
          <BellRing className="size-4" /> Push notifications are on for this device.
        </p>
      ) : state === "blocked" ? (
        <p className="text-text-muted">Notifications are blocked for this site. Allow them in your browser&apos;s site settings, then reload.</p>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setState(await enablePush(register));
            } finally {
              setBusy(false);
            }
          }}
          className="inline-flex items-center gap-2 font-medium text-primary hover:underline disabled:opacity-60"
        >
          <BellRing className="size-4" /> Turn on push notifications
        </button>
      )}
    </div>
  );
}
