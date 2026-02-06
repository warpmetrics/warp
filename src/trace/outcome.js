// Warpmetrics SDK — outcome()

import { ref as getRef } from './ref.js';
import { logOutcome, getConfig } from '../core/transport.js';

/**
 * Record an outcome on any tracked target.
 *
 * @param {object | string} target — Run, Group, LLM response, or ref string
 * @param {string} name            — outcome name ("completed", "failed", "helpful")
 * @param {object} [options]
 * @param {string} [options.reason]            — why this outcome occurred
 * @param {string} [options.source]            — who / what recorded it
 * @param {string[]} [options.tags]            — categorisation tags
 * @param {Record<string, any>} [options.metadata] — arbitrary extra data
 */
export function outcome(target, name, options = {}) {
  const targetId = getRef(target);

  if (!targetId) {
    if (getConfig().debug) console.warn('[warpmetrics] outcome() — target not tracked.');
    return;
  }

  logOutcome({
    targetId,
    name,
    reason:   options.reason   || null,
    source:   options.source   || null,
    tags:     options.tags     || null,
    metadata: options.metadata || null,
  });
}
