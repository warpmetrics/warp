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
    const oc = outcome(r, 'completed', { reason: 'Looks good', source: 'ci' });
    const a = act(oc, 'improve-section', { diff: { before: 'old', after: 'new' } });

    expect(ref(r)).toBe(r.id);
    expect(ref(planning)).toBe(planning.id);
    expect(ref(response)).toMatch(/^wm_call_/);
    expect(oc.id).toMatch(/^wm_oc_/);
    expect(a).toBeDefined();
    expect(a.id).toMatch(/^wm_act_/);
    expect(a._type).toBe('act');

    await flush();

    const body = parseFlushedBody(0);
    expect(body.runs).toHaveLength(1);
    expect(body.runs[0].refId).toBeNull();
    expect(body.groups).toHaveLength(1);
    expect(body.calls).toHaveLength(1);
    expect(body.links).toHaveLength(2);
    expect(body.outcomes).toHaveLength(1);
    expect(body.outcomes[0].name).toBe('completed');
    expect(body.outcomes[0].id).toBe(oc.id);
    expect(body.outcomes[0].refId).toBe(r.id);
    expect(body.acts).toHaveLength(1);
    expect(body.acts[0].name).toBe('improve-section');
    expect(body.acts[0].id).toBe(a.id);
    expect(body.acts[0].id).toMatch(/^wm_act_/);
    expect(body.acts[0].refId).toBe(oc.id);
  });

  it('act() return value can be passed to run() for follow-up', async () => {
    const client = createMockOpenAI(OPENAI_RESPONSE);
    warp(client);

    const r1 = run('code-review');
    const oc = outcome(r1, 'fail', { reason: 'test' });
    const a = act(oc, 'retry');
    const r2 = run(a, 'code-review');

    await flush();

    const body = parseFlushedBody(0);
    expect(body.runs).toHaveLength(2);

    const followUp = body.runs.find(r => r.id === r2.id);
    expect(followUp.refId).toBe(a.id);
    expect(followUp.refId).toMatch(/^wm_act_/);
    expect(followUp.label).toBe('code-review');

    const original = body.runs.find(r => r.id === r1.id);
    expect(original.refId).toBeNull();
  });
});
