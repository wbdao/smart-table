/**
 * A small, typed event bus at the heart of SmartTableJS.
 *
 * Every table instance owns one bus. The bus is deliberately framework
 * agnostic: any object can be emitted as a payload and handlers receive the
 * payload as their only argument.
 *
 * Design notes:
 * - Handlers are stored per-event in a `Set`, so registering the same handler
 *   twice for the same event is a no-op.
 * - `emit` iterates over a snapshot of the handler set, so handlers may
 *   safely subscribe/unsubscribe during emission without skipping or
 *   double-firing other handlers.
 * - `once` wraps the handler so `off` and the returned unsubscribe function
 *   work with it just like a regular handler.
 */

export type EventHandler<T = unknown> = (payload: T) => void;

export class EventBus<Events extends object = Record<string, unknown>> {
  private readonly handlers = new Map<keyof Events, Set<EventHandler<unknown>>>();

  /** Registers a handler. Returns an unsubscribe function. */
  on<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): () => void {
    this.getHandlerSet(event).add(handler as EventHandler<unknown>);
    return () => this.off(event, handler);
  }

  /** Registers a handler that fires at most once. Returns an unsubscribe function. */
  once<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): () => void {
    const wrapped: EventHandler<Events[K]> = (payload) => {
      this.off(event, wrapped);
      handler(payload);
    };
    this.getHandlerSet(event).add(wrapped as EventHandler<unknown>);
    return () => this.off(event, wrapped);
  }

  /** Removes a previously registered handler. */
  off<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): void {
    this.handlers.get(event)?.delete(handler as EventHandler<unknown>);
  }

  /** Synchronously notifies every handler registered for `event`. */
  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.handlers.get(event);
    if (!set || set.size === 0) return;
    for (const handler of [...set]) {
      handler(payload);
    }
  }

  /** Number of handlers currently registered for `event`. */
  listenerCount<K extends keyof Events>(event: K): number {
    return this.handlers.get(event)?.size ?? 0;
  }

  /** Whether at least one handler is registered for `event`. */
  hasListeners<K extends keyof Events>(event: K): boolean {
    return this.listenerCount(event) > 0;
  }

  /** Removes all handlers, or only those of one event. */
  clear(event?: keyof Events): void {
    if (event) {
      this.handlers.delete(event);
      return;
    }
    this.handlers.clear();
  }

  private getHandlerSet<K extends keyof Events>(event: K): Set<EventHandler<unknown>> {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set<EventHandler<unknown>>();
      this.handlers.set(event, set);
    }
    return set;
  }
}
