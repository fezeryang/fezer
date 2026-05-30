import type { FezerType, RoomId } from "../schemas/character";

export const FEZER_AGENT_IDS: FezerType[] = [
  "core",
  "builder",
  "ai",
  "writer",
  "reader",
  "visual",
  "wanderer",
];

export const ROOM_AGENT_IDS: Record<RoomId, FezerType> = {
  central: "core",
  builder: "builder",
  ai: "ai",
  writer: "writer",
  reader: "reader",
  visual: "visual",
  wanderer: "wanderer",
};

export function isFezerType(value: string | undefined): value is FezerType {
  return Boolean(value && FEZER_AGENT_IDS.includes(value as FezerType));
}

export function resolveFezerTypeByCharacterId(
  characterId: string | undefined
): FezerType | undefined {
  if (!characterId) return undefined;
  if (isFezerType(characterId)) return characterId;

  const characterIndex = Number.parseInt(characterId.replace(/\D/g, ""), 10);
  if (characterIndex >= 1 && characterIndex <= 3) return "core";
  if (characterIndex >= 4 && characterIndex <= 5) return "builder";
  if (characterIndex >= 6 && characterIndex <= 8) return "ai";
  if (characterIndex >= 9 && characterIndex <= 10) return "writer";
  if (characterIndex >= 11 && characterIndex <= 12) return "reader";
  if (characterIndex >= 13 && characterIndex <= 15) return "visual";
  if (characterIndex >= 16 && characterIndex <= 18) return "wanderer";
  return undefined;
}

export function resolveFezerTypeByRoomId(
  roomId: string | undefined
): FezerType | undefined {
  if (!roomId) return undefined;
  return ROOM_AGENT_IDS[roomId as RoomId];
}

export function resolveFezerTypeFromSpatialContext(input: {
  characterId?: string;
  roomId?: string;
}): FezerType | undefined {
  return (
    resolveFezerTypeByCharacterId(input.characterId) ||
    resolveFezerTypeByRoomId(input.roomId)
  );
}
