import { describe, it, expect, beforeEach, vi } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { warp, run, call, flush } from '../index.js';
import { responseRegistry } from '../core/registry.js';
import { clearQueue, setConfig } from '../core/transport.js';

const skip = !process.env.ANTHROPIC_API_KEY;

function parseFlushedBody(callIndex = 0) {
  const envelope = JSON.parse(global.fetch.mock.calls[callIndex][1].body);
  return JSON.parse(Buffer.from(envelope.d, 'base64').toString('utf-8'));
}

describe.skipIf(skip)('Anthropic integration', () => {
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

  it('tracks tokens for messages', async () => {
    const client = warp(new Anthropic());
    const result = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 5,
      messages: [{ role: 'user', content: 'Say hi' }],
    });

    expect(result.content[0].text).toBeTruthy();
    expect(responseRegistry.has(result)).toBe(true);

    const { data } = responseRegistry.get(result);
    expect(data.provider).toBe('anthropic');
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
    expect(c.provider).toBe('anthropic');
    expect(c.model).toBe('claude-sonnet-4-5-20250929');
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
    expect(typeof c.tokens.cacheWrite).toBe('number');
    expect(typeof c.tokens.cacheRead).toBe('number');

    // No cost override for wrapped calls — server calculates from tokens
    expect(c.cost).toBeUndefined();

    // Link connects call to run
    const link = body.links[0];
    expect(link.parentId).toBe(r.id);
    expect(link.childId).toBe(c.id);
    expect(link.type).toBe('call');

    global.fetch = realFetch;
  }, 15000);

  it('tracks tokens for streaming messages', async () => {
    const client = warp(new Anthropic());
    const stream = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 5,
      messages: [{ role: 'user', content: 'Say hi' }],
      stream: true,
    });

    let chunks = 0;
    for await (const _chunk of stream) {
      chunks++;
    }

    expect(chunks).toBeGreaterThan(0);
    expect(responseRegistry.has(stream)).toBe(true);

    const { data } = responseRegistry.get(stream);
    expect(data.provider).toBe('anthropic');
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
    expect(c.provider).toBe('anthropic');
    expect(c.status).toBe('success');
    expect(c.duration).toBeGreaterThan(0);
    expect(c.startedAt).toBeTruthy();
    expect(c.endedAt).toBeTruthy();

    // Token fields — same structure for streaming
    expect(c.tokens.prompt).toBeGreaterThan(0);
    expect(c.tokens.completion).toBeGreaterThan(0);
    expect(c.tokens.total).toBe(c.tokens.prompt + c.tokens.completion);
    expect(typeof c.tokens.cacheWrite).toBe('number');
    expect(typeof c.tokens.cacheRead).toBe('number');

    expect(c.cost).toBeUndefined();

    global.fetch = realFetch;
  }, 15000);
});
