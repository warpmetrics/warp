import { describe, it, expect, beforeEach, vi } from 'vitest';
import OpenAI from 'openai';
import { warp, run, call, flush } from '../index.js';
import { responseRegistry } from '../core/registry.js';
import { clearQueue, setConfig } from '../core/transport.js';

const skip = !process.env.OPENAI_API_KEY;

const hasResponsesAPI = (() => {
  try {
    const c = new OpenAI({ apiKey: 'sk-test' });
    return typeof c.responses?.create === 'function';
  } catch {
    return false;
  }
})();

function parseFlushedBody(callIndex = 0) {
  const envelope = JSON.parse(global.fetch.mock.calls[callIndex][1].body);
  return JSON.parse(Buffer.from(envelope.d, 'base64').toString('utf-8'));
}

describe.skipIf(skip)('OpenAI integration', () => {
  let realFetch;

  beforeEach(() => {
    realFetch = global.fetch;
    clearQueue();
    setConfig({
      apiKey: 'wm_test_integration',
      enabled: true,
      flushInterval: 60000,
      maxBatchSize: 1000,
      debug: false,
    });
  });

  it('tracks tokens for chat completions', async () => {
    const client = warp(new OpenAI());
    const result = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: 'Say hi' }],
      max_tokens: 5,
    });

    expect(result.choices[0].message.content).toBeTruthy();
    expect(responseRegistry.has(result)).toBe(true);

    const { data } = responseRegistry.get(result);
    expect(data.provider).toBe('openai');
    expect(data.model).toBe('gpt-4.1-mini');
    expect(data.status).toBe('success');
    expect(data.duration).toBeGreaterThan(0);
    expect(data.response).toBeTruthy();
    expect(data.tokens.prompt).toBeGreaterThan(0);
    expect(data.tokens.completion).toBeGreaterThan(0);
    expect(data.tokens.total).toBeGreaterThan(0);

    // Verify the full flushed payload
    const r = run('integration-test');
    call(r, result);
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    await flush();

    const body = parseFlushedBody(0);
    expect(body.runs).toHaveLength(1);
    expect(body.calls).toHaveLength(1);
    expect(body.links).toHaveLength(1);

    const c = body.calls[0];
    expect(c.id).toMatch(/^wm_call_/);
    expect(c.provider).toBe('openai');
    expect(c.model).toBe('gpt-4.1-mini');
    expect(c.status).toBe('success');
    expect(c.duration).toBeGreaterThan(0);
    expect(c.startedAt).toBeTruthy();
    expect(c.endedAt).toBeTruthy();
    expect(c.response).toBeTruthy();
    expect(c.messages).toBeInstanceOf(Array);

    // Token fields
    expect(c.tokens.prompt).toBeGreaterThan(0);
    expect(c.tokens.completion).toBeGreaterThan(0);
    expect(c.tokens.total).toBe(c.tokens.prompt + c.tokens.completion);
    expect(typeof c.tokens.cachedInput).toBe('number');

    // No cost override for wrapped calls — server calculates from tokens
    expect(c.cost).toBeUndefined();

    // Link connects call to run
    const link = body.links[0];
    expect(link.parentId).toBe(r.id);
    expect(link.childId).toBe(c.id);
    expect(link.type).toBe('call');

    global.fetch = realFetch;
  }, 15000);

  it('tracks tokens for streaming chat completions', async () => {
    const client = warp(new OpenAI());
    const stream = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: 'Say hi' }],
      max_tokens: 5,
      stream: true,
      stream_options: { include_usage: true },
    });

    let chunks = 0;
    for await (const _chunk of stream) {
      chunks++;
    }

    expect(chunks).toBeGreaterThan(0);
    expect(responseRegistry.has(stream)).toBe(true);

    const { data } = responseRegistry.get(stream);
    expect(data.provider).toBe('openai');
    expect(data.status).toBe('success');
    expect(data.response).toBeTruthy();
    expect(data.tokens.prompt).toBeGreaterThan(0);
    expect(data.tokens.completion).toBeGreaterThan(0);
    expect(data.tokens.total).toBeGreaterThan(0);

    // Verify the full flushed payload
    const r = run('integration-test-stream');
    call(r, stream);
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    await flush();

    const body = parseFlushedBody(0);
    const c = body.calls[0];
    expect(c.provider).toBe('openai');
    expect(c.status).toBe('success');
    expect(c.duration).toBeGreaterThan(0);
    expect(c.startedAt).toBeTruthy();
    expect(c.endedAt).toBeTruthy();

    // Token fields — same structure for streaming
    expect(c.tokens.prompt).toBeGreaterThan(0);
    expect(c.tokens.completion).toBeGreaterThan(0);
    expect(c.tokens.total).toBe(c.tokens.prompt + c.tokens.completion);
    expect(typeof c.tokens.cachedInput).toBe('number');

    expect(c.cost).toBeUndefined();

    global.fetch = realFetch;
  }, 15000);

  it.skipIf(!hasResponsesAPI)('tracks tokens for responses API', async () => {
    const client = warp(new OpenAI());
    const result = await client.responses.create({
      model: 'gpt-4.1-mini',
      input: 'Say hi',
      max_output_tokens: 16,
    });

    expect(responseRegistry.has(result)).toBe(true);

    const { data } = responseRegistry.get(result);
    expect(data.provider).toBe('openai');
    expect(data.status).toBe('success');
    expect(data.response).toBeTruthy();
    expect(data.tokens.prompt).toBeGreaterThan(0);
    expect(data.tokens.completion).toBeGreaterThan(0);
    expect(data.tokens.total).toBeGreaterThan(0);

    // Verify the full flushed payload
    const r = run('integration-test-responses');
    call(r, result);
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    await flush();

    const body = parseFlushedBody(0);
    const c = body.calls[0];
    expect(c.provider).toBe('openai');
    expect(c.status).toBe('success');
    expect(c.duration).toBeGreaterThan(0);
    expect(c.startedAt).toBeTruthy();
    expect(c.endedAt).toBeTruthy();

    // Token fields
    expect(c.tokens.prompt).toBeGreaterThan(0);
    expect(c.tokens.completion).toBeGreaterThan(0);
    expect(c.tokens.total).toBe(c.tokens.prompt + c.tokens.completion);
    expect(typeof c.tokens.cachedInput).toBe('number');

    expect(c.cost).toBeUndefined();

    global.fetch = realFetch;
  }, 15000);

  it.skipIf(!hasResponsesAPI)('tracks tokens for streaming responses API', async () => {
    const client = warp(new OpenAI());
    const stream = await client.responses.create({
      model: 'gpt-4.1-mini',
      input: 'Say hi',
      max_output_tokens: 16,
      stream: true,
    });

    let chunks = 0;
    for await (const _chunk of stream) {
      chunks++;
    }

    expect(chunks).toBeGreaterThan(0);
    expect(responseRegistry.has(stream)).toBe(true);

    const { data } = responseRegistry.get(stream);
    expect(data.provider).toBe('openai');
    expect(data.status).toBe('success');
    expect(data.response).toBeTruthy();
    expect(data.tokens.prompt).toBeGreaterThan(0);
    expect(data.tokens.completion).toBeGreaterThan(0);
    expect(data.tokens.total).toBeGreaterThan(0);

    // Verify the full flushed payload
    const r = run('integration-test-responses-stream');
    call(r, stream);
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    await flush();

    const body = parseFlushedBody(0);
    const c = body.calls[0];
    expect(c.provider).toBe('openai');
    expect(c.status).toBe('success');
    expect(c.duration).toBeGreaterThan(0);
    expect(c.startedAt).toBeTruthy();
    expect(c.endedAt).toBeTruthy();

    // Token fields
    expect(c.tokens.prompt).toBeGreaterThan(0);
    expect(c.tokens.completion).toBeGreaterThan(0);
    expect(c.tokens.total).toBe(c.tokens.prompt + c.tokens.completion);
    expect(typeof c.tokens.cachedInput).toBe('number');

    expect(c.cost).toBeUndefined();

    global.fetch = realFetch;
  }, 15000);
});
