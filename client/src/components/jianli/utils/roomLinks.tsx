/**
 * Room Link Utilities
 *
 * 识别聊天消息中的房间名称并转换为可点击链接
 */

import type { ReactNode } from "react";

/**
 * 房间名称匹配模式
 * 支持英文和中文名称
 */
export const ROOM_NAME_PATTERNS: Record<string, RegExp[]> = {
  central: [
    /Central\s+Hub/gi,
    /中央大厅/gi,
  ],
  builder: [
    /Builder\s+Room/gi,
    /搭建空间/gi,
    /项目空间/gi,
  ],
  ai: [
    /AI\s+Lab/gi,
    /AI\s*实验室/gi,
    /AI\s*空间/gi,
  ],
  writer: [
    /Writer\s+Room/gi,
    /写作空间/gi,
  ],
  reader: [
    /Reader\s+Nook/gi,
    /阅读角/gi,
  ],
  visual: [
    /Visual\s+Studio/gi,
    /视觉工作室/gi,
  ],
  wanderer: [
    /Wanderer\s+Base/gi,
    /旅行基地/gi,
  ],
};

interface RoomMatch {
  roomId: string;
  start: number;
  end: number;
  text: string;
}

/**
 * 查找文本中所有房间名称匹配
 */
function findRoomMatches(text: string): RoomMatch[] {
  const matches: RoomMatch[] = [];

  for (const [roomId, patterns] of Object.entries(ROOM_NAME_PATTERNS)) {
    for (const pattern of patterns) {
      // 重置正则表达式
      pattern.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        matches.push({
          roomId,
          start: match.index,
          end: match.index + match[0].length,
          text: match[0],
        });
      }
    }
  }

  // 按位置排序
  matches.sort((a, b) => a.start - b.start);

  // 去除重叠匹配（保留最长的）
  const filtered: RoomMatch[] = [];
  for (const match of matches) {
    const hasOverlap = filtered.some(
      (existing) =>
        (match.start >= existing.start && match.start < existing.end) ||
        (match.end > existing.start && match.end <= existing.end)
    );

    if (!hasOverlap) {
      filtered.push(match);
    } else {
      // 如果重叠，保留更长的匹配
      const overlapping = filtered.findIndex(
        (existing) =>
          (match.start >= existing.start && match.start < existing.end) ||
          (match.end > existing.start && match.end <= existing.end)
      );

      if (overlapping !== -1) {
        const existingLength = filtered[overlapping].text.length;
        const newLength = match.text.length;

        if (newLength > existingLength) {
          filtered[overlapping] = match;
        }
      }
    }
  }

  return filtered;
}

/**
 * 将文本中的房间名称转换为可点击链接
 *
 * @param text - 要处理的文本
 * @param onRoomClick - 房间点击回调
 * @returns React 节点数组
 */
export function linkifyRoomNames(
  text: string,
  onRoomClick: (roomId: string) => void
): ReactNode[] {
  const matches = findRoomMatches(text);

  if (matches.length === 0) {
    return [text];
  }

  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];

    // 添加匹配前的文本
    if (match.start > lastIndex) {
      parts.push(text.slice(lastIndex, match.start));
    }

    // 添加可点击的房间链接
    parts.push(
      <button
        key={`room-link-${match.roomId}-${match.start}`}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRoomClick(match.roomId);
        }}
        className="text-blue-600 hover:text-blue-800 underline decoration-dotted hover:decoration-solid transition-colors cursor-pointer font-medium"
        title={`导航到 ${match.text}`}
      >
        {match.text}
      </button>
    );

    lastIndex = match.end;
  }

  // 添加最后剩余的文本
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

/**
 * 检查文本是否包含房间名称
 */
export function containsRoomNames(text: string): boolean {
  return findRoomMatches(text).length > 0;
}
