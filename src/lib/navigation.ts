// Navigation types + pure helpers. Safe to import from client components.

export type NavItem = {
  kind: "item";
  id: string;
  code: string;
  title: string;
  icon: string | null;
  path: string;
};

export type NavGroup = {
  kind: "group";
  id: string;
  code: string;
  title: string;
  icon: string | null;
  items: NavItem[];
};

export type NavEntry = NavItem | NavGroup;

export type NavModule = {
  id: string;
  code: string;
  title: string;
  icon: string;
  path: string;
  /** Landing page: the first item the user can see. */
  href: string;
  entries: NavEntry[];
};

/** True when `pathname` is `base` or a sub-path of it. */
export function isPathActive(base: string, pathname: string) {
  return pathname === base || pathname.startsWith(base.endsWith("/") ? base : `${base}/`);
}

export function flattenItems(mod: NavModule): NavItem[] {
  return mod.entries.flatMap((e) => (e.kind === "item" ? [e] : e.items));
}

/** The item whose path best (longest) matches the pathname, across all modules. */
export function findActiveItem(nav: NavModule[], pathname: string) {
  let best: { mod: NavModule; item: NavItem; group?: NavGroup } | null = null;
  for (const mod of nav) {
    for (const entry of mod.entries) {
      const candidates =
        entry.kind === "item"
          ? [{ item: entry, group: undefined }]
          : entry.items.map((item) => ({ item, group: entry }));
      for (const { item, group } of candidates) {
        if (isPathActive(item.path, pathname) && (!best || item.path.length > best.item.path.length)) {
          best = { mod, item, group };
        }
      }
    }
  }
  return best;
}

export function findActiveModule(nav: NavModule[], pathname: string) {
  return (
    findActiveItem(nav, pathname)?.mod ??
    nav.find((m) => isPathActive(m.path, pathname)) ??
    null
  );
}
