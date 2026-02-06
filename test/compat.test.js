// SDK compatibility tests.
// These run in CI against multiple versions of the OpenAI and Anthropic SDKs.
// They inject a mock fetch via the SDK's constructor option, let the real SDK
// parse responses into its own objects, then verify our extract functions
// handle those objects correctly.
// Skipped locally if SDKs aren't installed.

import { describe, it, expect, vi } from 'vitest';
import { warp, ref, flush } from '../src/index.js';
import { responseRegistry } from '../src/core/registry.js';
import { setupBeforeEach } from './setup.js';

let OpenAI, Anthropic;
let openaiProvider, anthropicProvider;

try { ({ default: OpenAI } = await import('openai')); } catch {}
try { ({ default: Anthropic } = await import('@anthropic-ai/sdk')); } catch {}
try { openaiProvider = await import('../src/providers/openai.js'); } catch {}
try { anthropicProvider = await import('../src/providers/anthropic.js'); } catch {}

setupBeforeEach();

// ---------------------------------------------------------------------------
// Raw API payloads — what the real API returns over HTTP
// ---------------------------------------------------------------------------

const OPENAI_CHAT_PAYLOAD = {
  id: 'chatcmpl-compat-test',
  object: 'chat.completion',
  created: 1700000000,
  model: 'gpt-4o-mini',
  choices: [{
    index: 0,
    message: { role: 'assistant', content: 'Hello from compat test!' },
    finish_reason: 'stop',
  }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
};

const OPENAI_RESPONSES_PAYLOAD = {
  id: 'resp-compat-test',
  object: 'response',
  created_at: 1700000000,
  status: 'completed',
  model: 'gpt-4o',
  output: [{
    type: 'message',
    id: 'msg_compat',
    role: 'assistant',
    content: [{ type: 'output_text', text: 'Hello from Responses API!' }],
  }],
  usage: { input_tokens: 8, output_tokens: 6, total_tokens: 14 },
};

const ANTHROPIC_PAYLOAD = {
  id: 'msg-compat-test',
  type: 'message',
  role: 'assistant',
  model: 'claude-3-5-sonnet-latest',
  content: [{ type: 'text', text: 'Hello from Anthropic compat!' }],
  stop_reason: 'end_turn',
  usage: { input_tokens: 12, output_tokens: 8 },
};

// ---------------------------------------------------------------------------
// Helper: create a mock fetch that returns a JSON payload
// ---------------------------------------------------------------------------

function createMockFetch(payload) {
  const body = JSON.stringify(payload);
  return vi.fn().mockImplementation(() =>
    Promise.resolve(new Response(body, {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'req-compat-test',
      },
    })),
  );
}

// ---------------------------------------------------------------------------
// Detect if Responses API exists on the installed OpenAI SDK version
// ---------------------------------------------------------------------------

const hasResponsesAPI = OpenAI
  ? (() => { try { const c = new OpenAI({ apiKey: 'x' }); return typeof c.responses?.create === 'function'; } catch { return false; } })()
  : false;

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------

describe.skipIf(!OpenAI)('OpenAI SDK compatibility', () => {
  it('detects OpenAI via constructor name', () => {
    const client = new OpenAI({ apiKey: 'sk-test' });
    expect(client.constructor.name).toBe('OpenAI');
  });

  it('client has chat.completions.create', () => {
    const client = new OpenAI({ apiKey: 'sk-test' });
    expect(typeof client.chat.completions.create).toBe('function');
  });

  it.skipIf(!hasResponsesAPI)('client has responses.create', () => {
    const client = new OpenAI({ apiKey: 'sk-test' });
    expect(typeof client.responses.create).toBe('function');
  });

  it('extract handles real SDK chat completion response', async () => {
    const mockFetch = createMockFetch(OPENAI_CHAT_PAYLOAD);
    const client = new OpenAI({ apiKey: 'sk-test', fetch: mockFetch });

    const result = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(mockFetch).toHaveBeenCalled();
    const ext = openaiProvider.extract(result);
    expect(ext.response).toBe('Hello from compat test!');
    expect(ext.tokens.prompt).toBe(10);
    expect(ext.tokens.completion).toBe(5);
    expect(ext.tokens.total).toBe(15);
  });

  it.skipIf(!hasResponsesAPI)('extract handles real SDK responses API response', async () => {
    const mockFetch = createMockFetch(OPENAI_RESPONSES_PAYLOAD);
    const client = new OpenAI({ apiKey: 'sk-test', fetch: mockFetch });

    const result = await client.responses.create({
      model: 'gpt-4o',
      input: 'hi',
    });

    expect(mockFetch).toHaveBeenCalled();
    const ext = openaiProvider.extract(result);
    expect(ext.response).toContain('Hello from Responses API!');
    expect(ext.tokens.prompt).toBe(8);
    expect(ext.tokens.completion).toBe(6);
  });

  it('warp intercepts and tracks a real SDK call', async () => {
    const mockFetch = createMockFetch(OPENAI_CHAT_PAYLOAD);
    const client = new OpenAI({ apiKey: 'sk-test', fetch: mockFetch });
    const wrapped = warp(client);

    const result = await wrapped.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(mockFetch).toHaveBeenCalled();
    expect(result.choices[0].message.content).toBe('Hello from compat test!');
    expect(responseRegistry.has(result)).toBe(true);
    expect(ref(result)).toMatch(/^wm_call_/);
  });
});

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

describe.skipIf(!Anthropic)('Anthropic SDK compatibility', () => {
  it('detects Anthropic via constructor name', () => {
    const client = new Anthropic({ apiKey: 'sk-ant-test' });
    expect(client.constructor.name).toBe('Anthropic');
  });

  it('client has messages.create', () => {
    const client = new Anthropic({ apiKey: 'sk-ant-test' });
    expect(typeof client.messages.create).toBe('function');
  });

  it('extract handles real SDK response', async () => {
    const mockFetch = createMockFetch(ANTHROPIC_PAYLOAD);
    const client = new Anthropic({ apiKey: 'sk-ant-test', fetch: mockFetch });

    const result = await client.messages.create({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(mockFetch).toHaveBeenCalled();
    const ext = anthropicProvider.extract(result);
    expect(ext.response).toBe('Hello from Anthropic compat!');
    expect(ext.tokens.prompt).toBe(12);
    expect(ext.tokens.completion).toBe(8);
  });

  it('warp intercepts and tracks a real SDK call', async () => {
    const mockFetch = createMockFetch(ANTHROPIC_PAYLOAD);
    const client = new Anthropic({ apiKey: 'sk-ant-test', fetch: mockFetch });
    const wrapped = warp(client);

    const result = await wrapped.messages.create({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(mockFetch).toHaveBeenCalled();
    expect(result.content[0].text).toBe('Hello from Anthropic compat!');
    expect(responseRegistry.has(result)).toBe(true);
    expect(ref(result)).toMatch(/^wm_call_/);
  });
});
