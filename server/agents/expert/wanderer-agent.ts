/**
 * Wanderer Expert Agent
 * 探索专家 - 旅行和生活体验
 */

import type { AgentResponse, AgentInvokeOptions } from "./agent-factory";
import { invokeAgent } from "./agent-factory";

export async function invokeWandererAgent(
  input: string,
  options?: AgentInvokeOptions
): Promise<AgentResponse> {
  return invokeAgent("wanderer", input, options);
}

export const WandererAgent = {
  ask: async (question: string): Promise<AgentResponse> => {
    return invokeWandererAgent(question);
  },

  explainTravel: async (): Promise<AgentResponse> => {
    return invokeWandererAgent("请介绍一下你的旅行经历和最喜欢的体验。");
  },

  shareObservation: async (topic: string): Promise<AgentResponse> => {
    return invokeWandererAgent(`关于${topic}，你有什么观察和体验分享？`);
  },
};
