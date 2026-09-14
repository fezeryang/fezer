/**
 * Agent Harness 运行时事件契约
 *
 * harness 对外只有这一份事件协议：/api/chat 的 SSE 映射、3D 地图的
 * 主动导览、后台任务与 CLI 都消费同一份类型，避免多处漂移。
 *
 * 不变量：
 * - `at` 是毫秒时间戳（number），不是 Date —— 保证 JSON 无损序列化
 * - `run.finished` / `run.error` 是终止事件，之后不得再发（见 isTerminalRunEvent）
 */

import type { UiAction } from "./agent";
import type { FezerType } from "./character";

/**
 * 一次 run 的结束原因。
 *
 * `interrupt` 为工具审批 / 需要澄清预留：暂停的 run 会携带它结束，
 * 调用方补齐信息后按同一 threadId 发起新 run 继续。
 */
export type RunOutcome =
  | { type: "success" }
  | { type: "budget_exhausted"; limit: "turns" | "tokens" | "wall_clock" }
  | { type: "cancelled" }
  | { type: "interrupt"; reason: string };

/**
 * 一次 run 的计量。`usage` 一直存在于 LLM 响应里，但在此之前无人读取。
 */
export interface RunUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  toolCalls: number;
  providerFallbacks: number;
  wallClockMs: number;
}

/**
 * 面向调用方的错误分类。路由据此映射 HTTP 状态码，客户端据此决定是否可重试。
 */
export type RunErrorCode =
  | "provider_unavailable"
  | "budget_exhausted"
  | "cancelled"
  | "invalid_input"
  | "internal";

/**
 * Run 生命周期事件。
 *
 * 顺序约定：`run.started` 必为首个事件，`run.finished` / `run.error` 必为最后一个；
 * `step.*` 由编排图的节点产出，`agent.*` / `tool.*` / `text.delta` 由专家层产出。
 */
export type RunEvent =
  | { type: "run.started"; runId: string; threadId: string; at: number }
  | { type: "step.started"; stepName: string; at: number }
  | { type: "step.finished"; stepName: string; at: number }
  | {
      type: "agent.start";
      agentId: FezerType;
      displayName: string;
      at: number;
    }
  | { type: "agent.done"; agentId: FezerType; at: number }
  | { type: "tool.call"; toolName: string; args: unknown; at: number }
  | {
      type: "tool.result";
      toolName: string;
      ok: boolean;
      /** 结果被上下文预算截断时为 true —— 截断必须是显式信息，不能静默发生 */
      truncated: boolean;
      bytes: number;
      at: number;
    }
  | { type: "text.delta"; messageId: string; delta: string; at: number }
  | {
      type: "run.finished";
      runId: string;
      /** 实际生成回答的 agent（多专家运行下为综合者）；客户端做消息归因 */
      speakingAgentId?: FezerType;
      outcome: RunOutcome;
      usage: RunUsage;
      answer: string;
      uiAction?: UiAction;
      at: number;
    }
  | {
      type: "run.error";
      runId: string;
      code: RunErrorCode;
      message: string;
      at: number;
    };

/** 事件类型字面量联合，便于按类型建表（如 SSE 事件名、监控指标）。 */
export type RunEventType = RunEvent["type"];

/**
 * 终止事件判定：SSE 写入方与客户端都用它决定何时停止读取。
 */
export function isTerminalRunEvent(event: RunEvent): boolean {
  return event.type === "run.finished" || event.type === "run.error";
}
