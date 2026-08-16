/**
 * Structured filters power the `where()` API and the Filter Builder UI.
 * The headless core stores each filter as an operator plus its operands so a
 * UI can render (and later edit) exactly what the user configured.
 */

/** Supported filter operators. */
export type FilterOperator =
  | 'equals'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'lessThan'
  | 'between'
  | 'inList';

/** A single value accepted as a filter operand. */
export type FilterScalar = string | number | boolean | Date | null;

/** One or two values passed to an operator. `inList` uses an array. */
export type FilterOperand = FilterScalar | FilterScalar[];

/** A structured filter applied to one column. */
export interface StructuredFilter {
  field: string;
  operator: FilterOperator;
  operands: FilterOperand[];
}
