/**
 * 全局编排器状态定义
 * 使用 LangGraph 的 StateGraph API 定义状态
 */

import type { FezerType } from "@fezer/shared/schemas/character";

/**
 * 交互类型
 */
export type InteractionType = "click" | "hover" | "chat" | "guide";

/**
 * UI 面板类型
 */
export type PanelType = "guide" | "character" | "resume";

/**
 * UI 操作指令
 */
export interface UiAction {
  panel?: PanelType;
  focusRoomId?: string;
  highlightCharacterId?: FezerType;
  suggestedNextCharacterIds?: FezerType[];
  suggestedQuestions?: string[];
}

/**
 * 全局代理状态接口（用于类型参考）
 * 实际状态在 graph.ts 中通过 Annotation.Root 定义
 */
export interface GlobalAgentStateInterface {
  messages: any[];
  userInput: string;
  roomId?: string;
  characterId?: string;
  interactionType: InteractionType;
  currentPrimaryAgent: FezerType;
  targetAgent?: FezerType;
  handoffReason?: string;
  visitedRooms: string[];
  discoveredCharacters: string[];
  answer: string;
  uiAction: UiAction;
}
