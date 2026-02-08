import { describe, it, expect } from 'vitest';
import { warp, run, group, add, flush } from '../index.js';
import { runRegistry, groupRegistry } from '../core/registry.js';
import { setupBeforeEach, createMockOpenAI, OPENAI_RESPONSE, parseFlushedBody } from '../../test/setup.js';

setupBeforeEach();

describe('add()', () => {
  it('links a group to a run', async () => {
    const r = run('test');
    const g = group('step');
    add(r, g);

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

  it('links an LLM response to a group', async () => {
    const client = createMockOpenAI(OPENAI_RESPONSE);
    const wrapped = warp(client);
    const response = await wrapped.chat.completions.create({ model: 'gpt-4o-mini', messages: [] });

    const g = group('step');
    add(g, response);

    const groupData = groupRegistry.get(g.id);
    expect(groupData.calls).toHaveLength(1);
    expect(groupData.calls[0]).toMatch(/^wm_call_/);
  });

  it('accepts multiple items at once', () => {
    const r = run('test');
    const g1 = group('a');
    const g2 = group('b');
    add(r, g1, g2);

    const data = runRegistry.get(r.id);
    expect(data.groups).toHaveLength(2);
  });

  it('ignores unrecognised targets', () => {
    add('not-a-target', group('step'));
    // no error thrown, silently ignored
  });

  it('ignores adding a run to another run', () => {
    const r1 = run('parent');
    const r2 = run('child');
    add(r1, r2);

    const data = runRegistry.get(r1.id);
    expect(data.groups).toHaveLength(0);
  });

  it('ignores untracked items', () => {
    const r = run('test');
    add(r, { notAnLLMResponse: true });

    const data = runRegistry.get(r.id);
    expect(data.calls).toHaveLength(0);
  });

  it('nests groups inside groups', () => {
    const r = run('test');
    const parent = group('outer');
    const child = group('inner');

    add(parent, child);
    add(r, parent);

    const parentData = groupRegistry.get(parent.id);
    expect(parentData.groups).toContain(child.id);

    const childData = groupRegistry.get(child.id);
    expect(childData.parentId).toBe(parent.id);
  });
});
