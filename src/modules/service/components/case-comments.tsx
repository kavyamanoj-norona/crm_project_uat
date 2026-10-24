"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CornerUpLeft, Loader2, Maximize2, MessageSquare, Minimize2, Send, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ActionResult } from "@/lib/form";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import type { CaseCommentRow, Mentionable } from "../comment-queries";

type Props = {
  currentUserId: string;
  comments: CaseCommentRow[];
  staff: Mentionable[];
  /** addCaseComment bound to the case id. */
  action: (input: { body: string; parentId?: string | null; mentionIds?: string[] }) => Promise<ActionResult>;
};

const when = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
const TONES = ["bg-primary text-primary-foreground", "bg-success text-white", "bg-warning text-white", "bg-brand-navy text-white", "bg-danger text-white"];
const tone = (id: string) => TONES[[...id].reduce((s, ch) => s + ch.charCodeAt(0), 0) % TONES.length];
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Message text with the tagged names highlighted. */
function Body({ text, names }: { text: string; names: string[] }) {
  if (names.length === 0) return <>{text}</>;
  const parts = text.split(new RegExp(`(@(?:${names.map(escapeRe).join("|")}))`, "g"));
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("@") && names.includes(p.slice(1)) ? (
          <span key={i} className="font-semibold text-primary">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

/** Chat-style comments on a case: replies, @mentions, and an enlarged view. Messages are saved on the case. */
export function CaseComments({ currentUserId, comments, staff, action }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<Mentionable[]>([]);
  const [replyTo, setReplyTo] = useState<CaseCommentRow | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const participants = useMemo(() => new Set(comments.map((c) => c.authorId)).size, [comments]);
  const matches = query === null ? [] : staff.filter((s) => s.id !== currentUserId && s.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6);

  // Newest message in view, and new messages from others appear without a manual refresh.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [comments.length, expanded]);
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && router.refresh(), 20000);
    return () => clearInterval(t);
  }, [router]);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded]);

  const onChange = (value: string, caret: number) => {
    setText(value);
    const m = /(?:^|\s)@([^@\n]{0,30})$/.exec(value.slice(0, caret));
    setQuery(m ? m[1] : null);
  };

  const pick = (s: Mentionable) => {
    const el = inputRef.current;
    const caret = el?.selectionStart ?? text.length;
    const before = text.slice(0, caret).replace(/@[^@\n]{0,30}$/, `@${s.name} `);
    setText(before + text.slice(caret));
    setPicked((p) => (p.some((x) => x.id === s.id) ? p : [...p, s]));
    setQuery(null);
    el?.focus();
  };

  const send = () => {
    const body = text.trim();
    if (!body || pending) return;
    const mentionIds = picked.filter((p) => body.includes(`@${p.name}`)).map((p) => p.id);
    start(async () => {
      const res = await action({ body, parentId: replyTo?.id ?? null, mentionIds });
      if (res.ok) {
        setText("");
        setPicked([]);
        setReplyTo(null);
        setError("");
        router.refresh();
      } else setError(res.message);
    });
  };

  const card = (
    <section
      className={cn(
        "flex flex-col rounded-xl border border-border bg-surface shadow-sm",
        expanded && "fixed inset-3 z-50 sm:inset-6 lg:inset-x-[12%] lg:inset-y-8",
      )}
      aria-label="Case comments and mentions"
    >
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <MessageSquare className="size-5 text-primary" /> Case Comments &amp; Mentions
          </h2>
          <p className="text-xs text-text-muted">
            {participants} {participants === 1 ? "participant" : "participants"} · {comments.length} {comments.length === 1 ? "message" : "messages"}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setExpanded((e) => !e)} aria-label={expanded ? "Shrink comments" : "Enlarge comments"} title={expanded ? "Shrink" : "Enlarge"}>
          {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </Button>
      </header>

      <div className={cn("space-y-3 overflow-y-auto bg-surface-muted/40 px-4 py-4", expanded ? "min-h-0 flex-1" : "h-80 max-h-[60vh]")}>
        {comments.length === 0 && <p className="py-10 text-center text-sm text-text-muted">No comments yet. Start the conversation or tag a colleague with @.</p>}
        {comments.map((c) => {
          const mine = c.authorId === currentUserId;
          return (
            <div key={c.id} className={cn("flex gap-2.5", mine && "flex-row-reverse")}>
              <Avatar name={c.authorName} imageUrl={c.authorImage} className={cn("mt-0.5 size-8 text-[11px] font-bold", !c.authorImage && tone(c.authorId))} />
              <div className={cn("flex min-w-0 max-w-[85%] flex-col", mine && "items-end")}>
                <p className="mb-0.5 flex flex-wrap items-baseline gap-x-2 text-xs">
                  <span className="font-semibold">{mine ? "You" : c.authorName}</span>
                  <span className="text-text-muted">{when.format(new Date(c.createdAt))}</span>
                </p>
                <div className={cn("rounded-2xl px-3 py-2 text-sm break-words whitespace-pre-wrap", mine ? "rounded-tr-sm bg-primary-soft" : "rounded-tl-sm border border-border bg-surface")}>
                  {c.parent && (
                    <div className="mb-1.5 rounded-md border-l-4 border-primary bg-black/5 px-2 py-1 text-xs dark:bg-white/10">
                      <p className="font-semibold text-primary">{c.parent.authorName}</p>
                      <p className="line-clamp-2 text-text-muted">{c.parent.body}</p>
                    </div>
                  )}
                  <Body text={c.body} names={c.mentions.map((m) => m.name)} />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReplyTo(c);
                    inputRef.current?.focus();
                  }}
                  className="mt-0.5 inline-flex items-center gap-1 text-xs text-text-muted hover:text-primary"
                >
                  <CornerUpLeft className="size-3" /> Reply
                </button>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="relative border-t border-border p-3">
        {replyTo && (
          <div className="mb-2 flex items-start justify-between gap-2 rounded-md border-l-4 border-primary bg-surface-muted px-2 py-1 text-xs">
            <div className="min-w-0">
              <p className="font-semibold text-primary">Replying to {replyTo.authorName}</p>
              <p className="line-clamp-1 text-text-muted">{replyTo.body}</p>
            </div>
            <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply" className="text-text-muted hover:text-text">
              <X className="size-4" />
            </button>
          </div>
        )}
        {matches.length > 0 && (
          <ul className="absolute inset-x-3 bottom-full z-10 mb-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg" role="listbox">
            {matches.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected="false"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(s);
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-primary-soft"
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-text-muted">{s.role}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={text}
            rows={expanded ? 3 : 1}
            maxLength={2000}
            placeholder="Write a comment… Use @ to mention staff"
            onChange={(e) => onChange(e.target.value, e.target.selectionStart)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && matches.length === 0) {
                e.preventDefault();
                send();
              }
              if (e.key === "Escape") setQuery(null);
            }}
            className="min-h-10 flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <Button variant="navy" onClick={send} disabled={pending || !text.trim()}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send
          </Button>
        </div>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        <p className="mt-2 text-xs text-text-muted">Comments are visible to authorized case users across branches and Head Office.</p>
      </div>
    </section>
  );

  return expanded ? (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setExpanded(false)} aria-hidden />
      {/* Keeps the card's place in the page while the chat is enlarged. */}
      <div className="h-24 rounded-xl border border-dashed border-border" aria-hidden />
      {card}
    </>
  ) : (
    card
  );
}
