/**
 * 对话导出（C10）
 *
 * 求职场景下访客常想把「和这位 agent 聊过什么」留存/转发，所以导出成
 * Markdown：标题、时间、逐条消息（含回答 agent 的显示名）。纯函数，便于测试。
 */

import { AGENT_DISPLAY_NAMES } from "@fezer/shared/characters";
import type { FezerType } from "@fezer/shared/schemas/character";

export interface ExportableMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
  agentId?: FezerType;
}

export interface ConversationExportMeta {
  /** 房间/场景名，用于文件标题 */
  roomName?: string;
  /** 导出时间（默认取当前时间） */
  exportedAt?: Date;
}

function formatTime(timestamp?: number): string | null {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(11, 16);
}

export function buildConversationMarkdown(
  messages: ExportableMessage[],
  meta: ConversationExportMeta = {}
): string {
  const exportedAt = meta.exportedAt ?? new Date();
  const title = meta.roomName
    ? `与 Fezer 的对话 · ${meta.roomName}`
    : "与 Fezer 的对话";

  const lines: string[] = [
    `# ${title}`,
    "",
    `> 导出自 3D 互动简历 · ${exportedAt.toISOString().slice(0, 16).replace("T", " ")}`,
    "",
  ];

  for (const message of messages) {
    const content = message.content.trim();
    if (!content) continue;

    const time = formatTime(message.timestamp);
    const timeSuffix = time ? `（${time}）` : "";

    if (message.role === "user") {
      lines.push(`## 访客${timeSuffix}`, "", content, "");
      continue;
    }

    const agentName = message.agentId
      ? (AGENT_DISPLAY_NAMES[message.agentId] ?? "Fezer")
      : "Fezer";
    lines.push(`## ${agentName}${timeSuffix}`, "", content, "");
  }

  return lines.join("\n").trimEnd() + "\n";
}

/** 触发浏览器下载（客户端专用） */
export function downloadMarkdown(filename: string, markdown: string): void {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
