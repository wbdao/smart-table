import type { FilterOperand, FilterOperator } from '../types/filter';

/** Every supported filter operator, in UI order. */
export const FILTER_OPERATORS: readonly FilterOperator[] = [
  'equals',
  'contains',
  'startsWith',
  'endsWith',
  'greaterThan',
  'lessThan',
  'between',
  'inList',
];

/** Human-readable labels used by the Filter Builder UI. */
export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: 'Equals',
  contains: 'Contains',
  startsWith: 'Starts with',
  endsWith: 'Ends with',
  greaterThan: 'Greater than',
  lessThan: 'Less than',
  between: 'Between',
  inList: 'In list',
};

/** Number of operand inputs the Filter Builder should render. */
export const OPERAND_COUNT: Record<FilterOperator, number> = {
  equals: 1,
  contains: 1,
  startsWith: 1,
  endsWith: 1,
  greaterThan: 1,
  lessThan: 1,
  between: 2,
  inList: 1,
};

export function isFilterOperator(value: unknown): value is FilterOperator {
  return FILTER_OPERATORS.includes(value as FilterOperator);
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asText(value: unknown): string {
  return String(value ?? '').toLocaleLowerCase();
}

function listOf(operands: readonly FilterOperand[]): unknown[] {
  const first = operands[0];
  return Array.isArray(first) ? first : [...operands];
}

/**
 * Evaluates an operator against a raw cell value.
 * `operands` holds the user-supplied arguments passed to `where()`.
 */
export function matchesOperator(
  operator: FilterOperator,
  value: unknown,
  operands: readonly FilterOperand[]
): boolean {
  switch (operator) {
    case 'equals':
      return asText(value) === asText(operands[0]);
    case 'contains':
      return asText(value).includes(asText(operands[0]));
    case 'startsWith':
      return asText(value).startsWith(asText(operands[0]));
    case 'endsWith':
      return asText(value).endsWith(asText(operands[0]));
    case 'greaterThan': {
      const a = asNumber(value);
      const b = asNumber(operands[0]);
      return a !== null && b !== null && a > b;
    }
    case 'lessThan': {
      const a = asNumber(value);
      const b = asNumber(operands[0]);
      return a !== null && b !== null && a < b;
    }
    case 'between': {
      const a = asNumber(value);
      const lo = asNumber(operands[0]);
      const hi = asNumber(operands[1]);
      return a !== null && lo !== null && hi !== null && a >= lo && a <= hi;
    }
    case 'inList': {
      const list = listOf(operands).map((item) => asText(item));
      return list.includes(asText(value));
    }
    default:
      return false;
  }
}
