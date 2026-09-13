# Agent Architecture

## Runtime Chain

Active runtime flow:

1. `server/routes/*` (`/api/chat`, `/api/guide`, `/api/character`) — thin adapters
2. `server/agents/harness/` — run identity, events, budgets, error classification
3. `server/agents/orchestrator/graph.ts`
4. `server/agents/supervisor/graph.ts`
5. `server/agents/expert/agent-factory.ts`
6. `server/_core/llm.ts`

## Dependency Direction

Allowed direction:

`routes -> harness -> orchestrator -> supervisor -> expert -> _core`

Support modules are downstream-only dependencies:

- `server/agents/tools/*`
- `server/agents/rag/*`
- `server/agents/spatial/*`
- `server/agents/relations/*`

`legacy` modules are read-only references and must not be imported by active runtime code.

Boundary rules are enforced by `server/agents/structure.test.ts`:

- only `server/agents/harness/**` may import `orchestrator/graph`
- only `server/agents/orchestrator/**` may import `supervisor/graph`
- no active module may import from `legacy/`

## Single Source of Truth

Agent resolution logic is centralized in:

- `server/agents/spatial/agent-resolution.ts`

Do not duplicate:

- characterId -> AgentId mapping
- roomId -> AgentId mapping

Agent display names (user-visible, e.g. `Aries · Core`) live in:

- `shared/src/characters/display-names.ts`

Run event types live in:

- `shared/src/schemas/run.ts`

## Harness Boundary

`server/agents/harness/run.ts` is the only entry point for invoking agents.
New routes, scripts or features call `runAgent(request)`; they must not import
`orchestratorGraph` directly.

- `runAgent` returns `{ runId, threadId, answer, speakingAgent, uiAction, usage, events }`
- `request.onEvent` receives `RunEvent`s live (used by streaming callers)
- `request.budget` is opt-in; the wall-clock limit applies only when set
- failures emit a terminal `run.error` before throwing `RunError`, so stream
  consumers always see an ending
- `RunErrorCode` -> HTTP status mapping lives in `server/routes/errors.ts`

`tool.*` / `text.delta` events are emitted from the expert layer through the
AsyncLocalStorage event sink (`harness/events.ts`), because the tool loop runs
inside a single graph node where `streamEvents()` cannot see it.

## Tooling & RAG

Runtime tool registration is centralized in:

- `server/agents/tools/index.ts`

Expert agent tool-call execution happens in:

- `server/agents/expert/agent-factory.ts`

Loop and collaboration policy:

- max tool loops: `3` (`MAX_TOOL_CALL_LOOPS`)
- serial tool execution within each loop
- tool errors are converted to structured tool messages
- tool access is a per-agent whitelist (`AGENT_TOOL_CONFIGS`); the model cannot
  call a tool outside it
- agent-to-agent consultation is capped at `MAX_CONSULT_DEPTH = 1` and the
  `canConsult` list is enforced in `initializeAgentFactory`, not just in prompts
- caller identity is injected via AsyncLocalStorage, so the model cannot forge
  which agent is asking

## How To Extend

### Add a new Agent

1. Add agent id in `server/agents/tools/agent.tool.ts` type `AgentId`.
2. Add role config in `server/agents/expert/agent-factory.ts` (`AGENT_TOOL_CONFIGS` + prompt description).
3. Add room/character resolution rules in `server/agents/spatial/agent-resolution.ts` if needed.
4. Add tests for routing and agent invocation.

### Add a new Tool

1. Implement tool module under `server/agents/tools` or `server/agents/rag`.
2. Register it in `server/agents/tools/index.ts`.
3. Add tool name to the target agent whitelist in `AGENT_TOOL_CONFIGS`.
4. Add unit tests for success/error paths in tool loop.

A tool that is registered but absent from every `AGENT_TOOL_CONFIGS.tools` list
is unreachable by the model — either wire it into a whitelist or delete it.

### Add a new caller (route, feature, script)

1. Call `runAgent()` from `server/agents/harness/run.ts` with a `caller` id.
2. Pass `onEvent` if the caller streams; read `result.events` otherwise.
3. Map `RunError.code` to the caller's own error surface.
4. Do not import `orchestratorGraph` outside the harness — the structure test
   will fail.
