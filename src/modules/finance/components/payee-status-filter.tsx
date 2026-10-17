"use client";

import { Filter } from "lucide-react";
import { UrlSelectChip } from "@/components/data/filter-chip";
import type { ListState } from "@/lib/list";

type Props = {
  list: Pick<ListState, "path" | "query" | "prefix">;
  value: string;
  options: { value: string; label: string }[];
};

/** The Payables "Status" chip. A client component so it can own its icon (components can't cross from server to client). */
export function PayeeStatusFilter({ list, value, options }: Props) {
  return <UrlSelectChip label="Status" icon={Filter} options={options} value={value} param="status" list={list} searchable={false} />;
}
