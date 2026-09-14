/**
 * 3D 场景气泡的纯逻辑层（D1）
 *
 * 把「谁在哪个房间说话」的归属、优先级合并、流式截断做成纯函数，
 * Jianli 页面与 Minimap 共用；组件层（SpeechBubble/Character）只做展示。
 *
 * 归属链复用既有事实源，不新增映射表：
 * characterId → fezerType（shared/agent-resolution）→ roomId（ROOM_AGENT_IDS 反查）。
 */

import type { FezerType } from "@fezer/shared/schemas/character";
import {
  ROOM_AGENT_IDS,
  resolveFezerTypeByCharacterId,
} from "@fezer/shared/characters";
import { ROOM_ADJACENCY } from "@fezer/shared/map/rooms";
import { CHARACTERS } from "@/components/jianli/assets/characterConfig";
import { ROOMS as SCENE_ROOMS } from "@/components/jianli/assets/roomsConfig";

/** 气泡种类：招呼(C1) / 思考 / 流式回答 / 完成 / 环境闲聊(D4)；仅本文件内使用 */
type SceneBubbleKind =
  | "greeting"
  | "thinking"
  | "speaking"
  | "done"
  | "chatter";

export interface SceneBubble {
  kind: SceneBubbleKind;
  /** 说话者显示名（闲聊无名角色时缺省） */
  speaker?: string;
  text: string;
}

/** ChatModal 转发给页面的场景活动事件（RunEvent 的视图投影，不改协议本体） */
export type AgentSceneEvent =
  | { type: "agent-start"; agentId: FezerType; displayName: string }
  | { type: "agent-done"; agentId: FezerType }
  | { type: "text-delta"; agentId?: FezerType; delta: string }
  | { type: "run-settled" };

/** agentId → roomId（房间与 agent 一一对应，ROOM_AGENT_IDS 反查） */
export function roomOfAgent(agentId: FezerType): string | undefined {
  const entry = Object.entries(ROOM_AGENT_IDS).find(
    ([, agent]) => agent === agentId
  );
  return entry?.[0];
}

/** characterId（fezer-01..18）→ roomId */
export function roomOfCharacter(characterId: string): string | undefined {
  const agent = resolveFezerTypeByCharacterId(characterId);
  return agent ? roomOfAgent(agent) : undefined;
}

/** 每个房间的「首席」角色：CHARACTERS 里第一个属于该房间的（气泡默认挂它头上） */
export function leadCharacterIdOfRoom(roomId: string): string | undefined {
  return CHARACTERS.find(c => roomOfCharacter(c.id) === roomId)?.id;
}

/** 某房间内的全部角色 id */
export function charactersInRoom(roomId: string): string[] {
  return CHARACTERS.filter(c => roomOfCharacter(c.id) === roomId).map(
    c => c.id
  );
}

/** 气泡内流式文本的上限：气泡是环境反馈不是阅读区，超长即止 */
const MAX_STREAM_CHARS = 64;

/** 累积流式文本并截断；已截断后不再追加 */
export function clipStreamText(current: string, delta: string): string {
  if (current.endsWith("…")) return current;
  const next = current + delta;
  return next.length > MAX_STREAM_CHARS
    ? `${next.slice(0, MAX_STREAM_CHARS)}…`
    : next;
}

export interface MergeSceneBubblesInput {
  /** 按房间索引的 agent 活动气泡（D3） */
  agentBubbles: Record<string, SceneBubble>;
  /** 房间招呼（C1 迁移）：挂在房间首席角色头上 */
  greeting?: { roomId: string; text: string };
  /** 环境闲聊（D4）：挂具体角色头上 */
  chatter?: { characterId: string; text: string };
}

/**
 * 合并三类气泡到「角色 → 气泡」映射，冲突时优先级：agent 活动 > 招呼 > 闲聊。
 * 一个角色同一时刻至多一个气泡。
 */
export function mergeSceneBubbles(
  input: MergeSceneBubblesInput
): Record<string, SceneBubble> {
  const byCharacter: Record<string, SceneBubble> = {};

  for (const [roomId, bubble] of Object.entries(input.agentBubbles)) {
    const lead = leadCharacterIdOfRoom(roomId);
    if (lead) byCharacter[lead] = bubble;
  }

  if (input.greeting) {
    const lead = leadCharacterIdOfRoom(input.greeting.roomId);
    // 该房间正在跑 agent 时，活动气泡优先，招呼让位（它本来就会自动过期）
    if (lead && !(lead in byCharacter)) {
      byCharacter[lead] = {
        kind: "greeting",
        speaker: SCENE_ROOMS[input.greeting.roomId]?.name,
        text: input.greeting.text,
      };
    }
  }

  if (input.chatter) {
    if (!(input.chatter.characterId in byCharacter)) {
      byCharacter[input.chatter.characterId] = {
        kind: "chatter",
        text: input.chatter.text,
      };
    }
  }

  return byCharacter;
}

export interface ChatterExchange {
  a: string;
  b: string;
  lines: [string, string];
}

/** 从房间对话池随机挑一组台词，并指派给房间内两个不同角色（不足两人时 A=B） */
export function pickChatterExchange(roomId: string): ChatterExchange | null {
  const room = SCENE_ROOMS[roomId];
  const chars = charactersInRoom(roomId);
  if (!room?.chatter?.length || chars.length === 0) return null;

  const lines = room.chatter[Math.floor(Math.random() * room.chatter.length)];
  const a = chars[Math.floor(Math.random() * chars.length)];
  const others = chars.filter(id => id !== a);
  const b =
    others.length > 0 ? others[Math.floor(Math.random() * others.length)] : a;
  return { a, b, lines };
}

/** Minimap 邻接走廊线段：ROOM_ADJACENCY 去重后的房间坐标对 */
export interface AdjacencySegment {
  a: [number, number];
  b: [number, number];
}

export function adjacencySegments(): AdjacencySegment[] {
  const segments: AdjacencySegment[] = [];
  for (const [roomId, neighbors] of Object.entries(ROOM_ADJACENCY)) {
    const from = SCENE_ROOMS[roomId]?.position;
    if (!from) continue;
    for (const neighborId of neighbors) {
      // 双向表去重：只收 id 字典序小的方向
      if (roomId >= neighborId) continue;
      const to = SCENE_ROOMS[neighborId]?.position;
      if (!to) continue;
      segments.push({
        a: [from[0], from[2]],
        b: [to[0], to[2]],
      });
    }
  }
  return segments;
}
