import { describe, expect, it } from "vitest";
import {
  recordLlmUsage,
  recordProviderFallback,
  recordToolCall,
  runWithUsageTracking,
} from "./run-usage";

describe("run usage tracking", () => {
  it("无上下文时记录是安全空操作", () => {
    expect(() => {
      recordLlmUsage({
        prompt_tokens: 1,
        completion_tokens: 1,
        total_tokens: 2,
      });
      recordToolCall();
      recordProviderFallback();
    }).not.toThrow();
  });

  it("累计一次 run 内的 LLM 用量、工具与回退次数", async () => {
    const { result, usage } = await runWithUsageTracking(async () => {
      recordLlmUsage({
        prompt_tokens: 100,
        completion_tokens: 20,
        total_tokens: 120,
      });
      recordLlmUsage({
        prompt_tokens: 50,
        completion_tokens: 10,
        total_tokens: 60,
      });
      recordToolCall();
      recordToolCall(2);
      recordProviderFallback();

      return "ok";
    });

    expect(result).toBe("ok");
    expect(usage).toEqual({
      promptTokens: 150,
      completionTokens: 30,
      totalTokens: 180,
      toolCalls: 3,
      providerFallbacks: 1,
    });
  });

  it("并行 run 互不串扰", async () => {
    const [first, second] = await Promise.all([
      runWithUsageTracking(async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        recordToolCall(3);
      }),
      runWithUsageTracking(async () => {
        recordToolCall(1);
      }),
    ]);

    expect(first.usage.toolCalls).toBe(3);
    expect(second.usage.toolCalls).toBe(1);
  });
});
