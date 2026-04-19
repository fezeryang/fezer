import { beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

describe("langsmith observability helper", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  it("runs without tracing when LANGSMITH_TRACING is disabled", async () => {
    process.env.LANGSMITH_TRACING = "false";
    process.env.LANGSMITH_API_KEY = "lsv2_test";

    const { traceSpan, isLangSmithTracingEnabled } = await import("./langsmith");
    const value = await traceSpan("disabled-span", async () => 42);

    expect(value).toBe(42);
    expect(isLangSmithTracingEnabled()).toBe(false);
  });

  it("propagates trace context values", async () => {
    process.env.LANGSMITH_TRACING = "false";

    const { runWithTraceContext, getTraceContext } = await import("./langsmith");

    const ctx = await runWithTraceContext(
      { route: "/api/chat", interactionType: "chat", agentId: "core" },
      async () => getTraceContext()
    );

    expect(ctx.route).toBe("/api/chat");
    expect(ctx.interactionType).toBe("chat");
    expect(ctx.agentId).toBe("core");
  });

  it("uses traceable wrapper when tracing is enabled", async () => {
    const traceableMock = vi.fn((fn: () => Promise<unknown>) => fn);
    vi.doMock("langsmith/traceable", () => ({
      traceable: traceableMock,
    }));

    process.env.LANGSMITH_TRACING = "true";
    process.env.LANGSMITH_API_KEY = "lsv2_test";
    process.env.LANGSMITH_PROJECT = "fezer-agent-test";

    const { traceSpan } = await import("./langsmith");
    await traceSpan("enabled-span", async () => "ok", {
      runType: "chain",
      metadata: { foo: "bar" },
      tags: ["test:yes"],
    });

    expect(traceableMock).toHaveBeenCalledTimes(1);
    const config = traceableMock.mock.calls[0][1];
    expect(config.name).toBe("enabled-span");
    expect(config.project_name).toBe("fezer-agent-test");
    expect(config.metadata.foo).toBe("bar");
  });

  it("propagates prompt metadata and tags from trace context", async () => {
    const traceableMock = vi.fn((fn: () => Promise<unknown>) => fn);
    vi.doMock("langsmith/traceable", () => ({
      traceable: traceableMock,
    }));

    process.env.LANGSMITH_TRACING = "true";
    process.env.LANGSMITH_API_KEY = "lsv2_test";

    const { runWithTraceContext, traceSpan } = await import("./langsmith");
    await runWithTraceContext(
      {
        promptKey: "supervisor/intent-classifier",
        promptVersion: "v2",
        promptTag: "stage1",
      },
      async () => traceSpan("prompt-span", async () => "ok")
    );

    const config = traceableMock.mock.calls[0][1];
    expect(config.tags).toContain("prompt:supervisor/intent-classifier");
    expect(config.tags).toContain("prompt_version:v2");
    expect(config.tags).toContain("prompt_tag:stage1");
    expect(config.metadata.promptKey).toBe("supervisor/intent-classifier");
    expect(config.metadata.promptVersion).toBe("v2");
  });
});
