import type { AgentId } from "../../agents/tools/agent.tool";

export interface IntentFeedbackClassification {
  category: string;
  targetAgent: AgentId;
  confidence: number;
  needsConsultation: boolean;
  consultAgents?: AgentId[];
  reasoning: string;
}

export interface IntentFeedbackRecord {
  userInput: string;
  runId: string;
  feedbackType: "positive" | "correction";
  modelOutput: IntentFeedbackClassification;
  score?: number;
  correction?: Partial<IntentFeedbackClassification>;
  promptKey?: string;
  promptVersion?: string;
}

export interface LangSmithDatasetDatapoint {
  inputs: {
    user_input: string;
  };
  outputs: {
    category: string;
    targetAgent: AgentId;
    needsConsultation: boolean;
    consultAgents: AgentId[];
    reasoning: string;
  };
  metadata: {
    source: "user_feedback";
    feedback_type: "positive" | "correction";
    run_id: string;
    score?: number;
    prompt_key?: string;
    prompt_version?: string;
    generated_at: string;
  };
}

function normalizeConsultAgents(
  targetAgent: AgentId,
  needsConsultation: boolean,
  consultAgents?: AgentId[]
): AgentId[] {
  if (!needsConsultation || !Array.isArray(consultAgents)) {
    return [];
  }

  return Array.from(new Set(consultAgents)).filter(agent => agent !== targetAgent);
}

function buildExpectedOutput(
  record: IntentFeedbackRecord
): LangSmithDatasetDatapoint["outputs"] {
  const base = record.modelOutput;
  const corrected = record.feedbackType === "correction" && record.correction
    ? { ...base, ...record.correction }
    : base;

  const targetAgent = corrected.targetAgent ?? base.targetAgent;
  const needsConsultation = Boolean(corrected.needsConsultation);

  return {
    category: corrected.category ?? base.category,
    targetAgent,
    needsConsultation,
    consultAgents: normalizeConsultAgents(
      targetAgent,
      needsConsultation,
      corrected.consultAgents
    ),
    reasoning: corrected.reasoning ?? base.reasoning,
  };
}

export function buildIntentFeedbackDatapoint(
  record: IntentFeedbackRecord
): LangSmithDatasetDatapoint {
  return {
    inputs: {
      user_input: record.userInput,
    },
    outputs: buildExpectedOutput(record),
    metadata: {
      source: "user_feedback",
      feedback_type: record.feedbackType,
      run_id: record.runId,
      ...(typeof record.score === "number" ? { score: record.score } : {}),
      ...(record.promptKey ? { prompt_key: record.promptKey } : {}),
      ...(record.promptVersion ? { prompt_version: record.promptVersion } : {}),
      generated_at: new Date().toISOString(),
    },
  };
}

