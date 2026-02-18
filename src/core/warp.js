// Warpmetrics SDK — warp()
// Wraps an LLM client so every API call is automatically tracked.

import { generateId } from './utils.js';
import { responseRegistry } from './registry.js';
import { setConfig, getConfig } from './transport.js';
import * as openai from '../providers/openai.js';
import * as anthropic from '../providers/anthropic.js';

const providers = [openai, anthropic];

// ---------------------------------------------------------------------------
// Provider resolution
// ---------------------------------------------------------------------------

function findProvider(client) {
  return providers.find(p => p.detect(client)) || null;
}

// ---------------------------------------------------------------------------
// Interceptor
// ---------------------------------------------------------------------------

function createInterceptor(originalFn, context, provider) {
  return async function (...args) {
    const start    = Date.now();
    const callId   = generateId('call');
    const model    = args[0]?.model || 'unknown';
    const messages = args[0]?.messages || args[0]?.input || [];
    const tools    = args[0]?.tools || null;
    const stream   = args[0]?.stream === true;

    try {
      const result  = await originalFn.apply(context, args);
      const duration = Date.now() - start;

      if (stream) {
        return wrapStream(result, { callId, provider, model, messages, tools, start });
      }

      const ext  = provider.extract(result);
      const endedAt = new Date().toISOString();

      responseRegistry.set(result, {
        id: callId,
        data: {
          id: callId, provider: provider.name, model, messages,
          response: ext.response,
          tools: tools ? tools.map(t => t.function?.name || t.name).filter(Boolean) : null,
          toolCalls: ext.toolCalls,
          tokens: ext.tokens, duration,
          startedAt: new Date(start).toISOString(),
          endedAt,
          status: 'success',
        },
      });

      return result;
    } catch (error) {
      const errorResult = { _warpError: true };
      const duration = Date.now() - start;
      responseRegistry.set(errorResult, {
        id: callId,
        data: {
          id: callId, provider: provider.name, model, messages,
          error: error.message,
          duration,
          startedAt: new Date(start).toISOString(),
          endedAt: new Date().toISOString(),
          status: 'error',
        },
      });
      error._warpResponse = errorResult;
      throw error;
    }
  };
}

// ---------------------------------------------------------------------------
// Streaming wrapper
// ---------------------------------------------------------------------------

function wrapStream(stream, ctx) {
  const wrapped = {
    async *[Symbol.asyncIterator]() {
      let content = '';
      let usage = null;

      for await (const chunk of stream) {
        const delta = ctx.provider.extractStreamDelta(chunk);
        if (delta.content) content += delta.content;
        if (delta.usage) {
          usage = usage ? { ...usage, ...delta.usage } : delta.usage;
        }
        yield chunk;
      }

      const tokens = usage
        ? ctx.provider.normalizeUsage(usage)
        : { prompt: 0, completion: 0, total: 0 };

      const duration = Date.now() - ctx.start;
      responseRegistry.set(wrapped, {
        id: ctx.callId,
        data: {
          id: ctx.callId, provider: ctx.provider.name, model: ctx.model, messages: ctx.messages,
          response: content,
          tools: ctx.tools ? ctx.tools.map(t => t.function?.name || t.name).filter(Boolean) : null,
          tokens,
          duration,
          startedAt: new Date(ctx.start).toISOString(),
          endedAt: new Date().toISOString(),
          status: 'success',
        },
      });
    },
  };
  return wrapped;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Wrap an LLM client to automatically track every API call.
 *
 * @param {object} client  — OpenAI or Anthropic client instance
 * @param {object} [opts]
 * @param {string} [opts.apiKey]
 * @param {string} [opts.baseUrl]
 * @param {boolean} [opts.enabled]
 * @param {number} [opts.flushInterval]
 * @param {number} [opts.maxBatchSize]
 * @param {boolean} [opts.debug]
 * @returns {object} — the same client, proxied
 */
export function warp(client, opts) {
  if (opts) {
    const cfg = getConfig();
    setConfig({
      apiKey:        opts.apiKey        ?? cfg.apiKey,
      baseUrl:       opts.baseUrl       ?? cfg.baseUrl,
      enabled:       opts.enabled       ?? cfg.enabled,
      flushInterval: opts.flushInterval ?? cfg.flushInterval,
      maxBatchSize:  opts.maxBatchSize  ?? cfg.maxBatchSize,
      debug:         opts.debug         ?? cfg.debug,
    });
  }

  const finalCfg = getConfig();
  if (finalCfg.debug) {
    const masked = finalCfg.apiKey
      ? finalCfg.apiKey.slice(0, 10) + '...' + finalCfg.apiKey.slice(-4)
      : '(none)';
    console.log(`[warpmetrics] Config: baseUrl=${finalCfg.baseUrl} apiKey=${masked} enabled=${finalCfg.enabled} flushInterval=${finalCfg.flushInterval} maxBatchSize=${finalCfg.maxBatchSize}`);
  }

  const provider = findProvider(client);

  if (!provider) {
    if (getConfig().debug) {
      console.warn('[warpmetrics] Unknown client type — supported: OpenAI, Anthropic.');
    }
    return client;
  }

  return provider.proxy(client, (originalFn, context) =>
    createInterceptor(originalFn, context, provider),
  );
}
