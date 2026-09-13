/**
 * @fileoverview API 路由 - /api/guide
 * @description 导览/定向端点，经 harness 强制使用 Core Fezer 代理进行导览介绍
 * @author Fezer
 * @created 2026-04-19
 */

import type { Request, Response } from "express";
import type { AgentResponse } from "@fezer/shared/schemas/agent";
import { runAgent } from "../agents/harness/run";
import { sendE2eAgentResponse, shouldUseE2eAgentMock } from "./e2e-mock";
import { sendAgentRouteError } from "./errors";

/**
 * POST /api/guide
 * 导览端点，Core Fezer 响应
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

    const { userInput = "请为我介绍一下这里" } = req.body;

    // interactionType=guide 让编排层硬绑定 core：导览是显式定向交互
    const result = await runAgent({
      input: userInput,
      interactionType: "guide",
      caller: { kind: "route", id: "/api/guide" },
    });

    const response: AgentResponse = {
      text: result.answer,
      panel: "guide",
      suggestedQuestions: result.uiAction?.suggestedQuestions,
      speakingAgentId: result.speakingAgent,
    };

    res.json(response);
  } catch (error) {
    sendAgentRouteError(res, "Guide", error);
  }
}
