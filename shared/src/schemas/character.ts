/**
 * 角色相关类型定义
 */

/**
 * Fezer 角色类型
 * 对应 7 个房间和 7 种能力维度
 */
export type FezerType = "core" | "builder" | "ai" | "writer" | "reader" | "visual" | "wanderer";

/**
 * 角色配置接口
 */
export interface CharacterConfig {
  /** 角色 ID (FezerType) */
  id: FezerType;
  /** 显示名称 */
  displayName: string;
  /** 所属房间 ID */
  roomId: string;
  /** 角色简介 */
  roleSummary: string;
  /** 系统提示风格 */
  systemStyle: string;
  /** 当前角色的核心任务 */
  mission: string[];
  /** 专注领域 */
  focuses: string[];
  /** 代表性专长标签 */
  expertiseAreas: string[];
  /** 回答风格约束 */
  responseStyle: string[];
  /** 相关代理 (用于切换和推荐) */
  relatedAgents: FezerType[];
  /** 何时推荐切换到其他角色 */
  handoffGuidelines: string[];
  /** 不确定或超出范围时的边界规则 */
  boundaryRules: string[];
  /** 初始问题建议 */
  starterQuestions: string[];
  /** 主题色 */
  color: string;
  /** 强调色 */
  accent: string;
}

/**
 * 房间 ID 类型
 */
export type RoomId = "central" | "builder" | "ai" | "writer" | "reader" | "visual" | "wanderer";

/**
 * 房间-代理映射
 */
export const ROOM_PRIMARY_AGENT: Record<RoomId, FezerType> = {
  central: "core",
  builder: "builder",
  ai: "ai",
  writer: "writer",
  reader: "reader",
  visual: "visual",
  wanderer: "wanderer",
} as const;

/**
 * 代理-房间反向映射
 */
export const AGENT_ROOM_MAP: Record<FezerType, RoomId> = {
  core: "central",
  builder: "builder",
  ai: "ai",
  writer: "writer",
  reader: "reader",
  visual: "visual",
  wanderer: "wanderer",
} as const;

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
