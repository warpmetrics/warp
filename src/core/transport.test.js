import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';
import { run, flush } from '../index.js';
import { getBackoff, resetBackoff } from './transport.js';
import { setupBeforeEach, parseFlushedBody } from '../../test/setup.js';

const { version } = createRequire(import.meta.url)('../../package.json');

setupBeforeEach();

describe('transport', () => {
  it('sends batched events with correct auth header', async () => {
    run('test');
    await flush();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.warpmetrics.com/v1/events');
    expect(opts.headers['Authorization']).toBe('Bearer wm_test_123');
    expect(opts.headers['X-SDK-Version']).toBe(version);
  });

  it('re-queues events on failure and succeeds on retry', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    run('test');
    await expect(flush()).rejects.toThrow('Network error');
    expect(global.fetch).toHaveBeenCalledTimes(1);

    global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    await flush();
    expect(global.fetch).toHaveBeenCalledTimes(2);

    const body = parseFlushedBody(1);
    expect(body.runs).toHaveLength(1);
  });

  it('skips flush when queue is empty', async () => {
    await flush();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('429 backoff', () => {
  it('re-queues events on 429 without throwing', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: { get: () => null },
    });

    run('test-429');
    await flush();

    // Should not throw — 429 is handled gracefully
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Backoff should be active
    const bo = getBackoff();
    expect(bo.active).toBe(true);
    expect(bo.retries).toBe(1);
    expect(bo.delay).toBeGreaterThan(0);
  });

  it('respects Retry-After header', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: { get: (h) => (h === 'Retry-After' ? '30' : null) },
    });

    run('test-retry-after');
    await flush();

    const bo = getBackoff();
    expect(bo.active).toBe(true);
    expect(bo.delay).toBe(30000); // 30 seconds in ms
  });

  it('escalates backoff delay on consecutive 429s', async () => {
    // First 429
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: { get: () => null },
    });

    run('test-escalation');
    await flush();

    const bo1 = getBackoff();
    expect(bo1.retries).toBe(1);
    const delay1 = bo1.delay;

    // Second 429 (simulate the retry that would be scheduled)
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: { get: () => null },
    });

    await flush();

    const bo2 = getBackoff();
    expect(bo2.retries).toBe(2);
    // Second delay should be roughly double the first (within jitter range)
    expect(bo2.delay).toBeGreaterThan(delay1 * 0.5);
  });

  it('resets backoff after successful flush', async () => {
    // First: 429
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: { get: () => null },
    });

    run('test-reset');
    await flush();
    expect(getBackoff().active).toBe(true);

    // Second: success
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ received: 1, processed: 1 }),
    });

    await flush();
    expect(getBackoff().active).toBe(false);
    expect(getBackoff().retries).toBe(0);
  });

  it('caps backoff delay at 60 seconds', async () => {
    // Simulate many consecutive 429s to hit the cap
    for (let i = 0; i < 10; i++) {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: () => null },
      });

      if (i === 0) run('test-cap');
      await flush();
    }

    const bo = getBackoff();
    // With 30% jitter on 60s max, delay should be between 42s and 78s
    // But the cap is on the base (60s), so with jitter it's 60000 ± 18000
    expect(bo.delay).toBeLessThanOrEqual(78000);
    expect(bo.delay).toBeGreaterThanOrEqual(42000);
  });

  it('preserves events across 429 re-queue and eventual success', async () => {
    // 429 first
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: { get: () => null },
    });

    run('preserved-run');
    await flush();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Success on retry
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ received: 1, processed: 1 }),
    });

    await flush();
    expect(global.fetch).toHaveBeenCalledTimes(2);

    // Verify the same event came through
    const body = parseFlushedBody(1);
    expect(body.runs).toHaveLength(1);
    expect(body.runs[0].label).toBe('preserved-run');
  });

  it('still throws on non-429 HTTP errors', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    });

    run('test-500');
    await expect(flush()).rejects.toThrow('HTTP 500');
  });
});
