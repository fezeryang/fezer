/**
 * Supervisor Graph - 编排层
 * 智能路由、并行执行、结果聚合
 */

import { StateGraph, END, Annotation } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import type { ConversationTurn } from "@fezer/shared/schemas/agent";
import { AGENT_DISPLAY_NAMES } from "@fezer/shared/characters";
import { classifyIntent, INTENT_PROMPT_VERSION } from "./intent-classifier";
import { invokeAgent, invokeMultipleAgents } from "../expert/agent-factory";
import type { AgentId } from "../tools/agent.tool";
import {
  runWithTraceContext,
  traceSpan,
} from "../../_core/observability/langsmith";
import { invokeLLM } from "../../_core/llm";
import { resolvePreferredAgent } from "../spatial/agent-resolution";

/**
 * 多专家综合提示词。
 *
 * 护栏：只融合不创造。失败时调用方会降级为原始分段呈现，
 * 所以这里宁可短，也不要引入输入中没有的事实。
 */
const SYNTHESIS_SYSTEM_PROMPT = `你是多专家回答的综合者。

输入：一个用户问题 + 多位专家各自的回答。
任务：把它们融合成一个连贯、不重复的回答。

规则：
- 保留各方给出的关键事实与判断，不要丢信息
- 不要写“某专家说”之类的罗列句式，直接融合叙述
- 不要新增输入中没有的事实
- 用中文回答，篇幅不超过各专家回答总和的七成`;

/**
 * Supervisor 状态定义
 */
export const SupervisorState = Annotation.Root({
  // 用户输入
  userInput: Annotation<string>({
    reducer: (_, current) => current,
    default: () => "",
  }),

  // 消息历史
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),

  // 空间上下文
  roomId: Annotation<string | undefined>({
    reducer: (_, current) => current,
    default: () => undefined,
  }),
  characterId: Annotation<string | undefined>({
    reducer: (_, current) => current,
    default: () => undefined,
  }),
  interactionType: Annotation<"click" | "hover" | "chat" | "guide" | undefined>(
    {
      reducer: (_, current) => current,
      default: () => undefined,
    }
  ),
  grounding: Annotation<"public_profile" | undefined>({
    reducer: (_, current) => current,
    default: () => undefined,
  }),
  preferredAgent: Annotation<AgentId | undefined>({
    reducer: (_, current) => current,
    default: () => undefined,
  }),

  // 多轮会话历史（结构化，不含当前 userInput）
  conversationHistory: Annotation<ConversationTurn[]>({
    reducer: (_, current) => current,
    default: () => [],
  }),

  // 意图分类结果
  intentCategory: Annotation<string>({
    reducer: (_, current) => current,
    default: () => "",
  }),
  targetAgent: Annotation<AgentId>({
    reducer: (_, current) => current,
    default: () => "core" as AgentId,
  }),
  needsConsultation: Annotation<boolean>({
    reducer: (_, current) => current,
    default: () => false,
  }),
  consultAgents: Annotation<AgentId[]>({
    reducer: (_, current) => current,
    default: () => [],
  }),

  // 执行状态
  currentAgent: Annotation<AgentId>({
    reducer: (_, current) => current,
    default: () => "core" as AgentId,
  }),
  completed: Annotation<boolean>({
    reducer: (_, current) => current,
    default: () => false,
  }),

  // 结果 - 使用 Partial<Record> 避免类型问题
  agentResponses: Annotation<Partial<Record<AgentId, string>>>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}) as Partial<Record<AgentId, string>>,
  }),
  finalAnswer: Annotation<string>({
    reducer: (_, current) => current,
    default: () => "",
  }),

  // UI 指令
  uiAction: Annotation<{
    panel?: string;
    suggestedQuestions?: string[];
    suggestedNextCharacterIds?: AgentId[];
    focusAgent?: AgentId;
  }>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
});

/**
 * 空间硬覆盖：仅当用户显式定向（点击角色 / hover / 导览）时生效。
 * 普通聊天不在此处短路，交由 classifyIntent 按内容路由（房间作为软偏置传入）。
 */
function resolveContextualTargetAgent(
  state: typeof SupervisorState.State
): AgentId | undefined {
  const isExplicitTargeting =
    state.interactionType === "click" ||
    state.interactionType === "hover" ||
    state.interactionType === "guide";

  if (!isExplicitTargeting) {
    return undefined;
  }

  if (state.preferredAgent) {
    return state.preferredAgent;
  }

  return resolvePreferredAgent({
    characterId: state.characterId,
    roomId: state.roomId,
    interactionType: state.interactionType,
    fallback: "core",
  });
}

/**
 * 节点：意图分类
 */
async function classifyIntentNode(
  state: typeof SupervisorState.State
): Promise<Partial<typeof SupervisorState.State>> {
  return traceSpan(
    "supervisor.classifyIntent",
    async () => {
      const { userInput, roomId } = state;
      const contextualAgent = resolveContextualTargetAgent(state);

      if (contextualAgent) {
        return {
          intentCategory: "spatial-context",
          targetAgent: contextualAgent,
          needsConsultation: false,
          consultAgents: [],
          currentAgent: contextualAgent,
        };
      }

      // 普通聊天：按内容分类，房间仅作软偏置
      const classification = await classifyIntent(userInput, { roomId });

      return {
        intentCategory: classification.category,
        targetAgent: classification.targetAgent,
        needsConsultation: classification.needsConsultation,
        consultAgents: classification.consultAgents || [],
        currentAgent: classification.targetAgent,
      };
    },
    {
      metadata: {
        prompt_key: "supervisor/intent-classifier",
        prompt_version: INTENT_PROMPT_VERSION,
        prompt_tag: "stage1",
      },
    }
  );
}

/**
 * 节点：执行单个 agent
 */
async function executeSingleAgent(
  state: typeof SupervisorState.State
): Promise<Partial<typeof SupervisorState.State>> {
  return traceSpan("supervisor.executeSingleAgent", async () => {
    const { targetAgent, userInput, grounding, conversationHistory } = state;

    const response = await runWithTraceContext(
      {
        agentId: targetAgent,
      },
      async () =>
        invokeAgent(targetAgent, userInput, {
          context: { grounding, conversationHistory },
        })
    );

    return {
      agentResponses: { [targetAgent]: response.answer },
      finalAnswer: response.answer,
      uiAction: {
        ...response.uiAction,
        focusAgent: targetAgent,
      },
      completed: true,
    };
  });
}

/**
 * 节点：并行执行多个 agents
 */
async function executeParallelAgents(
  state: typeof SupervisorState.State
): Promise<Partial<typeof SupervisorState.State>> {
  return traceSpan("supervisor.executeParallelAgents", async () => {
    const { consultAgents, userInput, grounding, conversationHistory } = state;

    // 并行调用
    const responses = await invokeMultipleAgents(consultAgents, userInput, {
      context: { grounding, conversationHistory },
    });

    // 转换 Map 为对象
    const responseObj: Partial<Record<AgentId, string>> = {};
    const responseArray: { agent: AgentId; answer: string }[] = [];

    responses.forEach((response, agent) => {
      responseObj[agent] = response.answer;
      responseArray.push({ agent, answer: response.answer });
    });

    // 综合回答
    const synthesizedAnswer = await synthesizeResponses(
      responseArray,
      userInput
    );

    return {
      agentResponses: responseObj,
      finalAnswer: synthesizedAnswer,
      uiAction: {
        suggestedNextCharacterIds: consultAgents,
      },
      completed: true,
    };
  });
}

/**
 * 节点：综合多个 agent 的回答
 */
async function synthesizeResponses(
  responses: { agent: AgentId; answer: string }[],
  originalQuestion: string
): Promise<string> {
  return traceSpan(
    "supervisor.synthesizeResponses",
    async () => {
      if (responses.length === 0) {
        return "抱歉，没有收到任何响应。";
      }

      if (responses.length === 1) {
        return responses[0].answer;
      }

      // 分段呈现：不泄漏内部英文 agent id，也是综合失败时的降级形态
      const segmented = () =>
        responses
          .map(
            response =>
              `**${AGENT_DISPLAY_NAMES[response.agent] ?? response.agent}**: ${response.answer}`
          )
          .join("\n\n")
          .trim();

      // 真实综合：多一次 LLM 调用（仅在 needsConsultation 的并行路径发生）。
      // 护栏：独立 span（上方 traceSpan）、失败降级为分段呈现、绝不改写各专家原文。
      try {
        const result = await invokeLLM({
          messages: [
            { role: "system", content: SYNTHESIS_SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                `用户问题：${originalQuestion}`,
                "",
                ...responses.map(
                  response =>
                    `【${AGENT_DISPLAY_NAMES[response.agent] ?? response.agent}】\n${response.answer}`
                ),
              ].join("\n\n"),
            },
          ],
        });

        const content = result.choices[0]?.message?.content;
        const synthesized = typeof content === "string" ? content.trim() : "";
        if (synthesized.length === 0) {
          throw new Error("综合回答为空");
        }
        return synthesized;
      } catch (error) {
        console.error(
          "[supervisor] 综合失败，降级为分段呈现:",
          error instanceof Error ? error.message : error
        );
        return segmented();
      }
    },
    {
      metadata: {
        source_question: originalQuestion,
        response_count: responses.length,
      },
    }
  );
}

/**
 * 节点：聚合最终结果
 */
async function assembleFinalOutput(
  state: typeof SupervisorState.State
): Promise<Partial<typeof SupervisorState.State>> {
  const { currentAgent, uiAction } = state;

  return {
    uiAction: {
      panel: "character",
      focusAgent: currentAgent,
      suggestedNextCharacterIds: uiAction?.suggestedNextCharacterIds,
      ...uiAction,
    },
  };
}

/**
 * 条件边：路由决策
 */
function routeDecision(
  state: typeof SupervisorState.State
): "single" | "parallel" | "assemble" {
  if (state.completed) {
    return "assemble";
  }

  if (state.needsConsultation && state.consultAgents.length > 1) {
    return "parallel";
  }

  return "single";
}

/**
 * 创建 Supervisor Graph
 */
export function createSupervisorGraph() {
  const graph = new StateGraph(SupervisorState)
    .addNode("classify", classifyIntentNode)
    .addNode("single", executeSingleAgent)
    .addNode("parallel", executeParallelAgents)
    .addNode("assemble", assembleFinalOutput)
    .addEdge("__start__", "classify")
    .addConditionalEdges("classify", routeDecision, {
      single: "single",
      parallel: "parallel",
      assemble: "assemble",
    })
    .addEdge("single", "assemble")
    .addEdge("parallel", "assemble")
    .addEdge("assemble", END);

  return graph.compile();
}

/**
 * 导出编译好的 graph
 */
export const supervisorGraph = createSupervisorGraph();

/**
 * 简化的调用接口
 */
export async function askSupervisor(
  userInput: string,
  context?: {
    roomId?: string;
    characterId?: string;
    interactionType?: "click" | "hover" | "chat" | "guide";
    preferredAgent?: AgentId;
    grounding?: "public_profile";
    messages?: BaseMessage[];
    conversationHistory?: ConversationTurn[];
  }
): Promise<{
  answer: string;
  uiAction?: any;
  agentResponses?: Partial<Record<AgentId, string>>;
  /** 实际生成回答的 agent（内容路由可能与 preferredAgent 不同） */
  speakingAgent?: AgentId;
}> {
  const result = await supervisorGraph.invoke({
    userInput,
    roomId: context?.roomId,
    characterId: context?.characterId,
    interactionType: context?.interactionType,
    preferredAgent: context?.preferredAgent,
    grounding: context?.grounding,
    messages: context?.messages || [],
    conversationHistory: context?.conversationHistory ?? [],
  });

  return {
    answer: result.finalAnswer as string,
    uiAction: result.uiAction,
    agentResponses: result.agentResponses,
    speakingAgent: result.currentAgent as AgentId,
  };
}
