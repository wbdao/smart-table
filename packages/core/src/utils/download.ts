/**
 * Triggers a browser download for `content` under `filename`. Safe to call in
 * non-DOM environments (SSR / tests) where it silently does nothing.
 */
export function downloadFile(filename: string, content: string, mimeType: string): void {
  if (typeof document === 'undefined') return;
  if (typeof Blob === 'undefined' || typeof URL === 'undefined') return;
  if (typeof URL.createObjectURL !== 'function') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
