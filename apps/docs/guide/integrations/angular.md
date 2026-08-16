# Angular

See the [framework integrations overview](/guide/integrations/react).

Package: [`@smart-table/angular`](https://www.npmjs.com)

```ts
import { Component } from '@angular/core';
import { SmartTableComponent } from '@smart-table/angular';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SmartTableComponent],
  template: `
    <smart-table
      [columns]="columns"
      [data]="rows"
      [theme]="'dark'"
      (ready)="onReady($event)"
      (dataChange)="rows = $event"
    />
  `,
})
export class AppComponent {
  onReady(table: unknown) {
    console.log(table.getRowCount());
  }
}
```

- **Inputs** mirror core options: `[editable]`, `[mode]`, `[theme]`, `[responsive]`, `[pageSize]`, `[virtualScroll]`, `[contextMenu]`, `[dataSource]`, `[infiniteScroll]`, `[tree]`, `[aggregations]`, `[columns]`, `[data]`, `[className]`.
- **Outputs** mirror core events: `sortChanged`, `filterChanged`, `pageChanged`, `cellEdit`, `rowAdded`, `rowDeleted`, `selectionChanged`, `groupChanged`, `modeChanged`, `dataLoaded` — plus `ready` (the table instance) and `dataChange` (controlled mode).
- Add `@smart-table/core/dist/smart-table.css` to your app styles.

The heavy lifting lives in `SmartTableController` — a framework-agnostic lifecycle wrapper you can also use directly.
