import { MODEL_PATHS } from "./modelPaths";
import type { CharacterConfig } from "./types";
import type { Vec3 } from "./types";

// 角色统一缩放比例（原始尺寸的30%）
const CHARACTER_SCALE: Vec3 = [0.3, 0.3, 0.3];

// 辅助函数：创建角色配置
function createCharacter(
  id: string,
  model: string,
  position: Vec3,
  options?: Partial<
    Pick<CharacterConfig, "patrolRadius" | "walkSpeed" | "waitTime">
  >
): CharacterConfig {
  return {
    id,
    model,
    position,
    scale: CHARACTER_SCALE,
    patrolRadius: options?.patrolRadius ?? 1.2 + Math.random() * 0.8,
    walkSpeed: options?.walkSpeed ?? 0.3 + Math.random() * 0.3,
    waitTime: options?.waitTime ?? 1000 + Math.random() * 2000,
  };
}

// 18个Fezer角色，分布在不同房间中
// 房间位置参考 roomsConfig.ts
export const CHARACTERS: CharacterConfig[] = [
  // ========== Central Hub (中心大厅) - 3个角色 ==========
  createCharacter("fezer-01", MODEL_PATHS.CHARACTER_A, [-2, 0, -1], {
    patrolRadius: 1.5,
  }),
  createCharacter("fezer-02", MODEL_PATHS.CHARACTER_B, [2, 0, -1], {
    patrolRadius: 1.3,
  }),
  createCharacter("fezer-03", MODEL_PATHS.CHARACTER_C, [0, 0, -2], {
    patrolRadius: 1.2,
  }),

  // ========== Builder Room (-16, 0, -1) - 2个角色 ==========
  createCharacter("fezer-04", MODEL_PATHS.CHARACTER_D, [-17, 0, -2], {
    patrolRadius: 1.0,
  }),
  createCharacter("fezer-05", MODEL_PATHS.CHARACTER_E, [-15, 0, 0], {
    patrolRadius: 1.2,
  }),

  // ========== AI Lab (0, 0, -16) - 3个角色 ==========
  createCharacter("fezer-06", MODEL_PATHS.CHARACTER_F, [-1, 0, -17], {
    patrolRadius: 1.4,
  }),
  createCharacter("fezer-07", MODEL_PATHS.CHARACTER_G, [1, 0, -15], {
    patrolRadius: 1.3,
  }),
  createCharacter("fezer-08", MODEL_PATHS.CHARACTER_H, [0, 0, -16], {
    patrolRadius: 1.5,
  }),

  // ========== Writer Room (16, 0, -1) - 2个角色 ==========
  createCharacter("fezer-09", MODEL_PATHS.CHARACTER_I, [15, 0, -2], {
    patrolRadius: 1.1,
  }),
  createCharacter("fezer-10", MODEL_PATHS.CHARACTER_J, [17, 0, 0], {
    patrolRadius: 1.3,
  }),

  // ========== Reader Nook (-17, 0, -16) - 2个角色 ==========
  createCharacter("fezer-11", MODEL_PATHS.CHARACTER_K, [-18, 0, -17], {
    patrolRadius: 1.0,
  }),
  createCharacter("fezer-12", MODEL_PATHS.CHARACTER_L, [-16, 0, -15], {
    patrolRadius: 1.2,
  }),

  // ========== Visual Studio (0, 0, -30) - 3个角色 ==========
  createCharacter("fezer-13", MODEL_PATHS.CHARACTER_M, [-1, 0, -31], {
    patrolRadius: 1.4,
  }),
  createCharacter("fezer-14", MODEL_PATHS.CHARACTER_N, [1, 0, -29], {
    patrolRadius: 1.3,
  }),
  createCharacter("fezer-15", MODEL_PATHS.CHARACTER_O, [0, 0, -30], {
    patrolRadius: 1.5,
  }),

  // ========== Wanderer Base (17, 0, -16) - 3个角色 ==========
  createCharacter("fezer-16", MODEL_PATHS.CHARACTER_P, [16, 0, -17], {
    patrolRadius: 1.4,
  }),
  createCharacter("fezer-17", MODEL_PATHS.CHARACTER_Q, [18, 0, -15], {
    patrolRadius: 1.3,
  }),
  createCharacter("fezer-18", MODEL_PATHS.CHARACTER_R, [17, 0, -16], {
    patrolRadius: 1.5,
  }),
];

// 获取角色模型路径列表用于预加载
export const CHARACTER_MODELS = CHARACTERS.map(c => c.model);
