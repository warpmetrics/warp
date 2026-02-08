// Warpmetrics SDK — Registries
// Module-level state that tracks runs, groups, and calls in memory.

/** @type {Map<string, object>}  run id → run data */
export const runRegistry = new Map();

/** @type {Map<string, object>}  group id → group data */
export const groupRegistry = new Map();

/** @type {WeakMap<object, string>}  LLM response object → call id */
export const responseRegistry = new WeakMap();
