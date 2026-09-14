/**
 * 运行控制通道（AsyncLocalStorage）
 *
 * harness 注入取消信号与循环预算，`llm.ts` 与专家层读取。
 * 与 run-events.ts（事件汇）、observability/langsmith.ts（trace 上下文）同属
 * 核心 ALS 基础设施，因此放在 _core：专家层向下依赖它，而不是反向 import harness。
 */

import { AsyncLocalStorage } from "node:async_hooks";

export interface RunControl {
  /** 取消信号：LLM 请求（经 AbortSignal.any 合并）与工具循环都响应它 */
  signal?: AbortSignal;
  /** 工具循环上限；未设置时沿用专家层的 MAX_TOOL_CALL_LOOPS */
  maxToolLoops?: number;
  /** 流式输出最终回答（SSE 路由打开）；未设置走非流式 */
  streamText?: boolean;
}

const runControlStorage = new AsyncLocalStorage<RunControl>();

export function runWithRunControl<T>(
  control: RunControl,
  fn: () => Promise<T>
): Promise<T> {
  return runControlStorage.run(control, fn);
}

/** 无控制上下文时返回空对象，调用方安全。 */
export function getRunControl(): RunControl {
  return runControlStorage.getStore() ?? {};
}

export function isRunAborted(): boolean {
  return getRunControl().signal?.aborted === true;
}

/**
 * 中止时抛出 name 为 "AbortError" 的错误，
 * 使上层（harness 的 toRunError）把它归类为 cancelled 而不是 provider 故障。
 */
export function assertRunNotAborted(): void {
  if (isRunAborted()) {
    throw new DOMException("本次请求已取消", "AbortError");
  }
}

/** 合并超时信号与运行取消信号；无取消信号时原样返回超时信号。 */
export function mergeAbortSignals(
  timeoutSignal: AbortSignal,
  cancelSignal?: AbortSignal
): AbortSignal {
  if (!cancelSignal) {
    return timeoutSignal;
  }
  return AbortSignal.any([timeoutSignal, cancelSignal]);
}
