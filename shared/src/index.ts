/**
 * shared/src 统一导出
 * 前后端共享的 AI 相关配置和类型
 */

// 导出类型
export * from "./schemas";

// 导出角色配置和提示词
export {
  CHARACTER_CONFIGS,
  CHARACTER_PROMPTS,
  buildAgentSystemPrompt,
  buildCharacterPrompt,
  getCharacterConfig,
  getCharacterPrompt,
} from "./characters";

// 导出角色单独配置
export {
  coreConfig,
  builderConfig,
  aiConfig,
  writerConfig,
  readerConfig,
  visualConfig,
  wandererConfig,
  corePrompt,
  builderPrompt,
  aiPrompt,
  writerPrompt,
  readerPrompt,
  visualPrompt,
  wandererPrompt,
} from "./characters";

// 导出地图配置
export {
  ROOMS,
  ROOM_ADJACENCY,
  getRoomInfo,
  getAdjacentRooms,
} from "./map/rooms";

// 导出简历数据
export {
  PROFILE,
  SKILLS,
  EXPERIENCE,
  EDUCATION,
  INTERESTS,
} from "./resume/profile";
