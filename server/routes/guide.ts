/**
 * @fileoverview API 路由 - /api/guide
 * @description 导览/定向端点，强制使用 Core Fezer 代理进行导览介绍
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
import { sendE2eAgentResponse, shouldUseE2eAgentMock } from "./e2e-mock";
import { sendAgentRouteError } from "./errors";

/**
 * POST /api/guide
 * 导览端点，Core Fezer 响应
 *
 * 此端点专门用于网站导览功能，强制使用 Core Fezer 代理
 * 为用户提供网站功能和内容的介绍。
 *
 * @param req - Express 请求对象
 * @param res - Express 响应对象
 *
 * @example
 * ```bash
 * curl -X POST http://localhost:3000/api/guide \
 *   -H "Content-Type: application/json" \
 *   -d '{"userInput":"请为我介绍一下这里"}'
 * ```
 */
export async function guideHandler(req: Request, res: Response): Promise<void> {
  try {
    if (shouldUseE2eAgentMock()) {
      sendE2eAgentResponse(res, {
        panel: "guide",
        text: "E2E mock guide response",
      });
      return;
    }

    // 使用 LangSmith 追踪
    await traceSpan("api.guide", async () => {
      // 从请求体中获取用户输入，默认为导览引导语
      const { userInput = "请为我介绍一下这里" } = req.body;

      // 在追踪上下文中处理请求
      await runWithTraceContext(
        {
          route: "/api/guide",
          interactionType: "guide",
          env: process.env.NODE_ENV || "development",
        },
        async () => {
          // 调用编排器，强制使用 core 代理
          const result = await orchestratorGraph.invoke({
            userInput,
            interactionType: "guide" as const, // 固定为 guide 类型
            messages: [],
          });

          // 构建响应对象
          const response: AgentResponse = {
            text: result.answer, // Core Fezer 的介绍内容
            panel: "guide", // 显示导览面板
            suggestedQuestions: result.uiAction.suggestedQuestions, // 建议的后续问题
            speakingAgentId: "core", // 固定为 core 代理
          };

          // 返回 JSON 响应
          res.json(response);
        }
      );
    });
  } catch (error) {
    sendAgentRouteError(res, "Guide", error);
  }
}
