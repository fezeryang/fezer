/**
 * Pre-rendered blog posts. The `?rendered` query is answered by the
 * kineticBlogRender Vite plugin (build/blog-markdown.ts), which runs the
 * markdown + shiki pipeline in Node — so this module's payload carries
 * highlighted HTML and no renderer code reaches the client.
 *
 * The raw-body glob in posts.ts stays untouched: list pages, Home and
 * admin still read raw markdown for excerpts and editing.
 */
import type { RenderedMarkdown } from "./markdown";
import { extractSlugFromPath } from "./parser";

const renderedModules = import.meta.glob("../blog/*.md", {
  eager: true,
  query: "?rendered",
  import: "default",
}) as Record<string, RenderedMarkdown>;

export function getRenderedPost(
  slug: string
): RenderedMarkdown | undefined {
  for (const [path, rendered] of Object.entries(renderedModules)) {
    const filename = path.split("/").pop() ?? "";
    if (filename.startsWith("_") || filename === "README.md") continue;
    if (extractSlugFromPath(path) === slug) return rendered;
  }

  return undefined;
}
