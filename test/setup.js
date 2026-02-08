// Shared test setup for all co-located test files.

import { vi, beforeEach } from 'vitest';
import { runRegistry, groupRegistry, costByCallId } from '../src/core/registry.js';
import { setConfig, clearQueue } from '../src/core/transport.js';

// ---------------------------------------------------------------------------
// Mock LLM clients
// ---------------------------------------------------------------------------

export function createMockOpenAI(response, responsesResponse) {
  class OpenAI {
    constructor() {
      this.chat = {
        completions: {
          create: vi.fn().mockResolvedValue(response),
        },
      };
      this.responses = {
        create: vi.fn().mockResolvedValue(responsesResponse || response),
      };
    }
  }
  return new OpenAI();
}

export function createMockAnthropic(response) {
  class Anthropic {
    constructor() {
      this.messages = {
        create: vi.fn().mockResolvedValue(response),
      };
    }
  }
  return new Anthropic();
}

export const OPENAI_RESPONSE = {
  id: 'chatcmpl-test',
  choices: [{
    message: { role: 'assistant', content: 'Hello!' },
  }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
};

export const OPENAI_RESPONSES_API_RESPONSE = {
  id: 'resp-test',
  object: 'response',
  output: [{
    type: 'message',
    role: 'assistant',
    content: [{ type: 'output_text', text: 'Hello from Responses API!' }],
  }],
  output_text: 'Hello from Responses API!',
  usage: { input_tokens: 8, output_tokens: 6, total_tokens: 14 },
};

export const ANTHROPIC_RESPONSE = {
  id: 'msg-test',
  content: [{ type: 'text', text: 'Hello from Claude!' }],
  usage: { input_tokens: 12, output_tokens: 8 },
};

// ---------------------------------------------------------------------------
// Decode a flushed body from the base64 envelope { d: "..." }
// ---------------------------------------------------------------------------

export function parseFlushedBody(callIndex = 0) {
  const envelope = JSON.parse(global.fetch.mock.calls[callIndex][1].body);
  return JSON.parse(Buffer.from(envelope.d, 'base64').toString('utf-8'));
}

// ---------------------------------------------------------------------------
// Reset state before each test
// ---------------------------------------------------------------------------

export function setupBeforeEach() {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ received: 1, processed: 1 }),
    });

    runRegistry.clear();
    groupRegistry.clear();
    costByCallId.clear();
    clearQueue();

    setConfig({
      apiKey: 'wm_test_123',
      baseUrl: 'https://api.warpmetrics.com',
      enabled: true,
      flushInterval: 60000,
      maxBatchSize: 1000,
      debug: false,
    });
  });
}
