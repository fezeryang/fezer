/**
 * 统一导出所有 AI 相关类型
 */

export type * from "./agent";
export type * from "./character";
export type * from "./run";
export type * from "./ui";

// 导出常量
export {
  ROOM_PRIMARY_AGENT,
  AGENT_ROOM_MAP,
  AGENT_RELATIONS,
  RELATION_DESCRIPTIONS,
} from "./character";

// 导出运行时断言
export { isTerminalRunEvent } from "./run";
