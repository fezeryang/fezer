/**
 * ThinkingIndicator - Agent 思考状态指示器
 * 显示 Agent 正在处理请求时的动画和状态信息
 */

import { LoadingAnimation } from "./LoadingAnimation";

interface ThinkingIndicatorProps {
  agentName: string;
  agentColor: string;
  thinkingStep?: string;
  className?: string;
}

/**
 * Agent 思考指示器组件
 *
 * 显示：
 * - Lottie 加载动画
 * - Agent 名称和头像颜色
 * - 当前思考步骤（可选）
 */
export function ThinkingIndicator({
  agentName,
  agentColor,
  thinkingStep,
  className = "",
}: ThinkingIndicatorProps) {
  return (
    <div className={`flex justify-start ${className}`}>
      <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
        <div className="flex items-center gap-3">
          {/* Lottie 动画 */}
          <LoadingAnimation size={40} />

          {/* 文本信息 */}
          <div className="min-w-0">
            <p
              className="text-sm font-medium"
              style={{ color: agentColor }}
            >
              {agentName} 正在思考...
            </p>
            {thinkingStep && (
              <p className="text-xs text-gray-500 mt-0.5">
                {thinkingStep}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
