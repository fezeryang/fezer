/**
 * Works Content Index
 *
 * 加载和索引作品集内容
 */

import type { WorkIndex } from "./types";
import {
  readMarkdownFile,
  scanMarkdownFiles,
  getContentRootPath,
  parseFrontmatter,
  requireField,
  extractSlugFromPath,
} from "./loader";

/**
 * Works Frontmatter 类型
 */
interface WorkFrontmatter {
  title?: string;
  description?: string;
  summary?: string;
  date?: string;
  tags?: string[];
  technologies?: string;
  link?: string;
  imageUrl?: string;
  slug?: string;
  [key: string]: unknown;
}

/**
 * 规范化 Work 数据
 */
function normalizeWork(raw: string, filePath: string): WorkIndex {
  const { data, content } = parseFrontmatter<WorkFrontmatter>(raw, filePath);

  const title = requireField<string>(data, "title", filePath);

  const description =
    typeof data.description === "string" && data.description
      ? data.description
      : typeof data.summary === "string" && data.summary
        ? data.summary
        : "";

  if (!description) {
    throw new Error(
      `[${filePath}] Missing required field: "description" (or "summary" as alternative)`
    );
  }

  const slug =
    typeof data.slug === "string" && data.slug
      ? data.slug
      : extractSlugFromPath(filePath);

  const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];

  const date =
    typeof data.date === "string" && data.date ? data.date : undefined;

  // 构建搜索文本
  const searchableText = [
    title,
    description,
    content,
    ...tags,
    data.technologies || "",
  ].join("\n");

  return {
    slug,
    title,
    description,
    date,
    tags,
    technologies:
      typeof data.technologies === "string" ? data.technologies : undefined,
    link: typeof data.link === "string" ? data.link : undefined,
    imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : undefined,
    body: content,
    searchableText,
  };
}

/**
 * 排序：最新的在前
 */
function sortWorksNewestFirst(works: WorkIndex[]): WorkIndex[] {
  return works.sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    const dateDiff = dateB - dateA;

    if (dateDiff !== 0) return dateDiff;
    return a.slug.localeCompare(b.slug);
  });
}

/**
 * 加载所有 Works
 */
export function loadWorks(): WorkIndex[] {
  const contentRoot = getContentRootPath();
  const workFiles = scanMarkdownFiles(contentRoot, "works");

  const works: WorkIndex[] = [];

  for (const filePath of workFiles) {
    try {
      const raw = readMarkdownFile(contentRoot, filePath);
      works.push(normalizeWork(raw, filePath));
    } catch (error) {
      console.error(`Failed to load work: ${filePath}`, error);
    }
  }

  return sortWorksNewestFirst(works);
}

/**
 * 根据 slug 获取 Work
 */
export function getWorkBySlug(slug: string): WorkIndex | undefined {
  const works = loadWorks();
  return works.find(work => work.slug === slug);
}
