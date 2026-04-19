/**
 * Writer Expert Agent
 * 写作专家 - 擅长内容创作和表达
 */

import type { AgentResponse, AgentInvokeOptions } from "./agent-factory";
import { invokeAgent } from "./agent-factory";

export async function invokeWriterAgent(
  input: string,
  options?: AgentInvokeOptions
): Promise<AgentResponse> {
  return invokeAgent("writer", input, options);
}

export const WriterAgent = {
  ask: async (question: string): Promise<AgentResponse> => {
    return invokeWriterAgent(question);
  },

  explainWriting: async (): Promise<AgentResponse> => {
    return invokeWriterAgent("请介绍一下你的写作风格和擅长的内容类型。");
  },

  giveWritingAdvice: async (topic: string): Promise<AgentResponse> => {
    return invokeWriterAgent(`关于${topic}的写作，你有什么建议？`);
  },
};
