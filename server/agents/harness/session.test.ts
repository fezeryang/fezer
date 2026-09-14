import { afterAll, beforeEach, describe, expect, it } from "vitest";

// 强制内存回退路径：删除 DATABASE_URL 后 getDb() 返回 null
const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;

afterAll(() => {
  if (ORIGINAL_DATABASE_URL === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
  }
});

import {
  MAX_STORED_TURNS,
  appendThreadTurns,
  loadThreadTurns,
  resetMemoryThreads,
} from "./session";

describe("thread session store（内存回退）", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
    resetMemoryThreads();
  });

  it("写入后可读回，顺序不变", async () => {
    await appendThreadTurns("t1", "route", [
      { role: "user", content: "第一个问题" },
      { role: "assistant", content: "第一个回答", agentId: "builder" },
    ]);

    const turns = await loadThreadTurns("t1");

    expect(turns).toEqual([
      { role: "user", content: "第一个问题" },
      { role: "assistant", content: "第一个回答", agentId: "builder" },
    ]);
  });

  it("多次追加按时间累积", async () => {
    await appendThreadTurns("t1", "route", [
      { role: "user", content: "Q1" },
      { role: "assistant", content: "A1" },
    ]);
    await appendThreadTurns("t1", "route", [
      { role: "user", content: "Q2" },
      { role: "assistant", content: "A2" },
    ]);

    const turns = await loadThreadTurns("t1");

    expect(turns.map(turn => turn.content)).toEqual(["Q1", "A1", "Q2", "A2"]);
  });

  it("超过上限时保留最近的轮次", async () => {
    const many = Array.from({ length: MAX_STORED_TURNS + 10 }, (_, index) => ({
      role: "user" as const,
      content: `问题 ${index}`,
    }));

    await appendThreadTurns("t1", "route", many);
    const turns = await loadThreadTurns("t1");

    expect(turns).toHaveLength(MAX_STORED_TURNS);
    expect(turns[0].content).toBe("问题 10");
    expect(turns.at(-1)?.content).toBe(`问题 ${MAX_STORED_TURNS + 9}`);
  });

  it("单条内容超长会被截断", async () => {
    await appendThreadTurns("t1", "route", [
      { role: "user", content: "x".repeat(5000) },
    ]);

    const [turn] = await loadThreadTurns("t1");

    expect(turn.content).toHaveLength(4000);
  });

  it("不同线程互不影响", async () => {
    await appendThreadTurns("t1", "route", [
      { role: "user", content: "属于 t1" },
    ]);
    await appendThreadTurns("t2", "route", [
      { role: "user", content: "属于 t2" },
    ]);

    expect((await loadThreadTurns("t1")).map(t => t.content)).toEqual([
      "属于 t1",
    ]);
    expect((await loadThreadTurns("t2")).map(t => t.content)).toEqual([
      "属于 t2",
    ]);
  });

  it("未知线程返回空数组而不是报错", async () => {
    expect(await loadThreadTurns("never-seen")).toEqual([]);
  });
});
