/**
 * Supervisor Graph - 编排层
 * 智能路由、并行执行、结果聚合
 */

import { StateGraph, END, Annotation } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import { classifyIntent, INTENT_PROMPT_VERSION } from "./intent-classifier";
import { invokeAgent, invokeMultipleAgents } from "../expert/agent-factory";
import type { AgentId } from "../tools/agent.tool";
import {
  runWithTraceContext,
  traceSpan,
} from "../../_core/observability/langsmith";
import { resolvePreferredAgent } from "../spatial/agent-resolution";

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
  preferredAgent: Annotation<AgentId | undefined>({
    reducer: (_, current) => current,
    default: () => undefined,
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

function resolveContextualTargetAgent(
  state: typeof SupervisorState.State
): AgentId | undefined {
  if (state.preferredAgent) {
    return state.preferredAgent;
  }

  if (state.characterId) {
    return resolvePreferredAgent({
      characterId: state.characterId,
      roomId: state.roomId,
      interactionType: "click",
      fallback: "core",
    });
  }

  if (state.roomId) {
    return resolvePreferredAgent({
      roomId: state.roomId,
      interactionType: state.interactionType,
      fallback: "core",
    });
  }

  return undefined;
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
      const { userInput } = state;
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

      const classification = await classifyIntent(userInput);

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
    const { targetAgent, userInput, messages } = state;

    const response = await runWithTraceContext(
      {
        agentId: targetAgent,
      },
      async () =>
        invokeAgent(targetAgent, userInput, {
          context: { messages },
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
    const { consultAgents, userInput, messages } = state;

    // 并行调用
    const responses = await invokeMultipleAgents(consultAgents, userInput, {
      context: { messages },
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

      // 简单综合：按顺序拼接
      let synthesized = "";
      for (const response of responses) {
        synthesized += `**${response.agent}**: ${response.answer}\n\n`;
      }

      return synthesized.trim();
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
  const { currentAgent, uiAction, finalAnswer } = state;

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
    messages?: BaseMessage[];
  }
): Promise<{
  answer: string;
  uiAction?: any;
  agentResponses?: Partial<Record<AgentId, string>>;
}> {
  const result = await supervisorGraph.invoke({
    userInput,
    roomId: context?.roomId,
    characterId: context?.characterId,
    interactionType: context?.interactionType,
    preferredAgent: context?.preferredAgent,
    messages: context?.messages || [],
  });

  return {
    answer: result.finalAnswer as string,
    uiAction: result.uiAction,
    agentResponses: result.agentResponses,
  };
}
