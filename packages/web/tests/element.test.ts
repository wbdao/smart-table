import { describe, expect, it, vi } from 'vitest';
import {
  defineSmartTableElement,
  toKebab,
  SmartTableElement,
  type Column,
  type DataRow,
} from '../src/index';

// Importing the package self-registers `<smart-table>`; this guards idempotency.
defineSmartTableElement('smart-table');
defineSmartTableElement('smart-table'); // safe second call

const COLUMNS: Column[] = [
  { field: 'name', title: 'Name', type: 'string' },
  { field: 'price', title: 'Price', type: 'number' },
];
const ROWS: DataRow[] = [
  { name: 'Laptop', price: 1200 },
  { name: 'Mouse', price: 25 },
];

function mountElement(): SmartTableElement {
  const el = document.createElement('smart-table') as SmartTableElement;
  el.columns = COLUMNS;
  el.data = ROWS;
  document.body.appendChild(el);
  return el;
}

describe('toKebab', () => {
  it('converts camelCase to kebab-case and keeps colons', () => {
    expect(toKebab('sortChanged')).toBe('sort-changed');
    expect(toKebab('dataChanged')).toBe('data-changed');
    expect(toKebab('toolbar:search')).toBe('toolbar:search');
    expect(toKebab('columnVisibilityChanged')).toBe('column-visibility-changed');
  });
});

describe('SmartTableElement', () => {
  it('registers the element under the default tag', () => {
    expect(customElements.get('smart-table')).toBeDefined();
  });
  it('mounts a table root into the shadow host', () => {
    const el = mountElement();
    const shadowEl = el.shadowRoot?.querySelector('.st-root');
    expect(shadowEl).not.toBeNull();
    expect(el.getTable()).toBeDefined();
  });

  it('dispatches a ready event then re-emits core events as kebab custom events', () => {
    const el = mountElement();
    expect(el.shadowRoot?.querySelector('.st-root')).not.toBeNull();

    const ready = vi.fn();
    el.addEventListener('ready', ready);
    const sort = vi.fn();
    el.addEventListener('sort-changed', sort);

    // ready fires once during mount (already past), re-dispatch by re-mounting.
    el.columns = [...COLUMNS];
    expect(ready).toHaveBeenCalledTimes(1);

    el.getTable()?.sort('price', 'desc');
    expect(sort).toHaveBeenCalledTimes(1);
    const [arg] = sort.mock.calls[0] ?? [];
    expect(arg).toBeDefined();
    expect((arg as CustomEvent).detail.payload).toMatchObject({
      field: 'price',
      direction: 'desc',
    });
  });

  it('updates data through the property without remounting', () => {
    const el = mountElement();
    const first = el.getTable();
    const changed = vi.fn();
    el.addEventListener('data-changed', changed);

    el.data = [...ROWS, { name: 'Keyboard', price: 80 }];
    expect(el.getTable()).toBe(first); // same instance
    expect(changed).toHaveBeenCalled();
    expect(el.getTable()?.getRowCount()).toBe(3);
  });

  it('applies scalar attributes on rebuild', () => {
    const el = mountElement();
    el.setAttribute('page-size', '1');
    expect(el.getTable()?.getPageSize()).toBe(1);
    el.setAttribute('page-size', '2');
    expect(el.getTable()?.getPageSize()).toBe(2);
  });

  it('applies theme and group-field attributes', () => {
    const el = document.createElement('smart-table') as SmartTableElement;
    el.setAttribute('theme', 'dark');
    el.setAttribute('group-field', 'name');
    el.columns = COLUMNS;
    el.data = ROWS;
    document.body.appendChild(el);

    const table = el.getTable();
    expect(table).toBeDefined();
    expect(table?.getGroups().length).toBeGreaterThan(0);
  });

  it('destroys its table when removed from the DOM', () => {
    const el = mountElement();
    const table = el.getTable();
    expect(table?.isDestroyed()).toBe(false);
    el.remove();
    expect(table?.isDestroyed()).toBe(true);
  });

  it('tears down plugins that were installed through use()', () => {
    const el = mountElement();
    const nativeUnsubscribed = vi.fn();
    el.use({
      name: 'fake',
      install(table) {
        table.on('sortChanged', () => undefined);
        void nativeUnsubscribed;
      },
      uninstall() {
        // observer captured by the element lifecycle
      },
    });
    expect(el.getTable()?.getPlugin('fake')).toBeDefined();
    // unuse removes it
    expect(el.unuse('fake')).toBe(true);
    expect(el.getTable()?.getPlugin('fake')).toBeUndefined();
  });
});
