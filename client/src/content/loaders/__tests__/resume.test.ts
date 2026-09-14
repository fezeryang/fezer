import { describe, expect, it } from "vitest";
import {
  loadResumeSummary,
  parseEducation,
  parseExperience,
  parseGroupedEntries,
  parsePipeEntry,
} from "../resume";

describe("resume summary parsing", () => {
  it("分组列表解析出组名与条目", () => {
    const groups = parseGroupedEntries([
      "AI 与应用 | AI Agent, RAG",
      "数据分析 | Python, SQL",
    ]);

    expect(groups).toEqual([
      { label: "AI 与应用", items: ["AI Agent", "RAG"] },
      { label: "数据分析", items: ["Python", "SQL"] },
    ]);
  });

  it("格式不符的分组条目被丢弃，而不是让页面崩掉", () => {
    const groups = parseGroupedEntries([
      123,
      "没有分隔符",
      "只有组名 |",
      "组 |      ",
      { label: "对象" },
    ]);

    expect(groups).toEqual([]);
  });

  it("管道条目必须恰好 4 段非空", () => {
    expect(parsePipeEntry("a | b | c | d")).toEqual(["a", "b", "c", "d"]);
    expect(parsePipeEntry("a | b | c")).toBeUndefined();
    expect(parsePipeEntry("a | b | c | ")).toBeUndefined();
    expect(parsePipeEntry(42)).toBeUndefined();
  });

  it("经历与教育映射为具名对象", () => {
    expect(
      parseExperience(["AI 产品实习 | 某平台 | 2025.12 - 2026.03 | 描述"])
    ).toEqual([
      {
        position: "AI 产品实习",
        company: "某平台",
        period: "2025.12 - 2026.03",
        description: "描述",
      },
    ]);

    expect(
      parseEducation(["中央财经大学 | 保险专业硕士 | 在读 | 背景"])
    ).toEqual([
      {
        school: "中央财经大学",
        degree: "保险专业硕士",
        period: "在读",
        description: "背景",
      },
    ]);
  });

  it("从真实 profile markdown 读出完整摘要（内容即配置）", () => {
    const summary = loadResumeSummary();

    expect(summary.name).toBe("Fezer");
    expect(summary.title).toContain("AI 产品");
    expect(summary.location).toBe("北京");
    expect(summary.bio.length).toBeGreaterThan(0);

    expect(summary.skillGroups.length).toBeGreaterThanOrEqual(4);
    expect(summary.skillGroups[0].label).toBe("AI 与应用");
    expect(summary.skillGroups[0].items).toContain("RAG");
    expect(summary.skillGroups.flatMap(group => group.items)).toContain(
      "Claude Code"
    );

    expect(summary.interestGroups).toHaveLength(5);
    expect(summary.interestGroups.map(group => group.label)).toContain("旅行");

    expect(summary.experience).toHaveLength(2);
    expect(summary.experience[0].position).toBe("AI 产品实习");

    expect(summary.education).toHaveLength(1);
    expect(summary.education[0].school).toBe("中央财经大学");
  });
});
