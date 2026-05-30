import type { Response } from "express";
import type { AgentResponse } from "@fezer/shared/schemas/agent";
import type { FezerType } from "@fezer/shared/schemas/character";

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

export function sendE2eAgentResponse(
  res: Response,
  overrides: Partial<AgentResponse> = {}
): void {
  const response: AgentResponse = {
    text: "E2E mock agent response",
    panel: "character",
    speakingAgentId: "core",
    suggestedQuestions: ["Tell me more"],
    ...overrides,
  };

  res.json(response);
}

export function toE2eFezerType(value: string | undefined): FezerType {
  return value && FEZER_TYPES.has(value as FezerType)
    ? (value as FezerType)
    : "core";
}
