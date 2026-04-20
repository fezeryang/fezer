/**
 * Agent 对话 Hook
 * 封装与后端 Agent API 的交互
 */

import { useState, useCallback } from "react";
import type {
  FrontendAgentRequest,
  AgentResponse,
} from "@fezer/shared/schemas/agent";

// API 基础 URL，开发环境使用本地，生产环境使用相对路径
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface UseAgentChatOptions {
  onError?: (error: Error) => void;
  onSuccess?: (response: AgentResponse) => void;
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
}

/**
 * Agent 对话 Hook
 */
export function useAgentChat(
  options?: UseAgentChatOptions
): UseAgentChatReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sendMessage = useCallback(
    async (request: FrontendAgentRequest): Promise<AgentResponse> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Unknown error" }));
          throw new Error(errorData.error || `API error: ${response.status}`);
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
          throw new Error(`API error: ${response.status}`);
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
          throw new Error(`API error: ${response.status}`);
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
  };
}
