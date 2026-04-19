/**
 * UI 相关类型定义
 */

import type { FezerType } from "./character";

/**
 * 聊天消息类型
 */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

/**
 * 聊天状态
 */
export interface ChatState {
  messages: ChatMessage[];
  isOpen: boolean;
  currentAgent?: FezerType;
  suggestedQuestions?: string[];
  suggestedAgents?: FezerType[];
}

/**
 * 面板类型
 */
export type PanelType = "guide" | "character" | "resume";

/**
 * UI 指令 (后端返回给前端)
 */
export interface UiInstruction {
  panel?: PanelType;
  focusRoomId?: string;
  highlightCharacterId?: FezerType;
  suggestedNextCharacterIds?: FezerType[];
  suggestedQuestions?: string[];
}
