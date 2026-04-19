/**
 * Visual Expert Agent
 * 设计专家 - UI/UX 和视觉设计
 */

import type { AgentResponse, AgentInvokeOptions } from "./agent-factory";
import { invokeAgent } from "./agent-factory";

export async function invokeVisualAgent(
  input: string,
  options?: AgentInvokeOptions
): Promise<AgentResponse> {
  return invokeAgent("visual", input, options);
}

export const VisualAgent = {
  ask: async (question: string): Promise<AgentResponse> => {
    return invokeVisualAgent(question);
  },

  explainDesign: async (): Promise<AgentResponse> => {
    return invokeVisualAgent("请介绍一下你的设计风格和设计理念。");
  },

  giveDesignAdvice: async (topic: string): Promise<AgentResponse> => {
    return invokeVisualAgent(`关于${topic}的设计，你有什么建议？`);
  },
};
