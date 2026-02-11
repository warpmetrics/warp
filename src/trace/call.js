// Warpmetrics SDK — call()

import { ref as getRef } from './ref.js';
import { runRegistry, groupRegistry, responseRegistry } from '../core/registry.js';
import { logCall, logLink, getConfig } from '../core/transport.js';

/**
 * Track an LLM call by linking a response to a run or group.
 *
 * @param {object | string} target    — Run, Group, or ref string
 * @param {object} response           — LLM response object from a warp()-ed client
 * @param {Record<string, any>} [opts]
 */
export function call(target, response, opts) {
  const targetId = getRef(target);
  if (!targetId) {
    if (getConfig().debug) console.warn('[warpmetrics] call() — target not recognised.');
    return;
  }

  const parentData = runRegistry.get(targetId) || groupRegistry.get(targetId);
  if (!parentData) {
    if (getConfig().debug) console.warn(`[warpmetrics] call() — target not in registry: ${targetId}`);
    return;
  }

  const entry = responseRegistry.get(response);
  if (!entry) {
    if (getConfig().debug) console.warn('[warpmetrics] call() — response not tracked. Was it from a warp()-ed client?');
    return;
  }

  const { id, data } = entry;
  if (opts) data.opts = opts;

  logCall(data);
  logLink({ parentId: targetId, childId: id, type: 'call' });
  parentData.calls.push(id);

  responseRegistry.delete(response);
}
