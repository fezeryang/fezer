/**
 * Profile Tool - 获取个人简介信息
 * LangChain StructuredTool 实现
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { PROFILE, SKILLS, EXPERIENCE } from "@fezer/shared/resume/profile";

/**
 * getProfile Tool
 * 获取 Fezer 的个人简介、技能和工作经历
 */
export const getProfileTool = tool(
  async ({ includeDetails = false }) => {
    return {
      name: PROFILE.name,
      title: PROFILE.title,
      location: PROFILE.location,
      bio: PROFILE.bio,
      skills: includeDetails
        ? SKILLS
        : Object.keys(SKILLS).map(category => ({
            category,
            items: (SKILLS as any)[category].length,
          })),
      experienceCount: EXPERIENCE.length,
      experience: includeDetails
        ? EXPERIENCE.map(exp => ({
            company: exp.company,
            position: exp.position,
            period: exp.period,
            description: exp.description,
          }))
        : EXPERIENCE.map(exp => ({
            company: exp.company,
            position: exp.position,
            period: exp.period,
          })),
    };
  },
  {
    name: "get_profile",
    description:
      "获取 Fezer 的个人简介、技能和工作经历概览。用于回答关于 Fezer 是谁、会什么、做过什么的问题。",
    schema: z.object({
      includeDetails: z
        .boolean()
        .optional()
        .default(false)
        .describe("是否包含完整的技能列表和工作经历详情"),
    }),
  }
);

/**
 * getContactInfo Tool
 * 获取联系方式
 */
export const getContactInfoTool = tool(
  async () => {
    return {
      email: PROFILE.email,
      name: PROFILE.name,
      title: PROFILE.title,
    };
  },
  {
    name: "get_contact_info",
    description: "获取 Fezer 的联系方式（邮箱等）",
    schema: z.object({}),
  }
);
