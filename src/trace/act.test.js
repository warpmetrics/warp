import { describe, it, expect } from 'vitest';
import { run, group, outcome, act, ref, flush } from '../index.js';
import { setupBeforeEach, parseFlushedBody } from '../../test/setup.js';

setupBeforeEach();

describe('act()', () => {
  it('returns a frozen object with id and _type', () => {
    const r = run('test');
    const oc = outcome(r, 'feedback-negative');
    const a = act(oc, 'improve-section');
    expect(a).toBeDefined();
    expect(a.id).toMatch(/^wm_act_/);
    expect(a._type).toBe('act');
    expect(Object.isFrozen(a)).toBe(true);
  });

  it('enqueues an act event with id and refId targeting an outcome', async () => {
    const r = run('test');
    const oc = outcome(r, 'feedback-negative');
    const a = act(oc, 'improve-section');
    await flush();

    const body = parseFlushedBody(0);
    const evt = body.acts.find(e => e.name === 'improve-section');
    expect(evt).toBeDefined();
    expect(evt.id).toBe(a.id);
    expect(evt.id).toMatch(/^wm_act_/);
    expect(evt.refId).toBe(oc.id);
    expect(evt.refId).toMatch(/^wm_oc_/);
  });

  it('works with an outcome ref string', async () => {
    const a = act('wm_oc_abc123', 'refine-prompt');
    await flush();

    expect(a).toBeDefined();
    expect(a.id).toMatch(/^wm_act_/);
    const body = parseFlushedBody(0);
    expect(body.acts[0].refId).toBe('wm_oc_abc123');
    expect(body.acts[0].name).toBe('refine-prompt');
  });

  it('rejects non-outcome targets silently and returns undefined', async () => {
    const r = run('test');
    const result = act(r, 'improve-section');
    expect(result).toBeUndefined();
    await flush();

    const body = parseFlushedBody(0);
    expect(body.acts).toHaveLength(0);
  });

  it('rejects group targets silently and returns undefined', async () => {
    const r = run('test');
    const g = group(r, 'page');
    const result = act(g, 'improve-section');
    expect(result).toBeUndefined();
    await flush();

    const body = parseFlushedBody(0);
    expect(body.acts).toHaveLength(0);
  });

  it('ignores unrecognised targets and returns undefined', () => {
    const result = act({}, 'test');
    expect(result).toBeUndefined();
  });

  it('works without opts', async () => {
    const r = run('test');
    const oc = outcome(r, 'feedback-negative');
    act(oc, 'improve-section');
    await flush();

    const body = parseFlushedBody(0);
    const a = body.acts[0];
    expect(a.name).toBe('improve-section');
    expect(a.opts).toBeNull();
  });

  it('includes opts when provided', async () => {
    const r = run('test');
    const oc = outcome(r, 'feedback-negative');
    act(oc, 'improve-section', {
      diff: { before: 'old', after: 'new' },
      learnings: ['be specific'],
    });
    await flush();

    const body = parseFlushedBody(0);
    const a = body.acts[0];
    expect(a.refId).toBe(oc.id);
    expect(a.opts.diff).toEqual({ before: 'old', after: 'new' });
    expect(a.opts.learnings).toEqual(['be specific']);
  });

  it('can be called multiple times on the same outcome', async () => {
    const r = run('test');
    const oc = outcome(r, 'feedback-negative');
    act(oc, 'improve-section');
    act(oc, 'refine-prompt');
    act(oc, 'extract-learning', { rule: 'always show error codes' });
    await flush();

    const body = parseFlushedBody(0);
    expect(body.acts).toHaveLength(3);
    expect(body.acts.map(a => a.name)).toEqual(['improve-section', 'refine-prompt', 'extract-learning']);
    expect(new Set(body.acts.map(a => a.refId)).size).toBe(1);
  });

  it('includes timestamp', async () => {
    const r = run('test');
    const oc = outcome(r, 'feedback-negative');
    act(oc, 'improve-section');
    await flush();

    const body = parseFlushedBody(0);
    expect(body.acts[0].timestamp).toBeDefined();
    expect(new Date(body.acts[0].timestamp).getTime()).toBeGreaterThan(0);
  });

  it('ref() resolves act to its id', () => {
    const r = run('test');
    const oc = outcome(r, 'feedback-negative');
    const a = act(oc, 'improve-section');
    expect(ref(a)).toBe(a.id);
  });
});
