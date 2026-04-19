/**
 * AI Expert Agent
 * AI 应用专家 - 熟悉 LLM、LangChain、Agent 开发
 */

import type { AgentResponse, AgentInvokeOptions } from "./agent-factory";
import { invokeAgent } from "./agent-factory";

/**
 * 调用 AI Agent
 */
export async function invokeAIAgent(
  input: string,
  options?: AgentInvokeOptions
): Promise<AgentResponse> {
  return invokeAgent("ai", input, options);
}

/**
 * AI Agent 的快捷方法
 */
export const AIAgent = {
  /**
   * 回答 AI 相关问题
   */
  ask: async (question: string): Promise<AgentResponse> => {
    return invokeAIAgent(question);
  },

  /**
   * 解释 LangChain/LangGraph
   */
  explainLangChain: async (): Promise<AgentResponse> => {
    return invokeAIAgent("请解释一下 LangChain 和 LangGraph 是什么，以及你如何使用它们。");
  },

  /**
   * 列出 AI 项目经验
   */
  listAIProjects: async (): Promise<AgentResponse> => {
    return invokeAIAgent("请介绍你做过的 AI 应用项目，特别是 LLM 相关的。");
  },

  /**
   * AI 技术建议
   */
  giveAdvice: async (topic: string): Promise<AgentResponse> => {
    return invokeAIAgent(`关于${topic}，你有什么 AI 技术建议？`);
  },
};
