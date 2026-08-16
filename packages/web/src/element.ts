import {
  SmartTable,
  DEFAULT_EVENTS,
  type Column,
  type DataRow,
  type SmartTableOptions,
  type SmartTablePlugin,
  type ThemeDefinition,
  type ThemeName,
} from '@smart-table/core';
import coreCss from '../../core/src/styles/smart-table.css?inline';

/** Kebab-cases an event name: `sortChanged` -> `sort-changed`. `:` and `-` are kept. */
export function toKebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

function boolAttr(element: SmartTableElement, name: string): boolean {
  const value = element.getAttribute(name);
  if (value === null) return false;
  return value === '' || value === 'true' || value === '1';
}

function numAttr(element: SmartTableElement, name: string): number | undefined {
  const value = element.getAttribute(name);
  if (value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const REGISTERED_ELEMENTS = new Set<string>();

/**
 * A framework-free `<smart-table>` custom element.
 *
 * Use properties for rich data (arrays), attributes for simple options:
 *
 * ```html
 * <smart-table id="orders" theme="dark" page-size="25" editable></smart-table>
 * <script>
 *   const el = document.querySelector('smart-table');
 *   el.columns = [...];
 *   el.data = [...];
 *   el.addEventListener('sort-changed', (e) => console.log(e.detail));
 * </script>
 * ```
 */
export class SmartTableElement extends HTMLElement {
  static readonly tagName = 'smart-table';

  private columnsValue: Column[] | null = null;
  private dataValue: DataRow[] | null = null;
  private extraOptions: Record<string, unknown> = {};
  private tableValue: SmartTable | null = null;
  private offs: Array<() => void> = [];
  private readyDispatched = false;
  private hostEl: HTMLElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = coreCss;
    this.hostEl = document.createElement('div');
    this.hostEl.className = 'st-element-host';
    root.append(style, this.hostEl);
  }

  // ------------------------------------------------------------------ props

  get columns(): Column[] | null {
    return this.columnsValue;
  }

  set columns(value: Column[] | null) {
    this.columnsValue = value;
    this.render();
  }

  get data(): DataRow[] | null {
    return this.dataValue;
  }

  set data(value: DataRow[] | null) {
    this.dataValue = value;
    if (this.tableValue) {
      this.tableValue.setData(value ?? []);
    } else {
      this.render();
    }
  }

  /** Extra SmartTableOptions merged over the attribute-derived options. */
  get options(): Record<string, unknown> {
    return { ...this.extraOptions };
  }

  set options(value: Record<string, unknown>) {
    this.extraOptions = { ...value };
    this.render();
  }

  /** The live {@link SmartTable} instance, when mounted. */
  getTable(): SmartTable | null {
    return this.tableValue;
  }

  // -------------------------------------------------------------- lifecycle

  static get observedAttributes(): string[] {
    return [
      'theme',
      'page-size',
      'editable',
      'virtual-scroll',
      'responsive',
      'context-menu',
      'group-field',
      'table-id',
    ];
  }

  connectedCallback(): void {
    this.render();
  }

  disconnectedCallback(): void {
    this.destroyTable();
  }

  attributeChangedCallback(): void {
    this.render();
  }

  private buildOptions(): SmartTableOptions {
    const theme = this.getAttribute('theme') ?? undefined;
    return {
      ...this.extraOptions,
      id: this.getAttribute('table-id') ?? undefined,
      theme: theme as ThemeName | ThemeDefinition | undefined,
      pageSize: numAttr(this, 'page-size'),
      editable: boolAttr(this, 'editable'),
      virtualScroll: boolAttr(this, 'virtual-scroll'),
      responsive: boolAttr(this, 'responsive'),
      contextMenu: boolAttr(this, 'context-menu'),
      columns: this.columnsValue ?? [],
      data: this.dataValue ?? [],
      container: this.hostEl,
    };
  }

  private wireEvents(table: SmartTable): void {
    for (const event of DEFAULT_EVENTS) {
      this.offs.push(
        table.on(event as never, (payload: unknown) => {
          this.dispatchEvent(
            new CustomEvent(toKebab(event), {
              detail: { payload, table },
            })
          );
        })
      );
    }
  }

  private destroyTable(): void {
    for (const off of this.offs) off();
    this.offs = [];
    this.tableValue?.destroy();
    this.tableValue = null;
    this.readyDispatched = false;
  }

  private render(): void {
    if (!this.isConnected || !this.columnsValue) return;
    this.destroyTable();
    const table = new SmartTable(this.buildOptions());
    const groupField = this.getAttribute('group-field');
    if (groupField) table.groupBy(groupField);
    table.mount(this.hostEl);
    this.tableValue = table;
    this.wireEvents(table);
    if (!this.readyDispatched) {
      this.readyDispatched = true;
      this.dispatchEvent(new CustomEvent('ready', { detail: { table } }));
    }
  }

  // ------------------------------------------------------------- utilities

  /** Installs plugins onto the live table (no-op before a table is mounted). */
  use(plugin: SmartTablePlugin): void {
    this.tableValue?.use(plugin);
  }

  /** Removes a plugin by name from the live table. */
  unuse(name: string): boolean {
    return this.tableValue?.unuse(name) ?? false;
  }
}

/**
 * Registers the `<smart-table>` element (idempotent). Defaults to `smart-table`.
 * Each tag gets its own subclass of {@link SmartTableElement} (the spec forbids
 * reusing a single constructor for two tags), so custom names work too.
 */
export function defineSmartTableElement(tag = SmartTableElement.tagName): typeof SmartTableElement {
  if (!REGISTERED_ELEMENTS.has(tag)) {
    REGISTERED_ELEMENTS.add(tag);
    if (typeof customElements !== 'undefined' && !customElements.get(tag)) {
      class SmartTableElementSubclass extends SmartTableElement {}
      customElements.define(tag, SmartTableElementSubclass);
    }
  }
  return SmartTableElement;
}
