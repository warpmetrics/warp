// SDK compatibility tests for Anthropic.
// These use the real Anthropic SDK with a mock fetch to verify our extract
// functions handle real SDK response objects (with getters, _client refs, etc).
// Skipped if the Anthropic SDK isn't installed.

import { describe, it, expect, vi } from 'vitest';
import { warp, ref, flush } from '../index.js';
import { responseRegistry } from '../core/registry.js';
import { setupBeforeEach } from '../../test/setup.js';

let Anthropic;
let anthropicProvider;

try { ({ default: Anthropic } = await import('@anthropic-ai/sdk')); } catch {}
try { anthropicProvider = await import('./anthropic.js'); } catch {}

setupBeforeEach();

// ---------------------------------------------------------------------------
// Raw API payload — what the real API returns over HTTP
// ---------------------------------------------------------------------------

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
// Tests
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
