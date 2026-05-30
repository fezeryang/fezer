/**
 * @fileoverview API 路由 - /api/character
 * @description 角色直接交互端点，处理用户与特定角色的对话
 * @author Fezer
 * @created 2026-04-19
 */

import type { Request, Response } from "express";
import { orchestratorGraph } from "../agents/orchestrator/graph";
import type { AgentResponse } from "@fezer/shared/schemas/agent";
import {
  runWithTraceContext,
  traceSpan,
} from "../_core/observability/langsmith";
import {
  sendE2eAgentResponse,
  shouldUseE2eAgentMock,
  toE2eFezerType,
} from "./e2e-mock";
import { sendAgentRouteError } from "./errors";

/**
 * POST /api/character
 * 角色直接交互
 *
 * 此端点用于用户与特定角色的直接交互，
 * 根据角色 ID 路由到对应的专家 Agent。
 *
 * @param req - Express 请求对象，包含 characterId 和 userInput
 * @param res - Express 响应对象
 *
 * @example
 * ```bash
 * curl -X POST http://localhost:3000/api/character \
 *   -H "Content-Type: application/json" \
 *   -d '{"characterId":"builder","userInput":"你好"}'
 * ```
 */
export async function characterHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    if (shouldUseE2eAgentMock()) {
      const { characterId = "core" } = req.body as {
        characterId?: string;
      };
      sendE2eAgentResponse(res, {
        highlightCharacterId: toE2eFezerType(characterId),
      });
      return;
    }

    // 使用 LangSmith 追踪
    await traceSpan("api.character", async () => {
      // 从请求体中获取角色 ID 和用户输入
      const { characterId, userInput = "你好！" } = req.body;

      // 在追踪上下文中处理请求
      await runWithTraceContext(
        {
          route: "/api/character",
          interactionType: "click",
          characterId,
          env: process.env.NODE_ENV || "development",
        },
        async () => {
          // 验证必填参数
          if (!characterId) {
            res.status(400).json({ error: "characterId is required" });
            return;
          }

          // 调用编排器，直接角色交互
          const result = await orchestratorGraph.invoke({
            userInput,
            characterId,
            interactionType: "click" as const, // 点击交互类型
            messages: [],
          });

          // 构建响应对象
          const response: AgentResponse = {
            text: result.answer, // 角色的回答
            panel: "character", // 显示角色面板
            highlightCharacterId: characterId as any, // 高亮当前角色
            speakingAgentId: result.currentPrimaryAgent, // 回答的 Agent ID
          };

          // 返回 JSON 响应
          res.json(response);
        }
      );
    });
  } catch (error) {
    sendAgentRouteError(res, "Character", error);
  }
}
