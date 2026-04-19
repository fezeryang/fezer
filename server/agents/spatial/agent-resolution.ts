import type { RoomId } from "@fezer/shared/schemas/character";
import type { AgentId } from "../tools/agent.tool";
import { ROOM_PRIMARY_AGENT } from "./room-map";

/**
 * Single source of truth for resolving runtime agent by spatial context.
 * Keep all character/room to agent mappings here to avoid drift.
 */
export function resolveAgentByCharacterId(characterId: string): AgentId {
  const num = parseInt(characterId.replace(/\D/g, ""), 10);
  if (num >= 1 && num <= 3) return "core";
  if (num >= 4 && num <= 5) return "builder";
  if (num >= 6 && num <= 8) return "ai";
  if (num >= 9 && num <= 10) return "writer";
  if (num >= 11 && num <= 12) return "reader";
  if (num >= 13 && num <= 15) return "visual";
  if (num >= 16 && num <= 18) return "wanderer";
  return "core";
}

export function resolveAgentByRoomId(roomId?: string): AgentId {
  if (!roomId) return "core";
  return (ROOM_PRIMARY_AGENT as Record<string, AgentId>)[roomId] ?? "core";
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
