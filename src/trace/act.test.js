import { describe, it, expect } from 'vitest';
import { warp, run, group, act, flush } from '../index.js';
import { setupBeforeEach, createMockOpenAI, OPENAI_RESPONSE, parseFlushedBody } from '../../test/setup.js';

setupBeforeEach();

describe('act()', () => {
  it('enqueues an act event for a run', async () => {
    const r = run('test');
    act(r, 'improve-section');
    await flush();

    const body = parseFlushedBody(0);
    const a = body.acts.find(e => e.name === 'improve-section');
    expect(a).toBeDefined();
    expect(a.targetId).toBe(r.id);
  });

  it('works with a ref string', async () => {
    act('wm_grp_abc123', 'refine-prompt');
    await flush();

    const body = parseFlushedBody(0);
    expect(body.acts[0].targetId).toBe('wm_grp_abc123');
    expect(body.acts[0].name).toBe('refine-prompt');
  });

  it('ignores unrecognised targets', () => {
    act({}, 'test');
    // no error thrown, silently ignored
  });

  it('works on an LLM response', async () => {
    const client = createMockOpenAI(OPENAI_RESPONSE);
    const wrapped = warp(client);
    const response = await wrapped.chat.completions.create({ model: 'gpt-4o-mini', messages: [] });

    act(response, 'regenerated');
    await flush();

    const body = parseFlushedBody(0);
    const a = body.acts.find(e => e.name === 'regenerated');
    expect(a.targetId).toMatch(/^wm_call_/);
  });

  it('works without metadata', async () => {
    const r = run('test');
    act(r, 'improve-section');
    await flush();

    const body = parseFlushedBody(0);
    const a = body.acts[0];
    expect(a.name).toBe('improve-section');
    expect(a.metadata).toBeNull();
  });

  it('includes metadata when provided', async () => {
    const g = group('page');
    act(g, 'improve-section', {
      diff: { before: 'old', after: 'new' },
      learnings: ['be specific'],
    });
    await flush();

    const body = parseFlushedBody(0);
    const a = body.acts[0];
    expect(a.targetId).toBe(g.id);
    expect(a.metadata.diff).toEqual({ before: 'old', after: 'new' });
    expect(a.metadata.learnings).toEqual(['be specific']);
  });

  it('can be called multiple times on the same target', async () => {
    const g = group('section', { name: 'src/utils.js:api' });
    act(g, 'improve-section');
    act(g, 'refine-prompt');
    act(g, 'extract-learning', { rule: 'always show error codes' });
    await flush();

    const body = parseFlushedBody(0);
    expect(body.acts).toHaveLength(3);
    expect(body.acts.map(a => a.name)).toEqual(['improve-section', 'refine-prompt', 'extract-learning']);
    expect(new Set(body.acts.map(a => a.targetId)).size).toBe(1);
  });

  it('includes timestamp', async () => {
    const r = run('test');
    act(r, 'improve-section');
    await flush();

    const body = parseFlushedBody(0);
    expect(body.acts[0].timestamp).toBeDefined();
    expect(new Date(body.acts[0].timestamp).getTime()).toBeGreaterThan(0);
  });
});
