import { describe, it, expect } from 'vitest';
import { run, outcome, act, flush } from '../index.js';
import { runRegistry } from '../core/registry.js';
import { setupBeforeEach, parseFlushedBody } from '../../test/setup.js';

setupBeforeEach();

describe('run()', () => {
  it('returns a frozen object with id and _type', () => {
    const r = run('Code Review');
    expect(r.id).toMatch(/^wm_run_/);
    expect(r._type).toBe('run');
    expect(Object.isFrozen(r)).toBe(true);
  });

  it('stores data in runRegistry', () => {
    const r = run('Code Review', { name: 'PR #42', link: 'https://github.com/pr/42' });
    const data = runRegistry.get(r.id);
    expect(data.label).toBe('Code Review');
    expect(data.opts).toEqual({ name: 'PR #42', link: 'https://github.com/pr/42' });
    expect(data.refId).toBeNull();
    expect(data.groups).toEqual([]);
    expect(data.calls).toEqual([]);
  });

  it('enqueues a run event for transport', async () => {
    run('Test Label');
    await flush();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const body = parseFlushedBody(0);
    expect(body.runs).toHaveLength(1);
    expect(body.runs[0].label).toBe('Test Label');
  });

  it('sends refId: null for new runs', async () => {
    run('Test Label');
    await flush();
    const body = parseFlushedBody(0);
    expect(body.runs[0].refId).toBeNull();
  });

  it('accepts an act ref as first arg', async () => {
    const r1 = run('test');
    const oc = outcome(r1, 'Failed');
    const a = act(oc, 'Retry');
    const r2 = run(a, 'Test Followup');
    await flush();

    const body = parseFlushedBody(0);
    const followUpRun = body.runs.find(r => r.id === r2.id);
    expect(followUpRun).toBeDefined();
    expect(followUpRun.refId).toBe(a.id);
    expect(followUpRun.refId).toMatch(/^wm_act_/);
    expect(followUpRun.label).toBe('Test Followup');
  });

  it('accepts act ref with opts', async () => {
    const r1 = run('test');
    const oc = outcome(r1, 'Failed');
    const a = act(oc, 'Retry');
    const r2 = run(a, 'Test Followup', { name: 'Retry Run', link: 'ticket:42' });

    const data = runRegistry.get(r2.id);
    expect(data.refId).toBe(a.id);
    expect(data.opts).toEqual({ name: 'Retry Run', link: 'ticket:42' });
  });

  it('accepts string act ref', async () => {
    const r2 = run('wm_act_xxx', 'Test Followup');
    await flush();

    const body = parseFlushedBody(0);
    expect(body.runs[0].refId).toBe('wm_act_xxx');
  });

  it('silently drops non-act ref (refId = null)', async () => {
    const r1 = run('test');
    const r2 = run(r1, 'Test Followup');
    await flush();

    const body = parseFlushedBody(0);
    const followUpRun = body.runs.find(r => r.id === r2.id);
    expect(followUpRun.refId).toBeNull();
  });

  it('stores refId in registry', () => {
    const r1 = run('test');
    const oc = outcome(r1, 'Failed');
    const a = act(oc, 'Retry');
    const r2 = run(a, 'Test Followup');
    const data = runRegistry.get(r2.id);
    expect(data.refId).toBe(a.id);
  });
});
