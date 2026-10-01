import { cn } from "@/lib/cn";

export type ColumnDatum = { label: string; value: number; /** Emphasise (e.g. today). */ highlight?: boolean };

type ColumnChartProps = {
  data: ColumnDatum[];
  /** Accessible name, also the hidden table caption. */
  title: string;
  /** Plot height in px. */
  height?: number;
  format?: (v: number) => string;
  /** Unit for tooltips: "3 cases". */
  unit?: [singular: string, plural: string];
};

/**
 * Single-series column chart in plain HTML/CSS. Columns are capped at 24px with
 * 4px rounded tops; values sit on the caps when there are few columns, and every
 * column has a hover/focus tooltip. A visually hidden table carries the data.
 */
export function ColumnChart({ data, title, height = 150, format = String, unit = ["", ""] }: ColumnChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const labelCaps = data.length <= 12;
  // thin out x labels so they never collide
  const every = data.length <= 12 ? 1 : data.length <= 20 ? 2 : 5;
  const count = (v: number) => `${format(v)}${unit[0] ? ` ${v === 1 ? unit[0] : unit[1]}` : ""}`;

  return (
    <figure>
      <div className="flex items-end gap-0.5 border-b border-border" style={{ height: height + 20 }} aria-hidden>
        {data.map((d, i) => (
          <div key={`${d.label}-${i}`} className="group relative flex h-full flex-1 flex-col items-center justify-end outline-none" tabIndex={0}>
            {/* tooltip */}
            <span className="pointer-events-none absolute -top-2 z-10 -translate-y-full rounded-md bg-text px-2 py-1 text-xs whitespace-nowrap text-surface opacity-0 shadow transition-opacity group-hover:opacity-100 group-focus:opacity-100">
              {d.label}: {count(d.value)}
            </span>
            {labelCaps && <span className="mb-1 text-xs font-semibold text-text tabular-nums">{format(d.value)}</span>}
            <span
              className={cn(
                "w-full max-w-6 rounded-t-[4px] transition-colors",
                d.highlight ? "bg-primary" : "bg-primary/35 group-hover:bg-primary/60 group-focus:bg-primary/60",
              )}
              style={{ height: d.value === 0 ? 2 : Math.max(4, (d.value / max) * height) }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-0.5" aria-hidden>
        {data.map((d, i) => (
          <span key={`${d.label}-${i}`} className={cn("flex-1 text-center text-[11px] text-text-muted", d.highlight && "font-semibold text-text")}>
            {i % every === 0 || i === data.length - 1 ? d.label : ""}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d, i) => (
            <tr key={`${d.label}-${i}`}>
              <th scope="row">{d.label}</th>
              <td>{count(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
