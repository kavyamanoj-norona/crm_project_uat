"use client";

import { Eye } from "lucide-react";
import { ModalButton } from "@/components/ui/modal-button";
import type { HistoryDetail } from "../case-history";

type HistoryDetailButtonProps = {
  title: string;
  when: string;
  detail: HistoryDetail;
};

/** Opens the full details of one history row (admin view). */
export function HistoryDetailButton({ title, when, detail }: HistoryDetailButtonProps) {
  return (
    <ModalButton trigger={<Eye className="size-3.5" />} variant="secondary" buttonSize="sm" size="xl" title={title} description={when}>
      <div className="space-y-5">
        {detail.map((section, i) => (
          <section key={i}>
            {section.heading && <h3 className="mb-2 text-sm font-semibold">{section.heading}</h3>}
            <dl className="divide-y divide-border rounded-lg border border-border">
              {section.rows.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[10rem_1fr] gap-3 px-4 py-2.5 text-sm">
                  <dt className="text-text-muted">{k}</dt>
                  <dd className="min-w-0 whitespace-pre-wrap break-words font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </ModalButton>
  );
}
