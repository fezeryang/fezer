/**
 * @fileoverview API 路由 - /api/character
 * @description 角色直接交互端点，经 harness 处理用户与特定角色的对话
 * @author Fezer
 * @created 2026-04-19
 */

import type { Request, Response } from "express";
import type { AgentResponse } from "@fezer/shared/schemas/agent";
import { isFezerType } from "@fezer/shared/characters";
import { runAgent } from "../agents/harness/run";
import { sendAgentRouteError } from "./errors";

/**
 * POST /api/character
 * 角色直接交互
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
    const { characterId, userInput = "你好！" } = req.body;

    if (!characterId) {
      res.status(400).json({ error: "characterId is required" });
      return;
    }

    // interactionType=click 让编排层硬绑定被点中的角色
    const result = await runAgent({
      input: userInput,
      characterId,
      interactionType: "click",
      caller: { kind: "route", id: "/api/character" },
    });

    const response: AgentResponse = {
      text: result.answer,
      panel: "character",
      // characterId 可能是 3D 角色 id（fezer-05）或 agent id（builder）。
      // 只有后者能直接用作高亮目标，否则回退到编排层解析出的回答者。
      highlightCharacterId: isFezerType(characterId)
        ? characterId
        : result.uiAction?.highlightCharacterId,
      speakingAgentId: result.speakingAgent,
    };

    res.json(response);
  } catch (error) {
    sendAgentRouteError(res, "Character", error);
  }
}
