import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const mocks = vi.hoisted(() => ({ transcribeAudioData: vi.fn() }));

vi.mock("../_core/voiceTranscription", () => ({
  MAX_TRANSCRIPTION_BYTES: 16 * 1024 * 1024,
  transcribeAudioData: mocks.transcribeAudioData,
}));

import { voiceTranscribeHandler } from "./voice";

type MockResponse = {
  statusCode: number;
  body: unknown;
  status: (code: number) => MockResponse;
  json: (payload: unknown) => MockResponse;
};

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

function createReq(body: unknown): Request {
  return { body } as Request;
}

const VALID_BODY = {
  audioBase64: Buffer.from("audio-bytes").toString("base64"),
  mimeType: "audio/webm",
};

describe("POST /api/voice/transcribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("转写成功时返回文本", async () => {
    mocks.transcribeAudioData.mockResolvedValue({
      task: "transcribe",
      language: "zh",
      duration: 2.4,
      text: "介绍一下你的项目",
      segments: [],
    });
    const res = createRes();
    await voiceTranscribeHandler(
      createReq(VALID_BODY),
      res as unknown as Response
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      text: "介绍一下你的项目",
      language: "zh",
    });
    expect(mocks.transcribeAudioData).toHaveBeenCalledWith({
      audioBase64: VALID_BODY.audioBase64,
      mimeType: "audio/webm",
    });
  });

  it("缺少或超大的音频负载直接 400，不打转写服务", async () => {
    for (const body of [
      {},
      { audioBase64: "", mimeType: "audio/webm" },
      { audioBase64: 123, mimeType: "audio/webm" },
      { audioBase64: "x".repeat(24 * 1024 * 1024), mimeType: "audio/webm" },
    ]) {
      const res = createRes();
      await voiceTranscribeHandler(createReq(body), res as unknown as Response);

      expect(res.statusCode).toBe(400);
      expect(res.body).toMatchObject({ error: "Invalid audio payload" });
    }

    expect(mocks.transcribeAudioData).not.toHaveBeenCalled();
  });

  it("非 audio/* 的 mimeType 被拒", async () => {
    const res = createRes();
    await voiceTranscribeHandler(
      createReq({ ...VALID_BODY, mimeType: "application/json" }),
      res as unknown as Response
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: "Invalid mimeType" });
    expect(mocks.transcribeAudioData).not.toHaveBeenCalled();
  });

  it("转写服务未配置时返回 503 并提示改用文字", async () => {
    mocks.transcribeAudioData.mockResolvedValue({
      error: "Voice transcription service is not configured",
      code: "SERVICE_ERROR",
      details: "BUILT_IN_FORGE_API_URL is not set",
    });

    const res = createRes();
    await voiceTranscribeHandler(
      createReq(VALID_BODY),
      res as unknown as Response
    );

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ code: "SERVICE_ERROR" });
    expect(JSON.stringify(res.body)).toContain("改用文字输入");
  });

  it("识别失败（如音频损坏）时返回 400 与可读提示", async () => {
    mocks.transcribeAudioData.mockResolvedValue({
      error: "Transcription service request failed",
      code: "TRANSCRIPTION_FAILED",
      details: "400 Bad Request",
    });

    const res = createRes();
    await voiceTranscribeHandler(
      createReq(VALID_BODY),
      res as unknown as Response
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: "TRANSCRIPTION_FAILED" });
  });
});
