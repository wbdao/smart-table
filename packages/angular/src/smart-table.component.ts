import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { ElementRef, OnChanges, OnDestroy, AfterViewInit, SimpleChanges } from '@angular/core';
import type {
  Column,
  DataRow,
  SmartTable as CoreTable,
  SmartEventMap,
  TableMode,
  ThemeName,
  ThemeDefinition,
  ResponsiveBreakpointsInput,
  LayoutStorage,
  ContextMenuOptions,
  VirtualScrollOptions,
  TreeOptions,
  DataSource,
  AggregationOp,
  CellEditEvent,
  SortChangedEvent,
  FilterChangedEvent,
  PageChangedEvent,
  SelectionChangedEvent,
  DataChangedEvent,
  ModeChangedEvent,
  GroupChangedEvent,
  RowAddedEvent,
  RowDeletedEvent,
  DataLoadedEvent,
} from '@smart-table/core';
import { SmartTableController, type AngularSmartTableOptions } from './controller';

/**
 * Standalone Angular component around the headless core.
 *
 * ```html
 * <smart-table [columns]="columns" [data]="rows" [pageSize]="20"
 *   (ready)="onReady($event)" (dataChange)="rows = $event" />
 * ```
 *
 * The table is mounted on init and destroyed on destroy (`OnDestroy`), and
 * the `data` input is kept in sync with the table (`OnChanges`). Returning the
 * table from `dataChange` (as above) gives full controlled behaviour.
 */
@Component({
  selector: 'smart-table',
  standalone: true,
  imports: [],
  template: `<div class="smart-table-host"></div>`,
})
export class SmartTableComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() columns!: Column[];
  @Input() data: DataRow[] = [];
  @Input() className = '';
  @Input() editable?: boolean;
  @Input() mode?: TableMode;
  @Input() theme?: ThemeName | ThemeDefinition;
  @Input() responsive?: boolean | ResponsiveBreakpointsInput;
  @Input() id?: string;
  @Input() historySize?: number;
  @Input() pageSize?: number;
  @Input() layoutStorage?: LayoutStorage;
  @Input() layoutNamespace?: string;
  @Input() contextMenu?: boolean | ContextMenuOptions;
  @Input() virtualScroll?: boolean | VirtualScrollOptions;
  @Input() dataSource?: DataSource;
  @Input() infiniteScroll?: boolean;
  @Input() tree?: boolean | TreeOptions;
  @Input() aggregations?: Record<string, AggregationOp>;

  @Output() ready = new EventEmitter<CoreTable>();
  @Output() dataChange = new EventEmitter<DataRow[]>();
  @Output() cellEdit = new EventEmitter<CellEditEvent>();
  @Output() rowAdded = new EventEmitter<RowAddedEvent>();
  @Output() rowDeleted = new EventEmitter<RowDeletedEvent>();
  @Output() dataChanged = new EventEmitter<DataChangedEvent>();
  @Output() sortChanged = new EventEmitter<SortChangedEvent>();
  @Output() filterChanged = new EventEmitter<FilterChangedEvent>();
  @Output() pageChanged = new EventEmitter<PageChangedEvent>();
  @Output() selectionChanged = new EventEmitter<SelectionChangedEvent>();
  @Output() modeChanged = new EventEmitter<ModeChangedEvent>();
  @Output() groupChanged = new EventEmitter<GroupChangedEvent>();
  @Output() dataLoaded = new EventEmitter<DataLoadedEvent>();

  private controller?: SmartTableController;
  private readonly stopListening: Array<() => void> = [];

  constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    SmartTableController.assertColumns(this.columns);
    const host =
      this.elementRef.nativeElement.querySelector<HTMLDivElement>('.smart-table-host') ??
      this.elementRef.nativeElement;
    this.controller = new SmartTableController(host, this.buildOptions());
    const table = this.controller.mount();

    if (this.className) host.classList.add(this.className);
    this.ready.emit(table);

    const wire = <T>(name: string, emitter: EventEmitter<T>) =>
      this.controller!.on(name as never, (p) => emitter.next(p as unknown as T));

    wire('cellEdit', this.cellEdit);
    wire('rowAdded', this.rowAdded);
    wire('rowDeleted', this.rowDeleted);
    wire('dataChanged', this.dataChanged);
    wire('sortChanged', this.sortChanged);
    wire('filterChanged', this.filterChanged);
    wire('pageChanged', this.pageChanged);
    wire('selectionChanged', this.selectionChanged);
    wire('modeChanged', this.modeChanged);
    wire('groupChanged', this.groupChanged);
    wire('dataLoaded', this.dataLoaded);

    const dataEvents: Array<keyof SmartEventMap> = [
      'dataChanged',
      'cellEdit',
      'rowAdded',
      'rowDeleted',
    ];
    for (const name of dataEvents) {
      this.controller.on(name, () => {
        const rows = this.controller?.getTable()?.getData();
        if (rows) this.dataChange.emit(rows);
      });
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && this.controller) {
      this.controller.setData(this.data);
    }
  }

  ngOnDestroy(): void {
    for (const off of this.stopListening) off();
    this.stopListening.length = 0;
    this.controller?.destroy();
    this.controller = undefined;
  }

  private buildOptions(): AngularSmartTableOptions {
    return {
      columns: this.columns,
      data: this.data,
      editable: this.editable,
      mode: this.mode,
      theme: this.theme,
      responsive: this.responsive,
      id: this.id,
      historySize: this.historySize,
      pageSize: this.pageSize,
      layoutStorage: this.layoutStorage,
      layoutNamespace: this.layoutNamespace,
      contextMenu: this.contextMenu,
      virtualScroll: this.virtualScroll,
      dataSource: this.dataSource,
      infiniteScroll: this.infiniteScroll,
      tree: this.tree,
      aggregations: this.aggregations,
    };
  }
}
