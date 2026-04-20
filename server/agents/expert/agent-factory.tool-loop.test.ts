import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeLLMMock = vi.fn();
const getLLMToolsByNamesMock = vi.fn();
const getToolExecutionRegistryMock = vi.fn();

vi.mock("../../_core/llm", () => ({
  invokeLLM: invokeLLMMock,
}));

vi.mock("../tools", () => ({
  getLLMToolsByNames: getLLMToolsByNamesMock,
  getToolExecutionRegistry: getToolExecutionRegistryMock,
}));

describe("expert agent tool loop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LANGSMITH_TRACING = "false";
    delete process.env.LANGSMITH_API_KEY;

    getLLMToolsByNamesMock.mockReturnValue([]);
    getToolExecutionRegistryMock.mockReturnValue(new Map());
  });

  it("returns direct answer when no tool call is returned", async () => {
    invokeLLMMock.mockResolvedValueOnce({
      id: "1",
      created: 1,
      model: "deepseek-chat",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "direct answer" },
          finish_reason: "stop",
        },
      ],
    });

    const { invokeAgent } = await import("./agent-factory");
    const result = await invokeAgent("core", "hello");

    expect(result.answer).toBe("direct answer");
    expect(invokeLLMMock).toHaveBeenCalledTimes(1);
  });

  it("executes tool call serially and continues with tool message", async () => {
    getLLMToolsByNamesMock.mockReturnValue([
      {
        type: "function",
        function: {
          name: "get_profile",
          description: "get profile",
          parameters: { type: "object", properties: {} },
        },
      },
    ]);
    getToolExecutionRegistryMock.mockReturnValue(
      new Map([
        [
          "get_profile",
          {
            name: "get_profile",
            invoke: vi.fn(async () => ({ name: "Fezer" })),
          },
        ],
      ])
    );

    invokeLLMMock
      .mockResolvedValueOnce({
        id: "1",
        created: 1,
        model: "deepseek-chat",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "calling tool",
              tool_calls: [
                {
                  id: "tool_1",
                  type: "function",
                  function: {
                    name: "get_profile",
                    arguments: "{\"includeDetails\":false}",
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      })
      .mockResolvedValueOnce({
        id: "2",
        created: 2,
        model: "deepseek-chat",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "final answer" },
            finish_reason: "stop",
          },
        ],
      });

    const { invokeAgent } = await import("./agent-factory");
    const result = await invokeAgent("core", "who are you");

    expect(result.answer).toBe("final answer");
    expect(invokeLLMMock).toHaveBeenCalledTimes(2);

    const secondCall = invokeLLMMock.mock.calls[1][0];
    const assistantWithToolCalls = secondCall.messages.find(
      (msg: any) => msg.role === "assistant" && Array.isArray(msg.tool_calls)
    );
    expect(assistantWithToolCalls).toBeTruthy();
    expect(assistantWithToolCalls.tool_calls[0].id).toBe("tool_1");

    const toolMessage = secondCall.messages.find(
      (msg: any) => msg.role === "tool" && msg.tool_call_id === "tool_1"
    );
    expect(toolMessage).toBeTruthy();
    expect(String(toolMessage.content)).toContain("\"success\":true");
  });

  it("does not interrupt final answer when tool execution fails", async () => {
    getLLMToolsByNamesMock.mockReturnValue([
      {
        type: "function",
        function: {
          name: "get_profile",
          description: "get profile",
          parameters: { type: "object", properties: {} },
        },
      },
    ]);
    getToolExecutionRegistryMock.mockReturnValue(
      new Map([
        [
          "get_profile",
          {
            name: "get_profile",
            invoke: vi.fn(async () => {
              throw new Error("tool failed");
            }),
          },
        ],
      ])
    );

    invokeLLMMock
      .mockResolvedValueOnce({
        id: "1",
        created: 1,
        model: "deepseek-chat",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "calling tool",
              tool_calls: [
                {
                  id: "tool_1",
                  type: "function",
                  function: {
                    name: "get_profile",
                    arguments: "{}",
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      })
      .mockResolvedValueOnce({
        id: "2",
        created: 2,
        model: "deepseek-chat",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "answer after tool error" },
            finish_reason: "stop",
          },
        ],
      });

    const { invokeAgent } = await import("./agent-factory");
    const result = await invokeAgent("core", "who are you");

    expect(result.answer).toBe("answer after tool error");
    const secondCall = invokeLLMMock.mock.calls[1][0];
    const toolMessage = secondCall.messages.find((msg: any) => msg.role === "tool");
    expect(String(toolMessage.content)).toContain("\"success\":false");
  });

  it("returns controlled fallback when tool loop reaches limit", async () => {
    getLLMToolsByNamesMock.mockReturnValue([
      {
        type: "function",
        function: {
          name: "get_profile",
          description: "get profile",
          parameters: { type: "object", properties: {} },
        },
      },
    ]);
    getToolExecutionRegistryMock.mockReturnValue(
      new Map([
        [
          "get_profile",
          {
            name: "get_profile",
            invoke: vi.fn(async () => ({ ok: true })),
          },
        ],
      ])
    );

    invokeLLMMock.mockImplementation(async () => ({
      id: "loop",
      created: 1,
      model: "deepseek-chat",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "still calling tools",
            tool_calls: [
              {
                id: "tool_loop",
                type: "function",
                function: {
                  name: "get_profile",
                  arguments: "{}",
                },
              },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
    }));

    const { invokeAgent } = await import("./agent-factory");
    const result = await invokeAgent("core", "loop");

    expect(result.answer).toContain("已达到工具调用上限");
    expect(invokeLLMMock).toHaveBeenCalledTimes(4);
  });

  it("rejects tool not in current agent whitelist", async () => {
    getLLMToolsByNamesMock.mockReturnValue([
      {
        type: "function",
        function: {
          name: "get_faq",
          description: "get faq",
          parameters: { type: "object", properties: {} },
        },
      },
    ]);
    getToolExecutionRegistryMock.mockReturnValue(
      new Map([
        [
          "get_faq",
          {
            name: "get_faq",
            invoke: vi.fn(async () => ({ faqs: [] })),
          },
        ],
      ])
    );

    invokeLLMMock
      .mockResolvedValueOnce({
        id: "1",
        created: 1,
        model: "deepseek-chat",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "calling forbidden tool",
              tool_calls: [
                {
                  id: "forbidden",
                  type: "function",
                  function: {
                    name: "get_faq",
                    arguments: "{}",
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      })
      .mockResolvedValueOnce({
        id: "2",
        created: 2,
        model: "deepseek-chat",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "builder final answer" },
            finish_reason: "stop",
          },
        ],
      });

    const { invokeAgent } = await import("./agent-factory");
    const result = await invokeAgent("builder", "faq?");
    expect(result.answer).toBe("builder final answer");

    const secondCall = invokeLLMMock.mock.calls[1][0];
    const forbiddenToolMessage = secondCall.messages.find(
      (msg: any) => msg.role === "tool" && msg.tool_call_id === "forbidden"
    );
    expect(String(forbiddenToolMessage.content)).toContain("Tool not allowed");
  });

  it("returns safe answer when tool_calls payload is malformed", async () => {
    getLLMToolsByNamesMock.mockReturnValue([
      {
        type: "function",
        function: {
          name: "get_profile",
          description: "get profile",
          parameters: { type: "object", properties: {} },
        },
      },
    ]);

    invokeLLMMock.mockResolvedValueOnce({
      id: "1",
      created: 1,
      model: "deepseek-chat",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "calling tool",
            tool_calls: [
              {
                id: "",
                type: "function",
                function: {
                  name: "get_profile",
                  arguments: "{}",
                },
              },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
    });

    const { invokeAgent } = await import("./agent-factory");
    const result = await invokeAgent("core", "hello");

    expect(result.answer).toContain("工具调用格式异常");
    expect(invokeLLMMock).toHaveBeenCalledTimes(1);
  });
});
