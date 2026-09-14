/**
 * E2E mock：harness 入口处的 agent 替身
 *
 * Playwright 以 `E2E_MOCK_AGENT_API=true` 启动服务端（见 playwright.config.ts），
 * 此时 runAgent 不走编排图，直接返回固定结果 —— 于是 JSON 路由、未来的 SSE
 * 路由和任何其他调用方都自动获得 mock，无需各自记忆这件事。
 *
 * 事件流同样是完整形状（run.started → agent.start → run.finished），
 * 流式消费方在 e2e 下也能拿到合法的终止事件。
 */

import type { FezerType } from "@fezer/shared/schemas/character";
import type { RunEvent } from "@fezer/shared/schemas/run";
import type { AgentId } from "../tools/agent.tool";
import type { RunRequest, RunResult } from "./run";

const FEZER_TYPES = new Set<FezerType>([
  "core",
  "builder",
  "ai",
  "writer",
  "reader",
  "visual",
  "wanderer",
]);

export function shouldUseE2eAgentMock(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.E2E_MOCK_AGENT_API === "true"
  );
}

export function toE2eFezerType(value: string | undefined): FezerType {
  return value && FEZER_TYPES.has(value as FezerType)
    ? (value as FezerType)
    : "core";
}

export function buildE2eMockRunResult(
  request: RunRequest,
  runId: string
): RunResult {
  const speakingAgent = toE2eFezerType(request.characterId) as AgentId;
  const answer = "E2E mock agent response";

  const events: RunEvent[] = [
    {
      type: "run.started",
      runId,
      threadId: request.threadId ?? runId,
      at: Date.now(),
    },
    {
      type: "agent.start",
      agentId: speakingAgent,
      displayName: `E2E Mock · ${speakingAgent}`,
      at: Date.now(),
    },
    {
      type: "agent.done",
      agentId: speakingAgent,
      at: Date.now(),
    },
    {
      type: "run.finished",
      runId,
      outcome: { type: "success" },
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        toolCalls: 0,
        providerFallbacks: 0,
        wallClockMs: 0,
      },
      answer,
      uiAction: {
        panel: "character",
        highlightCharacterId: speakingAgent,
        suggestedQuestions: ["Tell me more"],
      },
      at: Date.now(),
    },
  ];

  return {
    runId,
    threadId: request.threadId ?? runId,
    answer,
    speakingAgent,
    uiAction: {
      panel: "character",
      highlightCharacterId: speakingAgent,
      suggestedQuestions: ["Tell me more"],
    },
    usage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      toolCalls: 0,
      providerFallbacks: 0,
      wallClockMs: 0,
    },
    events,
  };
}
