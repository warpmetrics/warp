import { describe, it, expect } from 'vitest';
import { run, group, outcome, act, reserve, ref, flush } from '../index.js';
import { setupBeforeEach, parseFlushedBody } from '../../test/setup.js';

setupBeforeEach();

describe('act()', () => {
  it('returns a frozen object with id and _type', () => {
    const r = run('test');
    const oc = outcome(r, 'Feedback Negative');
    const a = act(oc, 'Improve Section');
    expect(a).toBeDefined();
    expect(a.id).toMatch(/^wm_act_/);
    expect(a._type).toBe('act');
    expect(Object.isFrozen(a)).toBe(true);
  });

  it('enqueues an act event with id and refId targeting an outcome', async () => {
    const r = run('test');
    const oc = outcome(r, 'Feedback Negative');
    const a = act(oc, 'Improve Section');
    await flush();

    const body = parseFlushedBody(0);
    const evt = body.acts.find(e => e.name === 'Improve Section');
    expect(evt).toBeDefined();
    expect(evt.id).toBe(a.id);
    expect(evt.id).toMatch(/^wm_act_/);
    expect(evt.refId).toBe(oc.id);
    expect(evt.refId).toMatch(/^wm_oc_/);
  });

  it('works with an outcome ref string', async () => {
    const a = act('wm_oc_abc123', 'Refine Prompt');
    await flush();

    expect(a).toBeDefined();
    expect(a.id).toMatch(/^wm_act_/);
    const body = parseFlushedBody(0);
    expect(body.acts[0].refId).toBe('wm_oc_abc123');
    expect(body.acts[0].name).toBe('Refine Prompt');
  });

  it('rejects non-outcome targets silently and returns undefined', async () => {
    const r = run('test');
    const result = act(r, 'Improve Section');
    expect(result).toBeUndefined();
    await flush();

    const body = parseFlushedBody(0);
    expect(body.acts).toHaveLength(0);
  });

  it('rejects group targets silently and returns undefined', async () => {
    const r = run('test');
    const g = group(r, 'Page');
    const result = act(g, 'Improve Section');
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
    const oc = outcome(r, 'Feedback Negative');
    act(oc, 'Improve Section');
    await flush();

    const body = parseFlushedBody(0);
    const a = body.acts[0];
    expect(a.name).toBe('Improve Section');
    expect(a.opts).toBeNull();
  });

  it('includes opts when provided', async () => {
    const r = run('test');
    const oc = outcome(r, 'Feedback Negative');
    act(oc, 'Improve Section', {
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
    const oc = outcome(r, 'Feedback Negative');
    act(oc, 'Improve Section');
    act(oc, 'Refine Prompt');
    act(oc, 'Extract Learning', { rule: 'always show error codes' });
    await flush();

    const body = parseFlushedBody(0);
    expect(body.acts).toHaveLength(3);
    expect(body.acts.map(a => a.name)).toEqual(['Improve Section', 'Refine Prompt', 'Extract Learning']);
    expect(new Set(body.acts.map(a => a.refId)).size).toBe(1);
  });

  it('includes timestamp', async () => {
    const r = run('test');
    const oc = outcome(r, 'Feedback Negative');
    act(oc, 'Improve Section');
    await flush();

    const body = parseFlushedBody(0);
    expect(body.acts[0].timestamp).toBeDefined();
    expect(new Date(body.acts[0].timestamp).getTime()).toBeGreaterThan(0);
  });

  it('ref() resolves act to its id', () => {
    const r = run('test');
    const oc = outcome(r, 'Feedback Negative');
    const a = act(oc, 'Improve Section');
    expect(ref(a)).toBe(a.id);
  });

  // --- Descriptor mode ---

  it('act(name) returns a descriptor with _descriptor, _eventType, name, opts', () => {
    const d = act('Review');
    expect(d._descriptor).toBe(true);
    expect(d._eventType).toBe('act');
    expect(d.name).toBe('Review');
    expect(d.opts).toBeNull();
  });

  it('act(name, opts) descriptor includes opts', () => {
    const d = act('Review', { repo: 'api' });
    expect(d._descriptor).toBe(true);
    expect(d._eventType).toBe('act');
    expect(d.name).toBe('Review');
    expect(d.opts).toEqual({ repo: 'api' });
  });

  it('act(name) descriptor does NOT enqueue anything', async () => {
    act('Review');
    await flush();
    // flush with no events should not call fetch
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // --- Reserved completion ---

  it('act(outcome, reserved) enqueues with reserved ID and original opts', async () => {
    const reserved = reserve(act('Review', { repo: 'api' }));
    const r = run('test');
    const oc = outcome(r, 'Done');
    act(oc, reserved);
    await flush();

    const body = parseFlushedBody(0);
    const evt = body.acts.find(e => e.id === reserved.id);
    expect(evt).toBeDefined();
    expect(evt.refId).toBe(oc.id);
    expect(evt.name).toBe('Review');
    expect(evt.opts).toEqual({ repo: 'api' });
  });

  it('act(outcome, reserved) — flushed event has correct refId', async () => {
    const reserved = reserve(act('Review'));
    const r = run('test');
    const oc = outcome(r, 'Feedback');
    act(oc, reserved);
    await flush();

    const body = parseFlushedBody(0);
    const evt = body.acts.find(e => e.id === reserved.id);
    expect(evt.refId).toBe(oc.id);
    expect(evt.refId).toMatch(/^wm_oc_/);
  });

  it('act(outcome, reserved, extraOpts) merges opts (extra wins on conflict)', async () => {
    const reserved = reserve(act('Review', { repo: 'api', mode: 'auto' }));
    const r = run('test');
    const oc = outcome(r, 'Done');
    act(oc, reserved, { pr: '42', mode: 'manual' });
    await flush();

    const body = parseFlushedBody(0);
    const evt = body.acts.find(e => e.id === reserved.id);
    expect(evt.opts).toEqual({ repo: 'api', mode: 'manual', pr: '42' });
  });

  it('act(outcome, reserved) returns frozen object with reserved ID', () => {
    const reserved = reserve(act('Review'));
    const r = run('test');
    const oc = outcome(r, 'Done');
    const result = act(oc, reserved);
    expect(result).toBeDefined();
    expect(result.id).toBe(reserved.id);
    expect(result._type).toBe('act');
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('act(outcome, reserved) works with string outcome ref', async () => {
    const reserved = reserve(act('Review'));
    act('wm_oc_abc123', reserved);
    await flush();

    const body = parseFlushedBody(0);
    const evt = body.acts.find(e => e.id === reserved.id);
    expect(evt).toBeDefined();
    expect(evt.refId).toBe('wm_oc_abc123');
  });

  it('existing act(outcome, name, opts) behavior unchanged (regression)', async () => {
    const r = run('test');
    const oc = outcome(r, 'Done');
    const a = act(oc, 'Improve', { key: 'val' });
    await flush();

    expect(a).toBeDefined();
    expect(a.id).toMatch(/^wm_act_/);
    expect(a._type).toBe('act');
    const body = parseFlushedBody(0);
    const evt = body.acts.find(e => e.id === a.id);
    expect(evt.refId).toBe(oc.id);
    expect(evt.name).toBe('Improve');
    expect(evt.opts).toEqual({ key: 'val' });
  });

  // --- Full flow integration ---

  it('end-to-end: reserve → complete → flush → verify event shape', async () => {
    const reserved = reserve(act('Review', { repo: 'api' }));
    const r = run('test');
    const oc = outcome(r, 'PR Created');
    act(oc, reserved, { pr: '42' });
    await flush();

    const body = parseFlushedBody(0);
    const evt = body.acts.find(e => e.id === reserved.id);
    expect(evt).toBeDefined();
    expect(evt.id).toBe(reserved.id);
    expect(evt.refId).toBe(oc.id);
    expect(evt.opts).toEqual({ repo: 'api', pr: '42' });
    expect(evt.name).toBe('Review');
    expect(evt.timestamp).toBeDefined();
  });

  it('end-to-end: reserved act → follow-up run', async () => {
    const reserved = reserve(act('Review'));
    const r1 = run('test');
    const oc = outcome(r1, 'Done');
    act(oc, reserved);
    const r2 = run(reserved, 'Follow-up');
    await flush();

    const body = parseFlushedBody(0);
    const followUpRun = body.runs.find(r => r.label === 'Follow-up');
    expect(followUpRun).toBeDefined();
    expect(followUpRun.refId).toBe(reserved.id);
  });
});
