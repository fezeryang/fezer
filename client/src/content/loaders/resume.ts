/**
 * 简历摘要加载器（C11）
 *
 * 3D 简历 UI 的技能分组、兴趣分组与经历直接从 profile markdown 的 frontmatter 读取，
 * 改内容只改 markdown，不再需要改代码、重新构建 TS 常量。
 *
 * frontmatter 格式约定（见 profile 文件内注释）：
 * - 分组列表："分组名 | 逗号分隔的条目"
 * - 经历/教育："字段1 | 字段2 | 字段3 | 描述"
 * 格式不符的条目会被静默丢弃，而不是让整页崩掉。
 */

import { parseFrontmatter } from "./parser";

const rawProfiles = import.meta.glob("../profile/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

export interface ResumeGroup {
  label: string;
  items: string[];
}

export interface ResumeExperience {
  position: string;
  company: string;
  period: string;
  description: string;
}

export interface ResumeEducation {
  school: string;
  degree: string;
  period: string;
  description: string;
}

export interface ResumeSummary {
  name: string;
  title: string;
  location: string;
  bio: string;
  skillGroups: ResumeGroup[];
  interestGroups: ResumeGroup[];
  experience: ResumeExperience[];
  education: ResumeEducation[];
}

/** "分组名 | a, b, c" → { label, items }；格式不符的条目被丢弃 */
export function parseGroupedEntries(entries: unknown): ResumeGroup[] {
  if (!Array.isArray(entries)) {
    return [];
  }

  const groups: ResumeGroup[] = [];

  for (const entry of entries) {
    if (typeof entry !== "string") continue;

    const separatorIndex = entry.indexOf("|");
    if (separatorIndex === -1) continue;

    const label = entry.slice(0, separatorIndex).trim();
    const items = entry
      .slice(separatorIndex + 1)
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);

    if (!label || items.length === 0) continue;

    groups.push({ label, items });
  }

  return groups;
}

/** "a | b | c | d" → 恰好 4 段非空字段；否则 undefined */
export function parsePipeEntry(entry: unknown): string[] | undefined {
  if (typeof entry !== "string") {
    return undefined;
  }

  const parts = entry.split("|").map(part => part.trim());
  if (parts.length !== 4 || parts.some(part => part.length === 0)) {
    return undefined;
  }

  return parts;
}

export function parseExperience(entries: unknown): ResumeExperience[] {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.flatMap(entry => {
    const parts = parsePipeEntry(entry);
    if (!parts) return [];
    return [
      {
        position: parts[0],
        company: parts[1],
        period: parts[2],
        description: parts[3],
      },
    ];
  });
}

export function parseEducation(entries: unknown): ResumeEducation[] {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.flatMap(entry => {
    const parts = parsePipeEntry(entry);
    if (!parts) return [];
    return [
      {
        school: parts[0],
        degree: parts[1],
        period: parts[2],
        description: parts[3],
      },
    ];
  });
}

function localeFromPath(filePath: string): string | null {
  const match = filePath.match(/\.([A-Za-z-]+)\.md$/);
  return match ? match[1] : null;
}

function readString(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  return typeof value === "string" ? value : "";
}

export function loadResumeSummary(locale = "zh-CN"): ResumeSummary {
  const match = Object.entries(rawProfiles).find(
    ([filePath]) => localeFromPath(filePath) === locale
  );

  if (!match) {
    throw new Error(`Resume profile markdown not found for locale: ${locale}`);
  }

  const [filePath, raw] = match;
  const { data } = parseFrontmatter<Record<string, unknown>>(raw, filePath);

  return {
    name: readString(data, "name") || "Fezer",
    title: readString(data, "title"),
    location: readString(data, "location"),
    bio: readString(data, "bio"),
    skillGroups: parseGroupedEntries(data.skillsGrouped),
    interestGroups: parseGroupedEntries(data.interestsGrouped),
    experience: parseExperience(data.experience),
    education: parseEducation(data.education),
  };
}
