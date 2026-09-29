import { cn } from "@/lib/cn";

export type Column<T> = {
  header: string;
  cell: (row: T, index: number) => React.ReactNode;
  className?: string;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: string;
  highlight?: (row: T) => boolean;
};

/** Basic server-rendered table. Paging / sorting move to TanStack Table later. */
export function DataTable<T>({ columns, rows, rowKey, empty = "No records yet.", highlight }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-max text-left text-sm">
        <thead className="bg-surface-muted text-xs font-semibold text-text-muted uppercase">
          <tr>
            {columns.map((c) => (
              <th key={c.header} className={cn("px-4 py-3 whitespace-nowrap", c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-text-muted">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={rowKey(row)} className={cn("hover:bg-surface-muted/60", highlight?.(row) && "bg-primary-soft/60")}>
                {columns.map((c) => (
                  <td key={c.header} className={cn("px-4 py-3 whitespace-nowrap", c.className)}>
                    {c.cell(row, i)}
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
