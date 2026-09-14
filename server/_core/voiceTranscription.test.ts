import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

function createWhisperResponse() {
  return new Response(
    JSON.stringify({
      task: "transcribe",
      language: "en",
      duration: 1.2,
      text: "hello world",
      segments: [],
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    }
  );
}

/** 1 字节的合法 base64 音频（入口只校验非空与体积） */
const AUDIO_BASE64 = Buffer.from("audio-bytes").toString("base64");

describe("voice transcription", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.example.com";
    process.env.BUILT_IN_FORGE_API_KEY = "forge-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  it("builds stable default prompt with language context", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(createWhisperResponse());
    vi.stubGlobal("fetch", fetchMock);

    const { buildDefaultTranscriptionPrompt, transcribeAudioData } =
      await import("./voiceTranscription");

    const result = await transcribeAudioData({
      audioBase64: AUDIO_BASE64,
      mimeType: "audio/webm",
      language: "en",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const formData = request.body as FormData;
    expect(formData.get("prompt")).toBe(buildDefaultTranscriptionPrompt("en"));
    expect(formData.get("model")).toBe("whisper-1");
    expect("text" in result && result.text).toBe("hello world");
  });

  it("respects custom prompt override", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(createWhisperResponse());
    vi.stubGlobal("fetch", fetchMock);

    const { transcribeAudioData } = await import("./voiceTranscription");

    await transcribeAudioData({
      audioBase64: AUDIO_BASE64,
      mimeType: "audio/webm",
      prompt: "custom-transcription-prompt",
    });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const formData = request.body as FormData;
    expect(formData.get("prompt")).toBe("custom-transcription-prompt");
  });

  it("未配置转写服务时返回 SERVICE_ERROR，且不发起请求", async () => {
    delete process.env.BUILT_IN_FORGE_API_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { transcribeAudioData } = await import("./voiceTranscription");

    const result = await transcribeAudioData({
      audioBase64: AUDIO_BASE64,
      mimeType: "audio/webm",
    });

    expect("error" in result && result.code).toBe("SERVICE_ERROR");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("空音频直接拒绝，不打服务", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { transcribeAudioData } = await import("./voiceTranscription");

    const result = await transcribeAudioData({
      audioBase64: "",
      mimeType: "audio/webm",
    });

    expect("error" in result && result.code).toBe("INVALID_FORMAT");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("超过 16MB 的音频被拒（FILE_TOO_LARGE）", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { MAX_TRANSCRIPTION_BYTES, transcribeAudioData } = await import(
      "./voiceTranscription"
    );

    const oversized = Buffer.alloc(MAX_TRANSCRIPTION_BYTES + 1).toString(
      "base64"
    );

    const result = await transcribeAudioData({
      audioBase64: oversized,
      mimeType: "audio/webm",
    });

    expect("error" in result && result.code).toBe("FILE_TOO_LARGE");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
