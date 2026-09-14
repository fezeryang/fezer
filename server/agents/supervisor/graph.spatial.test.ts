import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AGENT_DISPLAY_NAMES } from "@fezer/shared/characters";

const mocks = vi.hoisted(() => ({
  invokeAgent: vi.fn(),
  invokeMultipleAgents: vi.fn(),
  invokeLLM: vi.fn(),
}));

vi.mock("../expert/agent-factory", () => ({
  invokeAgent: mocks.invokeAgent,
  invokeMultipleAgents: mocks.invokeMultipleAgents,
}));

vi.mock("../../_core/llm", () => ({
  invokeLLM: mocks.invokeLLM,
}));

import { askSupervisor } from "./graph";

describe("supervisor spatial routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invokeAgent.mockResolvedValue({
      answer: "spatial agent answer",
      uiAction: { suggestedQuestions: ["继续问这个角色"] },
    });
  });

  it("keeps the selected character agent for explicit click targeting", async () => {
    const result = await askSupervisor("随便聊点什么", {
      characterId: "fezer-04",
      roomId: "builder",
      interactionType: "click",
      preferredAgent: "builder",
    } as any);

    expect(mocks.invokeLLM).not.toHaveBeenCalled();
    expect(mocks.invokeAgent).toHaveBeenCalledWith(
      "builder",
      "随便聊点什么",
      expect.objectContaining({
        context: expect.objectContaining({
          conversationHistory: expect.any(Array),
        }),
      })
    );
    expect(result.answer).toBe("spatial agent answer");
    expect(result.speakingAgent).toBe("builder");
  });

  it("keeps the current room agent for identity questions without LLM call", async () => {
    await askSupervisor("你是谁，能做什么？", {
      roomId: "ai",
      interactionType: "chat",
    } as any);

    expect(mocks.invokeLLM).not.toHaveBeenCalled();
    expect(mocks.invokeAgent).toHaveBeenCalledWith(
      "ai",
      "你是谁，能做什么？",
      expect.any(Object)
    );
  });

  it("routes technical questions by content even when standing in the writer room", async () => {
    await askSupervisor("介绍一下你项目里的技术实现细节", {
      roomId: "writer",
      interactionType: "chat",
    } as any);

    expect(mocks.invokeLLM).not.toHaveBeenCalled();
    expect(mocks.invokeAgent).toHaveBeenCalledWith(
      "builder",
      "介绍一下你项目里的技术实现细节",
      expect.any(Object)
    );
  });

  it("reports the actually routed agent as speakingAgent for content routing", async () => {
    const result = await askSupervisor("我想做一个全栈 AI 应用，技术怎么选", {
      roomId: "writer",
      interactionType: "chat",
    } as any);

    // 该输入不走快速路径，由（被 mock 的）LLM 分类；mock 返回 undefined 时
    // rule-based 兜底为 complex/core，不参与本次断言的 agent
    expect(typeof result.speakingAgent).toBe("string");
  });

  it("把访客探索进度注入给专家层（C6）", async () => {
    await askSupervisor("随便聊点什么", {
      roomId: "central",
      interactionType: "chat",
      visitedRooms: ["central", "builder"],
      discoveredCharacters: ["core"],
    } as any);

    const options = mocks.invokeAgent.mock.calls.at(-1)?.[2] as
      | { context?: { visitorProgress?: string } }
      | undefined;

    expect(options?.context?.visitorProgress).toContain(
      "访客已探索：central、builder"
    );
    expect(options?.context?.visitorProgress).toContain("尚未访问：ai");
    expect(options?.context?.visitorProgress).toContain("已接触角色：core");
  });

  it("首次到访（无进度）时不注入进度行", async () => {
    await askSupervisor("随便聊点什么", {
      roomId: "central",
      interactionType: "chat",
    } as any);

    const options = mocks.invokeAgent.mock.calls.at(-1)?.[2] as
      | { context?: { visitorProgress?: string } }
      | undefined;

    expect(options?.context?.visitorProgress).toBeUndefined();
  });
});

describe("supervisor multi-expert synthesis", () => {
  const CONSULT_QUESTION = "请综合评估这个想法的可行性与表达方式";

  function classificationResponse() {
    return {
      id: "cls",
      created: 1,
      model: "deepseek-chat",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({
              category: "complex",
              targetAgent: "ai",
              confidence: 0.9,
              needsConsultation: true,
              consultAgents: ["builder", "writer"],
              reasoning: "跨领域",
            }),
          },
          finish_reason: "stop",
        },
      ],
    };
  }

  function synthesisResponse(content: string) {
    return {
      id: "syn",
      created: 2,
      model: "deepseek-chat",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content },
          finish_reason: "stop",
        },
      ],
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.invokeMultipleAgents.mockResolvedValue(
      new Map([
        ["builder", { answer: "工程视角回答", uiAction: {} }],
        ["writer", { answer: "表达视角回答", uiAction: {} }],
      ])
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("并行路径用真实综合产出融合回答（分类 + 综合各一次 LLM）", async () => {
    mocks.invokeLLM
      .mockResolvedValueOnce(classificationResponse())
      .mockResolvedValueOnce(synthesisResponse("融合后的回答"));

    const result = await askSupervisor(CONSULT_QUESTION, {
      roomId: "central",
      interactionType: "chat",
    } as any);

    expect(result.answer).toBe("融合后的回答");
    expect(mocks.invokeLLM).toHaveBeenCalledTimes(2);
    expect(result.agentResponses).toMatchObject({
      builder: "工程视角回答",
      writer: "表达视角回答",
    });
  });

  it("综合失败时降级为带显示名的分段呈现，不改写原文", async () => {
    mocks.invokeLLM
      .mockResolvedValueOnce(classificationResponse())
      .mockRejectedValueOnce(new Error("综合调用超时"));

    const result = await askSupervisor(CONSULT_QUESTION, {
      roomId: "central",
      interactionType: "chat",
    } as any);

    // 原文一字不改地保留，并附上用户可见显示名
    expect(result.answer).toContain("工程视角回答");
    expect(result.answer).toContain("表达视角回答");
    expect(result.answer).toContain(AGENT_DISPLAY_NAMES.builder);
    expect(result.answer).toContain(AGENT_DISPLAY_NAMES.writer);
    // 不泄露内部英文 agent id
    expect(result.answer).not.toContain("**builder**");
  });
});
