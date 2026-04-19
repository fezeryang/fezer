/**
 * 全局编排器节点实现
 */

import type { FezerType } from "@fezer/shared/schemas/character";
import type { BaseMessage } from "@langchain/core/messages";
import { ROOM_PRIMARY_AGENT } from "../spatial/room-map";
import { AGENT_RELATIONS } from "../relations/relation-map";
import { buildAgentSystemPrompt, getCharacterConfig } from "@fezer/shared/characters";
import { invokeLLM } from "../../_core/llm";
import { HumanMessage } from "@langchain/core/messages";

/**
 * 意图类型
 */
type IntentType = "guide" | "character" | "qa" | "quick_resume" | "recommend";

/**
 * 1. ingestRequest - 标准化请求
 * 将用户输入添加到消息历史
 */
export async function ingestRequest(state: any): Promise<Partial<any>> {
  const { userInput } = state;

  const newMessage = new HumanMessage(userInput);

  return {
    messages: [newMessage],
  };
}

/**
 * 2. detectSpatialContext - 检测空间上下文
 * 根据 roomId/characterId 确定主要代理
 */
export async function detectSpatialContext(state: any): Promise<Partial<any>> {
  const {
    roomId,
    characterId,
    interactionType,
    visitedRooms,
    discoveredCharacters,
  } = state;

  // 规则优先级：
  // 1. 直接点击角色 → 使用角色的代理类型
  // 2. 在房间中 → 使用房间的主代理
  // 3. 默认 → core

  let primaryAgent: FezerType = "core";

  if (characterId && interactionType === "click") {
    // 从 characterId 提取 fezerType
    primaryAgent = getAgentByCharacterId(characterId);
  } else if (roomId) {
    primaryAgent =
      ROOM_PRIMARY_AGENT[roomId as keyof typeof ROOM_PRIMARY_AGENT] ?? "core";
  }

  // 记录访问历史
  const newVisitedRooms = roomId ? [...(visitedRooms || []), roomId] : [];
  const newDiscoveredCharacters = characterId
    ? [...(discoveredCharacters || []), characterId]
    : [];

  return {
    currentPrimaryAgent: primaryAgent,
    visitedRooms: newVisitedRooms,
    discoveredCharacters: newDiscoveredCharacters,
  };
}

/**
 * 3. classifyIntent - 意图分类
 * 简单规则分类 (可后续升级为 LLM 分类)
 */
export async function classifyIntent(state: any): Promise<Partial<any>> {
  const { userInput } = state;

  const intent = detectIntent(userInput);

  let targetAgent: FezerType | undefined;

  // 根据意图调整目标代理
  if (intent === "guide") {
    targetAgent = "core";
  }

  return { targetAgent };
}

/**
 * 4. selectPrimaryAgent - 选择主要代理
 */
export async function selectPrimaryAgent(state: any): Promise<Partial<any>> {
  // 优先级：targetAgent > currentPrimaryAgent
  const selectedAgent = state.targetAgent ?? state.currentPrimaryAgent;

  return {
    currentPrimaryAgent: selectedAgent,
  };
}

/**
 * 5. runCharacterSubgraph - 执行角色子图
 * 调用 LLM 生成角色回答
 */
export async function runCharacterSubgraph(state: any): Promise<Partial<any>> {
  const { currentPrimaryAgent, userInput, messages } = state;

  // 获取角色配置
  const characterConfig = getCharacterConfig(currentPrimaryAgent);

  // 构建系统提示
  const systemPrompt = buildAgentSystemPrompt(currentPrimaryAgent, {
    interactionMode:
      currentPrimaryAgent === "core" ? "core-routing" : "expert-answering",
  });

  // 调用 LLM
  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        ...(messages || []).slice(-5).map((m: BaseMessage) => ({
          role: m.getType() as "system" | "user" | "assistant",
          content:
            typeof m.content === "string"
              ? m.content
              : JSON.stringify(m.content),
        })),
      ],
    });

    const answer =
      result.choices[0]?.message?.content ?? "抱歉，我暂时无法回答。";

    return {
      answer: typeof answer === "string" ? answer : JSON.stringify(answer),
    };
  } catch (error) {
    console.error("LLM invoke error:", error);
    return {
      answer: `抱歉，${characterConfig.displayName} 遇到了一些技术问题，请稍后再试。`,
    };
  }
}

/**
 * 6. maybeHandoffToRelatedAgent - 可能的代理切换/推荐
 */
export async function maybeHandoffToRelatedAgent(
  state: any
): Promise<Partial<any>> {
  const { currentPrimaryAgent, userInput, uiAction } = state;

  // 获取相关代理
  const relatedAgents = AGENT_RELATIONS[currentPrimaryAgent as FezerType] ?? [];

  // 简单关键词检测
  const suggestedAgents = relatedAgents.filter((agent: FezerType) =>
    userInput.toLowerCase().includes(getAgentKeyword(agent))
  );

  if (suggestedAgents.length > 0) {
    return {
      uiAction: {
        ...uiAction,
        suggestedNextCharacterIds: suggestedAgents,
      },
    };
  }

  return {};
}

/**
 * 7. assembleUiPayload - 组装 UI 输出
 */
export async function assembleUiPayload(state: any): Promise<Partial<any>> {
  const { currentPrimaryAgent, uiAction } = state;
  const characterConfig = getCharacterConfig(currentPrimaryAgent);

  return {
    uiAction: {
      panel: "character",
      highlightCharacterId: currentPrimaryAgent,
      focusRoomId: characterConfig.roomId,
      suggestedQuestions: characterConfig.starterQuestions.slice(0, 3),
      ...uiAction,
    },
  };
}

// ============ 辅助函数 ============

/**
 * 从 characterId 获取代理类型
 */
function getAgentByCharacterId(characterId: string): FezerType {
  // 根据角色 ID 确定代理类型
  const num = parseInt(characterId.replace(/\D/g, ""));
  if (num >= 1 && num <= 3) return "core";
  if (num >= 4 && num <= 5) return "builder";
  if (num >= 6 && num <= 8) return "ai";
  if (num >= 9 && num <= 10) return "writer";
  if (num >= 11 && num <= 12) return "reader";
  if (num >= 13 && num <= 15) return "visual";
  if (num >= 16 && num <= 18) return "wanderer";
  return "core";
}

/**
 * 简单意图检测
 */
function detectIntent(userInput: string): IntentType {
  const input = userInput.toLowerCase();

  // 导览意图
  if (
    input.includes("介绍") ||
    input.includes("导览") ||
    input.includes("哪里") ||
    input.includes("怎么")
  ) {
    return "guide";
  }

  // 简历意图
  if (
    input.includes("简历") ||
    input.includes("经历") ||
    input.includes("技能")
  ) {
    return "quick_resume";
  }

  // 推荐意图
  if (input.includes("推荐") || input.includes("建议")) {
    return "recommend";
  }

  // 默认 QA
  return "qa";
}

/**
 * 获取代理关键词
 */
function getAgentKeyword(agent: FezerType): string {
  const keywords: Record<FezerType, string> = {
    core: "介绍",
    builder: "技术",
    ai: "ai",
    writer: "写作",
    reader: "阅读",
    visual: "设计",
    wanderer: "旅行",
  };
  return keywords[agent];
}
