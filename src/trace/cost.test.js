import { describe, it, expect } from 'vitest';
import { warp, run, group, add, cost } from '../index.js';
import { setupBeforeEach, createMockOpenAI, OPENAI_RESPONSE } from '../../test/setup.js';

setupBeforeEach();

describe('cost()', () => {
  it('returns cost for an LLM response object', async () => {
    const client = createMockOpenAI(OPENAI_RESPONSE);
    const wrapped = warp(client);
    const response = await wrapped.chat.completions.create({ model: 'gpt-4o-mini', messages: [] });

    const c = cost(response);
    expect(c).toBeGreaterThan(0);
    // gpt-4o-mini: prompt=$0.15/1M, completion=$0.60/1M
    // 10 prompt + 5 completion -> expected ~0.0000045
    expect(c).toBeCloseTo(0.0000045, 7);
  });

  it('aggregates cost across a run with calls', async () => {
    const client = createMockOpenAI(OPENAI_RESPONSE);
    const wrapped = warp(client);

    const r = run('test');
    const g = group('step');

    const r1 = await wrapped.chat.completions.create({ model: 'gpt-4o-mini', messages: [] });
    const r2 = await wrapped.chat.completions.create({ model: 'gpt-4o-mini', messages: [] });

    add(g, r1, r2);
    add(r, g);

    const singleCost = cost(r1);
    const runCost = cost(r);
    expect(runCost).toBeCloseTo(singleCost * 2, 10);
  });

  it('returns 0 for unknown targets', () => {
    expect(cost({})).toBe(0);
    expect(cost('wm_run_nonexistent')).toBe(0);
  });
});
