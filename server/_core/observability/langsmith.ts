import { AsyncLocalStorage } from "node:async_hooks";
import { traceable } from "langsmith/traceable";
import { ENV } from "../env";

export interface TraceContext {
  route?: string;
  interactionType?: "click" | "hover" | "chat" | "guide";
  agentId?: string;
  roomId?: string;
  characterId?: string;
  env?: string;
  promptKey?: string;
  promptVersion?: string;
  promptCommit?: string;
  promptTag?: string;
}

interface SpanOptions {
  runType?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

const traceContextStorage = new AsyncLocalStorage<TraceContext>();

export function isLangSmithTracingEnabled(): boolean {
  return ENV.langsmithTracing && ENV.langsmithApiKey.trim().length > 0;
}

export function runWithTraceContext<T>(
  context: Partial<TraceContext>,
  fn: () => Promise<T>
): Promise<T> {
  const current = traceContextStorage.getStore() ?? {};
  const merged = { ...current, ...context };

  return new Promise<T>((resolve, reject) => {
    traceContextStorage.run(merged, () => {
      fn().then(resolve).catch(reject);
    });
  });
}

export function getTraceContext(): TraceContext {
  return traceContextStorage.getStore() ?? {};
}

function buildTraceTags(
  context: TraceContext,
  tags: string[] = []
): string[] {
  const derived = [
    context.route ? `route:${context.route}` : undefined,
    context.interactionType
      ? `interaction:${context.interactionType}`
      : undefined,
    context.agentId ? `agent:${context.agentId}` : undefined,
    context.roomId ? `room:${context.roomId}` : undefined,
    context.characterId ? `character:${context.characterId}` : undefined,
    context.env ? `env:${context.env}` : undefined,
    context.promptKey ? `prompt:${context.promptKey}` : undefined,
    context.promptVersion
      ? `prompt_version:${context.promptVersion}`
      : undefined,
    context.promptTag ? `prompt_tag:${context.promptTag}` : undefined,
  ].filter(Boolean) as string[];

  return Array.from(new Set([...derived, ...tags]));
}

function buildTraceMetadata(
  context: TraceContext,
  metadata: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    ...context,
    ...metadata,
  };
}

export async function traceSpan<T>(
  name: string,
  fn: () => Promise<T>,
  options?: SpanOptions
): Promise<T> {
  if (!isLangSmithTracingEnabled()) {
    return fn();
  }

  const context = getTraceContext();
  const wrapped = traceable(async () => fn(), {
    name,
    run_type: options?.runType ?? "chain",
    tags: buildTraceTags(context, options?.tags),
    metadata: buildTraceMetadata(context, options?.metadata),
    project_name: ENV.langsmithProject,
  });

  return wrapped();
}
