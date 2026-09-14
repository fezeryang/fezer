/**
 * useRoomScopedCharacterId - 把空间性 characterId 限定在它所属的房间内
 *
 * characterId 是"点了哪个角色开的聊天"，属空间输入。聊天窗口保持打开期间切换房间后，
 * 旧的 characterId 仍指向旧房间的角色；若继续当显式定向，新消息会被路由回旧 agent
 * （"B 房间的角色以为自己是 A"的客户端一半根因）。
 *
 * 规则：characterId 变化（重新打开聊天/点了新角色）→ 采用新值；
 * 仅 roomId 变化（人在场景里换房间）→ 定向失效，返回 undefined 交给房间/内容路由。
 */

import { useEffect, useRef, useState } from "react";

export function useRoomScopedCharacterId(
  roomId: string | undefined,
  characterId: string | undefined
): string | undefined {
  const [scoped, setScoped] = useState(characterId);
  const prevRef = useRef({ roomId, characterId });

  useEffect(() => {
    const charChanged = prevRef.current.characterId !== characterId;
    const roomChanged = prevRef.current.roomId !== roomId;
    prevRef.current = { roomId, characterId };

    if (charChanged) {
      setScoped(characterId);
    } else if (roomChanged) {
      setScoped(undefined);
    }
  }, [roomId, characterId]);

  return scoped;
}
