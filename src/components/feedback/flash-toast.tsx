"use client";

import { useEffect } from "react";
import { toast, type ToastType } from "./toast";

/**
 * Shows a toast once after a redirect (e.g. `?saved=<timestamp>`), then removes
 * the param from the URL so a refresh doesn't show it again.
 */
export function FlashToast({ flag, param = "saved", message, type = "success" }: {
  /** The param's value; a new value shows a new toast. */
  flag?: string;
  param?: string;
  message: string;
  type?: ToastType;
}) {
  useEffect(() => {
    if (!flag) return;
    toast(message, type);
    const url = new URL(window.location.href);
    url.searchParams.delete(param);
    window.history.replaceState(window.history.state, "", url);
  }, [flag, param, message, type]);

  return null;
}
