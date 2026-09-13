/**
 * Tools registry - single executable source for all agent tools.
 * Keep runtime registration centralized here to avoid drift.
 *
 * 注册 ≠ 可用：模型只能调用 `AGENT_TOOL_CONFIGS` 白名单里的工具
 * （见 expert/agent-factory.ts）。注册但不在任何白名单里的工具是死代码。
 */

import { z } from "zod";
import type { Tool as LLMTool } from "../../_core/llm";
import { getProfileTool } from "./profile.tool";
import { getProjectsTool } from "./projects.tool";
import { getSkillsTool, getInterestsTool } from "./skills.tool";
import {
  askOtherAgentTool,
  askMultipleAgentsTool,
  setAgentInvoker,
  type AgentId,
} from "./agent.tool";
import {
  searchContentTool,
  getBlogPostsTool,
  getWorksDetailTool,
  getProfileFullTool,
} from "../rag/content-index";

type ToolInput = Record<string, unknown>;

export interface ExecutableTool {
  name: string;
  description: string;
  schema: unknown;
  invoke: (input: ToolInput) => Promise<unknown>;
}

const allTools: ExecutableTool[] = [
  getProfileTool,
  getProjectsTool,
  getSkillsTool,
  getInterestsTool,
  askOtherAgentTool,
  askMultipleAgentsTool,
  searchContentTool,
  getBlogPostsTool,
  getWorksDetailTool,
  getProfileFullTool,
].map(t => ({
  name: t.name,
  description: t.description,
  schema: t.schema,
  invoke: async (input: ToolInput) =>
    (t as { invoke: (payload: ToolInput) => Promise<unknown> }).invoke(input),
}));

const toolRegistry = new Map(allTools.map(t => [t.name, t]));

function toJsonSchema(schema: unknown): Record<string, unknown> {
  try {
    if (schema && typeof schema === "object") {
      return z.toJSONSchema(schema as z.ZodTypeAny) as Record<string, unknown>;
    }
  } catch {
    // fall through to permissive schema
  }
  return {
    type: "object",
    properties: {},
    additionalProperties: true,
  };
}

function toLLMTool(tool: ExecutableTool): LLMTool {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: toJsonSchema(tool.schema),
    },
  };
}

export function getToolExecutionRegistry(): Map<string, ExecutableTool> {
  return toolRegistry;
}

export function getExecutableToolsByNames(names: string[]): ExecutableTool[] {
  return names
    .map(name => toolRegistry.get(name))
    .filter((tool): tool is ExecutableTool => Boolean(tool));
}

export function getLLMToolsByNames(names: string[]): LLMTool[] {
  return getExecutableToolsByNames(names).map(toLLMTool);
}

export type { AgentId };
export { setAgentInvoker };
