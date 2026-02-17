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

export interface TraceData {
  /** Provider name (e.g. "google", "cohere"). */
  provider: string;
  /** Model identifier. */
  model: string;
  /** Request messages/input. */
  messages?: any;
  /** Response text. */
  response?: string;
  /** Tool names available. */
  tools?: string[];
  /** Tool calls made. */
  toolCalls?: { id?: string; name: string; arguments?: string }[];
  /** Token usage. */
  tokens?: { prompt?: number; completion?: number; total?: number };
  /** Duration in milliseconds. */
  duration?: number;
  /** ISO 8601 timestamp of when the call started. Computed from endedAt - duration if omitted. */
  startedAt?: string;
  /** ISO 8601 timestamp of when the call ended (auto-generated if omitted). */
  endedAt?: string;
  /** "success" (default) or "error". */
  status?: string;
  /** Error message. */
  error?: string;
  /** Cost in USD. */
  cost?: number;
  /** Custom metadata. */
  opts?: Record<string, any>;
}

export interface Call {
  readonly id: string;
  readonly _type: 'call';
}

/** Manually record an LLM call for providers not wrapped by warp(). */
export function trace(target: Run | Group | string, data: TraceData): Call | undefined;

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
