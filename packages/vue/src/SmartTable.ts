import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  type PropType,
} from 'vue';
import {
  SmartTable as CoreTable,
  type SmartTableOptions,
  type Column,
  type DataRow,
  type TableMode,
  type ThemeName,
  type ThemeDefinition,
  type ResponsiveBreakpointsInput,
  type LayoutStorage,
  type ContextMenuOptions,
  type VirtualScrollOptions,
  type TreeOptions,
  type DataSource,
  type AggregationOp,
} from '@smart-table/core';

/** Events that change the data being shown; `update:data` + a named event are emitted for each. */
const DATA_EVENTS = ['dataChanged', 'cellEdit', 'rowAdded', 'rowDeleted'] as const;
const CHANGE_EVENTS = [
  ...DATA_EVENTS,
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
 * Vue 3 wrapper around the headless core. Renders a `div` and mounts the
 * {@link CoreTable} inside it. SSR-safe: nothing touches the DOM during render.
 *
 * ```vue
 * <SmartTable :columns="columns" :data="rows" :page-size="20" table-theme="dark"
 *   @ready="onReady" @sort-changed="onSort" />
 * ```
 *
 * `v-model:data` keeps the parent in control of the rows (like React's
 * controlled mode). The underlying instance is available through the `ready`
 * event or the exposed `table` ref.
 */
export const SmartTable = defineComponent({
  name: 'SmartTable',
  props: {
    columns: { type: Array as PropType<Column[]>, required: true },
    data: { type: Array as PropType<DataRow[]>, default: () => [] },
    className: { type: String, default: '' },
    editable: { type: Boolean, default: undefined },
    mode: { type: String as PropType<TableMode>, default: undefined },
    theme: {
      type: [String, Object] as PropType<ThemeName | ThemeDefinition>,
      default: undefined,
    },
    responsive: {
      type: [Boolean, Object] as PropType<boolean | ResponsiveBreakpointsInput>,
      default: undefined,
    },
    id: { type: String, default: undefined },
    historySize: { type: Number, default: undefined },
    pageSize: { type: Number, default: undefined },
    layoutStorage: { type: Object as PropType<LayoutStorage>, default: undefined },
    layoutNamespace: { type: String, default: undefined },
    contextMenu: {
      type: [Boolean, Object] as PropType<boolean | ContextMenuOptions>,
      default: undefined,
    },
    virtualScroll: {
      type: [Boolean, Object] as PropType<boolean | VirtualScrollOptions>,
      default: undefined,
    },
    dataSource: { type: Function as PropType<DataSource>, default: undefined },
    infiniteScroll: { type: Boolean, default: undefined },
    tree: { type: [Boolean, Object] as PropType<boolean | TreeOptions>, default: undefined },
    aggregations: {
      type: Object as PropType<Record<string, AggregationOp>>,
      default: undefined,
    },
  },
  emits: ['ready', 'update:data', ...CHANGE_EVENTS],
  setup(props, { emit, expose }) {
    const host = ref<HTMLDivElement | null>(null);
    const table = shallowRef<CoreTable | null>(null);
    let instance: CoreTable | null = null;
    let syncedData: DataRow[] = props.data;

    const buildOptions = (): SmartTableOptions =>
      ({
        columns: props.columns,
        data: props.data,
        editable: props.editable,
        mode: props.mode,
        theme: props.theme,
        responsive: props.responsive,
        id: props.id,
        historySize: props.historySize,
        pageSize: props.pageSize,
        layoutStorage: props.layoutStorage,
        layoutNamespace: props.layoutNamespace,
        contextMenu: props.contextMenu,
        virtualScroll: props.virtualScroll,
        dataSource: props.dataSource,
        infiniteScroll: props.infiniteScroll,
        tree: props.tree,
        aggregations: props.aggregations,
      }) as SmartTableOptions;

    const pushData = (): void => {
      const rows = instance?.getData() ?? [];
      if (rows !== syncedData) {
        syncedData = rows;
        emit('update:data', rows);
      }
    };

    onMounted(() => {
      instance = new CoreTable(buildOptions());
      if (host.value) instance.mount(host.value);
      table.value = instance;
      emit('ready', instance);
      for (const name of CHANGE_EVENTS) {
        instance.on(name, (payload) => {
          emit(name, payload as never);
          if ((DATA_EVENTS as readonly string[]).includes(name)) void pushData();
        });
      }
    });

    onBeforeUnmount(() => {
      instance?.unmount();
      instance?.destroy();
      instance = null;
      table.value = null;
    });

    watch(
      () => props.data,
      (next) => {
        if (instance && next !== syncedData) {
          syncedData = next;
          instance.setData(next);
        }
      }
    );

    expose({
      table,
      setData: (rows: DataRow[]) => {
        syncedData = rows;
        instance?.setData(rows);
      },
    });

    return () =>
      h('div', {
        ref: host,
        class: props.className || undefined,
      });
  },
});
