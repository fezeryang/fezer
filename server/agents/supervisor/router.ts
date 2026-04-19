/**
 * Supervisor Router - 路由决策
 * 根据意图分类结果决定执行路径
 */

import type { AgentId } from "../tools/agent.tool";
import { IntentClassification } from "./intent-classifier";
import { END } from "@langchain/langgraph";
import {
  resolveAgentByCharacterId,
  resolveRoomAgent,
} from "../spatial/agent-resolution";

/**
 * 路由决策结果
 */
export type RouteDecision = typeof END | AgentId | "parallel" | "consult";

/**
 * 主路由函数
 * 根据意图分类决定下一个节点
 */
export function decideRoute(
  classification: IntentClassification,
  currentState: any
): RouteDecision {
  const { needsConsultation, consultAgents, category } = classification;

  // 复杂问题需要并行咨询
  if (needsConsultation && consultAgents && consultAgents.length > 1) {
    return "parallel";
  }

  // 需要单个 agent 咨询
  if (needsConsultation && consultAgents && consultAgents.length === 1) {
    return "consult";
  }

  // 直接路由到目标 agent
  return classification.targetAgent;
}

/**
 * Agent 选择优先级
 * 考虑用户偏好、历史行为等
 */
export function selectAgentWithPriority(
  candidates: AgentId[],
  context: {
    roomId?: string;
    characterId?: string;
    visitedAgents?: AgentId[];
  }
): AgentId {
  // 如果有明确的 characterId，优先选择对应的 agent
  if (context.characterId) {
    const agentFromCharacter = resolveAgentByCharacterId(context.characterId);
    if (candidates.includes(agentFromCharacter)) {
      return agentFromCharacter;
    }
  }

  // 如果有 roomId，考虑房间对应的 agent
  if (context.roomId) {
    const roomAgent = resolveRoomAgent(context.roomId);
    if (roomAgent && candidates.includes(roomAgent)) {
      return roomAgent;
    }
  }

  // 默认返回第一个候选
  return candidates[0] || "core";
}

/**
 * 并行执行配置
 */
export interface ParallelExecutionConfig {
  agents: AgentId[];
  question: string;
  aggregateStrategy: "concat" | "vote" | "synthesize";
}

/**
 * 创建并行执行配置
 */
export function createParallelConfig(
  agents: AgentId[],
  question: string,
  aggregateStrategy: ParallelExecutionConfig["aggregateStrategy"] = "synthesize"
): ParallelExecutionConfig {
  return {
    agents,
    question,
    aggregateStrategy,
  };
}
