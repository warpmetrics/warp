// Warpmetrics SDK — act()

import { ref as getRef } from './ref.js';
import { logAct, getConfig } from '../core/transport.js';

/**
 * Record an action taken on a tracked target (e.g. acting on feedback).
 *
 * @param {object | string} target — Run, Group, LLM response, or ref string
 * @param {string} name            — action name ("improve-section", "refine-prompt")
 * @param {Record<string, any>} [metadata] — arbitrary extra data
 */
export function act(target, name, metadata) {
  const targetId = getRef(target);

  if (!targetId) {
    if (getConfig().debug) console.warn('[warpmetrics] act() — target not tracked.');
    return;
  }

  logAct({
    targetId,
    name,
    metadata: metadata || null,
  });
}
