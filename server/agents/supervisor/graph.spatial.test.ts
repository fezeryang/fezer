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

  it("keeps the selected character agent for ambiguous identity questions", async () => {
    const result = await askSupervisor("介绍一下你是谁", {
      characterId: "fezer-04",
      roomId: "builder",
      preferredAgent: "builder",
    } as any);

    expect(mocks.invokeLLM).not.toHaveBeenCalled();
    expect(mocks.invokeAgent).toHaveBeenCalledWith(
      "builder",
      "介绍一下你是谁",
      expect.objectContaining({
        context: expect.objectContaining({
          messages: expect.any(Array),
        }),
      })
    );
    expect(result.answer).toBe("spatial agent answer");
  });

  it("keeps the current room agent when no character id is present", async () => {
    await askSupervisor("你是谁，能做什么？", {
      roomId: "ai",
    } as any);

    expect(mocks.invokeLLM).not.toHaveBeenCalled();
    expect(mocks.invokeAgent).toHaveBeenCalledWith(
      "ai",
      "你是谁，能做什么？",
      expect.any(Object)
    );
  });
});
