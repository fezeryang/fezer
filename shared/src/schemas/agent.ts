/**
 * Agent API 契约类型
 * 前后端共享的 API 请求/响应类型定义
 */

import type { FezerType } from "./character";

/**
 * 前端 → 后端 请求类型
 */
export interface FrontendAgentRequest {
  /** 用户输入的消息 */
  userInput: string;
  /** 当前所在房间 ID */
  roomId?: string;
  /** 点击的角色 ID；推荐角色切换时也可传 FezerType agent id */
  characterId?: string;
  /** 交互类型 */
  interactionType?: "click" | "hover" | "chat" | "guide";
  /** 已访问的房间列表 */
  visitedRooms?: string[];
  /** 已发现的角色列表 */
  discoveredCharacters?: string[];
  /** 回答事实来源约束 */
  grounding?: "public_profile";
}

/**
 * 后端 → 前端 响应类型
 */
export interface AgentResponse {
  /** 回答文本 */
  text: string;
  /** 显示的面板类型 */
  panel: "guide" | "character" | "resume";
  /** 高亮的角色 ID */
  highlightCharacterId?: FezerType;
  /** 聚焦的房间 ID */
  focusRoomId?: string;
  /** 推荐的下一个角色 ID 列表 */
  suggestedNextCharacterIds?: FezerType[];
  /** 建议的问题列表 */
  suggestedQuestions?: string[];
  /** 当前回答的代理 ID */
  speakingAgentId: FezerType;
}

/**
 * 意图分类类型
 */
export type IntentType =
  | "guide"
  | "character"
  | "qa"
  | "quick_resume"
  | "recommend";

/**
 * LLM 消息类型
 */
export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface Message {
  role: MessageRole;
  content:
    | string
    | Array<{
        type: "text" | "image_url";
        text?: string;
        image_url?: { url: string };
      }>;
  name?: string;
  tool_call_id?: string;
}

/**
 * UI 操作指令
 */
export interface UiAction {
  /** 显示的面板 */
  panel?: "guide" | "character" | "resume";
  /** 聚焦的房间 ID */
  focusRoomId?: string;
  /** 高亮的角色 ID */
  highlightCharacterId?: FezerType;
  /** 推荐的下一个角色 */
  suggestedNextCharacterIds?: FezerType[];
  /** 建议的问题 */
  suggestedQuestions?: string[];
}
