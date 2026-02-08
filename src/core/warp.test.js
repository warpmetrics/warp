import { describe, it, expect, vi } from 'vitest';
import { warp, flush } from '../index.js';
import { responseRegistry } from '../core/registry.js';
import {
  setupBeforeEach, parseFlushedBody,
  createMockOpenAI, createMockAnthropic,
  OPENAI_RESPONSE, OPENAI_RESPONSES_API_RESPONSE, ANTHROPIC_RESPONSE,
} from '../../test/setup.js';

setupBeforeEach();

describe('warp() — OpenAI', () => {
  it('intercepts chat.completions.create and tracks the call', async () => {
    const client = createMockOpenAI(OPENAI_RESPONSE);
    const wrapped = warp(client);

    const result = await wrapped.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(result.choices[0].message.content).toBe('Hello!');
    expect(responseRegistry.has(result)).toBe(true);

    await flush();
    const body = parseFlushedBody(0);
    expect(body.calls).toHaveLength(1);
    expect(body.calls[0].model).toBe('gpt-4o-mini');
    expect(body.calls[0].tokens.total).toBe(15);
    expect(body.calls[0].status).toBe('success');
  });

  it('tracks errors without swallowing them', async () => {
    const error = new Error('Rate limit exceeded');
    const client = createMockOpenAI(null);
    client.chat.completions.create = vi.fn().mockRejectedValue(error);
    const wrapped = warp(client);

    await expect(
      wrapped.chat.completions.create({ model: 'gpt-4o', messages: [] })
    ).rejects.toThrow('Rate limit exceeded');

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
  it('intercepts responses.create and tracks the call', async () => {
    const client = createMockOpenAI(OPENAI_RESPONSE, OPENAI_RESPONSES_API_RESPONSE);
    const wrapped = warp(client);

    const result = await wrapped.responses.create({
      model: 'gpt-4o',
      input: 'Hi',
    });

    expect(result.output_text).toBe('Hello from Responses API!');
    expect(responseRegistry.has(result)).toBe(true);

    await flush();
    const body = parseFlushedBody(0);
    expect(body.calls).toHaveLength(1);
    expect(body.calls[0].model).toBe('gpt-4o');
    expect(body.calls[0].tokens.prompt).toBe(8);
    expect(body.calls[0].tokens.completion).toBe(6);
    expect(body.calls[0].status).toBe('success');
  });
});

describe('warp() — Anthropic', () => {
  it('intercepts messages.create and tracks the call', async () => {
    const client = createMockAnthropic(ANTHROPIC_RESPONSE);
    const wrapped = warp(client);

    const result = await wrapped.messages.create({
      model: 'claude-3-5-sonnet-latest',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(result.content[0].text).toBe('Hello from Claude!');
    expect(responseRegistry.has(result)).toBe(true);

    await flush();
    const body = parseFlushedBody(0);
    expect(body.calls).toHaveLength(1);
    expect(body.calls[0].provider).toBe('anthropic');
    expect(body.calls[0].tokens.prompt).toBe(12);
    expect(body.calls[0].tokens.completion).toBe(8);
  });
});
