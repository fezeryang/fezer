import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { Link } from "wouter";
import { ChatModal } from "@/components/jianli/ChatModal";
import { ROOM_IDS, ROOMS } from "@/components/jianli/assets/roomsConfig";
import { loadPosts, loadWorks } from "@/content/loaders";
import { loadResumeSummary } from "@/content/loaders/resume";
import { Minimap } from "@/components/jianli/Minimap";
import { WebGLFallback } from "@/components/jianli/WebGLFallback";
import { SceneLoadingFallback } from "@/components/jianli/SceneLoadingFallback";
import { isWebGLAvailable } from "@/lib/webgl-support";
import { useIsMobile } from "@/hooks/useMobile";
import {
  loadVisitorProgress,
  markCharacterDiscovered,
  markRoomVisited,
} from "@/lib/visitor-progress";
import {
  buildRoomGreeting,
  isGreetingEnabled,
  markGreetingShown,
  setGreetingEnabled,
  shouldShowGreeting,
} from "@/lib/room-greeting";

const Scene = lazy(() =>
  import("@/components/jianli/Scene").then(module => ({
    default: module.Scene,
  }))
);

/** 房间内容入口：内部链接走 wouter，外部链接新开标签页 */
function RoomContentLink({
  href,
  label,
  title,
}: {
  href: string;
  label: string;
  title: string;
}) {
  const className =
    "block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 hover:bg-slate-100 transition";
  const badge = (
    <span className="text-[10px] uppercase tracking-wider text-slate-400">
      {label}
    </span>
  );
  const name = (
    <p className="text-sm font-medium text-slate-800 truncate">{title}</p>
  );

  if (href.startsWith("/")) {
    return (
      <Link href={href} className={className}>
        {badge}
        {name}
      </Link>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {badge}
      {name}
    </a>
  );
}

export default function Jianli() {
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState("central");
  const [isRoomPanelCollapsed, setIsRoomPanelCollapsed] = useState(false);
  const [isGuidePanelCollapsed, setIsGuidePanelCollapsed] = useState(false);
  const isMobile = useIsMobile();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatContext, setChatContext] = useState<{
    characterId?: string;
    roomId?: string;
  }>({ roomId: "central" });
  // 递增即重置相机视角到当前房间
  const [cameraResetToken, setCameraResetToken] = useState(0)
  // 已访问房间（B7 minimap 状态 + C6 访客进度，纯客户端）
  const [visitedRoomIds, setVisitedRoomIds] = useState<string[]>(() =>
    loadVisitorProgress().visitedRooms
  )
  // C1 主动招呼：模板拼接，零 LLM
  const [roomGreeting, setRoomGreeting] = useState<string | null>(null)
  // B8：拿不到 WebGL 时降级为文字版，而不是白屏
  const [webglAvailable] = useState(() => isWebGLAvailable())
  const isChatOpenRef = useRef(isChatOpen);
  const activeRoom = useMemo(() => ROOMS[activeRoomId], [activeRoomId])

  // 简历内容来自 profile markdown（C11）：改内容只改 markdown，不改代码
  const resume = useMemo(() => loadResumeSummary(), []);

  // 房间内容化（C9）：来自 frontmatter 的 rooms 标注，见 content/works|blog
  const roomContent = useMemo(() => {    const works = loadWorks().filter(work =>
      work.rooms?.includes(activeRoomId)
    );
    const posts = loadPosts().filter(post =>
      post.rooms?.includes(activeRoomId)
    );
    return { works, posts };
  }, [activeRoomId]);

  const handleChatRequest = (context: {
    characterId?: string;
    roomId?: string;
  }) => {
    // 访客进度（C6）：点过的角色计入已发现
    if (context.characterId) {
      markCharacterDiscovered(context.characterId);
    }
    setChatContext({
      characterId: context.characterId,
      roomId: context.roomId ?? activeRoomId,
    });
    setIsChatOpen(true);
  };

  const handleCurrentRoomChat = () => {
    handleChatRequest({ roomId: activeRoomId });
  };

  // 移动端：房间面板默认收起为底部抽屉，避免盖住 3D 场景
  useEffect(() => {
    if (isMobile) {
      setIsRoomPanelCollapsed(true);
      setIsGuidePanelCollapsed(true);
    }
  }, [isMobile]);

  // 进入房间即记入访客进度（写入 localStorage，供 minimap 与后续个性化使用）
  useEffect(() => {
    setVisitedRoomIds(markRoomVisited(activeRoomId).visitedRooms);
  }, [activeRoomId]);

  // C1：进入房间 1.5s 后招呼一次；正在聊天不打断，关闭开关后不再出现
  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);

  useEffect(() => {
    if (!isGreetingEnabled() || !shouldShowGreeting(activeRoomId)) return;
    if (isChatOpenRef.current) return;

    const timer = setTimeout(() => {
      if (isChatOpenRef.current) return;

      const text = buildRoomGreeting(
        { name: activeRoom.name, summary: activeRoom.summary },
        roomContent.works.map(work => ({ title: work.title })),
        roomContent.posts.map(post => ({ title: post.title }))
      );
      markGreetingShown(activeRoomId);
      setRoomGreeting(text);
    }, 1500);

    return () => clearTimeout(timer);
  }, [activeRoomId, activeRoom, roomContent]);

  // 招呼气泡自动消失
  useEffect(() => {
    if (!roomGreeting) return;
    const timer = setTimeout(() => setRoomGreeting(null), 9000);
    return () => clearTimeout(timer);
  }, [roomGreeting]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-200">
      {/* 3D 场景（B8：无 WebGL 时降级为文字版） */}
      {webglAvailable ? (
        <Suspense fallback={<SceneLoadingFallback />}>
          <Scene
            activeRoomId={activeRoomId}
            onRoomSelect={setActiveRoomId}
            onChatRequest={handleChatRequest}
            cameraResetToken={cameraResetToken}
          />
        </Suspense>
      ) : (
        <WebGLFallback />
      )}

      {/* UI 层 */}
      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <Minimap
          activeRoomId={activeRoomId}
          visitedRoomIds={visitedRoomIds}
          onRoomSelect={setActiveRoomId}
        />

        {/* C1 房间招呼（模板拼接，零 LLM） */}
        {roomGreeting && (
          <div className="pointer-events-auto absolute bottom-24 left-4 max-w-xs rounded-2xl border border-slate-900/10 bg-slate-50/95 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.18)] backdrop-blur-md">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              {activeRoom.name}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-700">
              {roomGreeting}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setRoomGreeting(null);
                  handleCurrentRoomChat();
                }}
                className="rounded-full bg-slate-900 px-3 py-1 text-xs text-white hover:bg-slate-800"
              >
                聊聊这个房间
              </button>
              <button
                type="button"
                onClick={() => {
                  setGreetingEnabled(false);
                  setRoomGreeting(null);
                }}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                不再自动出现
              </button>
            </div>
          </div>
        )}
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
              isMobile
                ? "fixed right-0 bottom-0 left-0 max-h-[70vh] overflow-y-auto rounded-t-3xl rounded-b-none p-5"
                : isRoomPanelCollapsed
                  ? "w-14 p-3"
                  : "max-w-sm p-5"
            }`}
          >
            <div
              className={`flex items-center ${isRoomPanelCollapsed ? "justify-center" : "justify-between"}`}
            >
              {!isRoomPanelCollapsed && (
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Current Room
                </p>
              )}
              <button
                type="button"
                onClick={() => setIsRoomPanelCollapsed(prev => !prev)}
                className="rounded-full border border-slate-300/80 bg-white/80 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                aria-label={
                  isRoomPanelCollapsed ? "展开房间面板" : "收起房间面板"
                }
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
                    {activeRoom.highlights.map(item => (
                      <span
                        key={item}
                        className="rounded-full border border-slate-300/80 bg-slate-100/80 px-3 py-1 text-xs text-slate-700"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 房间真实内容（作品/博客，来自内容 frontmatter 的 rooms 标注） */}
                <div className="mt-5 rounded-2xl bg-white/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    房间内容
                  </p>
                  {roomContent.works.length === 0 &&
                  roomContent.posts.length === 0 ? (
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      这个房间的内容还在整理中 ——
                      可以先和这里的角色聊聊，或去相邻房间看看。
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {roomContent.works.map(work => (
                        <RoomContentLink
                          key={`work-${work.slug}`}
                          href={
                            work.link?.startsWith("/")
                              ? work.link
                              : (work.link ?? "/portfolio")
                          }
                          label="作品"
                          title={work.title}
                        />
                      ))}
                      {roomContent.posts.map(post => (
                        <RoomContentLink
                          key={`post-${post.slug}`}
                          href={`/blog/${post.slug}`}
                          label="博客"
                          title={post.title}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  {ROOM_IDS.map(roomId => {
                    const room = ROOMS[roomId];
                    const isActive = roomId === activeRoomId;
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
                    );
                  })}
                </div>
              </>
            )}
          </aside>

          <aside
            className={`pointer-events-auto rounded-3xl border border-slate-900/10 bg-slate-50/72 text-slate-900 shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur-md transition-all ${
              isMobile ? "hidden" : isGuidePanelCollapsed ? "w-14 p-3" : "max-w-xs p-5"
            }`}
          >
            <div
              className={`flex items-center ${isGuidePanelCollapsed ? "justify-center" : "justify-between"}`}
            >
              {!isGuidePanelCollapsed && (
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Exploration Guide
                </p>
              )}
              <button
                type="button"
                onClick={() => setIsGuidePanelCollapsed(prev => !prev)}
                className="rounded-full border border-slate-300/80 bg-white/80 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                aria-label={
                  isGuidePanelCollapsed ? "展开引导面板" : "收起引导面板"
                }
              >
                {isGuidePanelCollapsed ? "展开" : "收起"}
              </button>
            </div>

            {!isGuidePanelCollapsed && (
              <>
                <div className="mt-4 space-y-4 text-sm leading-6 text-slate-600">
                  <p>点击房间标签或左侧卡片，镜头会切换到对应空间。</p>
                  <p>
                    这个页面目前是 3D
                    简历的第一阶段：地图结构、分区语义和导览面板已经接通。
                  </p>
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
                <kbd className="rounded bg-slate-200 px-2 py-1 text-xs text-slate-800">
                  拖动
                </kbd>
                探索视角
              </span>
              <span className="flex items-center gap-2">
                <kbd className="rounded bg-slate-200 px-2 py-1 text-xs text-slate-800">
                  滚轮
                </kbd>
                缩放
              </span>
              <span className="flex items-center gap-2">
                <kbd className="rounded bg-slate-200 px-2 py-1 text-xs text-slate-800">
                  点击
                </kbd>
                交互
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              {isMobile && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-slate-400/60 bg-slate-100/70 px-3 text-xs text-slate-900 hover:bg-slate-200"
                  onClick={() => setShowResumeModal(true)}
                >
                  简历摘要
                </Button>
              )}
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
              <button
                type="button"
                onClick={() => setCameraResetToken(prev => prev + 1)}
                className="rounded-lg border border-slate-300/70 bg-white/80 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
              >
                重置视角
              </button>
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
            onClick={e => e.stopPropagation()}
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
                  {resume.bio}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {resume.location} · {resume.title}
                </p>
              </section>

              <section>
                <h3 className="mb-2 text-lg font-semibold text-slate-800">
                  核心能力
                </h3>
                <ul className="space-y-2 text-slate-700">
                  {resume.skillGroups.map(group => (
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
                  {resume.experience.map(item => (
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
                  {resume.education.map(item => (
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
                  {resume.interestGroups.map(group => (
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
  );
}
