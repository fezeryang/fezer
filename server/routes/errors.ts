/**
 * Agent 路由的错误出口
 *
 * 把 harness 的分类错误（RunError）映射成稳定的 HTTP 信封。
 * 映射是封闭联合上的全覆盖：新增 RunErrorCode 时 Record 会强制这里同步补齐。
 */

import type { Response } from "express";
import type { RunErrorCode } from "@fezer/shared/schemas/run";
import { isLLMProviderConfigurationError } from "../_core/llm";
import { isRunError } from "../agents/harness/errors";

interface ErrorEnvelope {
  status: number;
  body: Record<string, unknown>;
}

const RUN_ERROR_ENVELOPES: Record<RunErrorCode, ErrorEnvelope> = {
  provider_unavailable: {
    status: 503,
    body: {
      error: "AI service unavailable",
      code: "AI_SERVICE_UNAVAILABLE",
      message: "AI 服务暂时不可用，请稍后再试。",
    },
  },
  budget_exhausted: {
    status: 504,
    body: {
      error: "Agent run budget exhausted",
      code: "AGENT_RUN_BUDGET_EXHAUSTED",
      message: "本次回答超出时间预算，请重试或把问题问得更具体。",
    },
  },
  cancelled: {
    status: 499,
    body: {
      error: "Agent run cancelled",
      code: "AGENT_RUN_CANCELLED",
      message: "请求已取消。",
    },
  },
  invalid_input: {
    status: 400,
    body: {
      error: "Invalid input",
      code: "INVALID_INPUT",
      message: "请输入有效的问题。",
    },
  },
  internal: {
    status: 500,
    body: {
      error: "Internal server error",
      message: "服务器暂时无法完成请求，请稍后再试。",
    },
  },
};

export function sendAgentRouteError(
  res: Response,
  routeName: string,
  error: unknown
): void {
  const errorType = error instanceof Error ? error.name : typeof error;
  const message = error instanceof Error ? error.message : String(error);

  console.error(`${routeName} API error:`, {
    errorType,
    message,
  });

  if (isRunError(error)) {
    const envelope = RUN_ERROR_ENVELOPES[error.code];
    res.status(envelope.status).json(envelope.body);
    return;
  }

  // 未经过 harness 的直接调用方（例如旧路径或测试）仍可能抛原始错误
  if (isLLMProviderConfigurationError(error)) {
    res.status(503).json(RUN_ERROR_ENVELOPES.provider_unavailable.body);
    return;
  }

  res.status(500).json(RUN_ERROR_ENVELOPES.internal.body);
}
