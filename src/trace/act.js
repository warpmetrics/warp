// Warpmetrics SDK — act()

import { ref as getRef } from './ref.js';
import { generateId } from '../core/utils.js';
import { actRegistry } from '../core/registry.js';
import { logAct, getConfig } from '../core/transport.js';

/**
 * Record an action taken on an outcome (e.g. acting on feedback).
 *
 * @param {{ id: string, _type: 'outcome' } | string} target — Outcome handle from outcome(), or outcome ref string (wm_oc_*)
 * @param {string} name            — action name ("improve-section", "refine-prompt")
 * @param {Record<string, any>} [metadata] — arbitrary extra data
 * @returns {{ readonly id: string, readonly _type: 'act' } | undefined}
 */
export function act(target, name, metadata) {
  const refId = getRef(target);

  if (!refId) {
    if (getConfig().debug) console.warn('[warpmetrics] act() — target not tracked.');
    return undefined;
  }

  if (!refId.startsWith('wm_oc_')) {
    if (getConfig().debug) console.warn('[warpmetrics] act() — target must be an outcome (wm_oc_*).');
    return undefined;
  }

  const id = generateId('act');
  actRegistry.set(id, { id, refId });

  logAct({ id, refId, name, metadata: metadata || null });

  return Object.freeze({ id, _type: 'act' });
}
