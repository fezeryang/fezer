/**
 * Agent Factory - 统一的专家 Agent 创建和调用接口
 */

import type { AgentId } from "../tools/agent.tool";
import { setAgentInvoker, runWithAgentToolContext } from "../tools/agent.tool";
import type { ConversationTurn } from "@fezer/shared/schemas/agent";
import {
  invokeLLM,
  invokeLLMStream,
  isLLMProviderConfigurationError,
  type InvokeResult,
  type Message,
  type Tool as LLMTool,
} from "../../_core/llm";
import {
  AGENT_DISPLAY_NAMES,
  buildAgentSystemPrompt,
  CHARACTER_PROMPT_FRAMEWORK_VERSION,
} from "@fezer/shared/characters";
import {
  runWithTraceContext,
  traceSpan,
} from "../../_core/observability/langsmith";
import {
  getLLMToolsByNames,
  getToolExecutionRegistry,
  type ExecutableTool,
} from "../tools";
import { emitRunEvent } from "../../_core/run-events";
import { assertRunNotAborted, getRunControl } from "../../_core/run-control";
import { randomUUID } from "node:crypto";

/**
 * Agent 调用选项
 */
export interface AgentInvokeOptions {
  /**
   * agent 间协作的嵌套深度（顶层请求为 0/未定义）。
   * 深度 >= 1 时隐藏通信工具，硬性阻断递归咨询。
   */
  consultDepth?: number;
  context?: {
    /** 多轮会话历史（不含当前输入），按时间升序 */
    conversationHistory?: ConversationTurn[];
    fromAgent?: string;
    grounding?: "public_profile";
  };
}

/**
 * Agent 响应
 */
export interface AgentResponse {
  answer: string;
  uiAction?: {
    panel?: string;
    suggestedQuestions?: string[];
    suggestedNextCharacterIds?: AgentId[];
  };
}

/**
 * 专家 Agent 工具配置
 *
 * 导出是为了让测试能校验「注册的工具集」与「白名单」双向一致；
 * 运行时只应通过 getLLMToolsByNames 消费它。
 */
export const AGENT_TOOL_CONFIGS: Record<
  AgentId,
  { tools: string[]; canConsult: AgentId[] }
> = {
  core: {
    tools: [
      "get_profile",
      "get_skills",
      "get_projects",
      "search_content",
      "get_blog_posts",
      "get_works_detail",
      "get_profile_full",
      "ask_other_agent",
      "ask_multiple_agents",
    ],
    canConsult: ["builder", "ai", "writer", "reader", "visual", "wanderer"],
  },
  builder: {
    tools: [
      "get_profile",
      "get_skills",
      "get_projects",
      "search_content",
      "get_works_detail",
      "get_profile_full",
      "ask_other_agent",
    ],
    canConsult: ["ai", "writer"],
  },
  ai: {
    tools: [
      "get_profile",
      "get_skills",
      "get_projects",
      "search_content",
      "get_works_detail",
      "get_profile_full",
      "ask_other_agent",
    ],
    canConsult: ["builder", "reader"],
  },
  writer: {
    tools: [
      "get_profile",
      "get_skills",
      "get_interests",
      "search_content",
      "get_blog_posts",
      "get_profile_full",
      "ask_other_agent",
    ],
    canConsult: ["reader", "visual"],
  },
  reader: {
    tools: [
      "get_profile",
      "get_interests",
      "search_content",
      "get_blog_posts",
      "get_profile_full",
      "ask_other_agent",
    ],
    canConsult: ["writer", "wanderer"],
  },
  visual: {
    tools: [
      "get_profile",
      "get_skills",
      "get_interests",
      "search_content",
      "get_works_detail",
      "get_profile_full",
      "ask_other_agent",
    ],
    canConsult: ["writer", "wanderer"],
  },
  wanderer: {
    tools: [
      "get_profile",
      "get_interests",
      "search_content",
      "get_blog_posts",
      "get_profile_full",
      "ask_other_agent",
    ],
    canConsult: ["reader", "visual"],
  },
};

const MAX_TOOL_CALL_LOOPS = 3;
/** 嵌套咨询最大深度（顶层为 0，允许 1 层 agent 互调） */
const MAX_CONSULT_DEPTH = 1;
const TOOL_CONTEXT_CHAR_LIMIT = 6000;
const TOOL_RESULT_CHAR_LIMIT = 1200;
const PROFILE_TOOL_RESULT_CHAR_LIMIT = 5000;
const PUBLIC_PROFILE_GROUNDING_POLICY = [
  "【公开简历事实约束】",
  "你正在回答 /jianli 互动简历中的问题。关于 Fezer 的身份、教育、技能、项目、实习、实践、联系方式和隐私边界，唯一事实来源是服务器预取的 get_profile_full/get_profile/get_skills/get_projects 等工具结果。",
  "角色、房间、表达风格只影响语气和侧重点，不能覆盖或补充简历事实。",
  "资料没有明确写出的内容，必须回答“目前公开简历资料里没有明确依据”，不能编造、合理推断或使用模型常识补全。",
  "不得使用旧模板或占位信息，例如 fezer@example.com、某科技公司、某大学、全栈开发者 & AI 探索者。",
].join("\n");

type DirectToolRequest = {
  name: string;
  input: Record<string, unknown>;
};

type AgentToolPlan = {
  directToolRequests: DirectToolRequest[];
  dynamicToolNames: string[];
};

const AGENT_COMMUNICATION_TOOLS = new Set([
  "ask_other_agent",
  "ask_multiple_agents",
]);

const containsAny = (text: string, keywords: string[]) =>
  keywords.some(keyword => text.includes(keyword));

function stableStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function truncateText(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit)}...`;
}

function dedupeDirectToolRequests(
  requests: DirectToolRequest[]
): DirectToolRequest[] {
  const seen = new Set<string>();
  const deduped: DirectToolRequest[] = [];

  for (const request of requests) {
    const key = `${request.name}:${stableStringify(request.input)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(request);
  }

  return deduped;
}

function inferProjectCategory(
  text: string
): "frontend" | "backend" | "ai" | "fullstack" | "all" {
  if (containsAny(text, ["前端", "react", "ui", "frontend"])) return "frontend";
  if (containsAny(text, ["后端", "api", "server", "backend"])) return "backend";
  if (containsAny(text, ["ai", "llm", "agent", "langchain", "人工智能"]))
    return "ai";
  if (containsAny(text, ["全栈", "fullstack", "full stack"]))
    return "fullstack";
  return "all";
}

function buildDirectToolRequests(
  agentId: AgentId,
  input: string
): DirectToolRequest[] {
  const text = input.toLowerCase();
  const requests: DirectToolRequest[] = [];
  const add = (name: string, toolInput: Record<string, unknown> = {}) => {
    requests.push({ name, input: toolInput });
  };

  const wantsProfile = containsAny(text, [
    "你是谁",
    "是谁",
    "介绍",
    "简历",
    "经历",
    "背景",
    "核心能力",
    "关于你",
    "about",
    "resume",
    "profile",
  ]);
  const wantsSkills = containsAny(text, [
    "技能",
    "技术",
    "技术栈",
    "会什么",
    "能力",
    "前端",
    "后端",
    "ai",
    "llm",
    "agent",
    "langchain",
    "开发",
  ]);
  const wantsProjects = containsAny(text, [
    "项目",
    "作品",
    "案例",
    "portfolio",
    "work",
    "做过",
  ]);
  const wantsBlog = containsAny(text, [
    "博客",
    "文章",
    "写作",
    "内容",
    "最近写",
    "blog",
    "post",
  ]);
  const wantsGuide = containsAny(text, [
    "怎么逛",
    "如何开始",
    "导览",
    "这里",
    "这个网站",
    "3d",
    "空间",
    "房间",
  ]);
  const wantsContact = containsAny(text, ["联系", "邮箱", "email", "contact"]);

  // 全量结构化简历是重上下文（~5000 字），只在明确涉及个人资料/导览意图时预取；
  // 其余情况模型可通过常驻检索工具按需获取
  if (wantsProfile || wantsGuide || agentId === "core") {
    add("get_profile_full", { locale: "zh-CN" });
  }

  if (wantsProfile || (agentId === "core" && wantsGuide)) {
    add("get_profile", { includeDetails: false });
    add("get_skills", { category: "all" });
    add("get_projects", { category: "all", limit: 3 });
  }

  if (wantsSkills) {
    const category = inferProjectCategory(text);
    add("get_skills", { category: "all" });
    add("get_projects", { category, limit: 4 });
    add("search_content", { query: input, topK: 3, category: "profile" });
  }

  if (wantsProjects) {
    const category = inferProjectCategory(text);
    add("get_projects", { category, limit: 5 });
    add("get_works_detail", { limit: 5 });
    add("search_content", { query: input, topK: 3, category: "work" });
  }

  if (wantsBlog) {
    add("get_blog_posts", { limit: 5 });
    add("search_content", { query: input, topK: 3, category: "blog" });
  }

  if (wantsGuide) {
    add("search_content", { query: input, topK: 3, category: "profile" });
  }

  if (wantsContact) {
    add("get_contact_info", {});
  }

  return dedupeDirectToolRequests(requests);
}

/**
 * 动态工具集：按 agent 白名单常驻暴露，模型可自主决定何时检索。
 * 嵌套咨询层（consultDepth >= 1）剔除通信工具，硬性阻断递归。
 */
function buildDynamicToolNames(
  agentId: AgentId,
  consultDepth: number
): string[] {
  const allowed = AGENT_TOOL_CONFIGS[agentId].tools;
  return allowed.filter(
    name =>
      !(
        consultDepth >= MAX_CONSULT_DEPTH && AGENT_COMMUNICATION_TOOLS.has(name)
      )
  );
}

function buildAgentToolPlan(
  agentId: AgentId,
  input: string,
  consultDepth: number
): AgentToolPlan {
  return {
    directToolRequests: buildDirectToolRequests(agentId, input),
    dynamicToolNames: buildDynamicToolNames(agentId, consultDepth),
  };
}

async function buildDirectToolContext(
  registry: Map<string, ExecutableTool>,
  requests: DirectToolRequest[]
): Promise<string | undefined> {
  const blocks: string[] = [];

  for (const request of requests) {
    if (AGENT_COMMUNICATION_TOOLS.has(request.name)) {
      continue;
    }

    const executableTool = registry.get(request.name);
    if (!executableTool) {
      continue;
    }

    emitRunEvent({
      type: "tool.call",
      toolName: request.name,
      args: request.input,
    });

    const { ok, content } = await traceSpan(
      `tool.prefetch.${request.name}`,
      async () => {
        try {
          const data = await executableTool.invoke(request.input);
          return {
            ok: true,
            content: stableStringify({ success: true, data }),
          };
        } catch (error) {
          return {
            ok: false,
            content: stableStringify({
              success: false,
              error:
                error instanceof Error ? error.message : "Unknown tool error",
            }),
          };
        }
      },
      {
        runType: "tool",
        metadata: {
          toolName: request.name,
          toolArgs: request.input,
          source: "server_prefetch",
        },
        tags: [`tool:${request.name}`, "tool:server_prefetch"],
      }
    );

    const resultLimit =
      request.name === "get_profile_full"
        ? PROFILE_TOOL_RESULT_CHAR_LIMIT
        : TOOL_RESULT_CHAR_LIMIT;

    emitRunEvent({
      type: "tool.result",
      toolName: request.name,
      ok,
      truncated: content.length > resultLimit,
      bytes: content.length,
    });

    blocks.push(`[${request.name}] ${truncateText(content, resultLimit)}`);
  }

  if (blocks.length === 0) {
    return undefined;
  }

  return truncateText(
    [
      "服务器已预先检索到的真实个人资料如下。回答时必须优先依据这些资料；资料不足时明确说明不确定，不得编造。",
      ...blocks,
    ].join("\n\n"),
    TOOL_CONTEXT_CHAR_LIMIT
  );
}

/**
 * 创建专家 Agent 的系统提示
 */
function createAgentSystemPrompt(agentId: AgentId): string {
  const config = AGENT_TOOL_CONFIGS[agentId];

  return buildAgentSystemPrompt(agentId, {
    interactionMode: agentId === "core" ? "core-routing" : "expert-answering",
    responseDepth: "standard",
    enforceOutputContract: true,
    availableTools: config.tools,
    consultableAgents: config.canConsult.map(id => ({
      id,
      description: getAgentRoleDescription(id),
    })),
  });
}

function getAgentRoleDescription(agentId: AgentId): string {
  const descriptions: Record<AgentId, string> = {
    core: "全局导览员，了解整体情况",
    builder: "技术实现专家，精通前端、后端、工程化",
    ai: "AI 应用专家，熟悉 LLM、LangChain",
    writer: "写作专家，擅长内容创作和表达",
    reader: "思考专家，深度阅读和知识管理",
    visual: "设计专家，UI/UX 和视觉设计",
    wanderer: "探索专家，旅行和生活体验",
  };
  return descriptions[agentId];
}

/**
 * 简化的 Agent 实现
 * 由于当前环境限制，使用直接 LLM 调用而非完整的 LangGraph Agent
 */
/**
 * 流式调用并组装成与非流式一致的结果；文本增量以 text.delta 事件实时发出。
 *
 * 工具调用参数在流式下按 index 增量拼接，与 OpenAI 兼容协议一致。
 */
async function streamInvokeLLM(
  messages: Message[],
  llmTools: LLMTool[]
): Promise<InvokeResult> {
  let content = "";
  const toolCalls = new Map<
    number,
    { id: string; name: string; args: string }
  >();
  let finishReason: string | null = null;
  let usage: InvokeResult["usage"];

  const messageId = `assistant-stream-${randomUUID()}`;

  for await (const chunk of invokeLLMStream({
    messages,
    tools: llmTools.length > 0 ? llmTools : undefined,
    tool_choice: llmTools.length > 0 ? "auto" : undefined,
  })) {
    if (chunk.text) {
      content += chunk.text;
      emitRunEvent({ type: "text.delta", messageId, delta: chunk.text });
    }

    for (const delta of chunk.toolCallDeltas) {
      const current = toolCalls.get(delta.index) ?? {
        id: "",
        name: "",
        args: "",
      };
      if (delta.id) current.id = delta.id;
      if (delta.functionName) current.name = delta.functionName;
      current.args += delta.argumentsDelta;
      toolCalls.set(delta.index, current);
    }

    if (chunk.finishReason) finishReason = chunk.finishReason;
    if (chunk.usage) usage = chunk.usage;
  }

  return {
    id: "",
    created: 0,
    model: "",
    usage,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content,
          ...(toolCalls.size > 0
            ? {
                tool_calls: [...toolCalls.entries()]
                  .sort(([a], [b]) => a - b)
                  .map(([, toolCall]) => ({
                    id: toolCall.id,
                    type: "function" as const,
                    function: {
                      name: toolCall.name,
                      arguments: toolCall.args,
                    },
                  })),
              }
            : {}),
        },
        finish_reason: finishReason,
      },
    ],
  };
}

async function invokeAgentInternal(
  agentId: AgentId,
  input: string,
  options?: AgentInvokeOptions
): Promise<AgentResponse> {
  return runWithTraceContext(
    {
      agentId,
      promptKey: `character/${agentId}`,
      promptVersion: CHARACTER_PROMPT_FRAMEWORK_VERSION,
      promptTag: "stage1",
    },
    async () =>
      traceSpan("expert.invokeAgent", async () => {
        const systemPrompt = createAgentSystemPrompt(agentId);
        const consultDepth = options?.consultDepth ?? 0;
        const conversationHistory = sanitizeConversationHistory(
          options?.context?.conversationHistory
        );
        const executableToolRegistry = getToolExecutionRegistry();
        const toolPlan = buildAgentToolPlan(agentId, input, consultDepth);
        const directToolContext = await buildDirectToolContext(
          executableToolRegistry,
          toolPlan.directToolRequests
        );
        const llmTools =
          toolPlan.dynamicToolNames.length > 0
            ? getLLMToolsByNames(toolPlan.dynamicToolNames)
            : [];

        // 消息构建：系统提示 → grounding 约束 → 预取上下文 → 结构化会话历史 → 当前输入（仅一份）
        // 当前输入不再经由 LangChain messages 通道重复注入
        const messages: Message[] = [
          { role: "system", content: systemPrompt },
          ...(options?.context?.grounding === "public_profile"
            ? [
                {
                  role: "system" as const,
                  content: PUBLIC_PROFILE_GROUNDING_POLICY,
                },
              ]
            : []),
          ...(directToolContext
            ? [{ role: "system" as const, content: directToolContext }]
            : []),
          ...conversationHistory.map(turn => ({
            role: turn.role,
            content: turn.content,
          })),
          { role: "user", content: input },
        ];

        let lastAssistantAnswer = "抱歉，我暂时无法回答。";
        let loopCount = 0;
        // 预算里的 maxTurns 覆盖默认循环上限；取消信号在每轮开始前检查
        const maxToolLoops =
          getRunControl().maxToolLoops ?? MAX_TOOL_CALL_LOOPS;
        // 流式开关：harness 按调用方请求设置（SSE 路由 stream: true）
        const streamText = getRunControl().streamText === true;

        while (loopCount < maxToolLoops) {
          assertRunNotAborted();

          const result = streamText
            ? await streamInvokeLLM(messages, llmTools)
            : await invokeLLM({
                messages,
                tools: llmTools.length > 0 ? llmTools : undefined,
                tool_choice: llmTools.length > 0 ? "auto" : undefined,
              });

          const assistantMessage = result.choices[0]?.message;
          if (!assistantMessage) {
            break;
          }

          const normalizedAssistantContent =
            typeof assistantMessage.content === "string"
              ? assistantMessage.content
              : JSON.stringify(assistantMessage.content);

          if (normalizedAssistantContent) {
            lastAssistantAnswer = normalizedAssistantContent;
          }

          const toolCalls = assistantMessage.tool_calls || [];
          const hasInvalidToolCall = toolCalls.some(
            toolCall =>
              !toolCall?.id ||
              !toolCall?.function?.name ||
              typeof toolCall.function.arguments !== "string"
          );

          if (hasInvalidToolCall) {
            return {
              answer:
                "抱歉，本次工具调用格式异常，我先给你基于当前信息的回答。",
              uiAction: {
                suggestedQuestions: extractSuggestedQuestions(agentId),
              },
            };
          }

          messages.push({
            role: "assistant",
            content: normalizedAssistantContent || "",
            ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
          });

          if (toolCalls.length === 0) {
            // 完成回答
            return {
              answer: lastAssistantAnswer,
              uiAction: {
                suggestedQuestions: extractSuggestedQuestions(agentId),
              },
            };
          }

          // 工具串行执行，保证确定性
          for (const toolCall of toolCalls) {
            const toolName = toolCall.function.name;
            const executableTool = executableToolRegistry.get(toolName);
            const isAllowed = toolPlan.dynamicToolNames.includes(toolName);

            if (!executableTool || !isAllowed) {
              const deniedContent = JSON.stringify({
                success: false,
                error: `Tool not allowed or not found: ${toolName}`,
              });
              // 拒绝也进事件流：模型越权或调用不存在的工具，是排障和展示都要看到的
              emitRunEvent({ type: "tool.call", toolName, args: {} });
              emitRunEvent({
                type: "tool.result",
                toolName,
                ok: false,
                truncated: false,
                bytes: deniedContent.length,
              });
              messages.push({
                role: "tool",
                name: toolName,
                tool_call_id: toolCall.id,
                content: deniedContent,
              });
              continue;
            }

            let parsedArgs: Record<string, unknown> = {};
            try {
              parsedArgs = toolCall.function.arguments
                ? (JSON.parse(toolCall.function.arguments) as Record<
                    string,
                    unknown
                  >)
                : {};
            } catch {
              parsedArgs = {};
            }

            emitRunEvent({
              type: "tool.call",
              toolName,
              args: parsedArgs,
            });

            const toolResult = await traceSpan(
              `tool.${toolName}`,
              () =>
                runWithAgentToolContext(
                  {
                    callerAgentId: agentId,
                    consultDepth,
                    grounding: options?.context?.grounding,
                    conversationHistory,
                  },
                  async () => {
                    try {
                      const data = await executableTool.invoke(parsedArgs);
                      return {
                        success: true,
                        data,
                      };
                    } catch (error) {
                      return {
                        success: false,
                        error:
                          error instanceof Error
                            ? error.message
                            : "Unknown tool error",
                      };
                    }
                  }
                ),
              {
                runType: "tool",
                metadata: {
                  toolName,
                  toolArgs: parsedArgs,
                },
                tags: [`tool:${toolName}`],
              }
            );

            const serialized = stableStringify(toolResult);

            emitRunEvent({
              type: "tool.result",
              toolName,
              ok: toolResult.success === true,
              // ponytail: 循环内的工具结果目前不截断（只有预取会截断），
              // 上下文预算归 A6 统一处理；此处如实上报 truncated=false。
              truncated: false,
              bytes: serialized.length,
            });

            messages.push({
              role: "tool",
              name: toolName,
              tool_call_id: toolCall.id,
              content: serialized,
            });
          }

          loopCount += 1;
        }

        const fallbackAnswer = lastAssistantAnswer || "抱歉，我暂时无法回答。";

        // 提取 UI 提示（简单实现）
        return {
          answer:
            loopCount >= maxToolLoops
              ? `${fallbackAnswer}\n\n（已达到工具调用上限，返回当前结果）`
              : fallbackAnswer,
          uiAction: {
            suggestedQuestions: extractSuggestedQuestions(agentId),
          },
        };
      })
  );
}

const MAX_CONVERSATION_TURNS = 8;
const MAX_CONVERSATION_TURN_CHARS = 4000;

/**
 * 会话历史的信任边界：只接受 user/assistant 轮、截断条数与长度、丢弃空内容。
 */
function sanitizeConversationHistory(
  history: ConversationTurn[] | undefined
): ConversationTurn[] {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter(
      turn =>
        turn != null &&
        (turn.role === "user" || turn.role === "assistant") &&
        typeof turn.content === "string" &&
        turn.content.trim().length > 0
    )
    .slice(-MAX_CONVERSATION_TURNS)
    .map(turn => ({
      role: turn.role,
      content: turn.content.slice(0, MAX_CONVERSATION_TURN_CHARS),
      ...(turn.agentId ? { agentId: turn.agentId } : {}),
    }));
}

/**
 * 提取建议问题
 */
function extractSuggestedQuestions(agentId: AgentId): string[] {
  const questions: Record<AgentId, string[]> = {
    core: [
      "这是什么样的简历展示？",
      "我该从哪里开始探索？",
      "介绍一下 Fezer 的核心能力",
    ],
    builder: ["你使用哪些技术栈？", "做过哪些项目？", "如何处理技术难题？"],
    ai: ["你如何使用 LLM？", "做过哪些 AI 应用？", "LangChain 怎么用？"],
    writer: ["你写什么类型的内容？", "如何组织一篇文章？", "写作有什么技巧？"],
    reader: ["你最近读什么书？", "如何做好笔记？", "如何深度阅读？"],
    visual: ["你的设计风格是什么？", "如何做 UI 设计？", "使用什么设计工具？"],
    wanderer: ["你去过哪些地方？", "旅行有什么收获？", "如何记录生活？"],
  };
  return questions[agentId] || [];
}

/**
 * 统一的 Agent 调用接口
 */
export async function invokeAgent(
  agentId: AgentId,
  input: string,
  options?: AgentInvokeOptions
): Promise<AgentResponse> {
  emitRunEvent({
    type: "agent.start",
    agentId,
    displayName: AGENT_DISPLAY_NAMES[agentId],
  });

  try {
    return await invokeAgentInternal(agentId, input, options);
  } catch (error) {
    if (isLLMProviderConfigurationError(error)) {
      throw error;
    }

    console.error(`Agent ${agentId} invoke error:`, error);
    const errorDetails =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
    console.error(`Agent ${agentId} error details:`, errorDetails);
    if (error instanceof Error && error.stack) {
      console.error(`Agent ${agentId} stack trace:`, error.stack);
    }
    throw error;
  } finally {
    emitRunEvent({ type: "agent.done", agentId });
  }
}

/**
 * 并行调用多个 Agent
 */
export async function invokeMultipleAgents(
  agentIds: AgentId[],
  input: string,
  options?: AgentInvokeOptions
): Promise<Map<AgentId, AgentResponse>> {
  const results = await Promise.all(
    agentIds.map(async id => {
      try {
        const response = await invokeAgentInternal(id, input, options);
        return [id, response] as const;
      } catch (error) {
        if (isLLMProviderConfigurationError(error)) {
          throw error;
        }

        console.error(`Agent ${id} invoke error:`, error);
        throw error;
      }
    })
  );

  return new Map(results);
}

/**
 * 初始化 Agent Factory
 * 注入 agent 间通信的调用入口，并在代码层强制：
 * 1. canConsult 白名单（提示词里的协作约束不再只靠模型自觉）
 * 2. 嵌套深度上限（超过 MAX_CONSULT_DEPTH 直接拒绝，阻断递归）
 * 3. grounding / 会话历史透传（嵌套 agent 与顶层请求遵守同一事实约束）
 */
export function initializeAgentFactory() {
  setAgentInvoker((targetAgentId, question, options) => {
    const callerAgentId = options?.context?.callerAgentId;
    const requestDepth = options?.context?.consultDepth ?? 0;

    if (requestDepth >= MAX_CONSULT_DEPTH + 1) {
      return Promise.resolve({
        answer: `已达到 agent 协作嵌套上限（${MAX_CONSULT_DEPTH} 层），本次咨询已被拒绝。请基于已有信息回答。`,
      });
    }

    if (
      callerAgentId &&
      !AGENT_TOOL_CONFIGS[callerAgentId]?.canConsult.includes(targetAgentId)
    ) {
      return Promise.resolve({
        answer: `[${targetAgentId}] 不在 ${callerAgentId} 的协作白名单内，本次咨询已被拒绝。`,
      });
    }

    return invokeAgent(targetAgentId, question, {
      consultDepth: requestDepth + 1,
      context: {
        grounding: options?.context?.grounding,
        conversationHistory: options?.context?.conversationHistory,
        fromAgent: callerAgentId,
      },
    });
  });
}

// 自动初始化
initializeAgentFactory();
