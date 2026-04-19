import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "../../_core/llm";
import { classifyIntent } from "./intent-classifier";

const invokeLLMMock = vi.mocked(invokeLLM);

function llmContent(content: unknown) {
  return {
    choices: [
      {
        message: {
          content: typeof content === "string" ? content : JSON.stringify(content),
        },
      },
    ],
  };
}

describe("intent classifier", () => {
  beforeEach(() => {
    invokeLLMMock.mockReset();
  });

  it("uses quick path for explicit AI intents without LLM call", async () => {
    const result = await classifyIntent("请讲讲 LangChain 的最佳实践");

    expect(result.targetAgent).toBe("ai");
    expect(result.category).toBe("ai");
    expect(invokeLLMMock).not.toHaveBeenCalled();
  });

  it("normalizes invalid confidence and consult agents", async () => {
    invokeLLMMock.mockResolvedValueOnce(
      llmContent({
        category: "complex",
        targetAgent: "ai",
        confidence: 1.7,
        needsConsultation: true,
        consultAgents: ["ai", "builder", "builder", "unknown"],
        reasoning: "跨领域问题",
      }) as any
    );

    const result = await classifyIntent("请帮我做一个完整方案");

    expect(result.category).toBe("complex");
    expect(result.targetAgent).toBe("ai");
    expect(result.confidence).toBe(1);
    expect(result.needsConsultation).toBe(true);
    expect(result.consultAgents).toEqual(["builder"]);
  });

  it("forces empty consultAgents when needsConsultation is false", async () => {
    invokeLLMMock.mockResolvedValueOnce(
      llmContent({
        category: "technical",
        targetAgent: "builder",
        confidence: 0.8,
        needsConsultation: false,
        consultAgents: ["ai"],
        reasoning: "单领域",
      }) as any
    );

    const result = await classifyIntent("帮我看一个工程架构问题");

    expect(result.needsConsultation).toBe(false);
    expect(result.consultAgents).toEqual([]);
  });

  it("falls back to rule-based classification on invalid JSON", async () => {
    invokeLLMMock.mockResolvedValueOnce(
      llmContent("{not-json") as any
    );

    const result = await classifyIntent("我在想下一步怎么发展");

    expect(result.category).toBe("general");
    expect(result.targetAgent).toBe("core");
  });

  it("falls back to default result when LLM content is not string", async () => {
    invokeLLMMock.mockResolvedValueOnce({
      choices: [{ message: { content: [{ type: "text", text: "bad" }] } }],
    } as any);

    const result = await classifyIntent("这个系统怎么使用");

    expect(result.category).toBe("general");
    expect(result.targetAgent).toBe("core");
    expect(result.consultAgents).toEqual([]);
  });
});

