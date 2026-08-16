import type { Column, ColumnValidators, DataRow } from '../types/column';

/** A validation problem reported against a single field. */
export interface ValidationError {
  field: string;
  messages: string[];
}

/** All validation problems for a row. */
export type ValidationResult = ValidationError[];

function toNumber(value: unknown): number | null {
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isEmpty(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}

function compilePattern(pattern: string | RegExp): RegExp {
  return pattern instanceof RegExp ? pattern : new RegExp(pattern);
}

/** Whether a column defines any validation rules. */
export function hasValidators(column: Column): boolean {
  const v = column.validators;
  if (!v) return false;
  return (
    v.required === true ||
    v.min !== undefined ||
    v.max !== undefined ||
    v.minLength !== undefined ||
    v.maxLength !== undefined ||
    v.pattern !== undefined ||
    v.custom !== undefined
  );
}

/**
 * Validates a single column against a row and returns every error message
 * (empty array when the value is accepted).
 */
export function validateColumnValue(column: Column, row: DataRow): string[] {
  const validators: ColumnValidators | undefined = column.validators;
  if (!validators) return [];
  const value = row[column.field];
  const messages: string[] = [];

  if (validators.required && isEmpty(value)) {
    messages.push('This field is required');
  }

  if (validators.min !== undefined || validators.max !== undefined) {
    const num = toNumber(value);
    if (num !== null) {
      if (validators.min !== undefined && num < validators.min) {
        messages.push(`Must be at least ${validators.min}`);
      }
      if (validators.max !== undefined && num > validators.max) {
        messages.push(`Must be at most ${validators.max}`);
      }
    }
  }

  if (
    validators.minLength !== undefined &&
    typeof value === 'string' &&
    value.length < validators.minLength
  ) {
    messages.push(`Must be at least ${validators.minLength} characters`);
  }
  if (
    validators.maxLength !== undefined &&
    typeof value === 'string' &&
    value.length > validators.maxLength
  ) {
    messages.push(`Must be at most ${validators.maxLength} characters`);
  }

  if (validators.pattern !== undefined && typeof value === 'string' && value !== '') {
    if (!compilePattern(validators.pattern).test(value)) {
      messages.push('Does not match the required pattern');
    }
  }

  if (validators.custom) {
    const result = validators.custom(value, row);
    if (result !== true) messages.push(result);
  }

  return messages;
}

/** Validates every column against a row. Columns without rules are skipped. */
export function validateRow(columns: Column[], row: DataRow): ValidationResult {
  const result: ValidationResult = [];
  for (const column of columns) {
    if (!hasValidators(column)) continue;
    const messages = validateColumnValue(column, row);
    if (messages.length > 0) result.push({ field: column.field, messages });
  }
  return result;
}

/** Whether a row passes every column's validation rules. */
export function isRowValid(columns: Column[], row: DataRow): boolean {
  return validateRow(columns, row).length === 0;
}
