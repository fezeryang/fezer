import { Marked, type Tokens } from "marked";
import sanitizeHtml from "sanitize-html";

export interface TocSection {
  id: string;
  label: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
}

export interface RenderedMarkdown {
  html: string;
  sections: TocSection[];
}

/**
 * Strip inline markdown while keeping the readable text, e.g. for TOC labels
 * and heading slugs. Single `*`/`_` are kept so snake_case words survive.
 */
export function stripInlineMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|~~|`)/g, "")
    .trim();
}

/**
 * Heading text → URL-safe id. Whitespace and punctuation (including CJK
 * punctuation, which `\p{P}` covers) collapse to `-`; letters — including
 * CJK — are kept, so Chinese headings keep readable ids like
 * `一-背景-为什么要在远端部署-ollama`. Symbol-only headings return "".
 */
export function slugifyHeadingText(text: string): string {
  return stripInlineMarkdown(text)
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Render a blog post body to sanitized HTML while collecting its headings
 * as TOC sections. The ids in the HTML and in `sections` come from the same
 * renderer pass, so they can never drift apart.
 *
 * Uses a private Marked instance — the global `marked` singleton is shared
 * with other pages (e.g. About), so heading-id injection must not leak.
 */
export function renderBlogMarkdown(body: string): RenderedMarkdown {
  const sections: TocSection[] = [];
  const usedIds = new Map<string, number>();

  const md = new Marked();
  md.use({
    renderer: {
      heading(token: Tokens.Heading) {
        const inner = this.parser.parseInline(token.tokens);
        const plain = stripInlineMarkdown(token.text);

        let id = slugifyHeadingText(plain);
        if (!id) id = `h-${token.depth}-${sections.length + 1}`;

        const seen = usedIds.get(id) ?? 0;
        usedIds.set(id, seen + 1);
        if (seen > 0) id = `${id}-${seen}`;

        sections.push({
          id,
          label: plain || `H${token.depth}`,
          level: token.depth as TocSection["level"],
        });

        return `<h${token.depth} id="${id}">${inner}</h${token.depth}>`;
      },
    },
  });

  const html = sanitizeHtml(md.parse(body) as string, {
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      h1: ["id"],
      h2: ["id"],
      h3: ["id"],
      h4: ["id"],
      h5: ["id"],
      h6: ["id"],
    },
  });

  return { html, sections };
}
