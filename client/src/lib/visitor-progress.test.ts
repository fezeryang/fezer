import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadVisitorProgress,
  markCharacterDiscovered,
  markQuestionAsked,
  markRoomVisited,
  touchSession,
} from "./visitor-progress";

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
    _store: store,
  };
}

const KEY = "jianli.visitor.v1";

describe("visitor progress", () => {
  let storage: ReturnType<typeof createFakeStorage>;

  beforeEach(() => {
    storage = createFakeStorage();
    vi.stubGlobal("localStorage", storage);
  });

  it("空存储返回空进度", () => {
    expect(loadVisitorProgress()).toEqual({
      visitedRooms: [],
      discoveredCharacters: [],
      askedQuestions: [],
      lastSession: null,
    });
  });

  it("重复访问同一房间不会产生重复项", () => {
    markRoomVisited("ai");
    markRoomVisited("ai");
    markRoomVisited("builder");

    expect(loadVisitorProgress().visitedRooms).toEqual(["ai", "builder"]);
  });

  it("角色发现与提问都会持久化", () => {
    markCharacterDiscovered("builder");
    markQuestionAsked("你做过什么项目？");
    touchSession();

    const progress = loadVisitorProgress();
    expect(progress.discoveredCharacters).toEqual(["builder"]);
    expect(progress.askedQuestions).toEqual(["你做过什么项目？"]);
    expect(progress.lastSession).toBeTruthy();
  });

  it("损坏的 JSON 安全降级为空进度，不抛错", () => {
    storage.setItem(KEY, "{not json");

    expect(() => loadVisitorProgress()).not.toThrow();
    expect(loadVisitorProgress().visitedRooms).toEqual([]);
  });

  it("已问问题保留最近 50 条", () => {
    for (let i = 0; i < 60; i++) {
      markQuestionAsked(`问题 ${i}`);
    }

    const { askedQuestions } = loadVisitorProgress();
    expect(askedQuestions).toHaveLength(50);
    expect(askedQuestions[0]).toBe("问题 10");
    expect(askedQuestions.at(-1)).toBe("问题 59");
  });
});
