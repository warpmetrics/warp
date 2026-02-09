import { describe, it, expect } from 'vitest';
import { extract, extractStreamDelta, normalizeUsage } from './openai.js';

describe('openai provider', () => {
  describe('extract — Chat Completions', () => {
    it('extracts tool calls', () => {
      const result = {
        choices: [{
          message: {
            content: null,
            tool_calls: [{
              id: 'call_1',
              function: { name: 'get_weather', arguments: '{"city":"NYC"}' },
            }],
          },
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      const ext = extract(result);
      expect(ext.toolCalls).toHaveLength(1);
      expect(ext.toolCalls[0].name).toBe('get_weather');
      expect(ext.response).toBe('');
    });

    it('handles missing usage gracefully', () => {
      const result = { choices: [{ message: { content: 'Hi' } }] };
      const ext = extract(result);
      expect(ext.tokens.prompt).toBe(0);
      expect(ext.tokens.total).toBe(0);
      expect(ext.response).toBe('Hi');
    });

    it('extracts cached input tokens', () => {
      const result = {
        choices: [{ message: { content: 'Hi' } }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
          prompt_tokens_details: { cached_tokens: 3 },
        },
      };
      const ext = extract(result);
      expect(ext.tokens.cachedInput).toBe(3);
    });
  });

  describe('extract — Responses API', () => {
    it('extracts function calls from output', () => {
      const result = {
        object: 'response',
        output: [
          { type: 'function_call', id: 'fc_1', name: 'search', arguments: '{}' },
        ],
        output_text: '',
        usage: { input_tokens: 5, output_tokens: 3 },
      };

      const ext = extract(result);
      expect(ext.toolCalls).toHaveLength(1);
      expect(ext.toolCalls[0].name).toBe('search');
    });

    it('extracts text from output items when output_text is empty', () => {
      const result = {
        object: 'response',
        output: [{
          type: 'message',
          content: [{ type: 'output_text', text: 'Hello' }],
        }],
        output_text: '',
        usage: { input_tokens: 5, output_tokens: 3 },
      };

      const ext = extract(result);
      expect(ext.response).toBe('Hello');
    });

    it('returns null toolCalls when no function_call items', () => {
      const result = {
        object: 'response',
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Hi' }] }],
        output_text: 'Hi',
        usage: { input_tokens: 5, output_tokens: 3 },
      };

      const ext = extract(result);
      expect(ext.toolCalls).toBe(null);
    });
  });

  describe('extractStreamDelta', () => {
    it('extracts Responses API text delta', () => {
      const delta = extractStreamDelta({ type: 'response.output_text.delta', delta: 'Hi' });
      expect(delta.content).toBe('Hi');
      expect(delta.usage).toBe(null);
    });

    it('extracts Responses API completed event', () => {
      const usage = { input_tokens: 5, output_tokens: 3 };
      const delta = extractStreamDelta({ type: 'response.completed', response: { usage } });
      expect(delta.content).toBe(null);
      expect(delta.usage).toBe(usage);
    });

    it('extracts Chat Completions delta', () => {
      const delta = extractStreamDelta({ choices: [{ delta: { content: 'Hi' } }] });
      expect(delta.content).toBe('Hi');
    });
  });

  describe('normalizeUsage', () => {
    it('normalizes Chat Completions usage', () => {
      const usage = { prompt_tokens: 10, completion_tokens: 5 };
      const result = normalizeUsage(usage);
      expect(result.prompt).toBe(10);
      expect(result.completion).toBe(5);
      expect(result.total).toBe(15);
    });

    it('normalizes Responses API usage', () => {
      const usage = { input_tokens: 8, output_tokens: 6 };
      const result = normalizeUsage(usage);
      expect(result.prompt).toBe(8);
      expect(result.completion).toBe(6);
      expect(result.total).toBe(14);
    });

    it('includes cached tokens from Responses API', () => {
      const usage = { input_tokens: 8, output_tokens: 6, input_tokens_details: { cached_tokens: 2 } };
      const result = normalizeUsage(usage);
      expect(result.cachedInput).toBe(2);
    });
  });
});
