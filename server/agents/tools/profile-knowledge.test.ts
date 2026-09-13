import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildProfileKnowledge } from "./profile-knowledge";
import { getProfileTool } from "./profile.tool";
import { getProjectsTool } from "./projects.tool";
import { getSkillsTool } from "./skills.tool";

/**
 * 公开资料里唯一允许出现的邮箱。
 */
const PUBLIC_EMAIL = "cookfezer@gmail.com";

/**
 * 本机私密事实清单（名字、手机号、私人邮箱、公司名）。
 *
 * ⚠️ 为什么不写在这个文件里：仓库是公开的。曾经把真实姓名 / 手机号 / 私人邮箱
 * 直接写成字面量放在这里——守卫本身是对的，但把要保护的东西发表了。
 * 清单因此移到 `private-facts.local.json`（已在 .gitignore 中），本机存在就会被加载。
 *
 * 没有这个文件时（CI、别人的机器）仍有下面 `expectNoStructuralLeaks` 的
 * 结构化拦截兜底：任何手机号 / 身份证号 / 非公开邮箱都会失败，
 * 不依赖是否知道具体值。
 */
function loadLocalFacts(): string[] {
  const file = path.resolve("server/agents/tools/private-facts.local.json");
  if (!fs.existsSync(file)) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(parsed)
      ? parsed.filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0
        )
      : [];
  } catch {
    return [];
  }
}

const LOCAL_PRIVATE_FACTS = loadLocalFacts();

function stringify(value: unknown): string {
  return JSON.stringify(value);
}

/** 结构化 PII 拦截：始终生效，不依赖任何字面量清单。 */
function expectNoStructuralLeaks(value: unknown): void {
  const text = stringify(value);

  expect(text).not.toMatch(/\b1[3-9]\d{9}\b/);
  expect(text).not.toMatch(/\b\d{17}[\dXx]\b/);

  const emails = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? [];
  expect(emails.filter(email => email !== PUBLIC_EMAIL)).toEqual([]);
}

function expectNoForbiddenFacts(value: unknown): void {
  expectNoStructuralLeaks(value);

  const text = stringify(value);
  for (const forbidden of LOCAL_PRIVATE_FACTS) {
    expect(text).not.toContain(forbidden);
  }
}

describe("profile knowledge", () => {
  it("builds the public profile from structured markdown without private facts", () => {
    const profile = buildProfileKnowledge();

    expect(profile.name).toBe("Fezer");
    expect(profile.email).toBe(PUBLIC_EMAIL);
    expect(profile.title).toContain("AI 产品");
    expect(profile.identity.join("\n")).toContain("Agent 工作流实践者");
    expect(profile.education.join("\n")).toContain("中央财经大学保险专业硕士");
    expect(profile.education.join("\n")).not.toContain("劳动与社会保障");
    expect(profile.projects.map(project => project.name)).toContain(
      "AI 驱动的期权交易分析平台"
    );
    expect(profile.experiences.map(exp => exp.title)).toContain(
      "AI 产品实习经历"
    );
    expectNoForbiddenFacts(profile);
  });

  it("profile tool exposes only public identity data", async () => {
    const profile = await getProfileTool.invoke({ includeDetails: true });

    expect(profile.name).toBe("Fezer");
    expect(stringify(profile)).toContain("中央财经大学保险专业硕士");
    expectNoForbiddenFacts(profile);
  });

  it("skills and projects tools read from the structured public profile", async () => {
    const skills = await getSkillsTool.invoke({ category: "all" });
    const projects = await getProjectsTool.invoke({ category: "ai", limit: 5 });

    expect(stringify(skills)).toContain("工具编排");
    expect(stringify(projects)).toContain("智能客服 Agent 系统");
    expect(stringify(projects)).toContain("AI 模拟面试官系统");
    expectNoForbiddenFacts(skills);
    expectNoForbiddenFacts(projects);
  });
});
