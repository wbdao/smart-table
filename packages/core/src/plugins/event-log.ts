import type { SmartTable } from '../core/SmartTable';
import type { SmartTableEvents } from '../types/events';
import type { SmartTablePlugin } from '../types/plugin';

/** Every built-in event name the log subscribes to by default. */
export const DEFAULT_EVENTS: readonly string[] = [
  'cellEdit',
  'rowAdded',
  'rowDeleted',
  'sortChanged',
  'filterChanged',
  'modeChanged',
  'copied',
  'cloned',
  'selectionChanged',
  'dataChanged',
  'themeChanged',
  'columnVisibilityChanged',
  'columnResized',
  'columnReordered',
  'historyChanged',
  'validationFailed',
  'validationPassed',
  'pageChanged',
  'layoutChanged',
  'contextMenu',
  'contextMenuAction',
  'exported',
  'viewportChanged',
  'dataLoading',
  'dataLoaded',
  'dataLoadFailed',
  'loadMoreRequested',
  'groupChanged',
  'nodeExpanded',
  'nodeCollapsed',
  'aggregationChanged',
  'pivotChanged',
  'toolbar:search',
  'toolbar:copy',
  'toolbar:clone',
  'toolbar:add',
  'toolbar:mode',
  'toolbar:page',
  'toolbar:export',
];

/** A single recorded event. */
export interface EventLogEntry {
  event: string;
  payload: unknown;
  /** `performance.now()`-based timestamp when the event fired. */
  at: number;
}

export interface EventLogOptions {
  /** Called synchronously for every recorded event. */
  onEvent?: (entry: EventLogEntry) => void;
  /** Override the event set (defaults to {@link DEFAULT_EVENTS}). */
  events?: ReadonlyArray<string>;
}

/** A {@link SmartTablePlugin} augmented with the event log's read API. */
export interface EventLogPlugin extends SmartTablePlugin {
  getEntries(): EventLogEntry[];
  clear(): void;
}

/**
 * Marketplace plugin that records every table event in memory — handy for
 * debugging, analytics and adapter smoke tests.
 *
 * ```ts
 * const log = eventLogPlugin({ onEvent: (e) => track(e.event) });
 * table.use(log);
 * log.getEntries(); // [{ event: 'sortChanged', payload: {...}, at: 123 }]
 * ```
 */
export function eventLogPlugin(options: EventLogOptions = {}): EventLogPlugin {
  const entries: EventLogEntry[] = [];
  let offs: Array<() => void> = [];

  const plugin: EventLogPlugin = {
    name: 'event-log',
    version: '1.0.0',
    description: 'Records every table event in memory for debugging and testing.',
    meta: { author: 'SmartTableJS', tags: ['debug', 'tooling', 'analytics'] },
    install(table: SmartTable) {
      const events = options.events ?? DEFAULT_EVENTS;
      for (const event of events) {
        const handler = (payload: unknown): void => {
          const entry: EventLogEntry = { event, payload, at: performance.now() };
          entries.push(entry);
          options.onEvent?.(entry);
        };
        offs.push(table.on(event as keyof SmartTableEvents, handler as never));
      }
    },
    uninstall() {
      for (const off of offs) off();
      offs = [];
      entries.length = 0;
    },
    getEntries() {
      return [...entries];
    },
    clear() {
      entries.length = 0;
    },
  };

  return plugin;
}
