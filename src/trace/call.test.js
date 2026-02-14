import { describe, it, expect } from 'vitest';
import { warp, run, group, call, flush } from '../index.js';
import { runRegistry, groupRegistry } from '../core/registry.js';
import { setupBeforeEach, createMockOpenAI, OPENAI_RESPONSE, parseFlushedBody } from '../../test/setup.js';

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
});
