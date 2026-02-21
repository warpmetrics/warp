import { describe, it, expect } from 'vitest';
import { run, trace, flush } from '../index.js';
import { setupBeforeEach, parseFlushedBody } from '../../test/setup.js';

setupBeforeEach();

describe('trace()', () => {
  it('sends cost in USD when provided', async () => {
    const r = run('test');
    trace(r, {
      provider: 'google',
      model: 'gemini-pro',
      tokens: { prompt: 100, completion: 50, total: 150 },
      cost: 0.005,
    });

    await flush();
    const body = parseFlushedBody(0);
    const c = body.calls[0];
    expect(c.cost).toBe(0.005);
    expect(c.tokens.prompt).toBe(100);
    expect(c.tokens.completion).toBe(50);
  });

  it('sends cost of 0 when explicitly 0', async () => {
    const r = run('test');
    trace(r, {
      provider: 'custom',
      model: 'free-model',
      cost: 0,
    });

    await flush();
    const body = parseFlushedBody(0);
    expect(body.calls[0].cost).toBe(0);
  });

  it('does not send cost when not provided', async () => {
    const r = run('test');
    trace(r, {
      provider: 'openai',
      model: 'gpt-4o',
      tokens: { prompt: 10, completion: 5, total: 15 },
    });

    await flush();
    const body = parseFlushedBody(0);
    expect(body.calls[0].cost).toBeUndefined();
  });

  it('preserves cost precision', async () => {
    const r = run('test');
    trace(r, {
      provider: 'openai',
      model: 'gpt-4',
      cost: 123.456789,
    });

    await flush();
    const body = parseFlushedBody(0);
    expect(body.calls[0].cost).toBe(123.456789);
  });
});
