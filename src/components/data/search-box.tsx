"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { listHref } from "@/lib/list";

type SearchBoxProps = {
  path: string;
  query: Record<string, string>;
  prefix?: string;
  value: string;
  placeholder?: string;
};

/** Debounced search that updates the `q` param (and resets to page 1). */
export function SearchBox({ path, query, prefix = "", value, placeholder = "Search…" }: SearchBoxProps) {
  const router = useRouter();
  const [text, setText] = useState(value);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      router.replace(listHref({ path, query, prefix }, { q: text.trim() || null }), { scroll: false });
    }, 350);
    return () => clearTimeout(t);
    // query/path are stable for a given render of the page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <label className="relative block w-full sm:w-64">
      <span className="sr-only">Search</span>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted" />
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-border bg-surface pr-8 pl-9 text-sm outline-none placeholder:text-text-muted focus:border-primary [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button
          type="button"
          onClick={() => setText("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-text-muted hover:text-text"
        >
          <X className="size-4" />
        </button>
      )}
    </label>
  );
}
