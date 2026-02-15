// Warpmetrics SDK — ref()

import { runRegistry, groupRegistry, outcomeRegistry, actRegistry, responseRegistry } from '../core/registry.js';

/**
 * Resolve any trackable target to its string ID.
 *
 * When a raw ID string is passed (e.g. loaded from a database or fetched
 * from the API), it is adopted into the local registry so that downstream
 * calls like group(), call(), outcome(), and act() can reference it.
 *
 * Accepts:
 *  - A string ref (e.g. "wm_run_...", "wm_grp_...", "wm_oc_...", "wm_act_...")
 *  - A Run, Group, Outcome, or Act object  ({ id, _type })
 *  - An LLM response object (looked up in the response registry)
 *
 * @param {object | string} target
 * @returns {string | undefined}
 */
export function ref(target) {
  if (typeof target === 'string') {
    ensureRegistered(target);
    return target;
  }

  if (target && target._type && target.id) return target.id;

  if (target && typeof target === 'object') {
    const entry = responseRegistry.get(target);
    if (entry) return entry.id;
  }

  return undefined;
}

const REGISTRIES = [
  ['wm_run_', runRegistry],
  ['wm_grp_', groupRegistry],
  ['wm_oc_', outcomeRegistry],
  ['wm_act_', actRegistry],
];

function ensureRegistered(id) {
  for (const [prefix, registry] of REGISTRIES) {
    if (id.startsWith(prefix)) {
      if (!registry.has(id)) {
        registry.set(id, { id, label: null, opts: null, groups: [], calls: [], stub: true });
      }
      return;
    }
  }
}
