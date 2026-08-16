import type { SmartTable, SortState } from '@smart-table/core';

/** Flat query-string shape produced by routers. */
export interface RouterSearch {
  [param: string]: string | number | boolean | null | undefined;
}

/**
 * Minimal router abstraction. TanStack Router's `useNavigate` + `useSearch`
 * satisfy it; so do Next.js `useRouter` or your own store.
 */
export interface RouterDriver {
  /** The current search params. */
  getSearch(): RouterSearch;
  /** Navigate/update with the given patch (merged by the router). */
  setSearch(patch: RouterSearch): void | Promise<void>;
}

/** Read-only snapshot of the table state worth persisting. */
export interface GridSnapshot {
  page: number;
  pageSize: number;
  sort: SortState;
  /** Lower-cased global search query (may be empty). */
  query: string;
}

export type RouterSyncMode = 'toRouter' | 'toTable' | 'both';

export interface RouterStateSyncOptions {
  driver: RouterDriver;
  /** Param name prefix. Default `'grid'` (e.g. `grid:page`). */
  prefix?: string;
  sync?: RouterSyncMode;
  /** Custom table -> search serialization. */
  serialize?: (snapshot: GridSnapshot, params: RouterStateSyncParams) => RouterSearch;
  /** Custom search -> table application. */
  apply?: (patch: RouterSearch, table: SmartTable, params: RouterStateSyncParams) => void;
}

/** Resolved options passed to callbacks (prefix + key names). */
export interface RouterStateSyncParams {
  keyPage: string;
  keySortField: string;
  keySortDir: string;
  keyQuery: string;
}

/** Handle returned by {@link createRouterStateSync}. */
export interface RouterStateSyncHandle {
  /** Serializes current table state into the router. */
  pushToRouter(): void;
  /** Reads the router and applies state to the table. */
  applyFromRouter(): void;
  /** Starts watching table changes (idempotent). */
  start(): void;
  /** Stops watching. */
  stop(): void;
}

function keys(prefix: string): RouterStateSyncParams {
  return {
    keyPage: `${prefix}:page`,
    keySortField: `${prefix}:sort`,
    keySortDir: `${prefix}:dir`,
    keyQuery: `${prefix}:q`,
  };
}

/** Extracts the current grid state for persistence. */
export function readGridSnapshot(table: SmartTable): GridSnapshot {
  return {
    page: table.getCurrentPage(),
    pageSize: table.getPageSize(),
    sort: table.getSortState(),
    query: table.getFilterState().query,
  };
}

const WATCHED_EVENTS = ['pageChanged', 'sortChanged', 'filterChanged'] as const;

/**
 * Two-way state sync between a SmartTableJS instance and a router's search
 * params. `page`, the active sort and the global search query round-trip.
 *
 * ```ts
 * const sync = createRouterStateSync(table, {
 *   driver: { getSearch: () => search, setSearch: (p) => navigate({ search: p }) },
 * });
 * sync.start(); // push + apply, then watch table changes
 * // … later
 * sync.stop();
 * ```
 */
export function createRouterStateSync(
  table: SmartTable,
  options: RouterStateSyncOptions
): RouterStateSyncHandle {
  const params = keys(options.prefix ?? 'grid');
  const mode = options.sync ?? 'both';
  const serialize = options.serialize;
  const applyPatch = options.apply;
  let offs: Array<() => void> = [];
  let started = false;
  let applying = false;

  function pushToRouter(): void {
    if (mode === 'toTable' || applying) return;
    const patch = serialize
      ? serialize(readGridSnapshot(table), params)
      : buildPatch(readGridSnapshot(table), params);
    void options.driver.setSearch(patch);
  }

  function applyFromRouter(): void {
    if (mode === 'toRouter') return;
    const search = options.driver.getSearch();
    applying = true;
    try {
      if (applyPatch) {
        applyPatch(search, table, params);
      } else {
        applyDefaults(search, table, params);
      }
    } finally {
      applying = false;
    }
  }

  function start(): void {
    if (started) return;
    started = true;
    applyFromRouter();
    pushToRouter();
    for (const event of WATCHED_EVENTS) {
      offs.push(table.on(event as never, () => pushToRouter()));
    }
  }

  function stop(): void {
    for (const off of offs) off();
    offs = [];
    started = false;
  }

  return { pushToRouter, applyFromRouter, start, stop };
}

function buildPatch(snapshot: GridSnapshot, params: RouterStateSyncParams): RouterSearch {
  const patch: RouterSearch = {};
  if (snapshot.pageSize > 0) patch[params.keyPage] = snapshot.page;
  if (snapshot.sort.field) {
    patch[params.keySortField] = snapshot.sort.field;
    patch[params.keySortDir] = snapshot.sort.direction ?? undefined;
  }
  if (snapshot.query) patch[params.keyQuery] = snapshot.query;
  return patch;
}

function applyDefaults(
  search: RouterSearch,
  table: SmartTable,
  params: RouterStateSyncParams
): void {
  const field = search[params.keySortField];
  const dir = search[params.keySortDir];
  if (typeof field === 'string' && field) {
    table.sort(field, dir === 'desc' ? 'desc' : 'asc');
  }

  const q = search[params.keyQuery];
  table.filter(typeof q === 'string' ? q : '');

  // Apply the page last — sorting/filtering reset the page to 1.
  const page = Number(search[params.keyPage]);
  if (Number.isInteger(page) && page > 0) table.goToPage(page);
}
