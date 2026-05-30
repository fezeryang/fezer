import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  askSupervisor: vi.fn(),
}));

vi.mock("../supervisor/graph", () => ({
  askSupervisor: mocks.askSupervisor,
}));

import { orchestratorGraph } from "./graph";

describe("orchestrator spatial agent context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.askSupervisor.mockResolvedValue({
      answer: "visual agent answer",
      uiAction: { suggestedQuestions: ["继续问视觉问题"] },
      agentResponses: {},
    });
  });

  it("passes both the original character id and resolved preferred agent to supervisor", async () => {
    const result = await orchestratorGraph.invoke({
      userInput: "介绍一下你是谁",
      roomId: "visual",
      characterId: "fezer-13",
      interactionType: "click",
      messages: [],
    });

    expect(mocks.askSupervisor).toHaveBeenCalledWith(
      "介绍一下你是谁",
      expect.objectContaining({
        roomId: "visual",
        characterId: "fezer-13",
        interactionType: "click",
        preferredAgent: "visual",
        messages: expect.any(Array),
      })
    );
    expect(result.currentPrimaryAgent).toBe("visual");
    expect(result.uiAction.highlightCharacterId).toBe("visual");
    expect(result.answer).toBe("visual agent answer");
  });
});
