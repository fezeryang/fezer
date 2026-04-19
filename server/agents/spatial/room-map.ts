/**
 * 空间路由 - 房间到代理的映射
 */

import type { FezerType, RoomId } from "@fezer/shared/schemas/character";

/**
 * 房间-代理映射
 * 定义每个房间对应的主要代理
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
 * 定义每个代理对应的房间
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
 * 根据房间 ID 获取主要代理
 */
export function getPrimaryAgentByRoom(roomId: string): FezerType | null {
  return ROOM_PRIMARY_AGENT[roomId as RoomId] ?? null;
}

/**
 * 根据代理 ID 获取对应房间
 */
export function getRoomByAgent(agentId: FezerType): RoomId {
  return AGENT_ROOM_MAP[agentId];
}
