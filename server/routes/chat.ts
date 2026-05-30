/**
 * @fileoverview API 路由 - /api/chat
 * @description 通用代理交互入口，处理用户对话请求并返回 Agent 响应
 * @author Fezer
 * @created 2026-04-19
 */

import type { Request, Response } from "express";
import { orchestratorGraph } from "../agents/orchestrator/graph";
import type {
  FrontendAgentRequest,
  AgentResponse,
} from "@fezer/shared/schemas/agent";
import {
  runWithTraceContext,
  traceSpan,
} from "../_core/observability/langsmith";
import {
  sendE2eAgentResponse,
  shouldUseE2eAgentMock,
  toE2eFezerType,
} from "./e2e-mock";

/**
 * POST /api/chat
 * 通用代理交互入口
 *
 * 接收用户的对话请求，通过编排器路由到合适的 Agent，
 * 返回响应文本和 UI 操作指令。
 *
 * @param req - Express 请求对象
 * @param res - Express 响应对象
 *
 * @example
 * ```bash
 * curl -X POST http://localhost:3000/api/chat \
 *   -H "Content-Type: application/json" \
 *   -d '{"userInput":"你好"}'
 * ```
 */
export async function chatHandler(req: Request, res: Response): Promise<void> {
  try {
    if (shouldUseE2eAgentMock()) {
      const { characterId } = req.body as FrontendAgentRequest;
      sendE2eAgentResponse(res, {
        highlightCharacterId: toE2eFezerType(characterId),
      });
      return;
    }

    // 使用 LangSmith 追踪整个请求处理过程
    await traceSpan("api.chat", async () => {
      // 从请求体中解构参数
      const {
        userInput, // 用户输入的消息文本
        roomId, // 当前所在房间 ID
        characterId, // 点击的角色 ID
        interactionType = "chat", // 交互类型：click/hover/chat/guide
        visitedRooms = [], // 已访问的房间列表
        discoveredCharacters = [], // 已发现的角色列表
      } = req.body as FrontendAgentRequest;

      // 在追踪上下文中处理请求
      await runWithTraceContext(
        {
          route: "/api/chat",
          interactionType,
          roomId,
          characterId,
          env: process.env.NODE_ENV || "development",
        },
        async () => {
          // 验证请求参数
          if (!userInput || typeof userInput !== "string") {
            res.status(400).json({ error: "Invalid userInput" });
            return;
          }

          // 调用编排器处理请求
          // 编排器会根据上下文将请求路由到合适的 Agent
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

          // 构建响应对象
          const response: AgentResponse = {
            text: result.answer, // Agent 的回答文本
            panel: result.uiAction.panel ?? "character", // 显示的面板类型
            highlightCharacterId: result.uiAction.highlightCharacterId, // 高亮的角色
            focusRoomId: result.uiAction.focusRoomId, // 聚焦的房间
            suggestedNextCharacterIds:
              result.uiAction.suggestedNextCharacterIds, // 推荐的下一个角色
            suggestedQuestions: result.uiAction.suggestedQuestions, // 建议的问题
            speakingAgentId: result.currentPrimaryAgent, // 当前回答的 Agent ID
          };

          // 返回 JSON 响应
          res.json(response);
        }
      );
    });
  } catch (error) {
    // 错误处理
    console.error("Chat API error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
