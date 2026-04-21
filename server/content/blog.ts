/**
 * Blog Content Index
 *
 * 加载和索引博客文章内容
 */

import type { BlogPostIndex } from "./types";
import {
  readMarkdownFile,
  scanMarkdownFiles,
  getContentRootPath,
  parseFrontmatter,
  requireField,
  extractSlugFromPath,
} from "./loader";

/**
 * Blog Post Frontmatter 类型
 */
interface PostFrontmatter {
  title?: string;
  date?: string;
  excerpt?: string;
  summary?: string;
  tags?: string[];
  category?: string;
  slug?: string;
  [key: string]: unknown;
}

/**
 * 规范化 Blog Post 数据
 */
function normalizeBlogPost(raw: string, filePath: string): BlogPostIndex {
  const { data, content } = parseFrontmatter<PostFrontmatter>(raw, filePath);

  const title = requireField<string>(data, "title", filePath);
  const date = requireField<string>(data, "date", filePath);

  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    throw new Error(
      `[${filePath}] Invalid date format: "${date}". Expected ISO 8601 (YYYY-MM-DD).`
    );
  }

  const slug =
    typeof data.slug === "string" && data.slug
      ? data.slug
      : extractSlugFromPath(filePath);

  const excerpt =
    typeof data.excerpt === "string" && data.excerpt
      ? data.excerpt
      : typeof data.summary === "string" && data.summary
        ? data.summary
        : "";

  const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];

  // 构建搜索文本
  const searchableText = [
    title,
    excerpt,
    content,
    ...tags,
    data.category || "",
  ].join("\n");

  return {
    slug,
    title,
    date,
    excerpt,
    tags,
    category: typeof data.category === "string" ? data.category : undefined,
    body: content,
    searchableText,
  };
}

/**
 * 排序：最新的在前
 */
function sortPostsNewestFirst(posts: BlogPostIndex[]): BlogPostIndex[] {
  return posts.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    const dateDiff = dateB - dateA;

    if (dateDiff !== 0) return dateDiff;
    return a.slug.localeCompare(b.slug);
  });
}

/**
 * 加载所有 Blog Posts
 */
export function loadBlogPosts(): BlogPostIndex[] {
  const contentRoot = getContentRootPath();
  const blogFiles = scanMarkdownFiles(contentRoot, "blog");

  const posts: BlogPostIndex[] = [];

  for (const filePath of blogFiles) {
    try {
      const raw = readMarkdownFile(contentRoot, filePath);
      posts.push(normalizeBlogPost(raw, filePath));
    } catch (error) {
      console.error(`Failed to load blog post: ${filePath}`, error);
    }
  }

  return sortPostsNewestFirst(posts);
}

/**
 * 根据 slug 获取 Blog Post
 */
export function getBlogPostBySlug(slug: string): BlogPostIndex | undefined {
  const posts = loadBlogPosts();
  return posts.find(post => post.slug === slug);
}

/**
 * 根据分类获取 Blog Posts
 */
export function getBlogPostsByCategory(category: string): BlogPostIndex[] {
  const posts = loadBlogPosts();
  return posts.filter(post => post.category === category);
}

/**
 * 根据标签获取 Blog Posts
 */
export function getBlogPostsByTag(tag: string): BlogPostIndex[] {
  const posts = loadBlogPosts();
  return posts.filter(post => post.tags.includes(tag));
}
