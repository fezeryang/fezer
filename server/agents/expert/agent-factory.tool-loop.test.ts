import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RunEvent } from "@fezer/shared/schemas/run";

const invokeLLMMock = vi.fn();
const invokeLLMStreamMock = vi.fn();
const isLLMProviderConfigurationErrorMock = vi.fn();
const getLLMToolsByNamesMock = vi.fn();
const getToolExecutionRegistryMock = vi.fn();
const MAX_TOOL_CALL_LOOPS = 3;

vi.mock("../../_core/llm", () => ({
  invokeLLM: invokeLLMMock,
  invokeLLMStream: invokeLLMStreamMock,
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

  it("preloads profile context for visitor questions and exposes the whitelist to the model", async () => {
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

    // 白名单工具常驻暴露；mock 返回空集，因此 LLM 请求本身不带 tools
    expect(getLLMToolsByNamesMock).toHaveBeenCalledTimes(1);
    const exposedNames = getLLMToolsByNamesMock.mock.calls[0][0];
    expect(exposedNames).toContain("get_profile_full");
    expect(exposedNames).toContain("search_content");
    expect(exposedNames).toContain("ask_other_agent");

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

  it("skips the heavy full-profile prefetch for non-profile intents on non-core agents", async () => {
    const getProfileFullInvoke = vi.fn(async () => ({
      profile: { name: "Fezer", body: "structured profile" },
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
          message: { role: "assistant", content: "answer without context" },
          finish_reason: "stop",
        },
      ],
    });

    const { invokeAgent } = await import("./agent-factory");
    const result = await invokeAgent("visual", "你适合什么方向？");

    expect(result.answer).toBe("answer without context");
    // 非资料意图 + 非核心 agent：不再预取全量简历，模型可经检索工具按需获取
    expect(getProfileFullInvoke).not.toHaveBeenCalled();

    const firstCall = invokeLLMMock.mock.calls[0][0];
    expect(
      firstCall.messages.some(
        (msg: any) =>
          msg.role === "system" &&
          String(msg.content).includes("服务器已预先检索到的真实个人资料")
      )
    ).toBe(false);
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

  it("always exposes the agent tool whitelist and hides communication tools when nested", async () => {
    invokeLLMMock.mockResolvedValue({
      id: "1",
      created: 1,
      model: "deepseek-chat",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "whitelist answer" },
          finish_reason: "stop",
        },
      ],
    });

    const { invokeAgent } = await import("./agent-factory");

    // 顶层：白名单常驻暴露，不再依赖关键词闸门
    await invokeAgent("core", "你好");
    expect(getLLMToolsByNamesMock).toHaveBeenCalledTimes(1);
    const topLevelNames = getLLMToolsByNamesMock.mock.calls[0][0];
    expect(topLevelNames).toContain("ask_other_agent");
    expect(topLevelNames).toContain("ask_multiple_agents");
    expect(topLevelNames).toContain("search_content");

    // 嵌套层：通信工具被硬性剔除，阻断递归
    await invokeAgent("core", "你好", { consultDepth: 1 });
    expect(getLLMToolsByNamesMock).toHaveBeenCalledTimes(2);
    const nestedNames = getLLMToolsByNamesMock.mock.calls[1][0];
    expect(nestedNames).not.toContain("ask_other_agent");
    expect(nestedNames).not.toContain("ask_multiple_agents");
    expect(nestedNames).toContain("search_content");
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

  it("sends the user input exactly once and threads conversation history", async () => {
    invokeLLMMock.mockResolvedValueOnce({
      id: "1",
      created: 1,
      model: "deepseek-chat",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "history-aware answer" },
          finish_reason: "stop",
        },
      ],
    });

    const { invokeAgent } = await import("./agent-factory");
    await invokeAgent("core", "那第二个项目呢？", {
      context: {
        grounding: "public_profile",
        conversationHistory: [
          { role: "user", content: "介绍一下你的项目" },
          { role: "assistant", content: "第一个项目是 TODŌU 3D 工作台" },
        ],
      },
    });

    const firstCall = invokeLLMMock.mock.calls[0][0];
    // 当前输入只出现一次（历史里的 user 轮属于正常多轮对话，不算重复注入）
    const currentInputMessages = firstCall.messages.filter(
      (msg: any) => msg.role === "user" && msg.content === "那第二个项目呢？"
    );
    expect(currentInputMessages).toHaveLength(1);
    const allUserMessages = firstCall.messages.filter(
      (msg: any) => msg.role === "user"
    );
    expect(allUserMessages).toHaveLength(2); // 1 条历史 + 1 条当前

    // 会话历史完整进入上下文
    const historyAssistantMessage = firstCall.messages.find(
      (msg: any) =>
        msg.role === "assistant" &&
        msg.content === "第一个项目是 TODŌU 3D 工作台"
    );
    expect(historyAssistantMessage).toBeTruthy();

    // 历史会被截断为信任边界内的轮数
    const oversizedHistory = Array.from({ length: 20 }, (_, index) => ({
      role: "user" as const,
      content: `问题 ${index}`,
    }));
    invokeLLMMock.mockResolvedValueOnce({
      id: "2",
      created: 2,
      model: "deepseek-chat",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "truncated answer" },
          finish_reason: "stop",
        },
      ],
    });
    await invokeAgent("core", "继续", {
      context: { conversationHistory: oversizedHistory },
    });
    const secondCall = invokeLLMMock.mock.calls[1][0];
    const historyUserMessages = secondCall.messages.filter(
      (msg: any) => msg.role === "user" && msg.content.startsWith("问题 ")
    );
    expect(historyUserMessages.length).toBeLessThanOrEqual(8);
  });

  it("rejects nested consultation outside the caller canConsult whitelist", async () => {
    invokeLLMMock.mockResolvedValue({
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

    // 单独运行本用例时也必须保证 invoker 已注入（initializeAgentFactory 在模块加载时执行）
    await import("./agent-factory");
    const { runWithAgentToolContext, askOtherAgentTool } = await import(
      "../tools/agent.tool"
    );

    // builder 的 canConsult 只有 ai/writer，问 wanderer 必须被代码层拒绝
    const rejected = await runWithAgentToolContext(
      { callerAgentId: "builder", consultDepth: 0 },
      () =>
        askOtherAgentTool.invoke({
          agentId: "wanderer",
          question: "旅行有什么收获",
        }) as Promise<unknown>
    );
    expect(JSON.stringify(rejected)).toContain("协作白名单");

    // 白名单内的 ai 正常透传
    const allowed = await runWithAgentToolContext(
      { callerAgentId: "builder", consultDepth: 0 },
      () =>
        askOtherAgentTool.invoke({
          agentId: "ai",
          question: "LangChain 怎么用",
        }) as Promise<unknown>
    );
    expect(JSON.stringify(allowed)).toContain("direct answer");
    expect(JSON.stringify(allowed)).toContain('"success":true');
  });

  it("rejects consultation beyond the nesting depth cap", async () => {
    // 单独运行本用例时也必须保证 invoker 已注入（initializeAgentFactory 在模块加载时执行）
    await import("./agent-factory");
    const { runWithAgentToolContext, askOtherAgentTool } = await import(
      "../tools/agent.tool"
    );

    const rejected = await runWithAgentToolContext(
      { callerAgentId: "core", consultDepth: 2 },
      () =>
        askOtherAgentTool.invoke({
          agentId: "builder",
          question: "递归问题",
        }) as Promise<unknown>
    );
    expect(JSON.stringify(rejected)).toContain("嵌套上限");
  });
});

describe("expert agent run events", () => {
  // 必须有自己的清理：文件顶部的 beforeEach 只作用于第一个 describe，
  // 否则 mock 调用计数与 Once 队列会跨 describe 泄漏（clearAllMocks 不清 Once 队列）
  beforeEach(() => {
    vi.clearAllMocks();
    invokeLLMMock.mockReset();
    invokeLLMStreamMock.mockReset();
    process.env.LANGSMITH_TRACING = "false";
    delete process.env.LANGSMITH_API_KEY;

    getLLMToolsByNamesMock.mockReturnValue([]);
    getToolExecutionRegistryMock.mockReturnValue(new Map());
    isLLMProviderConfigurationErrorMock.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockedTool(name: string) {
    return [
      name,
      { name, invoke: vi.fn(async () => ({ name: "Fezer" })) },
    ] as const;
  }

  function llmToolCall(name: string) {
    return {
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
                function: { name, arguments: "{}" },
              },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
    };
  }

  const llmFinalAnswer = {
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
  };

  it("发出 agent.start → tool.call/result → agent.done", async () => {
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
      new Map([mockedTool("get_profile")])
    );
    invokeLLMMock
      .mockResolvedValueOnce(llmToolCall("get_profile"))
      .mockResolvedValueOnce(llmFinalAnswer);

    const { invokeAgent } = await import("./agent-factory");
    const { runWithEventSink } = await import("../../_core/run-events");
    const events: RunEvent[] = [];

    await runWithEventSink(
      event => events.push(event),
      () => invokeAgent("builder", "你好")
    );

    expect(events.map(event => event.type)).toEqual([
      "agent.start",
      "tool.call",
      "tool.result",
      "agent.done",
    ]);
    expect(events[0]).toMatchObject({ agentId: "builder" });
    expect(events[1]).toMatchObject({
      type: "tool.call",
      toolName: "get_profile",
    });
    expect(events[2]).toMatchObject({
      type: "tool.result",
      toolName: "get_profile",
      ok: true,
      truncated: false,
    });
    expect((events[2] as { bytes: number }).bytes).toBeGreaterThan(0);

    for (const event of events) {
      expect(typeof event.at).toBe("number");
    }
  });

  it("工具不在白名单时上报 ok=false（拒绝也进事件流）", async () => {
    getLLMToolsByNamesMock.mockReturnValue([]);
    getToolExecutionRegistryMock.mockReturnValue(new Map());
    invokeLLMMock
      .mockResolvedValueOnce(llmToolCall("get_blog_posts"))
      .mockResolvedValueOnce(llmFinalAnswer);

    const { invokeAgent } = await import("./agent-factory");
    const { runWithEventSink } = await import("../../_core/run-events");
    const events: RunEvent[] = [];

    await runWithEventSink(
      event => events.push(event),
      () => invokeAgent("builder", "你好")
    );

    const result = events.find(event => event.type === "tool.result");
    expect(result).toMatchObject({
      toolName: "get_blog_posts",
      ok: false,
      truncated: false,
    });
  });

  it("运行控制中止后专家循环抛 AbortError", async () => {
    invokeLLMMock.mockResolvedValueOnce(llmFinalAnswer);

    const { invokeAgent } = await import("./agent-factory");
    const { runWithRunControl } = await import("../../_core/run-control");
    const controller = new AbortController();
    controller.abort();

    await expect(
      runWithRunControl({ signal: controller.signal }, () =>
        invokeAgent("core", "你好")
      )
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("预算里的 maxTurns 覆盖默认循环上限", async () => {
    invokeLLMMock.mockResolvedValue(llmFinalAnswer);
    getLLMToolsByNamesMock.mockReturnValue([]);
    getToolExecutionRegistryMock.mockReturnValue(new Map());

    const { invokeAgent } = await import("./agent-factory");
    const { runWithRunControl } = await import("../../_core/run-control");

    const result = await runWithRunControl({ maxToolLoops: 1 }, () =>
      invokeAgent("core", "你好")
    );

    expect(result.answer).toBe("final answer");
    expect(invokeLLMMock).toHaveBeenCalledTimes(1);
  });

  it("streamText 开启时以 text.delta 事件流式输出，不调非流式通道", async () => {
    getLLMToolsByNamesMock.mockReturnValue([]);
    getToolExecutionRegistryMock.mockReturnValue(new Map());
    invokeLLMStreamMock.mockImplementation(async function* () {
      yield { text: "你好", finishReason: null, toolCallDeltas: [] };
      yield { text: "，世界", finishReason: "stop", toolCallDeltas: [] };
    });

    const { invokeAgent } = await import("./agent-factory");
    const { runWithRunControl } = await import("../../_core/run-control");
    const { runWithEventSink } = await import("../../_core/run-events");
    const events: RunEvent[] = [];

    const result = await runWithRunControl({ streamText: true }, () =>
      runWithEventSink(event => events.push(event), () =>
        invokeAgent("core", "你好")
      )
    );

    expect(result.answer).toBe("你好，世界");
    expect(invokeLLMMock).not.toHaveBeenCalled();

    const deltas = events.filter(event => event.type === "text.delta");
    expect(
      deltas.map(delta => (delta as { delta: string }).delta)
    ).toEqual(["你好", "，世界"]);

    // 同一条 assistant 消息的所有增量共享 messageId
    const ids = new Set(
      deltas.map(delta => (delta as { messageId: string }).messageId)
    );
    expect(ids.size).toBe(1);
  });
});
