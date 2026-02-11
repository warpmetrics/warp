import { describe, it, expect, vi } from 'vitest';
import { warp, run, call, flush } from '../index.js';
import { responseRegistry } from '../core/registry.js';
import {
  setupBeforeEach, parseFlushedBody,
  createMockOpenAI, createMockAnthropic,
  OPENAI_RESPONSE, OPENAI_RESPONSES_API_RESPONSE, ANTHROPIC_RESPONSE,
} from '../../test/setup.js';

setupBeforeEach();

describe('warp() — OpenAI', () => {
  it('intercepts chat.completions.create and buffers the call', async () => {
    const client = createMockOpenAI(OPENAI_RESPONSE);
    const wrapped = warp(client);

    const result = await wrapped.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(result.choices[0].message.content).toBe('Hello!');
    expect(responseRegistry.has(result)).toBe(true);

    // Call data is buffered, not emitted yet
    await flush();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('emits call event when call() is used', async () => {
    const client = createMockOpenAI(OPENAI_RESPONSE);
    const wrapped = warp(client);

    const result = await wrapped.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    const r = run('test');
    call(r, result);

    await flush();
    const body = parseFlushedBody(0);
    expect(body.calls).toHaveLength(1);
    expect(body.calls[0].model).toBe('gpt-4o-mini');
    expect(body.calls[0].tokens.total).toBe(15);
    expect(body.calls[0].status).toBe('success');
  });

  it('buffers errors on the thrown error object', async () => {
    const error = new Error('Rate limit exceeded');
    const client = createMockOpenAI(null);
    client.chat.completions.create = vi.fn().mockRejectedValue(error);
    const wrapped = warp(client);

    let caught;
    try {
      await wrapped.chat.completions.create({ model: 'gpt-4o', messages: [] });
    } catch (e) {
      caught = e;
    }

    expect(caught.message).toBe('Rate limit exceeded');
    expect(caught._warpResponse).toBeDefined();

    const r = run('test');
    call(r, caught._warpResponse);

    await flush();
    const body = parseFlushedBody(0);
    expect(body.calls).toHaveLength(1);
    expect(body.calls[0].status).toBe('error');
    expect(body.calls[0].error).toBe('Rate limit exceeded');
  });

  it('accepts config options on first call', () => {
    const client = createMockOpenAI(OPENAI_RESPONSE);
    warp(client, { apiKey: 'wm_live_xyz', debug: true });
  });
});

describe('warp() — OpenAI Responses API', () => {
  it('intercepts responses.create and buffers the call', async () => {
    const client = createMockOpenAI(OPENAI_RESPONSE, OPENAI_RESPONSES_API_RESPONSE);
    const wrapped = warp(client);

    const result = await wrapped.responses.create({
      model: 'gpt-4o',
      input: 'Hi',
    });

    expect(result.output_text).toBe('Hello from Responses API!');
    expect(responseRegistry.has(result)).toBe(true);

    const r = run('test');
    call(r, result);

    await flush();
    const body = parseFlushedBody(0);
    expect(body.calls).toHaveLength(1);
    expect(body.calls[0].model).toBe('gpt-4o');
    expect(body.calls[0].tokens.prompt).toBe(8);
    expect(body.calls[0].tokens.completion).toBe(6);
    expect(body.calls[0].status).toBe('success');
  });
});

describe('warp() — OpenAI streaming', () => {
  it('wraps stream and buffers the call after iteration', async () => {
    const chunks = [
      { choices: [{ delta: { content: 'Hel' } }] },
      { choices: [{ delta: { content: 'lo!' } }] },
      { usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 } },
    ];
    const mockStream = { async *[Symbol.asyncIterator]() { for (const c of chunks) yield c; } };
    const client = createMockOpenAI(null);
    client.chat.completions.create = vi.fn().mockResolvedValue(mockStream);
    const wrapped = warp(client);

    const stream = await wrapped.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
      stream: true,
    });

    const received = [];
    for await (const chunk of stream) received.push(chunk);

    expect(received).toHaveLength(3);

    const r = run('test');
    call(r, stream);

    await flush();
    const body = parseFlushedBody(0);
    expect(body.calls).toHaveLength(1);
    expect(body.calls[0].response).toBe('Hello!');
    expect(body.calls[0].tokens.total).toBe(8);
    expect(body.calls[0].status).toBe('success');
  });
});

describe('warp() — Anthropic', () => {
  it('intercepts messages.create and buffers the call', async () => {
    const client = createMockAnthropic(ANTHROPIC_RESPONSE);
    const wrapped = warp(client);

    const result = await wrapped.messages.create({
      model: 'claude-3-5-sonnet-latest',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(result.content[0].text).toBe('Hello from Claude!');
    expect(responseRegistry.has(result)).toBe(true);

    const r = run('test');
    call(r, result);

    await flush();
    const body = parseFlushedBody(0);
    expect(body.calls).toHaveLength(1);
    expect(body.calls[0].provider).toBe('anthropic');
    expect(body.calls[0].tokens.prompt).toBe(12);
    expect(body.calls[0].tokens.completion).toBe(8);
  });
});

describe('warp() — unknown client', () => {
  it('returns the client as-is when provider is not recognised', () => {
    const client = { unknown: true };
    const result = warp(client, { debug: true });
    expect(result).toBe(client);
  });
});
