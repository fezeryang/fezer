/**
 * Projects Tool - 获取项目信息
 * LangChain StructuredTool 实现
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { buildProfileKnowledge, matchesCategory } from "./profile-knowledge";

/**
 * getProjects Tool
 * 根据主题或类型获取项目/工作经历
 */
export const getProjectsTool = tool(
  async ({ category, limit = 5 }) => {
    const profile = buildProfileKnowledge();
    let results = profile.projects;

    if (category && category !== "all") {
      results = results.filter(project => matchesCategory(project.categories, category));
    }

    const limited = results.slice(0, limit);

    return {
      category: category || "all",
      count: limited.length,
      projects: limited.map(exp => ({
        name: exp.name,
        period: exp.period,
        summary: exp.summary,
        techStack: exp.techStack,
        categories: exp.categories,
        highlights: exp.highlights,
      })),
      experiences: [...profile.experiences, ...profile.practices].map(exp => ({
        title: exp.title,
        period: exp.period,
        summary: exp.summary,
        categories: exp.categories,
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
    const profile = buildProfileKnowledge();
    const idx = parseInt(String(index));
    if (idx < 0 || idx >= profile.projects.length) {
      throw new Error(`Invalid index: ${index}. Valid range is 0-${profile.projects.length - 1}`);
    }

    const project = profile.projects[idx];
    return {
      index: idx,
      name: project.name,
      period: project.period,
      summary: project.summary,
      techStack: project.techStack,
      categories: project.categories,
      highlights: project.highlights,
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
