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

  it("throws a typed provider configuration error when the enabled key is missing", async () => {
    process.env.AI_PRIMARY_PROVIDER = "deepseek";
    process.env.AI_PRIMARY_MODEL = "deepseek-chat";
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.BUILT_IN_FORGE_API_KEY;

    const { invokeLLM } = await import("./llm");

    await expect(
      invokeLLM({
        messages: [{ role: "user", content: "hello" }],
      })
    ).rejects.toMatchObject({
      name: "LLMProviderConfigurationError",
      provider: "deepseek",
      configVariable: "DEEPSEEK_API_KEY",
    });
  });

  it("supports NVIDIA-hosted DeepSeek chat template options", async () => {
    process.env.AI_PRIMARY_PROVIDER = "deepseek";
    process.env.AI_PRIMARY_MODEL = "deepseek-ai/deepseek-v4-flash";
    process.env.DEEPSEEK_API_KEY = "nvidia-key";
    process.env.DEEPSEEK_BASE_URL = "https://integrate.api.nvidia.com/v1";
    process.env.DEEPSEEK_CHAT_TEMPLATE_THINKING = "false";
    process.env.AI_MAX_TOKENS = "2048";
    process.env.BUILT_IN_FORGE_API_KEY = "forge-key";

    const fetchMock = vi.fn().mockResolvedValueOnce(
      createJsonResponse({
        id: "chatcmpl-nvidia",
        created: 1,
        model: "deepseek-ai/deepseek-v4-flash",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "ok" },
            finish_reason: "stop",
          },
        ],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { invokeLLM } = await import("./llm");
    await invokeLLM({
      messages: [{ role: "user", content: "hello" }],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://integrate.api.nvidia.com/v1/chat/completions"
    );
    const payload = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(payload.model).toBe("deepseek-ai/deepseek-v4-flash");
    expect(payload.max_tokens).toBe(2048);
    expect(payload.chat_template_kwargs).toEqual({ thinking: false });
    expect(payload.thinking).toBeUndefined();
  });

  it("attaches a configurable request timeout signal", async () => {
    process.env.AI_PRIMARY_PROVIDER = "deepseek";
    process.env.AI_PRIMARY_MODEL = "deepseek-chat";
    process.env.DEEPSEEK_API_KEY = "deepseek-key";
    process.env.AI_REQUEST_TIMEOUT_MS = "12345";

    const timeoutSignal = new AbortController().signal;
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(timeoutSignal);
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
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { invokeLLM } = await import("./llm");
    await invokeLLM({
      messages: [{ role: "user", content: "hello" }],
    });

    expect(timeoutSpy).toHaveBeenCalledWith(12345);
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(timeoutSignal);
  });

  it("falls back when the primary request times out", async () => {
    process.env.AI_PRIMARY_PROVIDER = "deepseek";
    process.env.AI_PRIMARY_MODEL = "deepseek-chat";
    process.env.AI_FALLBACK_PROVIDER = "forge";
    process.env.AI_FALLBACK_MODEL = "gemini-2.5-flash";
    process.env.DEEPSEEK_API_KEY = "deepseek-key";
    process.env.BUILT_IN_FORGE_API_KEY = "forge-key";
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.example.com";

    const timeoutError = new Error("request timed out");
    timeoutError.name = "AbortError";
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(timeoutError)
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
  });

  it("falls back on undici TimeoutError from AbortSignal.timeout", async () => {
    process.env.AI_PRIMARY_PROVIDER = "deepseek";
    process.env.AI_PRIMARY_MODEL = "deepseek-chat";
    process.env.AI_FALLBACK_PROVIDER = "forge";
    process.env.AI_FALLBACK_MODEL = "gemini-2.5-flash";
    process.env.DEEPSEEK_API_KEY = "deepseek-key";
    process.env.BUILT_IN_FORGE_API_KEY = "forge-key";
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.example.com";

    const timeoutError = new DOMException(
      "The operation was aborted due to timeout",
      "TimeoutError"
    );
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(timeoutError)
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
  });

  it("respects an explicit same-provider fallback when only DeepSeek is configured", async () => {
    process.env.AI_PRIMARY_PROVIDER = "deepseek";
    process.env.AI_PRIMARY_MODEL = "deepseek-ai/deepseek-v4-flash";
    process.env.AI_FALLBACK_PROVIDER = "deepseek";
    process.env.AI_FALLBACK_MODEL = "deepseek-ai/deepseek-v4-flash";
    process.env.DEEPSEEK_API_KEY = "deepseek-key";
    process.env.DEEPSEEK_BASE_URL = "https://integrate.api.nvidia.com/v1";
    delete process.env.BUILT_IN_FORGE_API_KEY;

    const timeoutError = new DOMException(
      "The operation was aborted due to timeout",
      "TimeoutError"
    );
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce(
        createJsonResponse({
          id: "chatcmpl-2",
          created: 2,
          model: "deepseek-ai/deepseek-v4-flash",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "deepseek-retry-ok" },
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

    expect(result.choices[0]?.message?.content).toBe("deepseek-retry-ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://integrate.api.nvidia.com/v1/chat/completions"
    );
  });

  it("defaults fallback to the primary provider and model when fallback env is omitted", async () => {
    process.env.AI_PRIMARY_PROVIDER = "deepseek";
    process.env.AI_PRIMARY_MODEL = "deepseek-ai/deepseek-v4-flash";
    process.env.DEEPSEEK_API_KEY = "deepseek-key";
    process.env.DEEPSEEK_BASE_URL = "https://integrate.api.nvidia.com/v1";
    delete process.env.AI_FALLBACK_PROVIDER;
    delete process.env.AI_FALLBACK_MODEL;
    delete process.env.BUILT_IN_FORGE_API_KEY;

    const timeoutError = new DOMException(
      "The operation was aborted due to timeout",
      "TimeoutError"
    );
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce(
        createJsonResponse({
          id: "chatcmpl-2",
          created: 2,
          model: "deepseek-ai/deepseek-v4-flash",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "default-retry-ok" },
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

    expect(result.choices[0]?.message?.content).toBe("default-retry-ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://integrate.api.nvidia.com/v1/chat/completions"
    );
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

  it("preserves assistant tool_calls in request payload", async () => {
    process.env.AI_PRIMARY_PROVIDER = "deepseek";
    process.env.AI_PRIMARY_MODEL = "deepseek-chat";
    process.env.DEEPSEEK_API_KEY = "deepseek-key";

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
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { invokeLLM } = await import("./llm");
    await invokeLLM({
      messages: [
        { role: "user", content: "hi" },
        {
          role: "assistant",
          content: "calling tool",
          tool_calls: [
            {
              id: "tool_1",
              type: "function",
              function: { name: "get_profile", arguments: "{}" },
            },
          ],
        },
        { role: "tool", tool_call_id: "tool_1", content: '{"ok":true}' },
      ],
    });

    const payload = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(payload.messages[1].tool_calls).toBeTruthy();
    expect(payload.messages[1].tool_calls[0].id).toBe("tool_1");
  });

  it("falls back on deepseek 400 tool call sequence errors", async () => {
    process.env.AI_PRIMARY_PROVIDER = "deepseek";
    process.env.AI_PRIMARY_MODEL = "deepseek-chat";
    process.env.AI_FALLBACK_PROVIDER = "forge";
    process.env.AI_FALLBACK_MODEL = "gemini-2.5-flash";
    process.env.DEEPSEEK_API_KEY = "deepseek-key";
    process.env.BUILT_IN_FORGE_API_KEY = "forge-key";
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.example.com";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createTextResponse(
          '{"error":{"message":"Messages with role \'tool\' must be a response to a preceding message with \'tool_calls\'"}}',
          400
        )
      )
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
