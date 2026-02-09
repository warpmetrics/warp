import { describe, it, expect } from 'vitest';
import { run, group, outcome, act, flush } from '../index.js';
import { setupBeforeEach, parseFlushedBody } from '../../test/setup.js';

setupBeforeEach();

describe('act()', () => {
  it('enqueues an act event targeting an outcome', async () => {
    const r = run('test');
    const oc = outcome(r, 'feedback-negative');
    act(oc, 'improve-section');
    await flush();

    const body = parseFlushedBody(0);
    const a = body.acts.find(e => e.name === 'improve-section');
    expect(a).toBeDefined();
    expect(a.targetId).toBe(oc.id);
    expect(a.targetId).toMatch(/^wm_oc_/);
  });

  it('works with an outcome ref string', async () => {
    act('wm_oc_abc123', 'refine-prompt');
    await flush();

    const body = parseFlushedBody(0);
    expect(body.acts[0].targetId).toBe('wm_oc_abc123');
    expect(body.acts[0].name).toBe('refine-prompt');
  });

  it('rejects non-outcome targets silently', async () => {
    const r = run('test');
    act(r, 'improve-section');
    await flush();

    const body = parseFlushedBody(0);
    expect(body.acts).toHaveLength(0);
  });

  it('rejects group targets silently', async () => {
    const g = group('page');
    act(g, 'improve-section');
    await flush();

    const body = parseFlushedBody(0);
    expect(body.acts).toHaveLength(0);
  });

  it('ignores unrecognised targets', () => {
    act({}, 'test');
    // no error thrown, silently ignored
  });

  it('works without metadata', async () => {
    const r = run('test');
    const oc = outcome(r, 'feedback-negative');
    act(oc, 'improve-section');
    await flush();

    const body = parseFlushedBody(0);
    const a = body.acts[0];
    expect(a.name).toBe('improve-section');
    expect(a.metadata).toBeNull();
  });

  it('includes metadata when provided', async () => {
    const r = run('test');
    const oc = outcome(r, 'feedback-negative');
    act(oc, 'improve-section', {
      diff: { before: 'old', after: 'new' },
      learnings: ['be specific'],
    });
    await flush();

    const body = parseFlushedBody(0);
    const a = body.acts[0];
    expect(a.targetId).toBe(oc.id);
    expect(a.metadata.diff).toEqual({ before: 'old', after: 'new' });
    expect(a.metadata.learnings).toEqual(['be specific']);
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
    expect(new Set(body.acts.map(a => a.targetId)).size).toBe(1);
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
});
