import { describe, it, expect, vi } from 'vitest';
import { warp, run, group, call, flush } from '../index.js';
import { runRegistry, groupRegistry } from '../core/registry.js';
import { setupBeforeEach, createMockOpenAI, createMockAnthropic, OPENAI_RESPONSE, parseFlushedBody } from '../../test/setup.js';

setupBeforeEach();

describe('call()', () => {
  it('links an LLM response to a run', async () => {
    const client = createMockOpenAI(OPENAI_RESPONSE);
    const wrapped = warp(client);
    const response = await wrapped.chat.completions.create({ model: 'gpt-4o-mini', messages: [] });

    const r = run('test');
    call(r, response);

    const runData = runRegistry.get(r.id);
    expect(runData.calls).toHaveLength(1);
    expect(runData.calls[0]).toMatch(/^wm_call_/);

    await flush();
    const body = parseFlushedBody(0);
    expect(body.calls).toHaveLength(1);
    expect(body.calls[0].model).toBe('gpt-4o-mini');
    expect(body.calls[0].status).toBe('success');
    expect(body.links).toHaveLength(1);
    expect(body.links[0].parentId).toBe(r.id);
    expect(body.links[0].type).toBe('call');
  });

  it('links an LLM response to a group', async () => {
    const client = createMockOpenAI(OPENAI_RESPONSE);
    const wrapped = warp(client);
    const response = await wrapped.chat.completions.create({ model: 'gpt-4o-mini', messages: [] });

    const r = run('test');
    const g = group(r, 'step');
    call(g, response);

    const groupData = groupRegistry.get(g.id);
    expect(groupData.calls).toHaveLength(1);
    expect(groupData.calls[0]).toMatch(/^wm_call_/);
  });

  it('includes opts when provided', async () => {
    const client = createMockOpenAI(OPENAI_RESPONSE);
    const wrapped = warp(client);
    const response = await wrapped.chat.completions.create({ model: 'gpt-4o-mini', messages: [] });

    const r = run('test');
    call(r, response, { label: 'extract' });

    await flush();
    const body = parseFlushedBody(0);
    expect(body.calls[0].opts).toEqual({ label: 'extract' });
  });

  it('links LLM response to external string ID (cross-process)', async () => {
    const client = createMockOpenAI(OPENAI_RESPONSE);
    const wrapped = warp(client);
    const response = await wrapped.chat.completions.create({ model: 'gpt-4o-mini', messages: [] });

    const externalGroupId = 'wm_grp_external456';
    call(externalGroupId, response);

    await flush();
    const body = parseFlushedBody(0);
    expect(body.calls).toHaveLength(1);
    expect(body.links).toHaveLength(1);
    expect(body.links[0].parentId).toBe(externalGroupId);
    expect(body.links[0].type).toBe('call');
  });

  it('ignores untracked responses', () => {
    const r = run('test');
    call(r, { notAnLLMResponse: true });

    const data = runRegistry.get(r.id);
    expect(data.calls).toHaveLength(0);
  });

  it('does not emit call events until call() is invoked', async () => {
    const client = createMockOpenAI(OPENAI_RESPONSE);
    const wrapped = warp(client);
    await wrapped.chat.completions.create({ model: 'gpt-4o-mini', messages: [] });

    // No call() invoked — flush should have no calls
    run('test');
    await flush();
    const body = parseFlushedBody(0);
    expect(body.calls).toHaveLength(0);
  });

  it('cleans up response from registry after call()', async () => {
    const client = createMockOpenAI(OPENAI_RESPONSE);
    const wrapped = warp(client);
    const response = await wrapped.chat.completions.create({ model: 'gpt-4o-mini', messages: [] });

    const r = run('test');
    call(r, response);

    // Second call() with same response should be a no-op
    call(r, response);

    const data = runRegistry.get(r.id);
    expect(data.calls).toHaveLength(1);
  });

  it('records error calls with no tokens', async () => {
    const client = createMockOpenAI(null);
    client.chat.completions.create = vi.fn().mockRejectedValue(new Error('Rate limited'));
    const wrapped = warp(client);

    let caught;
    try {
      await wrapped.chat.completions.create({ model: 'gpt-4o', messages: [] });
    } catch (e) { caught = e; }

    const r = run('test');
    call(r, caught);

    await flush();
    const body = parseFlushedBody(0);
    const c = body.calls[0];
    expect(c.status).toBe('error');
    expect(c.error).toBe('Rate limited');
    expect(c.tokens).toBeUndefined();
  });

  it('tracks separate token counts per call', async () => {
    const response1 = {
      content: [{ type: 'text', text: 'First' }],
      usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 30 },
    };
    const response2 = {
      content: [{ type: 'text', text: 'Second' }],
      usage: { input_tokens: 200, output_tokens: 80 },
    };

    const client1 = createMockAnthropic(response1);
    const wrapped1 = warp(client1);
    const result1 = await wrapped1.messages.create({ model: 'claude-sonnet-4-5-20250929', messages: [] });

    const client2 = createMockAnthropic(response2);
    const wrapped2 = warp(client2);
    const result2 = await wrapped2.messages.create({ model: 'claude-sonnet-4-5-20250929', messages: [] });

    const r = run('test');
    call(r, result1);
    call(r, result2);

    await flush();
    const body = parseFlushedBody(0);
    expect(body.calls).toHaveLength(2);

    const c1 = body.calls[0];
    expect(c1.tokens.prompt).toBe(130); // 100 + 30
    expect(c1.tokens.cacheRead).toBe(30);

    const c2 = body.calls[1];
    expect(c2.tokens.prompt).toBe(200);
    expect(c2.tokens.cacheRead).toBe(0);
  });
});
