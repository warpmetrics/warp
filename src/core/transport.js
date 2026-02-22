// Warpmetrics SDK — Transport
// Batches events and flushes them to the API over HTTP.

import { createRequire } from 'module';
const { version: SDK_VERSION } = createRequire(import.meta.url)('../../package.json');

const env = typeof process !== 'undefined' ? process.env : {};

let config = {
  apiKey: env.WARPMETRICS_API_KEY || null,
  baseUrl: env.WARPMETRICS_API_URL || 'https://api.warpmetrics.com',
  enabled: true,
  flushInterval: 1000,
  maxBatchSize: 100,
  debug: env.WARPMETRICS_DEBUG === 'true',
};

const queue = {
  runs: [],
  groups: [],
  calls: [],
  links: [],
  outcomes: [],
  acts: [],
};

let flushTimeout = null;

// Backoff state for 429 retry
let backoff = {
  active: false,
  delay: 0,       // current delay in ms
  retries: 0,
};

const BACKOFF_BASE = 2000;   // 2s initial backoff
const BACKOFF_MAX = 60000;   // 60s cap
const BACKOFF_JITTER = 0.3;  // ±30% jitter

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export function setConfig(updates) {
  config = { ...config, ...updates };
}

export function getConfig() {
  return config;
}

/** Clear all pending events without sending. For testing only. */
export function clearQueue() {
  queue.runs.length = 0;
  queue.groups.length = 0;
  queue.calls.length = 0;
  queue.links.length = 0;
  queue.outcomes.length = 0;
  queue.acts.length = 0;
  resetBackoff();
}

/** Reset backoff state. Exported for testing. */
export function resetBackoff() {
  backoff = { active: false, delay: 0, retries: 0 };
}

/** Get current backoff state. Exported for testing. */
export function getBackoff() {
  return { ...backoff };
}

/** Compute next backoff delay with jitter. */
function nextBackoffDelay(retryAfterMs) {
  if (retryAfterMs) return retryAfterMs;
  const base = Math.min(BACKOFF_BASE * Math.pow(2, backoff.retries), BACKOFF_MAX);
  const jitter = base * BACKOFF_JITTER * (Math.random() * 2 - 1);
  return Math.round(base + jitter);
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

function enqueue(type, event) {
  if (!config.enabled) return;

  queue[type].push(event);

  // During backoff, don't schedule additional flushes — the backoff timer handles it
  if (backoff.active) return;

  const total = queue.runs.length + queue.groups.length + queue.calls.length
    + queue.links.length + queue.outcomes.length + queue.acts.length;

  if (total >= config.maxBatchSize) {
    flush();
  } else if (!flushTimeout) {
    flushTimeout = setTimeout(flush, config.flushInterval);
  }
}

// ---------------------------------------------------------------------------
// Re-queue helper
// ---------------------------------------------------------------------------

function requeue(batch) {
  queue.runs.unshift(...batch.runs);
  queue.groups.unshift(...batch.groups);
  queue.calls.unshift(...batch.calls);
  queue.links.unshift(...batch.links);
  queue.outcomes.unshift(...batch.outcomes);
  queue.acts.unshift(...batch.acts);
}

// ---------------------------------------------------------------------------
// Flush
// ---------------------------------------------------------------------------

export async function flush() {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  const batch = {
    runs: queue.runs.splice(0),
    groups: queue.groups.splice(0),
    calls: queue.calls.splice(0),
    links: queue.links.splice(0),
    outcomes: queue.outcomes.splice(0),
    acts: queue.acts.splice(0),
  };

  const total = batch.runs.length + batch.groups.length + batch.calls.length
    + batch.links.length + batch.outcomes.length + batch.acts.length;

  if (total === 0) return;

  if (!config.apiKey) {
    if (config.debug) {
      console.log('[warpmetrics] No API key — events discarded.');
    }
    return;
  }

  if (config.debug) {
    console.log(
      `[warpmetrics] Flushing ${total} events`
      + ` (runs=${batch.runs.length} groups=${batch.groups.length}`
      + ` calls=${batch.calls.length} links=${batch.links.length}`
      + ` outcomes=${batch.outcomes.length} acts=${batch.acts.length})`
    );
  }

  const raw = JSON.stringify(batch);
  const body = JSON.stringify({ d: Buffer.from(raw, 'utf-8').toString('base64') });

  if (config.debug) {
    console.log(`[warpmetrics] Payload size: ${(raw.length / 1024).toFixed(1)}KB → ${(body.length / 1024).toFixed(1)}KB (encoded)`);
  }

  try {
    const res = await fetch(`${config.baseUrl}/v1/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'X-SDK-Version': SDK_VERSION,
      },
      body,
    });

    if (res.status === 429) {
      // Parse Retry-After header (seconds) if present
      const retryAfterHeader = res.headers?.get?.('Retry-After');
      const retryAfterMs = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : 0;
      const delay = nextBackoffDelay(retryAfterMs || 0);

      backoff.active = true;
      backoff.retries++;
      backoff.delay = delay;

      if (config.debug) {
        console.warn(`[warpmetrics] Rate limited (429). Backing off ${delay}ms (retry #${backoff.retries})`);
      }

      // Re-queue events
      requeue(batch);

      // Schedule retry after backoff delay
      flushTimeout = setTimeout(flush, delay);
      return;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${body}`);
    }

    // Success — reset backoff state
    if (backoff.active) {
      if (config.debug) {
        console.log(`[warpmetrics] Backoff cleared after ${backoff.retries} retries`);
      }
      resetBackoff();
    }

    if (config.debug) {
      const result = await res.json();
      const d = result.data || result;
      console.log(`[warpmetrics] Flush OK — received=${d.received} processed=${d.processed}`);
    }
  } catch (err) {
    if (config.debug) {
      console.error('[warpmetrics] Flush failed:', err.message);
    }
    requeue(batch);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Log helpers — called by the public API modules
// ---------------------------------------------------------------------------

export function logRun(data) {
  enqueue('runs', {
    id: data.id,
    label: data.label,
    opts: data.opts || null,
    refId: data.refId || null,
    startedAt: data.startedAt || new Date().toISOString(),
  });
}

export function logGroup(data) {
  enqueue('groups', {
    id: data.id,
    label: data.label,
    opts: data.opts || null,
    startedAt: data.startedAt || new Date().toISOString(),
  });
}

export function logCall(data) {
  enqueue('calls', data);
}

export function logLink(data) {
  enqueue('links', {
    parentId: data.parentId,
    childId: data.childId,
    type: data.type,
    timestamp: new Date().toISOString(),
  });
}

export function logOutcome(data) {
  enqueue('outcomes', {
    id: data.id,
    refId: data.refId,
    name: data.name,
    opts: data.opts || null,
    timestamp: new Date().toISOString(),
  });
}

export function logAct(data) {
  enqueue('acts', {
    id: data.id,
    refId: data.refId,
    name: data.name,
    opts: data.opts || null,
    timestamp: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Auto-flush on process exit (Node.js only)
// ---------------------------------------------------------------------------

if (typeof process !== 'undefined' && process.on) {
  process.on('beforeExit', flush);
  process.on('SIGTERM', () => flush().then(() => process.exit(0)));
  process.on('SIGINT', () => flush().then(() => process.exit(0)));
}
