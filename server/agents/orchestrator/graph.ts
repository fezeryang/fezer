/**
 * 全局编排器 Graph
 * 集成 Supervisor 进行智能路由和 agent 编排
 */

import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import { HumanMessage } from "@langchain/core/messages";
import { askSupervisor } from "../supervisor/graph";
import type { AgentId } from "../tools/agent.tool";
import { runWithTraceContext, traceSpan } from "../../_core/observability/langsmith";
import {
  resolveAgentByCharacterId,
  resolvePreferredAgent,
} from "../spatial/agent-resolution";

/**
 * 创建编排器图
 * 简化版本，直接委托给 Supervisor
 */
export function createOrchestratorGraph() {
  const StateAnnotation = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
      reducer: (x, y) => x.concat(y),
      default: () => [],
    }),
    userInput: Annotation<string>({
      reducer: (_, current) => current,
      default: () => "",
    }),
    roomId: Annotation<string | undefined>({
      reducer: (_, current) => current,
      default: () => undefined,
    }),
    characterId: Annotation<string | undefined>({
      reducer: (_, current) => current,
      default: () => undefined,
    }),
    interactionType: Annotation<"click" | "hover" | "chat" | "guide">({
      reducer: (_, current) => current,
      default: () => "chat" as const,
    }),
    currentPrimaryAgent: Annotation<AgentId>({
      reducer: (_, current) => current,
      default: () => "core" as AgentId,
    }),
    visitedRooms: Annotation<string[]>({
      reducer: (prev, current) => Array.from(new Set([...prev, ...current])),
      default: () => [],
    }),
    discoveredCharacters: Annotation<string[]>({
      reducer: (prev, current) => Array.from(new Set([...prev, ...current])),
      default: () => [],
    }),
    answer: Annotation<string>({
      reducer: (_, current) => current,
      default: () => "",
    }),
    uiAction: Annotation<{
      panel?: "guide" | "character" | "resume";
      focusRoomId?: string;
      highlightCharacterId?: AgentId;
      suggestedNextCharacterIds?: AgentId[];
      suggestedQuestions?: string[];
    }>({
      reducer: (prev, current) => ({ ...prev, ...current }),
      default: () => ({}),
    }),
  });

  /**
   * 节点：标准化请求
   */
  async function ingestRequest(
    state: typeof StateAnnotation.State
  ): Promise<Partial<typeof StateAnnotation.State>> {
    return traceSpan("orchestrator.ingestRequest", async () => {
      const { userInput } = state;
      return {
        messages: [new HumanMessage(userInput)],
      };
    });
  }

  /**
   * 节点：检测空间上下文
   */
  async function detectSpatialContext(
    state: typeof StateAnnotation.State
  ): Promise<Partial<typeof StateAnnotation.State>> {
    return traceSpan("orchestrator.detectSpatialContext", async () => {
      const { roomId, characterId, interactionType, visitedRooms, discoveredCharacters } = state;

      const primaryAgent = resolvePreferredAgent({
        characterId,
        roomId,
        interactionType,
        fallback: "core",
      });

      return {
        currentPrimaryAgent: primaryAgent,
        visitedRooms: roomId ? [...visitedRooms, roomId] : visitedRooms,
        discoveredCharacters: characterId
          ? [...discoveredCharacters, characterId]
          : discoveredCharacters,
      };
    });
  }

  /**
   * 节点：调用 Supervisor
   * 核心逻辑委托给 Supervisor
   */
  async function callSupervisor(
    state: typeof StateAnnotation.State
  ): Promise<Partial<typeof StateAnnotation.State>> {
    return traceSpan("orchestrator.callSupervisor", async () => {
      const { userInput, roomId, characterId, messages, currentPrimaryAgent } = state;

      // 如果直接点击了角色，优先使用该角色
      const preferredAgent = characterId
        ? resolveAgentByCharacterId(characterId)
        : currentPrimaryAgent;

      // 调用 Supervisor
      const result = await runWithTraceContext(
        {
          agentId: preferredAgent,
          roomId,
          characterId,
        },
        async () =>
          askSupervisor(userInput, {
            roomId,
            characterId: preferredAgent,
            messages,
          })
      );

      return {
        answer: result.answer,
        uiAction: {
          panel: "character",
          highlightCharacterId: preferredAgent,
          focusRoomId: roomId,
          suggestedNextCharacterIds: result.uiAction?.suggestedNextCharacterIds,
          suggestedQuestions: result.uiAction?.suggestedQuestions,
          ...result.uiAction,
        },
        currentPrimaryAgent: preferredAgent,
      };
    });
  }

  const graph = new StateGraph(StateAnnotation)
    .addNode("ingestRequest", ingestRequest)
    .addNode("detectSpatialContext", detectSpatialContext)
    .addNode("callSupervisor", callSupervisor)
    .addEdge(START, "ingestRequest")
    .addEdge("ingestRequest", "detectSpatialContext")
    .addEdge("detectSpatialContext", "callSupervisor")
    .addEdge("callSupervisor", END);

  return graph.compile();
}

/**
 * 导出编译好的图
 */
export const orchestratorGraph = createOrchestratorGraph();
