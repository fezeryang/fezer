import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

vi.mock("../agents/orchestrator/graph", () => ({
  orchestratorGraph: {
    invoke: vi.fn(),
  },
}));

import { orchestratorGraph } from "../agents/orchestrator/graph";
import { LLMProviderConfigurationError } from "../_core/llm";
import { RunError } from "../agents/harness/errors";
import { chatHandler } from "./chat";
import { guideHandler } from "./guide";
import { characterHandler } from "./character";
import { sendAgentRouteError } from "./errors";

type MockResponse = {
  statusCode: number;
  body: unknown;
  status: (code: number) => MockResponse;
  json: (payload: unknown) => MockResponse;
};

function createReq(body: unknown): Request {
  return { body } as Request;
}

function createRes(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
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
      vi.mocked(orchestratorGraph.invoke).mockResolvedValueOnce({
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

  describe("POST /api/guide", () => {
    it("uses default guide prompt when request body is empty", async () => {
      vi.mocked(orchestratorGraph.invoke).mockResolvedValueOnce({
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
      vi.mocked(orchestratorGraph.invoke).mockResolvedValueOnce({
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
      vi.mocked(orchestratorGraph.invoke).mockResolvedValueOnce({
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
