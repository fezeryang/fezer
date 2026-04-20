/**
 * ChatModal - Agent 对话弹窗组件
 */

import { useState, useEffect, useRef } from "react";
import { Streamdown } from "streamdown";
import { useAgentChat } from "../../hooks/useAgentChat";
import type { AgentResponse } from "@fezer/shared/schemas/agent";
import type { FezerType } from "@fezer/shared/schemas/character";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface ChatModalProps {
  isOpen: boolean;
  characterId?: string;
  roomId?: string;
  onClose: () => void;
  initialMessage?: string;
}

// 代理显示名称
const AGENT_NAMES: Record<FezerType, string> = {
  core: "Aries · Core",
  builder: "Gemini · Builder",
  ai: "Aquarius · AI",
  writer: "Libra · Writer",
  reader: "Virgo · Reader",
  visual: "Pisces · Visual",
  wanderer: "Sagittarius · Wanderer",
};

// 代理颜色
const AGENT_COLORS: Record<FezerType, string> = {
  core: "#f97316",
  builder: "#2563eb",
  ai: "#7c3aed",
  writer: "#0f766e",
  reader: "#ca8a04",
  visual: "#db2777",
  wanderer: "#059669",
};

// 代理头像文件名（对应 /avatars/ 目录下的文件）
const AGENT_AVATARS: Record<FezerType, string> = {
  core: "kitty-ghostcatpink.gif",
  builder: "kitty-bongopixel .gif",
  ai: "kitty-cosmew.gif",
  writer: "kitty-athenaeum .gif",
  reader: "kitty-hillhouse .gif",
  visual: "kitty-witchcat.gif",
  wanderer: "kitty-shadowken.gif",
};

// 获取头像 URL（自动适配 GitHub Pages 路径）
const getAvatarUrl = (agentId: FezerType | undefined): string => {
  if (!agentId)
    return `${import.meta.env.BASE_URL}avatars/kitty-ghostcatpink.gif`;
  return `${import.meta.env.BASE_URL}avatars/${AGENT_AVATARS[agentId]}`;
};

export function ChatModal({
  isOpen,
  characterId,
  roomId,
  onClose,
  initialMessage,
}: ChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [currentResponse, setCurrentResponse] = useState<AgentResponse | null>(
    null
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { sendMessage, isLoading } = useAgentChat({
    onSuccess: response => {
      const assistantMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: response.text,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMessage]);
      setCurrentResponse(response);
    },
  });

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 初始消息
  useEffect(() => {
    if (isOpen && initialMessage && messages.length === 0) {
      handleSend(initialMessage);
    }
  }, [isOpen]);

  const handleSend = async (content?: string) => {
    const text = content || inputValue;
    if (!text.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue("");

    try {
      await sendMessage({
        userInput: text,
        characterId,
        roomId,
        interactionType: characterId ? "click" : "chat",
      });
    } catch (error) {
      console.error("Chat error:", error);
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    setInputValue(question);
  };

  const handleSuggestedAgent = (agentId: FezerType) => {
    // 切换到推荐的代理 - 创建一个新的响应对象
    setCurrentResponse({
      text: `你正在与 ${AGENT_NAMES[agentId]} 对话。请问有什么我可以帮助你的？`,
      panel: "character",
      speakingAgentId: agentId,
      suggestedQuestions: [],
    });
  };

  if (!isOpen) return null;

  const currentAgentId = currentResponse?.speakingAgentId;
  const currentAgentColor = currentAgentId
    ? AGENT_COLORS[currentAgentId]
    : "#f97316";
  const currentAgentName = currentAgentId
    ? AGENT_NAMES[currentAgentId]
    : "Fezer";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* 头部 */}
        <div
          className="flex items-center justify-between px-6 py-4 text-white"
          style={{ backgroundColor: currentAgentColor }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
              <img
                src={getAvatarUrl(currentAgentId)}
                alt={currentAgentName}
                className="w-10 h-10 rounded-full object-cover"
                onError={e => {
                  const img = e.currentTarget;
                  img.style.display = "none";
                  const emoji = img.nextElementSibling as HTMLElement;
                  if (emoji) emoji.classList.remove("hidden");
                }}
              />
              <span className="text-lg hidden">🤖</span>
            </div>
            <div>
              <h3 className="font-semibold text-lg">{currentAgentName}</h3>
              <p className="text-xs opacity-80">
                {currentResponse?.panel === "guide" && "导览员"}
                {currentResponse?.panel === "character" && "角色对话"}
                {currentResponse?.panel === "resume" && "简历信息"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
          >
            <span className="text-lg">✕</span>
          </button>
        </div>

        {/* 消息列表 */}
        <div className="h-80 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-gray-400">
              <p>开始与 {currentAgentName} 对话...</p>
            </div>
          )}
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                  msg.role === "user"
                    ? "bg-blue-500 text-white rounded-br-md"
                    : "bg-white text-gray-800 rounded-bl-md shadow-sm"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none font-chill-huofangsong">
                    <Streamdown>{msg.content}</Streamdown>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white px-4 py-2 rounded-2xl rounded-bl-md shadow-sm">
                <div className="flex gap-1">
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 建议问题 */}
        {currentResponse?.suggestedQuestions &&
          currentResponse.suggestedQuestions.length > 0 && (
            <div className="px-4 py-3 border-t bg-white">
              <p className="text-xs text-gray-500 mb-2">你可以问:</p>
              <div className="flex flex-wrap gap-2">
                {currentResponse.suggestedQuestions.map((question, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestedQuestion(question)}
                    className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full transition"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

        {/* 推荐角色 */}
        {currentResponse?.suggestedNextCharacterIds &&
          currentResponse.suggestedNextCharacterIds.length > 0 && (
            <div className="px-4 py-3 border-t bg-white">
              <p className="text-xs text-gray-500 mb-2">
                你也可以和这些角色聊聊:
              </p>
              <div className="flex flex-wrap gap-2">
                {currentResponse.suggestedNextCharacterIds.map(agentId => (
                  <button
                    key={agentId}
                    onClick={() => handleSuggestedAgent(agentId)}
                    className="text-xs px-3 py-1.5 rounded-full border-2 transition hover:bg-gray-50"
                    style={{
                      borderColor: AGENT_COLORS[agentId],
                      color: AGENT_COLORS[agentId],
                    }}
                  >
                    {AGENT_NAMES[agentId]}
                  </button>
                ))}
              </div>
            </div>
          )}

        {/* 输入框 */}
        <div className="p-4 border-t bg-white">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyPress={e => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="输入问题... (Shift+Enter 换行)"
              className="flex-1 px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <button
              onClick={() => handleSend()}
              disabled={isLoading || !inputValue.trim()}
              className="px-6 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              发送
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
