/**
 * Agent 对话 Hook
 * 封装与后端 Agent API 的交互
 */

import { useCallback, useRef, useState } from "react";
import type {
  FrontendAgentRequest,
  AgentResponse,
} from "@fezer/shared/schemas/agent";
import type { RunEvent } from "@fezer/shared/schemas/run";
import type { FezerType } from "@fezer/shared/schemas/character";
import { consumeSseResponse } from "@/lib/sse";
import { getOrCreateThreadId } from "@/lib/chat-thread";
import { API_BASE } from "@/lib/api-base";

function toPublicChatError(errorData: unknown, status: number): Error {
  if (
    errorData &&
    typeof errorData === "object" &&
    "message" in errorData &&
    typeof (errorData as { message?: unknown }).message === "string"
  ) {
    return new Error((errorData as { message: string }).message);
  }

  if (status === 503) {
    return new Error("AI 服务暂时不可用，请稍后再试。");
  }

  return new Error("消息发送失败，请稍后再试。");
}

export interface UseAgentChatOptions {
  onError?: (error: Error) => void;
  onSuccess?: (response: AgentResponse) => void;
}

export interface ThinkingState {
  step: string;
}

export interface UseAgentChatReturn {
  sendMessage: (request: FrontendAgentRequest) => Promise<AgentResponse>;
  sendGuide: (userInput?: string) => Promise<AgentResponse>;
  sendCharacterMessage: (
    characterId: string,
    userInput?: string
  ) => Promise<AgentResponse>;
  /**
   * 流式发送：以 SSE 消费 RunEvent（工具进度实时到达）。
   * 流失败（非取消）时返回 null，调用方降级到 sendMessage；
   * 用户取消时抛 AbortError，调用方应静默。
   */
  sendMessageStream: (
    request: FrontendAgentRequest,
    onEvent: (event: RunEvent) => void
  ) => Promise<AgentResponse | null>;
  /** 中止当前在飞的请求 */
  cancelInFlight: () => void;
  isLoading: boolean;
  error: Error | null;
  thinkingState?: ThinkingState;
}

/**
 * 读取某个会话线程的历史（C7：打开聊天时恢复上次对话）
 */
export async function fetchThreadHistory(threadId: string): Promise<
  Array<{ role: "user" | "assistant"; content: string; agentId?: FezerType }>
> {
  const response = await fetch(
    `${API_BASE}/api/chat/thread/${encodeURIComponent(threadId)}`
  );
  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as {
    turns?: Array<{
      role: "user" | "assistant";
      content: string;
      agentId?: FezerType;
    }>;
  };
  return data.turns ?? [];
}

/**
 * Agent 对话 Hook
 */
export function useAgentChat(
  options?: UseAgentChatOptions
): UseAgentChatReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [thinkingState, setThinkingState] = useState<ThinkingState | undefined>(
    undefined
  );
  const inFlightControllerRef = useRef<AbortController | null>(null);

  const cancelInFlight = useCallback(() => {
    inFlightControllerRef.current?.abort();
  }, []);

  const sendMessageStream = useCallback(
    async (
      request: FrontendAgentRequest,
      onEvent: (event: RunEvent) => void
    ): Promise<AgentResponse | null> => {
      setIsLoading(true);
      setError(null);
      setThinkingState({ step: "正在建立连接..." });

      const controller = new AbortController();
      inFlightControllerRef.current = controller;

      try {
        const response = await fetch(`${API_BASE}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...request,
            stream: true,
            threadId: request.threadId ?? getOrCreateThreadId(),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          return null;
        }

        let finalResponse: AgentResponse | null = null;

        const terminated = await consumeSseResponse(response, event => {
          onEvent(event);

          if (event.type === "run.finished") {
            finalResponse = {
              text: event.answer,
              panel: event.uiAction?.panel ?? "character",
              highlightCharacterId: event.uiAction?.highlightCharacterId,
              focusRoomId: event.uiAction?.focusRoomId,
              suggestedNextCharacterIds:
                event.uiAction?.suggestedNextCharacterIds,
              suggestedQuestions: event.uiAction?.suggestedQuestions,
              speakingAgentId: event.speakingAgentId ?? "core",
              cards: event.uiAction?.cards,
            };
          }

          if (event.type === "run.error") {
            setError(new Error(event.message));
          }
        });

        if (!terminated || !finalResponse) {
          return null;
        }

        options?.onSuccess?.(finalResponse);
        return finalResponse;
      } catch (error) {
        if (controller.signal.aborted) {
          throw new DOMException("本次请求已取消", "AbortError");
        }
        // 流失败但非取消：降级到非流式，并留下可诊断的痕迹
        console.warn(
          "[chat] 流式请求失败，降级为非流式:",
          error instanceof Error ? error.message : error
        );
        return null;
      } finally {
        inFlightControllerRef.current = null;
        setIsLoading(false);
        setThinkingState(undefined);
      }
    },
    [options]
  );

  const sendMessage = useCallback(
    async (request: FrontendAgentRequest): Promise<AgentResponse> => {
      setIsLoading(true);
      setError(null);
      setThinkingState({ step: "正在分析问题..." });

      try {
        const response = await fetch(`${API_BASE}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...request,
            threadId: request.threadId ?? getOrCreateThreadId(),
          }),
        });

        // 更新思考状态
        setThinkingState({ step: "正在整理回答..." });

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Unknown error" }));
          throw toPublicChatError(errorData, response.status);
        }

        const data = await response.json();
        const agentResponse = data as AgentResponse;

        options?.onSuccess?.(agentResponse);
        return agentResponse;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        options?.onError?.(error);
        throw error;
      } finally {
        setIsLoading(false);
        setThinkingState(undefined);
      }
    },
    [options]
  );

  const sendGuide = useCallback(
    async (userInput = "请为我介绍一下这里"): Promise<AgentResponse> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE}/api/guide`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userInput }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => undefined);
          throw toPublicChatError(errorData, response.status);
        }

        const data = await response.json();
        const agentResponse = data as AgentResponse;

        options?.onSuccess?.(agentResponse);
        return agentResponse;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        options?.onError?.(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [options]
  );

  const sendCharacterMessage = useCallback(
    async (
      characterId: string,
      userInput = "你好！"
    ): Promise<AgentResponse> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE}/api/character`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characterId, userInput }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => undefined);
          throw toPublicChatError(errorData, response.status);
        }

        const data = await response.json();
        const agentResponse = data as AgentResponse;

        options?.onSuccess?.(agentResponse);
        return agentResponse;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        options?.onError?.(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [options]
  );

  return {
    sendMessage,
    sendGuide,
    sendCharacterMessage,
    sendMessageStream,
    cancelInFlight,
    isLoading,
    error,
    thinkingState,
  };
}
