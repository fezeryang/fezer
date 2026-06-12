/**
 * Profile Tool - 获取个人简介信息
 * LangChain StructuredTool 实现
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { buildProfileKnowledge } from "./profile-knowledge";

/**
 * getProfile Tool
 * 获取 Fezer 的个人简介、技能和工作经历
 */
export const getProfileTool = tool(
  async ({ includeDetails = false }) => {
    const profile = buildProfileKnowledge();

    return {
      name: profile.name,
      title: profile.title,
      location: profile.location,
      bio: profile.bio,
      identity: profile.identity,
      education: includeDetails ? profile.education : profile.education.slice(0, 1),
      privacyRules: profile.privacyRules,
      answerRules: profile.answerRules,
      skills: includeDetails
        ? profile.skills
        : profile.skills.map(group => ({
            category: group.category,
            items: group.items.length,
          })),
      projectCount: profile.projects.length,
      experienceCount: profile.experiences.length + profile.practices.length,
      experience: includeDetails
        ? [...profile.experiences, ...profile.practices]
        : [...profile.experiences, ...profile.practices].map(exp => ({
            title: exp.title,
            period: exp.period,
            summary: exp.summary,
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
    const profile = buildProfileKnowledge();

    return {
      email: profile.email,
      name: profile.name,
      title: profile.title,
      location: profile.location,
    };
  },
  {
    name: "get_contact_info",
    description: "获取 Fezer 的联系方式（邮箱等）",
    schema: z.object({}),
  }
);
