import { onBeforeUnmount, onMounted, ref, shallowRef, type Ref } from 'vue';
import { SmartTable, type SmartTableOptions } from '@smart-table/core';
import type { DataRow } from '@smart-table/core';

/** Options accepted by `useSmartTable`. `container` is ignored — the composable owns the mount target. */
export type UseSmartTableOptions = Omit<SmartTableOptions, 'container'>;

export interface UseSmartTableResult {
  /** The mounted table instance once available; `null` before mount / after unmount. */
  table: Ref<SmartTable | null>;
  /** Bind to a template element (`:ref="host"`) — the table mounts into it. */
  host: Ref<HTMLDivElement | null>;
  /** Replaces the rows programmatically. */
  setData: (rows: DataRow[]) => void;
  /** Replaces the data source at runtime. */
  setOptions: (options: UseSmartTableOptions) => void;
}

/**
 * Composition-API binding around the headless core. The table is created and
 * mounted on the component's mount hook and destroyed on unmount (SSR-safe).
 *
 * ```vue
 * <script setup lang="ts">
 * const { table, host, setData } = useSmartTable({ columns, data: rows });
 * </script>
 *
 * <template><div ref="host" /></template>
 * ```
 */
export function useSmartTable(options: UseSmartTableOptions): UseSmartTableResult {
  const host = ref<HTMLDivElement | null>(null);
  const table = shallowRef<SmartTable | null>(null);
  let instance: SmartTable | null = null;

  const build = (opts: UseSmartTableOptions): SmartTable => {
    const t = new SmartTable(opts);
    if (host.value) t.mount(host.value);
    return t;
  };

  const setOptions = (opts: UseSmartTableOptions): void => {
    if (!instance) {
      options = opts;
      return;
    }
    const next = build(opts);
    instance.unmount();
    instance.destroy();
    instance = next;
    table.value = next;
  };

  onMounted(() => {
    instance = build(options);
    table.value = instance;
  });

  onBeforeUnmount(() => {
    instance?.unmount();
    instance?.destroy();
    instance = null;
    table.value = null;
  });

  const setData = (rows: DataRow[]): void => {
    instance?.setData(rows);
  };

  return { table, host, setData, setOptions };
}
