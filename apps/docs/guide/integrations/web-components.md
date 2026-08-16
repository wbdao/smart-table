# Web Components

`@smart-table/web` ships a framework-free **custom element** that renders a
full `SmartTable` in a shadow root. Use it with plain HTML/JS, or drop it into
any framework's template — no bindings required.

## Installation

```bash
npm install @smart-table/web        # ESM + CJS + types, tree-shakeable
npm install @smart-table/core       # peer dependency
```

Importing the package registers `<smart-table>`:

```ts
import '@smart-table/web';
```

The registration is idempotent, and safe in SSR (`customElements` is guarded).

## Usage

```html
<smart-table id="orders" theme="dark" page-size="25" editable context-menu> </smart-table>

<script type="module">
  import '@smart-table/web';
  const el = document.querySelector('#orders');

  el.columns = [
    { field: 'id', title: 'ID', type: 'number' },
    { field: 'name', title: 'Name', type: 'string' },
    { field: 'price', title: 'Price', type: 'number' },
  ];
  el.data = [{ id: 1, name: 'Widget', price: 19.99 }];

  el.addEventListener('sort-changed', (e) => {
    console.log(e.detail.payload); // { field, direction }
  });
</script>
```

## Properties vs attributes

Use **properties** for rich values (arrays, objects) and **attributes** for
simple options:

| Property  | Attribute        | Type                                              |
| --------- | ---------------- | ------------------------------------------------- |
| `columns` | —                | `Column[]`                                        |
| `data`    | —                | `DataRow[]`                                       |
| `options` | —                | object of extra `SmartTableOptions` (merged last) |
| —         | `theme`          | `'light' \| 'dark' \| 'corporate'`                |
| —         | `page-size`      | number (`0` = all rows)                           |
| —         | `editable`       | boolean                                           |
| —         | `virtual-scroll` | boolean                                           |
| —         | `responsive`     | boolean                                           |
| —         | `context-menu`   | boolean                                           |
| —         | `group-field`    | string (calls `groupBy`)                          |
| —         | `table-id`       | string                                            |

- Setting `columns` (or any observed attribute) re-renders the table. Setting
  `data` calls `setData()` on the live table — no remount, no scroll reset.
- Setting attributes after mount triggers a rebuild (the shadow host stays put).

## Events

Every default core event is re-emitted as a kebab-cased custom event with
`detail = { payload, table }`:

```ts
el.addEventListener('cell-edit', (e) => console.log(e.detail.payload));
el.addEventListener('toolbar:search', (e) => …); // ':' is preserved
```

A `ready` custom event fires once after the first mount, with the live
`SmartTable` in `detail.table`.

## Plugins

The marketplace plugin API is exposed too — installed plugins are torn down
when the element disconnects:

```ts
import { summaryFooterPlugin } from '@smart-table/core';
import '@smart-table/web';

const el = document.querySelector('smart-table');
el.use(summaryFooterPlugin({ fields: { price: 'sum' } }));
el.unuse('summary-footer');
```

## Accessing the instance

```ts
import { SmartTableCore } from '@smart-table/web';
const table = el.getTable(); // SmartTable | null before first mount
new SmartTableCore({ container, columns, data }); // manual core use if needed
```

## Custom tag names

The spec forbids reusing one constructor for two tags, so
`defineSmartTableElement(tag)` creates a fresh subclass per tag:

```ts
import { defineSmartTableElement } from '@smart-table/web';
defineSmartTableElement('data-grid'); // <data-grid> now works too
```

## Framework hints

- **React**: `<smart-table>` works as a plain intrinsic element; assign `columns`
  / `data` in an effect (wire `ref={el => el.data = rows}` when rows change).
- **Vue**: bind `<smart-table :theme="theme" page-size="10">` — attributes react
  to changes through a rebuild.
- **Anywhere**: `adoptedCallback` is not handled yet — move elements via
  `document.body.append(el)` rather than reparenting across documents.
