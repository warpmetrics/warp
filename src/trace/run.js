// Warpmetrics SDK — run()

import { ref as getRef } from './ref.js';
import { generateId } from '../core/utils.js';
import { runRegistry } from '../core/registry.js';
import { logRun, getConfig } from '../core/transport.js';

/**
 * Create a run — the top-level unit that tracks one agent execution.
 *
 * @param {string | { id: string, _type: 'act' }} labelOrRef — run label, or act ref for follow-up runs
 * @param {string | object} [labelOrOpts] — label (if first arg is act ref) or options
 * @param {object} [maybeOpts]
 * @param {string} [maybeOpts.link]  — external reference ("ticket:PROJ-101", PR URL, etc.)
 * @param {string} [maybeOpts.name]  — human-readable name
 * @returns {{ readonly id: string, readonly _type: 'run' }}
 */
export function run(labelOrRef, labelOrOpts, maybeOpts) {
  let refId = null;
  let label, options;

  if (typeof labelOrRef === 'string' && !labelOrRef.startsWith('wm_act_')) {
    label = labelOrRef;
    options = labelOrOpts || {};
  } else {
    refId = getRef(labelOrRef);
    if (refId && !refId.startsWith('wm_act_')) {
      if (getConfig().debug) console.warn('[warpmetrics] run() ref must be an act (wm_act_*).');
      refId = null;
    }
    label = labelOrOpts;
    options = maybeOpts || {};
  }

  const id = generateId('run');

  const data = {
    id,
    label,
    link: options.link || null,
    name: options.name || null,
    refId,
    groups: [],
    calls: [],
  };

  runRegistry.set(id, data);
  logRun(data);

  return Object.freeze({ id, _type: 'run' });
}
