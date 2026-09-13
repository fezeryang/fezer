/**
 * @fileoverview API 路由 - /api/chat
 * @description 通用代理交互入口，经 harness 运行时处理用户对话请求
 * @author Fezer
 * @created 2026-04-19
 *
 * 本文件只是 harness 的适配层：校验输入、清理会话历史、把 RunResult 映射成
 * 前端信封。run 身份、事件、预算与错误分类都在 server/agents/harness 里。
 */

import type { Request, Response } from "express";
import type {
  FrontendAgentRequest,
  AgentResponse,
  ConversationTurn,
} from "@fezer/shared/schemas/agent";
import { runAgent } from "../agents/harness/run";
import {
  sendE2eAgentResponse,
  shouldUseE2eAgentMock,
  toE2eFezerType,
} from "./e2e-mock";
import { sendAgentRouteError } from "./errors";

/** 会话历史的信任边界：最多 8 轮、每轮 4000 字符 */
const MAX_CONVERSATION_TURNS = 8;
const MAX_CONVERSATION_TURN_CHARS = 4000;

function sanitizeConversationHistory(history: unknown): ConversationTurn[] {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter(
      (turn): turn is ConversationTurn =>
        turn != null &&
        typeof turn === "object" &&
        "role" in turn &&
        (turn.role === "user" || turn.role === "assistant") &&
        "content" in turn &&
        typeof turn.content === "string" &&
        turn.content.trim().length > 0
    )
    .slice(-MAX_CONVERSATION_TURNS)
    .map(turn => ({
      role: turn.role,
      content: turn.content.slice(0, MAX_CONVERSATION_TURN_CHARS),
      ...(turn.agentId ? { agentId: turn.agentId } : {}),
    }));
}

/**
 * POST /api/chat
 * 通用代理交互入口
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

    const {
      userInput,
      roomId,
      characterId,
      interactionType = "chat",
      visitedRooms = [],
      discoveredCharacters = [],
      grounding,
    } = req.body as FrontendAgentRequest;

    if (!userInput || typeof userInput !== "string") {
      res.status(400).json({
        error: "Invalid userInput",
        message: "请输入有效的问题。",
      });
      return;
    }

    const result = await runAgent({
      input: userInput,
      roomId,
      characterId,
      interactionType: interactionType as "click" | "hover" | "chat" | "guide",
      grounding,
      visitedRooms,
      discoveredCharacters,
      conversationHistory: sanitizeConversationHistory(
        req.body.conversationHistory
      ),
      caller: { kind: "route", id: "/api/chat" },
    });

    const response: AgentResponse = {
      text: result.answer,
      panel: result.uiAction?.panel ?? "character",
      highlightCharacterId: result.uiAction?.highlightCharacterId,
      focusRoomId: result.uiAction?.focusRoomId,
      suggestedNextCharacterIds: result.uiAction?.suggestedNextCharacterIds,
      suggestedQuestions: result.uiAction?.suggestedQuestions,
      speakingAgentId: result.speakingAgent,
    };

    res.json(response);
  } catch (error) {
    sendAgentRouteError(res, "Chat", error);
  }
}
