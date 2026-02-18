import { describe, it, expect, beforeEach } from 'vitest';
import OpenAI from 'openai';
import { warp } from '../index.js';
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

describe.skipIf(skip)('OpenAI integration', () => {
  beforeEach(() => {
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
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say hi' }],
      max_tokens: 5,
    });

    expect(result.choices[0].message.content).toBeTruthy();
    expect(responseRegistry.has(result)).toBe(true);

    const { data } = responseRegistry.get(result);
    expect(data.provider).toBe('openai');
    expect(data.model).toBe('gpt-4o-mini');
    expect(data.status).toBe('success');
    expect(data.duration).toBeGreaterThan(0);
    expect(data.response).toBeTruthy();
    expect(data.tokens.prompt).toBeGreaterThan(0);
    expect(data.tokens.completion).toBeGreaterThan(0);
    expect(data.tokens.total).toBeGreaterThan(0);
  }, 15000);

  it('tracks tokens for streaming chat completions', async () => {
    const client = warp(new OpenAI());
    const stream = await client.chat.completions.create({
      model: 'gpt-4o-mini',
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
  }, 15000);

  it.skipIf(!hasResponsesAPI)('tracks tokens for responses API', async () => {
    const client = warp(new OpenAI());
    const result = await client.responses.create({
      model: 'gpt-4o-mini',
      input: 'Say hi',
      max_output_tokens: 5,
    });

    expect(responseRegistry.has(result)).toBe(true);

    const { data } = responseRegistry.get(result);
    expect(data.provider).toBe('openai');
    expect(data.status).toBe('success');
    expect(data.response).toBeTruthy();
    expect(data.tokens.prompt).toBeGreaterThan(0);
    expect(data.tokens.completion).toBeGreaterThan(0);
    expect(data.tokens.total).toBeGreaterThan(0);
  }, 15000);

  it.skipIf(!hasResponsesAPI)('tracks tokens for streaming responses API', async () => {
    const client = warp(new OpenAI());
    const stream = await client.responses.create({
      model: 'gpt-4o-mini',
      input: 'Say hi',
      max_output_tokens: 5,
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
  }, 15000);
});
