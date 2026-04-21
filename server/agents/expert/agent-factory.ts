/**
 * Agent Factory - 统一的专家 Agent 创建和调用接口
 */

import type { AgentId } from "../tools/agent.tool";
import { setAgentInvoker } from "../tools/agent.tool";
import { invokeLLM, type Message, type Role } from "../../_core/llm";
import {
  buildAgentSystemPrompt,
  CHARACTER_PROMPT_FRAMEWORK_VERSION,
} from "@fezer/shared/characters";
import {
  runWithTraceContext,
  traceSpan,
} from "../../_core/observability/langsmith";
import { BaseMessage } from "@langchain/core/messages";
import { getLLMToolsByNames, getToolExecutionRegistry } from "../tools";

/**
 * Agent 调用选项
 */
export interface AgentInvokeOptions {
  previousContext?: {
    fromAgent?: string;
    conversationHistory?: any[];
  };
  context?: {
    messages?: BaseMessage[];
    fromAgent?: string;
    conversationHistory?: any[];
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
 */
const AGENT_TOOL_CONFIGS: Record<
  AgentId,
  { tools: string[]; canConsult: AgentId[] }
> = {
  core: {
    tools: [
      "get_profile",
      "get_skills",
      "get_projects",
      "search_knowledge",
      "search_content",
      "get_project_details",
      "get_faq",
      "get_blog_posts",
      "get_works_detail",
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
      "ask_other_agent",
    ],
    canConsult: ["ai", "writer"],
  },
  ai: {
    tools: [
      "get_profile",
      "get_skills",
      "get_projects",
      "search_knowledge",
      "search_content",
      "get_project_details",
      "get_works_detail",
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
      "ask_other_agent",
    ],
    canConsult: ["reader", "visual"],
  },
  reader: {
    tools: [
      "get_profile",
      "get_interests",
      "search_knowledge",
      "search_content",
      "get_faq",
      "get_blog_posts",
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
      "ask_other_agent",
    ],
    canConsult: ["reader", "visual"],
  },
};

const MAX_TOOL_CALL_LOOPS = 4;

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
        const contextMessages = options?.context?.messages || [];
        const allowedToolNames = AGENT_TOOL_CONFIGS[agentId].tools;
        const llmTools = getLLMToolsByNames(allowedToolNames);
        const executableToolRegistry = getToolExecutionRegistry();

        // 构建消息历史
        const messages: Message[] = [
          { role: "system", content: systemPrompt },
          ...contextMessages.slice(-5).map(toLLMMessage),
          { role: "user", content: input },
        ];

        let lastAssistantAnswer = "抱歉，我暂时无法回答。";
        let loopCount = 0;

        while (loopCount < MAX_TOOL_CALL_LOOPS) {
          const result = await invokeLLM({
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
            const isAllowed = allowedToolNames.includes(toolName);

            if (!executableTool || !isAllowed) {
              const deniedContent = JSON.stringify({
                success: false,
                error: `Tool not allowed or not found: ${toolName}`,
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

            const toolResult = await traceSpan(
              `tool.${toolName}`,
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
              },
              {
                runType: "tool",
                metadata: {
                  toolName,
                  toolArgs: parsedArgs,
                },
                tags: [`tool:${toolName}`],
              }
            );

            messages.push({
              role: "tool",
              name: toolName,
              tool_call_id: toolCall.id,
              content: JSON.stringify(toolResult),
            });
          }

          loopCount += 1;
        }

        const fallbackAnswer = lastAssistantAnswer || "抱歉，我暂时无法回答。";

        // 提取 UI 提示（简单实现）
        return {
          answer:
            loopCount >= MAX_TOOL_CALL_LOOPS
              ? `${fallbackAnswer}\n\n（已达到工具调用上限，返回当前结果）`
              : fallbackAnswer,
          uiAction: {
            suggestedQuestions: extractSuggestedQuestions(agentId),
          },
        };
      })
  );
}

function mapRole(type: string): Role {
  if (type === "human") return "user";
  if (type === "ai") return "assistant";
  if (type === "system") return "system";
  if (type === "tool") return "tool";
  return "user";
}

function toLLMMessage(message: BaseMessage): Message {
  const role = mapRole(message.getType());
  return {
    role,
    content:
      typeof message.content === "string"
        ? message.content
        : JSON.stringify(message.content),
  };
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
  try {
    return await invokeAgentInternal(agentId, input, options);
  } catch (error) {
    console.error(`Agent ${agentId} invoke error:`, error);
    const errorDetails =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
    console.error(`Agent ${agentId} error details:`, errorDetails);
    if (error instanceof Error && error.stack) {
      console.error(`Agent ${agentId} stack trace:`, error.stack);
    }
    return {
      answer: `抱歉，${getAgentRoleDescription(agentId)}遇到了技术问题。错误: ${errorDetails}`,
    };
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
        console.error(`Agent ${id} invoke error:`, error);
        return [
          id,
          {
            answer: `抱歉，${id} agent 遇到了技术问题。`,
          },
        ] as const;
      }
    })
  );

  return new Map(results);
}

/**
 * 初始化 Agent Factory
 * 设置 agent 间通信的回调
 */
export function initializeAgentFactory() {
  setAgentInvoker(invokeAgent);
}

// 自动初始化
initializeAgentFactory();
