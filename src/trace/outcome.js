// Warpmetrics SDK — outcome()

import { ref as getRef } from './ref.js';
import { generateId } from '../core/utils.js';
import { logOutcome, getConfig } from '../core/transport.js';

/**
 * Record an outcome on any tracked target.
 *
 * Returns a frozen Outcome handle that can be passed to act().
 *
 * @param {object | string} target — Run, Group, LLM response, or ref string
 * @param {string} name            — outcome name ("completed", "failed", "helpful")
 * @param {object} [options]
 * @param {string} [options.reason]            — why this outcome occurred
 * @param {string} [options.source]            — who / what recorded it
 * @param {string[]} [options.tags]            — categorisation tags
 * @param {Record<string, any>} [options.metadata] — arbitrary extra data
 * @returns {{ id: string, _type: 'outcome' } | undefined}
 */
export function outcome(target, name, options = {}) {
  const refId = getRef(target);

  if (!refId) {
    if (getConfig().debug) console.warn('[warpmetrics] outcome() — target not tracked.');
    return undefined;
  }

  const id = generateId('oc');

  logOutcome({
    id,
    refId,
    name,
    reason:   options.reason   || null,
    source:   options.source   || null,
    tags:     options.tags     || null,
    metadata: options.metadata || null,
  });

  return Object.freeze({ id, _type: 'outcome' });
}
