// Warpmetrics SDK — Type Definitions

export interface Run {
  readonly id: string;
  readonly _type: 'run';
}

export interface Group {
  readonly id: string;
  readonly _type: 'group';
}

export interface WarpOpts {
  apiKey?: string;
  baseUrl?: string;
  enabled?: boolean;
  flushInterval?: number;
  maxBatchSize?: number;
  debug?: boolean;
}

export interface Outcome {
  readonly id: string;
  readonly _type: 'outcome';
}

export interface Act {
  readonly id: string;
  readonly _type: 'act';
}


/**
 * Wrap an LLM client to automatically track every API call.
 * Pass options on the first call to configure the SDK; env vars are used as defaults.
 */
export function warp<T>(client: T, opts?: WarpOpts): T;

/** Create a run — the top-level unit that tracks one agent execution. */
export function run(label: string, opts?: Record<string, any>): Run;
/** Create a follow-up run from an act. */
export function run(act: Act | string, label: string, opts?: Record<string, any>): Run;

/** Create a group — a logical phase or step inside a run or group. */
export function group(target: Run | Group | string, label: string, opts?: Record<string, any>): Group;

/** Track an LLM call by linking a response to a run or group. */
export function call(target: Run | Group | string, response: object, opts?: Record<string, any>): void;

/** Record an outcome on any tracked target. Returns an Outcome handle for use with act(). */
export function outcome(
  target: Run | Group | object | string,
  name: string,
  opts?: Record<string, any>,
): Outcome | undefined;

/** Record an action taken on an outcome. Returns an Act handle for use with run(). */
export function act(
  target: Outcome | string,
  name: string,
  opts?: Record<string, any>,
): Act | undefined;

/** Resolve any trackable target to its string ID. */
export function ref(target: Run | Group | Act | Outcome | object | string): string | undefined;

/** Manually flush pending events to the API. */
export function flush(): Promise<void>;
