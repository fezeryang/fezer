import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invokeLLMMock = vi.fn();
const isLLMProviderConfigurationErrorMock = vi.fn();
const getLLMToolsByNamesMock = vi.fn();
const getToolExecutionRegistryMock = vi.fn();
const MAX_TOOL_CALL_LOOPS = 3;

vi.mock("../../_core/llm", () => ({
  invokeLLM: invokeLLMMock,
  isLLMProviderConfigurationError: isLLMProviderConfigurationErrorMock,
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
    isLLMProviderConfigurationErrorMock.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it("propagates agent execution failures instead of returning them as chat text", async () => {
    const providerError = new Error("provider request failed");
    invokeLLMMock.mockRejectedValueOnce(providerError);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { invokeAgent } = await import("./agent-factory");

    await expect(invokeAgent("core", "hello")).rejects.toBe(providerError);
  });

  it("preloads local website context for ordinary visitor questions without exposing tools to the model", async () => {
    const getProfileFullInvoke = vi.fn(async () => ({
      profile: { name: "Fezer", body: "structured profile" },
    }));
    const getProfileInvoke = vi.fn(async () => ({ name: "Fezer" }));
    const getSkillsInvoke = vi.fn(async () => ({
      skills: { ai: ["Agent Workflow"] },
    }));
    const getProjectsInvoke = vi.fn(async () => ({
      projects: [{ company: "Portfolio" }],
    }));

    getToolExecutionRegistryMock.mockReturnValue(
      new Map([
        [
          "get_profile_full",
          {
            name: "get_profile_full",
            invoke: getProfileFullInvoke,
          },
        ],
        [
          "get_profile",
          {
            name: "get_profile",
            invoke: getProfileInvoke,
          },
        ],
        [
          "get_skills",
          {
            name: "get_skills",
            invoke: getSkillsInvoke,
          },
        ],
        [
          "get_projects",
          {
            name: "get_projects",
            invoke: getProjectsInvoke,
          },
        ],
      ])
    );

    invokeLLMMock.mockResolvedValueOnce({
      id: "1",
      created: 1,
      model: "deepseek-chat",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "profile answer" },
          finish_reason: "stop",
        },
      ],
    });

    const { invokeAgent } = await import("./agent-factory");
    const result = await invokeAgent("core", "你好，请介绍一下你是谁");

    expect(result.answer).toBe("profile answer");
    expect(getProfileFullInvoke).toHaveBeenCalledWith({ locale: "zh-CN" });
    expect(getProfileInvoke).toHaveBeenCalledWith({ includeDetails: false });
    expect(getSkillsInvoke).toHaveBeenCalledWith({ category: "all" });
    expect(getProjectsInvoke).toHaveBeenCalledWith({
      category: "all",
      limit: 3,
    });
    expect(getLLMToolsByNamesMock).not.toHaveBeenCalled();

    const firstCall = invokeLLMMock.mock.calls[0][0];
    expect(firstCall.tools).toBeUndefined();
    expect(firstCall.tool_choice).toBeUndefined();
    expect(
      firstCall.messages.some(
        (msg: any) =>
          msg.role === "system" &&
          String(msg.content).includes("服务器已预先检索到的真实个人资料")
      )
    ).toBe(true);
  });

  it("always preloads the structured public profile before answering", async () => {
    const getProfileFullInvoke = vi.fn(async () => ({
      profile: { name: "Fezer", body: "mandatory profile context" },
    }));

    getToolExecutionRegistryMock.mockReturnValue(
      new Map([
        [
          "get_profile_full",
          {
            name: "get_profile_full",
            invoke: getProfileFullInvoke,
          },
        ],
      ])
    );

    invokeLLMMock.mockResolvedValueOnce({
      id: "1",
      created: 1,
      model: "deepseek-chat",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "answer with context" },
          finish_reason: "stop",
        },
      ],
    });

    const { invokeAgent } = await import("./agent-factory");
    const result = await invokeAgent("visual", "你适合什么方向？");

    expect(result.answer).toBe("answer with context");
    expect(getProfileFullInvoke).toHaveBeenCalledWith({ locale: "zh-CN" });

    const firstCall = invokeLLMMock.mock.calls[0][0];
    expect(
      firstCall.messages.some(
        (msg: any) =>
          msg.role === "system" &&
          String(msg.content).includes("mandatory profile context")
      )
    ).toBe(true);
  });

  it("adds strict public profile grounding rules for Jianli chat requests", async () => {
    const getProfileFullInvoke = vi.fn(async () => ({
      profile: {
        name: "Fezer",
        body: "中央财经大学保险专业硕士在读\n邮箱：cookfezer@gmail.com",
      },
    }));

    getToolExecutionRegistryMock.mockReturnValue(
      new Map([
        [
          "get_profile_full",
          {
            name: "get_profile_full",
            invoke: getProfileFullInvoke,
          },
        ],
      ])
    );

    invokeLLMMock.mockResolvedValueOnce({
      id: "1",
      created: 1,
      model: "deepseek-chat",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "grounded profile answer" },
          finish_reason: "stop",
        },
      ],
    });

    const { invokeAgent } = await import("./agent-factory");
    const result = await invokeAgent("core", "请介绍 Fezer 的真实背景", {
      context: { grounding: "public_profile" },
    });

    expect(result.answer).toBe("grounded profile answer");

    const firstCall = invokeLLMMock.mock.calls[0][0];
    const systemText = firstCall.messages
      .filter((msg: any) => msg.role === "system")
      .map((msg: any) => String(msg.content))
      .join("\n");

    expect(systemText).toContain("公开简历事实约束");
    expect(systemText).toContain("唯一事实来源");
    expect(systemText).toContain("目前公开简历资料里没有明确依据");
    expect(systemText).toContain("fezer@example.com");
    expect(systemText).toContain("中央财经大学保险专业硕士在读");
    expect(systemText).toContain("cookfezer@gmail.com");
  });

  it("enables a small dynamic tool set only for cross-agent requests", async () => {
    getLLMToolsByNamesMock.mockReturnValue([
      {
        type: "function",
        function: {
          name: "ask_multiple_agents",
          description: "ask agents",
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
          message: { role: "assistant", content: "cross-agent answer" },
          finish_reason: "stop",
        },
      ],
    });

    const { invokeAgent } = await import("./agent-factory");
    await invokeAgent("core", "请从技术和 AI 多视角综合分析一下");

    expect(getLLMToolsByNamesMock).toHaveBeenCalledTimes(1);
    const enabledNames = getLLMToolsByNamesMock.mock.calls[0][0];
    expect(enabledNames.length).toBeLessThanOrEqual(4);
    expect(enabledNames).toContain("ask_multiple_agents");
    expect(enabledNames).toContain("get_profile");

    const firstCall = invokeLLMMock.mock.calls[0][0];
    expect(firstCall.tools).toHaveLength(1);
    expect(firstCall.tool_choice).toBe("auto");
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
                    arguments: '{"includeDetails":false}',
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
    const result = await invokeAgent("core", "请用工具综合回答这个复杂问题");

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
    expect(String(toolMessage.content)).toContain('"success":true');
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
    const result = await invokeAgent("core", "请用工具综合回答这个复杂问题");

    expect(result.answer).toBe("answer after tool error");
    const secondCall = invokeLLMMock.mock.calls[1][0];
    const toolMessage = secondCall.messages.find(
      (msg: any) => msg.role === "tool"
    );
    expect(String(toolMessage.content)).toContain('"success":false');
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
    const result = await invokeAgent("core", "请用工具综合回答这个复杂问题");

    expect(result.answer).toContain("已达到工具调用上限");
    expect(invokeLLMMock).toHaveBeenCalledTimes(MAX_TOOL_CALL_LOOPS);
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
    const result = await invokeAgent(
      "builder",
      "请用工具综合回答这个复杂 faq 问题"
    );
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
    const result = await invokeAgent("core", "请用工具综合回答这个复杂问题");

    expect(result.answer).toContain("工具调用格式异常");
    expect(invokeLLMMock).toHaveBeenCalledTimes(1);
  });
});
