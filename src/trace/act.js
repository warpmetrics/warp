// Warpmetrics SDK — act()

import { ref as getRef } from './ref.js';
import { logAct, getConfig } from '../core/transport.js';

/**
 * Record an action taken on an outcome (e.g. acting on feedback).
 *
 * @param {{ id: string, _type: 'outcome' } | string} target — Outcome handle from outcome(), or outcome ref string (wm_oc_*)
 * @param {string} name            — action name ("improve-section", "refine-prompt")
 * @param {Record<string, any>} [metadata] — arbitrary extra data
 */
export function act(target, name, metadata) {
  const targetId = getRef(target);

  if (!targetId) {
    if (getConfig().debug) console.warn('[warpmetrics] act() — target not tracked.');
    return;
  }

  if (!targetId.startsWith('wm_oc_')) {
    if (getConfig().debug) console.warn('[warpmetrics] act() — target must be an outcome (wm_oc_*).');
    return;
  }

  logAct({
    targetId,
    name,
    metadata: metadata || null,
  });
}
