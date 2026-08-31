/**
 * kinetic-blog-render — Vite plugin that renders blog markdown at
 * dev-transform/build time via a custom `?rendered` glob query.
 *
 * The client (client/src/content/loaders/renderedPosts.ts) imports
 * `../blog/*.md?rendered` and receives a ready `{ html, sections }`
 * module, so shiki/marked/sanitize-html never enter the browser graph.
 *
 * Rendering is deterministic (same input → same output), which keeps
 * HMR stable in dev.
 */
import fs from "node:fs";
import type { Plugin } from "vite";
import {
  ensureHighlighter,
  normalizeFenceLang,
} from "./client/src/content/loaders/highlight";
import {
  renderBlogMarkdown,
  type RenderedMarkdown,
} from "./client/src/content/loaders/markdown";
import { parseFrontmatter } from "./client/src/content/loaders/parser";

export async function renderPostModule(
  raw: string
): Promise<RenderedMarkdown> {
  // Strip frontmatter exactly like posts.ts does, so the rendered body
  // matches the raw-body pipeline. Lenient on files without frontmatter
  // (README.md, _drafts — glob matches them too, client filters them out).
  let body = raw;
  try {
    body = parseFrontmatter(raw, "blog-post.md").content;
  } catch {
    /* no/invalid frontmatter → render the raw file */
  }

  const highlighter = await ensureHighlighter();

  return renderBlogMarkdown(body, {
    highlightCode: (code, lang) => {
      const normalized = normalizeFenceLang(lang);
      if (!normalized) return null;

      return highlighter.codeToHtml(code, {
        lang: normalized,
        theme: "kinetic-paper",
      });
    },
  });
}

export function kineticBlogRender(): Plugin {
  return {
    name: "kinetic-blog-render",
    enforce: "pre",

    async load(id) {
      const [file, query = ""] = id.split("?");
      const params = new URLSearchParams(query);

      if (!params.has("rendered")) return null;
      if (!file.endsWith(".md")) return null;
      if (!file.includes("/content/blog/")) return null;

      const normalized = file.startsWith("\0")
        ? file.slice(1)
        : file;
      const raw = fs.readFileSync(normalized, "utf-8");
      const rendered = await renderPostModule(raw);

      return `export default ${JSON.stringify(rendered)};`;
    },
  };
}
