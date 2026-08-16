import { createElement, clearChildren } from './dom';

/** A rendered menu entry. */
export interface ContextMenuEntry {
  id: string;
  label: string;
  enabled: boolean;
  onSelect: () => void;
}

/**
 * The built-in right-click menu. A single instance is owned by the renderer
 * and mounted into the table root; it opens with a list of entries at a
 * cursor position, is keyboard-navigable (arrows + Enter, Escape to close)
 * and closes on outside click, blur or another context menu.
 */
export class ContextMenu {
  readonly element: HTMLDivElement;

  private readonly root: HTMLElement;
  private readonly entries = new Map<string, ContextMenuEntry>();
  private cleanup: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.element = createElement('div', {
      className: 'st-context-menu',
      attrs: { role: 'menu', hidden: '', tabindex: '-1' },
    });
    this.element.addEventListener('keydown', this.onKeydown);
    this.element.addEventListener('mousedown', (event) => event.stopPropagation());
    this.root.appendChild(this.element);
  }

  get isOpen(): boolean {
    return !this.element.hidden;
  }

  /** Opens the menu at a position relative to the root element. */
  open(entries: ContextMenuEntry[], x: number, y: number): void {
    clearChildren(this.element);
    this.entries.clear();
    for (const entry of entries) {
      const button = createElement('button', {
        className: 'st-context-item',
        attrs: { type: 'button', role: 'menuitem', 'data-st-menu-item': entry.id },
        text: entry.label,
      });
      button.disabled = !entry.enabled;
      button.addEventListener('click', () => this.select(entry));
      this.element.appendChild(button);
      this.entries.set(entry.id, entry);
    }

    this.element.hidden = false;
    this.position(x, y);
    this.attach();
    this.element.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }

  close(): void {
    if (!this.isOpen) return;
    this.element.hidden = true;
    this.element.style.left = '';
    this.element.style.top = '';
    clearChildren(this.element);
    this.entries.clear();
    this.detach();
  }

  // ------------------------------------------------------------- internals

  private position(x: number, y: number): void {
    const width = this.element.offsetWidth || 160;
    const height = this.element.offsetHeight || 120;
    const maxX = Math.max(this.root.clientWidth, 0);
    const maxY = Math.max(this.root.clientHeight, 0);
    let left = x;
    let top = y;
    if (maxX > 0 && left + width > maxX) left = Math.max(0, maxX - width);
    if (maxY > 0 && top + height > maxY) top = Math.max(0, maxY - height);
    this.element.style.left = `${Math.round(left)}px`;
    this.element.style.top = `${Math.round(top)}px`;
  }

  private select(entry: ContextMenuEntry): void {
    this.close();
    entry.onSelect();
  }

  private onKeydown = (event: KeyboardEvent): void => {
    if (this.element.hidden) return;
    const buttons = this.element.querySelectorAll<HTMLButtonElement>('button');
    if (buttons.length === 0) return;
    const activeIndex = Array.from(buttons).indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const enabled = Array.from(buttons)
        .map((b, i) => ({ b, i }))
        .filter(({ b }) => !b.disabled);
      if (enabled.length === 0) return;
      const current = enabled.findIndex(({ i }) => i === activeIndex);
      const next =
        event.key === 'ArrowDown'
          ? enabled[(current + 1) % enabled.length]
          : enabled[(current - 1 + enabled.length) % enabled.length];
      next?.b.focus();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      const active = document.activeElement as HTMLButtonElement | null;
      if (active?.dataset.stMenuItem) {
        event.preventDefault();
        active.click();
      }
    }
  };

  private onPointerDown = (event: MouseEvent | PointerEvent): void => {
    if (this.element.hidden) return;
    if (this.element.contains(event.target as Node)) return;
    this.close();
  };

  private onContextMenu = (): void => {
    this.close();
  };

  private onBlur = (): void => {
    this.close();
  };

  private attach(): void {
    document.addEventListener('mousedown', this.onPointerDown, true);
    document.addEventListener('pointerdown', this.onPointerDown, true);
    document.addEventListener('contextmenu', this.onContextMenu, true);
    window.addEventListener('blur', this.onBlur);
    this.cleanup = () => {
      document.removeEventListener('mousedown', this.onPointerDown, true);
      document.removeEventListener('pointerdown', this.onPointerDown, true);
      document.removeEventListener('contextmenu', this.onContextMenu, true);
      window.removeEventListener('blur', this.onBlur);
      this.cleanup = null;
    };
  }

  private detach(): void {
    this.cleanup?.();
  }
}
