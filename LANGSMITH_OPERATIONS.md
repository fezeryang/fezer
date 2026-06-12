# LangSmith Observability Runbook

## 1) Preconditions

Set the following environment variables on the server process:

```bash
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=lsv2_...
LANGSMITH_PROJECT=fezer-agent
# optional:
# LANGSMITH_ENDPOINT=https://api.smith.langchain.com
# LANGSMITH_WORKSPACE_ID=<workspace_id>
```

LLM routing defaults:

```bash
AI_PRIMARY_PROVIDER=deepseek
AI_PRIMARY_MODEL=deepseek-chat
AI_FALLBACK_PROVIDER=deepseek
AI_FALLBACK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
AI_MAX_TOKENS=2048
AI_REQUEST_TIMEOUT_MS=60000
```

## 2) What You Should See In Trace Tree

Expected hierarchy in LangSmith:

1. `api.chat` / `api.guide` / `api.character` (root)
2. `orchestrator.*`
3. `supervisor.*`
4. `expert.invokeAgent`
5. `invokeLLM` + `llm.chat.completions`
6. `tool.*` (when model triggers tool calls)

Core tags/metadata:

- Tags: `route:*`, `interaction:*`, `agent:*`, `room:*`, `character:*`, `env:*`, `provider:*`, `model:*`, `source:*`, `tool:*`
- Prompt tags: `prompt:*`, `prompt_version:*`, `prompt_tag:*`
- Metadata: `route`, `interactionType`, `agentId`, `roomId`, `characterId`, `env`, `promptKey`, `promptVersion`, `promptTag`, `toolName`, `ls_provider`, `ls_model_name`, `ls_invocation_params`, `llm_source`, `llm_fallback_attempted`

Current prompt keys:

- `supervisor/intent-classifier` (version: `fezer.intent-classifier.v2.stage1`)
- `character/<agentId>` (version: `fezer.character-prompt.v2.stage1`)

## 3) Dashboard Template (LangSmith UI)

Create a project dashboard with:

1. Total tokens
2. Total cost
3. P95 latency
4. Error rate
5. Cost by route (`route`)
6. Cost by agent (`agentId`)

## 4) Alerts

Configure rules in LangSmith project:

1. Token spike alert: minute-level token usage threshold.
2. Cost alert: daily/rolling spend threshold.
3. Error alert: 429/5xx rate threshold.

## 5) Triage Priority

1. Check root route span status (`api.*`).
2. Inspect `llm.chat.completions` provider/source (`primary` vs `fallback`).
3. Inspect `tool.*` spans for tool name, input shape and execution errors.
4. If fallback rate rises, verify DeepSeek key/quota/network.
5. If 4xx rises, verify request shape and model compatibility.
6. Use tags (`route`, `agent`, `interaction`, `tool`) to isolate noisy paths.

## 6) Stage-2 Feedback Loop (Dataset + Re-eval)

1. Collect user feedback on intent-classifier runs:
   - Positive feedback (`score=1`)
   - Correction feedback (`correction` JSON with corrected category/agent)
2. Convert feedback to dataset datapoints via:
   - `server/_core/observability/langsmith-feedback.ts`
   - `buildIntentFeedbackDatapoint(record)`
3. Write datapoints to LangSmith dataset (recommended name: `fezer-intent-feedback`).
4. Run prompt experiments comparing current prompt version/tag vs candidate.
5. Promote only if candidate improves routing accuracy and does not regress fallback stability.
