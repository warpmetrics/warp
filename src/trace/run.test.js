import { describe, it, expect } from 'vitest';
import { run, flush } from '../index.js';
import { runRegistry } from '../core/registry.js';
import { setupBeforeEach, parseFlushedBody } from '../../test/setup.js';

setupBeforeEach();

describe('run()', () => {
  it('returns a frozen object with id and _type', () => {
    const r = run('code-review');
    expect(r.id).toMatch(/^wm_run_/);
    expect(r._type).toBe('run');
    expect(Object.isFrozen(r)).toBe(true);
  });

  it('stores data in runRegistry', () => {
    const r = run('code-review', { name: 'PR #42', link: 'https://github.com/pr/42' });
    const data = runRegistry.get(r.id);
    expect(data.label).toBe('code-review');
    expect(data.name).toBe('PR #42');
    expect(data.link).toBe('https://github.com/pr/42');
    expect(data.groups).toEqual([]);
    expect(data.calls).toEqual([]);
  });

  it('enqueues a run event for transport', async () => {
    run('test-label');
    await flush();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const body = parseFlushedBody(0);
    expect(body.runs).toHaveLength(1);
    expect(body.runs[0].label).toBe('test-label');
  });
});
