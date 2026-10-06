"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, Send, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "How many open cases today?",
  "Today's revenue?",
  "Cases ready for pickup?",
  "Low stock items?",
];

export function AskKiran() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Open on ⌘K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const submit = useCallback(async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });

      let data: { answer?: string; error?: string };
      try {
        data = (await res.json()) as { answer?: string; error?: string };
      } catch {
        // Server returned a non-JSON response (500 HTML, etc.)
        setMessages((m) => [
          ...m,
          { role: "assistant", content: `Server error (HTTP ${res.status}). Check that OPENAI_API_KEY is set in .env and restart the dev server.` },
        ]);
        return;
      }

      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.answer ?? data.error ?? "No response from Kiran." },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Network error — make sure the dev server is running." },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative mr-2 hidden h-9 items-center gap-2 rounded-full border border-border bg-surface-muted pr-10 pl-9 text-sm text-text-muted transition-colors hover:border-primary hover:text-text md:flex"
        aria-label="Ask Kiran"
      >
        <Search className="pointer-events-none absolute left-3 size-4" />
        <span className="hidden w-36 text-left xl:block xl:w-56">Search or ask Kiran…</span>
        <kbd className="absolute right-2 rounded border border-border px-1.5 text-[10px]">⌘K</kbd>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-16"
          onClick={() => setOpen(false)}
        >
          {/* Panel */}
          <div
            className="flex w-full max-w-2xl flex-col rounded-2xl border border-border bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="size-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">Ask Kiran</p>
                <p className="text-xs text-text-muted">AI assistant · read-only · shows live data</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ml-auto inline-flex size-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted hover:text-text"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex max-h-[420px] min-h-[120px] flex-col gap-4 overflow-y-auto px-5 py-5">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <p className="text-sm text-text-muted">
                    Ask about cases, revenue, customers, or inventory.
                  </p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setInput(s)}
                        className="rounded-full border border-border px-3 py-1 text-xs text-text-muted transition-colors hover:border-primary hover:text-primary"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Sparkles className="size-3.5 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
                        msg.role === "user"
                          ? "bg-primary text-white"
                          : "bg-surface-muted text-text",
                      )}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))
              )}

              {loading && (
                <div className="flex gap-3">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Sparkles className="size-3.5 text-primary" />
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl bg-surface-muted px-4 py-2.5 text-sm text-text-muted">
                    <Loader2 className="size-3.5 animate-spin" />
                    Thinking…
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border px-4 py-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
                className="flex gap-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything about your CRM data…"
                  disabled={loading}
                  className="min-w-0 flex-1 rounded-xl border border-border bg-surface-muted px-4 py-2 text-sm outline-none placeholder:text-text-muted focus:border-primary disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="inline-flex size-10 items-center justify-center rounded-xl bg-primary text-white transition-opacity disabled:opacity-40"
                  aria-label="Send"
                >
                  <Send className="size-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
