/**
 * @vitest-environment jsdom
 *
 * useAmbientChatter 调度测试：进房 → A 台词 → 清空 → B 台词 → 清空；
 * 抑制状态下不冒泡；换房清场。
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAmbientChatter } from "../useAmbientChatter";
import { charactersInRoom } from "@/lib/scene-bubbles";
import { ROOMS } from "@/components/jianli/assets/roomsConfig";

// 首轮延迟 4–8s 随机：不能依赖绝对时刻断言非空（抽样窗口会被随机位移）
function advanceUntilChatter(
  result: { current: { characterId: string; text: string } | null },
  budgetMs = 9000
) {
  for (let t = 0; t < budgetMs && result.current === null; t += 200) {
    act(() => vi.advanceTimersByTime(200));
  }
  expect(result.current).not.toBeNull();
}

function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", {
    value: hidden,
    configurable: true,
  });
}

describe("useAmbientChatter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setDocumentHidden(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("进房 4–8s 后冒出 A 台词：角色属于该房间，台词来自对话池", () => {
    const { result } = renderHook(() => useAmbientChatter("central", false));

    advanceUntilChatter(result);
    expect(charactersInRoom("central")).toContain(result.current!.characterId);
    const firstLines = new Set(ROOMS.central.chatter.map(pair => pair[0]));
    expect(firstLines.has(result.current!.text)).toBe(true);
  });

  it("A 台词停留后清空，再出 B 台词，最后清空", () => {
    const { result } = renderHook(() => useAmbientChatter("central", false));

    // 首轮延迟随机（4–8s）：以 100ms 步进采样整段生命周期，验证时序模式
    const seen: Array<string | null> = [];
    for (let t = 0; t < 20000; t += 100) {
      act(() => vi.advanceTimersByTime(100));
      seen.push(result.current?.text ?? null);
    }

    const firstLines = new Set(ROOMS.central.chatter.map(pair => pair[0]));
    const secondLines = new Set(ROOMS.central.chatter.map(pair => pair[1]));

    const firstIdx = seen.findIndex(v => v !== null && firstLines.has(v));
    expect(firstIdx).toBeGreaterThanOrEqual(0);

    // A 之后必须先清空（留白间隔），再出现 B 台词，最后回到空
    const afterFirst = seen.slice(firstIdx + 1);
    const nullIdx = afterFirst.indexOf(null);
    expect(nullIdx).toBeGreaterThan(-1);

    const secondIdx = afterFirst.findIndex(
      (v, i) => i > nullIdx && v !== null && secondLines.has(v)
    );
    expect(secondIdx).toBeGreaterThan(nullIdx);
    expect(seen[seen.length - 1]).toBeNull();
  });

  it("抑制状态（招呼/agent 活动）下不冒泡，解除后恢复", () => {
    const { result, rerender } = renderHook(
      ({ suppressed }: { suppressed: boolean }) =>
        useAmbientChatter("builder", suppressed),
      { initialProps: { suppressed: true } }
    );

    act(() => vi.advanceTimersByTime(30000));
    expect(result.current).toBeNull();

    rerender({ suppressed: false });
    advanceUntilChatter(result);
  });

  it("页面不可见时不冒泡", () => {
    setDocumentHidden(true);
    const { result } = renderHook(() => useAmbientChatter("writer", false));

    act(() => vi.advanceTimersByTime(30000));
    expect(result.current).toBeNull();
  });

  it("咖啡情绪下首句闲聊更快出现（间隔减半，≤4.5s）", () => {
    const { result } = renderHook(() =>
      useAmbientChatter("central", false, "coffee")
    );

    // 正常首延迟 4-8s；咖啡减半后应在 4.5s 内出现
    act(() => vi.advanceTimersByTime(4500));
    expect(result.current).not.toBeNull();
  });

  it("切换房间即清场", () => {
    const { result, rerender } = renderHook(
      ({ roomId }: { roomId: string }) => useAmbientChatter(roomId, false),
      { initialProps: { roomId: "central" } }
    );

    advanceUntilChatter(result);

    rerender({ roomId: "ai" });
    expect(result.current).toBeNull();
  });
});
