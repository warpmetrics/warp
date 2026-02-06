// Warpmetrics SDK — group()

import { generateId } from '../core/utils.js';
import { groupRegistry } from '../core/registry.js';
import { logGroup } from '../core/transport.js';

/**
 * Create a group — a logical phase or step inside a run.
 *
 * @param {string} label  — group type used for aggregation ("planner", "coder")
 * @param {object} [options]
 * @param {string} [options.name]  — human-readable name
 * @returns {{ readonly id: string, readonly _type: 'group' }}
 */
export function group(label, options = {}) {
  const id = generateId('grp');

  const data = {
    id,
    label,
    name: options.name || null,
    parentId: null,
    groups: [],
    calls: [],
  };

  groupRegistry.set(id, data);
  logGroup(data);

  return Object.freeze({ id, _type: 'group' });
}
