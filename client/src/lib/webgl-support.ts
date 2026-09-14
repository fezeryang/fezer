/**
 * WebGL 可用性检测（B8）
 *
 * 低端设备、禁用硬件加速的浏览器、部分企业策略下 WebGL 不可用 ——
 * 3D 场景会白屏。检测结果用于降级为可读的内容页，而不是让访客对着空白发呆。
 *
 * 结果缓存：同一会话内不必重复建 context（建 context 有成本，且数量有上限）。
 */

let cached: boolean | null = null;

export function isWebGLAvailable(): boolean {
  if (cached !== null) {
    return cached;
  }

  cached = detectWebGL();
  return cached;
}

function detectWebGL(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");
    const context =
      canvas.getContext("webgl2") ??
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl");

    return Boolean(context);
  } catch {
    return false;
  }
}

/** 仅测试用：清空缓存 */
export function resetWebGLAvailabilityCache(): void {
  cached = null;
}
