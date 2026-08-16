/**
 * Deep-clones a value. Uses the native `structuredClone` when available and
 * falls back to a JSON round-trip. The JSON fallback intentionally does not
 * preserve `undefined`/functions — document data is JSON-safe by design.
 */
export function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}
