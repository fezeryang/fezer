/**
 * API 路由 - /api/chat
 * 通用代理交互入口
 */

import type { Request, Response } from "express";
import { orchestratorGraph } from "../agents/orchestrator/graph";
import type {
  FrontendAgentRequest,
  AgentResponse,
} from "@fezer/shared/schemas/agent";
import { runWithTraceContext, traceSpan } from "../_core/observability/langsmith";

/**
 * POST /api/chat
 * 通用代理交互入口
 */
export async function chatHandler(req: Request, res: Response): Promise<void> {
  try {
    await traceSpan("api.chat", async () => {
      const {
        userInput,
        roomId,
        characterId,
        interactionType = "chat",
        visitedRooms = [],
        discoveredCharacters = [],
      } = req.body as FrontendAgentRequest;

      await runWithTraceContext(
        {
          route: "/api/chat",
          interactionType,
          roomId,
          characterId,
          env: process.env.NODE_ENV || "development",
        },
        async () => {
          // 验证请求
          if (!userInput || typeof userInput !== "string") {
            res.status(400).json({ error: "Invalid userInput" });
            return;
          }

          // 调用编排器
          const result = await orchestratorGraph.invoke({
            userInput,
            roomId,
            characterId,
            interactionType: interactionType as
              | "click"
              | "hover"
              | "chat"
              | "guide",
            visitedRooms,
            discoveredCharacters,
            messages: [],
          });

          // 构建响应
          const response: AgentResponse = {
            text: result.answer,
            panel: result.uiAction.panel ?? "character",
            highlightCharacterId: result.uiAction.highlightCharacterId,
            focusRoomId: result.uiAction.focusRoomId,
            suggestedNextCharacterIds: result.uiAction.suggestedNextCharacterIds,
            suggestedQuestions: result.uiAction.suggestedQuestions,
            speakingAgentId: result.currentPrimaryAgent,
          };

          res.json(response);
        }
      );
    });
  } catch (error) {
    console.error("Chat API error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
