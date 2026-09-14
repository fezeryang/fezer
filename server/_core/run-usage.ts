/**
 * 运行计量累加器（A6）
 *
 * invokeLLM 一直返回 usage，但在此之前全库无人读取 —— RunUsage 里的 token 数
 * 一直是 0 占位。这里用 ALS 把一次 run 内所有 LLM 调用与工具调用的计量汇聚起来，
 * 由 harness 写进 RunResult / run.finished。
 *
 * 与 run-events / run-control 同族：核心基础设施，放在 _core 供下层向上读取。
 */

import { AsyncLocalStorage } from "node:async_hooks";

export interface RunUsageAccumulator {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  toolCalls: number;
  providerFallbacks: number;
}

const usageStorage = new AsyncLocalStorage<RunUsageAccumulator>();

function createAccumulator(): RunUsageAccumulator {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    toolCalls: 0,
    providerFallbacks: 0,
  };
}

/**
 * 在计量上下文中执行，返回结果与累计用量。
 * 无上下文时（例如直接调用专家层）记录函数是安全空操作。
 */
export async function runWithUsageTracking<T>(
  fn: () => Promise<T>
): Promise<{ result: T; usage: RunUsageAccumulator }> {
  const accumulator = createAccumulator();
  const result = await usageStorage.run(accumulator, fn);
  return { result, usage: accumulator };
}

export function recordLlmUsage(
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
): void {
  const accumulator = usageStorage.getStore();
  if (!accumulator || !usage) {
    return;
  }

  accumulator.promptTokens += usage.prompt_tokens;
  accumulator.completionTokens += usage.completion_tokens;
  accumulator.totalTokens += usage.total_tokens;
}

export function recordToolCall(count = 1): void {
  const accumulator = usageStorage.getStore();
  if (!accumulator) {
    return;
  }
  accumulator.toolCalls += count;
}

export function recordProviderFallback(): void {
  const accumulator = usageStorage.getStore();
  if (!accumulator) {
    return;
  }
  accumulator.providerFallbacks += 1;
}
