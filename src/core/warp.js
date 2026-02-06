// Warpmetrics SDK — warp()
// Wraps an LLM client so every API call is automatically tracked.

import { generateId, calculateCost } from './utils.js';
import { responseRegistry, costRegistry, costByCallId } from './registry.js';
import { logCall, setConfig, getConfig } from './transport.js';
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
      const latency = Date.now() - start;

      if (stream) {
        return wrapStream(result, { callId, provider, model, messages, tools, start });
      }

      const ext  = provider.extract(result);
      const cost = calculateCost(model, ext.tokens);

      logCall({
        id: callId, provider: provider.name, model, messages,
        response: ext.response,
        tools: tools ? tools.map(t => t.function?.name || t.name).filter(Boolean) : null,
        toolCalls: ext.toolCalls,
        tokens: ext.tokens, cost, latency,
        timestamp: new Date().toISOString(),
        status: 'success',
      });

      responseRegistry.set(result, callId);
      costRegistry.set(result, cost);
      costByCallId.set(callId, cost);

      return result;
    } catch (error) {
      logCall({
        id: callId, provider: provider.name, model, messages,
        error: error.message,
        latency: Date.now() - start,
        timestamp: new Date().toISOString(),
        status: 'error',
      });
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
        if (delta.usage) usage = delta.usage;
        yield chunk;
      }

      const tokens = usage
        ? ctx.provider.normalizeUsage(usage)
        : { prompt: 0, completion: 0, total: 0 };

      const cost = calculateCost(ctx.model, tokens);

      logCall({
        id: ctx.callId, provider: ctx.provider.name, model: ctx.model, messages: ctx.messages,
        response: content,
        tools: ctx.tools ? ctx.tools.map(t => t.function?.name || t.name).filter(Boolean) : null,
        tokens, cost,
        latency: Date.now() - ctx.start,
        timestamp: new Date().toISOString(),
        status: 'success',
      });

      responseRegistry.set(wrapped, ctx.callId);
      costRegistry.set(wrapped, cost);
      costByCallId.set(ctx.callId, cost);
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
 * @param {object} [options]
 * @param {string} [options.apiKey]
 * @param {string} [options.baseUrl]
 * @param {boolean} [options.enabled]
 * @param {number} [options.flushInterval]
 * @param {number} [options.maxBatchSize]
 * @param {boolean} [options.debug]
 * @returns {object} — the same client, proxied
 */
export function warp(client, options) {
  if (options) {
    const cfg = getConfig();
    setConfig({
      apiKey:        options.apiKey        ?? cfg.apiKey,
      baseUrl:       options.baseUrl       ?? cfg.baseUrl,
      enabled:       options.enabled       ?? cfg.enabled,
      flushInterval: options.flushInterval ?? cfg.flushInterval,
      maxBatchSize:  options.maxBatchSize  ?? cfg.maxBatchSize,
      debug:         options.debug         ?? cfg.debug,
    });
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
