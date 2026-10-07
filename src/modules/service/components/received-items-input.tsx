"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { conditionOptions, type ReceivedItem } from "../case-schema";

type Row = { name: string; referenceNo: string; condition: string };

const blank = (): Row => ({ name: "", referenceNo: "", condition: "GOOD" });

function parse(json: string | undefined): Row[] {
  try {
    const rows = JSON.parse(json ?? "") as ReceivedItem[];
    return Array.isArray(rows) ? rows.map((r) => ({ name: r.name ?? "", referenceNo: r.referenceNo ?? "", condition: r.condition ?? "GOOD" })) : [];
  } catch {
    return [];
  }
}

type ReceivedItemsInputProps = {
  name: string;
  /** JSON from a previous submit, to restore the rows. */
  initial?: string;
  invalid?: boolean;
};

/** Repeatable item · reference no. · condition rows, submitted as one JSON field. Blank rows are dropped. */
export function ReceivedItemsInput({ name, initial, invalid }: ReceivedItemsInputProps) {
  const [rows, setRows] = useState<Row[]>(() => parse(initial));
  const filled = rows.filter((r) => r.name.trim() || r.referenceNo.trim());
  const set = (i: number, patch: Partial<Row>) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={filled.length ? JSON.stringify(filled) : ""} />
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[2fr_1.5fr_9rem_auto]">
          <Input
            value={r.name}
            onChange={(e) => set(i, { name: e.target.value })}
            placeholder="Enter item name"
            aria-label={`Item ${i + 1}`}
            aria-invalid={invalid && !r.name.trim() ? true : undefined}
            className="max-sm:col-span-1"
          />
          <Input
            value={r.referenceNo}
            onChange={(e) => set(i, { referenceNo: e.target.value })}
            placeholder="Reference no."
            aria-label={`Item ${i + 1} reference number`}
            className="max-sm:order-3"
          />
          <Select
            value={r.condition}
            onChange={(e) => set(i, { condition: e.target.value })}
            options={conditionOptions}
            aria-label={`Item ${i + 1} condition`}
            className="max-sm:order-4"
          />
          <Button
            variant="ghost"
            onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
            aria-label={`Remove item ${i + 1}`}
            className="px-2.5 max-sm:order-2"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button variant="secondary" size="sm" onClick={() => setRows((prev) => [...prev, blank()])}>
        <Plus className="size-3.5" /> Add item
      </Button>
    </div>
  );
}
