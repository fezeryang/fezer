/**
 * Skills Tool - 获取技能信息
 * LangChain StructuredTool 实现
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SKILLS, INTERESTS } from "@fezer/shared/resume/profile";

/**
 * getSkills Tool
 * 获取技能列表
 */
export const getSkillsTool = tool(
  async ({ category }) => {
    if (category && category !== "all") {
      const categoryKey = category as keyof typeof SKILLS;
      if (categoryKey in SKILLS) {
        return {
          category,
          skills: SKILLS[categoryKey],
        };
      }
      // 尝试模糊匹配
      const matchedKey = Object.keys(SKILLS).find(key =>
        key.toLowerCase().includes(category.toLowerCase())
      ) as keyof typeof SKILLS;
      if (matchedKey) {
        return {
          category: matchedKey,
          skills: SKILLS[matchedKey],
        };
      }
    }

    // 返回所有技能概览
    return {
      categories: Object.keys(SKILLS),
      skills: SKILLS,
    };
  },
  {
    name: "get_skills",
    description:
      "获取 Fezer 的技能列表。可以按类别查询：frontend、backend、ai、tools、design、soft",
    schema: z.object({
      category: z
        .enum(["frontend", "backend", "ai", "tools", "design", "soft", "all"])
        .optional()
        .default("all")
        .describe("技能类别"),
    }),
  }
);

/**
 * hasSkill Tool
 * 检查是否具备某项技能
 */
export const hasSkillTool = tool(
  async ({ skill }) => {
    const skillLower = skill.toLowerCase();
    const matches: string[] = [];

    for (const [category, items] of Object.entries(SKILLS)) {
      for (const item of items) {
        if (item.toLowerCase().includes(skillLower)) {
          matches.push(`${category}: ${item}`);
        }
      }
    }

    return {
      skill,
      hasSkill: matches.length > 0,
      matches,
      count: matches.length,
    };
  },
  {
    name: "has_skill",
    description: "检查 Fezer 是否具备某项特定技能。支持模糊匹配。",
    schema: z.object({
      skill: z.string().describe("要检查的技能名称"),
    }),
  }
);

/**
 * getInterests Tool
 * 获取兴趣爱好
 */
export const getInterestsTool = tool(
  async ({ category }) => {
    if (category && category !== "all") {
      const categoryKey = category as keyof typeof INTERESTS;
      if (categoryKey in INTERESTS) {
        return {
          category,
          interests: INTERESTS[categoryKey],
        };
      }
    }

    return {
      categories: Object.keys(INTERESTS),
      interests: INTERESTS,
    };
  },
  {
    name: "get_interests",
    description:
      "获取 Fezer 的兴趣爱好。可以按类别查询：reading、writing、design、travel、ai",
    schema: z.object({
      category: z
        .enum(["reading", "writing", "design", "travel", "ai", "all"])
        .optional()
        .default("all")
        .describe("兴趣类别"),
    }),
  }
);
