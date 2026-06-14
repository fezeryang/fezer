/**
 * ChatModal - Agent 对话弹窗组件
 * 支持拖拽、侧边栏固定模式、房间背景
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Streamdown } from "streamdown";
import { useAgentChat } from "../../hooks/useAgentChat";
import type { AgentResponse } from "@fezer/shared/schemas/agent";
import type { FezerType } from "@fezer/shared/schemas/character";
import { resolveFezerTypeFromSpatialContext } from "@fezer/shared/characters";
import { ThinkingIndicator } from "./ThinkingIndicator";

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

const resolveAgentFromContext = (
  currentCharacterId: string | undefined,
  currentRoomId: string | undefined
): FezerType | undefined =>
  resolveFezerTypeFromSpatialContext({
    characterId: currentCharacterId,
    roomId: currentRoomId,
  });

// 代理头像文件名（对应 /avatars/ 目录下的文件）
const AGENT_AVATARS: Record<FezerType, string> = {
  core: "kitty-ghostcatpink.gif",
  builder: "kitty-bongopixel.gif",
  ai: "kitty-cosmew.gif",
  writer: "kitty-athenaeum.gif",
  reader: "kitty-hillhouse.gif",
  visual: "kitty-witchcat.gif",
  wanderer: "kitty-shadowken.gif",
};

// 房间背景图片配置
const ROOM_BACKGROUNDS: Record<string, string> = {
  default: "https://dl.glitter-graphics.com/pub/649/649804eyuhgxpqvf.gif",
  lobby: "https://dl.glitter-graphics.com/pub/604/604130ffildt9rvn.png",
  workspace: "https://dl.glitter-graphics.com/pub/609/609620om6997ybtu.jpg",
  lounge: "https://dl.glitter-graphics.com/pub/2751/2751979qgmjbriplq.jpg",
  studio: "http://n1.backgroundsarchive.net/pub/2/2043ua6uzh3vmw.jpg",
  library: "http://n1.backgroundsarchive.net/pub/2/2083v5cfwcwz67.jpg",
};

// 获取头像 URL（自动适配 GitHub Pages 路径）
const getAvatarUrl = (agentId: FezerType | undefined): string => {
  if (!agentId)
    return `${import.meta.env.BASE_URL}avatars/kitty-ghostcatpink.gif`;
  return `${import.meta.env.BASE_URL}avatars/${AGENT_AVATARS[agentId]}`;
};

// 获取房间背景
const getRoomBackground = (roomId: string | undefined) => {
  return ROOM_BACKGROUNDS[roomId || ""] || ROOM_BACKGROUNDS.default;
};

type ChatMode = "floating" | "sidebar";

const CHAT_UNAVAILABLE_MESSAGE = "AI 服务暂时不可用，请稍后再试。";

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
  const [selectedAgentId, setSelectedAgentId] = useState<FezerType | undefined>(
    undefined
  );
  const [chatMode, setChatMode] = useState<ChatMode>("floating");

  // 拖拽状态
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { sendMessage, isLoading, thinkingState } = useAgentChat({
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

  // 打开聊天窗口时重置消息
  useEffect(() => {
    if (isOpen) {
      setMessages([]);
      setCurrentResponse(null);
      setSelectedAgentId(undefined);
    }
  }, [characterId, isOpen, roomId]);

  // 拖拽开始
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (chatMode === "sidebar") return;
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    },
    [chatMode, position]
  );

  // 拖拽移动
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;

      // 限制在视口内
      const maxX = window.innerWidth - 100;
      const maxY = window.innerHeight - 100;
      const clampedX = Math.max(-maxX, Math.min(maxX, newX));
      const clampedY = Math.max(-maxY, Math.min(maxY, newY));

      setPosition({ x: clampedX, y: clampedY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStart]);

  // 切换侧边栏模式
  const toggleSidebarMode = useCallback(() => {
    if (chatMode === "sidebar") {
      setChatMode("floating");
      setPosition({ x: 0, y: 0 });
    } else {
      setChatMode("sidebar");
      setPosition({ x: 0, y: 0 });
    }
  }, [chatMode]);

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
      const activeAgentId =
        selectedAgentId || resolveAgentFromContext(characterId, roomId);
      await sendMessage({
        userInput: text,
        characterId: selectedAgentId || characterId,
        roomId,
        interactionType: activeAgentId ? "click" : "chat",
        grounding: "public_profile",
      });
    } catch (error) {
      console.error("Chat error:", error);
      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-error`,
        role: "assistant",
        content: CHAT_UNAVAILABLE_MESSAGE,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    setInputValue(question);
  };

  const handleSuggestedAgent = (agentId: FezerType) => {
    setSelectedAgentId(agentId);
    setCurrentResponse({
      text: `你正在与 ${AGENT_NAMES[agentId]} 对话。请问有什么我可以帮助你的？`,
      panel: "character",
      speakingAgentId: agentId,
      suggestedQuestions: [],
    });
  };

  if (!isOpen) return null;

  const currentAgentId =
    currentResponse?.speakingAgentId ||
    selectedAgentId ||
    resolveAgentFromContext(characterId, roomId);
  const currentAgentColor = currentAgentId
    ? AGENT_COLORS[currentAgentId]
    : "#f97316";
  const currentAgentName = currentAgentId
    ? AGENT_NAMES[currentAgentId]
    : "Fezer";

  const roomBackground = getRoomBackground(roomId);

  // 侧边栏模式样式
  const isSidebar = chatMode === "sidebar";
  const modalStyle = isSidebar
    ? {
        position: "fixed" as const,
        right: 0,
        top: 0,
        bottom: 0,
        width: "400px",
        maxWidth: "90vw",
      }
    : {
        position: "fixed" as const,
        left: "50%",
        top: "50%",
        transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
      };

  return (
    <div className="z-50" style={modalStyle}>
      <div
        ref={modalRef}
        className="bg-white shadow-2xl overflow-hidden flex flex-col"
        style={{
          height: isSidebar ? "100vh" : "auto",
          maxHeight: isSidebar ? "100vh" : "85vh",
          borderRadius: isSidebar ? "0" : "1rem",
        }}
      >
        {/* 头部 */}
        <div
          className="flex items-center justify-between px-4 py-3 text-white shrink-0"
          style={{
            backgroundColor: currentAgentColor,
            cursor: isSidebar ? "default" : "grab",
            userSelect: isDragging ? "none" : "auto",
          }}
          onMouseDown={handleDragStart}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center overflow-hidden shrink-0">
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
            <div className="min-w-0">
              <h3 className="font-semibold text-lg truncate">
                {currentAgentName}
              </h3>
              <p className="text-xs opacity-80 truncate">
                {currentResponse?.panel === "guide" && "导览员"}
                {currentResponse?.panel === "character" && "角色对话"}
                {currentResponse?.panel === "resume" && "简历信息"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* 侧边栏切换按钮 */}
            <button
              onClick={toggleSidebarMode}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
              title={isSidebar ? "切换为浮动模式" : "切换为侧边栏模式"}
            >
              <span className="text-sm">{isSidebar ? "⬅" : "▶"}</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
            >
              <span className="text-lg">✕</span>
            </button>
          </div>
        </div>

        {/* 消息列表 */}
        <div
          className="flex-1 overflow-y-auto p-4 space-y-3 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${roomBackground})`,
          }}
        >
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-gray-600">
              <p>输入消息开始与 {currentAgentName} 对话...</p>
            </div>
          )}
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-4 py-2 rounded-2xl ${
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
            <ThinkingIndicator
              agentName={currentAgentName}
              agentColor={currentAgentColor}
              thinkingStep={thinkingState?.step}
            />
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 建议问题 */}
        {currentResponse?.suggestedQuestions &&
          currentResponse.suggestedQuestions.length > 0 && (
            <div className="px-4 py-3 border-t bg-white shrink-0">
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
            <div className="px-4 py-3 border-t bg-white shrink-0">
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
        <div className="p-4 border-t bg-white shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="输入问题... (Shift+Enter 换行)"
              className="flex-1 px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <button
              onClick={() => handleSend()}
              disabled={isLoading || !inputValue.trim()}
              className="px-6 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition shrink-0"
            >
              发送
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
