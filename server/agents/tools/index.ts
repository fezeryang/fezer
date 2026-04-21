/**
 * Tools registry - single executable source for all agent tools.
 * Keep runtime registration centralized here to avoid drift.
 */

import { z } from "zod";
import type { Tool as LLMTool } from "../../_core/llm";
import { getProfileTool, getContactInfoTool } from "./profile.tool";
import { getProjectsTool, getProjectByIndexTool } from "./projects.tool";
import { getSkillsTool, hasSkillTool, getInterestsTool } from "./skills.tool";
import {
  askOtherAgentTool,
  askMultipleAgentsTool,
  setAgentInvoker,
  type AgentId,
} from "./agent.tool";
import {
  knowledgeSearchTool,
  getProjectDetailsTool,
  getFAQTool,
} from "../rag/retriever";
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
  getContactInfoTool,
  getProjectsTool,
  getProjectByIndexTool,
  getSkillsTool,
  hasSkillTool,
  getInterestsTool,
  askOtherAgentTool,
  askMultipleAgentsTool,
  knowledgeSearchTool,
  getProjectDetailsTool,
  getFAQTool,
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

// ----- compatibility exports (legacy wrappers) -----
export type { AgentId };
export { setAgentInvoker };
export {
  getProfileTool,
  getContactInfoTool,
  getProjectsTool,
  getProjectByIndexTool,
  getSkillsTool,
  hasSkillTool,
  getInterestsTool,
  askOtherAgentTool,
  askMultipleAgentsTool,
  knowledgeSearchTool,
  getProjectDetailsTool,
  getFAQTool,
  searchContentTool,
  getBlogPostsTool,
  getWorksDetailTool,
  getProfileFullTool,
};

/**
 * @deprecated Use getLLMToolsByNames/getExecutableToolsByNames instead.
 */
export async function getAllTools() {
  return allTools;
}

/**
 * @deprecated Use agent tool whitelist + getLLMToolsByNames instead.
 */
export async function getBuilderTools() {
  return getExecutableToolsByNames([
    "get_profile",
    "get_projects",
    "get_skills",
    "ask_other_agent",
  ]);
}

/**
 * @deprecated Use agent tool whitelist + getLLMToolsByNames instead.
 */
export async function getAITools() {
  return getExecutableToolsByNames([
    "get_profile",
    "get_projects",
    "get_skills",
    "search_knowledge",
    "get_project_details",
    "ask_other_agent",
  ]);
}

/**
 * @deprecated Use agent tool whitelist + getLLMToolsByNames instead.
 */
export async function getWriterTools() {
  return getExecutableToolsByNames([
    "get_profile",
    "get_skills",
    "get_interests",
    "ask_other_agent",
  ]);
}

/**
 * @deprecated Use agent tool whitelist + getLLMToolsByNames instead.
 */
export async function getReaderTools() {
  return getExecutableToolsByNames([
    "get_profile",
    "get_interests",
    "search_knowledge",
    "get_faq",
    "ask_other_agent",
  ]);
}

/**
 * @deprecated Use agent tool whitelist + getLLMToolsByNames instead.
 */
export async function getVisualTools() {
  return getExecutableToolsByNames([
    "get_profile",
    "get_skills",
    "get_interests",
    "ask_other_agent",
  ]);
}

/**
 * @deprecated Use agent tool whitelist + getLLMToolsByNames instead.
 */
export async function getWandererTools() {
  return getExecutableToolsByNames([
    "get_profile",
    "get_interests",
    "ask_other_agent",
  ]);
}

/**
 * @deprecated Use agent tool whitelist + getLLMToolsByNames instead.
 */
export async function getCoreTools() {
  return getExecutableToolsByNames([
    "get_profile",
    "get_skills",
    "get_projects",
    "search_knowledge",
    "get_project_details",
    "get_faq",
    "ask_other_agent",
    "ask_multiple_agents",
  ]);
}
