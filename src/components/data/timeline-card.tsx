"use client";

import { ChevronRight, Clock } from "lucide-react";
import { ModalButton } from "@/components/ui/modal-button";
import { Timeline, type TimelineItem } from "./timeline";

type TimelineCardProps = {
  items: TimelineItem[];
  title?: string;
  /** How many of the newest events the card shows; the rest open in "View full history". */
  limit?: number;
};

/** Card with the latest events and a modal holding the complete history. */
export function TimelineCard({ items, title = "Timeline", limit = 5 }: TimelineCardProps) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Clock className="size-5 text-primary" /> {title}
        </h2>
        {items.length > 0 && (
          <ModalButton
            trigger={
              <>
                View full history <ChevronRight className="size-4" />
              </>
            }
            buttonSize="sm"
            title="Full history"
            description={`${items.length} ${items.length === 1 ? "event" : "events"}, newest first`}
            icon={<Clock className="size-5" />}
            size="md"
          >
            <Timeline items={items} />
          </ModalButton>
        )}
      </div>
      <Timeline items={items.slice(0, limit)} />
      {items.length > limit && (
        <p className="mt-3 pl-6 text-xs text-text-muted">
          + {items.length - limit} older {items.length - limit === 1 ? "event" : "events"} in full history
        </p>
      )}
    </section>
  );
}
