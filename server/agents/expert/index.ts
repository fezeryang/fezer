/**
 * Expert Agents 统一导出
 */

// Agent Factory
export {
  invokeAgent,
  invokeMultipleAgents,
  initializeAgentFactory,
  type AgentResponse,
  type AgentInvokeOptions,
} from "./agent-factory";

// Type
export type { AgentId } from "../tools/agent.tool";

// Individual Agents
export {
  invokeBuilderAgent,
  BuilderAgent,
} from "./builder-agent";

export {
  invokeAIAgent,
  AIAgent,
} from "./ai-agent";

export {
  invokeWriterAgent,
  WriterAgent,
} from "./writer-agent";

export {
  invokeReaderAgent,
  ReaderAgent,
} from "./reader-agent";

export {
  invokeVisualAgent,
  VisualAgent,
} from "./visual-agent";

export {
  invokeWandererAgent,
  WandererAgent,
} from "./wanderer-agent";

// Core agent uses the factory directly
export { invokeAgent as invokeCoreAgent } from "./agent-factory";

// Lazy loader for dynamic agent access
async function getExpertAgent(agentId: string) {
  switch (agentId) {
    case "builder":
      return (await import("./builder-agent")).invokeBuilderAgent;
    case "ai":
      return (await import("./ai-agent")).invokeAIAgent;
    case "writer":
      return (await import("./writer-agent")).invokeWriterAgent;
    case "reader":
      return (await import("./reader-agent")).invokeReaderAgent;
    case "visual":
      return (await import("./visual-agent")).invokeVisualAgent;
    case "wanderer":
      return (await import("./wanderer-agent")).invokeWandererAgent;
    default:
      throw new Error(`Unknown agent: ${agentId}`);
  }
}

/**
 * 根据类型获取 agent 调用函数
 */
export async function getExpertAgentInvoker(agentId: string) {
  return getExpertAgent(agentId);
}
