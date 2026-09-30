// URL-driven list state (paging, sorting, search, filter tab) shared by every
// table. Pure functions — safe on server and client.

export type SortDir = "asc" | "desc";

export const PAGE_SIZES = [10, 25, 50, 100] as const;

export type ListState = {
  /** Page path the links point at, e.g. "/admin/users". */
  path: string;
  /** Current query string values (all params, not just this list's). */
  query: Record<string, string>;
  /** Prefix for this list's params when a page has several lists. */
  prefix: string;
  page: number;
  pageSize: number;
  sort: string;
  dir: SortDir;
  q: string;
  tab: string;
};

type SearchParams = Record<string, string | string[] | undefined>;

type ListOptions<S extends string> = {
  sorts: readonly S[];
  defaultSort: S;
  defaultDir?: SortDir;
  defaultPageSize?: number;
  prefix?: string;
};

/** Reads page / size / sort / dir / q / tab from the URL, with safe fallbacks. */
export function listState<S extends string>(
  path: string,
  sp: SearchParams,
  { sorts, defaultSort, defaultDir = "desc", defaultPageSize = 25, prefix = "" }: ListOptions<S>,
): ListState & { sort: S } {
  const query: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") query[k] = v;
  const get = (k: string) => query[prefix + k] ?? "";

  const size = Number(get("size"));
  const sort = (sorts as readonly string[]).includes(get("sort")) ? (get("sort") as S) : defaultSort;
  const dir = get("dir") === "asc" || get("dir") === "desc" ? (get("dir") as SortDir) : defaultDir;

  return {
    path,
    query,
    prefix,
    page: Math.max(1, Math.floor(Number(get("page"))) || 1),
    pageSize: (PAGE_SIZES as readonly number[]).includes(size) ? size : defaultPageSize,
    sort,
    dir,
    q: get("q").trim(),
    tab: get("tab"),
  };
}

/** Prisma skip/take for the current page. */
export function pageArgs(s: Pick<ListState, "page" | "pageSize">) {
  return { skip: (s.page - 1) * s.pageSize, take: s.pageSize };
}

/**
 * Link to the same page with some of this list's params changed. `null` removes
 * a param. Changing anything but the page resets to page 1.
 */
export function listHref(s: Pick<ListState, "path" | "query" | "prefix">, changes: Record<string, string | number | null>) {
  const params = new URLSearchParams(s.query);
  params.delete("saved");
  if (!("page" in changes)) params.delete(s.prefix + "page");
  for (const [k, v] of Object.entries(changes)) {
    if (v === null || v === "" || (k === "page" && v === 1)) params.delete(s.prefix + k);
    else params.set(s.prefix + k, String(v));
  }
  const qs = params.toString();
  return qs ? `${s.path}?${qs}` : s.path;
}
