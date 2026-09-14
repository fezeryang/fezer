import { describe, expect, it } from "vitest";
import { consumeSseResponse, extractSseEvents } from "./sse";

function frame(type: string, payload: unknown): string {
  return `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
}

describe("extractSseEvents", () => {
  it("完整帧解析为 RunEvent", () => {
    const input =
      frame("run.started", {
        type: "run.started",
        runId: "r1",
        threadId: "t1",
        at: 1,
      }) +
      frame("text.delta", {
        type: "text.delta",
        messageId: "m1",
        delta: "你好",
        at: 2,
      });

    const { events, rest } = extractSseEvents(input);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ type: "run.started", runId: "r1" });
    expect(events[1]).toMatchObject({ type: "text.delta", delta: "你好" });
    expect(rest).toBe("");
  });

  it("不完整的尾部帧留在 rest 里等待下一批字节", () => {
    const input =
      frame("agent.start", {
        type: "agent.start",
        agentId: "core",
        displayName: "Core",
        at: 1,
      }) + 'event: tool.call\ndata: {"type":';

    const { events, rest } = extractSseEvents(input);

    expect(events).toHaveLength(1);
    expect(rest).toBe('event: tool.call\ndata: {"type":');
  });

  it("坏帧被丢弃，不毁掉整条流", () => {
    const input =
      "event: broken\ndata: {not json}\n\n" +
      frame("agent.done", { type: "agent.done", agentId: "core", at: 2 });

    const { events } = extractSseEvents(input);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "agent.done" });
  });

  it("空缓冲与纯注释帧都安全", () => {
    expect(extractSseEvents("").events).toEqual([]);
    expect(extractSseEvents(": keepalive\n\n").events).toEqual([]);
  });
});

describe("consumeSseResponse", () => {
  function sseResponse(chunks: string[], ok = true): Response {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });
    return new Response(stream, { status: ok ? 200 : 500 });
  }

  it("跨 chunk 分帧时也按序产出，终止事件返回 true", async () => {
    // 故意把一帧劈在两个 chunk 边界上
    const response = sseResponse([
      frame("run.started", {
        type: "run.started",
        runId: "r",
        threadId: "t",
        at: 1,
      }).slice(0, 20),
      frame("run.started", {
        type: "run.started",
        runId: "r",
        threadId: "t",
        at: 1,
      }).slice(20) +
        frame("run.finished", {
          type: "run.finished",
          runId: "r",
          outcome: { type: "success" },
          usage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            toolCalls: 0,
            providerFallbacks: 0,
            wallClockMs: 5,
          },
          answer: "完成",
          at: 2,
        }),
    ]);

    const seen: string[] = [];
    const terminated = await consumeSseResponse(response, event => {
      seen.push(event.type);
    });

    expect(seen).toEqual(["run.started", "run.finished"]);
    expect(terminated).toBe(true);
  });

  it("非 2xx 或无 body 返回 false", async () => {
    expect(await consumeSseResponse(sseResponse([], false), () => {})).toBe(
      false
    );
    expect(
      await consumeSseResponse(new Response(null, { status: 200 }), () => {})
    ).toBe(false);
  });
});
