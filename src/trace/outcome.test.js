import { describe, it, expect } from 'vitest';
import { warp, run, call, outcome, flush } from '../index.js';
import { setupBeforeEach, createMockOpenAI, OPENAI_RESPONSE, parseFlushedBody } from '../../test/setup.js';

setupBeforeEach();

describe('outcome()', () => {
  it('enqueues an outcome event for a run', async () => {
    const r = run('test');
    outcome(r, 'completed', { reason: 'All good' });
    await flush();

    const body = parseFlushedBody(0);
    const o = body.outcomes.find(e => e.name === 'completed');
    expect(o).toBeDefined();
    expect(o.refId).toBe(r.id);
    expect(o.opts).toEqual({ reason: 'All good' });
  });

  it('returns an Outcome handle with wm_oc_ id', () => {
    const r = run('test');
    const oc = outcome(r, 'completed');

    expect(oc).toBeDefined();
    expect(oc.id).toMatch(/^wm_oc_/);
    expect(oc._type).toBe('outcome');
    expect(Object.isFrozen(oc)).toBe(true);
  });

  it('includes outcome id in the enqueued event', async () => {
    const r = run('test');
    const oc = outcome(r, 'completed');
    await flush();

    const body = parseFlushedBody(0);
    const o = body.outcomes.find(e => e.name === 'completed');
    expect(o.id).toBe(oc.id);
  });

  it('works with a ref string', async () => {
    const oc = outcome('wm_run_abc123', 'shipped');
    await flush();

    expect(oc.id).toMatch(/^wm_oc_/);
    const body = parseFlushedBody(0);
    expect(body.outcomes[0].refId).toBe('wm_run_abc123');
  });

  it('returns undefined for unrecognised targets', () => {
    const oc = outcome({}, 'test');
    expect(oc).toBeUndefined();
  });

  it('works on an LLM response (via ref)', async () => {
    const client = createMockOpenAI(OPENAI_RESPONSE);
    const wrapped = warp(client);
    const response = await wrapped.chat.completions.create({ model: 'gpt-4o-mini', messages: [] });

    const oc = outcome(response, 'helpful');
    await flush();

    expect(oc.id).toMatch(/^wm_oc_/);
    const body = parseFlushedBody(0);
    const o = body.outcomes.find(e => e.name === 'helpful');
    expect(o.refId).toMatch(/^wm_call_/);
  });
});
