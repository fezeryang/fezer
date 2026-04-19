import { describe, expect, it } from "vitest";
import { buildIntentFeedbackDatapoint } from "./langsmith-feedback";

describe("langsmith feedback mapping", () => {
  it("maps positive feedback to dataset datapoint using model output", () => {
    const datapoint = buildIntentFeedbackDatapoint({
      userInput: "介绍一下这个系统",
      runId: "run_1",
      feedbackType: "positive",
      score: 1,
      promptKey: "supervisor/intent-classifier",
      promptVersion: "v2",
      modelOutput: {
        category: "guide",
        targetAgent: "core",
        confidence: 0.95,
        needsConsultation: false,
        consultAgents: ["ai"],
        reasoning: "导览问题",
      },
    });

    expect(datapoint.inputs.user_input).toBe("介绍一下这个系统");
    expect(datapoint.outputs).toEqual({
      category: "guide",
      targetAgent: "core",
      needsConsultation: false,
      consultAgents: [],
      reasoning: "导览问题",
    });
    expect(datapoint.metadata.feedback_type).toBe("positive");
    expect(datapoint.metadata.run_id).toBe("run_1");
    expect(datapoint.metadata.prompt_key).toBe("supervisor/intent-classifier");
    expect(typeof datapoint.metadata.generated_at).toBe("string");
  });

  it("uses correction as gold output and normalizes consult agents", () => {
    const datapoint = buildIntentFeedbackDatapoint({
      userInput: "我想做 AI + 工程化方案",
      runId: "run_2",
      feedbackType: "correction",
      modelOutput: {
        category: "ai",
        targetAgent: "ai",
        confidence: 0.7,
        needsConsultation: false,
        consultAgents: [],
        reasoning: "原始分类",
      },
      correction: {
        category: "complex",
        targetAgent: "core",
        needsConsultation: true,
        consultAgents: ["core", "builder", "builder", "ai"],
        reasoning: "需多角色协作",
      },
    });

    expect(datapoint.outputs).toEqual({
      category: "complex",
      targetAgent: "core",
      needsConsultation: true,
      consultAgents: ["builder", "ai"],
      reasoning: "需多角色协作",
    });
    expect(datapoint.metadata.feedback_type).toBe("correction");
  });
});

