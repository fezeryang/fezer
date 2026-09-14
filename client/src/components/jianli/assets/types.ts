import type { SceneBubble } from "@/lib/scene-bubbles";

export type FezerType =
  | "core"
  | "builder"
  | "ai"
  | "writer"
  | "reader"
  | "visual"
  | "wanderer";

export type Vec3 = [number, number, number];

export interface TransformConfig {
  id: string;
  model: string;
  position: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
}

export interface RoomConfig extends TransformConfig {
  name: string;
  description: string;
  fezerType: FezerType;
  accent: string;
  summary: string;
  highlights: string[];
  /** 环境闲聊对话池：[A 台词, B 台词]，房间内两个角色轮流说（纯客户端，零 LLM） */
  chatter: Array<[string, string]>;
}

export interface SceneModuleConfig extends TransformConfig {
  kind: "corridor" | "structure";
}

export interface ModelInstanceProps {
  config: TransformConfig;
  onClick?: (id: string) => void;
  /** 指针悬停状态回调（房间用：悬停时切换光标为手型） */
  onHoverChange?: (hovered: boolean) => void;
}

export interface RoomProps {
  config: RoomConfig;
  onClick?: (roomId: string) => void;
}

// 角色相关类型
export type CharacterState = "idle" | "walking" | "waiting";

export interface CharacterConfig {
  id: string;
  model: string;
  position: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  patrolRadius?: number; // 巡逻半径
  walkSpeed?: number; // 行走速度
  waitTime?: number; // 等待时间(ms)
}

export interface CharacterProps {
  config: CharacterConfig;
  onClick?: (id: string) => void;
  /** 头顶气泡（D1）；缺省时不渲染 Html，零 DOM 成本 */
  bubble?: SceneBubble;
  /** 仅 greeting 气泡使用的操作回调 */
  bubbleActions?: { onChat?: () => void; onDismiss?: () => void };
}
