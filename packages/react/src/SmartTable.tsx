import { useEffect, useRef } from 'react';
import { SmartTable as CoreTable, type SmartTableOptions } from '@smart-table/core';
import type { Column, DataRow } from '@smart-table/core';
import type { SmartEventMap } from '@smart-table/core';

/** Props accepted by the `<SmartTable>` React component. */
export interface SmartTableProps extends Omit<SmartTableOptions, 'columns' | 'data' | 'container'> {
  columns: Column[];
  data: DataRow[];
  /** Extra class name applied to the mount element. */
  className?: string;
  /**
   * Called once, after the table has been mounted. Use it for imperative
   * access to the underlying {@link CoreTable} instance.
   */
  onReady?: (table: CoreTable) => void;
  /**
   * Controlled mode: fires with the table instance whenever a state-affecting
   * event happens (sort, filter, edit, selection, pagination, …). Rebuild the
   * `data` prop (e.g. `onChange={(t) => setData(t.getData())}`) to keep the
   * parent in control.
   */
  onChange?: (table: CoreTable) => void;
  /** Subscribe to core events: `{ cellEdit: (e) => …, sortChanged: (e) => … }`. */
  eventHandlers?: Partial<{ [K in keyof SmartEventMap]: (payload: SmartEventMap[K]) => void }>;
}

const CHANGE_EVENTS = [
  'dataChanged',
  'cellEdit',
  'sortChanged',
  'filterChanged',
  'pageChanged',
  'selectionChanged',
  'columnVisibilityChanged',
  'columnResized',
  'columnReordered',
  'groupChanged',
  'nodeExpanded',
  'nodeCollapsed',
  'aggregationChanged',
  'dataLoaded',
] as const;

/**
 * React wrapper around the headless core. Renders a `div`, mounts the
 * {@link CoreTable} in an effect and syncs the `data` prop. SSR-safe: nothing
 * touches the DOM during render.
 *
 * ```tsx
 * <SmartTable columns={columns} data={rows} onReady={(t) => t.groupBy('category')} />
 * ```
 */
export function SmartTable(props: SmartTableProps): JSX.Element {
  const { columns, data, className, onReady, onChange, eventHandlers, ...coreOptions } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<CoreTable | null>(null);

  if (!tableRef.current) {
    tableRef.current = new CoreTable({ columns, data, ...coreOptions });
  }

  useEffect(() => {
    if (!tableRef.current) {
      tableRef.current = new CoreTable({ columns, data, ...coreOptions });
    }
    const table = tableRef.current;
    if (containerRef.current) table.mount(containerRef.current);
    onReady?.(table);
    return () => {
      table.unmount();
      table.destroy();
      tableRef.current = null;
    };
  }, []);

  const lastData = useRef<DataRow[]>(data);
  useEffect(() => {
    if (tableRef.current && lastData.current !== data) {
      lastData.current = data;
      tableRef.current.setData(data);
    }
  }, [data]);

  useEffect(() => {
    const table = tableRef.current;
    if (!table || !eventHandlers) return;
    const entries = Object.entries(eventHandlers) as Array<
      [keyof SmartEventMap, (payload: unknown) => void]
    >;
    const offs = entries.map(([name, handler]) => table.on(name, handler as never));
    return () => offs.forEach((off) => off());
  }, [eventHandlers]);

  useEffect(() => {
    const table = tableRef.current;
    if (!table || !onChange) return;
    const offs = CHANGE_EVENTS.map((name) => table.on(name, () => onChange(table)));
    return () => offs.forEach((off) => off());
  }, [onChange]);

  return <div ref={containerRef} className={className} />;
}
