/**
 * API 路由 - /api/guide
 * 导览/定向端点，强制使用 core 代理
 */

import type { Request, Response } from "express";
import { orchestratorGraph } from "../agents/orchestrator/graph";
import type { AgentResponse } from "@fezer/shared/schemas/agent";
import { runWithTraceContext, traceSpan } from "../_core/observability/langsmith";

/**
 * POST /api/guide
 * 导览端点，Core Fezer 响应
 */
export async function guideHandler(req: Request, res: Response): Promise<void> {
  try {
    await traceSpan("api.guide", async () => {
      const { userInput = "请为我介绍一下这里" } = req.body;

      await runWithTraceContext(
        {
          route: "/api/guide",
          interactionType: "guide",
          env: process.env.NODE_ENV || "development",
        },
        async () => {
          // 强制使用 core 代理
          const result = await orchestratorGraph.invoke({
            userInput,
            interactionType: "guide" as const,
            messages: [],
          });

          const response: AgentResponse = {
            text: result.answer,
            panel: "guide",
            suggestedQuestions: result.uiAction.suggestedQuestions,
            speakingAgentId: "core",
          };

          res.json(response);
        }
      );
    });
  } catch (error) {
    console.error("Guide API error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
