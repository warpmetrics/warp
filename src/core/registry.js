// Warpmetrics SDK — Registries
// Module-level state that tracks runs, groups, and calls in memory.

/** @type {Map<string, object>}  run id → run data */
export const runRegistry = new Map();

/** @type {Map<string, object>}  group id → group data */
export const groupRegistry = new Map();

/** @type {Map<string, object>}  outcome id → outcome data */
export const outcomeRegistry = new Map();

/** @type {Map<string, object>}  act id → act data */
export const actRegistry = new Map();

/** @type {WeakMap<object, { id: string, data: object }>}  LLM response object → buffered call */
export const responseRegistry = new WeakMap();
