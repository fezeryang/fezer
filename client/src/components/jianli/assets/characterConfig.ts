import { MODEL_PATHS } from "./modelPaths"
import type { CharacterConfig } from "./types"
import type { Vec3 } from "./types"

// 角色统一缩放比例（原始尺寸的30%）
const CHARACTER_SCALE: Vec3 = [0.3, 0.3, 0.3]

// 辅助函数：创建角色配置
function createCharacter(
  id: string,
  model: string,
  position: Vec3,
  options?: Partial<Pick<CharacterConfig, "patrolRadius" | "walkSpeed" | "waitTime">>
): CharacterConfig {
  return {
    id,
    model,
    position,
    scale: CHARACTER_SCALE,
    patrolRadius: options?.patrolRadius ?? 1.5 + Math.random(),
    walkSpeed: options?.walkSpeed ?? 0.3 + Math.random() * 0.3,
    waitTime: options?.waitTime ?? 1000 + Math.random() * 2000,
  }
}

// 18个Fezer角色，分布在Central Hub区域内
// Central Hub中心在[0, 0, 0]，角色散布在周围
export const CHARACTERS: CharacterConfig[] = [
  // 内圈：靠近中心
  createCharacter("fezer-01", MODEL_PATHS.CHARACTER_A, [-2, 0, -1], { patrolRadius: 1.2 }),
  createCharacter("fezer-02", MODEL_PATHS.CHARACTER_B, [2, 0, -1], { patrolRadius: 1.5 }),
  createCharacter("fezer-03", MODEL_PATHS.CHARACTER_C, [0, 0, -2], { patrolRadius: 1.0 }),
  createCharacter("fezer-04", MODEL_PATHS.CHARACTER_D, [-1.5, 0, 1], { patrolRadius: 1.3 }),
  createCharacter("fezer-05", MODEL_PATHS.CHARACTER_E, [1.5, 0, 1], { patrolRadius: 1.4 }),

  // 中圈：稍远一些
  createCharacter("fezer-06", MODEL_PATHS.CHARACTER_F, [-3.5, 0, -2], { patrolRadius: 1.8 }),
  createCharacter("fezer-07", MODEL_PATHS.CHARACTER_G, [3.5, 0, -2], { patrolRadius: 1.6 }),
  createCharacter("fezer-08", MODEL_PATHS.CHARACTER_H, [-2.5, 0, 2], { patrolRadius: 2.0 }),
  createCharacter("fezer-09", MODEL_PATHS.CHARACTER_I, [2.5, 0, 2], { patrolRadius: 1.7 }),
  createCharacter("fezer-10", MODEL_PATHS.CHARACTER_J, [0, 0, 3.5], { patrolRadius: 1.5 }),
  createCharacter("fezer-11", MODEL_PATHS.CHARACTER_K, [-4, 0, 0], { patrolRadius: 1.9 }),
  createCharacter("fezer-12", MODEL_PATHS.CHARACTER_L, [4, 0, 0], { patrolRadius: 1.8 }),

  // 外圈：更分散
  createCharacter("fezer-13", MODEL_PATHS.CHARACTER_M, [-5, 0, -3], { patrolRadius: 2.2 }),
  createCharacter("fezer-14", MODEL_PATHS.CHARACTER_N, [5, 0, -3], { patrolRadius: 2.0 }),
  createCharacter("fezer-15", MODEL_PATHS.CHARACTER_O, [-4, 0, 4], { patrolRadius: 2.3 }),
  createCharacter("fezer-16", MODEL_PATHS.CHARACTER_P, [4, 0, 4], { patrolRadius: 2.1 }),
  createCharacter("fezer-17", MODEL_PATHS.CHARACTER_Q, [0, 0, -5], { patrolRadius: 1.8 }),
  createCharacter("fezer-18", MODEL_PATHS.CHARACTER_R, [-2, 0, 5], { patrolRadius: 2.4 }),
]

// 获取角色模型路径列表用于预加载
export const CHARACTER_MODELS = CHARACTERS.map(c => c.model)
