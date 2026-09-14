/**
 * 3D 场景加载进度（B8）
 *
 * 用 drei 的 useProgress（全局 store，可在 Canvas 之外使用）读取 GLTF 加载进度，
 * 替换掉纯文字「正在加载…」——3D 简历首屏要下 7MB 模型，没有进度条会显得卡死。
 */

import { useProgress } from "@react-three/drei";

export function SceneLoadingFallback() {
  const { active, progress } = useProgress();
  const percent = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-3 bg-slate-200 text-sm text-slate-600"
      role="status"
      aria-live="polite"
    >
      <p>正在加载 3D 场景…</p>
      <div className="h-1 w-44 overflow-hidden rounded-full bg-slate-300">
        <div
          className="h-full bg-slate-700 transition-[width] duration-200 motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-slate-500">
        {active ? `${percent}%` : "资产准备中"}
      </p>
    </div>
  );
}
