// Cost tracking integration tests.
// Verifies that token counts and cache tokens flow correctly through
// the full SDK pipeline: intercept → extract → registry → flush.

import { describe, it, expect, vi } from 'vitest';
import { warp, run, call, trace, flush } from '../index.js';
import { responseRegistry } from '../core/registry.js';
import {
  setupBeforeEach, parseFlushedBody,
  createMockOpenAI, createMockAnthropic,
} from '../../test/setup.js';

setupBeforeEach();

// ---------------------------------------------------------------------------
// Anthropic — non-streaming
// ---------------------------------------------------------------------------

describe('cost tracking — Anthropic', () => {
  it('tracks basic token counts (no caching)', async () => {
    const client = createMockAnthropic({
      content: [{ type: 'text', text: 'Hi' }],
      usage: { input_tokens: 100, output_tokens: 50 },
    });
    const wrapped = warp(client);
    const result = await wrapped.messages.create({ model: 'claude-sonnet-4-5-20250929', messages: [] });

    const r = run('test');
    call(r, result);
    await flush();

    const body = parseFlushedBody(0);
    const c = body.calls[0];
    expect(c.tokens.prompt).toBe(100);
    expect(c.tokens.completion).toBe(50);
    expect(c.tokens.total).toBe(150);
    expect(c.tokens.cacheWrite).toBe(0);
    expect(c.tokens.cacheRead).toBe(0);
  });

  it('tracks cache_creation_input_tokens and cache_read_input_tokens', async () => {
    const client = createMockAnthropic({
      content: [{ type: 'text', text: 'Hi' }],
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 200,
        cache_read_input_tokens: 300,
      },
    });
    const wrapped = warp(client);
    const result = await wrapped.messages.create({ model: 'claude-opus-4-6', messages: [] });

    const r = run('test');
    call(r, result);
    await flush();

    const body = parseFlushedBody(0);
    const c = body.calls[0];
    // prompt should include input + cacheWrite + cacheRead
    expect(c.tokens.prompt).toBe(600);
    expect(c.tokens.completion).toBe(50);
    expect(c.tokens.total).toBe(650);
    expect(c.tokens.cacheWrite).toBe(200);
    expect(c.tokens.cacheRead).toBe(300);
  });

  it('tracks cache tokens in streaming mode', async () => {
    const chunks = [
      {
        type: 'message_start',
        message: {
          usage: {
            input_tokens: 80,
            cache_creation_input_tokens: 150,
            cache_read_input_tokens: 50,
          },
        },
      },
      { type: 'content_block_delta', delta: { text: 'Hello' } },
      { type: 'message_delta', usage: { output_tokens: 30 } },
    ];
    const mockStream = { async *[Symbol.asyncIterator]() { for (const c of chunks) yield c; } };
    const client = createMockAnthropic(null);
    client.messages.create = vi.fn().mockResolvedValue(mockStream);
    const wrapped = warp(client);

    const stream = await wrapped.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      messages: [],
      stream: true,
    });

    for await (const _chunk of stream) {}

    const r = run('test');
    call(r, stream);
    await flush();

    const body = parseFlushedBody(0);
    const c = body.calls[0];
    expect(c.tokens.prompt).toBe(280); // 80 + 150 + 50
    expect(c.tokens.completion).toBe(30);
    expect(c.tokens.total).toBe(310); // 280 + 30
    expect(c.tokens.cacheWrite).toBe(150);
    expect(c.tokens.cacheRead).toBe(50);
    expect(c.response).toBe('Hello');
  });

  it('handles zero cache tokens explicitly', async () => {
    const client = createMockAnthropic({
      content: [{ type: 'text', text: 'Ok' }],
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    });
    const wrapped = warp(client);
    const result = await wrapped.messages.create({ model: 'claude-3-haiku-20240307', messages: [] });

    const r = run('test');
    call(r, result);
    await flush();

    const body = parseFlushedBody(0);
    const c = body.calls[0];
    expect(c.tokens.prompt).toBe(10);
    expect(c.tokens.cacheWrite).toBe(0);
    expect(c.tokens.cacheRead).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// OpenAI — non-streaming
// ---------------------------------------------------------------------------

describe('cost tracking — OpenAI Chat Completions', () => {
  it('tracks basic token counts', async () => {
    const client = createMockOpenAI({
      choices: [{ message: { content: 'Hi' } }],
      usage: { prompt_tokens: 200, completion_tokens: 100, total_tokens: 300 },
    });
    const wrapped = warp(client);
    const result = await wrapped.chat.completions.create({ model: 'gpt-4o', messages: [] });

    const r = run('test');
    call(r, result);
    await flush();

    const body = parseFlushedBody(0);
    const c = body.calls[0];
    expect(c.tokens.prompt).toBe(200);
    expect(c.tokens.completion).toBe(100);
    expect(c.tokens.total).toBe(300);
  });

  it('tracks cached input tokens from prompt_tokens_details', async () => {
    const client = createMockOpenAI({
      choices: [{ message: { content: 'Hi' } }],
      usage: {
        prompt_tokens: 500,
        completion_tokens: 100,
        total_tokens: 600,
        prompt_tokens_details: { cached_tokens: 300 },
      },
    });
    const wrapped = warp(client);
    const result = await wrapped.chat.completions.create({ model: 'gpt-4o', messages: [] });

    const r = run('test');
    call(r, result);
    await flush();

    const body = parseFlushedBody(0);
    const c = body.calls[0];
    expect(c.tokens.prompt).toBe(500);
    expect(c.tokens.completion).toBe(100);
    expect(c.tokens.total).toBe(600);
    expect(c.tokens.cachedInput).toBe(300);
  });

  it('tracks cached tokens in streaming mode', async () => {
    const chunks = [
      { choices: [{ delta: { content: 'Hel' } }] },
      { choices: [{ delta: { content: 'lo!' } }] },
      {
        usage: {
          prompt_tokens: 50,
          completion_tokens: 10,
          total_tokens: 60,
          prompt_tokens_details: { cached_tokens: 20 },
        },
      },
    ];
    const mockStream = { async *[Symbol.asyncIterator]() { for (const c of chunks) yield c; } };
    const client = createMockOpenAI(null);
    client.chat.completions.create = vi.fn().mockResolvedValue(mockStream);
    const wrapped = warp(client);

    const stream = await wrapped.chat.completions.create({
      model: 'gpt-4o',
      messages: [],
      stream: true,
    });

    for await (const _chunk of stream) {}

    const r = run('test');
    call(r, stream);
    await flush();

    const body = parseFlushedBody(0);
    const c = body.calls[0];
    expect(c.tokens.prompt).toBe(50);
    expect(c.tokens.completion).toBe(10);
    expect(c.tokens.total).toBe(60);
    expect(c.tokens.cachedInput).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// OpenAI — Responses API
// ---------------------------------------------------------------------------

describe('cost tracking — OpenAI Responses API', () => {
  it('tracks cached tokens from input_tokens_details', async () => {
    const responsesResponse = {
      id: 'resp-1',
      object: 'response',
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'Hi' }] }],
      output_text: 'Hi',
      usage: {
        input_tokens: 100,
        output_tokens: 40,
        input_tokens_details: { cached_tokens: 60 },
      },
    };
    const client = createMockOpenAI(null, responsesResponse);
    const wrapped = warp(client);
    const result = await wrapped.responses.create({ model: 'gpt-4o', input: 'Hi' });

    const r = run('test');
    call(r, result);
    await flush();

    const body = parseFlushedBody(0);
    const c = body.calls[0];
    expect(c.tokens.prompt).toBe(100);
    expect(c.tokens.completion).toBe(40);
    expect(c.tokens.total).toBe(140);
    expect(c.tokens.cachedInput).toBe(60);
  });

  it('tracks Responses API streaming with cached tokens', async () => {
    const chunks = [
      { type: 'response.output_text.delta', delta: 'Hi' },
      {
        type: 'response.completed',
        response: {
          usage: {
            input_tokens: 80,
            output_tokens: 20,
            input_tokens_details: { cached_tokens: 30 },
          },
        },
      },
    ];
    const mockStream = { async *[Symbol.asyncIterator]() { for (const c of chunks) yield c; } };
    const client = createMockOpenAI(null, null);
    client.responses.create = vi.fn().mockResolvedValue(mockStream);
    const wrapped = warp(client);

    const stream = await wrapped.responses.create({
      model: 'gpt-4o',
      input: 'Hi',
      stream: true,
    });

    for await (const _chunk of stream) {}

    const r = run('test');
    call(r, stream);
    await flush();

    const body = parseFlushedBody(0);
    const c = body.calls[0];
    expect(c.tokens.prompt).toBe(80);
    expect(c.tokens.completion).toBe(20);
    expect(c.tokens.total).toBe(100);
    expect(c.tokens.cachedInput).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// trace() — manual cost tracking
// ---------------------------------------------------------------------------

describe('cost tracking — trace()', () => {
  it('sends costOverride in microdollars when cost is provided', async () => {
    const r = run('test');
    trace(r, {
      provider: 'google',
      model: 'gemini-pro',
      tokens: { prompt: 100, completion: 50, total: 150 },
      cost: 0.005, // $0.005
    });

    await flush();
    const body = parseFlushedBody(0);
    const c = body.calls[0];
    expect(c.costOverride).toBe(5000); // 0.005 * 1_000_000
    expect(c.tokens.prompt).toBe(100);
    expect(c.tokens.completion).toBe(50);
  });

  it('sends costOverride of 0 when cost is explicitly 0', async () => {
    const r = run('test');
    trace(r, {
      provider: 'custom',
      model: 'free-model',
      cost: 0,
    });

    await flush();
    const body = parseFlushedBody(0);
    expect(body.calls[0].costOverride).toBe(0);
  });

  it('does not send costOverride when cost is not provided', async () => {
    const r = run('test');
    trace(r, {
      provider: 'openai',
      model: 'gpt-4o',
      tokens: { prompt: 10, completion: 5, total: 15 },
    });

    await flush();
    const body = parseFlushedBody(0);
    expect(body.calls[0].costOverride).toBeUndefined();
  });

  it('handles large cost values without precision loss', async () => {
    const r = run('test');
    trace(r, {
      provider: 'openai',
      model: 'gpt-4',
      cost: 123.456789,
    });

    await flush();
    const body = parseFlushedBody(0);
    expect(body.calls[0].costOverride).toBe(123_456_789);
  });
});

// ---------------------------------------------------------------------------
// Error tracking
// ---------------------------------------------------------------------------

describe('cost tracking — errors', () => {
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
    // Error calls should not have token data
    expect(c.tokens).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Multi-call token aggregation (ensures each call is separate)
// ---------------------------------------------------------------------------

describe('cost tracking — multiple calls in same run', () => {
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
