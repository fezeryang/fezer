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
      query: "LangGraph",
      category: "project",
      topK: 3,
    });

    expect(result.count).toBeGreaterThan(0);
    expect(result.matches.every(match => match.source === "project")).toBe(
      true
    );
  });
});
