import type { Column, DataRow } from '@smart-table/core';

/** Deterministic pseudo-random generator so the playground is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Dataset {
  id: string;
  label: string;
  columns: Column[];
  rows: DataRow[];
}

const CATEGORIES = ['Electronics', 'Books', 'Clothing', 'Toys', 'Furniture'];
const FIRST = ['Ada', 'Linus', 'Grace', 'Alan', 'Margaret', 'Ken', 'Barbara', 'Dennis'];
const LAST = [
  'Lovelace',
  'Torvalds',
  'Hopper',
  'Turing',
  'Hamilton',
  'Thompson',
  'Liskov',
  'Ritchie',
];
const CITIES = ['Amsterdam', 'Berlin', 'Cairo', 'Madrid', 'Oslo', 'Tokyo'];

function products(count: number): Dataset {
  const rand = mulberry32(42);
  const columns: Column[] = [
    { field: 'id', title: 'ID', type: 'number' },
    { field: 'name', title: 'Name', type: 'string' },
    { field: 'category', title: 'Category', type: 'string' },
    { field: 'price', title: 'Price', type: 'number' },
    { field: 'stock', title: 'Stock', type: 'number' },
    { field: 'rating', title: 'Rating', type: 'number' },
    { field: 'active', title: 'Active', type: 'boolean' },
  ];
  const rows: DataRow[] = Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Product ${i + 1}`,
    category: CATEGORIES[i % 5],
    price: Math.round((5 + rand() * 1495) * 100) / 100,
    stock: Math.floor(rand() * 900),
    rating: Math.round((1 + rand() * 4) * 10) / 10,
    active: rand() > 0.3,
  }));
  return { id: 'products', label: `Products (${count.toLocaleString()} rows)`, columns, rows };
}

function employees(count: number): Dataset {
  const rand = mulberry32(7);
  const rows: DataRow[] = Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `${FIRST[i % 8]} ${LAST[(i * 7) % 8]}`,
    city: CITIES[i % 6],
    salary: Math.round(30000 + rand() * 120000),
    seniority: ['Junior', 'Mid', 'Senior', 'Lead'][i % 4],
  }));
  return {
    id: 'employees',
    label: `Employees (${count.toLocaleString()} rows)`,
    columns: [
      { field: 'id', title: 'ID', type: 'number' },
      { field: 'name', title: 'Name', type: 'string' },
      { field: 'city', title: 'City', type: 'string' },
      { field: 'salary', title: 'Salary', type: 'number' },
      { field: 'seniority', title: 'Seniority', type: 'string' },
    ],
    rows,
  };
}

function treeData(): Dataset {
  const rows: DataRow[] = Array.from({ length: 50 }, (_, group) => ({
    id: `g${group}`,
    name: `Group ${group}`,
    category: CATEGORIES[group % 5],
    children: Array.from({ length: (group % 5) + 2 }, (_, i) => ({
      id: `g${group}-${i}`,
      name: `Item ${group}.${i}`,
      category: CATEGORIES[group % 5],
      value: (group + 1) * (i + 1) * 10,
      children:
        i === 0
          ? [
              {
                id: `g${group}-${i}-0`,
                name: `Leaf ${group}.${i}`,
                category: CATEGORIES[group % 5],
                value: 5,
              },
            ]
          : undefined,
    })),
  }));
  return {
    id: 'tree',
    label: 'Org tree',
    columns: [
      { field: 'name', title: 'Name', type: 'string' },
      { field: 'category', title: 'Category', type: 'string' },
      { field: 'value', title: 'Value', type: 'number' },
    ],
    rows,
  };
}

export const DATASETS: Dataset[] = [
  products(1000),
  products(50000),
  products(100000),
  employees(50000),
  treeData(),
];

export const DEFAULT_DATASET = DATASETS[1]!;
