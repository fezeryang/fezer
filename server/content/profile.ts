/**
 * Profile Content Index
 *
 * 加载和索引个人资料内容
 */

import type { ProfileIndex } from "./types";
import {
  readMarkdownFile,
  scanMarkdownFiles,
  getContentRootPath,
  parseFrontmatter,
  requireField,
  extractSlugFromPath,
} from "./loader";

/**
 * Profile Frontmatter 类型
 */
interface ProfileFrontmatter {
  name?: string;
  bio?: string;
  locale?: string;
  avatar?: string;
  skills?: string[];
  projects?: Array<{ name: string; url: string }>;
  contact?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * 从文件路径提取 locale
 */
function extractLocaleFromPath(filePath: string): string | null {
  const filename = filePath.split("/").pop() ?? "";
  const match = filename.match(/\.([a-z]{2}-[A-Z]{2})\.md$/);
  return match ? match[1] : null;
}

/**
 * 规范化 Profile 数据
 */
function normalizeProfile(raw: string, filePath: string): ProfileIndex {
  const { data, content } = parseFrontmatter<ProfileFrontmatter>(raw, filePath);

  const name = requireField<string>(data, "name", filePath);
  const bio = requireField<string>(data, "bio", filePath);

  const frontmatterLocale =
    typeof data.locale === "string" ? data.locale : null;
  const pathLocale = extractLocaleFromPath(filePath);
  const locale = frontmatterLocale ?? pathLocale;

  if (!locale) {
    throw new Error(
      `[${filePath}] Missing required field: "locale". Specify in frontmatter or use filename pattern: {name}.{locale}.md`
    );
  }

  const skills = Array.isArray(data.skills) ? data.skills.map(String) : [];

  const projects = Array.isArray(data.projects)
    ? data.projects.filter(
        (p): p is { name: string; url: string } =>
          typeof p === "object" &&
          p !== null &&
          typeof (p as Record<string, unknown>).name === "string" &&
          typeof (p as Record<string, unknown>).url === "string"
      )
    : [];

  const contact =
    typeof data.contact === "object" &&
    data.contact !== null &&
    !Array.isArray(data.contact)
      ? (data.contact as Record<string, string>)
      : {};

  // 构建搜索文本
  const searchableText = [
    name,
    bio,
    content,
    ...skills,
    ...projects.map(p => `${p.name} ${p.url}`),
    Object.entries(contact).map(([k, v]) => `${k} ${v}`),
  ].join("\n");

  return {
    name,
    bio,
    locale,
    avatar: typeof data.avatar === "string" ? data.avatar : undefined,
    skills,
    projects,
    contact,
    body: content,
    searchableText,
  };
}

/**
 * 加载所有 Profile
 */
export function loadProfiles(): ProfileIndex[] {
  const contentRoot = getContentRootPath();
  const profileFiles = scanMarkdownFiles(contentRoot, "profile");

  const profiles: ProfileIndex[] = [];

  for (const filePath of profileFiles) {
    try {
      const raw = readMarkdownFile(contentRoot, filePath);
      profiles.push(normalizeProfile(raw, filePath));
    } catch (error) {
      console.error(`Failed to load profile: ${filePath}`, error);
    }
  }

  return profiles;
}

/**
 * 根据 locale 加载 Profile
 */
export function loadProfile(locale: string): ProfileIndex | undefined {
  const profiles = loadProfiles();
  return profiles.find(p => p.locale === locale);
}

/**
 * 获取默认 Profile (zh-CN)
 */
export function getDefaultProfile(): ProfileIndex | undefined {
  const profiles = loadProfiles();
  return profiles.find(p => p.locale === "zh-CN") ?? profiles[0];
}
