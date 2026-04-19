/**
 * Intent Classifier - 意图分类器
 * 分析用户输入，决定路由到哪个 agent
 */

import type { AgentId } from "../tools/agent.tool";
import { invokeLLM } from "../../_core/llm";
import { runWithTraceContext } from "../../_core/observability/langsmith";

/**
 * 意图分类结果
 */
export interface IntentClassification {
  category: string;
  targetAgent: AgentId;
  confidence: number;
  needsConsultation: boolean;
  consultAgents?: AgentId[];
  reasoning: string;
}

/**
 * 意图类别定义
 */
const INTENT_CATEGORIES = {
  GUIDE: "guide", // 导览介绍
  TECHNICAL: "technical", // 技术问题
  AI: "ai", // AI 相关
  WRITING: "writing", // 写作相关
  READING: "reading", // 阅读思考
  DESIGN: "design", // 设计相关
  TRAVEL: "travel", // 旅行探索
  GENERAL: "general", // 一般问题
  COMPLEX: "complex", // 复杂问题（需要多 agent）
} as const;

const VALID_CATEGORIES = Object.values(INTENT_CATEGORIES);
const VALID_AGENTS: AgentId[] = [
  "core",
  "builder",
  "ai",
  "writer",
  "reader",
  "visual",
  "wanderer",
];
export const INTENT_PROMPT_VERSION = "fezer.intent-classifier.v2.stage1";

function clampConfidence(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0.5;
  }
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function dedupeAgents(agents: AgentId[]): AgentId[] {
  return Array.from(new Set(agents));
}

function normalizeConsultAgents(input: unknown, targetAgent: AgentId): AgentId[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const normalized = input.filter((agent): agent is AgentId =>
    VALID_AGENTS.includes(agent as AgentId)
  );
  return dedupeAgents(normalized).filter(agent => agent !== targetAgent);
}

function deriveFallbackConsultAgents(
  category: string,
  targetAgent: AgentId
): AgentId[] {
  if (category === INTENT_CATEGORIES.COMPLEX) {
    if (targetAgent === "core") {
      return ["builder", "ai"];
    }
    return ["core"];
  }
  return [];
}

/**
 * 使用 LLM 进行意图分类
 */
export async function classifyIntent(userInput: string): Promise<IntentClassification> {
  // 简单关键词预处理（快速路径）
  const quickResult = quickClassify(userInput);
  if (quickResult) {
    return quickResult;
  }

  // 使用 LLM 进行精确分类
  const systemPrompt = `你是 Fezer 简历系统的闭集意图分类器（${INTENT_PROMPT_VERSION}）。
你必须只在给定枚举中分类，不得输出枚举外值。只返回 JSON。

## Agent 专长领域
- core: 全局介绍、导览、一般性问题
- builder: 前端、后端、工程化、技术实现
- ai: AI 应用、LLM、LangChain、自动化
- writer: 写作、内容创作、技术文档
- reader: 阅读、思考、知识管理
- visual: 设计、UI/UX、视觉
- wanderer: 旅行、探索、生活体验

## 返回格式
{
  "category": "guide|technical|ai|writing|reading|design|travel|general|complex",
  "targetAgent": "core|builder|ai|writer|reader|visual|wanderer",
  "confidence": 0-1,
  "needsConsultation": true/false,
  "consultAgents": ["agent1", "agent2"],
  "reasoning": "分类理由"
}

## 分类规则
1. category 与 targetAgent 必须从给定枚举中选择。
2. 如果问题涉及多个领域，优先设置 needsConsultation=true，并在 consultAgents 中给出 1-3 个相关 agent（不含 targetAgent）。
3. complex 表示明显跨领域或需要多角色协作；若仅单领域，避免误判为 complex。
4. confidence 使用 [0,1]，建议标尺：
   - 0.9-1.0: 明确关键词或意图直指单领域
   - 0.7-0.89: 基本明确但有轻微歧义
   - 0.4-0.69: 模糊问题或上下文不足
   - 0.0-0.39: 极度不确定（仅限异常情况）
5. reasoning 简洁说明核心依据，不要复述原问题。

## Few-shot 示例
输入: "介绍一下这个 3D 简历怎么逛"
输出: {"category":"guide","targetAgent":"core","confidence":0.95,"needsConsultation":false,"consultAgents":[],"reasoning":"明确导览意图"}

输入: "我想做一个带 Agent 的全栈 AI 应用，技术怎么选？"
输出: {"category":"complex","targetAgent":"ai","confidence":0.82,"needsConsultation":true,"consultAgents":["builder"],"reasoning":"AI 方案与工程实现强耦合"}

输入: "最近在看什么，怎么做知识管理？"
输出: {"category":"reading","targetAgent":"reader","confidence":0.9,"needsConsultation":false,"consultAgents":[],"reasoning":"阅读与知识管理是 reader 主域"}`;

  try {
    const result = await runWithTraceContext(
      {
        promptKey: "supervisor/intent-classifier",
        promptVersion: INTENT_PROMPT_VERSION,
        promptTag: "stage1",
      },
      async () =>
        invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userInput },
          ],
          outputSchema: {
            name: "intent_classification",
            strict: true,
            schema: {
              type: "object",
              properties: {
                category: { type: "string", enum: VALID_CATEGORIES },
                targetAgent: { type: "string", enum: VALID_AGENTS },
                confidence: { type: "number" },
                needsConsultation: { type: "boolean" },
                consultAgents: {
                  type: "array",
                  items: { type: "string", enum: VALID_AGENTS },
                },
                reasoning: { type: "string" },
              },
              required: [
                "category",
                "targetAgent",
                "confidence",
                "needsConsultation",
                "consultAgents",
                "reasoning",
              ],
              additionalProperties: false,
            },
          },
        })
    );

    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") {
      const parsed = JSON.parse(content);
      return validateAndNormalize(parsed);
    }
    // Fallback
    return {
      category: "general",
      targetAgent: "core",
      confidence: 0.5,
      needsConsultation: false,
      consultAgents: [],
      reasoning: "LLM 返回格式异常，使用默认分类",
    };
  } catch (error) {
    console.error("Intent classification error:", error);
    // Fallback to rule-based
    return ruleBasedClassify(userInput);
  }
}

/**
 * 快速关键词分类
 */
function quickClassify(input: string): IntentClassification | null {
  const lower = input.toLowerCase();

  // 明确的导览意图
  if (
    lower.includes("介绍") ||
    lower.includes("导览") ||
    lower.includes("这是什么") ||
    lower.includes("如何开始")
  ) {
    return {
      category: "guide",
      targetAgent: "core",
      confidence: 0.95,
      needsConsultation: false,
      reasoning: "明确的导览请求",
    };
  }

  // 明确的技术问题
  if (
    lower.includes("技术") ||
    lower.includes("代码") ||
    lower.includes("开发") ||
    lower.includes("前端") ||
    lower.includes("后端")
  ) {
    return {
      category: "technical",
      targetAgent: "builder",
      confidence: 0.9,
      needsConsultation: false,
      reasoning: "明确的技术问题",
    };
  }

  // 明确的 AI 问题
  if (
    lower.includes("ai") ||
    lower.includes("llm") ||
    lower.includes("langchain") ||
    lower.includes("人工智能")
  ) {
    return {
      category: "ai",
      targetAgent: "ai",
      confidence: 0.95,
      needsConsultation: false,
      reasoning: "明确的 AI 问题",
    };
  }

  return null; // 需要进一步分析
}

/**
 * 基于规则的分类（回退方案）
 */
function ruleBasedClassify(input: string): IntentClassification {
  const lower = input.toLowerCase();

  // 检查是否涉及多个领域
  const domainCount = [
    lower.includes("技术") || lower.includes("开发"),
    lower.includes("ai") || lower.includes("人工智能"),
    lower.includes("写") || lower.includes("文章"),
    lower.includes("设计") || lower.includes("ui"),
  ].filter(Boolean).length;

  if (domainCount >= 2) {
    return {
      category: "complex",
      targetAgent: "core",
      confidence: 0.7,
      needsConsultation: true,
      consultAgents: ["builder", "ai"],
      reasoning: "问题涉及多个领域",
    };
  }

  // 单领域分类
  if (lower.includes("技术") || lower.includes("代码")) {
    return {
      category: "technical",
      targetAgent: "builder",
      confidence: 0.7,
      needsConsultation: false,
      reasoning: "基于关键词匹配",
    };
  }

  // 默认到 core
  return {
    category: "general",
    targetAgent: "core",
    confidence: 0.5,
    needsConsultation: false,
    reasoning: "默认分类",
  };
}

/**
 * 验证并规范化分类结果
 */
function validateAndNormalize(parsed: any): IntentClassification {
  const category = VALID_CATEGORIES.includes(parsed?.category)
    ? parsed.category
    : INTENT_CATEGORIES.GENERAL;
  const targetAgent: AgentId = VALID_AGENTS.includes(parsed?.targetAgent)
    ? parsed.targetAgent
    : "core";
  const confidence = clampConfidence(parsed?.confidence);
  const needsConsultation = Boolean(parsed?.needsConsultation);
  const consultAgents = normalizeConsultAgents(parsed?.consultAgents, targetAgent);
  const normalizedConsultAgents = needsConsultation
    ? (consultAgents.length > 0
      ? consultAgents
      : deriveFallbackConsultAgents(category, targetAgent))
    : [];

  return {
    category,
    targetAgent,
    confidence,
    needsConsultation: normalizedConsultAgents.length > 0 && needsConsultation,
    consultAgents: normalizedConsultAgents,
    reasoning:
      typeof parsed?.reasoning === "string" && parsed.reasoning.trim().length > 0
        ? parsed.reasoning
        : "分类结果已规范化",
  };
}

/**
 * 批量分类（用于多个输入）
 */
export async function classifyIntents(inputs: string[]): Promise<IntentClassification[]> {
  return Promise.all(inputs.map(input => classifyIntent(input)));
}
