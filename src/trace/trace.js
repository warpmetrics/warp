// Warpmetrics SDK — trace()

import { ref as getRef } from './ref.js';
import { generateId } from '../core/utils.js';
import { runRegistry, groupRegistry } from '../core/registry.js';
import { logCall, logLink, getConfig } from '../core/transport.js';

export function trace(target, data) {
  if (!data || !data.provider || !data.model) {
    if (getConfig().debug) console.warn('[warpmetrics] trace() — data must include provider and model.');
    return;
  }

  const targetId = getRef(target);
  if (!targetId) {
    if (getConfig().debug) console.warn('[warpmetrics] trace() — target not recognised.');
    return;
  }

  const parentData = runRegistry.get(targetId) || groupRegistry.get(targetId);

  const id = generateId('call');

  const event = {
    id,
    provider: data.provider,
    model: data.model,
    messages: data.messages || [],
    response: data.response || null,
    tools: data.tools || null,
    toolCalls: data.toolCalls || null,
    tokens: data.tokens || null,
    latency: data.latency || 0,
    timestamp: data.timestamp || new Date().toISOString(),
    status: data.status || 'success',
  };

  if (data.error) event.error = data.error;
  if (data.opts) event.opts = data.opts;
  if (data.cost != null) event.costOverride = Math.round(data.cost * 1_000_000);

  logCall(event);
  logLink({ parentId: targetId, childId: id, type: 'call' });
  if (parentData?.calls) parentData.calls.push(id);

  return Object.freeze({ id, _type: 'call' });
}
