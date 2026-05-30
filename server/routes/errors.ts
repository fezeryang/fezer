import type { Response } from "express";
import { isLLMProviderConfigurationError } from "../_core/llm";

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

  if (isLLMProviderConfigurationError(error)) {
    res.status(503).json({
      error: "AI service unavailable",
      code: "AI_SERVICE_UNAVAILABLE",
      message: "AI 服务暂时不可用，请稍后再试。",
    });
    return;
  }

  res.status(500).json({
    error: "Internal server error",
    message: "服务器暂时无法完成请求，请稍后再试。",
  });
}
