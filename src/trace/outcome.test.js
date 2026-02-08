import { describe, it, expect } from 'vitest';
import { warp, run, outcome, flush } from '../index.js';
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
    expect(o.targetId).toBe(r.id);
    expect(o.reason).toBe('All good');
  });

  it('works with a ref string', async () => {
    outcome('wm_run_abc123', 'shipped');
    await flush();

    const body = parseFlushedBody(0);
    expect(body.outcomes[0].targetId).toBe('wm_run_abc123');
  });

  it('ignores unrecognised targets', () => {
    outcome({}, 'test');
    // no error thrown, silently ignored
  });

  it('works on an LLM response', async () => {
    const client = createMockOpenAI(OPENAI_RESPONSE);
    const wrapped = warp(client);
    const response = await wrapped.chat.completions.create({ model: 'gpt-4o-mini', messages: [] });

    outcome(response, 'helpful');
    await flush();

    const body = parseFlushedBody(0);
    const o = body.outcomes.find(e => e.name === 'helpful');
    expect(o.targetId).toMatch(/^wm_call_/);
  });
});
