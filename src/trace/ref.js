// Warpmetrics SDK — ref()

import { responseRegistry } from '../core/registry.js';

/**
 * Resolve any trackable target to its string ID.
 *
 * Accepts:
 *  - A string ref (pass-through)
 *  - A Run or Group object  ({ id, _type })
 *  - An LLM response object (looked up in the response registry)
 *
 * @param {object | string} target
 * @returns {string | undefined}
 */
export function ref(target) {
  if (typeof target === 'string') return target;

  if (target && target._type && target.id) return target.id;

  if (target && typeof target === 'object') {
    const callId = responseRegistry.get(target);
    if (callId) return callId;
  }

  return undefined;
}
