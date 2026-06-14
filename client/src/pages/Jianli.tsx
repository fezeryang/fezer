import { lazy, Suspense, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { MessageCircle } from "lucide-react"
import { Link } from "wouter"
import { ChatModal } from "@/components/jianli/ChatModal"
import { ROOM_IDS, ROOMS } from "@/components/jianli/assets/roomsConfig"
import {
  PROFILE,
  SKILLS,
  EXPERIENCE,
  EDUCATION,
  INTERESTS,
} from "@fezer/shared/resume"

const SKILL_GROUPS_FOR_SUMMARY: Array<{ label: string; items: string[] }> = [
  { label: "AI 与应用", items: SKILLS.ai },
  { label: "AI 协同开发", items: SKILLS.tools },
  { label: "数据分析", items: SKILLS.data },
  { label: "产品与执行", items: SKILLS.product },
]

const INTEREST_GROUPS_FOR_SUMMARY: Array<{ label: string; items: string[] }> =
  [
    { label: "AI", items: INTERESTS.ai },
    { label: "阅读", items: INTERESTS.reading },
    { label: "写作", items: INTERESTS.writing },
    { label: "设计", items: INTERESTS.design },
    { label: "旅行", items: INTERESTS.travel },
  ]

const Scene = lazy(() =>
  import("@/components/jianli/Scene").then((module) => ({
    default: module.Scene,
  }))
)

export default function Jianli() {
  const [showResumeModal, setShowResumeModal] = useState(false)
  const [activeRoomId, setActiveRoomId] = useState("central")
  const [isRoomPanelCollapsed, setIsRoomPanelCollapsed] = useState(false)
  const [isGuidePanelCollapsed, setIsGuidePanelCollapsed] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatContext, setChatContext] = useState<{
    characterId?: string
    roomId?: string
  }>({ roomId: "central" })
  const activeRoom = useMemo(() => ROOMS[activeRoomId], [activeRoomId])

  const handleChatRequest = (context: {
    characterId?: string
    roomId?: string
  }) => {
    setChatContext({
      characterId: context.characterId,
      roomId: context.roomId ?? activeRoomId,
    })
    setIsChatOpen(true)
  }

  const handleCurrentRoomChat = () => {
    handleChatRequest({ roomId: activeRoomId })
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-200">
      {/* 3D 场景 */}
      <Suspense
        fallback={
          <div className="flex h-full w-full items-center justify-center bg-slate-200 text-sm text-slate-600">
            正在加载 3D 场景...
          </div>
        }
      >
        <Scene
          activeRoomId={activeRoomId}
          onRoomSelect={setActiveRoomId}
          onChatRequest={handleChatRequest}
        />
      </Suspense>

      {/* UI 层 */}
      <div className="pointer-events-none absolute inset-0 flex flex-col">
        {/* 顶部导航栏 */}
        <header className="pointer-events-auto flex items-center justify-between border-b border-slate-800/10 bg-slate-100/60 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <span className="rounded-full bg-slate-50/80 px-3 py-1 text-xs text-slate-700">
              3D Archive
            </span>
          </div>
          <nav className="flex gap-4">
            <Link
              href="/"
              className="text-sm text-slate-700 transition-colors hover:text-slate-950"
            >
              返回主页
            </Link>
          </nav>
        </header>

        {/* 中间区域 */}
        <div className="flex flex-1 items-start justify-between gap-6 px-6 py-6">
          <aside
            className={`pointer-events-auto rounded-3xl border border-slate-900/10 bg-slate-50/72 text-slate-900 shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur-md transition-all ${
              isRoomPanelCollapsed ? "w-14 p-3" : "max-w-sm p-5"
            }`}
          >
            <div className={`flex items-center ${isRoomPanelCollapsed ? "justify-center" : "justify-between"}`}>
              {!isRoomPanelCollapsed && (
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Current Room
                </p>
              )}
              <button
                type="button"
                onClick={() => setIsRoomPanelCollapsed((prev) => !prev)}
                className="rounded-full border border-slate-300/80 bg-white/80 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                aria-label={isRoomPanelCollapsed ? "展开房间面板" : "收起房间面板"}
              >
                {isRoomPanelCollapsed ? "展开" : "收起"}
              </button>
            </div>

            {!isRoomPanelCollapsed && (
              <>
                <div className="mt-3 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold">{activeRoom.name}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {activeRoom.summary}
                    </p>
                  </div>
                  <span
                    className="mt-1 h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: activeRoom.accent }}
                  />
                </div>

                <div className="mt-5 rounded-2xl bg-white/70 p-4">
                  <p className="text-sm font-medium text-slate-800">
                    {activeRoom.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {activeRoom.highlights.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-slate-300/80 bg-slate-100/80 px-3 py-1 text-xs text-slate-700"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  {ROOM_IDS.map((roomId) => {
                    const room = ROOMS[roomId]
                    const isActive = roomId === activeRoomId
                    return (
                      <button
                        key={roomId}
                        type="button"
                        onClick={() => setActiveRoomId(roomId)}
                        className={`rounded-2xl border px-3 py-2 text-left text-sm transition ${
                          isActive
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-300/70 bg-white/75 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {room.name}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </aside>

          <aside
            className={`pointer-events-auto rounded-3xl border border-slate-900/10 bg-slate-50/72 text-slate-900 shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur-md transition-all ${
              isGuidePanelCollapsed ? "w-14 p-3" : "max-w-xs p-5"
            }`}
          >
            <div className={`flex items-center ${isGuidePanelCollapsed ? "justify-center" : "justify-between"}`}>
              {!isGuidePanelCollapsed && (
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Exploration Guide
                </p>
              )}
              <button
                type="button"
                onClick={() => setIsGuidePanelCollapsed((prev) => !prev)}
                className="rounded-full border border-slate-300/80 bg-white/80 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                aria-label={isGuidePanelCollapsed ? "展开引导面板" : "收起引导面板"}
              >
                {isGuidePanelCollapsed ? "展开" : "收起"}
              </button>
            </div>

            {!isGuidePanelCollapsed && (
              <>
                <div className="mt-4 space-y-4 text-sm leading-6 text-slate-600">
                  <p>点击房间标签或左侧卡片，镜头会切换到对应空间。</p>
                  <p>这个页面目前是 3D 简历的第一阶段：地图结构、分区语义和导览面板已经接通。</p>
                  <p>下一步可以继续往每个房间填充项目、经历和作品内容。</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-5 w-full border-slate-400/60 bg-slate-100/70 text-slate-900 hover:bg-slate-200"
                  onClick={() => setShowResumeModal(true)}
                >
                  打开简历摘要
                </Button>
              </>
            )}
          </aside>
        </div>

        {/* 底部操作提示 */}
        <footer className="pointer-events-auto border-t border-slate-800/10 bg-slate-100/60 px-6 py-4 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-4 text-sm text-slate-700 sm:gap-6">
              <span className="flex items-center gap-2">
                <kbd className="rounded bg-slate-200 px-2 py-1 text-xs text-slate-800">拖动</kbd>
                探索视角
              </span>
              <span className="flex items-center gap-2">
                <kbd className="rounded bg-slate-200 px-2 py-1 text-xs text-slate-800">滚轮</kbd>
                缩放
              </span>
              <span className="flex items-center gap-2">
                <kbd className="rounded bg-slate-200 px-2 py-1 text-xs text-slate-800">点击</kbd>
                交互
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <Button
                type="button"
                size="sm"
                className="gap-2 rounded-xl bg-slate-900 px-3 text-xs text-white hover:bg-slate-800 sm:text-sm"
                onClick={handleCurrentRoomChat}
              >
                <MessageCircle className="h-4 w-4" />
                与当前房间 Agent 聊天
              </Button>
              <span className="text-xs text-slate-500">
                已聚焦：{activeRoom.name}
              </span>
            </div>
          </div>
        </footer>
      </div>

      <ChatModal
        isOpen={isChatOpen}
        characterId={chatContext.characterId}
        roomId={chatContext.roomId}
        onClose={() => setIsChatOpen(false)}
        onRoomSwitch={setActiveRoomId}
        initialMessage="你好！"
      />

      {/* 简历模态框 */}
      {showResumeModal && (
        <div
          className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-slate-900/35 backdrop-blur-sm"
          onClick={() => setShowResumeModal(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-lg border border-slate-200/80 bg-slate-50/95 p-8 text-slate-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Fezer - 简历</h2>
              <button
                onClick={() => setShowResumeModal(false)}
                className="text-slate-500 hover:text-slate-900"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              <section>
                <h3 className="mb-2 text-lg font-semibold text-slate-800">
                  简介
                </h3>
                <p className="whitespace-pre-line text-slate-700">
                  {PROFILE.bio}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {PROFILE.location} · {PROFILE.title}
                </p>
              </section>

              <section>
                <h3 className="mb-2 text-lg font-semibold text-slate-800">
                  核心能力
                </h3>
                <ul className="space-y-2 text-slate-700">
                  {SKILL_GROUPS_FOR_SUMMARY.map(group => (
                    <li key={group.label}>
                      <span className="font-medium text-slate-800">
                        {group.label}：
                      </span>
                      {group.items.join("、")}
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="mb-2 text-lg font-semibold text-slate-800">
                  实习经历
                </h3>
                <ul className="space-y-3 text-slate-700">
                  {EXPERIENCE.map(item => (
                    <li key={`${item.company}-${item.period}`}>
                      <p className="font-medium text-slate-800">
                        {item.position} · {item.company}
                        <span className="ml-2 text-sm text-slate-500">
                          {item.period}
                        </span>
                      </p>
                      <p className="text-sm text-slate-600">
                        {item.description}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="mb-2 text-lg font-semibold text-slate-800">
                  教育背景
                </h3>
                <ul className="space-y-2 text-slate-700">
                  {EDUCATION.map(item => (
                    <li key={item.school}>
                      <p className="font-medium text-slate-800">
                        {item.school} · {item.degree}
                        <span className="ml-2 text-sm text-slate-500">
                          {item.period}
                        </span>
                      </p>
                      <p className="text-sm text-slate-600">
                        {item.description}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="mb-2 text-lg font-semibold text-slate-800">
                  兴趣方向
                </h3>
                <ul className="space-y-1 text-slate-700">
                  {INTEREST_GROUPS_FOR_SUMMARY.map(group => (
                    <li key={group.label}>
                      <span className="font-medium text-slate-800">
                        {group.label}：
                      </span>
                      {group.items.join("、")}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="border-t border-slate-300/70 pt-4">
                <p className="text-sm text-slate-500">
                  关闭此窗口，继续在 3D 空间中探索更多内容 →
                </p>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
