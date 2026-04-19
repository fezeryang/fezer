/**
 * API 路由 - /api/character
 * 角色直接交互端点
 */

import type { Request, Response } from "express";
import { orchestratorGraph } from "../agents/orchestrator/graph";
import type { AgentResponse } from "@fezer/shared/schemas/agent";
import { runWithTraceContext, traceSpan } from "../_core/observability/langsmith";

/**
 * POST /api/character
 * 角色直接交互
 */
export async function characterHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    await traceSpan("api.character", async () => {
      const { characterId, userInput = "你好！" } = req.body;

      await runWithTraceContext(
        {
          route: "/api/character",
          interactionType: "click",
          characterId,
          env: process.env.NODE_ENV || "development",
        },
        async () => {
          if (!characterId) {
            res.status(400).json({ error: "characterId is required" });
            return;
          }

          // 直接角色交互
          const result = await orchestratorGraph.invoke({
            userInput,
            characterId,
            interactionType: "click" as const,
            messages: [],
          });

          const response: AgentResponse = {
            text: result.answer,
            panel: "character",
            highlightCharacterId: characterId as any,
            speakingAgentId: result.currentPrimaryAgent,
          };

          res.json(response);
        }
      );
    });
  } catch (error) {
    console.error("Character API error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
