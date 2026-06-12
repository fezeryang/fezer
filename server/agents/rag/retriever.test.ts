import { describe, expect, it } from "vitest";
import { knowledgeSearchTool } from "./retriever";

describe("knowledgeSearchTool", () => {
  it("returns website content when filtering by website category", async () => {
    const result = await knowledgeSearchTool.invoke({
      query: "3D 简历",
      category: "website",
      topK: 3,
    });

    expect(result.count).toBeGreaterThan(0);
    expect(result.matches.every(match => match.source !== "project")).toBe(
      true
    );
  });

  it("returns project content when filtering by project category", async () => {
    const result = await knowledgeSearchTool.invoke({
      query: "期权",
      category: "project",
      topK: 3,
    });

    expect(result.count).toBeGreaterThan(0);
    expect(result.matches.every(match => match.source === "project")).toBe(
      true
    );
  });

  it("returns the real public profile instead of template resume data", async () => {
    const result = await knowledgeSearchTool.invoke({
      query: "中央财经大学 保险专业硕士",
      category: "profile",
      topK: 3,
    });

    expect(result.count).toBeGreaterThan(0);
    expect(JSON.stringify(result)).toContain("AI 产品与 Agent 工作流实践者");
    expect(JSON.stringify(result)).not.toContain("fezer@example.com");
    expect(JSON.stringify(result)).not.toContain("某科技公司");
  });
});
