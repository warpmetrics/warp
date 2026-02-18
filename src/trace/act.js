// Warpmetrics SDK — act()

import { ref as getRef } from './ref.js';
import { generateId } from '../core/utils.js';
import { actRegistry } from '../core/registry.js';
import { logAct, getConfig } from '../core/transport.js';

/**
 * Record an action taken on an outcome (e.g. acting on feedback).
 *
 * Three modes:
 *
 * 1. Normal:     act(outcome, name, opts?)     — queue an act event
 * 2. Descriptor: act(name, opts?)              — return a descriptor (no queue)
 * 3. Reserved:   act(outcome, reserved, opts?) — complete a reserved act
 *
 * @param {{ id: string, _type: 'outcome' } | string} target
 * @param {string | { id: string, _type: 'act', name: string, opts: any }} nameOrReserved
 * @param {Record<string, any>} [opts]
 * @returns {{ readonly id: string, readonly _type: 'act' } | { _descriptor: true, _eventType: 'act', name: string, opts: any } | undefined}
 */
export function act(target, nameOrReserved, opts) {
  // Path A — Descriptor mode: act(name) or act(name, opts)
  // First arg is a string that doesn't look like a wm_ ref
  if (typeof target === 'string' && !target.startsWith('wm_')) {
    return { _descriptor: true, _eventType: 'act', name: target, opts: nameOrReserved || null };
  }

  // Path B — Complete a reserved act: act(outcome, reserved, extraOpts?)
  if (nameOrReserved && typeof nameOrReserved === 'object' && nameOrReserved._type === 'act' && nameOrReserved.id) {
    const refId = getRef(target);

    if (!refId) {
      if (getConfig().debug) console.warn('[warpmetrics] act() — target not tracked.');
      return undefined;
    }

    if (!refId.startsWith('wm_oc_')) {
      if (getConfig().debug) console.warn('[warpmetrics] act() — target must be an outcome (wm_oc_*).');
      return undefined;
    }

    const id = nameOrReserved.id;
    const mergedOpts = opts ? { ...nameOrReserved.opts, ...opts } : (nameOrReserved.opts || null);

    const existing = actRegistry.get(id);
    actRegistry.set(id, { ...existing, id, refId });
    logAct({ id, refId, name: nameOrReserved.name, opts: mergedOpts });

    return Object.freeze({ id, _type: 'act' });
  }

  // Path C — Normal: act(outcome, name, opts?)
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

  logAct({ id, refId, name: nameOrReserved, opts: opts || null });

  return Object.freeze({ id, _type: 'act' });
}
