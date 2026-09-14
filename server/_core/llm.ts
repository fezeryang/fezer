/**
 * @fileoverview LLM 调用抽象层
 * @description 统一的 LLM 调用接口，支持 DeepSeek 和 Forge 两种提供商，自动故障转移
 * @author Fezer
 * @created 2026-04-19
 *
 * @description
 * 此模块提供：
 * 1. 统一的 LLM 调用接口（invokeLLM）
 * 2. 多提供商支持（DeepSeek、Forge）
 * 3. 自动故障转移机制
 * 4. LangSmith 可观测性集成
 */

import { ENV } from "./env";
import { traceSpan } from "./observability/langsmith";
import { getRunControl, isRunAborted, mergeAbortSignals } from "./run-control";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 消息角色类型
 */
export type Role = "system" | "user" | "assistant" | "tool" | "function";

/**
 * 文本内容
 */
export type TextContent = {
  type: "text";
  text: string;
};

/**
 * 图片内容（多模态）
 */
export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

/**
 * 文件内容（如音频、PDF 等）
 */
export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?:
      | "audio/mpeg"
      | "audio/wav"
      | "application/pdf"
      | "audio/mp4"
      | "video/mp4";
  };
};

/**
 * 消息内容类型（可以是字符串或结构化内容）
 */
export type MessageContent = string | TextContent | ImageContent | FileContent;

/**
 * LLM 消息格式
 */
export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

/**
 * 工具定义（Function Calling）
 */
export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

/**
 * 工具选择策略
 */
export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

/**
 * LLM 调用参数
 */
export type InvokeParams = {
  messages: Message[]; // 消息列表
  tools?: Tool[]; // 可用工具列表
  toolChoice?: ToolChoice; // 工具选择策略
  tool_choice?: ToolChoice; // 别名
  model?: string; // 模型名称（覆盖默认）
  maxTokens?: number; // 最大输出 token 数
  max_tokens?: number; // 别名
  outputSchema?: OutputSchema; // 输出 schema（结构化输出）
  output_schema?: OutputSchema; // 别名
  responseFormat?: ResponseFormat; // 响应格式
  response_format?: ResponseFormat; // 别名
};

/**
 * 工具调用结果
 */
export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

/**
 * LLM 响应结果
 */
export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

/**
 * JSON Schema 定义
 */
export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

/**
 * 响应格式类型
 */
export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id, tool_calls } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  if (role === "assistant" && tool_calls) {
    for (const toolCall of tool_calls) {
      if (
        !toolCall?.id ||
        !toolCall?.function?.name ||
        typeof toolCall.function.arguments !== "string"
      ) {
        throw new Error("Invalid assistant tool_calls payload");
      }
    }
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    const normalized = {
      role,
      name,
      content: contentParts[0].text,
    };
    if (role === "assistant" && tool_calls && tool_calls.length > 0) {
      return { ...normalized, tool_calls };
    }
    return normalized;
  }

  const normalized = {
    role,
    name,
    content: contentParts,
  };
  if (role === "assistant" && tool_calls && tool_calls.length > 0) {
    return { ...normalized, tool_calls };
  }
  return normalized;
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

type LLMProvider = "deepseek" | "forge";

type ProviderRuntimeConfig = {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  apiUrl: string;
  source: "primary" | "fallback";
};

export class LLMProviderConfigurationError extends Error {
  constructor(
    public readonly provider: LLMProvider,
    public readonly configVariable:
      | "DEEPSEEK_API_KEY"
      | "BUILT_IN_FORGE_API_KEY"
  ) {
    super(`${configVariable} is not configured`);
    this.name = "LLMProviderConfigurationError";
  }
}

class LLMHttpError extends Error {
  constructor(
    public readonly provider: LLMProvider,
    public readonly status: number,
    public readonly statusText: string,
    public readonly responseBody: string
  ) {
    super(
      `[${provider}] LLM invoke failed: ${status} ${statusText} – ${responseBody}`
    );
    this.name = "LLMHttpError";
  }
}

const FORGE_DEFAULT_URL = "https://forge.manus.im/v1/chat/completions";
const DEEPSEEK_DEFAULT_BASE_URL = "https://api.deepseek.com/v1";
const DEFAULT_LLM_REQUEST_TIMEOUT_MS = 60_000;

function normalizeProvider(value: string | undefined): LLMProvider {
  return value?.trim().toLowerCase() === "forge" ? "forge" : "deepseek";
}

function resolveProviderConfig(
  provider: LLMProvider,
  model: string,
  source: "primary" | "fallback"
): ProviderRuntimeConfig {
  if (provider === "deepseek") {
    const baseUrl =
      ENV.deepseekBaseUrl?.trim().length > 0
        ? ENV.deepseekBaseUrl
        : DEEPSEEK_DEFAULT_BASE_URL;
    return {
      provider,
      model,
      apiKey: ENV.deepseekApiKey,
      apiUrl: `${baseUrl.replace(/\/$/, "")}/chat/completions`,
      source,
    };
  }

  return {
    provider,
    model,
    apiKey: ENV.forgeApiKey,
    apiUrl:
      ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
        ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
        : FORGE_DEFAULT_URL,
    source,
  };
}

function getPrimaryConfig(modelOverride?: string): ProviderRuntimeConfig {
  const provider = normalizeProvider(ENV.aiPrimaryProvider);
  return resolveProviderConfig(
    provider,
    modelOverride || ENV.aiPrimaryModel || "deepseek-chat",
    "primary"
  );
}

function getFallbackConfig(): ProviderRuntimeConfig {
  const provider = normalizeProvider(ENV.aiFallbackProvider);
  const model = ENV.aiFallbackModel || "gemini-2.5-flash";
  return resolveProviderConfig(provider, model, "fallback");
}

function isDuplicateProviderConfig(
  primaryConfig: ProviderRuntimeConfig,
  fallbackConfig: ProviderRuntimeConfig
): boolean {
  return (
    primaryConfig.provider === fallbackConfig.provider &&
    primaryConfig.model === fallbackConfig.model &&
    primaryConfig.apiUrl === fallbackConfig.apiUrl
  );
}

function assertProviderApiKey(config: ProviderRuntimeConfig): void {
  if (config.apiKey?.trim()) return;
  if (config.provider === "deepseek") {
    throw new LLMProviderConfigurationError("deepseek", "DEEPSEEK_API_KEY");
  }
  throw new LLMProviderConfigurationError("forge", "BUILT_IN_FORGE_API_KEY");
}

export function isLLMProviderConfigurationError(
  error: unknown
): error is LLMProviderConfigurationError {
  return (
    error instanceof LLMProviderConfigurationError ||
    (error instanceof Error && error.name === "LLMProviderConfigurationError")
  );
}

function shouldFallback(error: unknown): boolean {
  // 运行被取消（用户取消 / 预算耗尽）不是 provider 故障：
  // 不要换 provider 重试，直接上抛，否则取消会被一次完整重试吞掉
  if (isRunAborted()) {
    return false;
  }

  if (error instanceof LLMHttpError) {
    if (
      error.provider === "deepseek" &&
      error.status === 400 &&
      isToolCallSequenceError(error.responseBody)
    ) {
      return true;
    }
    return error.status === 429 || error.status >= 500;
  }

  if (error instanceof TypeError) {
    return true;
  }

  if (isTimeoutLikeError(error)) {
    return true;
  }

  return false;
}

function isTimeoutLikeError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("name" in error)) {
    return false;
  }

  const name = String((error as { name?: unknown }).name);
  return name === "AbortError" || name === "TimeoutError";
}

function isToolCallSequenceError(responseBody: string): boolean {
  const text = responseBody.toLowerCase();
  return (
    text.includes("role 'tool'") ||
    text.includes('role "tool"') ||
    text.includes("tool_calls") ||
    text.includes("tool call")
  );
}

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

/**
 * 构建基础 payload（模型名按 config 注入）。
 * invokeLLM 与 invokeLLMStream 共用，保证流式与非流式请求体一致。
 */
function buildBasePayload(
  params: InvokeParams,
  config: ProviderRuntimeConfig
): { payload: Record<string, unknown>; hasToolCallsInRequest: boolean } {
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    maxTokens,
    max_tokens,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  const hasToolCallsInRequest = messages.some(
    msg =>
      msg.role === "assistant" && !!msg.tool_calls && msg.tool_calls.length > 0
  );

  const payload: Record<string, unknown> = {
    model: config.model,
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  // 根据提供商设置合适的 max_tokens 默认值
  // DeepSeek 限制为 8192，Forge 支持更大值
  const defaultMaxTokens = config.provider === "deepseek" ? 4096 : 32768;
  payload.max_tokens =
    maxTokens || max_tokens || ENV.aiMaxTokens || defaultMaxTokens;

  if (config.provider === "forge") {
    payload.thinking = {
      budget_tokens: 128,
    };
  }

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  return { payload, hasToolCallsInRequest };
}

/** 按 provider 施加差异调整（deepseek 删 tools/tool_choice、json_schema 回退等） */
function applyProviderAdjustments(
  payload: Record<string, unknown>,
  config: ProviderRuntimeConfig
): void {
  if (config.provider === "forge") {
    payload.thinking = {
      budget_tokens: 128,
    };
  } else {
    delete payload.thinking;
    delete payload.tools;
    delete payload.tool_choice;
    if (typeof ENV.deepseekChatTemplateThinking === "boolean") {
      payload.chat_template_kwargs = {
        thinking: ENV.deepseekChatTemplateThinking,
      };
    }
    // DeepSeek 目前不支持 json_schema 格式，回退到 text
    if (config.provider === "deepseek" && payload.response_format) {
      const format = payload.response_format as { type: string };
      if (format.type === "json_schema") {
        // 移除不支持的 json_schema 格式
        delete payload.response_format;
      }
    }
  }
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const primaryConfig = getPrimaryConfig(params.model);
  const fallbackConfig = getFallbackConfig();
  assertProviderApiKey(primaryConfig);

  const { payload, hasToolCallsInRequest } = buildBasePayload(
    params,
    primaryConfig
  );

  const callProvider = async (
    config: ProviderRuntimeConfig,
    attemptedFallback: boolean
  ): Promise<InvokeResult> => {
    assertProviderApiKey(config);
    const providerPayload: Record<string, unknown> = {
      ...payload,
      model: config.model,
    };

    applyProviderAdjustments(providerPayload, config);

    return traceSpan(
      "llm.chat.completions",
      async () => {
        const response = await fetch(config.apiUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify(providerPayload),
          signal: mergeAbortSignals(
            AbortSignal.timeout(
              ENV.aiRequestTimeoutMs || DEFAULT_LLM_REQUEST_TIMEOUT_MS
            ),
            getRunControl().signal
          ),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new LLMHttpError(
            config.provider,
            response.status,
            response.statusText,
            errorText
          );
        }

        return (await response.json()) as InvokeResult;
      },
      {
        runType: "llm",
        tags: [
          `provider:${config.provider}`,
          `model:${config.model}`,
          `source:${config.source}`,
        ],
        metadata: {
          ls_provider: config.provider,
          ls_model_name: config.model,
          ls_invocation_params: {
            max_tokens: providerPayload.max_tokens,
            tool_choice: providerPayload.tool_choice,
            response_format: providerPayload.response_format,
            has_assistant_tool_calls: hasToolCallsInRequest,
          },
          llm_source: config.source,
          llm_fallback_attempted: attemptedFallback,
        },
      }
    );
  };

  return traceSpan("invokeLLM", async () => {
    const primaryStartedAt = Date.now();
    try {
      return await callProvider(primaryConfig, false);
    } catch (error) {
      if (!shouldFallback(error)) {
        throw error;
      }

      if (isDuplicateProviderConfig(primaryConfig, fallbackConfig)) {
        console.warn(
          `[invokeLLM] skipped duplicate fallback for ${fallbackConfig.provider}:${fallbackConfig.model}, primary=${primaryConfig.provider}:${primaryConfig.model}, elapsed_ms=${Date.now() - primaryStartedAt}, has_tool_calls=${hasToolCallsInRequest}`
        );
        throw error;
      }

      assertProviderApiKey(fallbackConfig);
      const fallbackReason =
        error instanceof LLMHttpError
          ? error.status === 429 || error.status >= 500
            ? "http_retryable"
            : error.provider === "deepseek" &&
                error.status === 400 &&
                isToolCallSequenceError(error.responseBody)
              ? "deepseek_tool_sequence_400"
              : "other_http"
          : error instanceof TypeError
            ? "network_type_error"
            : isTimeoutLikeError(error)
              ? "timeout_error"
              : "unknown";

      console.warn(
        `[invokeLLM] fallback to ${fallbackConfig.provider}:${fallbackConfig.model}, reason=${fallbackReason}, primary=${primaryConfig.provider}:${primaryConfig.model}, elapsed_ms=${Date.now() - primaryStartedAt}, has_tool_calls=${hasToolCallsInRequest}`
      );
      return await callProvider(fallbackConfig, true);
    }
  });
}

/** 流式增量的单次产出 */
export interface StreamChunk {
  /** 增量文本（delta.content） */
  text: string;
  finishReason: string | null;
  toolCallDeltas: Array<{
    index: number;
    id?: string;
    functionName?: string;
    argumentsDelta: string;
  }>;
  usage?: InvokeResult["usage"];
}

/**
 * 流式 LLM 调用（OpenAI 兼容 SSE）。
 *
 * 与 invokeLLM 共用 payload 构建；故障转移只在首 chunk 前生效 ——
 * 一旦开始产出，错误直接上抛（参考.md 2.1）。
 *
 * ponytail: 暂不接 LangSmith span（traceable 面向返回 Promise 的函数，
 * 流式观测待 A6 计量时统一处理）。
 */
export async function* invokeLLMStream(
  params: InvokeParams
): AsyncGenerator<StreamChunk> {
  const primaryConfig = getPrimaryConfig(params.model);
  const fallbackConfig = getFallbackConfig();
  assertProviderApiKey(primaryConfig);

  const { payload } = buildBasePayload(params, primaryConfig);

  const streamProvider = async function* (
    config: ProviderRuntimeConfig
  ): AsyncGenerator<StreamChunk> {
    assertProviderApiKey(config);
    const providerPayload: Record<string, unknown> = {
      ...payload,
      model: config.model,
      stream: true,
    };
    applyProviderAdjustments(providerPayload, config);

    // 协议白名单：provider 端点来自 ENV 配置，但保持 fail-closed ——
    // 若未来端点可被请求输入影响，这里直接拒绝非法 URL 与非 http(s) 协议
    let endpoint: URL;
    try {
      endpoint = new URL(config.apiUrl);
    } catch {
      throw new Error(`[${config.provider}] 非法的 API 端点: ${config.apiUrl}`);
    }
    if (endpoint.protocol !== "https:" && endpoint.protocol !== "http:") {
      throw new Error(
        `[${config.provider}] 非法的 API 端点协议: ${endpoint.protocol}`
      );
    }

    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(providerPayload),
      signal: mergeAbortSignals(
        AbortSignal.timeout(
          ENV.aiRequestTimeoutMs || DEFAULT_LLM_REQUEST_TIMEOUT_MS
        ),
        getRunControl().signal
      ),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new LLMHttpError(
        config.provider,
        response.status,
        response.statusText,
        errorText
      );
    }

    if (!response.body) {
      throw new Error(`[${config.provider}] 流式响应缺少 body`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf("\n\n");

          const dataLine = frame
            .split("\n")
            .find(line => line.startsWith("data: "));
          if (!dataLine) {
            continue;
          }

          const raw = dataLine.slice("data: ".length);
          if (raw.trim() === "[DONE]") {
            return;
          }

          let parsed: unknown;
          try {
            parsed = JSON.parse(raw);
          } catch {
            continue;
          }

          const chunk = parsed as {
            choices?: Array<{
              delta?: {
                content?: unknown;
                tool_calls?: Array<{
                  index?: unknown;
                  id?: unknown;
                  function?: { name?: unknown; arguments?: unknown };
                }>;
              };
              finish_reason?: unknown;
            }>;
            usage?: InvokeResult["usage"];
          };

          const choice = chunk.choices?.[0];
          if (!choice) {
            continue;
          }

          yield {
            text:
              typeof choice.delta?.content === "string"
                ? choice.delta.content
                : "",
            finishReason:
              typeof choice.finish_reason === "string"
                ? choice.finish_reason
                : null,
            toolCallDeltas: (choice.delta?.tool_calls ?? []).map(tc => ({
              index: typeof tc.index === "number" ? tc.index : 0,
              ...(typeof tc.id === "string" ? { id: tc.id } : {}),
              ...(typeof tc.function?.name === "string"
                ? { functionName: tc.function.name }
                : {}),
              argumentsDelta:
                typeof tc.function?.arguments === "string"
                  ? tc.function.arguments
                  : "",
            })),
            ...(chunk.usage ? { usage: chunk.usage } : {}),
          };
        }
      }
    } finally {
      reader.releaseLock();
    }
  };

  // 故障转移只在首 chunk 前生效：一旦开始产出，错误直接上抛
  let started = false;
  let iterator = streamProvider(primaryConfig);

  while (true) {
    try {
      const next = await iterator.next();
      if (next.done) {
        return;
      }
      started = true;
      yield next.value;
    } catch (error) {
      if (
        started ||
        !shouldFallback(error) ||
        isDuplicateProviderConfig(primaryConfig, fallbackConfig)
      ) {
        throw error;
      }

      assertProviderApiKey(fallbackConfig);
      console.warn(
        `[invokeLLMStream] fallback to ${fallbackConfig.provider}:${fallbackConfig.model} before first chunk`
      );
      iterator = streamProvider(fallbackConfig);
    }
  }
}
