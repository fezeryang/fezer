/**
 * Agent Tool - Agent 间通信
 * 允许一个 agent 咨询其他 agent
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { ConversationTurn } from "@fezer/shared/schemas/agent";

// 类型定义
export type AgentId =
  | "core"
  | "builder"
  | "ai"
  | "writer"
  | "reader"
  | "visual"
  | "wanderer";

/**
 * agent 间通信的调用方上下文。
 * 由 agent-factory 在工具循环外层通过 AsyncLocalStorage 注入，
 * 保证并发请求互不串扰，且调用方身份不可被 LLM 伪造。
 */
export interface AgentToolCallContext {
  /** 发起工具调用的 agent */
  callerAgentId: AgentId;
  /** 当前嵌套深度（顶层为 0） */
  consultDepth: number;
  /** 事实来源约束（从顶层请求透传） */
  grounding?: "public_profile";
  /** 多轮会话历史（从顶层请求透传） */
  conversationHistory?: ConversationTurn[];
}

const agentToolCallStorage = new AsyncLocalStorage<AgentToolCallContext>();

/** 在指定的调用方上下文中执行（agent-factory 工具循环使用） */
export function runWithAgentToolContext<T>(
  context: AgentToolCallContext,
  callback: () => Promise<T>
): Promise<T> {
  return agentToolCallStorage.run(context, callback);
}

function getAgentToolCallContext(): AgentToolCallContext | undefined {
  return agentToolCallStorage.getStore();
}

// Agent 调用函数签名
type AgentInvoker = (
  agentId: AgentId,
  question: string,
  options?: AgentInvokeOptions
) => Promise<{ answer: string; uiAction?: any }>;

export interface AgentInvokeOptions {
  context?: {
    callerAgentId?: AgentId;
    grounding?: "public_profile";
    conversationHistory?: ConversationTurn[];
    consultDepth?: number;
  };
}

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
  async ({ agentId, question }) => {
    // 调用方身份与透传上下文来自服务端注入的 ALS，而非 LLM 可控的参数
    const callContext = getAgentToolCallContext();

    try {
      const result = await invokeAgent(agentId, question, {
        context: {
          callerAgentId: callContext?.callerAgentId,
          grounding: callContext?.grounding,
          conversationHistory: callContext?.conversationHistory,
          consultDepth: callContext?.consultDepth,
        },
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
        .enum([
          "core",
          "builder",
          "ai",
          "writer",
          "reader",
          "visual",
          "wanderer",
        ])
        .describe("要咨询的 agent ID"),
      question: z.string().describe("要询问的问题"),
    }),
  }
);

/**
 * askMultipleAgents Tool
 * 并行咨询多个 agent
 */
export const askMultipleAgentsTool = tool(
  async ({ agentIds, question }) => {
    const callContext = getAgentToolCallContext();

    const results = await Promise.all(
      agentIds.map(async id => {
        try {
          const result = await invokeAgent(id, question, {
            context: {
              callerAgentId: callContext?.callerAgentId,
              grounding: callContext?.grounding,
              conversationHistory: callContext?.conversationHistory,
              consultDepth: callContext?.consultDepth,
            },
          });
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
    description:
      "并行咨询多个专家 agent 的意见。用于需要多个领域视角的复杂问题。",
    schema: z.object({
      agentIds: z
        .array(
          z.enum([
            "core",
            "builder",
            "ai",
            "writer",
            "reader",
            "visual",
            "wanderer",
          ])
        )
        .min(1)
        .max(3)
        .describe("要咨询的 agent ID 列表，最多 3 个"),
      question: z.string().describe("要询问的问题"),
    }),
  }
);
