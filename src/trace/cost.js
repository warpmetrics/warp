// Warpmetrics SDK — cost()

import { ref as getRef } from './ref.js';
import { runRegistry, groupRegistry, costRegistry, costByCallId } from '../core/registry.js';

/**
 * Get the cost in USD for any tracked target.
 *
 * - Response object → cost of that single call
 * - Run / Group      → sum of all nested calls
 * - Ref string       → lookup in registries
 *
 * @param {object | string} target
 * @returns {number} cost in USD
 */
export function cost(target) {
  // Response object — direct lookup
  if (typeof target === 'object' && costRegistry.has(target)) {
    return costRegistry.get(target);
  }

  const id = getRef(target);
  if (!id) return 0;

  // Single call by ref string
  if (id.startsWith('wm_call_')) {
    return costByCallId.get(id) || 0;
  }

  // Run or Group — aggregate
  const container = runRegistry.get(id) || groupRegistry.get(id);
  if (container) return sumCosts(container);

  return 0;
}

function sumCosts(container) {
  let total = 0;

  for (const callId of container.calls) {
    total += costByCallId.get(callId) || 0;
  }

  for (const groupId of container.groups) {
    const g = groupRegistry.get(groupId);
    if (g) total += sumCosts(g);
  }

  return total;
}
