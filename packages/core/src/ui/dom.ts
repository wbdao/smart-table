/**
 * Small DOM helpers used by the renderers. Everything here is defensive about
 * `document` so the module is safe to import in Node (jsdom-less) contexts.
 */

/** Creates an element with optional class list, attributes and children. */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  init: {
    className?: string;
    attrs?: Record<string, string>;
    text?: string;
    children?: (Node | string)[];
  } = {}
): HTMLElementTagNameMap[K] {
  if (typeof document === 'undefined') {
    throw new Error('createElement requires a DOM environment.');
  }
  const el = document.createElement(tag);
  if (init.className) el.className = init.className;
  if (init.attrs) {
    for (const [name, value] of Object.entries(init.attrs)) {
      el.setAttribute(name, value);
    }
  }
  if (init.text !== undefined) el.textContent = init.text;
  if (init.children) {
    for (const child of init.children) {
      if (child === null || child === undefined) continue;
      el.append(child);
    }
  }
  return el;
}

/** Replaces every child of `el` with a single text node. */
export function setText(el: Element, text: string): void {
  el.textContent = text;
}

/** Removes all child nodes from `el`. */
export function clearChildren(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** Resolves a CSS selector / element to an element, or `null`. */
export function resolveElement(
  target: HTMLElement | string | null | undefined
): HTMLElement | null {
  if (target === null || target === undefined) return null;
  if (typeof target === 'string') {
    if (typeof document === 'undefined') return null;
    return document.querySelector<HTMLElement>(target);
  }
  return target;
}

/** Adds a delegated event listener that filters by a CSS selector. */
export function delegate<K extends keyof HTMLElementEventMap>(
  root: HTMLElement,
  event: string,
  selector: string,
  handler: (el: HTMLElement, event: HTMLElementEventMap[K]) => void
): () => void {
  const listener = (ev: Event) => {
    const target = ev.target as Element | null;
    if (!target) return;
    const closest = target.closest<HTMLElement>(selector);
    if (closest && root.contains(closest)) handler(closest, ev as HTMLElementEventMap[K]);
  };
  root.addEventListener(event, listener);
  return () => root.removeEventListener(event, listener);
}
