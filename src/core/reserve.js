// Warpmetrics SDK — reserve()

import { generateId } from './utils.js';
import { actRegistry, runRegistry, groupRegistry, outcomeRegistry } from './registry.js';

/**
 * Reserve an event ID without queueing.
 *
 * Takes a descriptor (returned by calling an event function without its
 * required target) and assigns a pre-generated ID.  The ID is registered
 * as a stub so that ref() can resolve it immediately.
 *
 * @param {{ _descriptor: true, _eventType: string, name: string, opts: Record<string, any> | null }} descriptor
 * @returns {Readonly<{ id: string, _type: string, name: string, opts: Record<string, any> | null }>}
 */
export function reserve(descriptor) {
  if (!descriptor || !descriptor._descriptor) {
    throw new Error('reserve() requires a descriptor from act(), run(), etc.');
  }

  const prefixMap = { act: 'act', run: 'run', group: 'grp', outcome: 'oc' };
  const prefix = prefixMap[descriptor._eventType];
  if (!prefix) {
    throw new Error(`reserve() — unknown event type: ${descriptor._eventType}`);
  }

  const id = generateId(prefix);

  // Register as stub so ref() can resolve it
  const registryMap = { act: actRegistry, run: runRegistry, group: groupRegistry, outcome: outcomeRegistry };
  const registry = registryMap[descriptor._eventType];
  if (!registry) {
    throw new Error(`reserve() — no registry for event type: ${descriptor._eventType}`);
  }
  registry.set(id, { id, stub: true });

  return Object.freeze({
    id,
    _type: descriptor._eventType,
    name: descriptor.name,
    opts: descriptor.opts,
  });
}
