// Warpmetrics SDK — Type Definitions

export interface Run {
  readonly id: string;
  readonly _type: 'run';
}

export interface Group {
  readonly id: string;
  readonly _type: 'group';
}

export interface WarpOptions {
  apiKey?: string;
  baseUrl?: string;
  enabled?: boolean;
  flushInterval?: number;
  maxBatchSize?: number;
  debug?: boolean;
}

export interface RunOptions {
  /** External reference (e.g. "ticket:PROJ-101", a PR URL, etc.) */
  link?: string;
  /** Human-readable name */
  name?: string;
}

export interface GroupOptions {
  /** Human-readable name */
  name?: string;
}

export interface Outcome {
  readonly id: string;
  readonly _type: 'outcome';
}

export interface OutcomeOptions {
  /** Why this outcome occurred */
  reason?: string;
  /** Who / what recorded this outcome */
  source?: string;
  /** Categorisation tags */
  tags?: string[];
  /** Arbitrary extra data */
  metadata?: Record<string, any>;
}


/**
 * Wrap an LLM client to automatically track every API call.
 * Pass options on the first call to configure the SDK; env vars are used as defaults.
 */
export function warp<T>(client: T, options?: WarpOptions): T;

/** Create a run — the top-level unit that tracks one agent execution. */
export function run(label: string, options?: RunOptions): Run;

/** Create a group — a logical phase or step inside a run. */
export function group(label: string, options?: GroupOptions): Group;

/** Add items (groups or LLM responses) to a run or group. */
export function add(target: Run | Group | string, ...items: any[]): void;

/** Record an outcome on any tracked target. Returns an Outcome handle for use with act(). */
export function outcome(
  target: Run | Group | object | string,
  name: string,
  options?: OutcomeOptions,
): Outcome | undefined;

/** Record an action taken on an outcome (e.g. acting on feedback). */
export function act(
  target: Outcome | string,
  name: string,
  metadata?: Record<string, any>,
): void;

/** Resolve any trackable target to its string ID. */
export function ref(target: Run | Group | Outcome | object | string): string | undefined;

/** Manually flush pending events to the API. */
export function flush(): Promise<void>;
