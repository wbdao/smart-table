// Reference code for an Angular 17+ application using the adapter.
// Copy into a real Angular project (see README.md) — it is intentionally not
// part of the adapter's build or typecheck.
import { Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { SmartTableComponent } from '../src/index';
import type { Column, DataRow } from '@smart-table/core';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SmartTableComponent],
  template: `
    <smart-table
      [columns]="columns"
      [data]="rows"
      [pageSize]="20"
      [theme]="'dark'"
      (dataChange)="rows = $event"
      (sortChanged)="onSort($event)"
    />
  `,
})
export class AppComponent {
  columns: Column[] = [
    { field: 'id', title: 'ID', type: 'number' },
    { field: 'name', title: 'Name', type: 'string' },
    { field: 'price', title: 'Price', type: 'number' },
  ];
  rows: DataRow[] = Array.from({ length: 200 }, (_, i) => ({
    id: i + 1,
    name: `Product ${i + 1}`,
    price: Math.round((10 + Math.random() * 990) * 100) / 100,
  }));
  onSort(event: unknown) {
    console.log('sortChanged', event);
  }
}

bootstrapApplication(AppComponent).catch((err) => console.error(err));
