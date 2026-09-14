import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../orchestrator/graph", () => ({
  orchestratorGraph: { invoke: vi.fn() },
}));

import type { RunEvent } from "@fezer/shared/schemas/run";
import { isTerminalRunEvent } from "@fezer/shared/schemas/run";
import { orchestratorGraph } from "../orchestrator/graph";
import { LLMProviderConfigurationError } from "../../_core/llm";
import { RunError } from "./errors";
import { resolveWallClockLimit, runAgent } from "./run";

const invoke = vi.mocked(orchestratorGraph.invoke);

function orchestratorResult(overrides: Record<string, unknown> = {}) {
  return {
    answer: "这是回答",
    currentPrimaryAgent: "builder",
    uiAction: { panel: "character", highlightCharacterId: "builder" },
    ...overrides,
  };
}

function captureEvents(): {
  events: RunEvent[];
  onEvent: (e: RunEvent) => void;
} {
  const events: RunEvent[] = [];
  return { events, onEvent: event => events.push(event) };
}

describe("runAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invoke.mockResolvedValue(orchestratorResult() as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("墙钟预算默认不设限，只有调用方显式开启才生效", () => {
    expect(resolveWallClockLimit(undefined)).toBeUndefined();
    expect(resolveWallClockLimit({})).toBeUndefined();
    expect(resolveWallClockLimit({ maxWallClockMs: 1500 })).toBe(1500);
  });

  it("未设预算时，慢一点的 run 仍正常完成", async () => {
    invoke.mockImplementation(
      () =>
        new Promise(resolve =>
          setTimeout(() => resolve(orchestratorResult()), 30)
        ) as never
    );

    const result = await runAgent({ input: "你好" });

    expect(result.answer).toBe("这是回答");
    expect(result.events.at(-1)?.type).toBe("run.finished");
  });

  it("发出 started → finished，runId 稳定，threadId 缺省等于 runId", async () => {
    const result = await runAgent({ input: "你好" });

    expect(result.events.map(event => event.type)).toEqual([
      "run.started",
      "run.finished",
    ]);
    expect(result.events[0]).toMatchObject({
      type: "run.started",
      runId: result.runId,
      threadId: result.runId,
    });
    expect(result.answer).toBe("这是回答");
    expect(result.speakingAgent).toBe("builder");
    expect(result.usage.wallClockMs).toBeGreaterThanOrEqual(0);
    expect(isTerminalRunEvent(result.events.at(-1)!)).toBe(true);
  });

  it("时间戳单调不减，且事件对象可 JSON 往返", async () => {
    const result = await runAgent({ input: "你好" });
    const stamps = result.events.map(event => event.at);

    for (const stamp of stamps) {
      expect(typeof stamp).toBe("number");
    }
    expect([...stamps].sort((a, b) => a - b)).toEqual(stamps);
    expect(JSON.parse(JSON.stringify(result.events))).toEqual(result.events);
  });

  it("透传 threadId 与编排参数", async () => {
    const result = await runAgent({
      input: "怎么逛",
      threadId: "thread-1",
      roomId: "ai",
      interactionType: "guide",
      grounding: "public_profile",
    });

    expect(result.threadId).toBe("thread-1");
    expect(invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        userInput: "怎么逛",
        roomId: "ai",
        interactionType: "guide",
        grounding: "public_profile",
        messages: [],
        conversationHistory: [],
      })
    );
  });

  it("provider 配置缺失时发 run.error(provider_unavailable) 并抛 RunError", async () => {
    invoke.mockRejectedValue(
      new LLMProviderConfigurationError("deepseek", "DEEPSEEK_API_KEY")
    );
    const { events, onEvent } = captureEvents();

    await expect(runAgent({ input: "你好", onEvent })).rejects.toMatchObject({
      name: "RunError",
      code: "provider_unavailable",
    });

    expect(events.map(event => event.type)).toEqual([
      "run.started",
      "run.error",
    ]);
    expect(events.at(-1)).toMatchObject({ code: "provider_unavailable" });
    expect(events.some(event => event.type === "run.finished")).toBe(false);
  });

  it("墙钟预算耗尽时以 budget_exhausted 结束", async () => {
    invoke.mockImplementation(() => new Promise(() => {}) as never);
    const { events, onEvent } = captureEvents();

    await expect(
      runAgent({ input: "你好", budget: { maxWallClockMs: 10 }, onEvent })
    ).rejects.toMatchObject({ code: "budget_exhausted" });

    expect(events.at(-1)).toMatchObject({
      type: "run.error",
      code: "budget_exhausted",
    });
  });

  it("已取消的 signal 直接以 cancelled 结束，不调用编排", async () => {
    const controller = new AbortController();
    controller.abort();
    const { events, onEvent } = captureEvents();

    await expect(
      runAgent({ input: "你好", signal: controller.signal, onEvent })
    ).rejects.toMatchObject({ code: "cancelled" });

    expect(events.at(-1)).toMatchObject({
      type: "run.error",
      code: "cancelled",
    });
  });

  it("运行中途取消：以 cancelled 结束", async () => {
    invoke.mockImplementation(() => new Promise(() => {}) as never);
    const controller = new AbortController();
    const { events, onEvent } = captureEvents();

    const timer = setTimeout(() => controller.abort(), 10);
    try {
      await expect(
        runAgent({ input: "你好", signal: controller.signal, onEvent })
      ).rejects.toMatchObject({ code: "cancelled" });
    } finally {
      clearTimeout(timer);
    }

    expect(events.at(-1)).toMatchObject({
      type: "run.error",
      code: "cancelled",
    });
  });

  it("未知异常归类为 internal，并保留可读信息", async () => {
    invoke.mockRejectedValue(new Error("数据库连接失败"));
    const { events, onEvent } = captureEvents();

    const thrown = await runAgent({ input: "你好", onEvent }).catch(
      (error: unknown) => error
    );

    expect(thrown).toBeInstanceOf(RunError);
    expect((thrown as RunError).code).toBe("internal");
    expect((thrown as RunError).message).toBe("数据库连接失败");
    expect(events.at(-1)).toMatchObject({
      type: "run.error",
      code: "internal",
    });
  });

  it("onEvent 收到的事件与 result.events 一致", async () => {
    const { events, onEvent } = captureEvents();
    const result = await runAgent({ input: "你好", onEvent });

    expect(events).toEqual(result.events);
    expect(events).toHaveLength(2);
  });
});
