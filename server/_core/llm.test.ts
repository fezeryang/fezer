import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StreamChunk } from "./llm";

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

function sseData(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function createSseStreamResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream, { status });
}

function setProviderEnv(): void {
  process.env.AI_PRIMARY_PROVIDER = "deepseek";
  process.env.AI_PRIMARY_MODEL = "deepseek-chat";
  process.env.AI_FALLBACK_PROVIDER = "forge";
  process.env.DEEPSEEK_API_KEY = "deepseek-key";
  process.env.DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
  process.env.BUILT_IN_FORGE_API_KEY = "forge-key";
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

  it("omits OpenAI tool definitions for DeepSeek-compatible providers", async () => {
    process.env.AI_PRIMARY_PROVIDER = "deepseek";
    process.env.AI_PRIMARY_MODEL = "deepseek-ai/deepseek-v4-flash";
    process.env.DEEPSEEK_API_KEY = "nvidia-key";
    process.env.DEEPSEEK_BASE_URL = "https://integrate.api.nvidia.com/v1";
    process.env.DEEPSEEK_CHAT_TEMPLATE_THINKING = "false";

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
      tools: [
        {
          type: "function",
          function: {
            name: "get_profile",
            description: "Get profile",
            parameters: { type: "object", properties: {} },
          },
        },
      ],
      tool_choice: "auto",
    });

    const payload = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(payload.tools).toBeUndefined();
    expect(payload.tool_choice).toBeUndefined();
    expect(payload.chat_template_kwargs).toEqual({ thinking: false });
  });

  it("preserves OpenAI tool definitions for Forge providers", async () => {
    process.env.AI_PRIMARY_PROVIDER = "forge";
    process.env.AI_PRIMARY_MODEL = "gemini-2.5-flash";
    process.env.BUILT_IN_FORGE_API_KEY = "forge-key";
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.example.com";

    const fetchMock = vi.fn().mockResolvedValueOnce(
      createJsonResponse({
        id: "chatcmpl-forge",
        created: 1,
        model: "gemini-2.5-flash",
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
      tools: [
        {
          type: "function",
          function: {
            name: "get_profile",
            description: "Get profile",
            parameters: { type: "object", properties: {} },
          },
        },
      ],
      tool_choice: "auto",
    });

    const payload = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(payload.tools).toHaveLength(1);
    expect(payload.tool_choice).toBe("auto");
    expect(payload.thinking).toEqual({ budget_tokens: 128 });
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

  it("falls back to a different same-provider model when only DeepSeek is configured", async () => {
    process.env.AI_PRIMARY_PROVIDER = "deepseek";
    process.env.AI_PRIMARY_MODEL = "deepseek-ai/deepseek-v4-flash";
    process.env.AI_FALLBACK_PROVIDER = "deepseek";
    process.env.AI_FALLBACK_MODEL = "deepseek-chat";
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
          model: "deepseek-chat",
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

  it("does not retry the default duplicate fallback when fallback env is omitted", async () => {
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
    const fetchMock = vi.fn().mockRejectedValueOnce(timeoutError);
    vi.stubGlobal("fetch", fetchMock);

    const { invokeLLM } = await import("./llm");

    await expect(
      invokeLLM({
        messages: [{ role: "user", content: "hello" }],
      })
    ).rejects.toBe(timeoutError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry an explicit duplicate same-provider fallback", async () => {
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
    const fetchMock = vi.fn().mockRejectedValueOnce(timeoutError);
    vi.stubGlobal("fetch", fetchMock);

    const { invokeLLM } = await import("./llm");

    await expect(
      invokeLLM({
        messages: [{ role: "user", content: "hello" }],
      })
    ).rejects.toBe(timeoutError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
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

  it("运行取消时不换 provider 重试（取消不是 provider 故障）", async () => {
    process.env.AI_PRIMARY_PROVIDER = "deepseek";
    process.env.AI_PRIMARY_MODEL = "deepseek-chat";
    process.env.AI_FALLBACK_PROVIDER = "forge";
    process.env.DEEPSEEK_API_KEY = "deepseek-key";
    process.env.BUILT_IN_FORGE_API_KEY = "forge-key";

    const controller = new AbortController();
    controller.abort();

    // AbortError 通常是可回退的超时；但运行已取消时必须直接上抛，
    // 否则一次取消会被一次完整重试吞掉
    const fetchMock = vi.fn().mockRejectedValueOnce(
      Object.assign(new Error("This operation was aborted"), {
        name: "AbortError",
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { invokeLLM } = await import("./llm");
    const { runWithRunControl } = await import("./run-control");

    await expect(
      runWithRunControl({ signal: controller.signal }, () =>
        invokeLLM({ messages: [{ role: "user", content: "hello" }] })
      )
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("invokeLLMStream", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.LANGSMITH_TRACING;
    delete process.env.LANGSMITH_API_KEY;
    setProviderEnv();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  it("解析文本与工具调用增量，payload 带 stream: true", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      createSseStreamResponse([
        sseData({
          choices: [
            { index: 0, delta: { content: "你" }, finish_reason: null },
          ],
        }),
        sseData({
          choices: [
            { index: 0, delta: { content: "好" }, finish_reason: null },
          ],
        }),
        sseData({
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "tc1",
                    function: { name: "get_profile", arguments: '{"a":' },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        }),
        sseData({
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [{ index: 0, function: { arguments: "1}" } }],
              },
              finish_reason: "tool_calls",
            },
          ],
        }),
        "data: [DONE]\n\n",
      ])
    );
    vi.stubGlobal("fetch", fetchMock);

    const { invokeLLMStream } = await import("./llm");

    const chunks: StreamChunk[] = [];
    for await (const chunk of invokeLLMStream({
      messages: [{ role: "user", content: "hi" }],
    })) {
      chunks.push(chunk);
    }

    expect(chunks.map(c => c.text).join("")).toBe("你好");
    expect(chunks.at(-1)?.finishReason).toBe("tool_calls");
    expect(chunks.at(-1)?.toolCallDeltas).toMatchObject([
      { index: 0, argumentsDelta: "1}" },
    ]);

    const posted = JSON.parse(
      (fetchMock.mock.calls[0][1] as { body: string }).body
    );
    expect(posted.stream).toBe(true);
    expect(posted.messages[0].role).toBe("user");
  });

  it("首 chunk 前失败会换 provider", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createTextResponse("boom", 500))
      .mockResolvedValueOnce(
        createSseStreamResponse([
          sseData({
            choices: [
              { index: 0, delta: { content: "ok" }, finish_reason: "stop" },
            ],
          }),
          "data: [DONE]\n\n",
        ])
      );
    vi.stubGlobal("fetch", fetchMock);

    const { invokeLLMStream } = await import("./llm");

    const chunks: StreamChunk[] = [];
    for await (const chunk of invokeLLMStream({
      messages: [{ role: "user", content: "hi" }],
    })) {
      chunks.push(chunk);
    }

    expect(chunks.map(c => c.text).join("")).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("流中途失败不换 provider（首 chunk 后错误直接上抛）", async () => {
    const encoder = new TextEncoder();
    const failingStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            sseData({
              choices: [
                { index: 0, delta: { content: "首" }, finish_reason: null },
              ],
            })
          )
        );
      },
      // 确定性的「中途断流」：首个 chunk 被读完、队列见底时，下一次
      // 读取触发 pull，在这里 error 才让第二次 read 拒绝。
      // （在 start() 里同步 error 会直接抛出构造函数；queueMicrotask
      // 也会赶在第一次 read 之前落地 —— 两者都会变成「首 chunk 前失败」）
      pull(controller) {
        controller.error(new TypeError("connection reset"));
      },
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(failingStream, { status: 200 }))
      .mockResolvedValueOnce(
        createSseStreamResponse([
          sseData({
            choices: [
              {
                index: 0,
                delta: { content: "不应到达" },
                finish_reason: "stop",
              },
            ],
          }),
          "data: [DONE]\n\n",
        ])
      );
    vi.stubGlobal("fetch", fetchMock);

    const { invokeLLMStream } = await import("./llm");

    const collected: string[] = [];
    await expect(async () => {
      for await (const chunk of invokeLLMStream({
        messages: [{ role: "user", content: "hi" }],
      })) {
        collected.push(chunk.text);
      }
    }).rejects.toThrow();

    expect(collected.join("")).toBe("首");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
