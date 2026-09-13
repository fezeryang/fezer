/**
 * Harness 事件汇
 *
 * 专家层跑在编排图的单个节点内部，`streamEvents()` 只能给到节点级事件，
 * 拿不到 `tool.*` / `text.delta`。所以工具循环通过这里的 ALS 事件汇直接发事件，
 * 不需要把回调沿着 orchestrator → supervisor → expert 四层签名传递。
 *
 * 与项目已有的两个 AsyncLocalStorage 模式一致（tools/agent.tool.ts 的调用方上下文、
 * observability/langsmith.ts 的 trace 上下文）。
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { RunEvent } from "@fezer/shared/schemas/run";

export type RunEventSink = (event: RunEvent) => void;

const eventSinkStorage = new AsyncLocalStorage<RunEventSink>();

/** 分发性 Omit —— 普通 Omit 会把判别联合压平成一个只剩公共键的对象类型。 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

/** emitRunEvent 入参：`at` 可省略，由事件汇补上当前时间戳。 */
export type RunEventInput = DistributiveOmit<RunEvent, "at"> & { at?: number };

/** 在指定事件汇内执行。嵌套调用会覆盖外层汇，并行分支互不串扰。 */
export function runWithEventSink<T>(
  sink: RunEventSink,
  fn: () => Promise<T>
): Promise<T> {
  return eventSinkStorage.run(sink, fn);
}

/**
 * 发送一个事件。
 *
 * 没有事件汇时静默跳过（例如 route 仍直连 orchestrator 的过渡期），
 * 因此可以安全地放在任何执行路径上。
 */
export function emitRunEvent(input: RunEventInput): void {
  const sink = eventSinkStorage.getStore();
  if (!sink) {
    return;
  }

  sink({ ...input, at: input.at ?? Date.now() });
}
