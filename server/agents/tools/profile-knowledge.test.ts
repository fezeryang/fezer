import { describe, expect, it } from "vitest";
import { buildProfileKnowledge } from "./profile-knowledge";
import { getContactInfoTool, getProfileTool } from "./profile.tool";
import { getProjectsTool } from "./projects.tool";
import { getSkillsTool } from "./skills.tool";

const FORBIDDEN_PUBLIC_FACTS = [
  "懈小阳",
  "13551659971",
  "xxyzycj@163.com",
  "北京青云智慧科技发展有限公司",
  "杭州酸果科技有限公司",
  "Masterland",
  "某科技公司",
  "fezer@example.com",
  "性能 40%",
  "企业级前端应用",
];

function stringify(value: unknown): string {
  return JSON.stringify(value);
}

function expectNoForbiddenFacts(value: unknown) {
  const text = stringify(value);
  for (const forbidden of FORBIDDEN_PUBLIC_FACTS) {
    expect(text).not.toContain(forbidden);
  }
}

describe("profile knowledge", () => {
  it("builds the public profile from structured markdown without private facts", () => {
    const profile = buildProfileKnowledge();

    expect(profile.name).toBe("Fezer");
    expect(profile.email).toBe("cookfezer@gmail.com");
    expect(profile.title).toContain("AI 产品");
    expect(profile.identity.join("\n")).toContain("Agent 工作流实践者");
    expect(profile.education.join("\n")).toContain("中央财经大学保险专业硕士");
    expect(profile.education.join("\n")).not.toContain("劳动与社会保障");
    expect(profile.projects.map(project => project.name)).toContain(
      "AI 驱动的期权交易分析平台"
    );
    expect(profile.experiences.map(exp => exp.title)).toContain("AI 产品实习经历");
    expectNoForbiddenFacts(profile);
  });

  it("profile and contact tools expose only public identity data", async () => {
    const profile = await getProfileTool.invoke({ includeDetails: true });
    const contact = await getContactInfoTool.invoke({});

    expect(profile.name).toBe("Fezer");
    expect(contact.email).toBe("cookfezer@gmail.com");
    expect(stringify(profile)).toContain("中央财经大学保险专业硕士");
    expectNoForbiddenFacts(profile);
    expectNoForbiddenFacts(contact);
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
