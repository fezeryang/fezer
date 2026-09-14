import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import type { Request, Response } from "express";

vi.mock("../agents/orchestrator/graph", () => ({
  orchestratorGraph: {
    invoke: vi.fn(),
  },
}));

import { orchestratorGraph } from "../agents/orchestrator/graph";
import { LLMProviderConfigurationError } from "../_core/llm";
import { RunError } from "../agents/harness/errors";
import {
  appendThreadTurns,
  resetMemoryThreads,
} from "../agents/harness/session";
import { chatHandler, chatThreadHandler } from "./chat";
import { guideHandler } from "./guide";
import { characterHandler } from "./character";
import { sendAgentRouteError } from "./errors";

type MockResponse = {
  statusCode: number;
  headers: Record<string, unknown>;
  body: unknown;
  chunks: string[];
  ended: boolean;
  readonly writableEnded: boolean;
  status: (code: number) => MockResponse;
  json: (payload: unknown) => MockResponse;
  writeHead: (code: number, headers?: Record<string, unknown>) => MockResponse;
  write: (chunk: string) => MockResponse;
  end: () => MockResponse;
};

function createReq(body: unknown): Request {
  return { body } as Request;
}

function createRes(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    headers: {},
    body: undefined,
    chunks: [],
    ended: false,
    get writableEnded() {
      return this.ended;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    writeHead(code: number, headers: Record<string, unknown> = {}) {
      this.statusCode = code;
      this.headers = { ...this.headers, ...headers };
      return this;
    },
    write(chunk: string) {
      this.chunks.push(chunk);
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
  return res;
}

/** SSE 流式用：req 需要能触发 close（客户端断开） */
function createStreamReq(
  body: unknown
): { req: Request; emitter: EventEmitter } {
  const emitter = new EventEmitter();
  const req = Object.assign(emitter, { body }) as unknown as Request;
  return { req, emitter };
}

/** 把逐帧写入的 SSE 文本解析回 RunEvent 列表 */
function parseSseChunks(chunks: string[]): Array<Record<string, unknown>> {
  return chunks
    .join("")
    .split("\n\n")
    .filter(Boolean)
    .map(frame => {
      const dataLine = frame
        .split("\n")
        .find(line => line.startsWith("data: "));
      return JSON.parse(dataLine!.slice("data: ".length));
    });
}

/**
 * 编排图返回的是 LangGraph 完整 state，而用例只提供关心的几个字段。
 * cast 集中在这一处，不让每个用例各写一遍。
 */
function mockOrchestratorResult(result: Record<string, unknown>): void {
  vi.mocked(orchestratorGraph.invoke).mockResolvedValueOnce(result as never);
}

describe("Agent API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /api/chat", () => {
    it("returns 400 for invalid userInput", async () => {
      const req = createReq({ userInput: 123 });
      const res = createRes();

      await chatHandler(req, res as unknown as Response);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        error: "Invalid userInput",
        message: "请输入有效的问题。",
      });
      expect(orchestratorGraph.invoke).not.toHaveBeenCalled();
    });

    it("maps orchestrator result to frontend response", async () => {
      mockOrchestratorResult({
        answer: "你好，我是 Builder Fezer。",
        uiAction: {
          panel: "character",
          highlightCharacterId: "builder",
          focusRoomId: "r-tech",
          suggestedNextCharacterIds: ["ai"],
          suggestedQuestions: ["你最擅长什么技术？"],
        },
        currentPrimaryAgent: "builder",
      });

      const req = createReq({
        userInput: "介绍一下你的技术栈",
        roomId: "r-tech",
        characterId: "c4",
        interactionType: "click",
        visitedRooms: ["r-home"],
        discoveredCharacters: ["c1"],
      });
      const res = createRes();

      await chatHandler(req, res as unknown as Response);

      expect(orchestratorGraph.invoke).toHaveBeenCalledWith({
        userInput: "介绍一下你的技术栈",
        roomId: "r-tech",
        characterId: "c4",
        interactionType: "click",
        visitedRooms: ["r-home"],
        discoveredCharacters: ["c1"],
        grounding: undefined,
        conversationHistory: [],
        messages: [],
      });
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        text: "你好，我是 Builder Fezer。",
        panel: "character",
        highlightCharacterId: "builder",
        focusRoomId: "r-tech",
        suggestedNextCharacterIds: ["ai"],
        suggestedQuestions: ["你最擅长什么技术？"],
        speakingAgentId: "builder",
      });
    });
  });

  describe("POST /api/chat（SSE 流式）", () => {
    it("stream: true 时以 SSE 逐帧输出 RunEvent", async () => {
      mockOrchestratorResult({
        answer: "流式回答",
        currentPrimaryAgent: "core",
      });
      const res = createRes();
      const { req } = createStreamReq({ userInput: "你好", stream: true });

      await chatHandler(req, res as unknown as Response);

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toBe("text/event-stream");
      expect(res.headers["x-accel-buffering"]).toBe("no");
      expect(res.ended).toBe(true);

      // 帧格式：event: <type>\ndata: <json>\n\n
      expect(res.chunks[0].startsWith("event: run.started\ndata: ")).toBe(
        true
      );

      const frames = parseSseChunks(res.chunks);
      expect(frames[0]).toMatchObject({ type: "run.started" });
      expect(frames.at(-1)).toMatchObject({
        type: "run.finished",
        answer: "流式回答",
      });
    });

    it("客户端断开时中止运行并以 cancelled 帧收尾", async () => {
      vi.mocked(orchestratorGraph.invoke).mockImplementation(
        () => new Promise(() => {}) as never
      );
      const res = createRes();
      const { req, emitter } = createStreamReq({
        userInput: "你好",
        stream: true,
      });

      const pending = chatHandler(req, res as unknown as Response);
      const timer = setTimeout(() => emitter.emit("close"), 10);
      try {
        await pending;
      } finally {
        clearTimeout(timer);
      }

      const frames = parseSseChunks(res.chunks);
      expect(frames.at(-1)).toMatchObject({
        type: "run.error",
        code: "cancelled",
      });
      expect(res.ended).toBe(true);
    });
  });

  describe("POST /api/guide", () => {
    it("uses default guide prompt when request body is empty", async () => {
      mockOrchestratorResult({
        answer: "欢迎来到 Fezer 的作品空间。",
        uiAction: {
          suggestedQuestions: ["我该先看哪里？"],
        },
      });

      const req = createReq({});
      const res = createRes();

      await guideHandler(req, res as unknown as Response);

      expect(orchestratorGraph.invoke).toHaveBeenCalledWith({
        userInput: "请为我介绍一下这里",
        roomId: undefined,
        characterId: undefined,
        interactionType: "guide",
        grounding: undefined,
        conversationHistory: [],
        visitedRooms: [],
        discoveredCharacters: [],
        messages: [],
      });
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        text: "欢迎来到 Fezer 的作品空间。",
        panel: "guide",
        suggestedQuestions: ["我该先看哪里？"],
        speakingAgentId: "core",
      });
    });
  });

  describe("POST /api/character", () => {
    it("returns 400 when characterId is missing", async () => {
      const req = createReq({ userInput: "你好" });
      const res = createRes();

      await characterHandler(req, res as unknown as Response);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: "characterId is required" });
      expect(orchestratorGraph.invoke).not.toHaveBeenCalled();
    });

    it("returns agent response for character interaction", async () => {
      mockOrchestratorResult({
        answer: "你好，我是 Visual Fezer。",
        uiAction: { highlightCharacterId: "visual" },
        currentPrimaryAgent: "visual",
      });

      const req = createReq({
        characterId: "c13",
        userInput: "聊聊你的设计理念",
      });
      const res = createRes();

      await characterHandler(req, res as unknown as Response);

      expect(orchestratorGraph.invoke).toHaveBeenCalledWith({
        userInput: "聊聊你的设计理念",
        roomId: undefined,
        characterId: "c13",
        interactionType: "click",
        grounding: undefined,
        conversationHistory: [],
        visitedRooms: [],
        discoveredCharacters: [],
        messages: [],
      });
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        text: "你好，我是 Visual Fezer。",
        panel: "character",
        highlightCharacterId: "visual",
        speakingAgentId: "visual",
      });
    });

    it("agent id 形式的 characterId 直接作为高亮目标", async () => {
      mockOrchestratorResult({
        answer: "你好，我是 Builder Fezer。",
        uiAction: { highlightCharacterId: "core" },
        currentPrimaryAgent: "core",
      });

      const req = createReq({ characterId: "builder", userInput: "你好" });
      const res = createRes();

      await characterHandler(req, res as unknown as Response);

      expect(res.body).toMatchObject({
        highlightCharacterId: "builder",
        speakingAgentId: "core",
      });
    });
  });

  describe("run error mapping", () => {
    it("maps budget_exhausted to 504", () => {
      const res = createRes();

      sendAgentRouteError(
        res as unknown as Response,
        "Chat",
        new RunError("budget_exhausted", "超过墙钟预算")
      );

      expect(res.statusCode).toBe(504);
      expect(res.body).toMatchObject({
        code: "AGENT_RUN_BUDGET_EXHAUSTED",
      });
    });

    it("maps cancelled to 499", () => {
      const res = createRes();

      sendAgentRouteError(
        res as unknown as Response,
        "Chat",
        new RunError("cancelled", "用户取消")
      );

      expect(res.statusCode).toBe(499);
      expect(res.body).toMatchObject({ code: "AGENT_RUN_CANCELLED" });
    });

    it("maps invalid_input to 400", () => {
      const res = createRes();

      sendAgentRouteError(
        res as unknown as Response,
        "Chat",
        new RunError("invalid_input", "输入不合法")
      );

      expect(res.statusCode).toBe(400);
      expect(res.body).toMatchObject({ code: "INVALID_INPUT" });
    });
  });

  describe("GET /api/chat/thread/:threadId", () => {
    const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;

    beforeEach(() => {
      // 会话测试固定走内存回退，不碰 .env 里的真实数据库
      delete process.env.DATABASE_URL;
      resetMemoryThreads();
    });

    afterAll(() => {
      if (ORIGINAL_DATABASE_URL === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
      }
    });

    it("返回该线程的历史轮次（C7 恢复用）", async () => {
      await appendThreadTurns("t-1", "route", [
        { role: "user", content: "Q" },
        { role: "assistant", content: "A", agentId: "core" },
      ]);

      const res = createRes();
      await chatThreadHandler(
        { params: { threadId: "t-1" } } as unknown as Request,
        res as unknown as Response
      );

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        threadId: "t-1",
        turns: [
          { role: "user", content: "Q" },
          { role: "assistant", content: "A", agentId: "core" },
        ],
      });
    });

    it("超过 64 字符的 threadId 直接 400", async () => {
      const res = createRes();
      await chatThreadHandler(
        { params: { threadId: "x".repeat(65) } } as unknown as Request,
        res as unknown as Response
      );

      expect(res.statusCode).toBe(400);
    });
  });

  describe("route error handling", () => {
    it("returns 500 for chat route when orchestrator throws", async () => {
      vi.mocked(orchestratorGraph.invoke).mockRejectedValueOnce(
        new Error("orchestrator failure")
      );

      const req = createReq({ userInput: "hello" });
      const res = createRes();

      await chatHandler(req, res as unknown as Response);

      expect(res.statusCode).toBe(500);
      expect(res.body).toMatchObject({
        error: "Internal server error",
        message: "服务器暂时无法完成请求，请稍后再试。",
      });
    });

    it("returns sanitized 503 for chat provider configuration errors", async () => {
      vi.mocked(orchestratorGraph.invoke).mockRejectedValueOnce(
        new LLMProviderConfigurationError("forge", "BUILT_IN_FORGE_API_KEY")
      );

      const req = createReq({ userInput: "hello" });
      const res = createRes();

      await chatHandler(req, res as unknown as Response);

      expect(res.statusCode).toBe(503);
      expect(res.body).toEqual({
        error: "AI service unavailable",
        code: "AI_SERVICE_UNAVAILABLE",
        message: "AI 服务暂时不可用，请稍后再试。",
      });
      expect(JSON.stringify(res.body)).not.toContain("BUILT_IN_FORGE_API_KEY");
    });

    it("returns 500 for guide route when orchestrator throws", async () => {
      vi.mocked(orchestratorGraph.invoke).mockRejectedValueOnce(
        new Error("guide failure")
      );

      const req = createReq({ userInput: "hello" });
      const res = createRes();

      await guideHandler(req, res as unknown as Response);

      expect(res.statusCode).toBe(500);
      expect(res.body).toMatchObject({
        error: "Internal server error",
        message: "服务器暂时无法完成请求，请稍后再试。",
      });
    });

    it("returns 500 for character route when orchestrator throws", async () => {
      vi.mocked(orchestratorGraph.invoke).mockRejectedValueOnce(
        new Error("character failure")
      );

      const req = createReq({ characterId: "c1", userInput: "hello" });
      const res = createRes();

      await characterHandler(req, res as unknown as Response);

      expect(res.statusCode).toBe(500);
      expect(res.body).toMatchObject({
        error: "Internal server error",
        message: "服务器暂时无法完成请求，请稍后再试。",
      });
    });
  });
});
