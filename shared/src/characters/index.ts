/**
 * 角色配置统一导出
 */

import type { CharacterConfig } from "../schemas/character";
import { coreConfig, corePrompt } from "./core";
import { builderConfig, builderPrompt } from "./builder";
import { aiConfig, aiPrompt } from "./ai";
import { writerConfig, writerPrompt } from "./writer";
import { readerConfig, readerPrompt } from "./reader";
import { visualConfig, visualPrompt } from "./visual";
import { wandererConfig, wandererPrompt } from "./wanderer";
import {
  buildCharacterPrompt,
  type PromptBuildOptions,
} from "./prompt-builder";

// 重新导出各个角色配置和提示词
export { coreConfig, corePrompt } from "./core";
export { builderConfig, builderPrompt } from "./builder";
export { aiConfig, aiPrompt } from "./ai";
export { writerConfig, writerPrompt } from "./writer";
export { readerConfig, readerPrompt } from "./reader";
export { visualConfig, visualPrompt } from "./visual";
export { wandererConfig, wandererPrompt } from "./wanderer";
export {
  buildCharacterPrompt,
  CHARACTER_PROMPT_FRAMEWORK_VERSION,
  type PromptBuildOptions,
  type PromptInteractionMode,
  type ResponseDepth,
  type ConsultableAgent,
} from "./prompt-builder";
export {
  FEZER_AGENT_IDS,
  ROOM_AGENT_IDS,
  isFezerType,
  resolveFezerTypeByCharacterId,
  resolveFezerTypeByRoomId,
  resolveFezerTypeFromSpatialContext,
} from "./agent-resolution";

/**
 * 所有角色配置映射
 */
export const CHARACTER_CONFIGS: Record<string, CharacterConfig> = {
  core: coreConfig,
  builder: builderConfig,
  ai: aiConfig,
  writer: writerConfig,
  reader: readerConfig,
  visual: visualConfig,
  wanderer: wandererConfig,
};

/**
 * 所有角色提示词映射
 */
export const CHARACTER_PROMPTS: Record<string, string> = {
  core: corePrompt,
  builder: builderPrompt,
  ai: aiPrompt,
  writer: writerPrompt,
  reader: readerPrompt,
  visual: visualPrompt,
  wanderer: wandererPrompt,
};

/**
 * 获取角色配置
 */
export function getCharacterConfig(fezerType: string): CharacterConfig {
  const config = CHARACTER_CONFIGS[fezerType];
  if (!config) {
    throw new Error(`Unknown character type: ${fezerType}`);
  }
  return config;
}

/**
 * 获取角色提示词
 */
export function getCharacterPrompt(
  fezerType: string,
  options?: PromptBuildOptions
): string {
  const config = CHARACTER_CONFIGS[fezerType];
  if (!config) {
    throw new Error(`Unknown character type: ${fezerType}`);
  }

  if (!options || Object.keys(options).length === 0) {
    return CHARACTER_PROMPTS[fezerType];
  }

  return buildCharacterPrompt(config, options);
}

/**
 * 统一的 Agent System Prompt 构建入口
 */
export function buildAgentSystemPrompt(
  fezerType: string,
  options?: PromptBuildOptions
): string {
  return getCharacterPrompt(fezerType, options);
}
