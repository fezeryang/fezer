/**
 * SpeechBubble - 3D 角色头顶气泡（D1）
 *
 * 渲染在 drei Html 内（由 Character 挂载），按 kind 区分形态：
 * - greeting：房间招呼 + 操作按钮（C1 从左下角卡片迁移而来）
 * - thinking：说话者 + 三点跳动
 * - speaking：截断的流式文本 + 光标（真实 text.delta）
 * - done：✓ 已回应
 * - chatter：无名角色的环境闲聊，无 speaker
 *
 * 入场动画见 styles/transitions.css 的 .t-bubble；reduced-motion 下直接显示。
 */

import type { SceneBubble } from "@/lib/scene-bubbles";

interface SpeechBubbleProps {
  bubble: SceneBubble;
  /** 仅 greeting 使用：点击「聊聊」 */
  onChat?: () => void;
  /** 仅 greeting 使用：点击「不再自动出现」 */
  onDismiss?: () => void;
}

export function SpeechBubble({ bubble, onChat, onDismiss }: SpeechBubbleProps) {
  return (
    <div
      className="t-bubble w-max max-w-[220px] rounded-2xl border border-slate-900/10 bg-slate-50/95 px-3 py-2 shadow-[0_10px_36px_rgba(15,23,42,0.16)] backdrop-blur-sm"
      data-kind={bubble.kind}
    >
      {bubble.speaker && (
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          {bubble.speaker}
        </p>
      )}

      {bubble.kind === "thinking" ? (
        <div className="flex items-center gap-2 py-0.5">
          <span className="flex gap-1">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 motion-reduce:animate-none"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </span>
          <span className="text-xs text-slate-600">{bubble.text}</span>
        </div>
      ) : bubble.kind === "done" ? (
        <p className="py-0.5 text-xs text-emerald-600">
          <span aria-hidden>✓ </span>
          {bubble.text}
        </p>
      ) : (
        <p className="whitespace-pre-wrap py-0.5 text-xs leading-5 text-slate-700">
          {bubble.text}
          {bubble.kind === "speaking" && (
            <span className="animate-pulse motion-reduce:animate-none">▍</span>
          )}
        </p>
      )}

      {bubble.kind === "greeting" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onChat}
            className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] text-white hover:bg-slate-800"
          >
            聊聊这个房间
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="text-[11px] text-slate-500 hover:text-slate-800"
          >
            不再自动出现
          </button>
        </div>
      )}
    </div>
  );
}
