import { describe, it, expect } from 'vitest';
import { warp, run, group, add, outcome, act, ref, flush } from './index.js';
import { setupBeforeEach, createMockOpenAI, OPENAI_RESPONSE, parseFlushedBody } from '../test/setup.js';

setupBeforeEach();

describe('end-to-end', () => {
  it('full agent flow: warp -> run -> group -> add -> outcome -> act -> flush', async () => {
    const client = createMockOpenAI(OPENAI_RESPONSE);
    const openai = warp(client);

    const r = run('code-review', { link: 'ticket:123', name: 'Review PR' });
    const planning = group('planning', { name: 'Plan Phase' });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Plan a review' }],
    });

    add(planning, response);
    add(r, planning);
    outcome(r, 'completed', { reason: 'Looks good', source: 'ci' });
    act(r, 'improve-section', { diff: { before: 'old', after: 'new' } });

    expect(ref(r)).toBe(r.id);
    expect(ref(planning)).toBe(planning.id);
    expect(ref(response)).toMatch(/^wm_call_/);

    await flush();

    const body = parseFlushedBody(0);
    expect(body.runs).toHaveLength(1);
    expect(body.groups).toHaveLength(1);
    expect(body.calls).toHaveLength(1);
    expect(body.links).toHaveLength(2);
    expect(body.outcomes).toHaveLength(1);
    expect(body.outcomes[0].name).toBe('completed');
    expect(body.acts).toHaveLength(1);
    expect(body.acts[0].name).toBe('improve-section');
    expect(body.acts[0].targetId).toBe(r.id);
  });
});
