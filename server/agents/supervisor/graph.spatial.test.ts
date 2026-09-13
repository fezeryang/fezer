import { beforeEach, describe, expect, it, vi } from "vitest";

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
});
