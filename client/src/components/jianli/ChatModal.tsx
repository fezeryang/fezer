/**
 * ChatModal - Agent 对话弹窗组件
 * 支持拖拽、侧边栏固定模式、房间背景
 */

import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
} from "react";
import { Streamdown } from "streamdown";
import { useLocation } from "wouter";
import { Download, Mic, Square } from "lucide-react";
import { canRecordAudio, transcribeAudioBlob } from "@/lib/audio-recording";
import {
  buildConversationMarkdown,
  downloadMarkdown,
} from "@/lib/conversation-export";
import { ROOMS } from "./assets/roomsConfig";
import { fetchThreadHistory, useAgentChat } from "../../hooks/useAgentChat";
import { getThreadId } from "@/lib/chat-thread";
import { loadVisitorProgress, markQuestionAsked } from "@/lib/visitor-progress";
import type { AgentResponse, ContentCard } from "@fezer/shared/schemas/agent";
import type { FezerType } from "@fezer/shared/schemas/character";
import {
  resolveFezerTypeFromSpatialContext,
  AGENT_DISPLAY_NAMES,
} from "@fezer/shared/characters";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { processRoomLinksInDOM } from "./utils/roomLinksDom";
import { toolLabel } from "./utils/toolLabels";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  /** 该轮回答的 agent（assistant 消息携带，用于历史归因） */
  agentId?: FezerType;
  /** 回答尾部的可点击内容卡片 */
  cards?: ContentCard[];
}

interface ChatModalProps {
  isOpen: boolean;
  characterId?: string;
  roomId?: string;
  onClose: () => void;
  onRoomSwitch?: (roomId: string) => void;
  initialMessage?: string;
}

// 代理颜色（仅 UI 层使用的主题色）
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

/** 回传给后端的会话历史上限（与服务端信任边界一致） */
const MAX_HISTORY_TURNS = 8;

function createMessageId(prefix: string): string {
  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${randomId}`;
}

export function ChatModal({
  isOpen,
  characterId,
  roomId,
  onClose,
  onRoomSwitch,
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
  // 流式思考步骤：由 tool.call / agent.start 事件驱动，ThinkingIndicator 实时展示
  const [liveStep, setLiveStep] = useState<string | null>(null);
  // 流式回答的逐字渲染：text.delta 事件累积
  const [streamingText, setStreamingText] = useState("");
  // C7：本次打开是否恢复了上次会话
  const [resumedThread, setResumedThread] = useState(false);
  // 多专家协作时间线（C4）：agent.start / agent.done 事件驱动
  const [collaborators, setCollaborators] = useState<
    Array<{ agentId: FezerType; displayName: string; done: boolean }>
  >([]);
  // C8 语音输入：录音 → 转写 → 填进输入框（不直接发送，用户仍可编辑）
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  // C6：把本地探索进度随请求上送（服务端据此做个性化推荐）
  const buildCheckpoint = useCallback(() => {
    const progress = loadVisitorProgress();
    return {
      visitedRooms: progress.visitedRooms,
      discoveredCharacters: progress.discoveredCharacters,
    };
  }, []);

  const handleToggleRecording = useCallback(async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    setVoiceError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = event => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);

        void (async () => {
          setIsTranscribing(true);
          try {
            const text = await transcribeAudioBlob(
              new Blob(chunks, { type: recorder.mimeType || "audio/webm" })
            );
            if (text.trim()) {
              setInputValue(prev =>
                prev ? `${prev} ${text.trim()}` : text.trim()
              );
            }
          } catch (error) {
            setVoiceError(
              error instanceof Error ? error.message : "语音识别失败"
            );
          } finally {
            setIsTranscribing(false);
          }
        })();
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      setVoiceError("无法访问麦克风，请检查浏览器权限。");
    }
  }, [isRecording]);

  // C10：导出当前对话为 Markdown（求职场景下访客想留存/转发）
  const handleExportConversation = useCallback(() => {
    const roomName = roomId ? ROOMS[roomId]?.name : undefined;
    const markdown = buildConversationMarkdown(
      messages.map(message => ({
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
        ...(message.agentId ? { agentId: message.agentId } : {}),
      })),
      { ...(roomName ? { roomName } : {}) }
    );

    downloadMarkdown(
      `fezer-chat-${new Date().toISOString().slice(0, 10)}.md`,
      markdown
    );
  }, [messages, roomId]);

  const [, setLocation] = useLocation();

  // 内容卡片点击：博客去详情页；作品优先去自己的链接，否则去作品列表
  const openContentCard = useCallback(
    (card: ContentCard) => {
      if (card.type === "blog") {
        setLocation(`/blog/${card.slug}`);
        return;
      }
      if (card.link?.startsWith("/")) {
        setLocation(card.link);
        return;
      }
      if (card.link) {
        window.open(card.link, "_blank", "noopener");
        return;
      }
      setLocation("/portfolio");
    },
    [setLocation]
  );

  // 拖拽状态
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // 房间链接点击处理
  const handleRoomLinkClick = useCallback(
    (targetRoomId: string) => {
      if (onRoomSwitch) {
        onRoomSwitch(targetRoomId);
        onClose();
      }
    },
    [onRoomSwitch, onClose]
  );

  const {
    sendMessage,
    sendMessageStream,
    cancelInFlight,
    isLoading,
    thinkingState,
  } = useAgentChat({
    onSuccess: response => {
      // 弹窗已关闭（或关闭后重开、会话已被重置）时，丢弃属于旧会话的迟到响应
      if (!isOpenRef.current) return;
      const assistantMessage: ChatMessage = {
        id: createMessageId("assistant"),
        role: "assistant",
        content: response.text,
        timestamp: Date.now(),
        agentId: response.speakingAgentId,
        cards: response.cards,
      };
      setMessages(prev => [...prev, assistantMessage]);
      setCurrentResponse(response);
    },
  });

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 处理房间链接（在消息渲染后）
  useEffect(() => {
    if (!onRoomSwitch) return;

    messages.forEach(msg => {
      if (msg.role === "assistant") {
        const container = messageContainerRefs.current.get(msg.id);
        if (container) {
          processRoomLinksInDOM(container, handleRoomLinkClick);
        }
      }
    });
  }, [messages, onRoomSwitch, handleRoomLinkClick]);

  // 仅在弹窗从关闭到打开的转换时重置会话。
  // 切换房间/角色（例如点击房间链接、选择推荐 agent）不再清空对话，
  // 保证多轮上下文跨房间连续，后端按内容路由到合适的专家。
  const wasOpenRef = useRef(false);
  const handleSendRef = useRef<(content?: string) => Promise<void>>(
    async () => undefined
  );
  // useLayoutEffect 先于所有 useEffect 执行，保证挂载当帧 ref 即指向最新 handleSend
  useLayoutEffect(() => {
    handleSendRef.current = handleSend;
  });
  const isOpenRef = useRef(isOpen);
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  // C7：恢复上次会话的消息列表；线程为空则退回打招呼
  const restoreThread = useCallback(
    async (threadId: string) => {
      const turns = await fetchThreadHistory(threadId);
      if (!isOpenRef.current) return;

      if (turns.length === 0) {
        if (initialMessage?.trim()) {
          void handleSendRef.current(initialMessage);
        }
        return;
      }

      setMessages(
        turns.map(turn => ({
          id: createMessageId(turn.role),
          role: turn.role,
          content: turn.content,
          timestamp: Date.now(),
          ...(turn.agentId ? { agentId: turn.agentId } : {}),
        }))
      );
      setResumedThread(true);
    },
    [initialMessage]
  );

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setMessages([]);
      setCurrentResponse(null);
      setSelectedAgentId(undefined);
      setResumedThread(false);

      const threadId = getThreadId();
      if (threadId) {
        void restoreThread(threadId);
      } else if (initialMessage?.trim()) {
        // 新会话开始时若有初始消息（如进入空间的打招呼语），自动发送一次
        void handleSendRef.current(initialMessage);
      }
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, initialMessage, restoreThread]);

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
      id: createMessageId("user"),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    // 先基于现有消息构建历史（不含即将发送的这条）
    const conversationHistory = messages
      .filter(msg => msg.content.trim().length > 0)
      .slice(-MAX_HISTORY_TURNS)
      .map(msg => ({
        role: msg.role,
        content: msg.content,
        ...(msg.agentId ? { agentId: msg.agentId } : {}),
      }));

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setStreamingText("");

    try {
      // 显式定向（用户点击角色或从推荐里选中了 agent）才发 click；
      // 纯房间内打字聊天发 chat，让后端按内容路由，房间只做软偏置
      const explicitAgentId = selectedAgentId || characterId;
      const request = {
        userInput: text,
        characterId: explicitAgentId,
        roomId,
        interactionType: (explicitAgentId ? "click" : "chat") as
          | "click"
          | "chat",
        grounding: "public_profile" as const,
        conversationHistory,
        ...buildCheckpoint(),
      };

      // C6：已问问题记入访客进度（供“避免重复提问”类个性化）
      markQuestionAsked(text);

      // 流式优先：工具步骤实时可见；流失败自动降级到非流式
      setLiveStep(null);
      const streamed = await sendMessageStream(request, event => {
        if (event.type === "tool.call") {
          setLiveStep(toolLabel(event.toolName));
        } else if (event.type === "agent.start") {
          setLiveStep(`${event.displayName} 正在思考...`);
          setCollaborators(prev =>
            prev.some(item => item.agentId === event.agentId)
              ? prev
              : [
                  ...prev,
                  {
                    agentId: event.agentId,
                    displayName: event.displayName,
                    done: false,
                  },
                ]
          );
        } else if (event.type === "agent.done") {
          setCollaborators(prev =>
            prev.map(item =>
              item.agentId === event.agentId ? { ...item, done: true } : item
            )
          );
        } else if (event.type === "text.delta") {
          setStreamingText(prev => prev + event.delta);
        }
      });
      if (!streamed) {
        await sendMessage(request);
      }
      setLiveStep(null);
      setStreamingText("");
    } catch (error) {
      setLiveStep(null);
      setStreamingText("");
      if ((error as Error).name === "AbortError") {
        // 用户取消：静默，不加错误气泡
        return;
      }
      console.error("Chat error:", error);
      const assistantMessage: ChatMessage = {
        id: createMessageId("assistant"),
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
      text: `你正在与 ${AGENT_DISPLAY_NAMES[agentId]} 对话。请问有什么我可以帮助你的？`,
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
    ? AGENT_DISPLAY_NAMES[currentAgentId]
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
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleExportConversation}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition hover:bg-white/30"
                title="导出对话（Markdown）"
                aria-label="导出对话"
              >
                <Download className="h-4 w-4" />
              </button>
            )}
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
          {resumedThread && (
            <div className="mb-2 rounded-xl bg-slate-100/80 px-3 py-2 text-center text-xs text-slate-500">
              已恢复上次的对话记忆 · 可直接接着问
            </div>
          )}
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
                  <div
                    ref={el => {
                      if (el) {
                        messageContainerRefs.current.set(msg.id, el);
                      }
                    }}
                    className="max-w-none font-chill-huofangsong"
                  >
                    <Streamdown>{msg.content}</Streamdown>
                    {msg.cards && msg.cards.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {msg.cards.map(card => (
                          <button
                            key={`${card.type}-${card.slug}`}
                            type="button"
                            onClick={() => openContentCard(card)}
                            className="w-full text-left px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition"
                          >
                            <span className="text-[10px] uppercase tracking-wider text-slate-400">
                              {card.type === "work" ? "作品" : "博客"}
                            </span>
                            <p className="text-sm font-medium text-slate-800 truncate">
                              {card.title}
                            </p>
                            {card.tags && card.tags.length > 0 && (
                              <p className="text-xs text-slate-500 truncate">
                                {card.tags.slice(0, 3).join(" · ")}
                              </p>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}
          {isLoading && collaborators.length > 1 && (
            <div className="flex justify-start">
              <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white/90 px-3 py-2 shadow-sm">
                <span className="text-xs text-slate-500">多专家协作</span>
                {collaborators.map(item => (
                  <span
                    key={item.agentId}
                    className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                  >
                    <img
                      src={getAvatarUrl(item.agentId)}
                      alt=""
                      className="h-4 w-4 rounded-full object-cover"
                    />
                    <span className="text-slate-700">
                      {item.displayName.split(" · ")[1] ?? item.displayName}
                    </span>
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        item.done
                          ? "bg-emerald-500"
                          : "bg-amber-400 animate-pulse motion-reduce:animate-none"
                      }`}
                    />
                  </span>
                ))}
              </div>
            </div>
          )}
          {isLoading && streamingText && (
            <div className="flex justify-start">
              <div className="max-w-[85%] px-4 py-2 rounded-2xl bg-white text-gray-800 rounded-bl-md shadow-sm">
                <div className="max-w-none font-chill-huofangsong whitespace-pre-wrap text-sm">
                  {streamingText}
                  <span className="animate-pulse motion-reduce:animate-none">
                    ▍
                  </span>
                </div>
              </div>
            </div>
          )}
          {isLoading && !streamingText && (
            <ThinkingIndicator
              agentName={currentAgentName}
              agentColor={currentAgentColor}
              thinkingStep={liveStep ?? thinkingState?.step}
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
                    {AGENT_DISPLAY_NAMES[agentId]}
                  </button>
                ))}
              </div>
            </div>
          )}

        {/* 输入框 */}
        <div className="p-4 border-t bg-white shrink-0">
          {voiceError && (
            <p className="mb-2 text-xs text-red-500">{voiceError}</p>
          )}
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
            {canRecordAudio() && (
              <button
                type="button"
                onClick={handleToggleRecording}
                disabled={isTranscribing || isLoading}
                aria-label={isRecording ? "停止录音" : "语音输入"}
                title={isRecording ? "停止录音" : "语音输入"}
                className={`shrink-0 rounded-full px-3 py-2 transition disabled:opacity-50 ${
                  isRecording
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "border border-gray-300 text-gray-600 hover:bg-gray-100"
                }`}
              >
                {isTranscribing ? (
                  <span className="text-xs">识别中</span>
                ) : isRecording ? (
                  <Square className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </button>
            )}
            {isLoading && (
              <button
                onClick={cancelInFlight}
                className="px-4 py-2 border border-gray-300 text-gray-600 rounded-full hover:bg-gray-100 transition shrink-0"
              >
                取消
              </button>
            )}
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
