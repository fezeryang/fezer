/**
 * Agent Tool - Agent 间通信
 * 允许一个 agent 咨询其他 agent
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";

// 类型定义
export type AgentId = "core" | "builder" | "ai" | "writer" | "reader" | "visual" | "wanderer";

// 简单的 agent 调用接口（后续会被实际的 expert agent 替换）
interface AgentInvokeOptions {
  previousContext?: {
    fromAgent?: string;
    conversationHistory?: any[];
  };
}

// Agent 调用函数签名
type AgentInvoker = (
  agentId: AgentId,
  question: string,
  options?: AgentInvokeOptions
) => Promise<{ answer: string; uiAction?: any }>;

// 依赖注入：实际的 invoke 函数会在 agent-factory 中设置
let _invokeAgent: AgentInvoker | null = null;

export function setAgentInvoker(fn: AgentInvoker) {
  _invokeAgent = fn;
}

async function invokeAgent(
  agentId: AgentId,
  question: string,
  options?: AgentInvokeOptions
): Promise<{ answer: string; uiAction?: any }> {
  if (!_invokeAgent) {
    // 如果没有设置，返回一个占位响应
    return {
      answer: `[Agent ${agentId}] 收到问题"${question}"，但 agent 调用接口尚未初始化。`,
    };
  }
  return _invokeAgent(agentId, question, options);
}

/**
 * askOtherAgent Tool
 * 允许当前 agent 咨询其他专家 agent
 */
export const askOtherAgentTool = tool(
  async ({ agentId, question, includeContext }) => {
    try {
      const result = await invokeAgent(agentId, question, {
        previousContext: includeContext
          ? {
              fromAgent: includeContext.fromAgent,
              conversationHistory: includeContext.conversationHistory,
            }
          : undefined,
      });

      return {
        success: true,
        agent: agentId,
        question,
        response: result.answer,
        suggestions: result.uiAction?.suggestedNextCharacterIds,
      };
    } catch (error) {
      return {
        success: false,
        agent: agentId,
        question,
        error: error instanceof Error ? error.message : "Unknown error",
        response: `抱歉，无法联系 ${agentId} agent。`,
      };
    }
  },
  {
    name: "ask_other_agent",
    description: `咨询其他专家 agent 的意见。当你无法完整回答问题，或需要其他领域专家的见解时使用此工具。
各专家领域：
- core: 全局介绍和导览
- builder: 技术实现、前端、后端、工程化
- ai: AI 应用、LangChain、LLM 集成
- writer: 写作、技术文档、内容创作
- reader: 阅读、思考、知识管理
- visual: 设计、UI/UX、3D
- wanderer: 旅行、观察、生活体验`,
    schema: z.object({
      agentId: z
        .enum(["core", "builder", "ai", "writer", "reader", "visual", "wanderer"])
        .describe("要咨询的 agent ID"),
      question: z.string().describe("要询问的问题"),
      includeContext: z
        .object({
          fromAgent: z.string().optional().describe("当前 agent ID"),
          conversationHistory: z.array(z.any()).optional().describe("对话历史"),
        })
        .optional()
        .describe("是否包含上下文信息"),
    }),
  }
);

/**
 * askMultipleAgents Tool
 * 并行咨询多个 agent
 */
export const askMultipleAgentsTool = tool(
  async ({ agentIds, question }) => {
    const results = await Promise.all(
      agentIds.map(async id => {
        try {
          const result = await invokeAgent(id, question);
          return {
            agent: id,
            success: true,
            response: result.answer,
          };
        } catch (error) {
          return {
            agent: id,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            response: `抱歉，${id} agent 暂时无法回答。`,
          };
        }
      })
    );

    return {
      question,
      responses: results,
      summary: results
        .filter(r => r.success)
        .map(r => `[${r.agent}]: ${r.response}`)
        .join("\n\n"),
    };
  },
  {
    name: "ask_multiple_agents",
    description: "并行咨询多个专家 agent 的意见。用于需要多个领域视角的复杂问题。",
    schema: z.object({
      agentIds: z
        .array(z.enum(["core", "builder", "ai", "writer", "reader", "visual", "wanderer"]))
        .min(1)
        .max(4)
        .describe("要咨询的 agent ID 列表，最多 4 个"),
      question: z.string().describe("要询问的问题"),
    }),
  }
);
