import type { ListState } from "@/lib/list";
import { DataTable, type Column } from "./data-table";
import { FilterTabs, type FilterTab } from "./filter-tabs";
import { Pagination } from "./pagination";
import { SearchBox } from "./search-box";
import { TableCard } from "./table-card";

type ListViewProps<T> = {
  list: ListState;
  total: number;
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  tabs?: FilterTab[];
  /** Omit to hide the search box. */
  searchPlaceholder?: string;
  highlight?: (row: T) => boolean;
  empty?: string;
  /** Extra toolbar content, e.g. a date filter. */
  toolbar?: React.ReactNode;
};

/**
 * The standard list screen: [tabs] [search] … [fullscreen] [density]
 * → sortable table → "Show N entries · pages · x – y of z".
 */
export function ListView<T>({
  list,
  total,
  rows,
  columns,
  rowKey,
  tabs,
  searchPlaceholder,
  highlight,
  empty,
  toolbar,
}: ListViewProps<T>) {
  return (
    <TableCard
      toolbar={
        <>
          {tabs && tabs.length > 1 && <FilterTabs list={list} tabs={tabs} />}
          {searchPlaceholder !== undefined && (
            <SearchBox
              // remount when the URL's q changes from outside (e.g. back button)
              key={list.q}
              path={list.path}
              query={list.query}
              prefix={list.prefix}
              value={list.q}
              placeholder={searchPlaceholder}
            />
          )}
          {toolbar}
        </>
      }
    >
      <DataTable
        list={list}
        rows={rows}
        columns={columns}
        rowKey={rowKey}
        highlight={highlight}
        empty={list.q ? `Nothing matches “${list.q}”.` : empty}
        bordered={false}
      />
      <Pagination list={list} total={total} />
    </TableCard>
  );
}
