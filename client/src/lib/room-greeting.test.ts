import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildRoomGreeting,
  isGreetingEnabled,
  markGreetingShown,
  resetGreetingState,
  setGreetingEnabled,
  shouldShowGreeting,
} from "./room-greeting";

function createFakeStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
}

describe("room greeting", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createFakeStorage());
    resetGreetingState();
  });

  it("用房间文案 + 一条真实内容锚点拼两句", () => {
    const text = buildRoomGreeting(
      { name: "AI Lab", summary: "AI 应用与自动化" },
      [{ title: "上岸测评" }],
      []
    );

    expect(text).toContain("AI Lab");
    expect(text).toContain("上岸测评");
    expect(text.split("。").length).toBeLessThanOrEqual(3);
  });

  it("优先用作品作锚点，没有作品时退回博客", () => {
    const text = buildRoomGreeting(
      { name: "Builder Room", summary: "工程落地" },
      [],
      [{ title: "TOC 侧边栏" }]
    );

    expect(text).toContain("TOC 侧边栏");
  });

  it("没有内容时退回引导语句，不编造", () => {
    const text = buildRoomGreeting(
      { name: "Reader Nook", summary: "阅读与思考" },
      [],
      []
    );

    expect(text).toContain("还在整理");
    expect(text).not.toContain("比如");
  });

  it("同一房间只招呼一次，不同房间互不影响", () => {
    expect(shouldShowGreeting("ai")).toBe(true);

    markGreetingShown("ai");

    expect(shouldShowGreeting("ai")).toBe(false);
    expect(shouldShowGreeting("visual")).toBe(true);
  });

  it("关闭开关后不再自动招呼", () => {
    expect(isGreetingEnabled()).toBe(true);

    setGreetingEnabled(false);
    expect(isGreetingEnabled()).toBe(false);

    setGreetingEnabled(true);
    expect(isGreetingEnabled()).toBe(true);
  });
});
