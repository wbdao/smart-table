/**
 * SmartTableJS — framework-agnostic data table library.
 *
 * Public entry point. Only exports that are safe for consumers (and plugins)
 * to use are re-exported here. Importing this module registers `DOMRenderer`
 * as the default renderer factory, enabling `table.mount(target)`.
 */

export { SmartTable } from './core/SmartTable';
export { EventBus, type EventHandler } from './core/EventBus';
export {
  DataManager,
  normalizeColumn,
  type ColumnFilterPredicate,
  type FilterState,
  type RemoveResult,
  type UpdateResult,
} from './core/DataManager';
export { SmartTableError, ERROR_CODES, type ErrorCode } from './core/errors';
export {
  BUILT_IN_THEMES,
  DEFAULT_THEME_VARIABLES,
  applyThemeVariables,
  resolveBuiltInTheme,
} from './core/themes';
export { DEFAULT_BREAKPOINTS, normalizeBreakpoints } from './core/breakpoints';
export {
  HistoryManager,
  type CellEditHistoryEntry,
  type HistoryEntry,
  type HistoryState,
  type RowAddHistoryEntry,
  type RowDeleteHistoryEntry,
} from './history/HistoryManager';
export {
  hasValidators,
  isRowValid,
  validateColumnValue,
  validateRow,
  type ValidationError,
  type ValidationResult,
} from './validation/validators';
export {
  FILTER_OPERATORS,
  OPERAND_COUNT,
  OPERATOR_LABELS,
  isFilterOperator,
  matchesOperator,
} from './filters/operators';
export { captureLayout, createDefaultLayoutStorage, LayoutManager } from './layouts/LayoutManager';
export {
  AGGREGATION_OPS,
  aggregate,
  aggregateRows,
  assertValidAggregateConfig,
  isValidAggregateConfig,
  type AggregateConfig,
  type AggregationOp,
} from './features/aggregation/aggregations';
export {
  groupRows,
  groupRowsWithAggregates,
  type GroupingEngineOptions,
  type GroupingResult,
  type GroupSummarizer,
} from './features/grouping/GroupingEngine';
export {
  flattenTree,
  type TreeFlattenOptions,
  type TreeFlattenResult,
} from './features/tree/TreeEngine';
export {
  VirtualScroller,
  type VirtualRange,
  type VirtualScrollerOptions,
} from './features/virtualization/VirtualScroller';
export {
  ViewportManager,
  type ViewportManagerOptions,
} from './features/virtualization/ViewportManager';
export { RowPool } from './features/virtualization/RowPool';
export {
  ServerController,
  type DataSource,
  type DataSourceResult,
  type ServerControllerOptions,
} from './features/server/ServerController';
export { StateManager, type GridState, type GridStateColumn } from './features/state/StateManager';
export {
  PivotEngine,
  PivotResult,
  assertValidPivotConfig,
  type PivotCell,
  type PivotConfig,
  type PivotRow,
  type PivotValue,
} from './features/pivot/PivotEngine';

export type * from './types';

export {
  PluginRegistry,
  createPluginRegistry,
  definePlugin,
  type DefinePluginOptions,
  type PluginDescriptor,
  type PluginMeta,
} from './plugins/registry';
export {
  DEFAULT_EVENTS,
  eventLogPlugin,
  type EventLogEntry,
  type EventLogOptions,
  type EventLogPlugin,
} from './plugins/event-log';
export {
  summaryFooterPlugin,
  summarizeRows,
  type SummaryFooterOptions,
  type SummaryFooterPlugin,
  type SummaryOp,
} from './plugins/summary-footer';

export { createId, deepClone, getCellText, serializeRows } from './utils';

export { Renderer, type RendererFactory } from './ui/Renderer';
export {
  DOMRenderer,
  type CellReference,
  type DOMRendererOptions,
  type DOMRendererState,
  type ViewMode,
} from './ui/DOMRenderer';
export { TableView, type TableViewOptions } from './ui/TableView';
export { CardView, type CardViewOptions } from './ui/CardView';
export { PivotView, type PivotViewOptions } from './ui/PivotView';
export { Toolbar, type ToolbarControl, type ToolbarOptions } from './ui/Toolbar';
export {
  startCellEdit,
  createBooleanControl,
  type EditOptions,
  type EditSession,
} from './ui/editing';
export {
  attachGridNavigation,
  type GridNavigator,
  type GridNavigationOptions,
} from './ui/navigation';
export { BUILT_IN_THEME_NAMES, isBuiltInThemeName } from './ui/Themes';
