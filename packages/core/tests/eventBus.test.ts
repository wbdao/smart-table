import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/core/EventBus';

interface TestEvents {
  ping: { value: number };
  label: string;
  anything: unknown;
}

describe('EventBus', () => {
  it('emits payloads to registered handlers', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    bus.on('ping', handler);
    bus.emit('ping', { value: 42 });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ value: 42 });
  });

  it('supports multiple handlers per event', () => {
    const bus = new EventBus<TestEvents>();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('label', a);
    bus.on('label', b);
    bus.emit('label', 'hello');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('off removes a handler', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    bus.on('ping', handler);
    bus.off('ping', handler);
    bus.emit('ping', { value: 1 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns an unsubscribe function from on', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    const unsubscribe = bus.on('ping', handler);
    unsubscribe();
    bus.emit('ping', { value: 1 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('once fires a single time', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    bus.once('ping', handler);
    bus.emit('ping', { value: 1 });
    bus.emit('ping', { value: 2 });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ value: 1 });
  });

  it('once handlers can be unsubscribed before firing', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    const unsubscribe = bus.once('ping', handler);
    unsubscribe();
    bus.emit('ping', { value: 1 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('duplicate handler registrations are ignored', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    bus.on('ping', handler);
    bus.on('ping', handler);
    expect(bus.listenerCount('ping')).toBe(1);
    bus.emit('ping', { value: 1 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when no listeners exist', () => {
    const bus = new EventBus<TestEvents>();
    expect(() => bus.emit('ping', { value: 1 })).not.toThrow();
    expect(() => bus.emit('anything', undefined)).not.toThrow();
  });

  it('reports listener counts', () => {
    const bus = new EventBus<TestEvents>();
    bus.on('label', () => {});
    bus.on('label', () => {});
    expect(bus.listenerCount('label')).toBe(2);
    expect(bus.listenerCount('ping')).toBe(0);
    expect(bus.hasListeners('label')).toBe(true);
    expect(bus.hasListeners('ping')).toBe(false);
  });

  it('allows handlers to unsubscribe other handlers during emission safely', () => {
    const bus = new EventBus<TestEvents>();
    const b = vi.fn();
    const a = vi.fn(() => bus.off('ping', b));
    bus.on('ping', a);
    bus.on('ping', b);
    bus.emit('ping', { value: 1 });
    expect(a).toHaveBeenCalledTimes(1);
    // b was already snapshotted before a ran, so it still fires this time.
    expect(b).toHaveBeenCalledTimes(1);
    bus.emit('ping', { value: 2 });
    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('supports emitting inside a handler (re-entrancy)', () => {
    const bus = new EventBus<TestEvents>();
    const inner = vi.fn();
    const outer = vi.fn(() => bus.emit('label', 'nested'));
    bus.on('ping', outer);
    bus.on('label', inner);
    bus.emit('ping', { value: 1 });
    expect(outer).toHaveBeenCalledTimes(1);
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it('clear removes all handlers, optionally per event', () => {
    const bus = new EventBus<TestEvents>();
    const ping = vi.fn();
    const label = vi.fn();
    bus.on('ping', ping);
    bus.on('label', label);

    bus.clear('ping');
    bus.emit('ping', { value: 1 });
    bus.emit('label', 'x');
    expect(ping).not.toHaveBeenCalled();
    expect(label).toHaveBeenCalledTimes(1);

    bus.clear();
    bus.emit('label', 'x');
    expect(label).toHaveBeenCalledTimes(1);
  });
});
