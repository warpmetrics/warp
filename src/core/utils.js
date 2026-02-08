// Warpmetrics SDK — Utilities

import { monotonicFactory } from 'ulid';

const ulid = monotonicFactory();

/**
 * Generate a prefixed ULID-based unique ID (lowercase).
 * @param {'run' | 'grp' | 'call'} prefix
 * @returns {string} e.g. "wm_run_01jkx3ndek0gh4r5tmqp9a3bcv"
 */
export function generateId(prefix) {
  return `wm_${prefix}_${ulid().toLowerCase()}`;
}

