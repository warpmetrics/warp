import { describe, it, expect } from 'vitest';
import { group } from '../index.js';
import { groupRegistry } from '../core/registry.js';
import { setupBeforeEach } from '../../test/setup.js';

setupBeforeEach();

describe('group()', () => {
  it('returns a frozen object with id and _type', () => {
    const g = group('planner');
    expect(g.id).toMatch(/^wm_grp_/);
    expect(g._type).toBe('group');
    expect(Object.isFrozen(g)).toBe(true);
  });

  it('stores data in groupRegistry', () => {
    const g = group('planner', { name: 'Planning Phase' });
    const data = groupRegistry.get(g.id);
    expect(data.label).toBe('planner');
    expect(data.name).toBe('Planning Phase');
  });
});
