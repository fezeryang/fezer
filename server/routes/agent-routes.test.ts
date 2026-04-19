import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

vi.mock("../agents/orchestrator/graph", () => ({
  orchestratorGraph: {
    invoke: vi.fn(),
  },
}));

import { orchestratorGraph } from "../agents/orchestrator/graph";
import { chatHandler } from "./chat";
import { guideHandler } from "./guide";
import { characterHandler } from "./character";

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
  });

  describe("POST /api/chat", () => {
    it("returns 400 for invalid userInput", async () => {
      const req = createReq({ userInput: 123 });
      const res = createRes();

      await chatHandler(req, res as unknown as Response);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: "Invalid userInput" });
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
        interactionType: "guide",
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
        uiAction: {},
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
        characterId: "c13",
        interactionType: "click",
        messages: [],
      });
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        text: "你好，我是 Visual Fezer。",
        panel: "character",
        highlightCharacterId: "c13",
        speakingAgentId: "visual",
      });
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
        message: "orchestrator failure",
      });
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
        message: "guide failure",
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
        message: "character failure",
      });
    });
  });
});
