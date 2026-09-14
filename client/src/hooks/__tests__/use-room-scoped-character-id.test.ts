/**
 * @vitest-environment jsdom
 *
 * useRoomScopedCharacterId：空间性 characterId 的限房规则
 */

import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRoomScopedCharacterId } from "../useRoomScopedCharacterId";

describe("useRoomScopedCharacterId", () => {
  it("初始值直接生效", () => {
    const { result } = renderHook(() =>
      useRoomScopedCharacterId("builder", "fezer-04")
    );
    expect(result.current).toBe("fezer-04");
  });

  it("仅房间变化（人在场景里换房间）→ 旧定向失效", () => {
    const { result, rerender } = renderHook(
      ({ roomId, characterId }: { roomId: string; characterId?: string }) =>
        useRoomScopedCharacterId(roomId, characterId),
      { initialProps: { roomId: "builder", characterId: "fezer-04" } }
    );

    rerender({ roomId: "ai", characterId: "fezer-04" });
    expect(result.current).toBeUndefined();
  });

  it("房间与角色同时变化（在新房间点了新角色）→ 新定向生效", () => {
    const { result, rerender } = renderHook(
      ({ roomId, characterId }: { roomId: string; characterId?: string }) =>
        useRoomScopedCharacterId(roomId, characterId),
      { initialProps: { roomId: "builder", characterId: "fezer-04" } }
    );

    rerender({ roomId: "ai", characterId: "fezer-06" });
    expect(result.current).toBe("fezer-06");
  });

  it("同房间内 characterId 变化 → 采用新值（含清空为 undefined）", () => {
    const { result, rerender } = renderHook(
      ({ roomId, characterId }: { roomId: string; characterId?: string }) =>
        useRoomScopedCharacterId(roomId, characterId),
      {
        initialProps: { roomId: "central", characterId: "fezer-01" } as {
          roomId: string;
          characterId?: string;
        },
      }
    );

    rerender({ roomId: "central", characterId: "fezer-02" });
    expect(result.current).toBe("fezer-02");

    rerender({ roomId: "central", characterId: undefined });
    expect(result.current).toBeUndefined();
  });
});
