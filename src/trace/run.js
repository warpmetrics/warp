// Warpmetrics SDK — run()

import { ref as getRef } from './ref.js';
import { generateId } from '../core/utils.js';
import { runRegistry } from '../core/registry.js';
import { logRun, getConfig } from '../core/transport.js';

/**
 * Create a run — the top-level unit that tracks one agent execution.
 *
 * @param {string | { id: string, _type: 'act' }} labelOrRef — run label, or act ref for follow-up runs
 * @param {string | Record<string, any>} [labelOrOpts] — label (if first arg is act ref) or opts
 * @param {Record<string, any>} [maybeOpts]
 * @returns {{ readonly id: string, readonly _type: 'run' }}
 */
export function run(labelOrRef, labelOrOpts, maybeOpts) {
  const startedAt = new Date().toISOString();
  let refId = null;
  let label, opts;

  if (typeof labelOrRef === 'string' && !labelOrRef.startsWith('wm_act_')) {
    label = labelOrRef;
    opts = labelOrOpts || null;
  } else {
    refId = getRef(labelOrRef);
    if (refId && !refId.startsWith('wm_act_')) {
      if (getConfig().debug) console.warn('[warpmetrics] run() ref must be an act (wm_act_*).');
      refId = null;
    }
    label = labelOrOpts;
    opts = maybeOpts || null;
  }

  const id = generateId('run');

  const data = {
    id,
    label,
    opts,
    refId,
    startedAt,
    groups: [],
    calls: [],
  };

  runRegistry.set(id, data);
  logRun(data);

  return Object.freeze({ id, _type: 'run' });
}
