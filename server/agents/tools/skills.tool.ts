/**
 * Skills Tool - 获取技能信息
 * LangChain StructuredTool 实现
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { buildProfileKnowledge } from "./profile-knowledge";

/**
 * getSkills Tool
 * 获取技能列表
 */
export const getSkillsTool = tool(
  async ({ category }) => {
    const profile = buildProfileKnowledge();
    const skillGroups = profile.skills;

    if (category && category !== "all") {
      const matchedGroup = skillGroups.find(group =>
        group.category.toLowerCase().includes(category.toLowerCase())
      );

      if (matchedGroup) {
        return {
          category: matchedGroup.category,
          skills: matchedGroup.items,
        };
      }
    }

    // 返回所有技能概览
    return {
      categories: skillGroups.map(group => group.category),
      skills: Object.fromEntries(
        skillGroups.map(group => [group.category, group.items])
      ),
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
    const profile = buildProfileKnowledge();
    const skillLower = skill.toLowerCase();
    const matches: string[] = [];

    for (const group of profile.skills) {
      for (const item of group.items) {
        if (item.toLowerCase().includes(skillLower)) {
          matches.push(`${group.category}: ${item}`);
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
    const profile = buildProfileKnowledge();
    const interestGroups = profile.interests;

    if (category && category !== "all") {
      const matchedGroup = interestGroups.find(group =>
        group.category.toLowerCase().includes(category.toLowerCase())
      );

      if (matchedGroup) {
        return {
          category: matchedGroup.category,
          interests: matchedGroup.items,
        };
      }
    }

    return {
      categories: interestGroups.map(group => group.category),
      interests: Object.fromEntries(
        interestGroups.map(group => [group.category, group.items])
      ),
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
