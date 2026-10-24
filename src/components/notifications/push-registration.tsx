"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/feedback/toast";
import { onForegroundMessage, pushState, syncToken, type RegisterDevice } from "./push-client";

/** Keeps this device's token fresh once notifications are allowed, and shows messages that arrive while the CRM is open. */
export function PushRegistration({ register }: { register: RegisterDevice }) {
  const router = useRouter();

  useEffect(() => {
    let off: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      if ((await pushState()) !== "on") return;
      await syncToken(register).catch(() => null);
      if (cancelled) return;
      off = onForegroundMessage((m) => {
        toast(m.data?.body ?? "New notification", "info", { title: m.data?.title });
        router.refresh(); // bell count and lists pick up the change
      });
    })();
    return () => {
      cancelled = true;
      off?.();
    };
  }, [register, router]);

  return null;
}
