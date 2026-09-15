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

/** 投喂物品（D7）：会话内存情绪，3 分钟过期，可覆盖 */
export type FeedItem = "coffee" | "fish" | "book";
export type CharacterMood = FeedItem;

/** 每种物品的即时反应台词（挂在被投喂角色头上） */
export const MOOD_REACTIONS: Record<FeedItem, string[]> = {
  coffee: ["咕噜咕噜……今晚能再战三小时", "咖啡因注入完毕，精神！", "谢谢，正好在赶方案"],
  fish: ["鱼干！猫生满足，打个滚", "呜哇，最喜欢这个了", "饱了，今天的班值完了"],
  book: ["这本正好想看，划个重点先", "安静一会儿，让我想想", "书页里有答案，等我找找"],
};

/** 情绪期的闲聊台词池（50% 抽中概率，与房间池混抽）；导出仅供测试校验 */
export const MOOD_CHATTER: Record<FeedItem, Array<[string, string]>> = {
  coffee: [
    ["这杯咖啡绝了，思路全开了", "那你赶紧把那个方案写完"],
    ["今天状态特别好", "看出来了，你已经转了三圈了"],
  ],
  fish: [
    ["尾巴摇到停不下来", "刚才那条鱼干真香"],
    ["困了，趴一会儿", "睡吧，有人来了我叫你"],
  ],
  book: [
    ["这段写得真好，划个重点", "你划的比正文还多"],
    ["让我想想这个问题……", "想好了再告诉我"],
  ],
};

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
  /** 投喂反应（D7）：挂被投喂角色头上，优先级高于招呼与闲聊 */
  reaction?: { characterId: string; text: string };
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

  if (input.reaction) {
    if (!(input.reaction.characterId in byCharacter)) {
      byCharacter[input.reaction.characterId] = {
        kind: "chatter",
        text: input.reaction.text,
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

/** 闲聊调度间隔（ms）：咖啡情绪下频率翻倍，其余默认 */
export function chatterIntervals(mood?: CharacterMood): {
  firstDelay: () => number;
  nextRoundDelay: () => number;
} {
  const scale = mood === "coffee" ? 0.5 : 1;
  return {
    firstDelay: () => (4000 + Math.random() * 4000) * scale,
    nextRoundDelay: () => (9000 + Math.random() * 5000) * scale,
  };
}

export interface ChatterExchange {
  a: string;
  b: string;
  lines: [string, string];
}

/**
 * 从房间对话池随机挑一组台词，并指派给房间内两个不同角色（不足两人时 A=B）。
 * 有情绪时 50% 抽情绪池（咖啡=兴奋、鱼干=慵懒、书=专注），与房间池混抽。
 */
export function pickChatterExchange(
  roomId: string,
  mood?: CharacterMood
): ChatterExchange | null {
  const room = SCENE_ROOMS[roomId];
  const chars = charactersInRoom(roomId);
  if (!room?.chatter?.length || chars.length === 0) return null;

  const moodPool = mood ? MOOD_CHATTER[mood] : undefined;
  const useMood = moodPool && Math.random() < 0.5;
  const pool = useMood
    ? moodPool
    : (room.chatter as ReadonlyArray<[string, string]>);
  const lines = pool[Math.floor(Math.random() * pool.length)];

  const a = chars[Math.floor(Math.random() * chars.length)];
  const others = chars.filter(id => id !== a);
  const b =
    others.length > 0 ? others[Math.floor(Math.random() * others.length)] : a;
  return { a, b, lines: [lines[0], lines[1]] };
}

// ── 会议可视化（D6）────────────────────────────────────────

/** 会议圆半径：聊天房间中心外圈，不压房间内原有漫游区 */
const MEETING_RADIUS = 2.0;

/** 会议行进速度：漫游速度的 4-7 倍，否则跨房间（16-30 单位）走不到会就散了 */
export const MEETING_WALK_SPEED = 2.2;

/** 会议点位的 Y 恒为地面高度（与 Character 的 GROUND_Y 一致） */
const MEETING_GROUND_Y = 0;

/**
 * 多专家咨询时，被咨询房间的首席角色走到聊天房间“开会”。
 * 点位 = 聊天房间中心圆周上按 roomId 哈希稳定分配的扇区，避免叠在一起。
 * 全部由现有状态派生：agentBubbles 的房间（去掉聊天房间本身）× chatRoomId。
 */
export function buildMeetingTargets(
  chatRoomId: string | undefined,
  consultantRoomIds: string[]
): Record<string, [number, number, number]> {
  const targets: Record<string, [number, number, number]> = {};
  const center = chatRoomId ? SCENE_ROOMS[chatRoomId]?.position : undefined;
  if (!center) return targets;

  for (const roomId of consultantRoomIds) {
    if (roomId === chatRoomId) continue;
    const lead = leadCharacterIdOfRoom(roomId);
    if (!lead) continue;

    // 稳定角度：roomId 字符码和 → [0, 2π)。不同顾问房间基本落在不同扇区
    let hash = 0;
    for (let i = 0; i < roomId.length; i++) hash += roomId.charCodeAt(i);
    const angle = ((hash % 360) / 360) * Math.PI * 2;

    targets[lead] = [
      center[0] + Math.cos(angle) * MEETING_RADIUS,
      MEETING_GROUND_Y,
      center[2] + Math.sin(angle) * MEETING_RADIUS,
    ];
  }
  return targets;
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
