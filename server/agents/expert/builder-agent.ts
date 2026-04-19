/**
 * Builder Expert Agent
 * 技术实现专家 - 精通前端、后端、工程化
 */

import type { AgentResponse, AgentInvokeOptions } from "./agent-factory";
import { invokeAgent } from "./agent-factory";

/**
 * 调用 Builder Agent
 */
export async function invokeBuilderAgent(
  input: string,
  options?: AgentInvokeOptions
): Promise<AgentResponse> {
  return invokeAgent("builder", input, options);
}

/**
 * Builder Agent 的快捷方法
 */
export const BuilderAgent = {
  /**
   * 回答技术相关问题
   */
  ask: async (question: string): Promise<AgentResponse> => {
    return invokeBuilderAgent(question);
  },

  /**
   * 解释技术栈
   */
  explainStack: async (): Promise<AgentResponse> => {
    return invokeBuilderAgent("请介绍一下你的技术栈，包括前端、后端和工程化工具。");
  },

  /**
   * 列出项目经验
   */
  listProjects: async (): Promise<AgentResponse> => {
    return invokeBuilderAgent("请列出你参与过的项目，重点介绍技术亮点。");
  },

  /**
   * 技术建议
   */
  giveAdvice: async (topic: string): Promise<AgentResponse> => {
    return invokeBuilderAgent(`关于${topic}，你有什么技术建议或最佳实践？`);
  },
};
