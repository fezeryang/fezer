import { describe, expect, it } from "vitest";
import { AGENT_TOOL_CONFIGS } from "../expert/agent-factory";
import { getToolExecutionRegistry } from "./index";

/**
 * 这组断言存在的理由：registry 里曾长期挂着 6 个工具（get_contact_info、
 * get_project_by_index、has_skill、search_knowledge、get_project_details、
 * get_faq），它们不在任何 agent 白名单里，所以模型永远调不到，
 * 而没有任何东西会提醒这件事。
 */
describe("tool registry / whitelist consistency", () => {
  const registered = new Set(getToolExecutionRegistry().keys());
  const whitelisted = new Set(
    Object.values(AGENT_TOOL_CONFIGS).flatMap(config => config.tools)
  );

  it("每个注册的工具都至少出现在一个 agent 白名单里", () => {
    const unreachable = [...registered].filter(name => !whitelisted.has(name));

    expect(unreachable).toEqual([]);
  });

  it("白名单里的每个工具都已注册（拼错会静默失效）", () => {
    const missing = Object.entries(AGENT_TOOL_CONFIGS).flatMap(
      ([agentId, config]) =>
        config.tools
          .filter(name => !registered.has(name))
          .map(name => `${agentId}: ${name}`)
    );

    expect(missing).toEqual([]);
  });

  it("协作工具不会暴露给嵌套层（递归防护依赖工具名）", () => {
    const communicationTools = ["ask_other_agent", "ask_multiple_agents"];

    for (const name of communicationTools) {
      expect(registered.has(name)).toBe(true);
    }
  });
});
