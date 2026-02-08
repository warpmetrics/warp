import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { run, flush } from '../index.js';
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
    await flush();
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
