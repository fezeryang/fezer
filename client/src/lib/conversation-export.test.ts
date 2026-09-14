import { describe, expect, it } from "vitest";
import { buildConversationMarkdown } from "./conversation-export";

const EXPORTED_AT = new Date(Date.UTC(2026, 8, 14, 8, 0));

describe("conversation export", () => {
  it("渲染标题、导出时间与逐条消息（含 agent 显示名）", () => {
    const markdown = buildConversationMarkdown(
      [
        {
          role: "user",
          content: "你做过什么项目？",
          timestamp: Date.UTC(2026, 8, 14, 7, 5),
        },
        {
          role: "assistant",
          content: "我做过多模态内容平台。",
          timestamp: Date.UTC(2026, 8, 14, 7, 6),
          agentId: "builder",
        },
      ],
      { roomName: "Builder Room", exportedAt: EXPORTED_AT }
    );

    expect(markdown).toContain("# 与 Fezer 的对话 · Builder Room");
    expect(markdown).toContain("2026-09-14 08:00");
    expect(markdown).toContain("## 访客（07:05）");
    expect(markdown).toContain("你做过什么项目？");
    expect(markdown).toContain("我做过多模态内容平台。");
    // 用用户可见显示名，不泄漏内部英文 agent id
    expect(markdown).toContain("Builder");
    expect(markdown).not.toContain("agentId");
  });

  it("没有房间名时用默认标题", () => {
    const markdown = buildConversationMarkdown(
      [{ role: "user", content: "你好" }],
      { exportedAt: EXPORTED_AT }
    );

    expect(markdown.startsWith("# 与 Fezer 的对话\n")).toBe(true);
  });

  it("空消息被跳过，不产生空标题", () => {
    const markdown = buildConversationMarkdown(
      [
        { role: "user", content: "   " },
        { role: "assistant", content: "有效回答" },
      ],
      { exportedAt: EXPORTED_AT }
    );

    expect(markdown).not.toContain("## 访客");
    expect(markdown).toContain("有效回答");
  });

  it("没有 agentId 的助手消息回退到 Fezer", () => {
    const markdown = buildConversationMarkdown(
      [{ role: "assistant", content: "回答" }],
      { exportedAt: EXPORTED_AT }
    );

    expect(markdown).toContain("## Fezer");
  });
});
