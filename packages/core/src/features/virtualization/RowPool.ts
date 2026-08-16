/**
 * @internal
 *
 * A minimal DOM node pool. Rendering a virtualized window acquires row
 * elements from the pool, and elements that leave the window are released back
 * into it instead of being discarded. This avoids creating/destroying DOM
 * nodes continuously while scrolling.
 */
export class RowPool<T extends HTMLElement> {
  private readonly create: () => T;
  private readonly pool: T[] = [];
  private readonly used = new Set<T>();

  constructor(create: () => T) {
    this.create = create;
  }

  /** Number of nodes cached in the pool (not currently in use). */
  getPoolSize(): number {
    return this.pool.length;
  }

  /** Total nodes created so far (in-use + pooled) — useful for benchmarking. */
  getCreatedCount(): number {
    return this.pool.length + this.used.size;
  }

  /** Marks an element as in use and returns it. */
  acquire(): T {
    const node = this.pool.pop() ?? this.create();
    this.used.add(node);
    return node;
  }

  /** Returns an element to the pool. */
  release(node: T): void {
    if (this.used.delete(node)) this.pool.push(node);
  }

  /**
   * Keeps exactly the given elements in use, releasing every other pooled/in-use
   * node. Callers pass the elements they just rendered; the rest go back to the
   * pool. Returns the kept elements in the given order.
   */
  recycle(keep: Iterable<T>): T[] {
    const kept = new Set(keep);
    for (const node of this.used) {
      if (!kept.has(node)) this.pool.push(node);
    }
    this.used.clear();
    for (const node of keep) this.used.add(node);
    return Array.from(keep);
  }

  /** Releases every node back into the pool. */
  releaseAll(): void {
    for (const node of this.used) this.pool.push(node);
    this.used.clear();
  }

  /** Drops every cached node (they are no longer referenced by the caller). */
  dispose(): void {
    this.pool.length = 0;
    this.used.clear();
  }
}
