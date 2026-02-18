import { describe, it, expect, beforeEach } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { warp } from '../index.js';
import { responseRegistry } from '../core/registry.js';
import { clearQueue, setConfig } from '../core/transport.js';

const skip = !process.env.ANTHROPIC_API_KEY;

describe.skipIf(skip)('Anthropic integration', () => {
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

  it('tracks tokens for messages', async () => {
    const client = warp(new Anthropic());
    const result = await client.messages.create({
      model: 'claude-3-5-haiku-latest',
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
  }, 15000);

  it('tracks tokens for streaming messages', async () => {
    const client = warp(new Anthropic());
    const stream = await client.messages.create({
      model: 'claude-3-5-haiku-latest',
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
  }, 15000);
});
