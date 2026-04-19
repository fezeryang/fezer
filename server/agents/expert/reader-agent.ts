/**
 * Reader Expert Agent
 * 思考专家 - 深度阅读和知识管理
 */

import type { AgentResponse, AgentInvokeOptions } from "./agent-factory";
import { invokeAgent } from "./agent-factory";

export async function invokeReaderAgent(
  input: string,
  options?: AgentInvokeOptions
): Promise<AgentResponse> {
  return invokeAgent("reader", input, options);
}

export const ReaderAgent = {
  ask: async (question: string): Promise<AgentResponse> => {
    return invokeReaderAgent(question);
  },

  explainReading: async (): Promise<AgentResponse> => {
    return invokeReaderAgent("请介绍一下你的阅读方法和知识管理习惯。");
  },

  recommendReading: async (topic: string): Promise<AgentResponse> => {
    return invokeReaderAgent(`关于${topic}，你有什么阅读推荐？`);
  },
};
