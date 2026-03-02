// Warpmetrics SDK — Query API
// Read path: query runs and retrieve run details.

import { getConfig } from './transport.js';

function headers() {
  const { apiKey } = getConfig();
  return {
    'Content-Type': 'application/json',
    ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
  };
}

function projectHeader() {
  const { projectId } = getConfig();
  if (projectId) return { 'X-Project-Id': projectId };
  return {};
}

/**
 * Query runs with filters, sorting, and latest outcome resolution.
 *
 * @param {object} params
 * @param {object} [params.filter]  - Filter conditions (opts.*, latest.*, column)
 * @param {object} [params.sort]    - Sort order (field: "asc"|"desc")
 * @param {boolean} [params.latest] - Include latest outcome per run
 * @param {number} [params.limit]   - Max runs to return (default 50, max 200)
 * @param {string} [params.since]   - ISO 8601 timestamp lower bound
 * @returns {Promise<{ runs: object[], total: number, hasMore: boolean }>}
 */
export async function query(params) {
  const { baseUrl } = getConfig();
  const res = await fetch(`${baseUrl}/v1/query`, {
    method: 'POST',
    headers: { ...headers(), ...projectHeader() },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(`warp.query failed: ${err.error?.message || res.status}`);
  }
  const json = await res.json();
  return json.data || json;
}

/**
 * Get a single run by ID with full history.
 *
 * @param {string} runId - The run ID (wm_run_*)
 * @returns {Promise<object>} - Full run data with outcomes, acts, groups, calls, links
 */
export async function get(runId) {
  const { baseUrl } = getConfig();
  const res = await fetch(`${baseUrl}/v1/runs/${runId}?fields=full`, {
    headers: { ...headers(), ...projectHeader() },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(`warp.get failed: ${err.error?.message || res.status}`);
  }
  const json = await res.json();
  return json.data || json;
}

/**
 * Get all pending runs targeted at a specific graph, sorted by priority.
 *
 * @param {string} graphName - The graph name to query inbox for
 * @returns {Promise<{ runs: object[], total: number, hasMore: boolean }>}
 */
export function inbox(graphName) {
  return query({
    filter: { 'opts.to': graphName, 'latest.status': 'pending' },
    sort: { 'opts.priority': 'desc', created_at: 'asc' },
    latest: true,
  });
}

/**
 * Check if an effect has been committed (for idempotency).
 *
 * @param {string} effectKey - The effect key to check
 * @returns {Promise<object|null>} - The existing run or null
 */
export async function exists(effectKey) {
  const result = await query({
    filter: { 'opts.type': `effect.${effectKey}` },
    latest: true,
    limit: 1,
  });
  return result.runs.length > 0 ? result.runs[0] : null;
}

/**
 * Get latest checkpoint for a run (for resume).
 *
 * @param {string} runId - The parent run ID
 * @returns {Promise<object|null>} - The checkpoint outcome or null
 */
export async function checkpoint(runId) {
  const result = await query({
    filter: { 'opts.type': `${runId}.checkpoint` },
    latest: true,
    limit: 1,
  });
  return result.runs.length > 0 ? result.runs[0].latestOutcome : null;
}
