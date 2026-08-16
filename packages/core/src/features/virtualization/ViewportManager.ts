import { VirtualScroller, type VirtualRange } from './VirtualScroller';

/**
 * @internal
 *
 * DOM-bound scroll tracking for a virtualized list. Owns a `VirtualScroller`
 * and re-derives the visible range from the actual scroll container on scroll
 * and resize. Updates are coalesced with `requestAnimationFrame` when
 * available, keeping the scroll handler cheap on 100k+ row datasets.
 */
export interface ViewportManagerOptions {
  /** The scrollable element whose `scrollTop`/`clientHeight` are tracked. */
  element: HTMLElement;
  /** Fixed row height in px. Default `40`. */
  rowHeight?: number;
  /** Overscan buffer in rows. Default `10`. */
  overscan?: number;
  /** Height provider override (tests / embedded use). Default: `clientHeight`. */
  heightProvider?: () => number;
  /** Fired whenever the visible range (or scroll metrics) change. */
  onViewportChange: (range: VirtualRange, scrollTop: number, viewportHeight: number) => void;
}

export class ViewportManager {
  private readonly element: HTMLElement;
  private readonly heightProvider: () => number;
  private readonly onViewportChange: (
    range: VirtualRange,
    scrollTop: number,
    viewportHeight: number
  ) => void;
  readonly scroller: VirtualScroller;

  private frame: number | null = null;
  private rafAvailable = typeof requestAnimationFrame === 'function';
  private destroyed = false;

  constructor(options: ViewportManagerOptions) {
    this.element = options.element;
    this.heightProvider = options.heightProvider ?? (() => this.element.clientHeight);
    this.onViewportChange = options.onViewportChange;
    this.scroller = new VirtualScroller({
      rowHeight: options.rowHeight,
      overscan: options.overscan,
    });
    this.element.addEventListener('scroll', this.onScroll, { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => this.recompute());
      observer.observe(this.element);
    }
    this.recompute();
  }

  /** Row count of the virtual content. */
  getTotalRows(): number {
    return this.scroller.getTotalRows();
  }

  /** Updates the row count and refreshes the range when it changed. */
  setTotalRows(total: number): void {
    const previous = this.scroller.getTotalRows();
    this.scroller.setTotalRows(total);
    if (previous !== total) this.recompute();
  }

  getRange(): VirtualRange {
    return this.scroller.getRange();
  }

  /** Current scrollTop of the tracked element. */
  getScrollTop(): number {
    return this.scroller.getScrollTop();
  }

  /** Whether the viewport is near the end of the list. */
  isNearEnd(thresholdRows = 5): boolean {
    return this.scroller.isNearEnd(thresholdRows);
  }

  /** Scrolls so that the given row index is visible. */
  scrollToIndex(index: number): void {
    const top = this.scroller.scrollToIndex(index);
    this.element.scrollTop = top;
    this.recompute();
  }

  /** Programmatically sets the scroll position. */
  setScrollTop(top: number): void {
    this.element.scrollTop = Math.max(0, top);
    this.recompute();
  }

  /**
   * Re-reads dimensions and pushes the current range through the callback.
   * Safe to call after the container was resized or the dataset changed.
   */
  recompute(): void {
    if (this.destroyed) return;
    this.scroller.setViewportHeight(this.heightProvider());
    this.scroller.setScrollTop(this.element.scrollTop);
    this.notify();
  }

  /** Synchronously recomputes using a caller-supplied scrollTop (tests). */
  handleScroll(scrollTop: number): void {
    this.element.scrollTop = scrollTop;
    this.scroller.setViewportHeight(this.heightProvider());
    this.scroller.setScrollTop(scrollTop);
    this.notify();
  }

  private onScroll = (): void => {
    if (!this.rafAvailable) {
      this.recompute();
      return;
    }
    if (this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.recompute();
    });
  };

  private notify(): void {
    const range = this.scroller.getRange();
    this.onViewportChange(range, this.scroller.getScrollTop(), this.scroller.getViewportHeight());
  }

  destroy(): void {
    this.destroyed = true;
    if (this.frame !== null && this.rafAvailable) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.element.removeEventListener('scroll', this.onScroll);
  }
}
