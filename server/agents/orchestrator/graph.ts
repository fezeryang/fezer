/**
 * @fileoverview 全局编排器 Graph
 * @description 集成 Supervisor 进行智能路由和 Agent 编排，是整个 Agent 系统的入口
 * @author Fezer
 * @created 2026-04-19
 *
 * @description
 * 编排器负责：
 * 1. 接收用户请求
 * 2. 检测空间上下文（用户所在位置、点击的角色）
 * 3. 路由到合适的专家 Agent
 * 4. 聚合结果并返回
 */

import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import { HumanMessage } from "@langchain/core/messages";
import type { ConversationTurn } from "@fezer/shared/schemas/agent";
import { askSupervisor } from "../supervisor/graph";
import type { AgentId } from "../tools/agent.tool";
import {
  runWithTraceContext,
  traceSpan,
} from "../../_core/observability/langsmith";
import { resolvePreferredAgent } from "../spatial/agent-resolution";

/**
 * 创建编排器图
 *
 * 编排器是 Agent 系统的入口点，负责：
 * - 标准化输入请求
 * - 检测空间上下文
 * - 调用 Supervisor 进行智能路由
 *
 * @returns 编译后的 StateGraph
 */
export function createOrchestratorGraph() {
  // 定义状态注解
  // 状态用于在图的节点之间传递数据
  const StateAnnotation = Annotation.Root({
    // 消息历史（LangChain 格式）
    messages: Annotation<BaseMessage[]>({
      reducer: (x, y) => x.concat(y), // 追加新消息
      default: () => [],
    }),
    // 用户原始输入
    userInput: Annotation<string>({
      reducer: (_, current) => current, // 覆盖旧值
      default: () => "",
    }),
    // 当前所在房间 ID
    roomId: Annotation<string | undefined>({
      reducer: (_, current) => current,
      default: () => undefined,
    }),
    // 点击/交互的角色 ID
    characterId: Annotation<string | undefined>({
      reducer: (_, current) => current,
      default: () => undefined,
    }),
    // 交互类型
    interactionType: Annotation<"click" | "hover" | "chat" | "guide">({
      reducer: (_, current) => current,
      default: () => "chat" as const,
    }),
    // 回答事实来源约束
    grounding: Annotation<"public_profile" | undefined>({
      reducer: (_, current) => current,
      default: () => undefined,
    }),
    // 多轮会话历史（结构化，不含当前 userInput）
    conversationHistory: Annotation<ConversationTurn[]>({
      reducer: (_, current) => current,
      default: () => [],
    }),
    // 当前主要 Agent
    currentPrimaryAgent: Annotation<AgentId>({
      reducer: (_, current) => current,
      default: () => "core" as AgentId,
    }),
    // 已访问的房间列表（去重）
    visitedRooms: Annotation<string[]>({
      reducer: (prev, current) => Array.from(new Set([...prev, ...current])),
      default: () => [],
    }),
    // 已发现的角色列表（去重）
    discoveredCharacters: Annotation<string[]>({
      reducer: (prev, current) => Array.from(new Set([...prev, ...current])),
      default: () => [],
    }),
    // Agent 的回答文本
    answer: Annotation<string>({
      reducer: (_, current) => current,
      default: () => "",
    }),
    // UI 操作指令
    uiAction: Annotation<{
      panel?: "guide" | "character" | "resume";
      focusRoomId?: string;
      highlightCharacterId?: AgentId;
      suggestedNextCharacterIds?: AgentId[];
      suggestedQuestions?: string[];
    }>({
      reducer: (prev, current) => ({ ...prev, ...current }), // 合并对象
      default: () => ({}),
    }),
  });

  /**
   * 节点：标准化请求
   *
   * 将用户输入转换为 LangChain 消息格式，
   * 方便后续的 Agent 处理。
   */
  async function ingestRequest(
    state: typeof StateAnnotation.State
  ): Promise<Partial<typeof StateAnnotation.State>> {
    return traceSpan("orchestrator.ingestRequest", async () => {
      const { userInput } = state;
      // 将用户输入转换为 HumanMessage
      return {
        messages: [new HumanMessage(userInput)],
      };
    });
  }

  /**
   * 节点：检测空间上下文
   *
   * 根据用户所在位置和交互的角色，
   * 决定应该使用哪个 Agent 来响应。
   */
  async function detectSpatialContext(
    state: typeof StateAnnotation.State
  ): Promise<Partial<typeof StateAnnotation.State>> {
    return traceSpan("orchestrator.detectSpatialContext", async () => {
      const {
        roomId,
        characterId,
        interactionType,
        visitedRooms,
        discoveredCharacters,
      } = state;

      // 根据空间上下文解析首选 Agent
      const primaryAgent = resolvePreferredAgent({
        characterId, // 如果点击了角色，优先使用该角色对应的 Agent
        roomId, // 根据房间决定 Agent
        interactionType, // 根据交互类型决定 Agent
        fallback: "core", // 默认使用 core Agent
      });

      return {
        currentPrimaryAgent: primaryAgent,
        // 更新已访问房间列表
        visitedRooms: roomId ? [...visitedRooms, roomId] : visitedRooms,
        // 更新已发现角色列表
        discoveredCharacters: characterId
          ? [...discoveredCharacters, characterId]
          : discoveredCharacters,
      };
    });
  }

  /**
   * 节点：调用 Supervisor
   *
   * 核心逻辑委托给 Supervisor，
   * Supervisor 会根据请求内容调用合适的专家 Agent。
   */
  async function callSupervisor(
    state: typeof StateAnnotation.State
  ): Promise<Partial<typeof StateAnnotation.State>> {
    return traceSpan("orchestrator.callSupervisor", async () => {
      const {
        userInput,
        roomId,
        characterId,
        interactionType,
        grounding,
        messages,
        conversationHistory,
        currentPrimaryAgent,
      } = state;

      // 仅当用户显式定向（点击角色 / 导览）时才硬性锁定 agent；
      // 普通聊天（chat）交给 supervisor 的意图分类按内容路由，
      // 房间位置作为软偏置传入，避免"站在哪个房间就只能问哪个领域"。
      const isExplicitTargeting =
        interactionType === "click" || interactionType === "guide";
      const preferredAgent = isExplicitTargeting
        ? currentPrimaryAgent
        : undefined;

      // 调用 Supervisor 进行智能路由和 Agent 调用
      const result = await runWithTraceContext(
        {
          agentId: currentPrimaryAgent,
          roomId,
          characterId,
        },
        async () =>
          askSupervisor(userInput, {
            roomId,
            characterId,
            interactionType,
            preferredAgent,
            grounding,
            messages,
            conversationHistory,
          })
      );

      // 回答 agent 以 supervisor 实际路由结果为准（内容路由可能换人）
      const answeringAgent =
        result.speakingAgent ?? preferredAgent ?? currentPrimaryAgent;

      // 返回结果，包含回答文本和 UI 操作指令
      return {
        answer: result.answer,
        uiAction: {
          panel: "character",
          highlightCharacterId: answeringAgent,
          focusRoomId: roomId,
          suggestedNextCharacterIds: result.uiAction?.suggestedNextCharacterIds,
          suggestedQuestions: result.uiAction?.suggestedQuestions,
          ...result.uiAction,
        },
        currentPrimaryAgent: answeringAgent,
      };
    });
  }

  // 构建状态图
  // 定义节点和边的连接关系
  const graph = new StateGraph(StateAnnotation)
    .addNode("ingestRequest", ingestRequest) // 标准化请求
    .addNode("detectSpatialContext", detectSpatialContext) // 检测空间上下文
    .addNode("callSupervisor", callSupervisor) // 调用 Supervisor
    .addEdge(START, "ingestRequest") // 起始 → 标准化请求
    .addEdge("ingestRequest", "detectSpatialContext") // 标准化请求 → 检测上下文
    .addEdge("detectSpatialContext", "callSupervisor") // 检测上下文 → 调用 Supervisor
    .addEdge("callSupervisor", END); // 调用 Supervisor → 结束

  // 编译并返回图
  return graph.compile();
}

/**
 * 导出编译好的图
 *
 * 这是外部模块调用的入口点。
 */
export const orchestratorGraph = createOrchestratorGraph();
