// Warpmetrics SDK — run()

import { generateId } from '../core/utils.js';
import { runRegistry } from '../core/registry.js';
import { logRun } from '../core/transport.js';

/**
 * Create a run — the top-level unit that tracks one agent execution.
 *
 * @param {string} label  — run type used for aggregation ("code-review", "bug-fix")
 * @param {object} [options]
 * @param {string} [options.link]  — external reference ("ticket:PROJ-101", PR URL, etc.)
 * @param {string} [options.name]  — human-readable name
 * @returns {{ readonly id: string, readonly _type: 'run' }}
 */
export function run(label, options = {}) {
  const id = generateId('run');

  const data = {
    id,
    label,
    link: options.link || null,
    name: options.name || null,
    groups: [],
    calls: [],
  };

  runRegistry.set(id, data);
  logRun(data);

  return Object.freeze({ id, _type: 'run' });
}
