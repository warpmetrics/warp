// Warpmetrics SDK — outcome()

import { ref as getRef } from './ref.js';
import { generateId } from '../core/utils.js';
import { outcomeRegistry } from '../core/registry.js';
import { logOutcome, getConfig } from '../core/transport.js';

/**
 * Record an outcome on any tracked target.
 *
 * Returns a frozen Outcome handle that can be passed to act().
 *
 * @param {object | string} target — Run, Group, LLM response, or ref string
 * @param {string} name            — outcome name ("Completed", "Failed", "Helpful")
 * @param {Record<string, any>} [opts]
 * @returns {{ id: string, _type: 'outcome' } | undefined}
 */
export function outcome(target, name, opts) {
  const refId = getRef(target);

  if (!refId) {
    if (getConfig().debug) console.warn('[warpmetrics] outcome() — target not tracked.');
    return undefined;
  }

  const id = generateId('oc');

  outcomeRegistry.set(id, { id, refId, name, opts: opts || null });

  logOutcome({
    id,
    refId,
    name,
    opts: opts || null,
  });

  return Object.freeze({ id, _type: 'outcome' });
}
