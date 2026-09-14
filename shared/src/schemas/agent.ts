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
  /** 交互类型：click/hover 表示用户显式选中了某个 agent，chat 表示房间内泛化提问 */
  interactionType?: "click" | "hover" | "chat" | "guide";
  /** 已访问的房间列表 */
  visitedRooms?: string[];
  /** 已发现的角色列表 */
  discoveredCharacters?: string[];
  /** 回答事实来源约束 */
  grounding?: "public_profile";
  /** 以 SSE 流式接收运行事件（RunEvent，见 run.ts）；缺省走一次性 JSON */
  stream?: boolean;
  /**
   * 多轮会话历史（不含当前这条 userInput），按时间升序。
   * 服务端会做条数与长度截断，作为信任边界。
   */
  conversationHistory?: ConversationTurn[];
}

/**
 * 单轮对话记录（多轮记忆的最小单元）
 */
export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  /** 该轮回答的 agent（仅 assistant 轮携带，用于多 agent 会话归因） */
  agentId?: FezerType;
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
  /** 回答尾部的可点击内容卡片（确定性派生，见 ContentCard） */
  cards?: ContentCard[];
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
 * 聊天内嵌内容卡片（C5）
 *
 * 确定性派生：slug 来自成功的检索工具结果，并必须在服务端内容索引中
 * 校验通过才会下发 —— LLM 不生成 slug。
 */
export interface ContentCard {
  type: "work" | "blog";
  slug: string;
  title: string;
  description?: string;
  tags?: string[];
  /** 作品的内部/外部链接；缺失时客户端回退到列表页 */
  link?: string;
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
  /** 回答尾部的可点击内容卡片（最多 3 张） */
  cards?: ContentCard[];
}
