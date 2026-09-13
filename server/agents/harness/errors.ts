/**
 * Harness 层错误
 *
 * 唯一的职责是把任意异常收敛成面向调用方的分类（RunErrorCode），
 * 路由 / 地图 / CLI 据此决定 HTTP 状态码或是否重试。
 */

import type { RunErrorCode } from "@fezer/shared/schemas/run";
import { isLLMProviderConfigurationError } from "../../_core/llm";

export class RunError extends Error {
  readonly code: RunErrorCode;

  constructor(code: RunErrorCode, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "RunError";
    this.code = code;
  }
}

export function isRunError(error: unknown): error is RunError {
  return error instanceof RunError;
}

function isNamedError(error: unknown, name: string): boolean {
  return (
    error instanceof Error &&
    (error.name === name || error.constructor.name === name)
  );
}

/**
 * 把任意异常收敛成 RunError。
 *
 * AbortError 与 TimeoutError 分开处理：前者是我们自己的 signal 被触发（用户取消），
 * 后者是 provider 没在超时内应答（属于 provider 不可用）。
 */
export function toRunError(error: unknown): RunError {
  if (isRunError(error)) {
    return error;
  }

  if (isNamedError(error, "AbortError")) {
    return new RunError("cancelled", "本次请求已取消", error);
  }

  if (
    isLLMProviderConfigurationError(error) ||
    isNamedError(error, "TimeoutError")
  ) {
    return new RunError("provider_unavailable", "AI 服务暂时不可用", error);
  }

  const message = error instanceof Error ? error.message : String(error);
  return new RunError("internal", message || "未知错误", error);
}
