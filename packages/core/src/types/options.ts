import type { Column, DataRow } from './column';
import type { ContextMenuOptions } from './context-menu';
import type { TableMode, ThemeName } from './modes';
import type { ThemeDefinition } from './theme';
import type { LayoutStorage } from './layout';
import type { AggregationOp } from '../features/aggregation/aggregations';
import type { DataSource } from '../features/server/ServerController';

/**
 * Width thresholds that drive the responsive layout. Widths are read from the
 * mount container (falling back to the viewport) on mount and on resize.
 *
 * - `width < mobile`    -> card layout
 * - `mobile <= width < desktop` -> compact table (sticky header, h-scroll)
 * - `width >= desktop`  -> full desktop table
 */
export interface ResponsiveBreakpoints {
  /** Card-layout upper bound in px. Default `768`. */
  mobile: number;
  /** Desktop-layout lower bound in px. Default `1024`. */
  desktop: number;
}

/** Accepts partial thresholds; missing values fall back to the defaults. */
export type ResponsiveBreakpointsInput = Partial<ResponsiveBreakpoints>;

/** Virtual scrolling configuration. */
export interface VirtualScrollOptions {
  /** Whether virtual scrolling is active. Default `true` when the option is set. */
  enabled?: boolean;
  /** Fixed row height in px. Default `40`. */
  rowHeight?: number;
  /** Extra rows rendered above/below the viewport. Default `10`. */
  overscan?: number;
}

/** Tree data configuration. */
export interface TreeOptions {
  /** Key holding each node's children array. Default `'children'`. */
  childrenKey?: string;
  /**
   * Resolves children lazily when a node is expanded. When provided, a node
   * without an existing `children` array is treated as expandable.
   */
  lazyChildren?: (row: DataRow) => DataRow[] | Promise<DataRow[]>;
  /** Row ids expanded on startup. Default `[]`. */
  expanded?: string[];
}

/** Options accepted by `new SmartTable(options)`. */
export interface SmartTableOptions {
  /**
   * Column definitions. At least one column is required.
   * The column set drives sorting, filtering, editing and serialization.
   */
  columns: Column[];
  /** Initial rows. Defaults to `[]`. */
  data?: DataRow[];
  /**
   * Shortcut for the initial mode. `true` starts in `'editable'`,
   * `false` starts in `'readonly'`. Defaults to `true`.
   * Explicitly passing `mode` takes precedence.
   */
  editable?: boolean;
  /**
   * Initial mode. Overrides `editable` when both are provided.
   * Defaults to `'editable'` (or `'readonly'` when `editable: false`).
   */
  mode?: TableMode;
  /**
   * Initial theme — a built-in name (`'light' | 'dark' | 'corporate'`) or a
   * custom {@link ThemeDefinition}. Defaults to `'light'`.
   */
  theme?: ThemeName | ThemeDefinition;
  /**
   * Enables the responsive layout behavior (card layout on small screens).
   * Pass `true` for the default thresholds or a partial threshold object to
   * override them. Defaults to `false`.
   */
  responsive?: boolean | ResponsiveBreakpointsInput;
  /** Explicit instance id. A unique id is generated when omitted. */
  id?: string;
  /**
   * Optional mount target. Accepts an element or a CSS selector.
   * `mount()` uses it when no explicit target is passed.
   */
  container?: HTMLElement | string | null;
  /**
   * Maximum number of operations the undo history keeps. `0` disables
   * history recording. Defaults to `100`.
   */
  historySize?: number;
  /**
   * Rows per page. `0` (the default) disables pagination and always renders
   * the full filtered view. Any positive integer enables paging.
   */
  pageSize?: number;
  /**
   * Storage adapter for saved layouts. Defaults to `localStorage` (with an
   * in-memory fallback when unavailable).
   */
  layoutStorage?: LayoutStorage;
  /** Namespace prefix for stored layouts. Defaults to the table id. */
  layoutNamespace?: string;
  /**
   * Built-in right-click context menu (header / cell / row). Pass `false` to
   * disable it or an options object to add custom items. Defaults to `true`.
   */
  contextMenu?: boolean | ContextMenuOptions;
  /**
   * Enables virtual scrolling: only the rows inside the viewport (plus an
   * overscan buffer) are rendered, so 100k+ row datasets stay smooth.
   * Pass `true` for the defaults (`rowHeight: 40`, `overscan: 10`) or an
   * options object. Defaults to `false`.
   */
  virtualScroll?: boolean | VirtualScrollOptions;
  /**
   * Loads rows from a remote source instead of local `data`. The function
   * receives pagination / sort / filter parameters and returns the page plus
   * the total row count. Sorting, filtering and pagination are forwarded to
   * the server and the returned rows replace the local dataset.
   */
  dataSource?: DataSource;
  /**
   * Automatically loads the next page when scrolling approaches the end of the
   * current data. Works with a remote `dataSource` (fetches page+1 and
   * appends) and with local data (reveals the next `pageSize` rows).
   * Defaults to `false`.
   */
  infiniteScroll?: boolean;
  /**
   * Renders hierarchical rows: each row's `children` array (or lazy children)
   * is shown under its parent when the parent is expanded. Defaults to `false`.
   */
  tree?: boolean | TreeOptions;
  /** Initial aggregation config (field -> operation) shown in the footer. */
  aggregations?: Record<string, AggregationOp>;
}
