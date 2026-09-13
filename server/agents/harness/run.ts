/**
 * Agent Harness 运行时入口
 *
 * 这是 agent 层对外的唯一入口：/api/chat 路由、3D 地图主动导览、后台任务与
 * 脚本都通过它调用，不直接 import orchestratorGraph。
 *
 * 本文件只做运行时该做的事：run 身份、事件、预算、错误分类。
 * 编排与工具逻辑仍在 orchestrator / supervisor / expert 三层里，harness 不重复实现。
 */

import { randomUUID } from "node:crypto";
import type { ConversationTurn, UiAction } from "@fezer/shared/schemas/agent";
import type {
  RunErrorCode,
  RunEvent,
  RunOutcome,
  RunUsage,
} from "@fezer/shared/schemas/run";
import { orchestratorGraph } from "../orchestrator/graph";
import type { AgentId } from "../tools/agent.tool";
import {
  runWithTraceContext,
  traceSpan,
} from "../../_core/observability/langsmith";
import { RunError, toRunError } from "./errors";
import { emitRunEvent, runWithEventSink, type RunEventSink } from "./events";

/** 调用方身份，用于观测与（未来的）权限判定。 */
export interface RunCaller {
  kind: "route" | "feature" | "cli";
  id: string;
}

export interface RunBudget {
  /** 工具循环上限。未设置时沿用专家层的 MAX_TOOL_CALL_LOOPS。 */
  maxTurns?: number;
  /** 单次 run 的 token 上限。未接入计量前不生效（见 A6）。 */
  maxTokens?: number;
  /** 墙钟上限，超时以 budget_exhausted 结束。 */
  maxWallClockMs?: number;
}

export interface RunRequest {
  input: string;
  /** 会话标识。缺省时本次 run 自成一个 thread（真实会话存储见 A5 / P3）。 */
  threadId?: string;
  roomId?: string;
  characterId?: string;
  interactionType?: "click" | "hover" | "chat" | "guide";
  grounding?: "public_profile";
  conversationHistory?: ConversationTurn[];
  visitedRooms?: string[];
  discoveredCharacters?: string[];
  budget?: RunBudget;
  /** 取消信号：触发后以 cancelled 结束。 */
  signal?: AbortSignal;
  caller?: RunCaller;
  /**
   * 事件实时回调（流式消费方用）。
   *
   * SSE 路由不能在 run 结束后才拿到事件，必须边产生边写；非流式调用方
   * 忽略它，直接读 RunResult.events。
   */
  onEvent?: RunEventSink;
}

export interface RunResult {
  runId: string;
  threadId: string;
  answer: string;
  speakingAgent: AgentId;
  uiAction?: UiAction;
  usage: RunUsage;
  /** 本次 run 产生的事件，按序排列，末条必为终止事件。 */
  events: RunEvent[];
}

export const DEFAULT_MAX_WALL_CLOCK_MS = 60_000;

/**
 * 解析墙钟上限。
 *
 * 默认**不设限**：A4 之前无法真正中断已在飞行的请求，单方面超时会把「马上就要回来的
 * 答案」变成失败，同时让那次 LLM 调用继续燃烧 token。所以预算由调用方显式开启，
 * 等 A4 把 signal 接到 invokeLLM 后再由路由默认打开。
 */
export function resolveWallClockLimit(budget?: RunBudget): number | undefined {
  return budget?.maxWallClockMs;
}

/**
 * ponytail: 计量目前只填可测的 wallClockMs，token / 工具计数等仍为 0 ——
 * A6（观测与计量）接上 invokeLLM 的 usage 之前，调用方不应把这些 0 当成真实用量。
 */
const UNMEASURED_USAGE: Omit<RunUsage, "wallClockMs"> = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  toolCalls: 0,
  providerFallbacks: 0,
};

/**
 * 墙钟 / 取消守卫。
 *
 * ponytail: 只做“停止等待”，不会中断已在飞行的 LLM 请求（真正的中断在 A4 做，
 * 需要把 signal 一路传到 invokeLLM）。当前实现下超时后那次请求会自行结束并被丢弃。
 */
function createStopGuard(
  maxWallClockMs: number | undefined,
  signal?: AbortSignal
): { promise: Promise<never>; dispose: () => void } | null {
  if (maxWallClockMs === undefined && !signal) {
    return null;
  }

  let dispose = () => {};

  const promise = new Promise<never>((_, reject) => {
    const onTimeout = () =>
      reject(
        new RunError(
          "budget_exhausted",
          `本次运行超过 ${maxWallClockMs}ms 墙钟预算`
        )
      );
    const onAbort = () => reject(new RunError("cancelled", "本次请求已取消"));

    const timer =
      maxWallClockMs === undefined
        ? undefined
        : setTimeout(onTimeout, maxWallClockMs);
    if (timer && typeof timer.unref === "function") {
      timer.unref();
    }

    if (signal) {
      if (signal.aborted) {
        onAbort();
      } else {
        signal.addEventListener("abort", onAbort, { once: true });
      }
    }

    dispose = () => {
      if (timer) {
        clearTimeout(timer);
      }
      signal?.removeEventListener("abort", onAbort);
    };
  });

  return { promise, dispose };
}

/**
 * 执行一次 agent run。
 *
 * 失败时先发 `run.error` 再抛 RunError，保证流式消费方一定能收到终止事件。
 */
export async function runAgent(request: RunRequest): Promise<RunResult> {
  const runId = randomUUID();
  const threadId = request.threadId ?? runId;
  const events: RunEvent[] = [];
  const sink: RunEventSink = event => {
    events.push(event);
    request.onEvent?.(event);
  };

  const startedAt = Date.now();
  const guard = createStopGuard(
    resolveWallClockLimit(request.budget),
    request.signal
  );

  const emitError = (code: RunErrorCode, message: string): void => {
    emitRunEvent({ type: "run.error", runId, code, message });
  };

  return runWithEventSink(sink, () =>
    runWithTraceContext(
      {
        route: request.caller?.id ?? "harness.runAgent",
        interactionType: request.interactionType,
        roomId: request.roomId,
        characterId: request.characterId,
        env: process.env.NODE_ENV || "development",
      },
      async () => {
        emitRunEvent({ type: "run.started", runId, threadId });

        let result: Awaited<ReturnType<typeof orchestratorGraph.invoke>>;
        try {
          const invocation = traceSpan("harness.runAgent", () =>
            orchestratorGraph.invoke({
              userInput: request.input,
              roomId: request.roomId,
              characterId: request.characterId,
              interactionType: request.interactionType ?? "chat",
              grounding: request.grounding,
              conversationHistory: request.conversationHistory ?? [],
              visitedRooms: request.visitedRooms ?? [],
              discoveredCharacters: request.discoveredCharacters ?? [],
              messages: [],
            })
          );

          result = guard
            ? await Promise.race([invocation, guard.promise])
            : await invocation;
        } catch (error) {
          guard?.dispose();
          const runError = toRunError(error);
          emitError(runError.code, runError.message);
          throw runError;
        }
        guard?.dispose();

        const usage: RunUsage = {
          ...UNMEASURED_USAGE,
          wallClockMs: Date.now() - startedAt,
        };
        const speakingAgent = (result.currentPrimaryAgent ?? "core") as AgentId;
        const outcome: RunOutcome = { type: "success" };

        emitRunEvent({
          type: "run.finished",
          runId,
          outcome,
          usage,
          answer: result.answer,
          uiAction: result.uiAction,
        });

        return {
          runId,
          threadId,
          answer: result.answer,
          speakingAgent,
          uiAction: result.uiAction,
          usage,
          events,
        };
      }
    )
  );
}
