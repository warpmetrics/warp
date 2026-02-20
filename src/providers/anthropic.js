// Warpmetrics SDK — Anthropic Provider

export const name = 'anthropic';

export function detect(client) {
  return client?.constructor?.name === 'Anthropic';
}

export function extract(result) {
  const input  = result?.usage?.input_tokens || 0;
  const output = result?.usage?.output_tokens || 0;
  const cacheWrite = result?.usage?.cache_creation_input_tokens || 0;
  const cacheRead  = result?.usage?.cache_read_input_tokens || 0;
  return {
    response: Array.isArray(result?.content)
      ? result.content.filter(c => c.type === 'text').map(c => c.text).join('')
      : '',
    tokens: { prompt: input + cacheWrite + cacheRead, completion: output, total: input + output + cacheWrite + cacheRead, cacheWrite, cacheRead },
    toolCalls: null,
  };
}

export function extractStreamDelta(chunk) {
  if (chunk.type === 'content_block_delta') {
    return { content: chunk.delta?.text || null, usage: null };
  }
  if (chunk.type === 'message_start') {
    return { content: null, usage: chunk.message?.usage || null };
  }
  if (chunk.type === 'message_delta') {
    return { content: null, usage: chunk.usage || null };
  }
  return { content: null, usage: null };
}

export function normalizeUsage(usage) {
  const prompt     = usage?.input_tokens || 0;
  const completion = usage?.output_tokens || 0;
  const cacheWrite = usage?.cache_creation_input_tokens || 0;
  const cacheRead  = usage?.cache_read_input_tokens || 0;
  return { prompt: prompt + cacheWrite + cacheRead, completion, total: prompt + completion + cacheWrite + cacheRead, cacheWrite, cacheRead };
}

export function proxy(client, intercept) {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (prop !== 'messages') return value;

      return new Proxy(value, {
        get(msgTarget, msgProp, msgReceiver) {
          const msgValue = Reflect.get(msgTarget, msgProp, msgReceiver);
          if (msgProp === 'create' && typeof msgValue === 'function') {
            return intercept(msgValue, msgTarget);
          }
          return msgValue;
        },
      });
    },
  });
}
