import type { Post, PostFrontmatter } from "./types";
import { parseFrontmatter, requireField, extractSlugFromPath } from "./parser";

const rawPosts = import.meta.glob("../blog/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

function normalizePost(raw: string, filePath: string): Post {
  const { data, content } = parseFrontmatter<PostFrontmatter>(raw, filePath);

  const title = requireField<string>(data, "title", filePath);
  const date = requireField<string>(data, "date", filePath);

  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    throw new Error(`[${filePath}] Invalid date format: "${date}". Expected ISO 8601 (YYYY-MM-DD).`);
  }

  const slug = typeof data.slug === "string" && data.slug
    ? data.slug
    : extractSlugFromPath(filePath);

  const excerpt = typeof data.excerpt === "string" && data.excerpt
    ? data.excerpt
    : typeof data.summary === "string" && data.summary
      ? data.summary
      : "";

  const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];

  return {
    slug,
    title,
    date,
    excerpt,
    tags,
    category: typeof data.category === "string" ? data.category : undefined,
    body: content,
  };
}

function sortPostsNewestFirst(posts: Post[]): Post[] {
  return posts.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    const dateDiff = dateB - dateA;

    if (dateDiff !== 0) return dateDiff;
    return a.slug.localeCompare(b.slug);
  });
}

export function loadPosts(): Post[] {
  const posts: Post[] = [];

  for (const [path, raw] of Object.entries(rawPosts)) {
    const filename = path.split("/").pop() ?? "";
    if (filename.startsWith("_") || filename === "README.md") continue;
    posts.push(normalizePost(raw, path));
  }

  return sortPostsNewestFirst(posts);
}

export function getPostBySlug(slug: string): Post | undefined {
  return loadPosts().find((post) => post.slug === slug);
}
