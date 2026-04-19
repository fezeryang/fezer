/**
 * Projects Tool - 获取项目信息
 * LangChain StructuredTool 实现
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { EXPERIENCE } from "@fezer/shared/resume/profile";

/**
 * getProjects Tool
 * 根据主题或类型获取项目/工作经历
 */
export const getProjectsTool = tool(
  async ({ category, limit = 5 }) => {
    let results = EXPERIENCE;

    // 按类别过滤
    if (category && category !== "all") {
      const categoryLower = category.toLowerCase();
      results = results.filter(exp => {
        const content = `${exp.company} ${exp.position} ${exp.description}`.toLowerCase();
        return (
          content.includes(categoryLower) ||
          exp.position.toLowerCase().includes(categoryLower)
        );
      });
    }

    // 限制数量
    const limited = results.slice(0, limit);

    return {
      category: category || "all",
      count: limited.length,
      projects: limited.map(exp => ({
        company: exp.company,
        position: exp.position,
        period: exp.period,
        description: exp.description,
        highlights: exp.highlights || [],
      })),
    };
  },
  {
    name: "get_projects",
    description:
      "获取 Fezer 的项目和工作经历。可以按类别过滤，如 'frontend'、'backend'、'ai'、'fullstack' 等。",
    schema: z.object({
      category: z
        .enum(["frontend", "backend", "ai", "fullstack", "all"])
        .optional()
        .default("all")
        .describe("项目类别"),
      limit: z
        .number()
        .optional()
        .default(5)
        .describe("返回的最大项目数量"),
    }),
  }
);

/**
 * getProjectByIndex Tool
 * 按索引获取特定项目
 */
export const getProjectByIndexTool = tool(
  async ({ index }) => {
    const idx = parseInt(String(index));
    if (idx < 0 || idx >= EXPERIENCE.length) {
      throw new Error(`Invalid index: ${index}. Valid range is 0-${EXPERIENCE.length - 1}`);
    }

    const exp = EXPERIENCE[idx];
    return {
      index: idx,
      company: exp.company,
      position: exp.position,
      period: exp.period,
      description: exp.description,
      highlights: exp.highlights || [],
    };
  },
  {
    name: "get_project_by_index",
    description: "获取指定索引的项目详情。索引从 0 开始。",
    schema: z.object({
      index: z.number().describe("项目索引（0 开始）"),
    }),
  }
);
