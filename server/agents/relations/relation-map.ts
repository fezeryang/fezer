/**
 * 代理关系层
 * 定义代理之间的语义关系，用于切换和推荐
 */

import type { FezerType } from "@fezer/shared/schemas/character";

/**
 * 代理关系图
 * 定义哪些代理之间有语义关联
 */
export const AGENT_RELATIONS: Record<FezerType, FezerType[]> = {
  core: ["builder", "ai", "writer", "reader", "visual", "wanderer"],
  builder: ["ai", "writer"],
  ai: ["builder", "reader"],
  writer: ["reader", "visual"],
  reader: ["writer", "wanderer"],
  visual: ["writer", "wanderer"],
  wanderer: ["reader", "visual"],
} as const;

/**
 * 关系描述
 * 解释为什么两个代理有关联
 */
export const RELATION_DESCRIPTIONS: Record<string, string> = {
  "core-builder": "技术实现相关问题",
  "core-ai": "AI 应用相关问题",
  "core-writer": "写作表达相关问题",
  "core-reader": "阅读思考相关问题",
  "core-visual": "视觉设计相关问题",
  "core-wanderer": "旅行观察相关问题",
  "builder-ai": "从技术实现到 AI 自动化的自然延伸",
  "ai-builder": "AI 应用的技术落地",
  "ai-reader": "从 AI 实践到深度思考的关联",
  "builder-writer": "从技术实现到内容表达",
  "writer-reader": "从输出到输入的知识循环",
  "writer-visual": "内容表达的文字与视觉形式",
  "reader-wanderer": "从书本思考到世界观察",
  "visual-wanderer": "从创作到生活的审美延伸",
} as const;

/**
 * 获取代理的相关代理列表
 */
export function getRelatedAgents(agentId: FezerType): FezerType[] {
  return AGENT_RELATIONS[agentId] ?? [];
}

/**
 * 获取关系描述
 */
export function getRelationDescription(
  fromAgent: FezerType,
  toAgent: FezerType
): string | null {
  const key = `${fromAgent}-${toAgent}`;
  return RELATION_DESCRIPTIONS[key] ?? null;
}

/**
 * 检查两个代理是否相关
 */
export function areAgentsRelated(
  agent1: FezerType,
  agent2: FezerType
): boolean {
  const related = AGENT_RELATIONS[agent1] ?? [];
  return related.includes(agent2);
}
