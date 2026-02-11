// Warpmetrics SDK — group()

import { ref as getRef } from './ref.js';
import { generateId } from '../core/utils.js';
import { runRegistry, groupRegistry } from '../core/registry.js';
import { logGroup, logLink, getConfig } from '../core/transport.js';

/**
 * Create a group — a logical phase or step inside a run or another group.
 *
 * @param {object | string} target  — Run, Group, or ref string
 * @param {string} label            — group type used for aggregation ("planner", "coder")
 * @param {Record<string, any>} [opts]
 * @returns {{ readonly id: string, readonly _type: 'group' }}
 */
export function group(target, label, opts) {
  const targetId = getRef(target);
  if (!targetId) {
    if (getConfig().debug) console.warn('[warpmetrics] group() — target not recognised.');
    return Object.freeze({ id: generateId('grp'), _type: 'group' });
  }

  const parentData = runRegistry.get(targetId) || groupRegistry.get(targetId);
  if (!parentData) {
    if (getConfig().debug) console.warn(`[warpmetrics] group() — target not in registry: ${targetId}`);
    return Object.freeze({ id: generateId('grp'), _type: 'group' });
  }

  const id = generateId('grp');

  const data = {
    id,
    label,
    opts: opts || null,
    parentId: targetId,
    groups: [],
    calls: [],
  };

  groupRegistry.set(id, data);
  parentData.groups.push(id);

  logGroup(data);
  logLink({ parentId: targetId, childId: id, type: 'group' });

  return Object.freeze({ id, _type: 'group' });
}
