import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isWebGLAvailable,
  resetWebGLAvailabilityCache,
} from "./webgl-support";

describe("webgl availability", () => {
  beforeEach(() => {
    resetWebGLAvailabilityCache();
  });

  it("能拿到 webgl2 context 时判定可用", () => {
    vi.stubGlobal("document", {
      createElement: () => ({
        getContext: (type: string) => (type === "webgl2" ? {} : null),
      }),
    });

    expect(isWebGLAvailable()).toBe(true);
  });

  it("所有 context 都拿不到时判定不可用", () => {
    vi.stubGlobal("document", {
      createElement: () => ({ getContext: () => null }),
    });

    expect(isWebGLAvailable()).toBe(false);
  });

  it("getContext 抛错（策略禁用）时按不可用处理", () => {
    vi.stubGlobal("document", {
      createElement: () => ({
        getContext: () => {
          throw new Error("WebGL blocked by policy");
        },
      }),
    });

    expect(isWebGLAvailable()).toBe(false);
  });

  it("结果被缓存，只建一次 context", () => {
    const getContext = vi.fn(() => ({}));
    vi.stubGlobal("document", {
      createElement: () => ({ getContext }),
    });

    isWebGLAvailable();
    isWebGLAvailable();

    expect(getContext).toHaveBeenCalledTimes(1);
  });

  it("无 document（node 环境）时安全返回 false", () => {
    vi.stubGlobal("document", undefined);

    expect(isWebGLAvailable()).toBe(false);
  });
});
