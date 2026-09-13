import type { FezerType } from "../schemas/character";
import { coreConfig } from "./core";
import { builderConfig } from "./builder";
import { aiConfig } from "./ai";
import { writerConfig } from "./writer";
import { readerConfig } from "./reader";
import { visualConfig } from "./visual";
import { wandererConfig } from "./wanderer";

/**
 * agent id → 用户可见显示名的唯一事实来源。
 * 值取自各角色 config 的 displayName，避免在客户端、服务端、提示词层各自维护副本。
 */
export const AGENT_DISPLAY_NAMES: Record<FezerType, string> = {
  core: coreConfig.displayName,
  builder: builderConfig.displayName,
  ai: aiConfig.displayName,
  writer: writerConfig.displayName,
  reader: readerConfig.displayName,
  visual: visualConfig.displayName,
  wanderer: wandererConfig.displayName,
};
