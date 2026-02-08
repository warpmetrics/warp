// Warpmetrics SDK — OpenAI Provider
// Supports both Chat Completions and Responses API.

export const name = 'openai';

export function detect(client) {
  return client?.constructor?.name === 'OpenAI';
}

// ---------------------------------------------------------------------------
// Response extraction
// ---------------------------------------------------------------------------

function isResponsesAPI(result) {
  return result?.object === 'response' || Array.isArray(result?.output);
}

function extractChatCompletions(result) {
  const prompt     = result?.usage?.prompt_tokens || 0;
  const completion = result?.usage?.completion_tokens || 0;
  const cachedInput = result?.usage?.prompt_tokens_details?.cached_tokens || 0;

  return {
    response: result?.choices?.[0]?.message?.content || '',
    tokens: {
      prompt,
      completion,
      total: result?.usage?.total_tokens || 0,
      cachedInput,
    },
    toolCalls: result?.choices?.[0]?.message?.tool_calls?.map(tc => ({
      id: tc.id,
      name: tc.function?.name,
      arguments: tc.function?.arguments,
    })) || null,
  };
}

function extractResponses(result) {
  const textItems = (result?.output || [])
    .filter(item => item.type === 'message')
    .flatMap(item => (item.content || []).filter(c => c.type === 'output_text'));

  const text = result?.output_text || textItems.map(c => c.text).join('') || '';

  const input  = result?.usage?.input_tokens || 0;
  const output = result?.usage?.output_tokens || 0;
  const cachedInput = result?.usage?.input_tokens_details?.cached_tokens || 0;

  const fnCalls = (result?.output || []).filter(item => item.type === 'function_call');

  return {
    response: text,
    tokens: { prompt: input, completion: output, total: input + output, cachedInput },
    toolCalls: fnCalls.length > 0
      ? fnCalls.map(fc => ({ id: fc.id, name: fc.name, arguments: fc.arguments }))
      : null,
  };
}

export function extract(result) {
  return isResponsesAPI(result) ? extractResponses(result) : extractChatCompletions(result);
}

// ---------------------------------------------------------------------------
// Streaming extraction
// ---------------------------------------------------------------------------

export function extractStreamDelta(chunk) {
  // Responses API streaming
  if (chunk.type === 'response.output_text.delta') {
    return { content: chunk.delta || null, usage: null };
  }
  if (chunk.type === 'response.completed') {
    return { content: null, usage: chunk.response?.usage || null };
  }

  // Chat Completions streaming
  return {
    content: chunk.choices?.[0]?.delta?.content || null,
    usage:   chunk.usage || null,
  };
}

export function normalizeUsage(usage) {
  const prompt     = usage?.prompt_tokens || usage?.input_tokens || 0;
  const completion = usage?.completion_tokens || usage?.output_tokens || 0;
  const cachedInput = usage?.prompt_tokens_details?.cached_tokens
    || usage?.input_tokens_details?.cached_tokens || 0;
  return { prompt, completion, total: prompt + completion, cachedInput };
}

// ---------------------------------------------------------------------------
// Proxy
// ---------------------------------------------------------------------------

function interceptCreate(target, prop, intercept) {
  const value = Reflect.get(target, prop);
  if (prop === 'create' && typeof value === 'function') {
    return intercept(value, target);
  }
  return value;
}

export function proxy(client, intercept) {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      // client.responses.create()
      if (prop === 'responses' && value) {
        return new Proxy(value, {
          get(rTarget, rProp) {
            return interceptCreate(rTarget, rProp, intercept);
          },
        });
      }

      // client.chat.completions.create()
      if (prop === 'chat' && value) {
        return new Proxy(value, {
          get(chatTarget, chatProp) {
            const chatValue = Reflect.get(chatTarget, chatProp);
            if (chatProp !== 'completions') return chatValue;

            return new Proxy(chatValue, {
              get(compTarget, compProp) {
                return interceptCreate(compTarget, compProp, intercept);
              },
            });
          },
        });
      }

      return value;
    },
  });
}
