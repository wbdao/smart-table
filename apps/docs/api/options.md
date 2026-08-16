# Options

`new SmartTable(options: SmartTableOptions)` accepts the configuration below. Framework adapters expose the same fields as props / inputs (see the [integrations](/guide/integrations/react)).

## Columns & data

### `columns` — `Column[]` (required)

Column definitions drive sorting, filtering, editing and serialization.

```ts
interface Column {
  field: string;
  title?: string;
  type?: 'string' | 'number' | 'boolean' | 'date';
  sortable?: boolean; // default true
  filterable?: boolean; // default true
  editable?: boolean; // default true
  align?: 'left' | 'center' | 'right';
  width?: number;
  visible?: boolean; // default true
  format?: (value) => string;
  validators?: ColumnValidators;
}
```

### `data` — `DataRow[]` (default `[]`)

Plain objects. Row ids are derived from the `id` field when present, otherwise from the first key column.

## Editing & interaction

### `editable` — `boolean` (default `true`)

Shortcut for the initial mode: `true` → `'editable'`, `false` → `'readonly'`.

### `mode` — `'editable' | 'readonly'`

Initial mode; overrides `editable` when both are set.

### `historySize` — `number` (default `100`)

Bounded undo/redo history. `0` disables recording.

## Appearance

### `theme` — `'light' | 'dark' | 'corporate' | ThemeDefinition` (default `'light'`)

Built-in themes or a custom definition (see `ThemeDefinition`). Change at runtime with `setTheme()`.

### `responsive` — `boolean | { mobile?, desktop? }` (default `false`)

Enables card layout below `mobile` (768) and a compact sticky-header layout between `mobile` and `desktop` (1024).

### `contextMenu` — `boolean | ContextMenuOptions` (default `true`)

Built-in right-click menu for header / cell / row. Pass options to add custom items.

## Paging & virtualization

### `pageSize` — `number` (default `0`)

Rows per page. `0` disables paging and renders the full filtered view; any positive integer enables paging.

### `virtualScroll` — `boolean | { enabled?, rowHeight?, overscan? }` (default `false`)

Renders only the viewport rows plus an overscan buffer (`rowHeight: 40`, `overscan: 10` by default).

### `infiniteScroll` — `boolean` (default `false`)

Loads the next page on scroll. Works with a remote `dataSource` (appends page + 1) or local data (reveals the next `pageSize` rows).

## Server mode

### `dataSource` — `DataSource`

```ts
interface DataSource {
  (params: {
    page: number;
    pageSize: number;
    sort?: SortState;
    filters?: DataSourceRequestFilters;
  }): Promise<{ rows: DataRow[]; total: number }>;
}
```

Pagination / sort / filter are forwarded to the server; the committed response replaces the local dataset. Late responses are discarded.

## Tree & aggregation

### `tree` — `boolean | { childrenKey?, lazyChildren?, expanded? }` (default `false`)

Renders hierarchical rows from each node's `children` array, or lazily via `lazyChildren`.

### `aggregations` — `Record<string, AggregationOp>`

Initial aggregation config (field → `'sum' | 'avg' | 'min' | 'max' | 'count' | 'distinct'`) shown in the footer.

## Identity & persistence

### `id` — `string`

Explicit instance id (a unique one is generated otherwise). Used as the layout namespace default.

### `container` — `HTMLElement | string | null`

Optional default mount target; `mount()` uses it when no explicit target is passed.

### `layoutStorage` — `LayoutStorage`

Storage adapter for saved layouts (`getItem` / `setItem` shape); defaults to `localStorage` with an in-memory fallback.

### `layoutNamespace` — `string`

Prefix for stored layouts; defaults to the table `id`.
