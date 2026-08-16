import { useEffect, useRef, type RefObject } from 'react';
import { SmartTable, type SmartTableOptions } from '@smart-table/core';
import type { DataRow } from '@smart-table/core';

/** Options accepted by `useSmartTable`. `container` is ignored — the hook owns the mount target. */
export type UseSmartTableOptions = Omit<SmartTableOptions, 'container'>;

/**
 * Mounts a {@link SmartTable} instance into a `div` owned by the caller and
 * exposes the instance plus a `setData` helper.
 *
 * The table is created lazily (SSR-safe — no DOM is touched at render time)
 * and mounted in an effect. It is unmounted and destroyed on cleanup, and
 * re-created automatically for React StrictMode double-invocations.
 *
 * ```tsx
 * function App() {
 *   const { table, containerRef } = useSmartTable({ columns, data });
 *   return <div ref={containerRef} />;
 * }
 * ```
 */
export function useSmartTable(options: UseSmartTableOptions): {
  table: SmartTable;
  containerRef: RefObject<HTMLDivElement>;
  setData: (rows: DataRow[]) => void;
} {
  const containerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<SmartTable | null>(null);

  if (!tableRef.current) {
    tableRef.current = new SmartTable(options);
  }

  useEffect(() => {
    if (!tableRef.current) tableRef.current = new SmartTable(options);
    const table = tableRef.current;
    if (containerRef.current) table.mount(containerRef.current);
    return () => {
      table.unmount();
      table.destroy();
      tableRef.current = null;
    };
  }, []);

  const lastData = useRef<DataRow[]>(options.data ?? []);
  useEffect(() => {
    if (tableRef.current && lastData.current !== options.data) {
      lastData.current = options.data ?? [];
      tableRef.current.setData(options.data ?? []);
    }
  }, [options.data]);

  const setData = (rows: DataRow[]): void => {
    if (tableRef.current) tableRef.current.setData(rows);
  };

  return { table: tableRef.current as SmartTable, containerRef, setData };
}
