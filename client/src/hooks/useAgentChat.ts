/**
 * Agent 对话 Hook
 * 封装与后端 Agent API 的交互
 */

import { useState, useCallback } from "react";
import type {
  FrontendAgentRequest,
  AgentResponse,
} from "@fezer/shared/schemas/agent";

// API 基础 URL，开发环境使用本地，生产环境由 VITE_API_URL 指向后端
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

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
  isLoading: boolean;
  error: Error | null;
  thinkingState?: ThinkingState;
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

  const sendMessage = useCallback(
    async (request: FrontendAgentRequest): Promise<AgentResponse> => {
      setIsLoading(true);
      setError(null);
      setThinkingState({ step: "正在分析问题..." });

      try {
        const response = await fetch(`${API_BASE}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
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
    isLoading,
    error,
    thinkingState,
  };
}
