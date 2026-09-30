"use client";

import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui/button";

/** "Go back" — returns to the previous page, or home when there is no history. */
export function BackButton({ label = "Go back", fallback = "/" }: { label?: string; fallback?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={buttonClass("secondary")}
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
    >
      {label}
    </button>
  );
}
