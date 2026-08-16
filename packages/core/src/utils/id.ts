let counter = 0;

/**
 * Generates a unique identifier string.
 * Uses `crypto.randomUUID` when available and falls back to a counter +
 * random suffix (works in older browsers and non-secure contexts).
 */
export function createId(prefix = 'st'): string {
  counter += 1;
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
