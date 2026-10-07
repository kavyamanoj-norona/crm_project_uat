import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { listHref, type ListState } from "@/lib/list";

export type Column<T> = {
  header: string;
  /** Receives the row and its absolute position (0-based, across pages). */
  cell: (row: T, index: number) => React.ReactNode;
  /** Sort key understood by the page's query; makes the header clickable. */
  sort?: string;
  className?: string;
  align?: "left" | "center" | "right";
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: string;
  highlight?: (row: T) => boolean;
  /** List state for sortable headers and row numbering across pages. */
  list?: ListState;
  /**
   * Render with its own rounded border — use when DataTable is standalone
   * (not inside a TableCard/ListView). Default: true.
   * Pass false when inside TableCard so the unified container provides the border.
   */
  bordered?: boolean;
};

const alignCls = { left: "text-left", center: "text-center", right: "text-right" };

/**
 * Server-rendered table matching the unified container design:
 * - Header row: muted bg + full-width column separators (divide-x)
 * - Data rows: subtle column separators + row dividers
 * - Density follows the nearest `data-density="compact"` ancestor (see TableCard)
 */
export function DataTable<T>({ columns, rows, rowKey, empty = "No records found.", highlight, list, bordered = true }: DataTableProps<T>) {
  const offset = list ? (list.page - 1) * list.pageSize : 0;

  return (
    <div className={cn("overflow-x-auto", bordered && "rounded-xl border border-border")}>
      <table className="w-full min-w-max text-sm">
        <thead className="border-b border-border bg-surface-muted text-xs font-semibold text-text">
          {/* divide-x gives every header cell a right border, auto-skipping the last */}
          <tr className="divide-x divide-border">
            {columns.map((c) => (
              <th
                key={c.header}
                scope="col"
                className={cn(
                  "px-3 py-3 whitespace-nowrap",
                  alignCls[c.align ?? (c.header === "#" ? "center" : "left")],
                  c.className,
                )}
                aria-sort={
                  list && c.sort && list.sort === c.sort
                    ? list.dir === "asc" ? "ascending" : "descending"
                    : undefined
                }
              >
                {list && c.sort ? <SortHeader column={c} list={list} /> : c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-text-muted">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={rowKey(row)}
                className={cn(
                  "divide-x divide-border/40 transition-colors hover:bg-primary-soft",
                  highlight?.(row) && "bg-primary-soft",
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.header}
                    className={cn(
                      "px-3 py-2.5 whitespace-nowrap group-data-[density=compact]/table:py-1.5",
                      alignCls[c.align ?? (c.header === "#" ? "center" : "left")],
                      c.className,
                    )}
                  >
                    {c.cell(row, offset + i)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function SortHeader<T>({ column, list }: { column: Column<T>; list: ListState }) {
  const active = list.sort === column.sort;
  const nextDir = active && list.dir === "asc" ? "desc" : "asc";
  const Icon = !active ? ChevronsUpDown : list.dir === "asc" ? ArrowUp : ArrowDown;

  return (
    <Link
      href={listHref(list, { sort: column.sort!, dir: nextDir })}
      scroll={false}
      className="inline-flex w-full items-center justify-between gap-2 hover:text-primary"
    >
      {column.header}
      <Icon className={cn("size-3.5 shrink-0", active ? "text-primary" : "text-text-muted")} aria-hidden />
    </Link>
  );
}
