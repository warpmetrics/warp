import { describe, it, expect } from 'vitest';
import { extract, extractStreamDelta, normalizeUsage } from './anthropic.js';

describe('anthropic provider', () => {
  describe('extract', () => {
    it('extracts text content', () => {
      const result = {
        content: [{ type: 'text', text: 'Hello' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      };
      const ext = extract(result);
      expect(ext.response).toBe('Hello');
      expect(ext.tokens.prompt).toBe(10);
      expect(ext.tokens.completion).toBe(5);
      expect(ext.tokens.total).toBe(15);
    });

    it('extracts cache tokens', () => {
      const result = {
        content: [{ type: 'text', text: 'Hi' }],
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          cache_creation_input_tokens: 3,
          cache_read_input_tokens: 2,
        },
      };
      const ext = extract(result);
      expect(ext.tokens.cacheWrite).toBe(3);
      expect(ext.tokens.cacheRead).toBe(2);
    });

    it('returns empty string when content is not an array', () => {
      const ext = extract({ content: 'not-array', usage: {} });
      expect(ext.response).toBe('');
    });

    it('filters non-text content blocks', () => {
      const result = {
        content: [
          { type: 'tool_use', name: 'search' },
          { type: 'text', text: 'Result' },
        ],
        usage: { input_tokens: 5, output_tokens: 3 },
      };
      const ext = extract(result);
      expect(ext.response).toBe('Result');
    });
  });

  describe('extractStreamDelta', () => {
    it('extracts content_block_delta text', () => {
      const delta = extractStreamDelta({
        type: 'content_block_delta',
        delta: { text: 'chunk' },
      });
      expect(delta.content).toBe('chunk');
      expect(delta.usage).toBe(null);
    });

    it('extracts message_delta usage', () => {
      const usage = { output_tokens: 10 };
      const delta = extractStreamDelta({ type: 'message_delta', usage });
      expect(delta.content).toBe(null);
      expect(delta.usage).toBe(usage);
    });

    it('returns nulls for other event types', () => {
      const delta = extractStreamDelta({ type: 'message_start' });
      expect(delta.content).toBe(null);
      expect(delta.usage).toBe(null);
    });
  });

  describe('normalizeUsage', () => {
    it('normalizes usage with cache tokens', () => {
      const usage = {
        input_tokens: 10,
        output_tokens: 5,
        cache_creation_input_tokens: 3,
        cache_read_input_tokens: 2,
      };
      const result = normalizeUsage(usage);
      expect(result.prompt).toBe(10);
      expect(result.completion).toBe(5);
      expect(result.total).toBe(15);
      expect(result.cacheWrite).toBe(3);
      expect(result.cacheRead).toBe(2);
    });
  });
});
