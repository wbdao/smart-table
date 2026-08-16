/**
 * Pure virtual-scrolling math. Computes the visible window of a fixed-row-height
 * list from the scroll position, viewport height, row height and overscan.
 * No DOM access — unit-testable in Node and reusable by any renderer.
 *
 * @internal — the exported surface may change without a major bump.
 */
export interface VirtualRange {
  /** First row index to render (clamped to `>= 0`). */
  start: number;
  /** One past the last row index to render (clamped to `<= totalRows`). */
  end: number;
}

export interface VirtualScrollerOptions {
  /** Fixed row height in px. Default `40`. */
  rowHeight?: number;
  /** Extra rows rendered above/below the viewport. Default `10`. */
  overscan?: number;
}

const DEFAULT_ROW_HEIGHT = 40;
const DEFAULT_OVERSCAN = 10;

export class VirtualScroller {
  private rowHeight: number;
  private overscan: number;
  private totalRows = 0;
  private viewportHeight = 0;
  private scrollTop = 0;

  constructor(options: VirtualScrollerOptions = {}) {
    this.rowHeight = options.rowHeight ?? DEFAULT_ROW_HEIGHT;
    this.overscan = options.overscan ?? DEFAULT_OVERSCAN;
  }

  getRowHeight(): number {
    return this.rowHeight;
  }

  getOverscan(): number {
    return this.overscan;
  }

  setRowHeight(rowHeight: number): void {
    if (Number.isFinite(rowHeight) && rowHeight > 0) this.rowHeight = rowHeight;
  }

  setOverscan(overscan: number): void {
    if (Number.isInteger(overscan) && overscan >= 0) this.overscan = overscan;
  }

  setTotalRows(totalRows: number): void {
    this.totalRows = Math.max(0, Math.floor(totalRows));
    this.clampScrollTop();
  }

  getTotalRows(): number {
    return this.totalRows;
  }

  setViewportHeight(height: number): void {
    this.viewportHeight = Math.max(0, height);
  }

  getViewportHeight(): number {
    return this.viewportHeight;
  }

  setScrollTop(scrollTop: number): void {
    this.scrollTop = Math.max(0, scrollTop);
    this.clampScrollTop();
  }

  getScrollTop(): number {
    return this.scrollTop;
  }

  /** Total height of the virtual content (drives the scrollbar). */
  getTotalHeight(): number {
    return this.totalRows * this.rowHeight;
  }

  /** Number of rows that fit in the viewport (min 1). */
  getVisibleCount(): number {
    return Math.max(1, Math.ceil(this.viewportHeight / this.rowHeight));
  }

  /**
   * The current visible window. `start`/`end` are already clamped into the
   * row range and include the overscan buffer.
   */
  getRange(): VirtualRange {
    if (this.totalRows === 0) return { start: 0, end: 0 };
    const firstVisible = Math.floor(this.scrollTop / this.rowHeight);
    const visibleCount = this.getVisibleCount();
    const start = Math.max(0, firstVisible - this.overscan);
    const end = Math.min(this.totalRows, firstVisible + visibleCount + this.overscan);
    return { start, end };
  }

  /**
   * Whether the end of the list is near the viewport bottom. Used by infinite
   * scroll to trigger loading the next page.
   */
  isNearEnd(thresholdRows = 5): boolean {
    if (this.totalRows === 0) return true;
    const lastVisible = Math.ceil(this.scrollTop / this.rowHeight) + this.getVisibleCount();
    return lastVisible >= this.totalRows - thresholdRows;
  }

  /** Scrolls so that the row at `index` is visible. Returns the scrollTop used. */
  scrollToIndex(index: number): number {
    const target = Math.max(0, Math.min(index, this.totalRows - 1));
    this.scrollTop = target * this.rowHeight;
    this.clampScrollTop();
    return this.scrollTop;
  }

  private clampScrollTop(): void {
    const maxScroll = Math.max(0, this.getTotalHeight() - this.viewportHeight);
    if (this.scrollTop > maxScroll) this.scrollTop = maxScroll;
  }
}
