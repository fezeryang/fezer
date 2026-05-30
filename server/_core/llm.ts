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
    public readonly configVariable: "DEEPSEEK_API_KEY" | "BUILT_IN_FORGE_API_KEY"
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

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    model,
    maxTokens,
    max_tokens,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  const primaryConfig = getPrimaryConfig(model);
  const fallbackConfig = getFallbackConfig();
  assertProviderApiKey(primaryConfig);

  const payload: Record<string, unknown> = {
    model: primaryConfig.model,
    messages: messages.map(normalizeMessage),
  };
  const hasToolCallsInRequest = messages.some(
    msg =>
      msg.role === "assistant" && !!msg.tool_calls && msg.tool_calls.length > 0
  );

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
  const defaultMaxTokens = primaryConfig.provider === "deepseek" ? 4096 : 32768;
  payload.max_tokens =
    maxTokens || max_tokens || ENV.aiMaxTokens || defaultMaxTokens;

  if (primaryConfig.provider === "forge") {
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

  const callProvider = async (
    config: ProviderRuntimeConfig,
    attemptedFallback: boolean
  ): Promise<InvokeResult> => {
    assertProviderApiKey(config);
    const providerPayload: Record<string, unknown> = {
      ...payload,
      model: config.model,
    };

    if (config.provider === "forge") {
      providerPayload.thinking = {
        budget_tokens: 128,
      };
    } else {
      delete providerPayload.thinking;
      delete providerPayload.tools;
      delete providerPayload.tool_choice;
      if (typeof ENV.deepseekChatTemplateThinking === "boolean") {
        providerPayload.chat_template_kwargs = {
          thinking: ENV.deepseekChatTemplateThinking,
        };
      }
      // DeepSeek 目前不支持 json_schema 格式，回退到 text
      if (config.provider === "deepseek" && providerPayload.response_format) {
        const format = providerPayload.response_format as { type: string };
        if (format.type === "json_schema") {
          // 移除不支持的 json_schema 格式
          delete providerPayload.response_format;
        }
      }
    }

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
          signal: AbortSignal.timeout(
            ENV.aiRequestTimeoutMs || DEFAULT_LLM_REQUEST_TIMEOUT_MS
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
