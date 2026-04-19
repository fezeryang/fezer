/**
 * RAG Retriever - 知识检索
 * 简化实现：基于关键词匹配的知识检索
 * 可以扩展为向量检索
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { WEBSITE_CONTENT, PROJECT_DETAILS, FAQ } from "@fezer/shared/knowledge";

/**
 * 知识条目
 */
interface KnowledgeItem {
  id: string;
  title?: string;
  text: string;
  source: string;
  category?: string;
  keywords?: string[];
}

/**
 * 构建知识库索引
 */
const knowledgeIndex: KnowledgeItem[] = [
  ...WEBSITE_CONTENT.map(item => ({
    id: item.id,
    title: item.title,
    text: item.text,
    source: item.source,
  })),
  ...PROJECT_DETAILS.map(item => ({
    id: item.id,
    title: item.name,
    text: `${item.description}\n技术栈: ${item.techStack.join(", ")}\n亮点: ${item.highlights.join("; ")}`,
    source: "project",
  })),
  ...FAQ.map(item => ({
    id: item.id,
    title: item.question,
    text: item.answer,
    source: "faq",
    category: item.category,
    keywords: item.keywords,
  })),
];

/**
 * 知识检索工具
 */
export const knowledgeSearchTool = tool(
  async ({ query, topK = 3, category }) => {
    const queryLower = query.toLowerCase();

    // 计算相关性分数
    const scored = knowledgeIndex.map(item => {
      let score = 0;
      const textLower = item.text.toLowerCase();
      const titleLower = (item.title || "").toLowerCase();

      // 标题匹配权重更高
      if (titleLower.includes(queryLower)) {
        score += 10;
      }

      // 关键词匹配
      if (item.keywords) {
        for (const keyword of item.keywords) {
          if (queryLower.includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(queryLower)) {
            score += 5;
          }
        }
      }

      // 文本内容匹配
      const words = queryLower.split(/\s+/);
      for (const word of words) {
        if (textLower.includes(word)) {
          score += 1;
        }
      }

      // 完全匹配加分
      if (textLower.includes(queryLower)) {
        score += 3;
      }

      return { item, score };
    });

    // 过滤和排序
    let filtered = scored.filter(r => r.score > 0);
    if (category) {
      filtered = filtered.filter(r => r.item.category === category);
    }
    filtered.sort((a, b) => b.score - a.score);

    // 返回 topK 结果
    const results = filtered.slice(0, topK);

    return {
      query,
      count: results.length,
      matches: results.map(r => ({
        id: r.item.id,
        title: r.item.title,
        content: r.item.text,
        source: r.item.source,
        relevance: r.score,
      })),
    };
  },
  {
    name: "search_knowledge",
    description: `搜索 Fezer 的知识库，包括网站内容、项目详情、FAQ 等。
用于回答关于 Fezer 的具体问题，如项目经验、技能详情、网站介绍等。

支持按类别过滤：website、project、faq`,
    schema: z.object({
      query: z.string().describe("搜索查询，支持关键词和自然语言"),
      topK: z.number().optional().default(3).describe("返回结果数量，默认 3"),
      category: z
        .enum(["website", "project", "faq"])
        .optional()
        .describe("按类别过滤：website（网站内容）、project（项目详情）、faq（常见问题）"),
    }),
  }
);

/**
 * 获取项目详情工具
 */
export const getProjectDetailsTool = tool(
  async ({ projectId }) => {
    if (projectId) {
      const project = PROJECT_DETAILS.find(p => p.id === projectId);
      if (project) {
        return {
          project: {
            id: project.id,
            name: project.name,
            description: project.description,
            techStack: project.techStack,
            role: project.role,
            highlights: project.highlights,
          },
        };
      }
      return {
        error: `Project ${projectId} not found`,
        availableProjects: PROJECT_DETAILS.map(p => ({ id: p.id, name: p.name })),
      };
    }

    // 返回所有项目概览
    return {
      projects: PROJECT_DETAILS.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        techStack: p.techStack,
      })),
    };
  },
  {
    name: "get_project_details",
    description: "获取项目详细信息。可以指定项目 ID 或获取所有项目列表。",
    schema: z.object({
      projectId: z
        .string()
        .optional()
        .describe("项目 ID（如 project-1），不指定则返回所有项目列表"),
    }),
  }
);

/**
 * 获取 FAQ 工具
 */
export const getFAQTool = tool(
  async ({ category }) => {
    let faqs = FAQ;

    if (category) {
      faqs = FAQ.filter(f => f.category === category);
    }

    return {
      category: category || "all",
      count: faqs.length,
      faqs: faqs.map(f => ({
        question: f.question,
        answer: f.answer,
        category: f.category,
      })),
    };
  },
  {
    name: "get_faq",
    description: "获取常见问题解答。可以按类别过滤：general、guide、technical、contact",
    schema: z.object({
      category: z
        .enum(["general", "guide", "technical", "contact"])
        .optional()
        .describe("FAQ 类别"),
    }),
  }
);

/**
 * 导出所有 RAG 工具
 */
export async function getRAGTools() {
  return [knowledgeSearchTool, getProjectDetailsTool, getFAQTool];
}
