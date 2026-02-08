# warp

Measure your agents, not your LLM calls.

Warp is a lightweight SDK that wraps your existing OpenAI or Anthropic client and gives you full observability over your AI agent's execution — runs, groups, costs, and outcomes — with zero config changes to your LLM calls.

## Install

```bash
npm install @warpmetrics/warp
```

## Quick start

```js
import OpenAI from 'openai';
import { warp, run, group, add, outcome } from '@warpmetrics/warp';

const openai = warp(new OpenAI(), { apiKey: 'wm_...' });

const r = run('code-review', { name: 'Review PR #42' });
const planning = group('planning');

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Review this PR...' }],
});

add(planning, response);
add(r, planning);
outcome(r, 'completed', { reason: 'Approved' });
```

Every LLM call is automatically tracked. You structure the execution with `run` and `group`, then record the result with `outcome`.

## API

### `warp(client, options?)`

Wrap an OpenAI or Anthropic client. Every call to `.chat.completions.create()` or `.messages.create()` is automatically intercepted and tracked.

```js
const openai = warp(new OpenAI(), { apiKey: 'wm_...' });
const anthropic = warp(new Anthropic(), { apiKey: 'wm_...' });
```

Options are only needed on the first call. After that, config is shared across all wrapped clients.

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | `WARPMETRICS_API_KEY` env var | Your Warpmetrics API key |
| `baseUrl` | `string` | `https://api.warpmetrics.com` | API endpoint |
| `enabled` | `boolean` | `true` | Disable tracking entirely |
| `debug` | `boolean` | `false` | Log events to console |
| `flushInterval` | `number` | `1000` | Auto-flush interval in ms |
| `maxBatchSize` | `number` | `100` | Max events per batch |

### `run(label, options?)`

Create a run — the top-level unit that tracks one agent execution.

```js
const r = run('code-review', { name: 'PR #42', link: 'https://github.com/org/repo/pull/42' });
```

### `group(label, options?)`

Create a group — a logical phase or step inside a run.

```js
const planning = group('planning', { name: 'Planning phase' });
const coding = group('coding');
```

### `add(target, ...items)`

Link groups or LLM responses to a run or group.

```js
add(planning, response1, response2);  // LLM responses to a group
add(r, planning, coding);             // groups to a run
add(planning, subGroup);              // groups can nest
```

### `outcome(target, name, options?)`

Record an outcome on any tracked target.

```js
outcome(r, 'completed', {
  reason: 'All checks passed',
  source: 'ci',
  tags: ['approved'],
  metadata: { reviewer: 'alice' },
});
```

### `ref(target)`

Resolve any target (run, group, or LLM response) to its string ID. Useful for passing IDs to your frontend or storing them.

```js
ref(r)         // 'wm_run_01jkx3ndek0gh4r5tmqp9a3bcv'
ref(response)  // 'wm_call_01jkx3ndef8mn2q7kpvhc4e9ws'
ref('wm_run_01jkx3ndek0gh4r5tmqp9a3bcv')  // pass-through
```

### `flush()`

Manually flush pending events. Events are auto-flushed on an interval and on process exit, but you can force it.

```js
await flush();
```

## Supported providers

- **OpenAI** — `client.chat.completions.create()` and `client.responses.create()`
- **Anthropic** — `client.messages.create()`

Need another provider? [Open an issue](https://github.com/warpmetrics/warp/issues).

## Environment variables

| Variable | Description |
|---|---|
| `WARPMETRICS_API_KEY` | API key (fallback if not passed to `warp()`) |
| `WARPMETRICS_API_URL` | Custom API endpoint |
| `WARPMETRICS_DEBUG` | Set to `"true"` to enable debug logging |

## License

MIT
