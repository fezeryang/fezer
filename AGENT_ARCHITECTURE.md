# Agent Architecture

## Runtime Chain

Active runtime flow:

1. `server/routes/*` (`/api/chat`, `/api/guide`, `/api/character`)
2. `server/agents/orchestrator/graph.ts`
3. `server/agents/supervisor/graph.ts`
4. `server/agents/expert/agent-factory.ts`
5. `server/_core/llm.ts`

## Dependency Direction

Allowed direction:

`routes -> orchestrator -> supervisor -> expert -> _core`

Support modules are downstream-only dependencies:

- `server/agents/tools/*`
- `server/agents/rag/*`
- `server/agents/spatial/*`
- `server/agents/relations/*`

`legacy` modules are read-only references and must not be imported by active runtime code.

## Single Source of Truth

Agent resolution logic is centralized in:

- `server/agents/spatial/agent-resolution.ts`

Do not duplicate:

- characterId -> AgentId mapping
- roomId -> AgentId mapping

## Tooling & RAG

Runtime tool registration is centralized in:

- `server/agents/tools/index.ts`

Expert agent tool-call execution happens in:

- `server/agents/expert/agent-factory.ts`

Default loop policy:

- max tool loops: `4`
- serial tool execution within each loop
- tool errors are converted to structured tool messages

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

### Add a new Route

1. Add Express route handler under `server/routes`.
2. Ensure route sets trace context fields (`route`, `interactionType`, etc.).
3. Reuse orchestrator/supervisor flow unless a dedicated flow is required.
4. Add route integration tests.
