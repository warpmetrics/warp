import { describe, it, expect } from 'vitest';
import { run, group, flush } from '../index.js';
import { runRegistry, groupRegistry } from '../core/registry.js';
import { setupBeforeEach, parseFlushedBody } from '../../test/setup.js';

setupBeforeEach();

describe('group()', () => {
  it('returns a frozen object with id and _type', () => {
    const r = run('test');
    const g = group(r, 'planner');
    expect(g.id).toMatch(/^wm_grp_/);
    expect(g._type).toBe('group');
    expect(Object.isFrozen(g)).toBe(true);
  });

  it('stores data in groupRegistry', () => {
    const r = run('test');
    const g = group(r, 'planner', { name: 'Planning Phase' });
    const data = groupRegistry.get(g.id);
    expect(data.label).toBe('planner');
    expect(data.opts).toEqual({ name: 'Planning Phase' });
  });

  it('links group to run immediately', async () => {
    const r = run('test');
    const g = group(r, 'step');

    const runData = runRegistry.get(r.id);
    expect(runData.groups).toContain(g.id);

    const groupData = groupRegistry.get(g.id);
    expect(groupData.parentId).toBe(r.id);

    await flush();
    const body = parseFlushedBody(0);
    const link = body.links.find(l => l.childId === g.id);
    expect(link).toBeDefined();
    expect(link.parentId).toBe(r.id);
    expect(link.type).toBe('group');
  });

  it('nests groups inside groups', async () => {
    const r = run('test');
    const parent = group(r, 'outer');
    const child = group(parent, 'inner');

    const parentData = groupRegistry.get(parent.id);
    expect(parentData.groups).toContain(child.id);

    const childData = groupRegistry.get(child.id);
    expect(childData.parentId).toBe(parent.id);

    await flush();
    const body = parseFlushedBody(0);
    expect(body.links).toHaveLength(2); // run->outer, outer->inner
  });
});
