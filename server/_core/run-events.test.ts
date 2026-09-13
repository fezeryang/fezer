import { describe, expect, it } from "vitest";
import type { RunEvent } from "@fezer/shared/schemas/run";
import { emitRunEvent, runWithEventSink } from "./run-events";

function collector(): { events: RunEvent[]; sink: (e: RunEvent) => void } {
  const events: RunEvent[] = [];
  return { events, sink: event => events.push(event) };
}

describe("harness event sink", () => {
  it("没有事件汇时 emit 是安全的空操作", () => {
    expect(() =>
      emitRunEvent({ type: "run.started", runId: "r1", threadId: "t1" })
    ).not.toThrow();
  });

  it("按顺序收集事件并补上 at 时间戳", async () => {
    const { events, sink } = collector();

    await runWithEventSink(sink, async () => {
      emitRunEvent({ type: "run.started", runId: "r1", threadId: "t1", at: 1 });
      emitRunEvent({ type: "text.delta", messageId: "m1", delta: "你" });
      emitRunEvent({ type: "text.delta", messageId: "m1", delta: "好" });
    });

    expect(events.map(event => event.type)).toEqual([
      "run.started",
      "text.delta",
      "text.delta",
    ]);
    expect(events[0].at).toBe(1);
    expect(typeof events[1].at).toBe("number");
    expect(events[1].at).toBeGreaterThan(0);
  });

  it("并行分支的事件互不串扰（Promise.all 隔离）", async () => {
    const a = collector();
    const b = collector();

    await Promise.all([
      runWithEventSink(a.sink, async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        emitRunEvent({
          type: "agent.start",
          agentId: "builder",
          displayName: "B",
        });
        await new Promise(resolve => setTimeout(resolve, 5));
        emitRunEvent({ type: "agent.done", agentId: "builder" });
      }),
      runWithEventSink(b.sink, async () => {
        emitRunEvent({
          type: "agent.start",
          agentId: "writer",
          displayName: "W",
        });
        await new Promise(resolve => setTimeout(resolve, 10));
        emitRunEvent({ type: "agent.done", agentId: "writer" });
      }),
    ]);

    expect(a.events).toHaveLength(2);
    expect(b.events).toHaveLength(2);
    expect(a.events[0]).toMatchObject({ agentId: "builder" });
    expect(b.events[0]).toMatchObject({ agentId: "writer" });
  });
});
