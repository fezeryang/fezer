import type { RoomId } from "@fezer/shared/schemas/character";
import type { AgentId } from "../tools/agent.tool";
import { ROOM_PRIMARY_AGENT } from "./room-map";
import {
  resolveFezerTypeByCharacterId,
  resolveFezerTypeByRoomId,
} from "@fezer/shared/characters";

/**
 * Single source of truth for resolving runtime agent by spatial context.
 * Keep all character/room to agent mappings here to avoid drift.
 */
export function resolveAgentByCharacterId(characterId: string): AgentId {
  return resolveFezerTypeByCharacterId(characterId) ?? "core";
}

export function resolveAgentByRoomId(roomId?: string): AgentId {
  return resolveFezerTypeByRoomId(roomId) ?? "core";
}

export function resolvePreferredAgent(input: {
  characterId?: string;
  roomId?: string;
  interactionType?: "click" | "hover" | "chat" | "guide";
  fallback?: AgentId;
}): AgentId {
  const fallback = input.fallback ?? "core";
  if (input.characterId && input.interactionType === "click") {
    return resolveAgentByCharacterId(input.characterId);
  }
  if (input.roomId) {
    return resolveAgentByRoomId(input.roomId);
  }
  return fallback;
}

export function resolveRoomAgent(roomId: string): AgentId | null {
  const agent = (ROOM_PRIMARY_AGENT as Partial<Record<RoomId, AgentId>>)[
    roomId as RoomId
  ];
  return agent ?? null;
}
