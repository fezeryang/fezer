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
import type { RunEvent } from "@fezer/shared/schemas/run";
import { runAgent } from "../agents/harness/run";
import { loadThreadTurns } from "../agents/harness/session";
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
/**
 * SSE 帧格式：`event: <type>` + `data: <完整事件 JSON>`，
 * 与 shared/src/schemas/run.ts 的 RunEvent 一一对应。
 */
function writeSseEvent(res: Response, event: RunEvent): void {
  res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}

async function chatStreamHandler(req: Request, res: Response): Promise<void> {
  const {
    userInput,
    roomId,
    characterId,
    interactionType = "chat",
    visitedRooms = [],
    discoveredCharacters = [],
    grounding,
    threadId,
  } = req.body as FrontendAgentRequest;

  // 客户端断开即真取消（A4）：信号一路传到 invokeLLM 的 fetch
  const controller = new AbortController();
  req.on("close", () => {
    if (!res.writableEnded) {
      controller.abort();
    }
  });

  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    // nginx 反向代理下禁止缓冲，否则事件会被攒住
    "x-accel-buffering": "no",
  });

  try {
    await runAgent({
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
      threadId,
      caller: { kind: "route", id: "/api/chat" },
      signal: controller.signal,
      stream: true,
      onEvent: event => writeSseEvent(res, event),
    });
  } catch (error) {
    // 头已发出，无法再回 HTTP 错误；错误已经以 run.error 事件写出。
    // 这里只保证日志可查（客户端断开导致的 cancelled 不算错误）。
    if (!controller.signal.aborted) {
      console.error("Chat stream error:", {
        errorType: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  } finally {
    res.end();
  }
}

/**
 * GET /api/chat/thread/:threadId
 * 读取某个会话线程的历史（C7：“继续上次对话”时恢复消息列表）。
 */
export async function chatThreadHandler(
  req: Request,
  res: Response
): Promise<void> {
  const threadId = req.params.threadId;

  if (!threadId || typeof threadId !== "string" || threadId.length > 64) {
    res.status(400).json({ error: "Invalid threadId" });
    return;
  }

  try {
    const turns = await loadThreadTurns(threadId);
    res.json({ threadId, turns });
  } catch (error) {
    sendAgentRouteError(res, "ChatThread", error);
  }
}

export async function chatHandler(req: Request, res: Response): Promise<void> {
  const wantsStream = (req.body as { stream?: boolean }).stream === true;

  try {
    const {
      userInput,
      roomId,
      characterId,
      interactionType = "chat",
      visitedRooms = [],
      discoveredCharacters = [],
      grounding,
      threadId,
    } = req.body as FrontendAgentRequest;

    if (!userInput || typeof userInput !== "string") {
      res.status(400).json({
        error: "Invalid userInput",
        message: "请输入有效的问题。",
      });
      return;
    }

    if (wantsStream) {
      await chatStreamHandler(req, res);
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
      threadId,
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
      cards: result.uiAction?.cards,
    };

    res.json(response);
  } catch (error) {
    sendAgentRouteError(res, "Chat", error);
  }
}
