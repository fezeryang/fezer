import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

function createJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createTextResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain" },
    statusText: `status-${status}`,
  });
}

describe("invokeLLM provider routing", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.LANGSMITH_TRACING;
    delete process.env.LANGSMITH_API_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  it("uses DeepSeek as primary provider by default", async () => {
    process.env.AI_PRIMARY_PROVIDER = "deepseek";
    process.env.AI_PRIMARY_MODEL = "deepseek-chat";
    process.env.DEEPSEEK_API_KEY = "deepseek-key";
    process.env.DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
    process.env.BUILT_IN_FORGE_API_KEY = "forge-key";

    const fetchMock = vi.fn().mockResolvedValueOnce(
      createJsonResponse({
        id: "chatcmpl-1",
        created: 1,
        model: "deepseek-chat",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "ok" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { invokeLLM } = await import("./llm");
    await invokeLLM({
      messages: [{ role: "user", content: "hello" }],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.deepseek.com/v1/chat/completions"
    );
    const payload = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(payload.model).toBe("deepseek-chat");
    expect(payload.thinking).toBeUndefined();
  });

  it("falls back to forge on retryable primary failure", async () => {
    process.env.AI_PRIMARY_PROVIDER = "deepseek";
    process.env.AI_PRIMARY_MODEL = "deepseek-chat";
    process.env.AI_FALLBACK_PROVIDER = "forge";
    process.env.AI_FALLBACK_MODEL = "gemini-2.5-flash";
    process.env.DEEPSEEK_API_KEY = "deepseek-key";
    process.env.BUILT_IN_FORGE_API_KEY = "forge-key";
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.example.com";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createTextResponse("temporary failure", 500))
      .mockResolvedValueOnce(
        createJsonResponse({
          id: "chatcmpl-2",
          created: 2,
          model: "gemini-2.5-flash",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "fallback-ok" },
              finish_reason: "stop",
            },
          ],
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { invokeLLM } = await import("./llm");
    const result = await invokeLLM({
      messages: [{ role: "user", content: "hello" }],
    });

    expect(result.choices[0]?.message?.content).toBe("fallback-ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://forge.example.com/v1/chat/completions"
    );
  });

  it("does not fallback on non-retryable 4xx response", async () => {
    process.env.AI_PRIMARY_PROVIDER = "deepseek";
    process.env.AI_PRIMARY_MODEL = "deepseek-chat";
    process.env.AI_FALLBACK_PROVIDER = "forge";
    process.env.DEEPSEEK_API_KEY = "deepseek-key";
    process.env.BUILT_IN_FORGE_API_KEY = "forge-key";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createTextResponse("bad request", 400));
    vi.stubGlobal("fetch", fetchMock);

    const { invokeLLM } = await import("./llm");

    await expect(
      invokeLLM({
        messages: [{ role: "user", content: "hello" }],
      })
    ).rejects.toThrow("[deepseek] LLM invoke failed: 400");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
