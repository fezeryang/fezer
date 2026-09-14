/**
 * Minimap - 7 个房间的空间缩略图（B7 + D5 优化）
 *
 * 复用博客目录侧边栏（ProximitySidebar）的 dash 语汇：
 * 当前房间 = 近黑长线 + 指示环 + 房间名，已访问 = 房间主题色中线，
 * 未访问 = 浅灰短线 + 呼吸。
 * D5：邻接走廊虚线（ROOM_ADJACENCY）呈现空间结构；标题下显示探索进度；
 * 多专家运行时，当前房间到各协作房间画主题色连线 + 协作房间脉冲点。
 * 点击任一条即切换房间。移动端隐藏（面板占位紧张）。
 */

import { useMemo } from "react";
import { useIsMobile } from "@/hooks/useMobile";
import { ROOMS } from "./assets/roomsConfig";
import { adjacencySegments } from "@/lib/scene-bubbles";

type MinimapProps = {
  activeRoomId: string;
  /** 已访问房间 id（来自访客进度，C6） */
  visitedRoomIds: string[];
  onRoomSelect: (roomId: string) => void;
  /** 正在参与回答的房间 id（D3 场景气泡驱动；不含当前房间也可，连线以当前房间为源点） */
  collaboratingRoomIds?: string[];
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
  collaboratingRoomIds = [],
}: MinimapProps) {
  const isMobile = useIsMobile();

  const segments = useMemo(() => adjacencySegments(), []);
  const activeRoom = ROOMS[activeRoomId];
  const activeSvg = activeRoom
    ? { x: toSvgX(activeRoom.position[0]), y: toSvgY(activeRoom.position[2]) }
    : undefined;
  const collaborationLinks = useMemo(
    () =>
      activeSvg
        ? collaboratingRoomIds
            .filter(roomId => roomId !== activeRoomId && ROOMS[roomId])
            .map(roomId => ({
              roomId,
              x: toSvgX(ROOMS[roomId].position[0]),
              y: toSvgY(ROOMS[roomId].position[2]),
              accent: ROOMS[roomId].accent,
            }))
        : [],
    [activeSvg, collaboratingRoomIds, activeRoomId]
  );

  if (isMobile) {
    return null;
  }

  return (
    <div className="pointer-events-auto absolute bottom-24 right-4 rounded-2xl border border-slate-900/10 bg-slate-50/80 p-3 shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur-md">
      <div className="flex items-baseline justify-between gap-2">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
          Map
        </p>
        <p className="mb-1 text-[10px] text-slate-400">
          已探索 {visitedRoomIds.length}/7
        </p>
      </div>
      <svg
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="房间缩略图"
      >
        {/* 邻接走廊线：让空间结构一眼可读 */}
        {segments.map((segment, index) => (
          <line
            key={`adj-${index}`}
            x1={toSvgX(segment.a[0])}
            y1={toSvgY(segment.a[1])}
            x2={toSvgX(segment.b[0])}
            y2={toSvgY(segment.b[1])}
            stroke="#cbd5e1"
            strokeWidth={1}
            strokeDasharray="2 2"
          />
        ))}

        {/* 协作连线：当前房间 → 各参与房间（多专家运行时） */}
        {collaborationLinks.map(link => (
          <line
            key={`collab-${link.roomId}`}
            x1={activeSvg?.x}
            y1={activeSvg?.y}
            x2={link.x}
            y2={link.y}
            stroke={link.accent}
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={0.85}
          >
            <title>{`${ROOMS[link.roomId].name} 正在协作`}</title>
          </line>
        ))}

        {Object.values(ROOMS).map(room => {
          const isActive = room.id === activeRoomId;
          const isVisited = visitedRoomIds.includes(room.id);
          const isCollaborating = collaboratingRoomIds.includes(room.id);
          const x = toSvgX(room.position[0]);
          const y = toSvgY(room.position[2]);
          const height = isActive ? 26 : isVisited ? 16 : 10;
          const fill = isActive
            ? "#0f172a"
            : isVisited || isCollaborating
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
                className={
                  !isActive && !isVisited
                    ? "animate-pulse motion-reduce:animate-none"
                    : ""
                }
              />
              {/* 你在这里：当前房间指示环 + 房间名（靠右的房间左锚，避免溢出） */}
              {isActive && (
                <>
                  <circle
                    cx={x}
                    cy={y}
                    r={8}
                    fill="none"
                    stroke="#0f172a"
                    strokeWidth={1}
                    opacity={0.5}
                  />
                  <text
                    x={x > WIDTH - 52 ? x - 10 : x + 10}
                    y={y - 8}
                    fontSize={8}
                    fill="#0f172a"
                    fontWeight={600}
                    textAnchor={x > WIDTH - 52 ? "end" : "start"}
                  >
                    {room.name}
                  </text>
                </>
              )}
              {/* 协作房间脉冲点 */}
              {isCollaborating && !isActive && (
                <circle
                  cx={x}
                  cy={y}
                  r={2.5}
                  fill={room.accent}
                  className="animate-pulse motion-reduce:animate-none"
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
