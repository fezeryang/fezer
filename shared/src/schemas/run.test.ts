import { describe, expect, it } from "vitest";
import { isTerminalRunEvent, type RunEvent, type RunOutcome } from "./run";

/**
 * 每种事件一个样本。
 *
 * `Record<RunEvent["type"], RunEvent>` 是刻意的：新增事件类型时 TypeScript
 * 会在这里报缺失键，把「契约变了但没人更新测试」变成编译期错误。
 */
const SAMPLES: Record<RunEvent["type"], RunEvent> = {
  "run.started": {
    type: "run.started",
    runId: "run_1",
    threadId: "thread_1",
    at: 1,
  },
  "step.started": {
    type: "step.started",
    stepName: "supervisor.classifyIntent",
    at: 2,
  },
  "step.finished": {
    type: "step.finished",
    stepName: "supervisor.classifyIntent",
    at: 3,
  },
  "agent.start": {
    type: "agent.start",
    agentId: "builder",
    displayName: "Gemini · Builder",
    at: 4,
  },
  "agent.done": { type: "agent.done", agentId: "builder", at: 5 },
  "tool.call": {
    type: "tool.call",
    toolName: "get_profile",
    args: { includeDetails: false },
    at: 6,
  },
  "tool.result": {
    type: "tool.result",
    toolName: "get_profile",
    ok: true,
    truncated: false,
    bytes: 812,
    at: 7,
  },
  "text.delta": {
    type: "text.delta",
    messageId: "msg_1",
    delta: "你好",
    at: 8,
  },
  "run.finished": {
    type: "run.finished",
    runId: "run_1",
    outcome: { type: "success" },
    usage: {
      promptTokens: 1200,
      completionTokens: 180,
      totalTokens: 1380,
      toolCalls: 2,
      providerFallbacks: 0,
      wallClockMs: 2400,
    },
    answer: "完整回答",
    uiAction: { panel: "character", highlightCharacterId: "builder" },
    at: 9,
  },
  "run.error": {
    type: "run.error",
    runId: "run_1",
    code: "provider_unavailable",
    message: "AI 服务暂时不可用",
    at: 10,
  },
};

const ALL_TYPES = Object.keys(SAMPLES) as RunEvent["type"][];

describe("RunEvent contract", () => {
  it("每种事件类型都有样本，且可无损 JSON 往返", () => {
    expect(ALL_TYPES).toHaveLength(10);

    for (const type of ALL_TYPES) {
      const event = SAMPLES[type];
      expect(event.type).toBe(type);
      expect(JSON.parse(JSON.stringify(event))).toEqual(event);
    }
  });

  it("所有事件的 at 都是有限数字，而不是 Date", () => {
    for (const type of ALL_TYPES) {
      const { at } = SAMPLES[type] as { at: unknown };
      expect(typeof at).toBe("number");
      expect(Number.isFinite(at as number)).toBe(true);
    }
  });

  it("只有 run.finished / run.error 是终止事件", () => {
    for (const type of ALL_TYPES) {
      const expected = type === "run.finished" || type === "run.error";
      expect(isTerminalRunEvent(SAMPLES[type])).toBe(expected);
    }
  });

  it("run.finished 承载每种结束原因，且终止事件自带 runId", () => {
    const finished = SAMPLES["run.finished"];
    if (finished.type !== "run.finished") {
      throw new Error("fixture 类型不匹配");
    }

    const outcomes: RunOutcome[] = [
      { type: "success" },
      { type: "budget_exhausted", limit: "turns" },
      { type: "budget_exhausted", limit: "tokens" },
      { type: "budget_exhausted", limit: "wall_clock" },
      { type: "cancelled" },
      { type: "interrupt", reason: "tool_approval" },
    ];

    for (const outcome of outcomes) {
      const event: RunEvent = { ...finished, outcome };
      const roundTripped = JSON.parse(JSON.stringify(event));
      expect(roundTripped.outcome).toEqual(outcome);
      expect(roundTripped.runId).toBe("run_1");
    }
  });
});
