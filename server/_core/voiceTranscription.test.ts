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

describe("voice transcription prompt assembly", () => {
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
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("audio-bytes", {
          status: 200,
          headers: { "content-type": "audio/mpeg" },
        })
      )
      .mockResolvedValueOnce(createWhisperResponse());
    vi.stubGlobal("fetch", fetchMock);

    const { buildDefaultTranscriptionPrompt, transcribeAudio } = await import("./voiceTranscription");

    await transcribeAudio({
      audioUrl: "https://cdn.example.com/a.mp3",
      language: "en",
    });

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const formData = request.body as FormData;

    expect(formData.get("prompt")).toBe(buildDefaultTranscriptionPrompt("en"));
  });

  it("respects custom prompt override", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("audio-bytes", {
          status: 200,
          headers: { "content-type": "audio/mpeg" },
        })
      )
      .mockResolvedValueOnce(createWhisperResponse());
    vi.stubGlobal("fetch", fetchMock);

    const { transcribeAudio } = await import("./voiceTranscription");

    await transcribeAudio({
      audioUrl: "https://cdn.example.com/b.mp3",
      prompt: "custom-transcription-prompt",
    });

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const formData = request.body as FormData;

    expect(formData.get("prompt")).toBe("custom-transcription-prompt");
  });
});

