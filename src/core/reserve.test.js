import { describe, it, expect } from 'vitest';
import { act, reserve, ref } from '../index.js';
import { actRegistry } from './registry.js';
import { setupBeforeEach } from '../../test/setup.js';

setupBeforeEach();

describe('reserve()', () => {
  it('returns a frozen object with id, _type, name, opts', () => {
    const reserved = reserve(act('Review'));
    expect(reserved).toBeDefined();
    expect(reserved.id).toMatch(/^wm_act_/);
    expect(reserved._type).toBe('act');
    expect(reserved.name).toBe('Review');
    expect(reserved.opts).toBeNull();
    expect(Object.isFrozen(reserved)).toBe(true);
  });

  it('preserves opts from the descriptor', () => {
    const reserved = reserve(act('Review', { repo: 'api' }));
    expect(reserved.opts).toEqual({ repo: 'api' });
  });

  it('generates IDs with correct prefix (wm_act_)', () => {
    const reserved = reserve(act('Test'));
    expect(reserved.id).toMatch(/^wm_act_/);
  });

  it('registers the reserved ID as a stub in actRegistry', () => {
    const reserved = reserve(act('Review'));
    const entry = actRegistry.get(reserved.id);
    expect(entry).toBeDefined();
    expect(entry.id).toBe(reserved.id);
    expect(entry.stub).toBe(true);
  });

  it('ref() resolves a reserved act to its id', () => {
    const reserved = reserve(act('Review'));
    expect(ref(reserved)).toBe(reserved.id);
  });

  it('throws on non-descriptor input (string)', () => {
    expect(() => reserve('hello')).toThrow('reserve() requires a descriptor');
  });

  it('throws on non-descriptor input (number)', () => {
    expect(() => reserve(42)).toThrow('reserve() requires a descriptor');
  });

  it('throws on undefined input', () => {
    expect(() => reserve(undefined)).toThrow('reserve() requires a descriptor');
  });

  it('throws on null input', () => {
    expect(() => reserve(null)).toThrow('reserve() requires a descriptor');
  });

  it('generates a unique ID on each call', () => {
    const a = reserve(act('A'));
    const b = reserve(act('B'));
    expect(a.id).not.toBe(b.id);
  });
});
