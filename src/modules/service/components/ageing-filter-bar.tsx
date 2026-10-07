"use client";

import { Activity, Timer } from "lucide-react";
import { type ListState } from "@/lib/list";
import { CASE_STATUS_LABELS } from "@/modules/service/case-schema";
import type { CaseStatusValue } from "@/modules/service/case-schema";
import { TAT_STAGES } from "@/modules/service/tat-schema";
import { UrlSelectChip, type ChipOption } from "@/components/data/filter-chip";

const STAGE_OPTIONS: ChipOption[] = TAT_STAGES.map((s) => ({
  value: s,
  label: CASE_STATUS_LABELS[s as CaseStatusValue],
}));

const TAT_STATUS_OPTIONS: ChipOption[] = [
  { value: "WITHIN", label: "Within TAT" },
  { value: "APPROACHING", label: "Approaching" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "NO_CONFIG", label: "No Config" },
];

export type AgeingFilterBarProps = {
  list: Pick<ListState, "path" | "query" | "prefix">;
  activeStatus: string;
  activeTatStatus: string;
};

export function AgeingFilterBar({ list, activeStatus, activeTatStatus }: AgeingFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <UrlSelectChip
        label="Stage"
        icon={Activity}
        options={STAGE_OPTIONS}
        value={activeStatus}
        param="status"
        list={list}
      />
      <UrlSelectChip
        label="TAT Status"
        icon={Timer}
        options={TAT_STATUS_OPTIONS}
        value={activeTatStatus}
        param="tatStatus"
        list={list}
        searchable={false}
      />
    </div>
  );
}
