/**
 * Minimap - 7 个房间的空间缩略图（B7）
 *
 * 复用博客目录侧边栏（ProximitySidebar）的 dash 语汇：
 * 当前房间 = 近黑长线，已访问 = 房间主题色中线，未访问 = 浅灰短线 + 呼吸。
 * 点击任一条即切换房间。移动端隐藏（面板占位紧张）。
 */

import { useIsMobile } from "@/hooks/useMobile";
import { ROOMS } from "./assets/roomsConfig";

type MinimapProps = {
  activeRoomId: string;
  /** 已访问房间 id（来自访客进度，C6） */
  visitedRoomIds: string[];
  onRoomSelect: (roomId: string) => void;
};

// 世界坐标范围（roomsConfig 的实际跨度 + 少量边距）
const MIN_X = -19;
const MAX_X = 19;
const MIN_Z = -32;
const MAX_Z = 2;

const WIDTH = 140;
const HEIGHT = 125;

const toSvgX = (x: number) => ((x - MIN_X) / (MAX_X - MIN_X)) * WIDTH;
const toSvgY = (z: number) => ((z - MIN_Z) / (MAX_Z - MIN_Z)) * HEIGHT;

export function Minimap({
  activeRoomId,
  visitedRoomIds,
  onRoomSelect,
}: MinimapProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return null;
  }

  return (
    <div className="pointer-events-auto absolute bottom-24 right-4 rounded-2xl border border-slate-900/10 bg-slate-50/80 p-3 shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur-md">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
        Map
      </p>
      <svg
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="房间缩略图"
      >
        {Object.values(ROOMS).map(room => {
          const isActive = room.id === activeRoomId;
          const isVisited = visitedRoomIds.includes(room.id);
          const x = toSvgX(room.position[0]);
          const y = toSvgY(room.position[2]);
          const height = isActive ? 26 : isVisited ? 16 : 10;
          const fill = isActive
            ? "#0f172a"
            : isVisited
              ? room.accent
              : "#cbd5e1";

          return (
            <g
              key={room.id}
              onClick={() => onRoomSelect(room.id)}
              className="cursor-pointer"
            >
              <title>{room.name}</title>
              {/* 加大命中区域，细线也好点 */}
              <rect
                x={x - 8}
                y={y - 13}
                width={16}
                height={26}
                fill="transparent"
              />
              <rect
                x={x - 1.5}
                y={y - height / 2}
                width={3}
                height={height}
                rx={1.5}
                fill={fill}
                className={!isActive && !isVisited ? "animate-pulse" : ""}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
