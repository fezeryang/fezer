import { describe, expect, it } from "vitest";
import {
  assertRunNotAborted,
  getRunControl,
  isRunAborted,
  mergeAbortSignals,
  runWithRunControl,
} from "./run-control";

describe("run control", () => {
  it("无上下文时返回空控制对象，不抛错", () => {
    expect(getRunControl()).toEqual({});
    expect(isRunAborted()).toBe(false);
    expect(() => assertRunNotAborted()).not.toThrow();
  });

  it("注入并读取 signal 与循环上限", async () => {
    const controller = new AbortController();

    const seen = await runWithRunControl(
      { signal: controller.signal, maxToolLoops: 2 },
      async () => getRunControl()
    );

    expect(seen.maxToolLoops).toBe(2);
    expect(seen.signal).toBe(controller.signal);
    expect(isRunAborted()).toBe(false);
  });

  it("assertRunNotAborted 在中止后抛 name 为 AbortError 的错误", async () => {
    const controller = new AbortController();

    await runWithRunControl({ signal: controller.signal }, async () => {
      expect(() => assertRunNotAborted()).not.toThrow();

      controller.abort();

      try {
        assertRunNotAborted();
        throw new Error("应当抛出");
      } catch (error) {
        expect((error as Error).name).toBe("AbortError");
      }
      expect(isRunAborted()).toBe(true);
    });
  });

  it("mergeAbortSignals：任一信号触发即中止；无取消信号时原样返回", () => {
    const a = new AbortController();
    const b = new AbortController();

    const merged = mergeAbortSignals(a.signal, b.signal);
    expect(merged.aborted).toBe(false);

    b.abort();
    expect(merged.aborted).toBe(true);

    expect(mergeAbortSignals(a.signal)).toBe(a.signal);
  });

  it("嵌套不串扰：内层覆盖，返回外层后恢复", async () => {
    const result = await runWithRunControl({ maxToolLoops: 5 }, async () => {
      const inner = await runWithRunControl(
        { maxToolLoops: 1 },
        async () => getRunControl()
      );
      return { inner, outer: getRunControl() };
    });

    expect(result.inner.maxToolLoops).toBe(1);
    expect(result.outer.maxToolLoops).toBe(5);
  });
});
