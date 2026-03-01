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
import { warp, run, group, call, trace, outcome } from '@warpmetrics/warp';

const openai = warp(new OpenAI(), { apiKey: 'wm_...' });

const r = run('Code Review', { name: 'Review PR #42' });
const planning = group(r, 'Planning');

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Review this PR...' }],
});

call(planning, response);
outcome(r, 'Completed', { reason: 'Approved' });
```

Every LLM call is captured by `warp()` but only sent to the API when you explicitly `call()` it into a run or group. Unclaimed responses are never transmitted.

## API

### `warp(client, opts?)`

Wrap an OpenAI or Anthropic client. Every call to `.chat.completions.create()` or `.messages.create()` is automatically intercepted and buffered.

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

### `run(label, opts?)`

Create a run — the top-level unit that tracks one agent execution.

```js
const r = run('Code Review', { name: 'PR #42', link: 'https://github.com/org/repo/pull/42' });
```

### `run(act, label, opts?)`

Create a follow-up run from an act (the result of acting on an outcome).

```js
const r2 = run(a, 'Code Review', { name: 'Retry' });
```

### `group(target, label, opts?)`

Create a group — a logical phase or step inside a run or group.

```js
const planning = group(r, 'Planning', { name: 'Planning Phase' });
const coding = group(r, 'Coding');
const subStep = group(planning, 'Sub Step');  // groups can nest
```

### `call(target, response, opts?)`

Track an LLM call by linking a buffered response to a run or group.

```js
const response = await openai.chat.completions.create({ model: 'gpt-4o', messages });
call(r, response);
call(g, response, { label: 'extract' });  // with opts
```

### `trace(target, data)`

Manually record an LLM call for providers not wrapped by `warp()`.

```js
trace(r, {
  provider: 'google',
  model: 'gemini-2.0-flash',
  messages: [{ role: 'user', content: 'Hello' }],
  response: 'Hi there!',
  tokens: { prompt: 10, completion: 5 },
  latency: 230,
  cost: 0.0001,
});
```

| Field | Type | Required | Description |
|---|---|---|---|
| `provider` | `string` | Yes | Provider name (e.g. `"google"`, `"cohere"`) |
| `model` | `string` | Yes | Model identifier |
| `messages` | `any` | No | Request messages/input |
| `response` | `string` | No | Response text |
| `tools` | `string[]` | No | Tool names available |
| `toolCalls` | `{ id, name, arguments }[]` | No | Tool calls made |
| `tokens` | `{ prompt?, completion?, total? }` | No | Token usage |
| `latency` | `number` | No | Duration in milliseconds |
| `timestamp` | `string` | No | ISO 8601 timestamp (auto-generated if omitted) |
| `status` | `string` | No | `"success"` (default) or `"error"` |
| `error` | `string` | No | Error message |
| `cost` | `number` | No | Cost in USD |
| `opts` | `Record<string, any>` | No | Custom metadata |

### `outcome(target, name, opts?)`

Record an outcome on any tracked target.

```js
outcome(r, 'Completed', { reason: 'All checks passed', source: 'ci' });
```

### `act(target, name, opts?)`

Record an action taken on an outcome. Returns an act handle that can be passed to `run()` for follow-ups.

```js
const oc = outcome(r, 'Failed', { reason: 'Tests failed' });
const a = act(oc, 'Retry', { strategy: 'fix-and-rerun' });
const r2 = run(a, 'Code Review');
```

### `ref(target)`

Resolve any target (run, group, outcome, act, or LLM response) to its string ID. Also accepts raw ID strings (e.g. `"wm_run_..."` loaded from a database) and registers them locally.

```js
ref(r)         // 'wm_run_01jkx3ndek0gh4r5tmqp9a3bcv'
ref(response)  // 'wm_call_01jkx3ndef8mn2q7kpvhc4e9ws'
ref('wm_run_01jkx3ndek0gh4r5tmqp9a3bcv')  // adopts and returns the ID
```

### `flush()`

Manually flush pending events. Events are auto-flushed on an interval and on process exit, but you can force it.

```js
await flush();
```

## Entity Model

Six entity types form an execution DAG. Every entity is created client-side, batched, and sent atomically to `POST /v1/events`.

### Entities

| Entity | Prefix | Purpose |
|--------|--------|---------|
| **Run** | `wm_run_` | Top-level execution unit. Has a label, opts, and startedAt. |
| **Group** | `wm_grp_` | Logical phase/step inside a run or group. Nestable. |
| **Call** | `wm_call_` | Single LLM API call with tokens, cost, duration. Always a leaf node. Created by `call()` (intercepted) or `trace()` (manual) — same entity either way. |
| **Link** | — | Parent→child edge. Connects runs/groups to their children. No ID of its own. |
| **Outcome** | `wm_oc_` | Named result recorded on a run, group, or call. |
| **Act** | `wm_act_` | Action taken on an outcome. Can trigger follow-up runs. |

IDs are monotonic ULIDs: `wm_{prefix}_{ulid}`.

### Hierarchy (Links)

```
Run ──→ Group ──→ Group  (nestable)
 │        │
 │        └──→ Call
 └──→ Call
```

- Links are directional (parent → child)
- A child has exactly one parent
- Calls are always leaf nodes
- Groups can nest arbitrarily

### Outcome → Act → Run chain

The mechanism for multi-step workflows:

```
Run / Group / Call
     │
     └─ outcome("Needs Review")     → Outcome  (refId = entity)
              │
              └─ act("Review")      → Act      (refId = outcome)
                       │
                       └─ run(act)  → Run      (refId = act)
```

- An outcome references exactly one entity (run, group, or call) via `refId`
- An act references exactly one outcome via `refId`
- A follow-up run references exactly one act via `refId`
- Multiple outcomes can target the same entity
- Multiple acts can target the same outcome
- An act with a follow-up run is "resolved"; without one it's "pending"

### Runner pattern

A graph runner processes the entity model by declaring a workflow graph and walking it:

```
define graph:
  ActName → {
    executor: string | null     # null = phase group (auto-transition)
    results: {
      resultType → [{ outcome, on?, next? }]
    }
  }

define states:
  OutcomeName → BoardColumn

algorithm processRun(run):
  act = findPendingAct(run)
  while act:
    node = graph[act.name]

    if node.executor == null:                    # phase group
      group = createGroup(run, node.label)
      result = { type: "created" }
    else:                                        # work act
      result = execute(node.executor, run, act)

    edges = node.results[result.type]            # [{outcome, on?, next?}]
    for edge in edges:
      container = resolveContainer(edge.on, run) # run or phase group
      oc = recordOutcome(container, edge.outcome)
      if edge.next:
        act = emitAct(oc, edge.next, result.nextActOpts)

    syncBoard(run, states[lastOutcome])

    if not edge.next:
      break                                      # terminal
```

Key concepts:

- **Phase groups** (`executor: null`): create a group, auto-resolve with `created`, and immediately transition to the next act. No external work.
- **Work acts** (`executor: string`): call an executor, get a typed result, map it to graph edges.
- **`findPendingAct`**: walk the run's outcomes and group outcomes (newest first) to find the last act with no follow-up run.
- **`resolveContainer`**: outcomes target either the top-level run (for board tracking) or a phase group (for scoped tracking). A single result can produce outcomes on both.
- **Board sync**: map the last outcome name to a board column via the `states` map.

### Event batch format

All entities are sent atomically in a single `POST /v1/events` payload:

```json
{
  "runs":     [{ "id", "label", "opts", "refId", "startedAt" }],
  "groups":   [{ "id", "label", "opts", "startedAt" }],
  "calls":    [{ "id", "provider", "model", "messages", "response", "tokens", "duration", ... }],
  "links":    [{ "parentId", "childId", "type", "timestamp" }],
  "outcomes": [{ "id", "refId", "name", "opts", "timestamp" }],
  "acts":     [{ "id", "refId", "name", "opts", "timestamp" }]
}
```

The body is base64-encoded: `{ "d": "<base64>" }`.

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

## Development

### Running tests

```bash
npm install
npm test              # unit tests only (integration tests auto-skip)
npm run test:coverage # with coverage report
npm run test:watch    # watch mode
```

### Integration tests

Integration tests make real API calls to OpenAI and Anthropic. They are **automatically skipped** unless the corresponding API keys are set.

To run them:

```bash
cp .env.example .env
# Edit .env with your API keys
npm run test:integration
```

> **Note:** Integration tests make a small number of API calls with `max_tokens: 5`, so costs are minimal (fractions of a cent per run).

## License

MIT
