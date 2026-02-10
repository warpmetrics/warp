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
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

function enqueue(type, event) {
  if (!config.enabled) return;

  queue[type].push(event);

  const total = queue.runs.length + queue.groups.length + queue.calls.length
    + queue.links.length + queue.outcomes.length + queue.acts.length;

  if (total >= config.maxBatchSize) {
    flush();
  } else if (!flushTimeout) {
    flushTimeout = setTimeout(flush, config.flushInterval);
  }
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

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${body}`);
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
    // Re-queue so nothing is lost.
    queue.runs.unshift(...batch.runs);
    queue.groups.unshift(...batch.groups);
    queue.calls.unshift(...batch.calls);
    queue.links.unshift(...batch.links);
    queue.outcomes.unshift(...batch.outcomes);
    queue.acts.unshift(...batch.acts);
  }
}

// ---------------------------------------------------------------------------
// Log helpers — called by the public API modules
// ---------------------------------------------------------------------------

export function logRun(data) {
  enqueue('runs', {
    id: data.id,
    label: data.label,
    link: data.link,
    name: data.name,
    refId: data.refId || null,
    timestamp: new Date().toISOString(),
  });
}

export function logGroup(data) {
  enqueue('groups', {
    id: data.id,
    label: data.label,
    name: data.name,
    timestamp: new Date().toISOString(),
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
    reason: data.reason,
    source: data.source,
    tags: data.tags,
    metadata: data.metadata,
    timestamp: new Date().toISOString(),
  });
}

export function logAct(data) {
  enqueue('acts', {
    id: data.id,
    refId: data.refId,
    name: data.name,
    metadata: data.metadata,
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
