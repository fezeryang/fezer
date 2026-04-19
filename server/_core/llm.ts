import { ENV } from "./env";
import { traceSpan } from "./observability/langsmith";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

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

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  model?: string;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

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

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

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
  const { role, name, tool_call_id } = message;

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

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
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

function getFallbackConfig(primary: ProviderRuntimeConfig): ProviderRuntimeConfig {
  const provider = normalizeProvider(ENV.aiFallbackProvider);
  const model = ENV.aiFallbackModel || "gemini-2.5-flash";
  const fallback = resolveProviderConfig(provider, model, "fallback");

  // Avoid retrying the exact same provider/model pair.
  if (
    fallback.provider === primary.provider &&
    fallback.model === primary.model
  ) {
    return resolveProviderConfig(
      primary.provider === "deepseek" ? "forge" : "deepseek",
      primary.provider === "deepseek" ? "gemini-2.5-flash" : "deepseek-chat",
      "fallback"
    );
  }

  return fallback;
}

function assertProviderApiKey(config: ProviderRuntimeConfig): void {
  if (config.apiKey?.trim()) return;
  if (config.provider === "deepseek") {
    throw new Error("DEEPSEEK_API_KEY is not configured");
  }
  throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
}

function shouldFallback(error: unknown): boolean {
  if (error instanceof LLMHttpError) {
    return error.status === 429 || error.status >= 500;
  }

  if (error instanceof TypeError) {
    return true;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return true;
  }

  return false;
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
  const fallbackConfig = getFallbackConfig(primaryConfig);
  assertProviderApiKey(primaryConfig);

  const payload: Record<string, unknown> = {
    model: primaryConfig.model,
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

  payload.max_tokens = maxTokens || max_tokens || 32768;

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
          },
          llm_source: config.source,
          llm_fallback_attempted: attemptedFallback,
        },
      }
    );
  };

  return traceSpan("invokeLLM", async () => {
    try {
      return await callProvider(primaryConfig, false);
    } catch (error) {
      if (!shouldFallback(error)) {
        throw error;
      }

      assertProviderApiKey(fallbackConfig);
      return await callProvider(fallbackConfig, true);
    }
  });
}
