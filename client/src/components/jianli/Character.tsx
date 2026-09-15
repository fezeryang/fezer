import { Html, useCursor, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CharacterProps, CharacterState, Vec3 } from "./assets/types";
import { CHARACTER_MODELS } from "./assets/characterConfig";
import { SpeechBubble } from "./SpeechBubble";
import { MEETING_WALK_SPEED, type FeedItem } from "@/lib/scene-bubbles";

// Vite base path 用于纹理资源路径修正
const BASE_URL = import.meta.env.BASE_URL ?? "/";
const MODEL_RESOURCE_PATH = `${BASE_URL}models/`;

function configureModelLoader(loader: any) {
  loader.setResourcePath(MODEL_RESOURCE_PATH);
}

// 角色地面Y坐标（根据模型调整）
const GROUND_Y = 0;

// 气泡世界坐标高度：挂在外层未缩放的移动 group 上，不随 0.3 缩放
const BUBBLE_Y = 1.6;

// 帧间隔上限：切回标签页或掉帧时 delta 会突刺，不夹住角色会瞬间跳过一大段距离
const MAX_FRAME_DELTA_SECONDS = 0.1;

// 投喂条（D7）：悬停角色时出现；Html 门户在 canvas 之上，点击不会触发 3D 组的 onClick
const FEED_BAR: Array<{ item: FeedItem; emoji: string; label: string }> = [
  { item: "coffee", emoji: "☕", label: "咖啡" },
  { item: "fish", emoji: "🐟", label: "鱼干" },
  { item: "book", emoji: "📖", label: "书" },
];

// 辅助函数：在圆内生成随机点
function randomPointInCircle(center: Vec3, radius: number): Vec3 {
  const angle = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * radius;
  return [
    center[0] + Math.cos(angle) * r,
    center[1],
    center[2] + Math.sin(angle) * r,
  ];
}

// 辅助函数：计算两点距离
function distance(a: Vec3, b: Vec3): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[2] - b[2]) ** 2);
}

// 辅助函数：两点向量
function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function Character({
  config,
  onClick,
  bubble,
  bubbleActions,
  meetingTarget,
  onFeed,
}: CharacterProps) {
  const groupRef = useRef<any>(null);
  const { scene } = useGLTF(
    config.model,
    undefined,
    undefined,
    configureModelLoader
  );

  // 状态机：idle | walking | waiting | meeting（D6：站在会议点上面向中心）
  const [state, setState] = useState<CharacterState>("idle");
  const [target, setTarget] = useState<Vec3>(config.position);
  const [waitEndTime, setWaitEndTime] = useState<number>(0);
  // 本次行走的目的：巡逻回家 or 赴会（决定速度与到达后的行为）
  const walkingToMeeting = useRef(false);
  // 悬停角色：显示投喂条（D7）
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  // 会议目标同步到 ref：useFrame 闭包跨渲染读取最新值
  const meetingRef = useRef<Vec3 | undefined>(meetingTarget);
  useEffect(() => {
    meetingRef.current = meetingTarget;
    // 新会议召唤打断等待/散会状态，让状态机下一帧重新决策
    setState(prev =>
      prev === "waiting" || prev === "meeting" ? "idle" : prev
    );
  }, [meetingTarget]);

  // 当前位置（可变引用）
  const currentPosition = useRef<Vec3>([...config.position]);
  const currentRotation = useRef<number>(0);

  // 模型克隆只做一次：写在 JSX 里会在每次 re-render 时重建整棵对象树
  const instance = useMemo(() => scene.clone(), [scene]);

  // 移动与状态机逻辑
  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;

    const now = clock.elapsedTime * 1000; // 转换为毫秒
    const meeting = meetingRef.current;

    if (state === "idle") {
      if (meeting) {
        // D6：赴会 —— 直接走向会议点
        walkingToMeeting.current = true;
        setTarget(meeting);
      } else {
        // 选择新的随机巡逻目标点
        walkingToMeeting.current = false;
        setTarget(
          randomPointInCircle(config.position, config.patrolRadius ?? 1.5)
        );
      }
      setState("walking");
    } else if (state === "walking") {
      // 会议被取消/变更：立即掉头（idle 会重新选巡逻目标或新会议点）
      if (walkingToMeeting.current && (!meeting || target !== meeting)) {
        setState("idle");
        return;
      }

      // 移动向目标：赴会用会议速度（漫游的 4-7 倍），否则常速
      const speed = walkingToMeeting.current
        ? MEETING_WALK_SPEED
        : (config.walkSpeed ?? 0.3);
      // 帧率无关：用真实帧间隔（秒），120Hz 与 60Hz 下速度一致
      const step = Math.min(delta, MAX_FRAME_DELTA_SECONDS);

      const dir = subtract(target, currentPosition.current);
      const dist = distance(currentPosition.current, target);

      if (dist < 0.1) {
        if (walkingToMeeting.current) {
          // 到会：转身面向来路方向（即会议中心一侧）站定
          currentRotation.current += Math.PI;
          groupRef.current.rotation.y = currentRotation.current;
          setState("meeting");
        } else {
          // 到达巡逻目标，开始等待
          setState("waiting");
          setWaitEndTime(now + (config.waitTime ?? 1500));
        }
      } else {
        // 移动
        const moveDist = Math.min(dist, speed * step);
        const normDir: Vec3 = [dir[0] / dist, 0, dir[2] / dist];
        currentPosition.current = [
          currentPosition.current[0] + normDir[0] * moveDist,
          GROUND_Y,
          currentPosition.current[2] + normDir[2] * moveDist,
        ];

        // 更新朝向（面向移动方向）
        currentRotation.current = Math.atan2(normDir[0], normDir[2]);
      }

      // 应用位置和旋转
      groupRef.current.position.set(
        currentPosition.current[0],
        currentPosition.current[1],
        currentPosition.current[2]
      );
      groupRef.current.rotation.y = currentRotation.current;
    } else if (state === "waiting") {
      // 会议召唤优先于等待（meetingTarget 变化的 effect 已把状态切回 idle，这里兜底）
      if (meeting) {
        setState("idle");
        return;
      }
      // 等待结束后进入idle状态
      if (now >= waitEndTime) {
        setState("idle");
      }
    } else if (state === "meeting") {
      // 散会：走回原房间恢复巡逻
      if (!meeting) {
        setState("idle");
      }
    }
  });

  return (
    // 外层：移动与旋转（世界坐标尺度）；气泡 Html 也挂在这里，随角色移动
    <group
      ref={groupRef}
      position={config.position}
      onClick={() => onClick?.(config.id)}
      onPointerOver={event => {
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* 内层：模型缩放。分两层是为了让气泡高度用世界坐标表达 */}
      <group scale={config.scale || [0.3, 0.3, 0.3]}>
        <primitive object={instance} />
      </group>
      {/* 无气泡时不渲染 Html，零每帧 DOM 同步成本 */}
      {bubble && (
        <Html
          position={[0, BUBBLE_Y, 0]}
          center
          distanceFactor={12}
          // 与房间标签同样压在 UI 层（z-50 聊天弹窗）之下
          zIndexRange={[20, 0]}
        >
          <SpeechBubble
            bubble={bubble}
            onChat={bubbleActions?.onChat}
            onDismiss={bubbleActions?.onDismiss}
          />
        </Html>
      )}
      {/* 投喂条（D7）：悬停且无气泡时出现；点它不会触发角色 onClick */}
      {hovered && !bubble && onFeed && (
        <Html
          position={[0, BUBBLE_Y, 0]}
          center
          distanceFactor={12}
          zIndexRange={[20, 0]}
        >
          <div className="t-bubble flex items-center gap-0.5 rounded-full border border-slate-900/10 bg-white/92 px-2 py-0.5 shadow-[0_8px_28px_rgba(15,23,42,0.15)]">
            {FEED_BAR.map(({ item, emoji, label }) => (
              <button
                key={item}
                type="button"
                title={`投喂${label}`}
                aria-label={`投喂${label}`}
                onClick={() => onFeed(config.id, item)}
                className="rounded-full px-1 text-lg leading-7 transition-transform duration-150 hover:scale-110 motion-reduce:transition-none"
              >
                {emoji}
              </button>
            ))}
          </div>
        </Html>
      )}
    </group>
  );
}

// 预加载所有角色模型
export function preloadCharacters() {
  CHARACTER_MODELS.forEach(model =>
    useGLTF.preload(model, undefined, undefined, configureModelLoader)
  );
}
