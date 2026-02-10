import { describe, it, expect } from 'vitest';
import { warp, run, group, outcome, act, ref } from '../index.js';
import { setupBeforeEach, createMockOpenAI, OPENAI_RESPONSE } from '../../test/setup.js';

setupBeforeEach();

describe('ref()', () => {
  it('passes through strings', () => {
    expect(ref('wm_run_abc')).toBe('wm_run_abc');
  });

  it('extracts id from Run', () => {
    const r = run('test');
    expect(ref(r)).toBe(r.id);
  });

  it('extracts id from Group', () => {
    const g = group('test');
    expect(ref(g)).toBe(g.id);
  });

  it('resolves LLM response to call id', async () => {
    const client = createMockOpenAI(OPENAI_RESPONSE);
    const wrapped = warp(client);
    const response = await wrapped.chat.completions.create({ model: 'gpt-4o-mini', messages: [] });

    const id = ref(response);
    expect(id).toMatch(/^wm_call_/);
  });

  it('extracts id from Act', () => {
    const r = run('test');
    const oc = outcome(r, 'fail');
    const a = act(oc, 'retry');
    expect(ref(a)).toBe(a.id);
    expect(ref(a)).toMatch(/^wm_act_/);
  });

  it('returns undefined for unknown objects', () => {
    expect(ref({})).toBeUndefined();
    expect(ref(null)).toBeUndefined();
  });
});
