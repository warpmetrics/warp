// Warpmetrics SDK — add()

import { runRegistry, groupRegistry, responseRegistry } from '../core/registry.js';
import { logLink, getConfig } from '../core/transport.js';
import { ref as getRef } from './ref.js';

/**
 * Add items (groups or LLM responses) to a run or group.
 *
 * @param {object | string} target  — Run, Group, or ref string
 * @param {...object} items         — Group objects or LLM response objects
 */
export function add(target, ...items) {
  const targetId = getRef(target);
  if (!targetId) {
    if (getConfig().debug) console.warn('[warpmetrics] add() — target not recognised.');
    return;
  }

  const data = runRegistry.get(targetId) || groupRegistry.get(targetId);
  if (!data) {
    if (getConfig().debug) console.warn(`[warpmetrics] add() — target not in registry: ${targetId}`);
    return;
  }

  for (const item of items) {
    // Group
    if (item && item._type === 'group') {
      const groupData = groupRegistry.get(item.id);
      if (groupData) {
        groupData.parentId = targetId;
        data.groups.push(item.id);
        logLink({ parentId: targetId, childId: item.id, type: 'group' });
      }
      continue;
    }

    // Run → cannot nest runs
    if (item && item._type === 'run') {
      if (getConfig().debug) console.warn('[warpmetrics] add() — cannot add a run to another target.');
      continue;
    }

    // LLM response
    const callId = responseRegistry.get(item);
    if (callId) {
      data.calls.push(callId);
      logLink({ parentId: targetId, childId: callId, type: 'call' });
    } else if (getConfig().debug) {
      console.warn('[warpmetrics] add() — item not tracked. Was it from a warp()-ed client?');
    }
  }
}
